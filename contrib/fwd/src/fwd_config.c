/*
 * fwd - OpenWrt firewall daemon - config parsing
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
#include "fwd_config.h"
#include "fwd_utils.h"

#include "ucix.h"


#define fwd_read_error(...) do { \
	fwd_log_err(__VA_ARGS__);    \
	return;                      \
} while(0)


/*
 * Parse helpers
 */
static int
fwd_read_policy(struct uci_context *uci, const char *s, const char *o)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);

	if( val != NULL )
	{
		switch( val[0] )
		{
			case 'D':
			case 'd':
				return FWD_P_DROP;

			case 'R':
			case 'r':
				return FWD_P_REJECT;

			case 'A':
			case 'a':
				return FWD_P_ACCEPT;
		}
	}

	return FWD_P_UNSPEC;
}

static int
fwd_read_bool(struct uci_context *uci, const char *s, const char *o, int d)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);

	if( val != NULL )
	{
		if( !strcmp(val, "yes") || !strcmp(val, "true") || !strcmp(val, "1") )
			return 1;
		else
			return 0;
	}

	return d;
}

static unsigned int
fwd_read_uint(struct uci_context *uci, const char *s, const char *o, unsigned int d)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);

	if( val != NULL )
	{
		return atoi(val);
	}

	return d;
}

static int
fwd_read_cidr(struct uci_context *uci, const char *s, const char *o, struct fwd_cidr **c)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);
	char ip[32], prefix[32];
	struct in_addr ina;

	memset(ip, 0, 32);
	memset(prefix, 0, 32);

	if( val == NULL )
	{
		return 0;
	}
	else if( (strlen(val) < 32) && (sscanf(val, "%[^/]/%s", ip, prefix) > 0) )
	{
		if( !(*c = fwd_alloc_ptr(struct fwd_cidr)) )
			goto inval;

		if( inet_aton(ip, &ina) )
		{
			(*c)->addr.s_addr = ina.s_addr;

			if( strchr(prefix, '.') )
			{
				if( inet_aton(prefix, &ina) )
				{
					(*c)->prefix = 32;
					ina.s_addr = ntohl(ina.s_addr);

					while( !(ina.s_addr & 1) )
					{
						ina.s_addr >>= 1;
						(*c)->prefix--;
					}
				}
				else
				{
					goto inval;
				}
			}
			else
			{
				(*c)->prefix = prefix[0] ? atoi(prefix) : 32;

				if( ((*c)->prefix < 0) || ((*c)->prefix > 32) )
				{
					goto inval;
				}
			}

			return 0;
		}
	}

	inval:
	fwd_free_ptr(*c);
	return -1;
}

static int
fwd_read_mac(struct uci_context *uci, const char *s, const char *o, struct fwd_mac **m)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);

	if( val == NULL )
	{
		return 0;
	}
	else
	{
		if( (*m = fwd_alloc_ptr(struct fwd_mac)) != NULL )
		{
			unsigned int i1, i2, i3, i4, i5, i6;

			if( sscanf(val, "%2x:%2x:%2x:%2x:%2x:%2x",
				&i1, &i2, &i3, &i4, &i5, &i6) == 6
			) {
				(*m)->mac[0] = (unsigned char)i1;
				(*m)->mac[1] = (unsigned char)i2;
				(*m)->mac[2] = (unsigned char)i3;
				(*m)->mac[3] = (unsigned char)i4;
				(*m)->mac[4] = (unsigned char)i5;
				(*m)->mac[5] = (unsigned char)i6;
				return 0;
			}
		}
	}

	fwd_free_ptr(*m);
	return -1;
}

static int
fwd_read_portrange(struct uci_context *uci, const char *s, const char *o, struct fwd_portrange **p)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);
	int min = -1;
	int max = -1;
	unsigned int tmp;

	if( val == NULL )
	{
		return 0;
	}
	else if( sscanf(val, "%u%*[:-]%u", &min, &max) > 0 )
	{
		if( max == -1 )
		{
			max = min;
		}
		else if( min > max )
		{
			tmp = max;
			max = min;
			min = tmp;
		}

		if( (min >= 0) && (min <= 65535) && (max >= 0) && (max <= 65535) )
		{
			if( (*p = fwd_alloc_ptr(struct fwd_portrange)) != NULL )
			{
				(*p)->min = min;
				(*p)->max = max;
				return 0;
			}
		}
	}

	fwd_free_ptr(*p);
	return -1;
}

