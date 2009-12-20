/*
 * fwd - OpenWrt firewall daemon - iptables rule set
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
#include "fwd_xtables.h"
#include "fwd_utils.h"


/* -P <chain> <policy> */
static void fwd_r_set_policy(
	struct iptc_handle *h, const char *chain, const char *policy
) {
	iptc_set_policy(chain, policy, NULL, h);
}

/* -N <chain> */
static void fwd_r_new_chain(struct iptc_handle *h, const char *chain)
{
	iptc_create_chain(chain, h);
}

/* -A <chain1> -j <chain2> */
static void fwd_r_jump_chain(
	struct iptc_handle *h, const char *chain1, const char *chain2
) {
	struct fwd_xt_rule *r;

	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		fwd_xt_get_target(r, chain2);
		fwd_xt_append_rule(r, chain1);
	}
}

/* -A <chain> -m state --state INVALID -j DROP */
static void fwd_r_drop_invalid(struct iptc_handle *h, const char *chain)
{
	struct fwd_xt_rule *r;
	struct xtables_match *m;

	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		if( (m = fwd_xt_get_match(r, "state")) != NULL )
		{
			fwd_xt_parse_match(r, m, "--state", "INVALID");
			fwd_xt_get_target(r, "DROP");
			fwd_xt_append_rule(r, chain);
		}
	}
}

/* -A <chain> -m state --state RELATED,ESTABLISHED -j ACCEPT */
static void fwd_r_accept_related(struct iptc_handle *h, const char *chain)
{
	struct fwd_xt_rule *r;
	struct xtables_match *m;

	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		if( (m = fwd_xt_get_match(r, "state")) != NULL )
		{
			fwd_xt_parse_match(r, m, "--state", "RELATED,ESTABLISHED");
			fwd_xt_get_target(r, "ACCEPT");
			fwd_xt_append_rule(r, chain);
		}
	}
}

/* -A INPUT -i lo -j ACCEPT; -A OUTPUT -o lo -j ACCEPT */
static void fwd_r_accept_lo(struct iptc_handle *h)
{
	struct fwd_network n;
	struct fwd_xt_rule *r;

	n.ifname = "lo";

	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		fwd_xt_parse_in(r, &n, 0);
		fwd_xt_get_target(r, "ACCEPT");
		fwd_xt_append_rule(r, "INPUT");
	}

	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		fwd_xt_parse_out(r, &n, 0);
		fwd_xt_get_target(r, "ACCEPT");
		fwd_xt_append_rule(r, "OUTPUT");
	}
}

/* build syn_flood chain and jump rule */
static void fwd_r_add_synflood(struct iptc_handle *h, struct fwd_defaults *def)
{
	struct fwd_proto p;
	struct fwd_xt_rule *r;
	struct xtables_match *m;
	char buf[32];

	/* -N syn_flood */
	fwd_r_new_chain(h, "syn_flood");

	/* return rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		/* -p tcp */
		p.type = FWD_PR_TCP;
		fwd_xt_parse_proto(r, &p, 0);

		/* -m tcp --syn */
		if( (m = fwd_xt_get_match(r, "tcp")) != NULL )
		{
			fwd_xt_parse_match(r, m, "--syn");
		}

		/* -m limit --limit x/second --limit-burst y */
		if( (m = fwd_xt_get_match(r, "limit")) != NULL )
		{
			sprintf(buf, "%i/second", def->syn_rate);
			fwd_xt_parse_match(r, m, "--limit", buf);

			sprintf(buf, "%i", def->syn_burst);
			fwd_xt_parse_match(r, m, "--limit-burst", buf);
		}

		/* -j RETURN; -A syn_flood */
		fwd_xt_get_target(r, "RETURN");
		fwd_xt_append_rule(r, "syn_flood");
	}

	/* drop rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{	
		/* -j DROP; -A syn_flood */
		fwd_xt_get_target(r, "DROP");
		fwd_xt_append_rule(r, "syn_flood");
	}

	/* jump to syn_flood rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{	
		/* -p tcp */
		p.type = FWD_PR_TCP;
		fwd_xt_parse_proto(r, &p, 0);

		/* -m tcp --syn */
		if( (m = fwd_xt_get_match(r, "tcp")) != NULL )
		{
			fwd_xt_parse_match(r, m, "--syn");
		}

		/* -j syn_flood; -A INPUT */
		fwd_xt_get_target(r, "syn_flood");
		fwd_xt_append_rule(r, "INPUT");
	}
}

