#include "uhttpd.h"
#include "uhttpd-lua.h"
#include "uhttpd-utils.h"


static int uh_lua_recv(lua_State *L)
{
	size_t length;
	char buffer[UH_LIMIT_MSGHEAD];
	ssize_t rlen = 0;
	fd_set reader;
	struct timeval timeout;
	struct client *cl;

	luaL_checktype(L, 1, LUA_TLIGHTUSERDATA);
	cl = (struct client *) lua_topointer(L, 1);
	length = luaL_checknumber(L, 2);

	if( (cl != NULL) && (length > 0) && (length <= sizeof(buffer)) )
	{
		FD_ZERO(&reader);
		FD_SET(cl->socket, &reader);

		/* fail after 0.1s */
		timeout.tv_sec  = 0;
		timeout.tv_usec = 100000;

		/* first return stuff from peek buffer */
		if( cl->peeklen > 0 )
		{
			/* receive data */
			rlen = uh_tcp_recv(cl, buffer, min(cl->peeklen, length));
			lua_pushnumber(L, rlen);
			lua_pushlstring(L, buffer, rlen);

			return 2;
		}

		/* check whether fd is readable */
		else if( select(cl->socket + 1, &reader, NULL, NULL, &timeout) > 0 )
		{
			/* receive data */
			rlen = uh_tcp_recv(cl, buffer, length);
			lua_pushnumber(L, rlen);

			if( rlen > 0 )
			{
				lua_pushlstring(L, buffer, rlen);
				return 2;
			}

			return 1;
		}

		/* no, timeout and actually no data */
		lua_pushnumber(L, -2);
		return 1;
	}

	/* parameter error */
	lua_pushnumber(L, -3);
	return 1;
}

static int uh_lua_send(lua_State *L)
{
	size_t length;
	const char *buffer;
	ssize_t slen = 0;
	struct client *cl;

	luaL_checktype(L, 1, LUA_TLIGHTUSERDATA);
	cl = (struct client *) lua_topointer(L, 1);
	buffer = luaL_checklstring(L, 2, &length);

	if( (cl != NULL) && (length > 0) )
	{
		slen = uh_tcp_send(cl, buffer, length);
		lua_pushnumber(L, slen);
		return 1;
	}

	lua_pushnumber(L, -1);
	return 1;
}

static int uh_lua_urldecode(lua_State *L)
{
	size_t inlen, outlen;
	const char *inbuf;
	char outbuf[UH_LIMIT_MSGHEAD];

	inbuf = luaL_checklstring(L, 1, &inlen);
	outlen = uh_urldecode(outbuf, sizeof(outbuf), inbuf, inlen);

	lua_pushlstring(L, outbuf, outlen);
	return 1;
}


lua_State * uh_lua_init(const char *handler)
{
	lua_State *L = lua_open();
	const luaL_reg *lib;
	const char *err_str = NULL;

	/* Declare the Lua libraries we wish to use. */
	/* Note: If you are opening and running a file containing Lua code */
	/* using 'lua_dofile(l, "myfile.lua") - you must delcare all the libraries */
	/* used in that file here also. */
	static const luaL_reg lualibs[] =
	{
        	{ "base",       luaopen_base },
			{ "string",		luaopen_string },
        	{ NULL,         NULL }
	};

	/* preload libraries */
	for (lib = lualibs; lib->func != NULL; lib++)
	{
        	lib->func(L);
        	lua_settop(L, 0);
	}

	/* register global send and receive functions */
	lua_pushcfunction(L, uh_lua_recv);
	lua_setfield(L, LUA_GLOBALSINDEX, "recv");

	lua_pushcfunction(L, uh_lua_send);
	lua_setfield(L, LUA_GLOBALSINDEX, "send");

	lua_pushcfunction(L, uh_lua_urldecode);
	lua_setfield(L, LUA_GLOBALSINDEX, "urldecode");


	/* load Lua handler */
	switch( luaL_loadfile(L, handler) )
	{
		case LUA_ERRSYNTAX:
			fprintf(stderr,
				"Lua handler contains syntax errors, unable to continue\n");
			exit(1);

		case LUA_ERRMEM:
			fprintf(stderr,
				"Lua handler ran out of memory, unable to continue\n");
			exit(1);

		case LUA_ERRFILE:
			fprintf(stderr,
				"Lua cannot open the handler script, unable to continue\n");
			exit(1);

		default:
			/* compile Lua handler */
			switch( lua_pcall(L, 0, 0, 0) )
			{
				case LUA_ERRRUN:
					err_str = luaL_checkstring(L, -1);
					fprintf(stderr,
						"Lua handler had runtime error, unable to continue\n"
						"Error: %s\n", err_str
					);
					exit(1);

				case LUA_ERRMEM:
					err_str = luaL_checkstring(L, -1);
					fprintf(stderr,
						"Lua handler ran out of memory, unable to continue\n"
						"Error: %s\n", err_str
					);
					exit(1);

				default:
					/* test handler function */
					lua_getglobal(L, UH_LUA_CALLBACK);

					if( ! lua_isfunction(L, -1) )
					{
						fprintf(stderr,
							"Lua handler provides no " UH_LUA_CALLBACK "(), unable to continue\n");
						exit(1);
					}

					lua_pop(L, 1);
					break;
			}

			break;
	}

	return L;
}

