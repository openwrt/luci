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

		lmo_close(ar);
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
	lua_pushinteger(L, (lua_Integer)hash);
	return 1;
}

static lmo_luaentry_t *_lmo_push_entry(lua_State *L) {
	lmo_luaentry_t *le;

	if( (le = lua_newuserdata(L, sizeof(lmo_luaentry_t))) != NULL )
	{
		luaL_getmetatable(L, LMO_ENTRY_META);
		lua_setmetatable(L, -2);

		return le;
	}

	return NULL;
}

static int _lmo_lookup(lua_State *L, lmo_archive_t *ar, uint32_t hash) {
	lmo_entry_t *e = ar->index;
	lmo_luaentry_t *le = NULL;

	while( e != NULL )
	{
		if( e->key_id == hash )
		{
			if( (le = _lmo_push_entry(L)) != NULL )
			{
				le->archive = ar;
				le->entry   = e;
				return 1;
			}
			else
			{
				lua_pushnil(L);
				lua_pushstring(L, "out of memory");
				return 2;
			}
		}

		e = e->next;
	}

	lua_pushnil(L);
	return 1;
}

static int lmo_L_get(lua_State *L) {
	lmo_archive_t **ar = luaL_checkudata(L, 1, LMO_ARCHIVE_META);
	uint32_t hash = (uint32_t) luaL_checkinteger(L, 2);
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


static int _lmo_convert_entry(lua_State *L, int idx) {
	lmo_luaentry_t *le = luaL_checkudata(L, idx, LMO_ENTRY_META);

	lua_pushlstring(L,
		&le->archive->mmap[le->entry->offset],
		le->entry->length
	);

	return 1;
}

static int lmo_L_entry__tostring(lua_State *L) {
	return _lmo_convert_entry(L, 1);
}

static int lmo_L_entry__concat(lua_State *L) {
	if( lua_isuserdata(L, 1) )
		_lmo_convert_entry(L, 1);
	else
		lua_pushstring(L, lua_tostring(L, 1));

	if( lua_isuserdata(L, 2) )
		_lmo_convert_entry(L, 2);
	else
		lua_pushstring(L, lua_tostring(L, 2));

	lua_concat(L, 2);

	return 1;
}

static int lmo_L_entry__len(lua_State *L) {
	lmo_luaentry_t *le = luaL_checkudata(L, 1, LMO_ENTRY_META);
	lua_pushinteger(L, le->entry->length);
	return 1;
}

static int lmo_L_entry__gc(lua_State *L) {
	lmo_luaentry_t *le = luaL_checkudata(L, 1, LMO_ENTRY_META);
	le->archive = NULL;
	le->entry   = NULL;
	return 0;
}


/* lmo method table */
static const luaL_reg M[] = {
	{"close",		lmo_L__gc},
	{"get",			lmo_L_get},
	{"lookup",		lmo_L_lookup},
	{"foreach",		lmo_L_foreach},
	{"__tostring",	lmo_L__tostring},
	{"__gc",		lmo_L__gc},
	{NULL,			NULL}
};

/* lmo.entry method table */
static const luaL_reg E[] = {
	{"__tostring",	lmo_L_entry__tostring},
	{"__concat",	lmo_L_entry__concat},
	{"__len",		lmo_L_entry__len},
	{"__gc",		lmo_L_entry__gc},
	{NULL,			NULL}
};

/* module table */
static const luaL_reg R[] = {
	{"open",	lmo_L_open},
	{"hash",	lmo_L_hash},
	{NULL,		NULL}
};

LUALIB_API int luaopen_lmo(lua_State *L) {
	luaL_newmetatable(L, LMO_ARCHIVE_META);
	luaL_register(L, NULL, M);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, LMO_ARCHIVE_META);

	luaL_newmetatable(L, LMO_ENTRY_META);
	luaL_register(L, NULL, E);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, LMO_ENTRY_META);	

	luaL_register(L, LMO_LUALIB_META, R);

	return 1;
}