/* build reject target chain */
static void fwd_r_handle_reject(struct iptc_handle *h)
{
	struct fwd_proto p;
	struct fwd_xt_rule *r;
	struct xtables_target *t;

	/* -N handle_reject */
	fwd_r_new_chain(h, "handle_reject");

	/* tcp reject rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		/* -p tcp */
		p.type = FWD_PR_TCP;
		fwd_xt_parse_proto(r, &p, 0);

		/* -j REJECT --reject-with tcp-reset */
		if( (t = fwd_xt_get_target(r, "REJECT")) != NULL )
		{
			fwd_xt_parse_target(r, t, "--reject-with", "tcp-reset");
		}

		/* -A handle_reject */
		fwd_xt_append_rule(r, "handle_reject");
	}

	/* common reject rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		/* -j REJECT --reject-with icmp-port-unreachable */
		if( (t = fwd_xt_get_target(r, "REJECT")) != NULL )
		{
			fwd_xt_parse_target(r, t, "--reject-with",
				"icmp-port-unreachable");
		}

		/* -A handle_reject */
		fwd_xt_append_rule(r, "handle_reject");
	}
}

/* build drop target chain */
static void fwd_r_handle_drop(struct iptc_handle *h)
{
	struct fwd_xt_rule *r;

	/* -N handle_drop */
	fwd_r_new_chain(h, "handle_drop");

	/* common drop rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		/* -j DROP; -A handle_drop */
		fwd_xt_get_target(r, "DROP");
		fwd_xt_append_rule(r, "handle_drop");
	}
}

/* build accept target chain */
static void fwd_r_handle_accept(struct iptc_handle *h)
{
	struct fwd_xt_rule *r;

	/* -N handle_accept */
	fwd_r_new_chain(h, "handle_accept");

	/* common accept rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		/* -j ACCEPT; -A handle_accept */
		fwd_xt_get_target(r, "ACCEPT");
		fwd_xt_append_rule(r, "handle_accept");
	}
}

/* add comment match */
static void fwd_r_add_comment(
	struct fwd_xt_rule *r, const char *t, struct fwd_zone *z,
	struct fwd_network *n
) {
	struct xtables_match *m;
	char buf[256];

	if( (m = fwd_xt_get_match(r, "comment")) != NULL )
	{
		snprintf(buf, sizeof(buf), "%s:net=%s zone=%s", t, n->name, z->name);
		fwd_xt_parse_match(r, m, "--comment", buf);
	}
}

/* add --sport (if applicable) */
static void fwd_r_add_sport(
	struct fwd_xt_rule *r, struct fwd_portrange *p
) {
	int proto = r->entry->ip.proto;
	char buf[12];
	struct xtables_match *m;

	/* have portrange and proto is tcp or udp ... */
	if( (p != NULL) && ((proto == 6) || (proto == 17)) )
	{
		/* get match ... */
		if( (m = fwd_xt_get_match(r, (proto == 6) ? "tcp" : "udp")) != NULL )
		{
			snprintf(buf, sizeof(buf), "%u:%u", p->min, p->max);
			fwd_xt_parse_match(r, m, "--sport", buf);
		}
	}
}

/* add --dport (if applicable) */
static void fwd_r_add_dport(
	struct fwd_xt_rule *r, struct fwd_portrange *p
) {
	int proto = r->entry->ip.proto;
	char buf[12];
	struct xtables_match *m;

	/* have portrange and proto is tcp or udp ... */
	if( (p != NULL) && ((proto == 6) || (proto == 17)) )
	{
		/* get match ... */
		if( (m = fwd_xt_get_match(r, (proto == 6) ? "tcp" : "udp")) != NULL )
		{
			snprintf(buf, sizeof(buf), "%u:%u", p->min, p->max);
			fwd_xt_parse_match(r, m, "--dport", buf);
		}
	}
}

