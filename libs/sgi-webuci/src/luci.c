/*
 * luci
 * Copyright (C) 2008 John Crispin <blogic@openwrt.org>
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

#include <string.h>
#include <stdio.h>
#include <boa-plugin.h>
#include <lauxlib.h>
#include <lualib.h>
#include <stdbool.h>
#include <stdlib.h>

#define LUAMAIN "luci.lua"

static lua_State *L = NULL;

extern int luci_parse_header (lua_State *L);

static lua_State *luci_context_init(struct httpd_plugin *p)
{
	char *path = NULL;
	lua_State *Lnew;
	int ret = 0;

	Lnew = luaL_newstate();
	if (!Lnew)
		goto error;

	luaL_openlibs(Lnew);

	path = malloc(strlen(p->dir) + sizeof(LUAMAIN) + 2);
	strcpy(path, p->dir);
	strcat(path, "/" LUAMAIN);

	ret = luaL_dofile(Lnew, path);

	lua_getfield(Lnew, LUA_GLOBALSINDEX, "luci-plugin");
	do {
		if (!lua_istable(Lnew, -1)) {
			ret = 1;
			break;
		}

		lua_getfield(Lnew, -1, "init");
		if (!lua_isfunction(Lnew, -1))
			break;

		lua_pushstring(Lnew, p->dir);
		ret = lua_pcall(Lnew, 1, 0, 0);
	} while (0);
	free(path);

	if (ret != 0)
		goto error;

	return Lnew;

error:
	fprintf(stderr, "Error: ");
	if (Lnew) {
		const char *s = lua_tostring(Lnew, -1);
		if (!s)
			s = "unknown error";
		fprintf(stderr, "%s\n", s);
		lua_close(Lnew);
	} else {
		fprintf(stderr, "Out of memory!\n");
	}
	return NULL;
}

static int luci_init(struct httpd_plugin *p)
{
	L = luci_context_init(p);
	return (L != NULL);
}

static void pushvar(char *name, char *val)
{
	if (!val)
		return;

	lua_pushstring(L, val);
	lua_setfield(L, -2, name);
}

static int luci_pcall(lua_State *L, char *func, int narg)
{
	int ret;

	ret = lua_pcall(L, narg, narg, 0);
	if (ret) {
		const char *s = lua_tostring(L, -1);
		if (s)
			fprintf(stderr, "Error running %s: %s\n", func, s);
		return ret;
	}
	if (!narg)
		return ret;

	ret = lua_isnumber(L, -1);
	if (!ret)
		goto done;

	ret = lua_tonumber(L, -1);

done:
	lua_pop(L, 1);
	return ret;
}

static int luci_prepare_req(struct httpd_plugin *p, struct http_context *ctx)
{
	int ret;
	bool reload = false;

	lua_getglobal(L, "luci-plugin");
	lua_getfield(L, -1, "reload");
	if (lua_isboolean(L, -1))
		reload = lua_toboolean(L, -1);
	lua_pop(L, 1);

	if (reload) {
		lua_close(L);
		L = luci_context_init(p);
		lua_getglobal(L, "luci-plugin");
	}

	lua_getfield(L, -1, "prepare_req");

	ret = lua_isfunction(L, -1);
	if (!ret)
		goto done;

	lua_pushstring(L, ctx->uri);

	ret = luci_pcall(L, "prepare_req", 1);

done:
	lua_pop(L, 1);
	return ret;
}

static int luci_handle_req(struct httpd_plugin *p, struct http_context *ctx)
{
	int ret;

	lua_newtable(L); /* new table for the http context */

	/* convert http_context data structure to lua table */
#define PUSH(x)	pushvar(#x, ctx->x)
	PUSH(cookie);
	PUSH(request_method);
	PUSH(server_addr);
	PUSH(server_proto);
	PUSH(query_string);
	PUSH(remote_addr);
	lua_pushinteger(L, ctx->remote_port);
	lua_setfield(L, -2, "remote_port");
	PUSH(content_type);
	PUSH(content_length);
	PUSH(http_accept);
#undef PUSH

	if (!strncmp(ctx->uri, p->prefix, strlen(p->prefix)))
		pushvar("uri", ctx->uri + strlen(p->prefix));
	else
		pushvar("uri", ctx->uri);


	/* make sure the global 'luci' table is prepared */
	lua_getglobal(L, "luci-plugin");
	if (!lua_istable(L, -1))
		return 0;

	lua_getfield(L, -1, "init_req");
	if (!lua_isfunction(L, -1)) {
		/* ignore error */
		lua_pop(L, 1);
	} else {
		lua_pushvalue(L, -3);
		luci_pcall(L, "init_req", 1);
	}

	/* storage space for cgi variables */
	lua_newtable(L);
	lua_pushvalue(L, -1); /* copy for setfield */
	lua_setfield(L, -3, "vars");

	lua_pushvalue(L, -3); /* the http context table */

	/* 
	 * make luci_parse_header a closure
	 * argument 1: the luci.vars table
	 * argument 2: the http context table
	 */
	lua_pushcclosure(L, luci_parse_header, 2);
	ret = luci_pcall(L, "parse_header", 0);

	lua_getfield(L, -1, "handle_req");
	ret = lua_isfunction(L, -1);
	if (!ret)
		goto done;

	lua_pushvalue(L, -3);
	ret = luci_pcall(L, "handle_req", 1);

	/* pop the luci and http context tables */
done:
	lua_pop(L, 2);
	return ret;
}

static void luci_unload(struct httpd_plugin *p)
{
	lua_close(L);
}

HTTPD_PLUGIN {
	.prefix = "/luci/",
	.init = luci_init,
	.done = luci_unload,
	.prepare_req = luci_prepare_req,
	.handle_req = luci_handle_req,
};
