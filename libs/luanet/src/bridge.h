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

#ifndef _BRIDGE_H__
#define _BRIDGE_H__
int bridge_startup(void);
void bridge_shutdown(void);
int bridge_new(lua_State *L);
int bridge_del(lua_State *L);
int bridge_addif(lua_State *L);
int bridge_delif(lua_State *L);
int bridge_getall(lua_State *L);
#endif