/* add --icmp-type (of applicable) */
static void fwd_r_add_icmptype(
	struct fwd_xt_rule *r, struct fwd_icmptype *i
) {
	int proto = r->entry->ip.proto;
	struct xtables_match *m;
	char buf[32];

	/* have icmp-type and proto is icmp ... */
	if( (i != NULL) && (proto == 1) )
	{
		/* get match ... */
		if( (m = fwd_xt_get_match(r, "icmp")) != NULL )
		{
			if( i->name[0] )
				snprintf(buf, sizeof(buf), "%s", i->name);
			else
				snprintf(buf, sizeof(buf), "%u/%u", i->type, i->code);

			fwd_xt_parse_match(r, m, "--icmp-type", buf);
		}
	}
}

/* add -m mac --mac-source ... */
static void fwd_r_add_srcmac(
	struct fwd_xt_rule *r, struct fwd_mac *mac
) {
	struct xtables_match *m;
	char buf[18];

	if( mac != NULL )
	{
		if( (m = fwd_xt_get_match(r, "mac")) != NULL )
		{
			snprintf(buf, sizeof(buf), "%02x:%02x:%02x:%02x:%02x:%02x",
				mac->mac[0], mac->mac[1], mac->mac[2],
				mac->mac[3], mac->mac[4], mac->mac[5]);

			fwd_xt_parse_match(r, m, "--mac-source", buf);
		}
	}
}

/* add policy target */
static void fwd_r_add_policytarget(
	struct fwd_xt_rule *r, enum fwd_policy pol
) {
	switch(pol)
	{
		case FWD_P_ACCEPT:
			fwd_xt_get_target(r, "handle_accept");
			break;

		case FWD_P_REJECT:
			fwd_xt_get_target(r, "handle_reject");
			break;

		case FWD_P_DROP:
		case FWD_P_UNSPEC:
			fwd_xt_get_target(r, "handle_drop");
			break;
	}
}

/* add dnat target */
static void fwd_r_add_dnattarget(
	struct fwd_xt_rule *r, struct fwd_cidr *c, struct fwd_portrange *p
) {
	struct xtables_target *t;
	char buf[32];

	if( c != NULL )
	{
		if( (t = fwd_xt_get_target(r, "DNAT")) != NULL )
		{
			if( p != NULL )
				snprintf(buf, sizeof(buf), "%s:%u-%u",
					inet_ntoa(c->addr), p->min, p->max);
			else
				snprintf(buf, sizeof(buf), "%s", inet_ntoa(c->addr));

			fwd_xt_parse_target(r, t, "--to-destination", buf);
		}
	}
}

/* parse comment string and look for match */
static int fwd_r_cmp(const char *what, const char *cmt, const char *cmp)
{
	char *match;

	if( (match = strstr(cmt, what)) == NULL )
		return 0;

	match += strlen(what);

	if( strncmp(match, cmp, strlen(cmp)) != 0 )
		return 0;

	if( (match[strlen(cmp)] != ' ') && (match[strlen(cmp)] != '\0') )
		return 0;

	return 1;
}


