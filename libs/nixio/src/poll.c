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
#include <poll.h>
#include <time.h>
#include <errno.h>
#include <string.h>
#include <stdlib.h>
#include "nixio.h"


/**
 * nanosleep()
 */
static int nixio_nanosleep(lua_State *L) {
	struct timespec req, rem;
	req.tv_sec = luaL_optint(L, 1, 0);
	req.tv_nsec = luaL_optint(L, 2, 0);

	int status = nanosleep(&req, &rem);
	if (!status) {
		lua_pushboolean(L, 1);
		return 1;
	} else {
		if (errno == EINTR) {
			lua_pushboolean(L, 0);
			lua_pushinteger(L, rem.tv_sec);
			lua_pushinteger(L, rem.tv_nsec);
			return 3;
		} else {
			return nixio__perror(L);
		}
	}
}

/**
 * Checks whether a flag is set in the bitmap and sets the matching table value
 */
static void nixio_poll_flags__r(lua_State *L, int *map, int f, const char *t) {
	lua_pushstring(L, t);
	if (*map & f) {
		lua_pushboolean(L, 1);
	} else {
		lua_pushnil(L);
	}
	lua_rawset(L, -3);
}

/**
 * Translate integer to poll flags and vice versa
 */
static int nixio_poll_flags(lua_State *L) {
	int flags;
	if (lua_isnumber(L, 1)) {
		flags = luaL_checkinteger(L, 1);
		lua_newtable(L);
		nixio_poll_flags__r(L, &flags, POLLIN, "in");
		nixio_poll_flags__r(L, &flags, POLLPRI, "pri");
		nixio_poll_flags__r(L, &flags, POLLOUT, "out");
		nixio_poll_flags__r(L, &flags, POLLERR, "err");
		nixio_poll_flags__r(L, &flags, POLLHUP, "hup");
		nixio_poll_flags__r(L, &flags, POLLNVAL, "nval");
	 } else {
		flags = 0;
		const int j = lua_gettop(L);
		for (int i=1; i<=j; i++) {
			const char *flag = luaL_checkstring(L, i);
			if (!strcmp(flag, "in")) {
				flags |= POLLIN;
			} else if (!strcmp(flag, "pri")) {
				flags |= POLLPRI;
			} else if (!strcmp(flag, "out")) {
				flags |= POLLOUT;
			} else if (!strcmp(flag, "err")) {
				flags |= POLLERR;
			} else if (!strcmp(flag, "hup")) {
				flags |= POLLHUP;
			} else if (!strcmp(flag, "nval")) {
				flags |= POLLNVAL;
			} else {
				return luaL_argerror(L, i,
				 "supported values: in, pri, out, err, hup, nval");
			}
		}
		lua_pushinteger(L, flags);
	}
	return 1;
}

/**
 * poll({{fd = socket, events = FLAGS}, ...}, timeout)
 */
static int nixio_poll(lua_State *L) {
	int len = lua_objlen(L, 1);
	int i, fd;
	int timeout = luaL_optint(L, 2, 0);
	int status = -1;

	/* we are being abused as sleep() replacement... */
	if (lua_isnoneornil(L, 1) || len < 1) {
		return nixio__pstatus(L, !poll(NULL, 0, timeout));
	}

	luaL_checktype(L, 1, LUA_TTABLE);
	struct pollfd *fds = calloc(len, sizeof(struct pollfd));

	for (i = 0; i < len; i++) {
		lua_rawgeti(L, 1, i+1);
		if (!lua_istable(L, -1)) {
			free(fds);
			return luaL_argerror(L, 1, "invalid datastructure");
		}

		lua_pushliteral(L, "fd");
		lua_rawget(L, -2);
		fd = nixio__tofd(L, -1);
		if (fd == -1) {
			free(fds);
			return luaL_argerror(L, 1, "invalid fd in datastructure");
		}
		fds[i].fd = fd;

		lua_pushliteral(L, "events");
		lua_rawget(L, -3);
		fds[i].events = (short)lua_tointeger(L, -1);

		lua_pop(L, 3);
	}

	status = poll(fds, (nfds_t)len, timeout);

	if (status < 1) {
		free(fds);
		return nixio__perror(L);
	}

	for (i = 0; i < len; i++) {
		lua_rawgeti(L, 1, i+1);

		lua_pushliteral(L, "revents");
		lua_pushinteger(L, fds[i].revents);
		lua_rawset(L, -3);

		lua_pop(L, 1);
	}

	free(fds);

	lua_pushinteger(L, status);
	lua_pushvalue(L, 1);

	return 2;
}

/* module table */
static const luaL_reg R[] = {
	{"nanosleep",	nixio_nanosleep},
	{"poll",		nixio_poll},
	{"poll_flags",	nixio_poll_flags},
	{NULL,			NULL}
};

void nixio_open_poll(lua_State *L) {
	luaL_register(L, NULL, R);
}
