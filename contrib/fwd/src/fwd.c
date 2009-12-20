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
#include "fwd_xtables.h"
#include "fwd_ipc.h"
#include "fwd_utils.h"


static void fwd_foreach_network(
	struct fwd_handle *h,
	void (*cb)(struct fwd_handle *h, struct fwd_network *net)
) {
	struct fwd_data *data;
	struct fwd_network *net;

	for( data = h->conf; data; data = data->next )
	{
		if( data->type != FWD_S_ZONE )
			continue;

		for( net = data->section.zone.networks; net; net = net->next )
			cb(h, net);
	}
}

static void fwd_addif_all_cb(struct fwd_handle *h, struct fwd_network *net)
{
	fwd_ipt_addif(h, net->name);
}

static void fwd_delif_all_cb(struct fwd_handle *h, struct fwd_network *net)
{
	fwd_ipt_delif(h, net->name);
}

#define fwd_addif_all(h) fwd_foreach_network(h, fwd_addif_all_cb)
#define fwd_delif_all(h) fwd_foreach_network(h, fwd_delif_all_cb)


static int fwd_server_main(int argc, const char *argv[])
{
	struct fwd_handle *h;
	struct fwd_network *net;
	struct fwd_addr *addrs;
	struct fwd_data *data;
	struct fwd_cidr *addr_old, *addr_new;
	struct sigaction sa;
	int unix_client;

	sa.sa_handler = SIG_IGN;
	sigaction(SIGPIPE, &sa, NULL);

	if( getuid() > 0 )
		fwd_fatal("Need root permissions!");

	if( !(h = fwd_alloc_ptr(struct fwd_handle)) )
		fwd_fatal("Out of memory");

	if( (h->rtnl_socket = socket(AF_NETLINK, SOCK_RAW, NETLINK_ROUTE)) == -1 )
		fwd_fatal("Failed to create AF_NETLINK socket (%m)");

	if( (h->unix_socket = fwd_ipc_listen()) == -1 )
		fwd_fatal("Failed to create AF_UNIX socket (%m)");

	if( !(h->conf = fwd_read_config(h)) )
		fwd_fatal("Failed to read configuration");

	fwd_log_init();

	fwd_ipt_build_ruleset(h);
	fwd_addif_all(h);

	while(1)
	{
		if( (addrs = fwd_get_addrs(h->rtnl_socket, AF_INET)) != NULL )
		{
			for( data = h->conf; data; data = data->next )
			{
				if( data->type != FWD_S_ZONE )
					continue;

				for( net = data->section.zone.networks; net; net = net->next )
				{
					addr_new = fwd_lookup_addr(addrs, net->ifname);
					addr_old = net->addr;

					if( !fwd_empty_cidr(addr_new) && fwd_empty_cidr(addr_old) )
					{
						fwd_log_info(
							"Interface %s brought up - adding rules",
							net->ifname
						);

						fwd_update_cidr(addr_old, addr_new);
						fwd_ipt_addif(h, net->name);
					}
					else if( fwd_empty_cidr(addr_new) && !fwd_empty_cidr(addr_old) )
					{
						fwd_log_info(
							"Interface %s went down - removing rules",
							net->ifname
						);

						fwd_update_cidr(addr_old, NULL);
						fwd_ipt_delif(h, net->name);
					}
					else if( ! fwd_equal_cidr(addr_old, addr_new) )
					{
						fwd_log_info(
							"Interface %s changed IP - rebuilding rules",
							net->ifname
						);

						fwd_update_cidr(addr_old, addr_new);
						fwd_ipt_chgif(h, net->name);
					}
				}
			}

			fwd_free_addrs(addrs);
		}


		if( (unix_client = fwd_ipc_accept(h->unix_socket)) > -1 )
		{
			struct fwd_ipc_msg msg;
			memset(&msg, 0, sizeof(struct fwd_ipc_msg));

			while( fwd_ipc_recvmsg(unix_client, &msg, sizeof(struct fwd_ipc_msg)) > 0 )
			{
				fwd_log_info("Got message [%i]", msg.type);

				switch(msg.type)
				{
					case FWD_IPC_FLUSH:
						fwd_log_info("Flushing rules ...");
						fwd_ipt_clear_ruleset(h);
						fwd_ipc_sendtype(unix_client, FWD_IPC_OK);
						break;

					case FWD_IPC_BUILD:
						fwd_log_info("Building rules ...");
						fwd_ipt_clear_ruleset(h);
						fwd_ipt_build_ruleset(h);
						fwd_addif_all(h);
						fwd_ipc_sendtype(unix_client, FWD_IPC_OK);
						break;

					case FWD_IPC_RELOAD:
						if( (data = fwd_read_config(h)) != NULL )
						{
							fwd_log_info("Flushing rules ...");
							fwd_ipt_clear_ruleset(h);
							fwd_free_config(h->conf);
							h->conf = data;
							fwd_log_info("Building rules ...");
							fwd_ipt_build_ruleset(h);
							fwd_addif_all(h);
							fwd_ipc_sendtype(unix_client, FWD_IPC_OK);
						}
						else
						{
							fwd_log_err("Cannot reload configuration!");
							fwd_ipc_sendtype(unix_client, FWD_IPC_ERROR);
						}
						break;

					case FWD_IPC_ADDIF:
					case FWD_IPC_DELIF:
						if( strlen(msg.data.network) > 0 )
						{
							fwd_ipt_delif(h, msg.data.network);

							if( msg.type == FWD_IPC_ADDIF )
								fwd_ipt_addif(h, msg.data.network);

							fwd_ipc_sendtype(unix_client, FWD_IPC_OK);
						}
						else
						{
							fwd_log_err("No network name provided!");
							fwd_ipc_sendtype(unix_client, FWD_IPC_ERROR);
						}
						break;

					case FWD_IPC_OK:
					case FWD_IPC_ERROR:
						break;
				}
			}

			fwd_ipc_shutdown(unix_client);
		}


		sleep(1);
	}

	fwd_delif_all(h);
	fwd_ipt_clear_ruleset(h);

	close(h->rtnl_socket);
	fwd_free_config(h->conf);
	fwd_free_ptr(h);

	return 0;
}