static void fwd_ipt_defaults_create(struct fwd_data *d)
{
	struct fwd_defaults *def = &d->section.defaults;
	struct iptc_handle *h_filter, *h_nat;

	if( !(h_filter = iptc_init("filter")) || !(h_nat = iptc_init("nat")) )
		fwd_fatal("Unable to obtain libiptc handle");

	/* policies */
	fwd_r_set_policy(h_filter, "INPUT",
		def->input == FWD_P_ACCEPT ? "ACCEPT" : "DROP");
	fwd_r_set_policy(h_filter, "OUTPUT",
		def->output == FWD_P_ACCEPT ? "ACCEPT" : "DROP");
	fwd_r_set_policy(h_filter, "FORWARD",
		def->forward == FWD_P_ACCEPT ? "ACCEPT" : "DROP");

	/* invalid state drop */
	if( def->drop_invalid )
	{
		fwd_r_drop_invalid(h_filter, "INPUT");
		fwd_r_drop_invalid(h_filter, "OUTPUT");
		fwd_r_drop_invalid(h_filter, "FORWARD");
	}

	/* default accept related */
	fwd_r_accept_related(h_filter, "INPUT");
	fwd_r_accept_related(h_filter, "OUTPUT");
	fwd_r_accept_related(h_filter, "FORWARD");

	/* default accept on lo */
	fwd_r_accept_lo(h_filter);

	/* syn flood protection */
	if( def->syn_flood )
	{
		fwd_r_add_synflood(h_filter, def);
	}

	/* rule container chains */
	fwd_r_new_chain(h_filter, "mssfix");
	fwd_r_new_chain(h_filter, "zones");
	fwd_r_new_chain(h_filter, "rules");
	fwd_r_new_chain(h_filter, "redirects");
	fwd_r_new_chain(h_filter, "forwardings");
	fwd_r_jump_chain(h_filter, "INPUT", "rules");
	fwd_r_jump_chain(h_filter, "FORWARD", "mssfix");
	fwd_r_jump_chain(h_filter, "FORWARD", "zones");
	fwd_r_jump_chain(h_filter, "FORWARD", "rules");
	fwd_r_jump_chain(h_filter, "FORWARD", "redirects");
	fwd_r_jump_chain(h_filter, "FORWARD", "forwardings");
	fwd_r_new_chain(h_nat, "zonemasq");
	fwd_r_new_chain(h_nat, "redirects");
	fwd_r_new_chain(h_nat, "loopback");
	fwd_r_jump_chain(h_nat, "POSTROUTING", "zonemasq");
	fwd_r_jump_chain(h_nat, "PREROUTING", "redirects");
	fwd_r_jump_chain(h_nat, "POSTROUTING", "loopback");

	/* standard drop, accept, reject chain */
	fwd_r_handle_drop(h_filter);
	fwd_r_handle_accept(h_filter);
	fwd_r_handle_reject(h_filter);


	if( !iptc_commit(h_nat) )
		fwd_fatal("Cannot commit nat table: %s", iptc_strerror(errno));

	if( !iptc_commit(h_filter) )
		fwd_fatal("Cannot commit filter table: %s", iptc_strerror(errno));

	iptc_free(h_nat);
	iptc_free(h_filter);
}


void fwd_ipt_build_ruleset(struct fwd_handle *h)
{
	struct fwd_data *e;

	fwd_xt_init();

	for( e = h->conf; e; e = e->next )
	{
		switch(e->type)
		{
			case FWD_S_DEFAULTS:
				fwd_log_info("Loading defaults");
				fwd_ipt_defaults_create(e);
				break;

			case FWD_S_INCLUDE:
				fwd_log_info("Loading include: %s",
					e->section.include.path);
				break;

			case FWD_S_ZONE:
			case FWD_S_FORWARD:
			case FWD_S_REDIRECT:
			case FWD_S_RULE:
				/* Make gcc happy */
				break;
		}
	}
}


static struct fwd_zone *
fwd_lookup_zone(struct fwd_handle *h, const char *net)
{
	struct fwd_data *e;
	struct fwd_network *n;

	for( e = h->conf; e; e = e->next )
		if( e->type == FWD_S_ZONE )
			for( n = e->section.zone.networks; n; n = n->next )
				if( !strcmp(n->name, net) )
					return &e->section.zone;

	return NULL;
}

static struct fwd_network *
fwd_lookup_network(struct fwd_zone *z, const char *net)
{
	struct fwd_network *n;

	for( n = z->networks; n; n = n->next )
		if( !strcmp(n->name, net) )
			return n;

	return NULL;
}

