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
#include <sys/file.h>


static int nixio_file(lua_State *L) {
	const char *filename = luaL_checklstring(L, 1, NULL);
	const char *mode = luaL_optlstring(L, 2, "r", NULL);

	FILE *file = fopen(filename, mode);
	if (!file) {
		return nixio__perror(L);
	}

	FILE **udata = lua_newuserdata(L, sizeof(FILE*));
	if (!udata) {
		return luaL_error(L, "out of memory");
	}

	*udata = file;

	luaL_getmetatable(L, NIXIO_FILE_META);
	lua_setmetatable(L, -2);

	return 1;
}

static int nixio_pipe(lua_State *L) {
	int pipefd[2];
	FILE **udata;
	if (pipe(pipefd)) {
		return nixio__perror(L);
	}

	luaL_getmetatable(L, NIXIO_FILE_META);
	udata = lua_newuserdata(L, sizeof(FILE*));
	if (!udata) {
		return luaL_error(L, "out of memory");
	}

	if (!(*udata = fdopen(pipefd[0], "r"))) {
		return nixio__perror(L);
	}
	lua_pushvalue(L, -2);
	lua_setmetatable(L, -2);


	udata = lua_newuserdata(L, sizeof(FILE**));
	if (!(*udata = fdopen(pipefd[1], "w"))) {
		return nixio__perror(L);
	}
	lua_pushvalue(L, -3);
	lua_setmetatable(L, -2);

	return 2;
}

static int nixio_file_write(lua_State *L) {
	FILE *fp = nixio__checkfile(L);
	size_t len, written;
	const char *data = luaL_checklstring(L, 2, &len);
	written = fwrite(data, sizeof(char), len, fp);
	if (written < 0) {
		return nixio__perror(L);
	} else {
		lua_pushnumber(L, written);
		return 1;
	}
}


/* Some code borrowed from Lua 5.1.4 liolib.c */
static int nixio_file_read(lua_State *L) {
	FILE *f = nixio__checkfile(L);
	size_t n = (size_t)luaL_checkinteger(L, 2);
	luaL_argcheck(L, 2, n >= 0, "invalid length");

	if (n == 0) {
		if (feof(f)) {
			return 0;
		} else {
			lua_pushliteral(L, "");
			return 1;
		}
	}

	size_t rlen;  /* how much to read */
	size_t nr;  /* number of chars actually read */
	luaL_Buffer b;
	luaL_buffinit(L, &b);
	rlen = LUAL_BUFFERSIZE;  /* try to read that much each time */

	do {
		char *p = luaL_prepbuffer(&b);
		if (rlen > n) rlen = n;  /* cannot read more than asked */
			nr = fread(p, sizeof(char), rlen, f);
			luaL_addsize(&b, nr);
			n -= nr;  /* still have to read `n' chars */
	} while (n > 0 && nr == rlen);  /* until end of count or eof */
	luaL_pushresult(&b);  /* close buffer */
	return (n == 0 || lua_objlen(L, -1) > 0);
}

static int nixio_file_seek(lua_State *L) {
	FILE *f = nixio__checkfile(L);
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
	return nixio__pstatus(L, !fseeko(f, len, whence));
}

static int nixio_file_tell(lua_State *L) {
	FILE *f = nixio__checkfile(L);
	off_t pos = ftello(f);
	if (pos < 0) {
		return nixio__perror(L);
	} else {
		lua_pushnumber(L, (lua_Number)pos);
		return 1;
	}
}

static int nixio_file_flush(lua_State *L) {
	FILE *f = nixio__checkfile(L);
	return nixio__pstatus(L, !fflush(f));
}

static int nixio_file_lock(lua_State *L) {
	int fd = fileno(nixio__checkfile(L));

	const int j = lua_gettop(L);
	int flags = 0;
	for (int i=2; i<=j; i++) {
		const char *flag = luaL_checkstring(L, i);
		if (!strcmp(flag, "sh")) {
			flags |= LOCK_SH;
		} else if (!strcmp(flag, "ex")) {
			flags |= LOCK_EX;
		} else if (!strcmp(flag, "un")) {
			flags |= LOCK_UN;
		} else if (!strcmp(flag, "nb")) {
			flags |= LOCK_NB;
		} else {
			return luaL_argerror(L, i, "supported values: sh, ex, un, nb");
		}
	}

	return nixio__pstatus(L, flock(fd, flags));
}

static int nixio_file_close(lua_State *L) {
	FILE **fpp = (FILE**)luaL_checkudata(L, 1, NIXIO_FILE_META);
	luaL_argcheck(L, *fpp, 1, "invalid file object");
	int res = fclose(*fpp);
	*fpp = NULL;
	return nixio__pstatus(L, !res);
}

static int nixio_file__gc(lua_State *L) {
	FILE **fpp = (FILE**)luaL_checkudata(L, 1, NIXIO_FILE_META);
	if (*fpp) {
		fclose(*fpp);
		*fpp = NULL;
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
	{"flush",		nixio_file_flush},
	{"lock",		nixio_file_lock},
	{"close",		nixio_file_close},
	{"__gc",		nixio_file__gc},
	{"__tostring",	nixio_file__tostring},
	{NULL,			NULL}
};

/* module table */
static const luaL_reg R[] = {
	{"open",		nixio_file},
	{"pipe",		nixio_pipe},
	{NULL,			NULL}
};

void nixio_open_file(lua_State *L) {
	luaL_register(L, NULL, R);

	luaL_newmetatable(L, NIXIO_FILE_META);
	luaL_register(L, NULL, M);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_pop(L, 1);
}
