/*
 * luaplugin - fast lua plugin indexing
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
#include <limits.h>
#include <glob.h>

#include <lualib.h>
#include <lauxlib.h>
#include <lib/list.h>
#include <lib/luaplugin.h>

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

static char pbuf[PATH_MAX];
static void load_module(struct luaplugin_ctx *ctx, struct luaplugin_entry *e);

static struct luaplugin_entry *
find_entry(struct luaplugin_ctx *ctx, const char *name, bool modname)
{
	struct list_head *p;

	if (!ctx->last)
		ctx->last = &ctx->entries;

	list_for_each_offset(p, &ctx->entries, ctx->last) {
		struct luaplugin_entry *e;
		const char *cmp;

		e = container_of(p, struct luaplugin_entry, list);
		if (modname)
			cmp = e->module;
		else
			cmp = e->name;

		if (!strcmp(cmp, name))
			return e;
	}
	return NULL;
}

static struct luaplugin_entry *
new_entry(struct luaplugin_ctx *ctx, const char *name, const char *modname)
{
	struct luaplugin_entry *e;
	char *c;

	e = malloc(sizeof(struct luaplugin_entry));
	if (!e)
		goto error;

	memset(e, 0, sizeof(struct luaplugin_entry));
	INIT_LIST_HEAD(&e->list);
	e->ctx = ctx;
	e->loaded = false;

	e->name = strdup(name);
	if (!e->name)
		goto error1;

	e->module = strdup(modname);
	if (!e->module)
		goto error2;

	/* strip filename extension */
	c = strrchr(e->module, '.');
	if (c)
		*c = 0;

	/* lua namespace: replace / with . */
	c = e->module;
	while ((c = strchr(c, '/')) != NULL) {
		*c = '.';
	}
	return e;

error2:
	free(e->name);
error1:
	free(e);
error:
	return NULL;
}

static const char *module_loader =
"loader = function (newgt, filename)\n"
"	setmetatable(newgt, { __index = _G })\n"
"	local f = loadfile(filename)\n"
"	if (type(f) == \"function\") then\n"
"		setfenv(f, newgt)\n"
"		f()\n"
"	else\n"
"		error(f)\n"
"	end\n"
"end\n";

static void
access_plugin_table (lua_State *L, const char *modname, bool set)
{
	const char *e;

	lua_pushvalue(L, LUA_GLOBALSINDEX);
	do {
		bool _set = true;

		e = strchr(modname, '.');
		if (e == NULL) {
			e = modname + strlen(modname);
			_set = set;
		}

		lua_pushlstring(L, modname, e - modname);
		lua_rawget(L, -2);
		if (lua_isnil(L, -1) ||
		    /* no such field or last field */
		    (lua_istable(L, -1) && (*e != '.'))) {
			lua_pop(L, 1);  /* remove this result */

			if (_set) {
				if (*e != '.')
					lua_pushvalue(L, -2); /* use table from given index */
				else
					lua_createtable(L, 0, 1); /* new table for field */
			}

			lua_pushlstring(L, modname, e - modname);

			if (_set) {
				lua_pushvalue(L, -2);
				lua_settable(L, -4);  /* set new table into field */
			} else {
				lua_gettable(L, -2);
			}
		}
		else if (!lua_istable(L, -1)) {  /* field has a non-table value? */
			lua_pop(L, 2 + !!set);  /* remove table and values */
			return;
		}
		lua_remove(L, -2);  /* remove previous table */
		modname = e + 1;
	} while (*e == '.');
	if (set)
		lua_pop(L, 2);
}


static void
load_module(struct luaplugin_ctx *ctx, struct luaplugin_entry *e)
{
	lua_State *L = ctx->L;
	int ret;

	/* grab the loader wrapper function */
	ret = luaL_dostring(L, module_loader);
	if (ret)
		return;

	lua_getglobal(L, "loader");
	lua_pushnil(L);
	lua_setglobal(L, "loader");

	e->loaded = true;
	e->reload = false;

	/* new environment table for function call */
	lua_newtable(L);

	/* register the table globally */
	lua_pushvalue(L, -1);
	access_plugin_table(L, e->module, true);

	lua_pushstring(L, e->name);

	if (lua_pcall(L, 2, 0, 0) != 0) {
		const char *err = "unknown error";

		if (lua_isstring(L, -1))
			err = lua_tostring(L, -1);

		fprintf(stderr, "%s", err);
	}
}

