/*
 * fwd - OpenWrt firewall daemon - main part
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


#include "fwd.h"
#include "fwd_addr.h"
#include "fwd_rules.h"
#include "fwd_config.h"

#define IPT "iptables"


int main(int argc, const char *argv[])
{
	struct fwd_handle *h;

	if( !(h = fwd_alloc_ptr(struct fwd_handle)) )
		fwd_fatal("Out of memory");

	if( !(h->conf = fwd_read_config()) )
		fwd_fatal("Failed to read configuration");

	if( (h->rtnl_socket = socket(AF_NETLINK, SOCK_RAW, NETLINK_ROUTE)) == -1 )
		fwd_fatal("Failed to create AF_NETLINK socket (%m)");

	if( !(h->addrs = fwd_get_addrs(h->rtnl_socket, AF_INET)) )
		fwd_fatal("Failed to issue RTM_GETADDR (%m)");


	fwd_ipt_build_ruleset(h);

	fwd_ipt_addif(h, "lan");
	fwd_ipt_addif(h, "wan");


	close(h->rtnl_socket);
	fwd_free_config(h->conf);
	fwd_free_addrs(h->addrs);
	fwd_free_ptr(h);

	return 0;
}
