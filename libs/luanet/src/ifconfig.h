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

#ifndef _IFCONFIG_H__
#define _IFCONFIG_H__
int ifc_startup(void);
void ifc_shutdown(void);

int ifc_getall(lua_State *L);
int ifc_setip(lua_State *L);
int ifc_setnetmask(lua_State *L);
int ifc_setbroadcast(lua_State *L);
int ifc_setmtu(lua_State *L);
int ifc_up(lua_State *L);
int ifc_down(lua_State *L);
#endif
