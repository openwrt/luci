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

static SSL_CTX* nixio__checktlsctx(lua_State *L) {
	SSL_CTX **ctx = (SSL_CTX **)luaL_checkudata(L, 1, NIXIO_TLS_CTX_META);
	luaL_argcheck(L, *ctx, 1, "invalid context");
	return *ctx;
}

static int nixio__tls_perror(lua_State *L, int code) {
	lua_pushnil(L);
	lua_pushinteger(L, code);
	return 2;
}

static int nixio__tls_pstatus(lua_State *L, int code) {
	if (code == 1) {
		lua_pushboolean(L, 1);
		return 1;
	} else {
		return nixio__tls_perror(L, code);
	}
}

static int nixio_tls_ctx(lua_State * L) {
	const char *method = luaL_optlstring(L, 1, "tlsv1", NULL);

	luaL_getmetatable(L, NIXIO_TLS_CTX_META);
	SSL_CTX **ctx = lua_newuserdata(L, sizeof(SSL_CTX *));
	if (!ctx) {
		return luaL_error(L, "out of memory");
	}

	/* create userdata */
	lua_pushvalue(L, -2);
	lua_setmetatable(L, -2);
	lua_getfield(L, -1, "tls_defaultkey");

	if (!strcmp(method, "tlsv1")) {
		*ctx = SSL_CTX_new(TLSv1_method());
	} else if (!strcmp(method, "sslv23")) {
		*ctx = SSL_CTX_new(SSLv23_method());
	} else {
		return luaL_argerror(L, 1, "supported values: tlsv1, sslv23");
	}

	if (!(*ctx)) {
		return luaL_error(L, "unable to create TLS context");
	}

	const char *autoload = lua_tostring(L, -1);
	if (autoload) {
		SSL_CTX_use_PrivateKey_file(*ctx, autoload, SSL_FILETYPE_PEM);
	}
	lua_pop(L, 1);

	SSL_CTX_set_options(*ctx, SSL_OP_NO_SSLv2 | SSL_OP_NO_SSLv3);

	return 1;
}

static int nixio_tls_ctx_create(lua_State *L) {
	SSL_CTX *ctx = nixio__checktlsctx(L);
	int fd = nixio__checkfd(L, 2);

	lua_createtable(L, 0, 3);
	nixio_tls_sock *sock = lua_newuserdata(L, sizeof(nixio_tls_sock));
	if (!sock) {
		return luaL_error(L, "out of memory");
	}
	memset(sock, 0, sizeof(nixio_tls_sock));

	/* create userdata */
	luaL_getmetatable(L, NIXIO_TLS_SOCK_META);
	lua_pushvalue(L, -1);
	lua_setmetatable(L, -3);

	sock->socket = SSL_new(ctx);
	if (!sock->socket) {
		return nixio__tls_perror(L, 0);
	}

	if (SSL_set_fd(sock->socket, fd) != 1) {
		return nixio__tls_perror(L, 0);
	}

	/* save context and socket to prevent GC from collecting them */
	lua_setmetatable(L, -3);
	lua_setfield(L, -2, "connection");

	lua_pushvalue(L, 1);
	lua_setfield(L, -2, "context");

	lua_pushvalue(L, 2);
	lua_setfield(L, -2, "socket");

	return 1;
}

static int nixio_tls_ctx_set_cert(lua_State *L) {
	SSL_CTX *ctx = nixio__checktlsctx(L);
	const char *cert = luaL_checkstring(L, 2);
	return nixio__tls_pstatus(L, SSL_CTX_use_certificate_chain_file(ctx, cert));
}

static int nixio_tls_ctx_set_key(lua_State *L) {
	SSL_CTX *ctx = nixio__checktlsctx(L);
	const char *cert = luaL_checkstring(L, 2);
	const int ktype = SSL_FILETYPE_PEM;
	return nixio__tls_pstatus(L, SSL_CTX_use_PrivateKey_file(ctx, cert, ktype));
}