static int
fwd_read_proto(struct uci_context *uci, const char *s, const char *o, struct fwd_proto **p)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);
	int proto;

	if( val == NULL )
	{
		return 0;
	}
	else
	{
		if( (*p = fwd_alloc_ptr(struct fwd_proto)) != NULL )
		{
			proto = atoi(val);

			if( !strcasecmp(val, "all") )
			{
				(*p)->type  = FWD_PR_ALL;
				(*p)->proto = 0;
			}
			else if( !strcasecmp(val, "icmp") )
			{
				(*p)->type  = FWD_PR_ICMP;
				(*p)->proto = 0;
			}
			else if( !strcasecmp(val, "udp") )
			{
				(*p)->type  = FWD_PR_UDP;
				(*p)->proto = 0;
			}
			else if( !strcasecmp(val, "tcp") )
			{
				(*p)->type  = FWD_PR_TCP;
				(*p)->proto = 0;
			}
			else if( !strcasecmp(val, "tcpudp") )
			{
				(*p)->type  = FWD_PR_TCPUDP;
				(*p)->proto = 0;
			}
			else if( proto > 0 )
			{
				(*p)->type  = FWD_PR_CUSTOM;
				(*p)->proto = proto;
			}
			else
			{
				goto inval;
			}

			return 0;
		}
	}

	inval:
	fwd_free_ptr(*p);
	return -1;
}

static int
fwd_read_icmptype(struct uci_context *uci, const char *s, const char *o, struct fwd_icmptype **i)
{
	const char *val = ucix_get_option(uci, "firewall", s, o);
	unsigned int type, code;

	if( val == NULL )
	{
		return 0;
	}
	else
	{
		if( (*i = fwd_alloc_ptr(struct fwd_icmptype)) != NULL )
		{
			if( sscanf(val, "%u/%u", &type, &code) == 2 )
			{
				if( (type > 255) || (code > 255) )
					goto inval;

				(*i)->type = type;
				(*i)->code = code;

				return 0;
			}

			else if( sscanf(val, "%u", &type) == 1 )
			{
				if( type > 255 )
					goto inval;

				(*i)->type = type;
				(*i)->code = -1;

				return 0;
			}

			/* XXX: no validity check here but I do not want to
			        duplicate libipt_icmp.c ... */
			else if( sscanf(val, "%31s", (*i)->name) == 1 )
			{
				return 0;
			}
		}
	}

	inval:
	fwd_free_ptr(*i);
	return -1;
}

static const char *
fwd_read_string(struct uci_context *uci, const char *s, const char *o)
{
	return ucix_get_option(uci, "firewall", s, o);
}


static void
fwd_append_config(struct fwd_data *h, struct fwd_data *a)
{
	while( h->next )
		h = h->next;

	h->next = a;
}


/*
 * config defaults
 */
static void fwd_read_defaults_cb(
	struct uci_context *uci,
	const char *s, struct fwd_defaults *d
) {
	d->input        = fwd_read_policy(uci, s, "input");
	d->forward      = fwd_read_policy(uci, s, "forward");
	d->output       = fwd_read_policy(uci, s, "output");
	d->syn_flood    = fwd_read_bool(uci, s, "syn_flood", 1);
	d->syn_rate     = fwd_read_uint(uci, s, "syn_rate", 25);
	d->syn_burst    = fwd_read_uint(uci, s, "syn_burst", 50);
	d->drop_invalid = fwd_read_bool(uci, s, "drop_invalid", 1);
}

static struct fwd_data *
fwd_read_defaults(struct uci_context *uci)
{
	struct fwd_data *dt;
	struct fwd_defaults d;

	if( (dt = fwd_alloc_ptr(struct fwd_data)) != NULL )
	{
		memset(&d, 0, sizeof(d));

		ucix_for_each_section_type(uci, "firewall", "defaults",
			(void *)fwd_read_defaults_cb, &d);

		memcpy(&dt->section.defaults, &d, sizeof(d));

		dt->type = FWD_S_DEFAULTS;
		dt->next = NULL;

		return dt;
	}

	return NULL;
}


/*
 * config zone
 */
static void fwd_read_zone_networks_cb(
	const char *net, struct fwd_network **np
) {
	struct fwd_network *nn;

	if( (nn = fwd_alloc_ptr(struct fwd_network)) != NULL )
	{
		nn->name = strdup(net);
		nn->next = *np;
		*np = nn;
	}
}