void fwd_ipt_addif(struct fwd_handle *h, const char *net)
{
	struct fwd_data *e;
	struct fwd_zone *z;
	struct fwd_rule *c;
	struct fwd_redirect *r;
	struct fwd_forwarding *f;
	struct fwd_cidr *a, *a2;
	struct fwd_network *n, *n2;
	struct fwd_proto p;

	struct fwd_xt_rule *x;
	struct xtables_match *m;
	struct xtables_target *t;

	struct iptc_handle *h_filter, *h_nat;

	if( !(h_filter = iptc_init("filter")) || !(h_nat = iptc_init("nat")) )
		fwd_fatal("Unable to obtain libiptc handle");


	if( !(z = fwd_lookup_zone(h, net)) )
		return;

	if( !(n = fwd_lookup_network(z, net)) )
		return;

	if( !(a = n->addr) || fwd_empty_cidr(a) )
		return;


	fwd_log_info("Adding network %s (interface %s)",
		n->name, n->ifname);

	/* Build masquerading rule */
	if( z->masq )
	{
		if( (x = fwd_xt_init_rule(h_nat)) != NULL )
		{
			fwd_xt_parse_out(x, n, 0);				/* -o ... */
			fwd_xt_get_target(x, "MASQUERADE");		/* -j MASQUERADE */
			fwd_r_add_comment(x, "masq", z, n);		/* -m comment ... */
			fwd_xt_append_rule(x, "zonemasq");		/* -A zonemasq */
		}
	}

	/* Build MSS fix rule */
	if( z->mtu_fix )
	{
		if( (x = fwd_xt_init_rule(h_filter)) != NULL )
		{
			p.type = FWD_PR_TCP;
			fwd_xt_parse_out(x, n, 0);					/* -o ... */
			fwd_xt_parse_proto(x, &p, 0);				/* -p tcp */

			/* -m tcp --tcp-flags SYN,RST SYN */
			if( (m = fwd_xt_get_match(x, "tcp")) != NULL )
				fwd_xt_parse_match(x, m, "--tcp-flags", "SYN,RST", "SYN");

			/* -j TCPMSS --clamp-mss-to-pmtu */
			if( (t = fwd_xt_get_target(x, "TCPMSS")) != NULL )
				fwd_xt_parse_target(x, t, "--clamp-mss-to-pmtu");

			/* -m comment ... */
			fwd_r_add_comment(x, "mssfix", z, n);

			/* -A mssfix */
			fwd_xt_append_rule(x, "mssfix");
		}
	}

	/* Build intra-zone forwarding rules */
	for( n2 = z->networks; n2; n2 = n2->next )
	{
		if( (a2 = n2->addr) != NULL )
		{
			if( (x = fwd_xt_init_rule(h_filter)) != NULL )
			{
				fwd_xt_parse_in(x, n, 0);				/* -i ... */
				fwd_xt_parse_out(x, n2, 0);				/* -o ... */
				fwd_r_add_policytarget(x, z->forward);	/* -j handle_... */
				fwd_r_add_comment(x, "zone", z, n);		/* -m comment ... */
				fwd_xt_append_rule(x, "zones");			/* -A zones */
			}
		}
	}

	/* Build inter-zone forwarding rules */
	for( e = z->forwardings; e && (f = &e->section.forwarding); e = e->next )
	{
		for( n2 = f->dest->networks; n2; n2 = n2->next )
		{
			/* Build forwarding rule */
			if( (x = fwd_xt_init_rule(h_filter)) != NULL )
			{
				fwd_xt_parse_in(x, n, 0);					/* -i ... */
				fwd_xt_parse_out(x, n2, 0);					/* -o ... */
				fwd_r_add_policytarget(x, FWD_P_ACCEPT);	/* -j handle_... */
				fwd_r_add_comment(x, "forward", z, n);		/* -m comment ... */
				fwd_xt_append_rule(x, "forwardings");		/* -A forwardings */
			}
		}
	}

	/* Build DNAT rules */
	for( e = z->redirects; e && (r = &e->section.redirect); e = e->next )
	{
		/* DNAT */
		if( (x = fwd_xt_init_rule(h_nat)) != NULL )
		{
			fwd_xt_parse_in(x, n, 0);					/* -i ... */
			fwd_xt_parse_src(x, r->src_ip, 0);			/* -s ... */
			fwd_xt_parse_dest(x, a, 0);					/* -d ... */
			fwd_xt_parse_proto(x, r->proto, 0);			/* -p ... */
			fwd_r_add_sport(x, r->src_port);			/* --sport ... */
			fwd_r_add_dport(x, r->src_dport);			/* --dport ... */
			fwd_r_add_srcmac(x, r->src_mac);			/* -m mac --mac-source ... */
			fwd_r_add_dnattarget(x, r->dest_ip, r->dest_port);	/* -j DNAT ... */
			fwd_r_add_comment(x, "redir", z, n);		/* -m comment ... */
			fwd_xt_append_rule(x, "redirects");			/* -A redirects */
		}

		/* Forward */
		if( (x = fwd_xt_init_rule(h_filter)) != NULL )
		{
			fwd_xt_parse_in(x, n, 0);					/* -i ... */
			fwd_xt_parse_src(x, r->src_ip, 0);			/* -s ... */
			fwd_xt_parse_dest(x, r->dest_ip, 0);		/* -d ... */
			fwd_xt_parse_proto(x, r->proto, 0);			/* -p ... */
			fwd_r_add_srcmac(x, r->src_mac);			/* -m mac --mac-source ... */
			fwd_r_add_sport(x, r->src_port);			/* --sport ... */
			fwd_r_add_dport(x, r->dest_port);			/* --dport ... */
			fwd_r_add_policytarget(x, FWD_P_ACCEPT);	/* -j handle_accept */
			fwd_r_add_comment(x, "redir", z, n);		/* -m comment ... */
			fwd_xt_append_rule(x, "redirects");			/* -A redirects */
		}

		/* Add loopback rule if neither src_ip nor src_mac are defined */
		if( !r->src_ip && !r->src_mac )
		{
			if( (x = fwd_xt_init_rule(h_nat)) != NULL )
			{
				fwd_xt_parse_in(x, n, 1);				/* -i ! ... */
				fwd_xt_parse_dest(x, r->dest_ip, 0);	/* -d ... */
				fwd_xt_parse_proto(x, r->proto, 0);		/* -p ... */
				fwd_r_add_sport(x, r->src_port);		/* --sport ... */
				fwd_r_add_dport(x, r->src_dport);		/* --dport ... */
				fwd_xt_get_target(x, "MASQUERADE");		/* -j MASQUERADE */
				fwd_r_add_comment(x, "redir", z, n);	/* -m comment ... */
				fwd_xt_append_rule(x, "loopback");		/* -A loopback */
			}
		}
	}

	/* Build rules */
	for( e = z->rules; e && (c = &e->section.rule); e = e->next )
	{
		/* Has destination, add forward rule for each network in target zone */
		if( c->dest )
		{
			for( n2 = c->dest->networks; n2; n2 = n2->next )
			{
				if( (x = fwd_xt_init_rule(h_filter)) != NULL )
				{
					fwd_xt_parse_in(x, n, 0);				/* -i ... */
					fwd_xt_parse_out(x, n2, 0);				/* -o ... */
					fwd_xt_parse_src(x, c->src_ip, 0);		/* -s ... */
					fwd_xt_parse_dest(x, c->dest_ip, 0);	/* -d ... */
					fwd_xt_parse_proto(x, c->proto, 0);		/* -p ... */
					fwd_r_add_icmptype(x, c->icmp_type);	/* --icmp-type ... */
					fwd_r_add_srcmac(x, c->src_mac);		/* --mac-source ... */
					fwd_r_add_sport(x, c->src_port);		/* --sport ... */
					fwd_r_add_dport(x, c->dest_port);		/* --dport ... */
					fwd_r_add_policytarget(x, c->target);	/* -j handle_... */
					fwd_r_add_comment(x, "rule", z, n);		/* -m comment ... */
					fwd_xt_append_rule(x, "rules");			/* -A rules */
				}
			}
		}

		/* No destination specified, treat it as input rule */
		else
		{
			if( (x = fwd_xt_init_rule(h_filter)) != NULL )
			{
				fwd_xt_parse_in(x, n, 0);				/* -i ... */
				fwd_xt_parse_src(x, c->src_ip, 0);		/* -s ... */
				fwd_xt_parse_dest(x, c->dest_ip, 0);	/* -d ... */
				fwd_xt_parse_proto(x, c->proto, 0);		/* -p ... */
				fwd_r_add_icmptype(x, c->icmp_type);	/* --icmp-type ... */
				fwd_r_add_srcmac(x, c->src_mac);		/* --mac-source ... */
				fwd_r_add_sport(x, c->src_port);		/* --sport ... */
				fwd_r_add_dport(x, c->dest_port);		/* --dport ... */
				fwd_r_add_policytarget(x, c->target);	/* -j handle_... */
				fwd_r_add_comment(x, "rule", z, n);		/* -m comment ... */
				fwd_xt_append_rule(x, "rules");			/* -A rules */
			}
		}
	}

	if( !iptc_commit(h_nat) )
		fwd_fatal("Cannot commit nat table: %s", iptc_strerror(errno));

	if( !iptc_commit(h_filter) )
		fwd_fatal("Cannot commit filter table: %s", iptc_strerror(errno));

	iptc_free(h_nat);
	iptc_free(h_filter);
}


