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

#include <linux/sockios.h>
#include <net/route.h>
#include <sys/ioctl.h>

#include "helper.h"

extern int sock_ifconfig;

int route_add(char *dev, int flag_gateway, int flag_host, char *dst, char *gateway, char *mask)
{
	struct rtentry r;
	char ip[4];
	r.rt_flags = RTF_UP;
	if(flag_gateway)
		r.rt_flags |= RTF_GATEWAY;
	if(flag_host)
		r.rt_flags |= RTF_HOST;
	r.rt_dst.sa_family = AF_INET;
	r.rt_gateway.sa_family = AF_INET;
	r.rt_genmask.sa_family = AF_INET;
	char2ipv4(dst, ip);
	((struct sockaddr_in *) &r.rt_dst)->sin_addr.s_addr = (unsigned int)ip;
	char2ipv4(gateway, ip);
	((struct sockaddr_in *) &r.rt_gateway)->sin_addr.s_addr = (unsigned int)ip;
	char2ipv4(mask, ip);
	((struct sockaddr_in *) &r.rt_genmask)->sin_addr.s_addr = (unsigned int)ip;
	return ioctl(sock_ifconfig, SIOCADDRT, (void *) &r);
}
