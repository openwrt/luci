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

#include <string.h>
#include <net/if.h>
#include <linux/sockios.h>
#include <dirent.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/ioctl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

static int sock_bridge = 0;
int bridge_startup()
{
	if(!sock_bridge)
		sock_bridge = socket(AF_LOCAL, SOCK_STREAM, 0);
	return sock_bridge;
}

void bridge_shutdown(void)
{
	if(!sock_bridge)
		return;
	close(sock_bridge);
	sock_bridge = 0;
}

static inline int _bridge_new(lua_State *L, int i)
{
	char *ifname;
	if(lua_gettop(L) != 1)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}

	ifname = (char *)lua_tostring (L, 1);
	if(!ioctl(sock_bridge, i, ifname))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

int bridge_new(lua_State *L)
{
	return _bridge_new(L, SIOCBRADDBR);
}

int bridge_del(lua_State *L)
{
	return _bridge_new(L, SIOCBRDELBR);
}

static inline int _bridge_addif(lua_State *L, int i)
{
	struct ifreq ifr;
	char *br, *ifname;
	if(lua_gettop(L) != 2)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
	br = (char *)lua_tostring (L, 1);
	ifname = (char *)lua_tostring (L, 2);
	strncpy(ifr.ifr_name, br, IFNAMSIZ);
	ifr.ifr_ifindex = if_nametoindex(ifname);
	if(ifr.ifr_ifindex == 0)
	{
		lua_pushboolean(L, 0);
		return 1;
	}
	if(!ioctl(sock_bridge, i, &ifr))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

int bridge_addif(lua_State *L)
{
	return _bridge_addif(L, SIOCBRADDIF);
}

int bridge_delif(lua_State *L)
{
	return _bridge_addif(L, SIOCBRDELIF);
}

#define SYSFS_PATH_MAX	512
#define SYSFS_CLASS_NET "/sys/class/net/"
static int isbridge(const struct dirent *entry)
{
	char path[SYSFS_PATH_MAX];
	struct stat st;

	snprintf(path, SYSFS_PATH_MAX, SYSFS_CLASS_NET "%s/bridge", entry->d_name);
	return stat(path, &st) == 0 && S_ISDIR(st.st_mode);
}

static int isdev(const struct dirent *entry)
{
	if(*entry->d_name == '.')
		return 0;
	return 1;
}

static inline void bridge_getifs(lua_State *L, const char *ifname)
{
	struct dirent **namelist;
	int i, count = 0;
	char path[SYSFS_PATH_MAX];
	snprintf(path, SYSFS_PATH_MAX, SYSFS_CLASS_NET "%s/brif", ifname);
	count = scandir(path, &namelist, isdev, alphasort);
	if(count < 0)
		return;

	for(i = 0; i < count; i++)
	{
		lua_pushinteger(L, i + 1);
		lua_pushstring(L, namelist[i]->d_name);
		lua_settable(L, -3);
		free(namelist[i]);
	}
	free(namelist);
	return;
}

int bridge_getall(lua_State *L)
{
	struct dirent **namelist;
	int i, count = 0;
	count = scandir(SYSFS_CLASS_NET, &namelist, isbridge, alphasort);
	if (count < 0)
		return 0;

	lua_newtable(L);
	for (i = 0; i < count; i++)
	{
		lua_pushstring(L, namelist[i]->d_name);
		lua_newtable(L);
		bridge_getifs(L, namelist[i]->d_name);
		free(namelist[i]);
		lua_settable(L, -3);
	}
	free(namelist);
	return 1;
}
