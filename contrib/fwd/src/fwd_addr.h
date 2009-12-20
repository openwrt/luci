/*
 * fwd - OpenWrt firewall daemon - header for rtnetlink communication
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
 * The fwd program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation.
 *
 * The fwd program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with the fwd program. If not, see http://www.gnu.org/licenses/.
 */

#ifndef __FWD_ADDR_H__
#define __FWD_ADDR_H__

#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <linux/netlink.h>
#include <linux/rtnetlink.h>
#include <arpa/inet.h>


struct fwd_addr {
	char ifname[IFNAMSIZ];
	char label[IFNAMSIZ];
	int family;
	int index;
	struct fwd_cidr ipaddr;
	struct fwd_addr *next;
};


struct fwd_addr * fwd_get_addrs(int, int);
struct fwd_addr * fwd_append_addrs(struct fwd_addr *, struct fwd_addr *);
void fwd_free_addrs(struct fwd_addr *);

struct fwd_cidr * fwd_lookup_addr(struct fwd_addr *, const char *);

#define fwd_foreach_addrs(head, entry) for(entry = head; entry; entry = entry->next)

#endif

