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

#define _GNU_SOURCE

#include "nixio.h"
#include <fcntl.h>
#include <sys/sendfile.h>

/* guess what sucks... */
#ifdef __UCLIBC__
#include <unistd.h>
#include <errno.h>
#include <sys/syscall.h>
ssize_t splice(int __fdin, __off64_t *__offin, int __fdout,
        __off64_t *__offout, size_t __len, unsigned int __flags) {
#ifdef __NR_splice
	return syscall(__NR_splice, __fdin, __offin, __fdout, __offout, __len, __flags);
#else
	(void)__fdin;
	(void)__offin;
	(void)__fdout;
	(void)__offout;
	(void)__len;
	(void)__flags;
	errno = ENOSYS;
	return -1;
#endif
}
#endif /* __UCLIBC__ */

/**
 * Checks whether a flag is set in the table and translates it into a bitmap
 */
static void nixio_splice_flags__w(lua_State *L, int *m, int f, const char *t) {
	lua_pushstring(L, t);
	lua_rawget(L, -2);
	if (lua_toboolean(L, -1)) {
		*m |= f;
	}
	lua_pop(L, 1);
}

/**
 * Translate integer to poll flags and vice versa
 */
static int nixio_splice_flags(lua_State *L) {
	int flags = 0;

	luaL_checktype(L, 1, LUA_TTABLE);
	lua_settop(L, 1);
	nixio_splice_flags__w(L, &flags, SPLICE_F_MOVE, "move");
	nixio_splice_flags__w(L, &flags, SPLICE_F_NONBLOCK, "nonblock");
	nixio_splice_flags__w(L, &flags, SPLICE_F_MORE, "more");
	lua_pushinteger(L, flags);

	return 1;
}

/**
 * splice(fd_in, fd_out, length, flags)
 */
static int nixio_splice(lua_State *L) {
	int fd_in = nixio__checkfd(L, 1);
	int fd_out = nixio__checkfd(L, 2);
	size_t len = luaL_checkinteger(L, 3);
	int flags = luaL_optinteger(L, 4, 0);


	long spliced = splice(fd_in, NULL, fd_out, NULL, len, flags);

	if (spliced < 0) {
		return nixio__perror(L);
	}

	lua_pushnumber(L, spliced);
	return 1;
}

/**
 * sendfile(outfd, infd, length)
 */
static int nixio_sendfile(lua_State *L) {
	int sockfd = nixio__checksockfd(L);
	int infd = nixio__checkfd(L, 2);
	size_t len = luaL_checkinteger(L, 3);

	long spliced = sendfile(sockfd, infd, NULL, len);

	if (spliced < 0) {
		return nixio__perror(L);
	}

	lua_pushnumber(L, spliced);
	return 1;
}

/* module table */
static const luaL_reg R[] = {
	{"splice",			nixio_splice},
	{"splice_flags",	nixio_splice_flags},
	{"sendfile",		nixio_sendfile},
	{NULL,			NULL}
};

void nixio_open_splice(lua_State *L) {
	luaL_register(L, NULL, R);
}