static void fwd_read_zones_cb(
	struct uci_context *uci,
	const char *s, struct fwd_data_conveyor *cv
) {
	struct fwd_data *dtn;
	struct fwd_network *net = NULL;
	const char *name;

	if( !(name = fwd_read_string(uci, s, "name")) )
		fwd_read_error("section '%s' is missing 'name' option!", s);

	if( (dtn = fwd_alloc_ptr(struct fwd_data)) != NULL )
	{
		dtn->section.zone.name      = strdup(name);
		dtn->section.zone.masq      = fwd_read_bool(uci, s, "masq", 0);
		dtn->section.zone.mtu_fix   = fwd_read_bool(uci, s, "mtu_fix", 0);
		dtn->section.zone.conntrack = fwd_read_bool(uci, s, "conntrack", 0);

		dtn->section.zone.input     = fwd_read_policy(uci, s, "input")
			?: cv->head->section.defaults.input   ?: FWD_P_DROP;

		dtn->section.zone.forward   = fwd_read_policy(uci, s, "forward")
			?: cv->head->section.defaults.forward ?: FWD_P_DROP;

		dtn->section.zone.output    = fwd_read_policy(uci, s, "output")
			?: cv->head->section.defaults.output  ?: FWD_P_DROP;

		/* try to parse option/list network ... */
		if( ucix_for_each_list(uci, "firewall", s, "network",
			(void *)&fwd_read_zone_networks_cb, &net) < 0 )
		{
			/* ... didn't work, fallback to option name */
			fwd_read_zone_networks_cb(name, &net);
		}

		dtn->section.zone.networks = net;
		dtn->type = FWD_S_ZONE;
		dtn->next = cv->cursor;
		cv->cursor = dtn;
	}
}

static struct fwd_data *
fwd_read_zones(struct uci_context *uci, struct fwd_data *def)
{
	struct fwd_data_conveyor cv;

	cv.cursor = NULL;
	cv.head = def;

	ucix_for_each_section_type(uci, "firewall", "zone",
		(void *)fwd_read_zones_cb, &cv);

	return cv.cursor;
}


/*
 * config forwarding
 */
static void fwd_read_forwards_cb(
	struct uci_context *uci,
	const char *s, struct fwd_data_conveyor *cv
) {
	const char *src, *dest;
	struct fwd_data *dtn;
	struct fwd_zone *zsrc  = NULL;
	struct fwd_zone *zdest = NULL;

	if( !(src = fwd_read_string(uci, s, "src")) )
		fwd_read_error("section '%s' is missing 'src' option!", s);
	else if( !(zsrc = fwd_lookup_zone(cv->head, src)) )
		fwd_read_error("section '%s' references unknown src zone '%s'!", s, src);
	else if( !(dest = fwd_read_string(uci, s, "dest")) )
		fwd_read_error("section '%s' is missing 'dest' option!", s);
	else if( !(zdest = fwd_lookup_zone(cv->head, dest)) )
		fwd_read_error("section '%s' references unknown dest zone '%s'!", s, dest);
	
	if( (dtn = fwd_alloc_ptr(struct fwd_data)) != NULL )
	{
		dtn->section.forwarding.src = zsrc;
		dtn->section.forwarding.dest = zdest;
		dtn->section.forwarding.mtu_fix = fwd_read_bool(uci, s, "mtu_fix", 0);
		dtn->section.forwarding.masq = fwd_read_bool(uci, s, "masq", 0);

		dtn->type = FWD_S_FORWARD;

		if( zsrc )
		{
			dtn->next = zsrc->forwardings;
			zsrc->forwardings = dtn;
		}
		else
		{
			dtn->next = cv->cursor;
			cv->cursor = dtn;
		}
	}
	else
	{
		fwd_read_error("out of memory while parsing config!");
	}
}

static struct fwd_data *
fwd_read_forwards(struct uci_context *uci, struct fwd_data *zones)
{
	struct fwd_data_conveyor cv;

	cv.cursor = NULL;
	cv.head = zones;

	ucix_for_each_section_type(uci, "firewall", "forwarding",
		(void *)fwd_read_forwards_cb, &cv);

	return cv.cursor;
}


/*
 * config redirect
 */
