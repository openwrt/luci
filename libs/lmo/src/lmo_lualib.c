/*
 * lmo - Lua Machine Objects - Lua binding
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
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

#include "lmo_lualib.h"

extern char _lmo_error[1024];


static int lmo_L_open(lua_State *L) {
	const char *filename = luaL_checklstring(L, 1, NULL);
	lmo_archive_t *ar, **udata;

	if( (ar = lmo_open(filename)) != NULL )
	{
		if( (udata = lua_newuserdata(L, sizeof(lmo_archive_t *))) != NULL )
		{
			*udata = ar;
			luaL_getmetatable(L, LMO_ARCHIVE_META);
			lua_setmetatable(L, -2);
			return 1;
		}

		lua_pushnil(L);
		lua_pushstring(L, "out of memory");
		return 2;
	}

	lua_pushnil(L);
	lua_pushstring(L, lmo_error());
	return 2;
}

static int lmo_L_hash(lua_State *L) {
	const char *data = luaL_checkstring(L, 1);
	uint32_t hash = sfh_hash(data, strlen(data));
	lua_pushnumber(L, hash);
	return 1;
}

static int _lmo_lookup(lua_State *L, lmo_archive_t *ar, uint32_t hash) {
	lmo_entry_t *e = ar->index;

	while( e != NULL )
	{
		if( e->key_id == hash )
		{
			lua_pushlstring(L, &ar->mmap[e->offset], e->length);
			return 1;
		}

		e = e->next;
	}

	lua_pushnil(L);
	return 1;
}

static int lmo_L_get(lua_State *L) {
	lmo_archive_t **ar = luaL_checkudata(L, 1, LMO_ARCHIVE_META);
	uint32_t hash = (uint32_t) luaL_checknumber(L, 2);
	return _lmo_lookup(L, *ar, hash);
}

static int lmo_L_lookup(lua_State *L) {
	lmo_archive_t **ar = luaL_checkudata(L, 1, LMO_ARCHIVE_META);
	const char *key = luaL_checkstring(L, 2);
	uint32_t hash = sfh_hash(key, strlen(key));
	return _lmo_lookup(L, *ar, hash);
}

static int lmo_L_foreach(lua_State *L) {
	lmo_archive_t **ar = luaL_checkudata(L, 1, LMO_ARCHIVE_META);
	lmo_entry_t *e = (*ar)->index;

	if( lua_isfunction(L, 2) )
	{
		while( e != NULL )
		{
			lua_pushvalue(L, 2);
			lua_pushinteger(L, e->key_id);
			lua_pushlstring(L, &(*ar)->mmap[e->offset], e->length);
			lua_pcall(L, 2, 0, 0);
			e = e->next;
		}
	}

	return 0;
}

static int lmo_L__gc(lua_State *L) {
	lmo_archive_t **ar = luaL_checkudata(L, 1, LMO_ARCHIVE_META);

	if( (*ar) != NULL )
		lmo_close(*ar);

	*ar = NULL;

	return 0;
}

static int lmo_L__tostring(lua_State *L) {
	lmo_archive_t **ar = luaL_checkudata(L, 1, LMO_ARCHIVE_META);
	lua_pushfstring(L, "LMO Archive (%d bytes)", (*ar)->length);
	return 1;
}


/* method table */
static const luaL_reg M[] = {
	{"close",	lmo_L__gc},
	{"get",		lmo_L_get},
	{"lookup",	lmo_L_lookup},
	{"foreach",	lmo_L_foreach},
	{"__tostring",	lmo_L__tostring},
	{"__gc",	lmo_L__gc},
	{NULL,		NULL}
};

/* module table */
static const luaL_reg R[] = {
	{"open",	lmo_L_open},
	{"hash",	lmo_L_hash},
	{NULL,		NULL}
};

LUALIB_API int luaopen_lmo(lua_State *L) {
	luaL_newmetatable(L, LMO_LUALIB_META);
	luaL_register(L, NULL, R);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, LMO_LUALIB_META);

	luaL_newmetatable(L, LMO_ARCHIVE_META);
	luaL_register(L, NULL, M);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, LMO_ARCHIVE_META);

	return 1;
}
