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

#ifndef _HELPER_H__
#define _HELPER_H__

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

int char2ipv4(char *c, char *ip);
void ipv42char(char *b, char *ip);
void mac2char(char *b, char *mac);
void add_table_entry(lua_State *L, const char *k, const char *v);
void add_table_entry_int(lua_State *L, const char *k, int v);

#endif