static void fwd_read_redirects_cb(
	struct uci_context *uci,
	const char *s, struct fwd_data_conveyor *cv
) {
	const char *src;
	struct fwd_data *dtn  = NULL;
	struct fwd_data *dtn2 = NULL;
	struct fwd_zone *zsrc = NULL;

	/* check zone */
	if( !(src = fwd_read_string(uci, s, "src")) )
		fwd_read_error(
			"section '%s' is missing 'src' option!",
			s
		);

	else if( !(zsrc = fwd_lookup_zone(cv->head, src)) )
		fwd_read_error(
			"section '%s' references unknown src zone '%s'!",
			s, src
		);

	/* uci context, section, name, type */
	fwd_check_option(uci, s, src_ip, cidr);
	fwd_check_option(uci, s, src_mac, mac);
	fwd_check_option(uci, s, src_port, portrange);
	fwd_check_option(uci, s, src_dport, portrange);
	fwd_check_option(uci, s, dest_ip, cidr);
	fwd_check_option(uci, s, dest_port, portrange);
	fwd_check_option(uci, s, proto, proto);
	
	if( (dtn = fwd_alloc_ptr(struct fwd_data)) != NULL )
	{
		dtn->section.redirect.proto     = proto;
		dtn->section.redirect.src       = zsrc;
		dtn->section.redirect.src_ip    = src_ip;
		dtn->section.redirect.src_mac   = src_mac;
		dtn->section.redirect.src_port  = src_port;
		dtn->section.redirect.src_dport = src_dport;
		dtn->section.redirect.dest_ip   = dest_ip;
		dtn->section.redirect.dest_port = dest_port;

		dtn->type = FWD_S_REDIRECT;
		dtn->next = zsrc->redirects;
		zsrc->redirects = dtn;

		if( (proto != NULL) && (proto->type == FWD_PR_TCPUDP) )
		{
			if( !(dtn2 = fwd_alloc_ptr(struct fwd_data)) ||
			    !(dtn2->section.redirect.proto = fwd_alloc_ptr(struct fwd_proto))
			) {
				fwd_free_ptr(dtn2);
				fwd_read_error("out of memory while parsing config!");
			}

			dtn->section.redirect.proto->type = FWD_PR_UDP;
			dtn2->section.redirect.proto->type = FWD_PR_TCP;

			dtn2->section.redirect.src       = zsrc;
			dtn2->section.redirect.src_ip    = src_ip;
			dtn2->section.redirect.src_mac   = src_mac;
			dtn2->section.redirect.src_port  = src_port;
			dtn2->section.redirect.src_dport = src_dport;
			dtn2->section.redirect.dest_ip   = dest_ip;
			dtn2->section.redirect.dest_port = dest_port;
			dtn2->section.redirect.clone     = 1;

			dtn2->type = FWD_S_REDIRECT;
			dtn2->next = zsrc->redirects;
			zsrc->redirects = dtn2;
		}
	}
	else
	{
		fwd_read_error("out of memory while parsing config!");
	}
}

static struct fwd_data *
fwd_read_redirects(struct uci_context *uci, struct fwd_data *zones)
{
	struct fwd_data_conveyor cv;

	cv.cursor = NULL;
	cv.head = zones;

	ucix_for_each_section_type(uci, "firewall", "redirect",
		(void *)fwd_read_redirects_cb, &cv);

	return cv.cursor;
}


/*
 * config rule
 */
