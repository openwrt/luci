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

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>
#include <sys/select.h>
#include "nixio.h"

static int nixio_select(lua_State *L) {
	int nfds = 0, tmpfd = -1, i = 0, j = 0, o = 0, k, tlen;
	fd_set rfds, wfds, xfds;
	fd_set *fdsets[3] = {&rfds, &wfds, &xfds};
	FD_ZERO(fdsets[0]);
	FD_ZERO(fdsets[1]);
	FD_ZERO(fdsets[2]);

	struct timeval timeout;
	timeout.tv_sec = luaL_optinteger(L, 4, 0);
	timeout.tv_usec = luaL_optinteger(L, 5, 0);

	/* create fdsets */
	for (i=0; i<3; i++) {
		o = i + 1;
		if (lua_isnoneornil(L, o)) {
			fdsets[i] = NULL;
			continue;
		}

		luaL_checktype(L, o, LUA_TTABLE);
		tlen = lua_objlen(L, o);
		luaL_argcheck(L, tlen <= FD_SETSIZE, o, "too many fds");

		for (j=1; j<=tlen; j++) {
			lua_rawgeti(L, o, j);
			tmpfd = nixio__checkfd(L, -1);
			FD_SET(tmpfd, fdsets[i]);
			if (tmpfd >= nfds) {
				nfds = tmpfd + 1;
			}
			lua_pop(L, 1);
		}
	}

	int stat = select(nfds, fdsets[0], fdsets[1], fdsets[2], &timeout);

	if (stat < 0) {
		return nixio__perror(L);
	} else if (stat == 0) {
		lua_pushinteger(L, stat);
		for (i=1; i<=3; i++) {
			if (lua_isnoneornil(L, i)) {
				lua_pushnil(L);
			} else {
				lua_newtable(L);
			}
		}
	} else {
		lua_pushinteger(L, stat);

		/* create return tables */
		for (i=0; i<3; i++) {
			o = i + 1;
			if (lua_isnoneornil(L, o)) {
				lua_pushnil(L);
				continue;
			}

			lua_newtable(L);
			tlen = lua_objlen(L, o);
			k = 1;

			for (j=1; j<=tlen; j++) {
				lua_rawgeti(L, o, j);
				tmpfd = nixio__tofd(L, -1);
				if (FD_ISSET(tmpfd, fdsets[i])) {
					lua_rawseti(L, -2, k++);
				} else {
					lua_pop(L, 1);
				}
			}
		}
	}
	return 4;
}

/* module table */
static const luaL_reg R[] = {
	{"select",	nixio_select},
	{NULL,			NULL}
};

void nixio_open_select(lua_State *L) {
	luaL_register(L, NULL, R);
}
