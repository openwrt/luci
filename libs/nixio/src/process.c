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
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <sys/wait.h>

static int nixio_fork(lua_State *L) {
	pid_t pid = fork();
	if (pid == -1) {
		return nixio__perror(L);
	} else {
		lua_pushinteger(L, pid);
		return 1;
	}
}

static int nixio_wait(lua_State *L) {
	pid_t pidin = luaL_optinteger(L, 1, -1), pidout;
	int options = 0, status;

	const int j = lua_gettop(L);
	for (int i=2; i<=j; i++) {
		const char *flag = luaL_checkstring(L, i);
		if (!strcmp(flag, "nohang")) {
			options |= WNOHANG;
		} else if (!strcmp(flag, "untraced")) {
			options |= WUNTRACED;
		} else if (!strcmp(flag, "continued")) {
			options |= WCONTINUED;
		} else {
			return luaL_argerror(L, i,
					"supported values: nohang, untraced, continued");
		}
	}

	do {
		pidout = waitpid(pidin, &status, options);
	} while (pidout == -1 && errno == EINTR);

	if (pidout == -1) {
		return nixio__perror(L);
	} else {
		lua_pushinteger(L, pidout);
	}

	if (WIFEXITED(status)) {
		lua_pushliteral(L, "exited");
		lua_pushinteger(L, WEXITSTATUS(status));
    } else if (WIFSIGNALED(status)) {
    	lua_pushliteral(L, "signaled");
    	lua_pushinteger(L, WTERMSIG(status));
    } else if (WIFSTOPPED(status)) {
    	lua_pushliteral(L, "stopped");
    	lua_pushinteger(L, WSTOPSIG(status));
    } else {
    	return 1;
    }

    return 3;
}

static int nixio_kill(lua_State *L) {
	return nixio__pstatus(L, !kill(luaL_checkint(L, 1), luaL_checkint(L, 2)));
}


/* module table */
static const luaL_reg R[] = {
	{"fork",		nixio_fork},
	{"wait",		nixio_wait},
	{"kill",		nixio_kill},
	{NULL,			NULL}
};

void nixio_open_process(lua_State *L) {
	luaL_register(L, NULL, R);
}
