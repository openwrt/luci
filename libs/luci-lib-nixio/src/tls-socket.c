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

#include "nixio-tls.h"
#include <string.h>
#include <stdlib.h>

static int nixio__tls_sock_perror(lua_State *L, SSL *sock, int code) {
	lua_pushnil(L);
	lua_pushinteger(L, SSL_get_error(sock, code));
	return 2;
}

static int nixio__tls_sock_pstatus(lua_State *L, SSL *sock, int code) {
	if (code > 0) {
		lua_pushboolean(L, 1);
		return 1;
	} else {
		return nixio__tls_sock_perror(L, sock, code);
	}
}

static SSL* nixio__checktlssock(lua_State *L) {
	if (lua_istable(L, 1)) {
		lua_getfield(L, 1, "connection");
		lua_replace(L, 1);
	}
	nixio_tls_sock *sock = luaL_checkudata(L, 1, NIXIO_TLS_SOCK_META);
	luaL_argcheck(L, sock->socket, 1, "invalid context");
	return sock->socket;
}

#define nixio_tls__check_connected(L) ;

#define nixio_tls__set_connected(L, val) ;

static int nixio_tls_sock_recv(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	nixio_tls__check_connected(L);
	uint req = luaL_checkinteger(L, 2);

	luaL_argcheck(L, req >= 0, 2, "out of range");

	/* We limit the readsize to NIXIO_BUFFERSIZE */
	req = (req > NIXIO_BUFFERSIZE) ? NIXIO_BUFFERSIZE : req;

	char buffer[NIXIO_BUFFERSIZE];
	int readc = SSL_read(sock, buffer, req);

	if (readc < 0) {
		return nixio__tls_sock_pstatus(L, sock, readc);
	} else {
		lua_pushlstring(L, buffer, readc);
		return 1;
	}
}

static int nixio_tls_sock_send(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	nixio_tls__check_connected(L);
	size_t len;
	ssize_t sent;
	const char *data = luaL_checklstring(L, 2, &len);

	if (lua_gettop(L) > 2) {
		int offset = luaL_optint(L, 3, 0);
		if (offset) {
			if (offset < len) {
				data += offset;
				len -= offset;
			} else {
				len = 0;
			}
		}

		unsigned int wlen = luaL_optint(L, 4, len);
		if (wlen < len) {
			len = wlen;
		}
	}

	sent = SSL_write(sock, data, len);
	if (sent > 0) {
		lua_pushinteger(L, sent);
		return 1;
	} else {
		return nixio__tls_sock_pstatus(L, sock, sent);
	}
}

static int nixio_tls_sock_accept(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	const int stat = SSL_accept(sock);
	nixio_tls__set_connected(L, stat == 1);
	return nixio__tls_sock_pstatus(L, sock, stat);
}

static int nixio_tls_sock_connect(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	const int stat = SSL_connect(sock);
	nixio_tls__set_connected(L, stat == 1);
	return nixio__tls_sock_pstatus(L, sock, stat);
}

static int nixio_tls_sock_shutdown(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	nixio_tls__set_connected(L, 0);
	return nixio__tls_sock_pstatus(L, sock, SSL_shutdown(sock));
}

static int nixio_tls_sock__gc(lua_State *L) {
	nixio_tls_sock *sock = luaL_checkudata(L, 1, NIXIO_TLS_SOCK_META);
	if (sock->socket) {
		SSL_free(sock->socket);
		sock->socket = NULL;
	}
	return 0;
}

static int nixio_tls_sock__tostring(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	lua_pushfstring(L, "nixio TLS connection: %p", sock);
	return 1;
}


/* ctx function table */
static const luaL_Reg M[] = {
	{"recv", 		nixio_tls_sock_recv},
	{"send", 		nixio_tls_sock_send},
	{"read", 		nixio_tls_sock_recv},
	{"write", 		nixio_tls_sock_send},
	{"accept",	 	nixio_tls_sock_accept},
	{"connect", 	nixio_tls_sock_connect},
	{"shutdown", 	nixio_tls_sock_shutdown},
	{"__gc",		nixio_tls_sock__gc},
	{"__tostring",	nixio_tls_sock__tostring},
	{NULL,			NULL}
};


void nixio_open_tls_socket(lua_State *L) {
	/* create socket metatable */
	luaL_newmetatable(L, NIXIO_TLS_SOCK_META);
	luaL_register(L, NULL, M);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setfield(L, -2, "meta_tls_socket");
}
