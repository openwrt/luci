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
#include <fcntl.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <sys/sendfile.h>

#ifdef _GNU_SOURCE

/* guess what sucks... */
#ifdef __UCLIBC__
#include <unistd.h>
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
 * splice(fd_in, fd_out, length, flags)
 */
static int nixio_splice(lua_State *L) {
	int fd_in = nixio__checkfd(L, 1);
	int fd_out = nixio__checkfd(L, 2);
	size_t len = luaL_checkinteger(L, 3);
	int flags = luaL_optinteger(L, 4, 0);
	long spliced;

	do {
		spliced = splice(fd_in, NULL, fd_out, NULL, len, flags);
	} while (spliced == -1 && errno == EINTR);

	if (spliced < 0) {
		return nixio__perror(L);
	}

	lua_pushnumber(L, spliced);
	return 1;
}

/**
 * Translate splice flags to integer
 */
static int nixio_splice_flags(lua_State *L) {
	const int j = lua_gettop(L);
	int flags = 0;
	for (int i=1; i<=j; i++) {
		const char *flag = luaL_checkstring(L, i);
		if (!strcmp(flag, "move")) {
			flags |= SPLICE_F_MOVE;
		} else if (!strcmp(flag, "nonblock")) {
			flags |= SPLICE_F_NONBLOCK;
		} else if (!strcmp(flag, "more")) {
			flags |= SPLICE_F_MORE;
		} else {
			return luaL_argerror(L, i, "supported values: "
			 "move, nonblock, more");
		}
	}
	lua_pushinteger(L, flags);

	return 1;
}

#endif /* _GNU_SOURCE */

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
#ifdef _GNU_SOURCE
	{"splice",			nixio_splice},
	{"splice_flags",	nixio_splice_flags},
#endif
	{"sendfile",		nixio_sendfile},
	{NULL,			NULL}
};

void nixio_open_splice(lua_State *L) {
	luaL_register(L, NULL, R);
}