static void fwd_read_rules_cb(
	struct uci_context *uci,
	const char *s, struct fwd_data_conveyor *cv
) {
	const char *src, *dest;
	struct fwd_data *dtn   = NULL;
	struct fwd_data *dtn2  = NULL;
	struct fwd_zone *zsrc  = NULL;
	struct fwd_zone *zdest = NULL;

	/* check zones */
	if( !(src = fwd_read_string(uci, s, "src")) )
		fwd_read_error(
			"section '%s' is missing 'src' option!",
			s
		);

	else if( !(zsrc = fwd_lookup_zone(cv->head, src)) )
		fwd_read_error(
			"section '%s' references unknown src zone '%s'!",
			s, src
		);

	if( (dest = fwd_read_string(uci, s, "dest")) != NULL )
		if( !(zdest = fwd_lookup_zone(cv->head, dest)) )
			fwd_read_error(
				"section '%s' references unknown dest zone '%s'!",
				s, dest
			);

	/* uci context, section, name, type */
	fwd_check_option(uci, s, src_ip, cidr);
	fwd_check_option(uci, s, src_mac, mac);
	fwd_check_option(uci, s, src_port, portrange);
	fwd_check_option(uci, s, dest_ip, cidr);
	fwd_check_option(uci, s, dest_port, portrange);
	fwd_check_option(uci, s, proto, proto);
	fwd_check_option(uci, s, icmptype, icmptype);
	
	if( (dtn = fwd_alloc_ptr(struct fwd_data)) != NULL )
	{
		dtn->section.rule.proto     = proto;
		dtn->section.rule.icmp_type = icmptype;
		dtn->section.rule.src       = zsrc;
		dtn->section.rule.src_ip    = src_ip;
		dtn->section.rule.src_mac   = src_mac;
		dtn->section.rule.src_port  = src_port;
		dtn->section.rule.dest      = zdest;
		dtn->section.rule.dest_ip   = dest_ip;
		dtn->section.rule.dest_port = dest_port;
		dtn->section.rule.target    = fwd_read_policy(uci, s, "target");

		dtn->type = FWD_S_RULE;
		dtn->next = zsrc->rules;
		zsrc->rules = dtn;

		if( (proto != NULL) && (proto->type == FWD_PR_TCPUDP) )
		{
			if( !(dtn2 = fwd_alloc_ptr(struct fwd_data)) ||
			    !(dtn2->section.rule.proto = fwd_alloc_ptr(struct fwd_proto))
			) {
				fwd_free_ptr(dtn2);
				fwd_read_error("out of memory while parsing config!");
			}

			dtn->section.rule.proto->type = FWD_PR_UDP;
			dtn2->section.rule.proto->type = FWD_PR_TCP;

			dtn2->section.rule.src       = zsrc;
			dtn2->section.rule.src_ip    = src_ip;
			dtn2->section.rule.src_mac   = src_mac;
			dtn2->section.rule.src_port  = src_port;
			dtn2->section.rule.dest      = zdest;
			dtn2->section.rule.dest_ip   = dest_ip;
			dtn2->section.rule.dest_port = dest_port;
			dtn2->section.rule.target    = dtn->section.rule.target;
			dtn2->section.rule.clone     = 1;

			dtn2->type = FWD_S_RULE;
			dtn2->next = zsrc->rules;
			zsrc->rules = dtn2;
		}
	}
	else
	{
		fwd_read_error("out of memory while parsing config!");
	}
}

static struct fwd_data *
fwd_read_rules(struct uci_context *uci, struct fwd_data *zones)
{
	struct fwd_data_conveyor cv;

	cv.cursor = NULL;
	cv.head = zones;

	ucix_for_each_section_type(uci, "firewall", "rule",
		(void *)fwd_read_rules_cb, &cv);

	return cv.cursor;
}


/*
 * config include
 */
static void fwd_read_includes_cb(
	struct uci_context *uci,
	const char *s, struct fwd_data_conveyor *cv
) {
	const char *path = fwd_read_string(uci, s, "path");
	struct fwd_data *dtn = NULL;

	if( path != NULL )
	{
		if( (dtn = fwd_alloc_ptr(struct fwd_data)) != NULL )
		{
			dtn->section.include.path = strdup(path);

			dtn->type = FWD_S_INCLUDE;
			dtn->next = cv->cursor;
			cv->cursor = dtn;
		}
		else
		{
			fwd_read_error("out of memory while parsing config!");
		}
	}
}

static struct fwd_data *
fwd_read_includes(struct uci_context *uci)
{
	struct fwd_data_conveyor cv;

	cv.cursor = NULL;
	cv.head   = NULL;

	ucix_for_each_section_type(uci, "firewall", "include",
		(void *)fwd_read_includes_cb, &cv);

	return cv.cursor;
}


/*
 * config interface
 */
static void fwd_read_network_data(
	struct uci_context *uci, struct fwd_network *net
) {
	struct fwd_network *e;
	const char *type, *ifname;

	for( e = net; e; e = e->next )
	{
		if( (type = ucix_get_option(uci, "network", e->name, NULL)) != NULL )
		{
			if( !(ifname = ucix_get_option(uci, "network", e->name, "ifname")) )
				fwd_read_error(
					"section '%s' is missing 'ifname' option!",
					e->name
				);

			e->isalias = (strcmp(type, "alias") ? 0 : 1);
			e->ifname  = strdup(ifname);
		}
	}
}

static void fwd_read_networks(
	struct uci_context *uci, struct fwd_data *zones
) {
	struct fwd_data *e;

	for( e = zones; e; e = e->next )
		if( e->type == FWD_S_ZONE )
			fwd_read_network_data(uci, e->section.zone.networks);
}

static void fwd_free_networks(struct fwd_network *h)
{
	struct fwd_network *e = h;

	while( h != NULL )
	{
		e = h->next;

		fwd_free_ptr(h->name);
		fwd_free_ptr(h->ifname);
		fwd_free_ptr(h->addr);

		free(h);
		h = e;
	}

	e = h = NULL;
}

