#ifndef _UHTTPD_LUA_

#include <math.h>  /* floor() */

#include <lua.h>
#include <lauxlib.h>
#include <lualib.h>

#define UH_LUA_CALLBACK		"handle_request"

#define UH_LUA_ERR_TIMEOUT -1
#define UH_LUA_ERR_TOOBIG  -2
#define UH_LUA_ERR_PARAM   -3


lua_State * uh_lua_init();

void uh_lua_request(struct client *cl, struct http_request *req, lua_State *L);

#endif