static int nixio_tls_ctx_set_ciphers(lua_State *L) {
	SSL_CTX *ctx = nixio__checktlsctx(L);
	size_t len;
	const char *ciphers = luaL_checklstring(L, 2, &len);
	luaL_argcheck(L, len < 255, 2, "cipher string too long");
	return nixio__tls_pstatus(L, SSL_CTX_set_cipher_list(ctx, ciphers));
}

static int nixio_tls_ctx_set_verify_depth(lua_State *L) {
	SSL_CTX *ctx = nixio__checktlsctx(L);
	const int depth = luaL_checkinteger(L, 2);
	SSL_CTX_set_verify_depth(ctx, depth);
	return 0;
}

static int nixio_tls_ctx_set_verify(lua_State *L) {
	SSL_CTX *ctx = nixio__checktlsctx(L);
	const int j = lua_gettop(L);
	int flags = 0;
	for (int i=2; i<=j; i++) {
		const char *flag = luaL_checkstring(L, i);
		if (!strcmp(flag, "none")) {
			flags |= SSL_VERIFY_NONE;
		} else if (!strcmp(flag, "peer")) {
			flags |= SSL_VERIFY_PEER;
		} else if (!strcmp(flag, "verify_fail_if_no_peer_cert")) {
			flags |= SSL_VERIFY_FAIL_IF_NO_PEER_CERT;
		} else if (!strcmp(flag, "client_once")) {
			flags |= SSL_VERIFY_CLIENT_ONCE;
		} else {
			return luaL_argerror(L, i, "supported values: none, peer, "
			 "verify_fail_if_no_peer_cert, client_once");
		}
	}
	SSL_CTX_set_verify(ctx, flags, NULL);
	return 0;
}

static int nixio_tls_ctx__gc(lua_State *L) {
	SSL_CTX **ctx = (SSL_CTX **)luaL_checkudata(L, 1, NIXIO_TLS_CTX_META);
	if (*ctx) {
		SSL_CTX_free(*ctx);
		*ctx = NULL;
	}
	return 0;
}

static int nixio_tls_ctx__tostring(lua_State *L) {
	SSL_CTX *ctx = nixio__checktlsctx(L);
	lua_pushfstring(L, "nixio TLS context: %p", ctx);
	return 1;
}

/* module table */
static const luaL_reg R[] = {
	{"tls",		nixio_tls_ctx},
	{NULL,			NULL}
};

/* ctx function table */
static const luaL_reg CTX_M[] = {
	{"set_cert",			nixio_tls_ctx_set_cert},
	{"set_key",				nixio_tls_ctx_set_key},
	{"set_ciphers",			nixio_tls_ctx_set_ciphers},
	{"set_verify_depth",	nixio_tls_ctx_set_verify_depth},
	{"set_verify",			nixio_tls_ctx_set_verify},
	{"create",				nixio_tls_ctx_create},
	{"__gc",				nixio_tls_ctx__gc},
	{"__tostring",			nixio_tls_ctx__tostring},
	{NULL,					NULL}
};


void nixio_open_tls_context(lua_State *L) {
	/* initialize tls library */
    SSL_load_error_strings();
    SSL_library_init();

    /* register module functions */
    luaL_register(L, NULL, R);

#ifndef WITH_AXTLS
    lua_pushliteral(L, "openssl");
#else
    lua_pushliteral(L, "axtls");
#endif
    lua_setfield(L, -2, "tls_provider");

	/* create context metatable */
	luaL_newmetatable(L, NIXIO_TLS_CTX_META);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	luaL_register(L, NULL, CTX_M);
#ifdef WITH_AXTLS
    lua_pushliteral(L, "/etc/axtls.key");
    lua_setfield(L, -2, "tls_defaultkey");
#endif
	lua_setfield(L, -2, "meta_tls_context");
}