static struct fwd_cidr * fwd_alloc_cidr(struct fwd_cidr *addr)
{
	struct fwd_cidr *cidr;

	if( (cidr = fwd_alloc_ptr(struct fwd_cidr)) != NULL )
	{
		if( addr != NULL )
		{
			cidr->addr.s_addr = addr->addr.s_addr;
			cidr->prefix = addr->prefix;
		}

		return cidr;
	}

	return NULL;
}



struct fwd_data * fwd_read_config(struct fwd_handle *h)
{
	struct uci_context *ctx;
	struct fwd_data *defaults, *zones, *e;
	struct fwd_addr *addrs;
	struct fwd_network *net;
	struct fwd_zone *zone;

	if( (ctx = ucix_init("firewall")) != NULL )
	{
		if( !(defaults = fwd_read_defaults(ctx)) )
			goto error;

		if( !(zones = fwd_read_zones(ctx, defaults)) )
			goto error;

		fwd_append_config(defaults, zones);
		fwd_append_config(defaults, fwd_read_forwards(ctx, zones));
		fwd_append_config(defaults, fwd_read_redirects(ctx, zones));
		fwd_append_config(defaults, fwd_read_rules(ctx, zones));
		fwd_append_config(defaults, fwd_read_includes(ctx));

		ucix_cleanup(ctx);

		if( (ctx = ucix_init("network")) != NULL )
		{
			fwd_read_networks(ctx, zones);
			ucix_cleanup(ctx);

			if( !(addrs = fwd_get_addrs(h->rtnl_socket, AF_INET)) )
				goto error;

			for( e = zones; e && (zone = &e->section.zone); e = e->next )
			{
				if( e->type != FWD_S_ZONE )
					break;

				for( net = zone->networks; net; net = net->next )
				{
					net->addr = fwd_alloc_cidr(
						fwd_lookup_addr(addrs, net->ifname)
					);
				}
			}

			fwd_free_addrs(addrs);
			return defaults;
		}
	}

	error:
	if( ctx ) ucix_cleanup(ctx);
	fwd_free_config(defaults);
	fwd_free_config(zones);
	return NULL;	
}


void fwd_free_config(struct fwd_data *h)
{
	struct fwd_data *e = h;

	while( h != NULL )
	{
		e = h->next;

		switch(h->type)
		{
			case FWD_S_INCLUDE:
				fwd_free_ptr(h->section.include.path);
				break;

			case FWD_S_ZONE:
				fwd_free_ptr(h->section.zone.name);
				fwd_free_networks(h->section.zone.networks);
				fwd_free_config(h->section.zone.rules);
				fwd_free_config(h->section.zone.redirects);
				fwd_free_config(h->section.zone.forwardings);
				break;

			case FWD_S_REDIRECT:
				/* Clone rules share all pointers except proto.
                   Prevent a double-free here */          
				if( ! h->section.redirect.clone )
				{
					fwd_free_ptr(h->section.redirect.src_ip);
					fwd_free_ptr(h->section.redirect.src_mac);
					fwd_free_ptr(h->section.redirect.src_port);
					fwd_free_ptr(h->section.redirect.src_dport);
					fwd_free_ptr(h->section.redirect.dest_ip);
					fwd_free_ptr(h->section.redirect.dest_port);
				}
				fwd_free_ptr(h->section.redirect.proto);
				break;

			case FWD_S_RULE:
				/* Clone rules share all pointers except proto.
                   Prevent a double-free here */          
				if( ! h->section.rule.clone )
				{
					fwd_free_ptr(h->section.rule.src_ip);
					fwd_free_ptr(h->section.rule.src_mac);
					fwd_free_ptr(h->section.rule.src_port);
					fwd_free_ptr(h->section.rule.dest_ip);
					fwd_free_ptr(h->section.rule.dest_port);
					fwd_free_ptr(h->section.rule.icmp_type);
				}
				fwd_free_ptr(h->section.rule.proto);
				break;

			case FWD_S_DEFAULTS:
			case FWD_S_FORWARD:
				/* Make gcc happy */
				break;
		}

		fwd_free_ptr(h);
		h = e;
	}

	e = h = NULL;
}


struct fwd_zone *
fwd_lookup_zone(struct fwd_data *h, const char *n)
{
	struct fwd_data *e;

	if( n != NULL )
	{
		for( e = h; e; e = e->next )
		{
			if( (e->type = FWD_S_ZONE) && !strcmp(e->section.zone.name, n) )
				return &e->section.zone;
		}
	}

	return NULL;
}

