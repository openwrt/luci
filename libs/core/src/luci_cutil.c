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
	lua_getfield(L, 1, "format");
	lua_insert(L, 1);

	/* If second argument is a table, unpack it */
	if (lua_istable(L, 3)) {
		n = lua_objlen(L, 3);
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
	/* Create class */
	lua_newtable(L);

	/* Create metatable and register parent class if any */
	if (lua_gettop(L) > 1 && lua_istable(L, 1)) {
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

/* luci.cutil.instanceof(object, class) */
static int luci_instanceof(lua_State *L) {
	int stat = 0;

	luaL_checkany(L, 1);
	luaL_checkany(L, 2);

	if (lua_getmetatable(L, 1)) {
		/* get parent class */
		lua_getfield(L, -1, "__index");
		while (lua_istable(L, -1)) {
			/* parent class == class */
			if (lua_equal(L, -1, 2)) {
				stat = 1;
				break;
			}

			/* remove last metatable */
			lua_remove(L, -2);

			/* get metatable of parent class */
			if (lua_getmetatable(L, -1)) {
				/* remove last parent class */
				lua_remove(L, -2);

				/* get next parent class */
				lua_getfield(L, -1, "__index");
			} else {
				break;
			}
		}
	}

	lua_pushboolean(L, stat);
	return 1;
}


/* luci.cutil.pcdata(obj) */
static int luci_pcdata(lua_State *L) {
	if (lua_isnone(L, 1)) {
		lua_pushnil(L);
		return 1;
	}

	/* Discard anything else */
	lua_settop(L, 1);

	/* tostring(obj) */
	lua_pushvalue(L, lua_upvalueindex(1));
	lua_insert(L, 1);
	lua_call(L, 1, 1);

	/* pattern */
	lua_pushvalue(L, lua_upvalueindex(2));

	/* repl */
	lua_pushvalue(L, lua_upvalueindex(3));

	/* get gsub function */
	lua_getfield(L, -3, "gsub");
	lua_insert(L, 1);

	/* tostring(obj):gsub(pattern, repl) */
	lua_call(L, 3, 1);
	return 1;
}


/* Registration helper for luci.cutil.pcdata */
static void luci__register_pcdata(lua_State *L) {
	/* tostring */
	lua_getfield(L, LUA_GLOBALSINDEX, "tostring");

	/* pattern */
	lua_pushliteral(L, "[&\"'<>]");

	/* repl */
	lua_createtable(L, 0, 5);

	lua_pushliteral(L, "&#38;");
	lua_setfield(L, -2, "&");
	lua_pushliteral(L, "&#34;");
	lua_setfield(L, -2, "\"");
	lua_pushliteral(L, "&#39;");
	lua_setfield(L, -2, "'");
	lua_pushliteral(L, "&#60;");
	lua_setfield(L, -2, "<");
	lua_pushliteral(L, "&#62;");
	lua_setfield(L, -2, ">");

	/* register function */
	lua_pushcclosure(L, luci_pcdata, 3);
	lua_setfield(L, -2, "pcdata");
}

/* Registry */
static const luaL_Reg registry[] = {
		{"class",		luci_class},
		{"instanceof",	luci_instanceof},
		{ NULL,			NULL },
};

/* Registrator */
LUALIB_API int luaopen_luci_cutil(lua_State *L) {
	luaL_register(L, LUCI_MODNAME, registry);

	lua_pushliteral(L, LUCI_MODDESC);
	lua_setfield(L, -2, "_DESCRIPTION");

	lua_pushliteral(L, LUCI_MODCOPY);
	lua_setfield(L, -2, "_COPYRIGHT");

	/* Additional registrations */
	luci__register_pcdata(L);


	/* Register pythonic printf string operator */
	lua_pushliteral(L, "");
	lua_getmetatable(L, -1);
	lua_pushcfunction(L, luci__string_mod);
	lua_setfield(L, -2, "__mod");
	lua_pop(L, 2);

	return 1;
}
