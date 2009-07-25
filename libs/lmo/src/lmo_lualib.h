/*
 * lmo - Lua Machine Objects - Lua library header
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

#ifndef _LMO_LUALIB_H_
#define _LMO_LUALIB_H_

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

#include "lmo.h"

#define LMO_LUALIB_META  "lmo"
#define LMO_ARCHIVE_META "lmo.archive"
#define LMO_ENTRY_META   "lmo.entry"

struct lmo_luaentry {
	lmo_archive_t *archive;  
	lmo_entry_t   *entry;
};

typedef struct lmo_luaentry lmo_luaentry_t;


LUALIB_API int luaopen_lmo(lua_State *L);

#endif
