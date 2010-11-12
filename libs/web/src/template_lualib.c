/*
 * LuCI Template - Lua binding
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

#include "template_lualib.h"

int template_L_parse(lua_State *L)
{
	const char *file = luaL_checkstring(L, 1);
	struct template_parser parser;
	int lua_status;

	if( (parser.fd = open(file, O_RDONLY)) > 0 )
	{
		parser.flags   = 0;
		parser.bufsize = 0;
		parser.state   = T_STATE_TEXT_NEXT;

		lua_status = lua_load(L, template_reader, &parser, file);

		(void) close(parser.fd);


		if( lua_status == 0 )
		{
			return 1;
		}
		else
		{
			lua_pushnil(L);
			lua_pushinteger(L, lua_status);
			lua_pushlstring(L, parser.out, parser.outsize);
			return 3;
		}
	}

	lua_pushnil(L);
	lua_pushinteger(L, 255);
	lua_pushstring(L, "No such file or directory");
	return 3;
}

int template_L_sanitize_utf8(lua_State *L)
{
	size_t len = 0;
	const char *str = luaL_checklstring(L, 1, &len);
	char *res = sanitize_utf8(str, len);

	if (res != NULL)
	{
		lua_pushstring(L, res);
		free(res);

		return 1;
	}

	return 0;
}

int template_L_sanitize_pcdata(lua_State *L)
{
	size_t len = 0;
	const char *str = luaL_checklstring(L, 1, &len);
	char *res = sanitize_pcdata(str, len);

	if (res != NULL)
	{
		lua_pushstring(L, res);
		free(res);

		return 1;
	}

	return 0;
}


/* module table */
static const luaL_reg R[] = {
	{ "parse",				template_L_parse },
	{ "sanitize_utf8",		template_L_sanitize_utf8 },
	{ "sanitize_pcdata",	template_L_sanitize_pcdata },
	{ NULL,					NULL }
};

LUALIB_API int luaopen_luci_template_parser(lua_State *L) {
	luaL_register(L, TEMPLATE_LUALIB_META, R);
	return 1;
}
