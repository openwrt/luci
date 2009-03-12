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
#include <errno.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/param.h>


static int nixio_open(lua_State *L) {
	const char *filename = luaL_checklstring(L, 1, NULL);
	int flags = luaL_optint(L, 2, O_RDONLY);
	int mode = S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH;
	int fd;

	do {
		fd = open(filename, flags, mode);
	} while (fd == -1 && errno == EINTR);
	if (fd == -1) {
		return nixio__perror(L);
	}

	int *udata = lua_newuserdata(L, sizeof(int));
	if (!udata) {
		return luaL_error(L, "out of memory");
	}

	*udata = fd;

	luaL_getmetatable(L, NIXIO_FILE_META);
	lua_setmetatable(L, -2);

	return 1;
}

static int nixio_open_flags(lua_State *L) {
	int mode = 0;
	const int j = lua_gettop(L);
	for (int i=1; i<=j; i++) {
		const char *flag = luaL_checkstring(L, i);
		if (!strcmp(flag, "append")) {
			mode |= O_APPEND;
		} else if (!strcmp(flag, "creat")) {
			mode |= O_CREAT;
		} else if (!strcmp(flag, "excl")) {
			mode |= O_EXCL;
		} else if (!strcmp(flag, "nonblock") || !strcmp(flag, "ndelay")) {
			mode |= O_NONBLOCK;
		} else if (!strcmp(flag, "sync")) {
			mode |= O_SYNC;
		} else if (!strcmp(flag, "trunc")) {
			mode |= O_TRUNC;
		} else if (!strcmp(flag, "rdonly")) {
			mode |= O_RDONLY;
		} else if (!strcmp(flag, "wronly")) {
			mode |= O_WRONLY;
		} else if (!strcmp(flag, "rdwr")) {
			mode |= O_RDWR;
		} else {
			return luaL_argerror(L, i, "supported values: append, creat, "
					"excl, nonblock, ndelay, sync, trunc");
		}
	}
	lua_pushinteger(L, mode);
	return 1;
}

static int nixio_dup(lua_State *L) {
	int oldfd = nixio__checkfd(L, 1);
	int newfd = (lua_gettop(L) > 1) ? nixio__checkfd(L, 2) : -1;
	int stat  = (newfd == -1) ? dup(oldfd) : dup2(oldfd, newfd);

	if (stat == -1) {
		return nixio__perror(L);
	} else {
		int *udata = lua_newuserdata(L, sizeof(int));
		if (!udata) {
			return luaL_error(L, "out of memory");
		}

		*udata = stat;
		luaL_getmetatable(L, NIXIO_FILE_META);
		lua_setmetatable(L, -2);
		return 1;
	}
}

static int nixio_pipe(lua_State *L) {
	int pipefd[2], *udata;
	if (pipe(pipefd)) {
		return nixio__perror(L);
	}

	luaL_getmetatable(L, NIXIO_FILE_META);
	udata = lua_newuserdata(L, sizeof(int));
	if (!udata) {
		return luaL_error(L, "out of memory");
	}

	*udata = pipefd[0];
	lua_pushvalue(L, -2);
	lua_setmetatable(L, -2);


	udata = lua_newuserdata(L, sizeof(int));
	if (!udata) {
		return luaL_error(L, "out of memory");
	}

	*udata = pipefd[1];
	lua_pushvalue(L, -3);
	lua_setmetatable(L, -2);

	return 2;
}

static int nixio_file_write(lua_State *L) {
	int fd = nixio__checkfd(L, 1);
	size_t len;
	ssize_t sent;
	const char *data = luaL_checklstring(L, 2, &len);

	do {
		sent = write(fd, data, len);
	} while(sent == -1 && errno == EINTR);
	if (sent >= 0) {
		lua_pushinteger(L, sent);
		return 1;
	} else {
		return nixio__perror(L);
	}
}

static int nixio_file_read(lua_State *L) {
	int fd = nixio__checkfd(L, 1);
	char buffer[NIXIO_BUFFERSIZE];
	int req = luaL_checkinteger(L, 2);
	int readc;

	/* We limit the readsize to NIXIO_BUFFERSIZE */
	req = (req > NIXIO_BUFFERSIZE) ? NIXIO_BUFFERSIZE : req;

	do {
		readc = read(fd, buffer, req);
	} while (readc == -1 && errno == EINTR);

	if (readc < 0) {
		return nixio__perror(L);
	} else {
		lua_pushlstring(L, buffer, readc);
		return 1;
	}
}