void uh_lua_request(struct client *cl, struct http_request *req, lua_State *L)
{
	int i;
	char *query_string;
	const char *err_str = NULL;

	/* put handler callback on stack */
	lua_getglobal(L, UH_LUA_CALLBACK);


	/* build env table */
	lua_newtable(L);

	/* client object */
	lua_pushlightuserdata(L, (void *)cl);
	lua_setfield(L, -2, "client");

	/* request method */
	switch(req->method)
	{
		case UH_HTTP_MSG_GET:
			lua_pushstring(L, "get");
			break;

		case UH_HTTP_MSG_HEAD:
			lua_pushstring(L, "head");
			break;

		case UH_HTTP_MSG_POST:
			lua_pushstring(L, "post");
			break;
	}

	lua_setfield(L, -2, "request_method");

	/* request url */
	lua_pushstring(L, req->url);
	lua_setfield(L, -2, "request_url");

	/* query string, path info */
	if( (query_string = strchr(req->url, '?')) != NULL )
	{
		lua_pushstring(L, query_string + 1);
		lua_setfield(L, -2, "query_string");

		lua_pushlstring(L, req->url, (int)(query_string - req->url));
		lua_setfield(L, -2, "path_info");
	}
	else
	{
		lua_pushstring(L, req->url);
		lua_setfield(L, -2, "path_info");
	}

	/* http protcol version */
	lua_pushnumber(L, floor(req->version * 10) / 10);
	lua_setfield(L, -2, "http_version");


	/* address information */
	lua_pushstring(L, sa_straddr(&cl->peeraddr));
	lua_setfield(L, -2, "remote_addr");

	lua_pushinteger(L, sa_port(&cl->peeraddr));
	lua_setfield(L, -2, "remote_port");

	lua_pushstring(L, sa_straddr(&cl->servaddr));
	lua_setfield(L, -2, "server_addr");

	lua_pushinteger(L, sa_port(&cl->servaddr));
	lua_setfield(L, -2, "server_port");


	/* headers */
	lua_newtable(L);

	foreach_header(i, req->headers)
	{
		lua_pushstring(L, req->headers[i+1]);
		lua_setfield(L, -2, req->headers[i]);
	}

	lua_setfield(L, -2, "headers");


	/* call */
	switch( lua_pcall(L, 1, 0, 0) )
	{
		case LUA_ERRRUN:
			err_str = luaL_checkstring(L, -1);
			uh_http_sendhf(cl, 500, "Lua runtime error",
				"Lua raised an error:\n%s\n", err_str);
			break;

		case LUA_ERRMEM:
			err_str = luaL_checkstring(L, -1);
			uh_http_sendhf(cl, 500, "Lua out of memory",
				"Lua raised an error:\n%s\n", err_str);
			break;

		default:
			break;
	}
}

