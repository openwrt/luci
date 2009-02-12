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
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <sys/time.h>
#include <string.h>
#include <fcntl.h>
#include "nixio.h"

/**
 * setblocking()
 */
static int nixio_sock_setblocking(lua_State *L) {
	int fd = nixio__checkfd(L, 1);
	int set = lua_toboolean(L, 2);
	int flags = fcntl(fd, F_GETFL);

	if (flags == -1) {
		return nixio__perror(L);
	}

	if (set) {
		flags |= O_NONBLOCK;
	} else {
		flags &= ~O_NONBLOCK;
	}

	return nixio__pstatus(L, !fcntl(fd, F_SETFL, flags));
}

static int nixio__gso_int(lua_State *L, int fd, int level, int opt, int set) {
	int value;
	socklen_t optlen = sizeof(value);
	if (!set) {
		if (!getsockopt(fd, level, opt, &value, &optlen)) {
			lua_pushinteger(L, value);
			return 1;
		}
	} else {
		value = luaL_checkinteger(L, set);
		if (!setsockopt(fd, level, opt, &value, optlen)) {
			lua_pushboolean(L, 1);
			return 1;
		}
	}
	return nixio__perror(L);
}

static int nixio__gso_ling(lua_State *L, int fd, int level, int opt, int set) {
	struct linger value;
	socklen_t optlen = sizeof(value);
	if (!set) {
		if (!getsockopt(fd, level, opt, &value, &optlen)) {
			lua_pushinteger(L, value.l_onoff ? value.l_linger : 0);
			return 1;
		}
	} else {
		value.l_linger = luaL_checkinteger(L, set);
		value.l_onoff = value.l_linger ? 1 : 0;
		if (!setsockopt(fd, level, opt, &value, optlen)) {
			lua_pushboolean(L, 1);
			return 1;
		}
	}
	return nixio__perror(L);
}

static int nixio__gso_timev(lua_State *L, int fd, int level, int opt, int set) {
	struct timeval value;
	socklen_t optlen = sizeof(value);
	if (!set) {
		if (!getsockopt(fd, level, opt, &value, &optlen)) {
			lua_pushinteger(L, value.tv_sec);
			lua_pushinteger(L, value.tv_usec);
			return 2;
		}
	} else {
		value.tv_sec  = luaL_checkinteger(L, set);
		value.tv_usec = luaL_optinteger(L, set + 1, 0);
		if (!setsockopt(fd, level, opt, &value, optlen)) {
			lua_pushboolean(L, 1);
			return 1;
		}
	}
	return nixio__perror(L);
}

/**
 * get/setsockopt() helper
 */
static int nixio__getsetsockopt(lua_State *L, int set) {
	nixio_sock *sock = nixio__checksock(L);
	const char *level = luaL_optlstring(L, 2, "", NULL);
	const char *option = luaL_optlstring(L, 3, "", NULL);
	set = (set) ? 4 : 0;

	if (!strcmp(level, "socket")) {
		if (!strcmp(option, "keepalive")) {
			return nixio__gso_int(L, sock->fd, SOL_SOCKET, SO_KEEPALIVE, set);
		} else if (!strcmp(option, "reuseaddr")) {
			return nixio__gso_int(L, sock->fd, SOL_SOCKET, SO_REUSEADDR, set);
		} else if (!strcmp(option, "rcvbuf")) {
			return nixio__gso_int(L, sock->fd, SOL_SOCKET, SO_RCVBUF, set);
		} else if (!strcmp(option, "sndbuf")) {
			return nixio__gso_int(L, sock->fd, SOL_SOCKET, SO_SNDBUF, set);
		} else if (!strcmp(option, "priority")) {
			return nixio__gso_int(L, sock->fd, SOL_SOCKET, SO_PRIORITY, set);
		} else if (!strcmp(option, "broadcast")) {
			return nixio__gso_int(L, sock->fd, SOL_SOCKET, SO_BROADCAST, set);
		} else if (!strcmp(option, "linger")) {
			return nixio__gso_ling(L, sock->fd, SOL_SOCKET, SO_LINGER, set);
		} else if (!strcmp(option, "sndtimeo")) {
			return nixio__gso_timev(L, sock->fd, SOL_SOCKET, SO_SNDTIMEO, set);
		} else if (!strcmp(option, "rcvtimeo")) {
			return nixio__gso_timev(L, sock->fd, SOL_SOCKET, SO_RCVTIMEO, set);
		} else {
			return luaL_argerror(L, 3, "supported values: keepalive, reuseaddr,"
			 " sndbuf, rcvbuf, priority, broadcast, linger, sndtimeo, rcvtimeo"
			);
		}
	} else if (!strcmp(level, "tcp")) {
		if (sock->type != SOCK_STREAM) {
			return luaL_error(L, "not a TCP socket");
		}
		if (!strcmp(option, "cork")) {
			return nixio__gso_int(L, sock->fd, SOL_TCP, TCP_CORK, set);
		} else if (!strcmp(option, "nodelay")) {
			return nixio__gso_int(L, sock->fd, SOL_TCP, TCP_NODELAY, set);
		} else {
			return luaL_argerror(L, 3, "supported values: cork, nodelay");
		}
	} else {
		return luaL_argerror(L, 2, "supported values: socket, tcp");
	}
}

/**
 * getsockopt()
 */
static int nixio_sock_getsockopt(lua_State *L) {
	return nixio__getsetsockopt(L, 0);
}

/**
 * setsockopt()
 */
static int nixio_sock_setsockopt(lua_State *L) {
	return nixio__getsetsockopt(L, 1);
}

/* module table */
static const luaL_reg M[] = {
	{"setblocking", nixio_sock_setblocking},
	{"getsockopt",	nixio_sock_getsockopt},
	{"setsockopt",	nixio_sock_setsockopt},
	{NULL,			NULL}
};

void nixio_open_sockopt(lua_State *L) {
	lua_pushvalue(L, -2);
	luaL_register(L, NULL, M);
	lua_pop(L, 1);

	luaL_getmetatable(L, NIXIO_FILE_META);
	lua_pushcfunction(L, nixio_sock_setblocking);
	lua_setfield(L, -2, "setblocking");
	lua_pop(L, 1);
}
