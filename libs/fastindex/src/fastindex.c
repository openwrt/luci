/*
 * fastindex - fast lua module indexing plugin
 * Copyright (C) 2008 Felix Fietkau <nbd@openwrt.org>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

#include <sys/types.h>
#include <sys/time.h>
#include <sys/cdefs.h>

#ifndef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE /* XXX: portability hack for timestamp */
#endif

#include <sys/stat.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <stdio.h>
#include <errno.h>
#include <glob.h>

#include <lualib.h>
#include <lauxlib.h>
#include "list.h"

#define MODNAME        "luci.fastindex"
#define DEFAULT_BUFLEN 1024

//#define DEBUG 1

#ifdef DEBUG
#define DPRINTF(...) fprintf(stderr, __VA_ARGS__)
#else
#define DPRINTF(...) do {} while (0)
#endif

/**
 * list_for_each_offset	-	iterate over a list, start with the provided pointer
 * @pos:	the &struct list_head to use as a loop cursor.
 * @head:	the head for your list.
 */
#define list_for_each_offset(pos, head, offset) \
	for (pos = (offset)->next; pos != (offset); \
	     pos = ((pos->next == (head)) && ((offset) != (head)) ? (head)->next : pos->next))

static char *namespace = NULL;

struct fastindex_entry {
	struct list_head list;
	time_t timestamp;
	int checked;
	char *name;
};

struct fastindex_pattern {
	struct list_head list;
	char pattern[];
};

struct fastindex {
	lua_State *L;
	int checked;
	char *func;
	struct list_head patterns;
	struct list_head *last;
	struct list_head entries;
	int ofs;
	char *buf;
	int buflen;
};

static inline struct fastindex *
to_fastindex(struct lua_State *L)
{
	struct fastindex *f;
	lua_getfield(L, lua_upvalueindex(1), "__data");
	f = lua_touserdata(L, -1);
	lua_pop(L, 1);
	return f;
}

static int
fastindex_module(lua_State *L)
{
	const char *s;
	s = luaL_checkstring(L, 1);

	if (s) {
		if (namespace)
			free(namespace);
		namespace = strdup(s);
	}

	return 0;
}

static struct fastindex_entry *
find_entry(struct fastindex *f, char *name)
{
	struct list_head *p;

	if (!f->last)
		f->last = &f->entries;

	list_for_each_offset(p, &f->entries, f->last) {
		struct fastindex_entry *e;
		e = container_of(p, struct fastindex_entry, list);
		if (!strcmp(e->name, name))
			return e;
	}
	return NULL;
}

static struct fastindex_entry *
new_entry(struct fastindex *f, char *name)
{
	struct fastindex_entry *e;

	e = malloc(sizeof(struct fastindex_entry));
	if (!e)
		goto error;

	memset(e, 0, sizeof(struct fastindex_entry));
	e->name = strdup(name);
	if (!e->name) {
		free(e);
		goto error;
	}
	INIT_LIST_HEAD(&e->list);

	return e;

error:
	return NULL;
}

static void free_entry(struct fastindex_entry *e)
{
	list_del(&e->list);
	free(e->name);
	free(e);
}

int bufferwriter(lua_State *L, const void *p, size_t sz, void *ud)
{
	struct fastindex *f = ud;

	while (f->ofs + sz > f->buflen) {
		char *b = f->buf;
		f->buflen *= 2;
		f->buf = realloc(f->buf, f->buflen);
		if (!f->buf) {
			free(b);
			return 1;
		}
	}
	memcpy(f->buf + f->ofs, p, sz);
	f->ofs += sz;
	return 0;
}

static void
load_index(struct fastindex *f, struct fastindex_entry *e)
{
	lua_State *L;

	DPRINTF("Loading module: %s\n", e->name);

	if (!f->buf)
		f->buf = malloc(f->buflen);

	if (!f->buf)
		luaL_error(f->L, "Out of memory!\n");

	f->ofs = 0;
	L = luaL_newstate();
	if (!L)
		return;

	namespace = NULL;
	luaL_openlibs(L);
	lua_pushcfunction(L, fastindex_module);
	lua_setfield(L, LUA_GLOBALSINDEX, "module");

	do {
		if (luaL_dofile(L, e->name)) {
			DPRINTF("Warning: unable to open module '%s'\n", e->name);
			break;
		}

		lua_getglobal(L, f->func);
		lua_dump(L, bufferwriter, f);
		DPRINTF("Got %d bytes\n", f->ofs);
		if (f->ofs == 0)
			break;
		lua_createtable(f->L, (namespace ? 2 : 1), 0);
		luaL_loadbuffer(f->L, f->buf, f->ofs, "tmp");
		lua_rawseti(f->L, -2, 1);
		if (namespace) {
			DPRINTF("Module has namespace '%s'\n", namespace);
			lua_pushstring(f->L, namespace);
			lua_rawseti(f->L, -2, 2);
			free(namespace);
			namespace = NULL;
		}
		lua_setfield(f->L, -2, e->name);
	} while (0);

	lua_close(L);
}