static void
free_entry(struct luaplugin_ctx *ctx, struct luaplugin_entry *e)
{
	lua_State *L = ctx->L;

	if (e->loaded && L) {
		/* allow the gc to free the module */
		lua_pushnil(L);
		access_plugin_table(L, e->module, true);
	}
	list_del(&e->list);
	free(e->name);
	free(e->module);
	free(e);
}

static void
__luaplugin_scan(struct luaplugin_ctx *ctx, int base_len, int rec)
{
	int gl_flags = GLOB_NOESCAPE | GLOB_NOSORT | GLOB_MARK;
	glob_t gl;
	int i;

	strncpy(pbuf + base_len, "*.lua", PATH_MAX - base_len);
	if (glob(pbuf, gl_flags, NULL, &gl) < 0) {
		globfree(&gl);
		return;
	}

	for (i = 0; i < gl.gl_pathc; i++) {
		const char *entry = gl.gl_pathv[i];
		struct luaplugin_entry *e;
		struct stat st;
		int elen;

		elen = strlen(entry);

		/* should not happen */
		if ((elen <= base_len) || (strncmp(entry, pbuf, base_len) != 0)) {
			fprintf(stderr, "[%s] sanity check failed in %s(%d)!\n", __FILE__, __func__, __LINE__);
			continue;
		}

		/* descend into subdirectories */
		if (entry[elen - 1] == '/') {
			strncpy(pbuf + base_len, entry + base_len, PATH_MAX - base_len);
			__luaplugin_scan(ctx, base_len, rec + 1);
			pbuf[base_len] = '\0';
			continue;
		}

		if (stat(gl.gl_pathv[i], &st))
			continue;

		if ((st.st_mode & S_IFMT) != S_IFREG)
			continue;

		e = find_entry(ctx, entry + base_len, false);
		if (!e) {
			e = new_entry(ctx, entry, entry + base_len);
			list_add_tail(&e->list, &ctx->entries);
		}
		if (!e)
			continue;

		e->checked = ctx->checked;
		e->reload = (e->timestamp < st.st_mtime);
		e->timestamp = st.st_mtime;
	}
	globfree(&gl);
}

int
luaplugin_call(struct luaplugin_entry *e, int narg)
{
	struct luaplugin_ctx *ctx = e->ctx;
	lua_State *L = ctx->L;
	const char *func;
	int ret;

	func = luaL_checkstring(L, -1 - narg);

	/* grab a reference to the plugin's table */
	access_plugin_table(L, e->module, false);
	lua_getfield(L, -1, func);
	if (!lua_isfunction(L, -1)) {
		lua_pop(L, narg + 1);
		ret = -ENOENT;
		goto done;
	}

	/* replace function name with a ref to the function */
	lua_replace(L, -3 - narg);

	/* pop the table */
	lua_pop(L, 1);
	ret = lua_pcall(L, narg, 0, 0);

	if (ret != 0) {
		fprintf(stderr, "%s", lua_tostring(L, -1));
	}

done:
	return ret;
}

void
luaplugin_scan(struct luaplugin_ctx *ctx)
{
	struct list_head *tmp, *p;

	sprintf(pbuf, "%s/", ctx->path);

	ctx->checked++;
	__luaplugin_scan(ctx, strlen(pbuf), 0);

	/* expire old entries */
	list_for_each_safe(p, tmp, &ctx->entries) {
		struct luaplugin_entry *e = container_of(p, struct luaplugin_entry, list);
		if (e->checked < ctx->checked)
			free_entry(ctx, e);
		else if (e->reload)
			load_module(ctx, e);
	}
}

int
luaplugin_init(struct luaplugin_ctx *ctx, const char *path)
{
	memset(ctx, 0, sizeof(struct luaplugin_ctx));
	INIT_LIST_HEAD(&ctx->entries);
	ctx->path = path;

	ctx->L = luaL_newstate();
	if (!ctx->L)
		return -ENOMEM;

	luaL_openlibs(ctx->L);

	/* disable the module functionality, a plugin is restricted to its own environment */
	/*
	lua_pushcfunction(ctx->L, luaplugin_module);
	lua_setfield(ctx->L, LUA_GLOBALSINDEX, "module");
	*/

	return 0;
}

void
luaplugin_done(struct luaplugin_ctx *ctx)
{
	struct list_head *p, *tmp;

	lua_close(ctx->L);
	ctx->L = NULL;

	list_for_each_safe(p, tmp, &ctx->entries) {
		struct luaplugin_entry *e;
		e = container_of(p, struct luaplugin_entry, list);
		free_entry(ctx, e);
	}
}
