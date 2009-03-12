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
#include <sys/socket.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <string.h>
#include <netdb.h>

#ifndef NI_MAXHOST
#define NI_MAXHOST 1025
#endif


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
		if (!port && rp->ai_socktype != SOCK_STREAM) {
			continue;
		}

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

			char ip[INET6_ADDRSTRLEN];
			void *binaddr = NULL;
			uint16_t binport = 0;

			if (rp->ai_family == AF_INET) {
				struct sockaddr_in *v4addr = (struct sockaddr_in*)rp->ai_addr;
				binport = v4addr->sin_port;
				binaddr = (void *)&v4addr->sin_addr;
			} else if (rp->ai_family == AF_INET6) {
				struct sockaddr_in6 *v6addr = (struct sockaddr_in6*)rp->ai_addr;
				binport = v6addr->sin6_port;
				binaddr = (void *)&v6addr->sin6_addr;
			}

			if (!inet_ntop(rp->ai_family, binaddr, ip, sizeof(ip))) {
				freeaddrinfo(result);
				return nixio__perror(L);
			}

			if (port) {
				lua_pushinteger(L, ntohs(binport));
				lua_setfield(L, -2, "port");
			}

			lua_pushstring(L, ip);
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
	const char *ip = luaL_checklstring(L, 1, NULL);
	const char *family = luaL_optlstring(L, 2, "inet", NULL);
	char host[NI_MAXHOST];

	struct sockaddr *addr = NULL;
	socklen_t alen = 0;
	int res;

	if (!strcmp(family, "inet")) {
		struct sockaddr_in inetaddr;
		memset(&inetaddr, 0, sizeof(inetaddr));
		inetaddr.sin_family = AF_INET;
		if (inet_pton(AF_INET, ip, &inetaddr.sin_addr) < 1) {
			return luaL_argerror(L, 1, "invalid address");
		}
		alen = sizeof(inetaddr);
		addr = (struct sockaddr *)&inetaddr;
	} else if (!strcmp(family, "inet6")) {
		struct sockaddr_in6 inet6addr;
		memset(&inet6addr, 0, sizeof(inet6addr));
		inet6addr.sin6_family = AF_INET6;
		if (inet_pton(AF_INET6, ip, &inet6addr.sin6_addr) < 1) {
			return luaL_argerror(L, 1, "invalid address");
		}
		alen = sizeof(inet6addr);
		addr = (struct sockaddr *)&inet6addr;
	} else {
		return luaL_argerror(L, 2, "supported values: inet, inet6");
	}

	res = getnameinfo(addr, alen, host, sizeof(host), NULL, 0, NI_NAMEREQD);
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
 * getsockname() / getpeername() helper
 */
static int nixio_sock__getname(lua_State *L, int sock) {
	int sockfd = nixio__checksockfd(L);
	struct sockaddr_storage addr;
	socklen_t addrlen = sizeof(addr);
	char ipaddr[INET6_ADDRSTRLEN];
	void *binaddr;
	uint16_t port;

	if (sock) {
		if (getsockname(sockfd, (struct sockaddr*)&addr, &addrlen)) {
			return nixio__perror(L);
		}
	} else {
		if (getpeername(sockfd, (struct sockaddr*)&addr, &addrlen)) {
			return nixio__perror(L);
		}
	}

	if (addr.ss_family == AF_INET) {
		struct sockaddr_in *inetaddr = (struct sockaddr_in*)&addr;
		port = inetaddr->sin_port;
		binaddr = &inetaddr->sin_addr;
	} else if (addr.ss_family == AF_INET6) {
		struct sockaddr_in6 *inet6addr = (struct sockaddr_in6*)&addr;
		port = inet6addr->sin6_port;
		binaddr = &inet6addr->sin6_addr;
	} else {
		return luaL_error(L, "unknown address family");
	}

	if (!inet_ntop(addr.ss_family, binaddr, ipaddr, sizeof(ipaddr))) {
		return nixio__perror(L);
	}

	lua_pushstring(L, ipaddr);
	lua_pushinteger(L, ntohs(port));
	return 2;
}

/**
 * getsockname()
 */
static int nixio_sock_getsockname(lua_State *L) {
	return nixio_sock__getname(L, 1);
}

/**
 * getpeername()
 */
static int nixio_sock_getpeername(lua_State *L) {
	return nixio_sock__getname(L, 0);
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
