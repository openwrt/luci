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
#include <sys/types.h>
#include <errno.h>
#include <string.h>

#ifndef NI_MAXHOST
#define NI_MAXHOST 1025
#endif

/**
 * address pushing helper
 */
int nixio__addr_parse(nixio_addr *addr, struct sockaddr *saddr) {
	void *baddr;

	addr->family = saddr->sa_family;
	if (saddr->sa_family == AF_INET) {
		struct sockaddr_in *inetaddr = (struct sockaddr_in*)saddr;
		addr->port = ntohs(inetaddr->sin_port);
		baddr = &inetaddr->sin_addr;
	} else if (saddr->sa_family == AF_INET6) {
		struct sockaddr_in6 *inet6addr = (struct sockaddr_in6*)saddr;
		addr->port = ntohs(inet6addr->sin6_port);
		baddr = &inet6addr->sin6_addr;
	} else {
		errno = EAFNOSUPPORT;
		return -1;
	}

	if (!inet_ntop(saddr->sa_family, baddr, addr->host, sizeof(addr->host))) {
		return -1;
	}

	return 0;
}

/**
 * address pulling helper
 */
int nixio__addr_write(nixio_addr *addr, struct sockaddr *saddr) {
	if (addr->family == AF_UNSPEC) {
		if (strchr(addr->host, ':')) {
			addr->family = AF_INET6;
		} else {
			addr->family = AF_INET;
		}
	}
	if (addr->family == AF_INET) {
		struct sockaddr_in *inetaddr = (struct sockaddr_in *)saddr;
		memset(inetaddr, 0, sizeof(struct sockaddr_in));

		if (inet_pton(AF_INET, addr->host, &inetaddr->sin_addr) < 1) {
			return -1;
		}

		inetaddr->sin_family = AF_INET;
		inetaddr->sin_port = htons((uint16_t)addr->port);
		return 0;
	} else if (addr->family == AF_INET6) {
		struct sockaddr_in6 *inet6addr = (struct sockaddr_in6 *)saddr;
		memset(inet6addr, 0, sizeof(struct sockaddr_in6));

		if (inet_pton(AF_INET6, addr->host, &inet6addr->sin6_addr) < 1) {
			return -1;
		}

		inet6addr->sin6_family = AF_INET6;
		inet6addr->sin6_port = htons((uint16_t)addr->port);
		return 0;
	} else {
		errno = EAFNOSUPPORT;
		return -1;
	}
}


/**
 * getaddrinfo(host, family, port)
 */
static int nixio_getaddrinfo(lua_State *L) {
	const char *host = NULL;
	if (!lua_isnoneornil(L, 1)) {
		host = luaL_checklstring(L, 1, NULL);
	}
	const char *family = luaL_optlstring(L, 2, "any", NULL);
	const char *port = lua_tolstring(L, 3, NULL);

	struct addrinfo hints, *result, *rp;
	memset(&hints, 0, sizeof(hints));

	if (!strcmp(family, "any")) {
		hints.ai_family = AF_UNSPEC;
	} else if (!strcmp(family, "inet")) {
		hints.ai_family = AF_INET;
	} else if (!strcmp(family, "inet6")) {
		hints.ai_family = AF_INET6;
	} else {
		return luaL_argerror(L, 2, "supported values: any, inet, inet6");
	}

	hints.ai_socktype = 0;
	hints.ai_protocol = 0;

	int aistat = getaddrinfo(host, port, &hints, &result);
	if (aistat) {
		lua_pushnil(L);
		lua_pushinteger(L, aistat);
		lua_pushstring(L, gai_strerror(aistat));
		return 3;
	}

	/* create socket object */
	lua_newtable(L);
	int i = 1;

	for (rp = result; rp != NULL; rp = rp->ai_next) {
		/* avoid duplicate results */
#ifndef __WINNT__
		if (!port && rp->ai_socktype != SOCK_STREAM) {
			continue;
		}
#endif

		if (rp->ai_family == AF_INET || rp->ai_family == AF_INET6) {
			lua_createtable(L, 0, port ? 4 : 2);
			if (rp->ai_family == AF_INET) {
				lua_pushliteral(L, "inet");
			} else if (rp->ai_family == AF_INET6) {
				lua_pushliteral(L, "inet6");
			}
			lua_setfield(L, -2, "family");

			if (port) {
				switch (rp->ai_socktype) {
					case SOCK_STREAM:
						lua_pushliteral(L, "stream");
						break;
					case SOCK_DGRAM:
						lua_pushliteral(L, "dgram");
						break;
					case SOCK_RAW:
						lua_pushliteral(L, "raw");
						break;
					default:
						lua_pushnil(L);
						break;
				}
				lua_setfield(L, -2, "socktype");
			}

			nixio_addr addr;
			if (nixio__addr_parse(&addr, rp->ai_addr)) {
				freeaddrinfo(result);
				return nixio__perror_s(L);
			}

			if (port) {
				lua_pushinteger(L, addr.port);
				lua_setfield(L, -2, "port");
			}

			lua_pushstring(L, addr.host);
			lua_setfield(L, -2, "address");
			lua_rawseti(L, -2, i++);
		}
	}

	freeaddrinfo(result);

	return 1;
}

