/*
 * nixio - Linux I/O library for lua
 *
 *   Copyright (C) 2009 Steven Barth <steven@midlink.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

#include "nixio.h"
#include <stdio.h>
#include <string.h>
#include <errno.h>

#define VERSION 0.1


/* pushes nil, error number and errstring on the stack */
int nixio__perror(lua_State *L) {
	if (errno == EAGAIN) {
		lua_pushboolean(L, 0);
	} else {
		lua_pushnil(L);
	}
    lua_pushinteger(L, errno);
    lua_pushstring(L, strerror(errno));
    return 3;
}

/* pushes true, if operation succeeded, otherwise call nixio__perror */
int nixio__pstatus(lua_State *L, int condition) {
	if (condition) {
		lua_pushboolean(L, 1);
		return 1;
	} else {
		return nixio__perror(L);
	}
}

/* checks whether the first argument is a socket and returns it */
nixio_sock* nixio__checksock(lua_State *L) {
    nixio_sock *sock = (nixio_sock*)luaL_checkudata(L, 1, NIXIO_META);
    luaL_argcheck(L, sock->fd != -1, 1, "invalid socket object");
    return sock;
}

FILE* nixio__checkfile(lua_State *L) {
	FILE **fpp = (FILE**)luaL_checkudata(L, 1, NIXIO_FILE_META);
	luaL_argcheck(L, *fpp, 1, "invalid file object");
	return *fpp;
}

/* read fd from nixio_sock object */
int nixio__checksockfd(lua_State *L) {
	return nixio__checksock(L)->fd;
}

/* return any possible fd, otherwise error out */
int nixio__checkfd(lua_State *L, int ud) {
	int fd = nixio__tofd(L, ud);
	return (fd != -1) ? fd : luaL_argerror(L, ud, "invalid file descriptor");
}

/* return any possible fd */
int nixio__tofd(lua_State *L, int ud) {
	void *udata = lua_touserdata(L, ud);
	int fd = -1;
	if (lua_getmetatable(L, ud)) {
		luaL_getmetatable(L, NIXIO_META);
		luaL_getmetatable(L, NIXIO_FILE_META);
		luaL_getmetatable(L, LUA_FILEHANDLE);
		if (lua_rawequal(L, -3, -4)) {
			fd = ((nixio_sock*)udata)->fd;
		} else if (lua_rawequal(L, -2, -4) || lua_rawequal(L, -1, -4)) {
			fd = (*((FILE **)udata)) ? fileno(*((FILE **)udata)) : -1;
		}
		lua_pop(L, 4);
	}
	return fd;
}

/* object table */
static const luaL_reg R[] = {
	{NULL,			NULL}
};

/* entry point */
LUALIB_API int luaopen_nixio(lua_State *L) {
	/* create metatable */
	luaL_newmetatable(L, NIXIO_META);

	/* metatable.__index = metatable */
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");

	/* register module */
	luaL_register(L, "nixio", R);

	/* register metatable as socket_meta */
	lua_pushvalue(L, -2);
	lua_setfield(L, -2, "socket_meta");

	/* register methods */
	nixio_open_file(L);
	nixio_open_socket(L);
	nixio_open_sockopt(L);
	nixio_open_bind(L);
	nixio_open_address(L);
	nixio_open_poll(L);
	nixio_open_io(L);
	nixio_open_splice(L);

	/* module version */
	lua_pushnumber(L, VERSION);
	lua_setfield(L, -2, "version");

	/* remove meta table */
	lua_remove(L, -2);

	return 1;
}