static void fwd_ipt_delif_table(struct iptc_handle *h, const char *net)
{
	const struct xt_entry_match *m;
	const struct ipt_entry *e;
	const char *chain, *comment;
	size_t off = 0, num = 0;

	/* iterate chains */
	for( chain = iptc_first_chain(h); chain;
	     chain = iptc_next_chain(h)
	) {
		/* iterate rules */
		for( e = iptc_first_rule(chain, h), num = 0; e;
		     e = iptc_next_rule(e, h), num++
		) {
			repeat_rule:

			/* skip entries w/o matches */
			if( ! e->target_offset )
				continue;

			/* iterate matches */
			for( off = sizeof(struct ipt_entry);
			     off < e->target_offset;
			     off += m->u.match_size
			) {
				m = (void *)e + off;

				/* yay */
				if( ! strcmp(m->u.user.name, "comment") )
				{
					/* better use struct_xt_comment_info but well... */
					comment = (void *)m + sizeof(struct xt_entry_match);

					if( fwd_r_cmp("net=", comment, net) )
					{
						e = iptc_next_rule(e, h);
						iptc_delete_num_entry(chain, num, h);

						if( e != NULL )
							goto repeat_rule;
						else
							break;
					}
				}
			}
		}
	}
}

void fwd_ipt_delif(struct fwd_handle *h, const char *net)
{
	struct iptc_handle *h_filter, *h_nat;

	if( !(h_filter = iptc_init("filter")) || !(h_nat = iptc_init("nat")) )
		fwd_fatal("Unable to obtain libiptc handle");


	fwd_log_info("Removing network %s", net);

	/* delete network related rules */
	fwd_ipt_delif_table(h_nat, net);
	fwd_ipt_delif_table(h_filter, net);


	if( !iptc_commit(h_nat) )
		fwd_fatal("Cannot commit nat table: %s", iptc_strerror(errno));

	if( !iptc_commit(h_filter) )
		fwd_fatal("Cannot commit filter table: %s", iptc_strerror(errno));

	iptc_free(h_nat);
	iptc_free(h_filter);
}