/**
 * getnameinfo(address, family)
 */
static int nixio_getnameinfo(lua_State *L) {
	const char *ip = luaL_checkstring(L, 1);
	const char *family = luaL_optstring(L, 2, NULL);
	char host[NI_MAXHOST];

	struct sockaddr_storage saddr;
	nixio_addr addr;
	memset(&addr, 0, sizeof(addr));
	strncpy(addr.host, ip, sizeof(addr.host) - 1);

	if (!family) {
		addr.family = AF_UNSPEC;
	} else if (!strcmp(family, "inet")) {
		addr.family = AF_INET;
	} else if (!strcmp(family, "inet6")) {
		addr.family = AF_INET6;
	} else {
		return luaL_argerror(L, 2, "supported values: inet, inet6");
	}

	nixio__addr_write(&addr, (struct sockaddr *)&saddr);

	int res = getnameinfo((struct sockaddr *)&saddr, sizeof(saddr),
	 host, sizeof(host), NULL, 0, NI_NAMEREQD);
	if (res) {
		lua_pushnil(L);
		lua_pushinteger(L, res);
		lua_pushstring(L, gai_strerror(res));
		return 3;
	} else {
		lua_pushstring(L, host);
		return 1;
	}
}

/**
 * getsockname()
 */
static int nixio_sock_getsockname(lua_State *L) {
	int sockfd = nixio__checksockfd(L);
	struct sockaddr_storage saddr;
	socklen_t addrlen = sizeof(saddr);
	nixio_addr addr;

	if (getsockname(sockfd, (struct sockaddr*)&saddr, &addrlen) ||
	 nixio__addr_parse(&addr, (struct sockaddr*)&saddr)) {
		return nixio__perror_s(L);
	}

	lua_pushstring(L, addr.host);
	lua_pushnumber(L, addr.port);
	return 2;
}

/**
 * getpeername()
 */
static int nixio_sock_getpeername(lua_State *L) {
	int sockfd = nixio__checksockfd(L);
	struct sockaddr_storage saddr;
	socklen_t addrlen = sizeof(saddr);
	nixio_addr addr;

	if (getpeername(sockfd, (struct sockaddr*)&saddr, &addrlen) ||
	 nixio__addr_parse(&addr, (struct sockaddr*)&saddr)) {
		return nixio__perror_s(L);
	}

	lua_pushstring(L, addr.host);
	lua_pushnumber(L, addr.port);
	return 2;
}


/* module table */
static const luaL_reg R[] = {
	{"getaddrinfo",	nixio_getaddrinfo},
	{"getnameinfo",	nixio_getnameinfo},
	{NULL,			NULL}
};

/* object table */
static const luaL_reg M[] = {
	{"getsockname",	nixio_sock_getsockname},
	{"getpeername",	nixio_sock_getpeername},
	{NULL,			NULL}
};

void nixio_open_address(lua_State *L) {
	luaL_register(L, NULL, R);

	lua_pushvalue(L, -2);
	luaL_register(L, NULL, M);
	lua_pop(L, 1);
}