static int nixio_file_seek(lua_State *L) {
	int fd = nixio__checkfd(L, 1);
	off_t len = (off_t)luaL_checknumber(L, 2);
	int whence;
	const char *whstr = luaL_optlstring(L, 3, "set", NULL);
	if (!strcmp(whstr, "set")) {
		whence = SEEK_SET;
	} else if (!strcmp(whstr, "cur")) {
		whence = SEEK_CUR;
	} else if (!strcmp(whstr, "end")) {
		whence = SEEK_END;
	} else {
		return luaL_argerror(L, 3, "supported values: set, cur, end");
	}
	len = lseek(fd, len, whence);
	if (len == -1) {
		return nixio__perror(L);
	} else {
		lua_pushnumber(L, len);
		return 1;
	}
}

static int nixio_file_tell(lua_State *L) {
	int fd = nixio__checkfd(L, 1);
	off_t pos = lseek(fd, 0, SEEK_CUR);
	if (pos < 0) {
		return nixio__perror(L);
	} else {
		lua_pushnumber(L, pos);
		return 1;
	}
}

static int nixio_file_sync(lua_State *L) {
	int fd = nixio__checkfd(L, 1);
#ifndef BSD
	int meta = lua_toboolean(L, 2);
	return nixio__pstatus(L, (meta) ? !fsync(fd) : !fdatasync(fd));
#else
	return nixio__pstatus(L, !fsync(fd));
#endif
}

static int nixio_file_lock(lua_State *L) {
	int fd = nixio__checkfd(L, 1);
	const char *flag = luaL_checkstring(L, 2);
	off_t len = (off_t)luaL_optnumber(L, 3, 0);
	int stat;

	int cmd = 0;
	if (!strcmp(flag, "lock")) {
		cmd = F_LOCK;
	} else if (!strcmp(flag, "tlock")) {
		cmd = F_TLOCK;
	} else if (!strcmp(flag, "ulock")) {
		cmd = F_ULOCK;
	} else if (!strcmp(flag, "test")) {
		cmd = F_TEST;
	} else {
		return luaL_argerror(L, 2,
				"supported values: lock, tlock, ulock, test");
	}

	do {
		stat = lockf(fd, cmd, len);
	} while (stat == -1 && errno == EINTR);

	return nixio__pstatus(L, !stat);
}

static int nixio_file_close(lua_State *L) {
	int *fdp = luaL_checkudata(L, 1, NIXIO_FILE_META);
	luaL_argcheck(L, *fdp != -1, 1, "invalid file object");
	int res;
	do {
		res = close(*fdp);
	} while (res == -1 && errno == EINTR);
	*fdp = -1;
	return nixio__pstatus(L, !res);
}

static int nixio_file__gc(lua_State *L) {
	int *fdp = luaL_checkudata(L, 1, NIXIO_FILE_META);
	int res;
	if (*fdp != -1) {
		do {
			res = close(*fdp);
		} while (res == -1 && errno == EINTR);
		*fdp = -1;
	}
	return 0;
}

/**
 * string representation
 */
static int nixio_file__tostring(lua_State *L) {
	lua_pushfstring(L, "nixio file %d", nixio__tofd(L, 1));
	return 1;
}

/* method table */
static const luaL_reg M[] = {
	{"write",		nixio_file_write},
	{"read",		nixio_file_read},
	{"tell",		nixio_file_tell},
	{"seek",		nixio_file_seek},
	{"sync",		nixio_file_sync},
	{"lock",		nixio_file_lock},
	{"close",		nixio_file_close},
	{"__gc",		nixio_file__gc},
	{"__tostring",	nixio_file__tostring},
	{NULL,			NULL}
};

/* module table */
static const luaL_reg R[] = {
	{"dup",			nixio_dup},
	{"open",		nixio_open},
	{"open_flags",	nixio_open_flags},
	{"pipe",		nixio_pipe},
	{NULL,			NULL}
};

void nixio_open_file(lua_State *L) {
	luaL_register(L, NULL, R);

	luaL_newmetatable(L, NIXIO_FILE_META);
	luaL_register(L, NULL, M);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setfield(L, -2, "meta_file");
}
