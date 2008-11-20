/**
 * LuCI Core - Utility library
 * Copyright (C) 2008 Steven Barth <steven@midlink.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * 	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "lauxlib.h"

#define LUCI_MODNAME "luci.cutil"
#define LUCI_MODDESC "LuCI Core Utility Library"
#define LUCI_MODCOPY "2008 Steven Barth"


/* Pythonic overloaded MOD operator */
static int luci__string_mod(lua_State *L) {
	int i, n=1;

	luaL_checkstring(L, 1);
	luaL_checkany(L, 2);

	/* Discard further arguments */
	lua_settop(L, 2);

	/* Get format and push it to the bottom of the stack */
	lua_pushliteral(L, "");
	lua_getfield(L, -1, "format");
	lua_insert(L, 1);
	lua_pop(L, 1);

	/* If second argument is a table, unpack it */
	if (lua_istable(L, 3)) {
		n = luaL_getn(L, 3);
		if (n > 0) {
			luaL_checkstack(L, n, "too many results to unpack");
			for (i=1; i<=n; i++) {
				lua_rawgeti(L, 3, i);
			}
		} else {
			n = 0;
		}
		lua_remove(L, 3);
	}

	lua_call(L, n+1, 1);
	return 1;
}

/* Instantiate a class */
static int luci__instantiate(lua_State *L) {
	luaL_checktype(L, 1, LUA_TTABLE);

	/* Create the object */
	lua_newtable(L);

	/* Create the metatable */
	lua_createtable(L, 0, 1);
	lua_pushvalue(L, 1);
	lua_setfield(L, -2, "__index");
	lua_setmetatable(L, -2);

	/* Move instance at the bottom of the stack */
	lua_replace(L, 1);

	/* Invoke constructor if it exists */
	lua_getfield(L, 1, "__init__");
	if (lua_isfunction(L, -1)) {
		/* Put instance at the bottom for the 2nd time */
		lua_pushvalue(L, 1);
		lua_insert(L, 1);

		/* Call constructor */
		lua_insert(L, 2);
		lua_call(L, lua_gettop(L)-2, 0);
	}

	lua_settop(L, 1);
	return 1;
}


/* luci.cutil.class(baseclass) */
static int luci_class(lua_State *L) {
	int n = lua_gettop(L);

	/* Create class */
	lua_newtable(L);

	/* Create metatable and register parent class if any */
	if (n && lua_istable(L, 1)) {
		lua_createtable(L, 0, 2);
		lua_pushvalue(L, 1);
		lua_setfield(L, -2, "__index");
	} else {
		lua_createtable(L, 0, 1);
	}

	/* Set instantiator */
	lua_pushcfunction(L, luci__instantiate);
	lua_setfield(L, -2, "__call");

	lua_setmetatable(L, -2);
	return 1;
}


/* Registry */
static const luaL_Reg registry[] = {
		{"class",		luci_class},
		{ NULL,			NULL },
};

/* Registrator */
LUALIB_API int luaopen_luci_cutil(lua_State *L) {
	luaL_register(L, LUCI_MODNAME, registry);

	lua_pushliteral(L, LUCI_MODDESC);
	lua_setfield(L, -2, "_DESCRIPTION");

	lua_pushliteral(L, LUCI_MODCOPY);
	lua_setfield(L, -2, "_COPYRIGHT");


	/* Register pythonic printf string operator */
	lua_pushliteral(L, "");
	lua_getmetatable(L, -1);
	lua_pushcfunction(L, luci__string_mod);
	lua_setfield(L, -2, "__mod");
	lua_pop(L, 2);

	return 1;
}