static int
fastindex_scan(lua_State *L)
{
	struct list_head *tmp, *p;
	struct fastindex *f;
	glob_t gl;
	int i;
	int gl_flags = GLOB_NOESCAPE | GLOB_NOSORT | GLOB_MARK;

	f = to_fastindex(L);
	f->checked++;


	if (list_empty(&f->patterns))
		return 0;

	lua_getfield(L, lua_upvalueindex(1), "indexes");
	list_for_each(p, &f->patterns) {
		struct fastindex_pattern *pt = container_of(p, struct fastindex_pattern, list);
		glob(pt->pattern, gl_flags, NULL, &gl);
		gl_flags |= GLOB_APPEND;
	}
	for (i = 0; i < gl.gl_pathc; i++) {
		struct fastindex_entry *e;
		struct stat st;

		if (stat(gl.gl_pathv[i], &st))
			continue;

		if ((st.st_mode & S_IFMT) != S_IFREG)
			continue;

		e = find_entry(f, gl.gl_pathv[i]);
		if (!e) {
			e = new_entry(f, gl.gl_pathv[i]);
			list_add_tail(&e->list, &f->entries);
		}

		e->checked = f->checked;
		if ((e->timestamp < st.st_mtime)) {
			load_index(f, e);
			e->timestamp = st.st_mtime;
		}
	}
	globfree(&gl);
	list_for_each_safe(p, tmp, &f->entries) {
		struct fastindex_entry *e = container_of(p, struct fastindex_entry, list);
		if (e->checked < f->checked) {
			lua_pushnil(f->L);
			lua_setfield(f->L, -2, e->name);
			free_entry(e);
		}
	}
	lua_pop(L, 1);

	return 0;
}

static int
fastindex_free(lua_State *L)
{
	struct fastindex *f;
	struct list_head *p, *tmp;

	f = lua_touserdata(L, -1);
	list_for_each_safe(p, tmp, &f->patterns) {
		struct fastindex_pattern *pt;
		pt = container_of(p, struct fastindex_pattern, list);
		list_del(p);
		free(pt);
	}
	list_for_each_safe(p, tmp, &f->entries) {
		struct fastindex_entry *e;
		e = container_of(p, struct fastindex_entry, list);
		free_entry(e);
	}
	return 0;
}

static int
fastindex_add(lua_State *L)
{
	struct fastindex_pattern *pt;
	struct fastindex *f;
	const char *str;

	f = to_fastindex(L);
	str = luaL_checkstring(L, 1);
	if (!str)
		luaL_error(L, "Invalid argument");

	pt = malloc(sizeof(struct fastindex_pattern) + strlen(str) + 1);
	if (!pt)
		luaL_error(L, "Out of memory");

	INIT_LIST_HEAD(&pt->list);
	strcpy(pt->pattern, str);
	list_add(&pt->list, &f->patterns);

	return 0;
}

static const luaL_Reg fastindex_m[] = {
	{ "add", fastindex_add },
	{ "scan", fastindex_scan },
	{ NULL, NULL }
};

static int
fastindex_new(lua_State *L)
{
	struct fastindex *f;
	const char *func;

	func = luaL_checkstring(L, 1);

	f = lua_newuserdata(L, sizeof(struct fastindex));
	lua_createtable(L, 0, 2);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_pushcfunction(L, fastindex_free);
	lua_setfield(L, -2, "__gc");
	lua_pushvalue(L, -1);
	lua_setmetatable(L, -3);
	lua_pushvalue(L, -2);
	lua_setfield(L, -2, "__data");
	lua_createtable(L, 0, 1);
	lua_setfield(L, -2, "indexes");
	lua_pushvalue(L, -2);
	luaI_openlib(L, NULL, fastindex_m, 1);

	memset(f, 0, sizeof(struct fastindex));
	f->L = L;
	f->buflen = DEFAULT_BUFLEN;
	INIT_LIST_HEAD(&f->entries);
	INIT_LIST_HEAD(&f->patterns);

	f->func = strdup(func);
	if (!f->func) {
		if (f->func)
			free(f->func);
		luaL_error(L, "Out of memory\n");
	}

	return 1;
}

static const luaL_Reg fastindex[] = {
	{ "new", fastindex_new },
	{ NULL, NULL },
};

int
luaopen_luci_fastindex(lua_State *L)
{
	luaL_register(L, MODNAME, fastindex);
	return 0;
}
