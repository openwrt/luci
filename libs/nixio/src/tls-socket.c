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
#include "string.h"

#ifndef WITHOUT_OPENSSL
#include <openssl/ssl.h>
#endif

static int nixio__tls_sock_perror(lua_State *L, SSL *sock, int code) {
	lua_pushnil(L);
	lua_pushinteger(L, code);
	lua_pushinteger(L, SSL_get_error(sock, code));
	return 3;
}

static int nixio__tls_sock_pstatus(lua_State *L, SSL *sock, int code) {
	if (code == 1) {
		lua_pushboolean(L, 1);
		return 1;
	} else {
		return nixio__tls_sock_perror(L, sock, code);
	}
}

static SSL* nixio__checktlssock(lua_State *L) {
	SSL **sock = (SSL **)luaL_checkudata(L, 1, NIXIO_TLS_SOCK_META);
	luaL_argcheck(L, *sock, 1, "invalid context");
	return *sock;
}

static int nixio_tls_sock_recv(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	int req = luaL_checkinteger(L, 2);

	luaL_argcheck(L, req >= 0, 2, "out of range");

	/* We limit the readsize to NIXIO_BUFFERSIZE */
	req = (req > NIXIO_BUFFERSIZE) ? NIXIO_BUFFERSIZE : req;
#ifndef WITH_AXTLS
	char buffer[NIXIO_BUFFERSIZE];
	int readc = SSL_read(sock, buffer, req);

	if (readc < 0) {
		return nixio__tls_sock_pstatus(L, sock, readc);
	} else {
		lua_pushlstring(L, buffer, readc);
		return 1;
	}
#else
	if (!req) {
		lua_pushliteral(L, "");
		return 1;
	}

	/* AXTLS doesn't handle buffering for us, so we have to hack around*/
	int buflen = 0;
	lua_getmetatable(L, 1);
	lua_getfield(L, -1, "_axbuffer");

	if (lua_isstring(L, -1)) {
		buflen = lua_objlen(L, -1);
	}

	if (req < buflen) {
		const char *axbuf = lua_tostring(L, -1);
		lua_pushlstring(L, axbuf, req);
		lua_pushlstring(L, axbuf + req, buflen - req);
		lua_setfield(L, -4, "_axbuffer");
		return 1;
	} else {
		if (!lua_isstring(L, -1)) {
			lua_pop(L, 1);
			lua_pushliteral(L, "");
		}

		char *axbuf;
		int axread;

		/* while handshake pending */
		while ((axread = ssl_read(sock, (uint8_t**)&axbuf)) == SSL_OK);

		if (axread < 0) {
			/* There is an error */

			if (axread != SSL_ERROR_CONN_LOST) {
				lua_pushliteral(L, "");
				lua_setfield(L, -3, "_axbuffer");
				return nixio__tls_sock_perror(L, sock, axread);
			} else {
				lua_pushliteral(L, "");
			}
		} else {
			int stillwant = req - buflen;
			if (stillwant < axread) {
				/* we got more data than we need */
				lua_pushlstring(L, axbuf, stillwant);
				lua_concat(L, 2);

				/* remaining data goes into the buffer */
				lua_pushlstring(L, axbuf + stillwant, axread - stillwant);
			} else {
				lua_pushlstring(L, axbuf, axread);
				lua_concat(L, 2);
				lua_pushliteral(L, "");
			}
		}
		lua_setfield(L, -3, "_axbuffer");
		return 1;
	}

#endif
}

static int nixio_tls_sock_send(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	size_t len;
	ssize_t sent;
	const char *data = luaL_checklstring(L, 2, &len);
	sent = SSL_write(sock, data, len);
	if (sent > 0) {
		lua_pushinteger(L, sent);
		return 1;
	} else {
		return nixio__tls_sock_pstatus(L, sock, len);
	}
}

static int nixio_tls_sock_accept(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	return nixio__tls_sock_pstatus(L, sock, SSL_accept(sock));
}

static int nixio_tls_sock_connect(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	return nixio__tls_sock_pstatus(L, sock, SSL_connect(sock));
}

static int nixio_tls_sock_shutdown(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	return nixio__tls_sock_pstatus(L, sock, SSL_shutdown(sock));
}

static int nixio_tls_sock__gc(lua_State *L) {
	SSL **sock = (SSL **)luaL_checkudata(L, 1, NIXIO_TLS_SOCK_META);
	if (*sock) {
		SSL_free(*sock);
		*sock = NULL;
	}
	return 0;
}

static int nixio_tls_sock__tostring(lua_State *L) {
	SSL *sock = nixio__checktlssock(L);
	lua_pushfstring(L, "nixio TLS socket: %p", sock);
	return 1;
}


/* ctx function table */
static const luaL_reg M[] = {
	{"recv", 		nixio_tls_sock_recv},
	{"send", 		nixio_tls_sock_send},
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
	lua_setfield(L, -2, "tls_socket_meta");
}
