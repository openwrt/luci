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
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <linux/sockios.h>
#include <sys/ioctl.h>
#include <dirent.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <stdlib.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

#include "helper.h"

int sock_ifconfig = 0;

int ifc_startup(void)
{
	if(!sock_ifconfig)
		sock_ifconfig = socket(AF_INET, SOCK_DGRAM, 0);
	return sock_ifconfig;
}

void ifc_shutdown(void)
{
	if(!sock_ifconfig)
		return;
	close(sock_ifconfig);
	sock_ifconfig = 0;
}

static int isdev(const struct dirent *entry)
{
	if(*entry->d_name == '.')
		return 0;
	return 1;
}

static void ifc_addif(lua_State *L, char *ifname)
{
	char *ip = malloc(32);
	struct ifreq ifr;
	lua_pushstring(L, ifname);
	lua_newtable(L);
	strncpy(ifr.ifr_name, ifname, IFNAMSIZ);

	if(!ioctl(sock_ifconfig, SIOCGIFADDR, &ifr))
	{
		ipv42char(&ifr.ifr_addr.sa_data[2], ip);
		add_table_entry(L, "ip", ip);
	}

	if(!ioctl(sock_ifconfig, SIOCGIFNETMASK, &ifr))
	{
		ipv42char(&ifr.ifr_netmask.sa_data[2], ip);
		add_table_entry(L, "netmask", ip);
	}

	if(!ioctl(sock_ifconfig, SIOCGIFBRDADDR, &ifr))
	{
		ipv42char(&ifr.ifr_broadaddr.sa_data[2], ip);
		add_table_entry(L, "broadaddr", ip);
	}

	if(!ioctl(sock_ifconfig, SIOCGIFHWADDR, &ifr))
	{
		mac2char(ifr.ifr_hwaddr.sa_data, ip);
		add_table_entry(L, "mac", ip);
	}

	if(!ioctl(sock_ifconfig, SIOCGIFFLAGS, &ifr))
	{
		if(ifr.ifr_flags & IFF_UP)
			add_table_entry(L, "up", "1");
		else
			add_table_entry(L, "up", "0");
	}

	ioctl(sock_ifconfig, SIOCGIFMTU, &ifr);
	lua_pushstring(L, "mtu");
	lua_pushinteger(L, ifr.ifr_mtu);
	lua_settable(L, -3);
	free(ip);
	lua_settable(L, -3);
}

#define SYSFS_CLASS_NET	"/sys/class/net/"
int ifc_getall(lua_State *L)
{
	int numreqs = 50;
	struct dirent **namelist;
	int i, count = 0;
	struct ifconf ifc;
	struct ifreq *ifr;
	ifc.ifc_buf = NULL;
	count = scandir(SYSFS_CLASS_NET, &namelist, isdev, alphasort);
	if (count < 0)
	{
		return 0;
	}
	lua_newtable(L);
	for (i = 0; i < count; i++)
	{
		ifc_addif(L, namelist[i]->d_name);
		free(namelist[i]);
	}
	free(namelist);

	ifc.ifc_len = sizeof(struct ifreq) * numreqs;
	ifc.ifc_buf = malloc(ifc.ifc_len);
	if(ioctl(sock_ifconfig, SIOCGIFCONF, &ifc) < 0)
		goto out;
	ifr = ifc.ifc_req;
	for(i = 0; i < ifc.ifc_len; i += sizeof(struct ifreq))
	{
		if(strchr(ifr->ifr_name, ':'))
			ifc_addif(L, ifr->ifr_name);
		ifr++;
	}
out:
	free(ifc.ifc_buf);
	return 1;
}

static inline int _ifc_setip(lua_State *L, int i)
{
	struct ifreq ifr;
	char *ifname, *ip;
	if(lua_gettop(L) != 2)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
    ifname = (char *)lua_tostring (L, 1);
    ip = (char *)lua_tostring (L, 2);
	strncpy(ifr.ifr_name, ifname, IFNAMSIZ);
	ifr.ifr_addr.sa_family = AF_INET;
	if(char2ipv4(ip, &ifr.ifr_addr.sa_data[2]))
	{
		lua_pushstring(L, "invalid ip");
		lua_error(L);
		return 0;
	}
	if(!ioctl(sock_ifconfig, i, &ifr))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

int ifc_setip(lua_State *L)
{
	return _ifc_setip(L, SIOCSIFADDR);
}

int ifc_setnetmask(lua_State *L)
{
	return _ifc_setip(L, SIOCGIFNETMASK);
}

int ifc_setbroadcast(lua_State *L)
{
	return _ifc_setip(L, SIOCSIFBRDADDR);
}

int ifc_setmtu(lua_State *L)
{
	struct ifreq ifr;
	char *ifname;
	int mtu;
	if(lua_gettop(L) != 2)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
	ifname = (char *)lua_tostring (L, 1);
	mtu = (int)lua_tointeger (L, 2);
	strncpy(ifr.ifr_name, ifname, IFNAMSIZ);
	ifr.ifr_mtu = mtu;
	if(!ioctl(sock_ifconfig, SIOCSIFMTU, &ifr))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

static int _ifc_up(lua_State *L, int up)
{
	struct ifreq ifr;
	char *ifname;
	if(lua_gettop(L) != 1)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}

	ifname = (char *)lua_tostring (L, 1);
	strncpy(ifr.ifr_name, ifname, IFNAMSIZ);

	if(ioctl(sock_ifconfig, SIOCGIFFLAGS, &ifr) < 0)
	{
		lua_pushboolean(L, 0);
		return 1;
	}
	if(up)
		ifr.ifr_flags |= IFF_UP | IFF_RUNNING;
	else
		ifr.ifr_flags &= ~IFF_UP;
	if(!ioctl(sock_ifconfig, SIOCSIFFLAGS, &ifr))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

int ifc_up(lua_State *L)
{
	return _ifc_up(L, 1);
}

int ifc_down(lua_State *L)
{
	return _ifc_up(L, 0);
}

