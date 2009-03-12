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
#include <pwd.h>
#include <grp.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <signal.h>

static int nixio_fork(lua_State *L) {
	pid_t pid = fork();
	if (pid == -1) {
		return nixio__perror(L);
	} else {
		lua_pushinteger(L, pid);
		return 1;
	}
}

static int nixio_signal(lua_State *L) {
	int sig = luaL_checkinteger(L, 1);
	const char *val = luaL_checkstring(L, 2);

	if (!strcmp(val, "ign") || !strcmp(val, "ignore")) {
		return nixio__pstatus(L, signal(sig, SIG_IGN) != SIG_ERR);
	} else if (!strcmp(val, "dfl") || !strcmp(val, "default")) {
		return nixio__pstatus(L, signal(sig, SIG_DFL) != SIG_ERR);
	} else {
		return luaL_argerror(L, 2, "supported values: ign, dfl");
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

	if (pidout == 0) {
		lua_pushboolean(L, 0);
		return 1;
	} else if (pidout == -1) {
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

static int nixio_getpid(lua_State *L) {
	lua_pushinteger(L, getpid());
	return 1;
}

static int nixio_getppid(lua_State *L) {
	lua_pushinteger(L, getppid());
	return 1;
}

static int nixio_getuid(lua_State *L) {
	lua_pushinteger(L, getuid());
	return 1;
}

static int nixio_getgid(lua_State *L) {
	lua_pushinteger(L, getgid());
	return 1;
}

static int nixio_setgid(lua_State *L) {
	gid_t gid;
	if (lua_isstring(L, 1)) {
		struct group *g = getgrnam(lua_tostring(L, 1));
		gid = (!g) ? -1 : g->gr_gid;
	} else if (lua_isnumber(L, 1)) {
		gid = lua_tointeger(L, 1);
	} else {
		return luaL_argerror(L, 1, "supported values: <groupname>, <gid>");
	}

	return nixio__pstatus(L, !setgid(gid));
}

static int nixio_setuid(lua_State *L) {
	uid_t uid;
	if (lua_isstring(L, 1)) {
		struct passwd *p = getpwnam(lua_tostring(L, 1));
		uid = (!p) ? -1 : p->pw_uid;
	} else if (lua_isnumber(L, 1)) {
		uid = lua_tointeger(L, 1);
	} else {
		return luaL_argerror(L, 1, "supported values: <username>, <uid>");
	}

	return nixio__pstatus(L, !setuid(uid));
}

static int nixio_nice(lua_State *L) {
	int nval = luaL_checkint(L, 1);

	errno = 0;
	nval = nice(nval);

	if (nval == -1 && errno) {
		return nixio__perror(L);
	} else {
		lua_pushinteger(L, nval);
		return 1;
	}
}

static int nixio_setsid(lua_State *L) {
	pid_t pid = setsid();

	if (pid == -1) {
		return nixio__perror(L);
	} else {
		lua_pushinteger(L, pid);
		return 1;
	}
}


/* module table */
static const luaL_reg R[] = {
	{"fork",		nixio_fork},
	{"wait",		nixio_wait},
	{"kill",		nixio_kill},
	{"nice",		nixio_nice},
	{"getpid",		nixio_getpid},
	{"getppid",		nixio_getppid},
	{"getuid",		nixio_getuid},
	{"getgid",		nixio_getgid},
	{"setuid",		nixio_setuid},
	{"setgid",		nixio_setgid},
	{"setsid",		nixio_setsid},
	{"signal",		nixio_signal},
	{NULL,			NULL}
};

void nixio_open_process(lua_State *L) {
	luaL_register(L, NULL, R);
}