void fwd_ipt_chgif(struct fwd_handle *h, const char *net)
{
	/* XXX: should alter rules in-place, tbd */
	fwd_ipt_delif(h, net);
	fwd_ipt_addif(h, net);
}


static void fwd_ipt_clear_ruleset_table(struct iptc_handle *h)
{
	const char *chain;

	/* pass 1: flush all chains */
	for( chain = iptc_first_chain(h); chain;
	     chain = iptc_next_chain(h)
	) {
		iptc_flush_entries(chain, h);
	}

	/* pass 2: remove user defined chains */
	for( chain = iptc_first_chain(h); chain;
	     chain = iptc_next_chain(h)
	) {
		if( ! iptc_builtin(chain, h) )
			iptc_delete_chain(chain, h);
	}
}

void fwd_ipt_clear_ruleset(struct fwd_handle *h)
{
	struct iptc_handle *h_filter, *h_nat;

	if( !(h_filter = iptc_init("filter")) || !(h_nat = iptc_init("nat")) )
		fwd_fatal("Unable to obtain libiptc handle");

	/* flush tables */
	fwd_ipt_clear_ruleset_table(h_nat);
	fwd_ipt_clear_ruleset_table(h_filter);

	/* revert policies */
	fwd_r_set_policy(h_filter, "INPUT", "ACCEPT");
	fwd_r_set_policy(h_filter, "OUTPUT", "ACCEPT");
	fwd_r_set_policy(h_filter, "FORWARD", "ACCEPT");	


	if( !iptc_commit(h_nat) )
		fwd_fatal("Cannot commit nat table: %s", iptc_strerror(errno));

	if( !iptc_commit(h_filter) )
		fwd_fatal("Cannot commit filter table: %s", iptc_strerror(errno));

	iptc_free(h_nat);
	iptc_free(h_filter);
}

