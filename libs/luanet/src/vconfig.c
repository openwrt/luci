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

#include <net/if.h>
#include <net/if_arp.h>
#include <net/route.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <linux/sockios.h>
#include <linux/if_vlan.h>
#include <iwlib.h>
#include <dirent.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <stdlib.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

extern int sock_ifconfig;


static inline int _vlan_add(lua_State *L, int i)
{
	struct vlan_ioctl_args ifr;
	int a = (i == ADD_VLAN_CMD)?(2):(1);
	char *ifname;
	if(lua_gettop(L) != a)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
	ifname = (char *)lua_tostring (L, 1);
	ifr.cmd = i;
	if(i == ADD_VLAN_CMD)
		ifr.u.VID = (int)lua_tointeger (L, 2);
	strncpy(ifr.device1, ifname, IFNAMSIZ);
	if(!ioctl(sock_ifconfig, SIOCSIFVLAN, &ifr))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

int vlan_add(lua_State *L)
{
	return _vlan_add(L, ADD_VLAN_CMD);
}

int vlan_del(lua_State *L)
{
	return _vlan_add(L, DEL_VLAN_CMD);
}

int vlan_getall(lua_State *L)
{
	struct dirent **namelist;
	int n = 0, i, count = 0;
	count = scandir("/proc/net/vlan/", &namelist, NULL, alphasort);
	if (count < 0)
		return 0;
	lua_newtable(L);
	for (i = 0; i < count; i++)
	{
		if(strcmp(namelist[i]->d_name, "config") && (*namelist[i]->d_name != '.'))
		{
			n++;
			lua_pushinteger(L, n);
			lua_pushstring(L, namelist[i]->d_name);
			lua_settable(L, -3);
		}
		free(namelist[i]);
	}
	free(namelist);
	return 1;
}
