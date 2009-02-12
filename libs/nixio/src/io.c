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
#include <sys/types.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include "nixio.h"



/**
 * send() / sendto() helper
 */
static int nixio_sock__sendto(lua_State *L, int to) {
	nixio_sock *sock = nixio__checksock(L);
	struct sockaddr *addr = NULL;
	socklen_t alen = 0;

	if (to) {
		const char *address = luaL_checklstring(L, 2, NULL);
		uint16_t port = (uint16_t)luaL_checkinteger(L, 3);
		struct sockaddr_storage addrstor;
		addr = (struct sockaddr*)&addrstor;
		if (sock->domain == AF_INET) {
			struct sockaddr_in *inetaddr = (struct sockaddr_in *)addr;
			if (inet_pton(sock->domain, address, &inetaddr->sin_addr) < 0) {
				return luaL_argerror(L, 3, "invalid address");
			}
			inetaddr->sin_port = htons(port);
			alen = sizeof(*inetaddr);
		} else if (sock->domain == AF_INET6) {
			struct sockaddr_in6 *inet6addr = (struct sockaddr_in6 *)addr;
			if (inet_pton(sock->domain, address, &inet6addr->sin6_addr) < 0) {
				return luaL_argerror(L, 3, "invalid address");
			}
			inet6addr->sin6_port = htons(port);
			alen = sizeof(*inet6addr);
		} else {
			return luaL_argerror(L, 1, "supported families: inet, inet6");
		}
	}

	size_t len;
	ssize_t sent;
	const char *data = luaL_checklstring(L, 2, &len);
	do {
		sent = sendto(sock->fd, data, len, 0, addr, alen);
	} while(sent == -1 && errno == EINTR);
	if (len >= 0) {
		lua_pushinteger(L, sent);
		return 1;
	} else {
		return nixio__perror(L);
	}
}

/**
 * send(data)
 */
static int nixio_sock_send(lua_State *L) {
	return nixio_sock__sendto(L, 0);
}

/**
 * sendto(data, address, port)
 */
static int nixio_sock_sendto(lua_State *L) {
	return nixio_sock__sendto(L, 1);
}


/**
 * recv() / recvfrom() helper
 */
static int nixio_sock__recvfrom(lua_State *L, int from) {
	nixio_sock *sock = nixio__checksock(L);
	char buffer[NIXIO_BUFFERSIZE];
	struct sockaddr_storage addrobj;
	int req = luaL_checkinteger(L, 2);
	int readc;

	if (from && sock->domain != AF_INET && sock->domain != AF_INET6) {
		return luaL_argerror(L, 1, "supported families: inet, inet6");
	}

	struct sockaddr *addr = (from) ? (struct sockaddr*)&addrobj : NULL;
	socklen_t alen = (from) ? sizeof(addrobj) : 0;

	/* We limit the readsize to NIXIO_BUFFERSIZE */
	req = (req > NIXIO_BUFFERSIZE) ? NIXIO_BUFFERSIZE : req;

	do {
		readc = recvfrom(sock->fd, buffer, req, 0, addr, &alen);
	} while (readc == -1 && errno == EINTR);

	if (readc < 0) {
		return nixio__perror(L);
	} else {
		lua_pushlstring(L, buffer, readc);

		if (!from) {
			return 1;
		} else {
			char ipaddr[INET6_ADDRSTRLEN];
			void *binaddr;
			uint16_t port;

			if (addrobj.ss_family == AF_INET) {
				struct sockaddr_in *inetaddr = (struct sockaddr_in*)addr;
				port = inetaddr->sin_port;
				binaddr = &inetaddr->sin_addr;
			} else if (addrobj.ss_family == AF_INET6) {
				struct sockaddr_in6 *inet6addr = (struct sockaddr_in6*)addr;
				port = inet6addr->sin6_port;
				binaddr = &inet6addr->sin6_addr;
			} else {
				return luaL_error(L, "unknown address family");
			}

			if (!inet_ntop(addrobj.ss_family, binaddr, ipaddr, sizeof(ipaddr))) {
				return nixio__perror(L);
			}

			lua_pushstring(L, ipaddr);
			lua_pushinteger(L, ntohs(port));

			return 3;
		}
	}
}

/**
 * recv(count)
 */
static int nixio_sock_recv(lua_State *L) {
	return nixio_sock__recvfrom(L, 0);
}

/**
 * recvfrom(count)
 */
static int nixio_sock_recvfrom(lua_State *L) {
	return nixio_sock__recvfrom(L, 1);
}


/* module table */
static const luaL_reg M[] = {
	{"send",	nixio_sock_send},
	{"sendto",	nixio_sock_sendto},
	{"recv",	nixio_sock_recv},
	{"recvfrom",nixio_sock_recvfrom},
	{NULL,			NULL}
};

void nixio_open_io(lua_State *L) {
	lua_pushvalue(L, -2);
	luaL_register(L, NULL, M);
	lua_pop(L, 1);
}
