/*
 * fwd - OpenWrt firewall daemon - data structures
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

#ifndef __FWD_H__
#define __FWD_H__

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdarg.h>
#include <stdlib.h>
#include <getopt.h>
#include <signal.h>
#include <netinet/in.h>


enum fwd_policy {
	FWD_P_UNSPEC = 0,
	FWD_P_DROP   = 1,
	FWD_P_REJECT = 2,
	FWD_P_ACCEPT = 3
};

enum fwd_stype {
	FWD_S_DEFAULTS = 0,
	FWD_S_ZONE     = 1,
	FWD_S_FORWARD  = 2,
	FWD_S_REDIRECT = 3,
	FWD_S_RULE     = 4,
	FWD_S_INCLUDE  = 5
};

enum fwd_ptype {
	FWD_PR_CUSTOM  = 0,
	FWD_PR_TCP     = 1,
	FWD_PR_UDP     = 2,
	FWD_PR_TCPUDP  = 3,
	FWD_PR_ICMP    = 4,
	FWD_PR_ALL     = 5
};

struct fwd_portrange {
	unsigned short min;
	unsigned short max;
};

struct fwd_cidr {
	struct in_addr addr;
	int prefix;
};

struct fwd_mac {
	unsigned char mac[6];
};

struct fwd_proto {
	enum fwd_ptype type;
	int proto;
};

struct fwd_icmptype {
	char name[32];
	int type;
	int code;
};

struct fwd_network {
	char *name;
	char *ifname;
	int isalias;
	struct fwd_cidr *addr;
	struct fwd_network *next;
};

struct fwd_defaults {
	enum fwd_policy input;
	enum fwd_policy forward;
	enum fwd_policy output;
	int syn_flood;
	int syn_rate;
	int syn_burst;
	int drop_invalid;	
};

struct fwd_zone {
	char *name;
	struct fwd_network *networks;
	struct fwd_data *forwardings;
	struct fwd_data *redirects;
	struct fwd_data *rules;
	enum fwd_policy input;
	enum fwd_policy forward;
	enum fwd_policy output;
	int masq;
	int mtu_fix;
	int conntrack;
};

struct fwd_forwarding {
	struct fwd_zone *src;
	struct fwd_zone *dest;
	int mtu_fix;  /* legacy */
	int masq;     /* new */
};

struct fwd_redirect {
	struct fwd_zone      *src;
	struct fwd_cidr      *src_ip;
	struct fwd_mac       *src_mac;
	struct fwd_portrange *src_port;
	struct fwd_portrange *src_dport;
	struct fwd_cidr      *dest_ip;
	struct fwd_portrange *dest_port;
	struct fwd_proto     *proto;
	int clone; /* true if rule is cloned (tcpudp -> tcp + udp) */
};

struct fwd_rule {
	struct fwd_zone      *src;
	struct fwd_zone      *dest;
	struct fwd_cidr      *src_ip;
	struct fwd_mac       *src_mac;
	struct fwd_portrange *src_port;
	struct fwd_cidr      *dest_ip;
	struct fwd_portrange *dest_port;
	struct fwd_proto     *proto;
	struct fwd_icmptype  *icmp_type;
	enum fwd_policy target;
	int clone; /* true if rule is cloned (tcpudp -> tcp + udp) */
};

struct fwd_include {
	char *path;
};

struct fwd_data {
	enum fwd_stype type;
	struct fwd_data *next;
	union {
		struct fwd_defaults   defaults;
		struct fwd_zone       zone;
		struct fwd_forwarding forwarding;
		struct fwd_redirect   redirect;
		struct fwd_rule       rule;
		struct fwd_include    include;
	} section;
};


struct fwd_handle {
	int rtnl_socket;
	int unix_socket;
	struct fwd_data *conf;
};


/* fwd_fatal(fmt, ...)
 * Prints message to stderr and termintes program. */
#define fwd_fatal(...) do {       \
	fprintf(stderr, "ERROR: ");   \
	fprintf(stderr, __VA_ARGS__); \
	fprintf(stderr, "\n");        \
	exit(1);                      \
} while(0)


#endif