static void fwd_client_usage(const char *msg)
{
	printf(
		"%s\n\n"
		"Usage:\n"
		"  fw flush\n"
		"    Flush all rules in the firewall and reset policy\n\n"
		"  fw build\n"
		"    Rebuild firewall rules\n\n"
		"  fw reload\n"
		"    Reload configuration and rebuild firewall rules\n\n"
		"  fw addif {network}\n"
		"    Add rules for given network\n\n"
		"  fw delif {network}\n"
		"    Remove rules for given network\n\n"
		"", msg
	);

	exit(1);
}

static int fwd_client_main(int argc, const char *argv[])
{
	int unix_server;
	struct fwd_ipc_msg msg;
	enum fwd_ipc_msgtype type;

	if( argc < 2 )
		fwd_client_usage("Command required");

	if( (unix_server = fwd_ipc_connect()) < 0 )
		fwd_fatal("Cannot connect to server instance (%m)");


	memset(&msg, 0, sizeof(struct fwd_ipc_msg));

	if( !strcmp(argv[1], "flush") )
		type = FWD_IPC_FLUSH;

	else if( !strcmp(argv[1], "build") )
		type = FWD_IPC_BUILD;

	else if( !strcmp(argv[1], "reload") )
		type = FWD_IPC_RELOAD;

	else if( !strcmp(argv[1], "addif") || !strcmp(argv[1], "delif") )
	{
		if( argc < 3 )
			fwd_client_usage("The command requires a parameter.");

		type = strcmp(argv[1], "addif") ? FWD_IPC_DELIF : FWD_IPC_ADDIF;
		strncpy(msg.data.network, argv[2], sizeof(msg.data.network));
	}

	else
		fwd_client_usage("Invalid command given.");

	msg.type = type;
	fwd_ipc_sendmsg(unix_server, &msg, sizeof(struct fwd_ipc_msg));

	memset(&msg, 0, sizeof(struct fwd_ipc_msg));

	while( fwd_ipc_recvmsg(unix_server, &msg, sizeof(struct fwd_ipc_msg)) == 0 )
		continue;

	switch(msg.type)
	{
		case FWD_IPC_OK:
			printf("Success\n");
			break;

		case FWD_IPC_ERROR:
			printf("The server reported an error, check logread!\n");
			break;

		default:
			fwd_fatal("Unexpected response type %i", msg.type);
	}

	fwd_ipc_shutdown(unix_server);

	return 0;
}

int main(int argc, const char *argv[])
{
	if( strstr(argv[0], "fwd") )
		return fwd_server_main(argc, argv);
	else
		return fwd_client_main(argc, argv);
}

