/*
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
 *
 *   Copyright (C) 2008 John Crispin <blogic@openwrt.org> 
 *   Copyright (C) 2008 Steven Barth <steven@midlink.org>
 */

#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

int char2ipv4(char *c, char *ip)
{
	int i;
	char *tmp = strdup(c);
	char *t = tmp;
	char *e = NULL;
	int ret = -1;
	for(i = 0; i < 4; i++)
	{
		int j = strtol(t, &e, 10);
		if((j < 0) || (j > 255))
			goto error;
		if(i != 3)
			if(*e != '.')
				goto error;
		*ip++ = j;
		t = e + 1;
	}
	ret = 0;
error:
	free(tmp);
	return ret;
}

void ipv42char(char *b, char *ip)
{
	sprintf(ip, "%d.%d.%d.%d", b[0] & 0xff, b[1] & 0xff, b[2] & 0xff, b[3] & 0xff);
}

void mac2char(char *b, char *mac)
{
	sprintf(mac, "%02X:%02X:%02X:%02X:%02X:%02X",
		b[0] & 0xff, b[1] & 0xff, b[2] & 0xff, b[3] & 0xff, b[4] & 0xff, b[5] & 0xff);
}

void add_table_entry(lua_State *L, const char *k, const char *v)
{
	lua_pushstring(L, k);
	lua_pushstring(L, v);
	lua_settable(L, -3);
}

void add_table_entry_int(lua_State *L, const char *k, int v)
{
	lua_pushstring(L, k);
	lua_pushinteger(L, v);
	lua_settable(L, -3);
}
