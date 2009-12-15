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

static void
fwd_ipt_rule_append(struct fwd_ipt_rulebuf *r, const char *fmt, ...)
{
	int len = 0;
	char buf[256]; buf[0] = 0;

	va_list ap;
	va_start(ap, fmt);
	len = vsnprintf(buf, sizeof(buf), fmt, ap);
	va_end(ap);	

	if( len > 0 )
	{
		r->buf = realloc(r->buf, r->len + len + 1);
		memcpy(&r->buf[r->len], buf, len);
		r->buf[r->len + len] = 0;
		r->len += len;
	}
}

static struct fwd_ipt_rulebuf * fwd_ipt_init(const char *table)
{
	struct fwd_ipt_rulebuf *r;

	if( (r = fwd_alloc_ptr(struct fwd_ipt_rulebuf)) != NULL )
	{
		fwd_ipt_rule_append(r, IPT " -t %s", table);
		return r;
	}

	return NULL;
}

static void fwd_ipt_add_srcport(
	struct fwd_ipt_rulebuf *r, struct fwd_portrange *p
) {
	if( p != NULL )
	{
		if( p->min < p->max )
			fwd_ipt_rule_append(r, " --sport %u:%u", p->min, p->max);
		else
			fwd_ipt_rule_append(r, " --sport %u", p->min);
	}
}

static void fwd_ipt_add_destport(
	struct fwd_ipt_rulebuf *r, struct fwd_portrange *p
) {
	if( p != NULL )
	{
		if( p->min < p->max )
			fwd_ipt_rule_append(r, " --dport %u:%u", p->min, p->max);
		else
			fwd_ipt_rule_append(r, " --dport %u", p->min);
	}
}

static void fwd_ipt_add_proto(
	struct fwd_ipt_rulebuf *r, struct fwd_proto *p
) {
	if( p != NULL )
	{
		switch( p->type )
		{
			case FWD_PR_TCPUDP:
				fwd_ipt_rule_append(r, " -p tcp -p udp");
				break;

			case FWD_PR_TCP:
				fwd_ipt_rule_append(r, " -p tcp");
				break;

			case FWD_PR_UDP:
				fwd_ipt_rule_append(r, " -p udp");
				break;

			case FWD_PR_ICMP:
				fwd_ipt_rule_append(r, " -p icmp");
				break;

			case FWD_PR_ALL:
				fwd_ipt_rule_append(r, " -p all");
				break;

			case FWD_PR_CUSTOM:
				fwd_ipt_rule_append(r, " -p %u", p->proto);
				break;
		}
	}
}

static void fwd_ipt_add_srcaddr(
	struct fwd_ipt_rulebuf *r, struct fwd_cidr *c
) {
	if( c != NULL )
	{
		if( c->prefix < 32 )
			fwd_ipt_rule_append(r, " -s %s/%u",
				inet_ntoa(c->addr), c->prefix);
		else
			fwd_ipt_rule_append(r, " -s %s", inet_ntoa(c->addr));
	}
}

static void fwd_ipt_add_destaddr(
	struct fwd_ipt_rulebuf *r, struct fwd_cidr *c
) {
	if( c != NULL )
	{
		if( c->prefix < 32 )
			fwd_ipt_rule_append(r, " -d %s/%u",
				inet_ntoa(c->addr), c->prefix);
		else
			fwd_ipt_rule_append(r, " -d %s", inet_ntoa(c->addr));
	}
}

static void fwd_ipt_add_srcmac(
	struct fwd_ipt_rulebuf *r, struct fwd_mac *m
) {
	if( m != NULL )
	{
		fwd_ipt_rule_append(r,
			" -m mac --mac-source %02x:%02x:%02x:%02x:%02x:%02x",
			m->mac[0], m->mac[1], m->mac[2],
			m->mac[3], m->mac[4], m->mac[5]);
	}
}

static void fwd_ipt_add_icmptype(
	struct fwd_ipt_rulebuf *r, struct fwd_icmptype *i
) {
	if( i != NULL )
	{
		if( i->name )
			fwd_ipt_rule_append(r, " --icmp-type %s", i->name);
		else if( i->code > -1 )
			fwd_ipt_rule_append(r, " --icmp-type %u/%u", i->type, i->code);
		else
			fwd_ipt_rule_append(r, " --icmp-type %u", i->type);
	}
}

static void fwd_ipt_add_dnat_target(
	struct fwd_ipt_rulebuf *r, struct fwd_cidr *c, struct fwd_portrange *p
) {
	if( c != NULL )
	{
		fwd_ipt_rule_append(r, " -j DNAT --to-destination %s",
			inet_ntoa(c->addr));

		if( (p != NULL) && (p->min < p->max) )
			fwd_ipt_rule_append(r, ":%u-%u", p->min, p->max);
		else if( p != NULL )
			fwd_ipt_rule_append(r, ":%u", p->min);
	}
}

static void fwd_ipt_add_policy_target(
	struct fwd_ipt_rulebuf *r, enum fwd_policy p
) {
	fwd_ipt_rule_append(r, " -j %s",
		(p == FWD_P_ACCEPT)
			? "handle_accept"
			: (p == FWD_P_REJECT)
				? "handle_reject"
				: "handle_drop"
	);
}

static void fwd_ipt_add_comment(
	struct fwd_ipt_rulebuf *r, const char *t, struct fwd_zone *z,
	struct fwd_network_list *n, struct fwd_network_list *n2
) {
	if( (n != NULL) && (n2 != NULL) )
		fwd_ipt_add_format(r, " -m comment --comment '%s:%s src:%s dest:%s'",
			t, z->name, n->name, n2->name);
	else if( (n == NULL) && (n2 != NULL) )
		fwd_ipt_add_format(r, " -m comment --comment '%s:%s dest:%s'",
			t, z->name, n2->name);
	else
		fwd_ipt_add_format(r, " -m comment --comment '%s:%s src:%s'",
			t, z->name, n->name);
}

static void fwd_ipt_exec(struct fwd_ipt_rulebuf *r)
{
	if( r->len )
		printf("%s\n", r->buf);

	fwd_free_ptr(r->buf);
	fwd_free_ptr(r);
}

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
		fwd_xt_exec_rule(r, chain1);
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
			fwd_xt_parse_match(r, m, "--state", "INVALID", 0);
			fwd_xt_get_target(r, "DROP");
			fwd_xt_exec_rule(r, chain);
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
			fwd_xt_parse_match(r, m, "--state", "RELATED,ESTABLISHED", 0);
			fwd_xt_get_target(r, "ACCEPT");
			fwd_xt_exec_rule(r, chain);
		}
	}
}

/* -A INPUT -i lo -j ACCEPT; -A OUTPUT -o lo -j ACCEPT */
static void fwd_r_accept_lo(struct iptc_handle *h)
{
	struct fwd_network_list n;
	struct fwd_xt_rule *r;

	n.ifname = "lo";

	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		fwd_xt_parse_in(r, &n, 0);
		fwd_xt_get_target(r, "ACCEPT");
		fwd_xt_exec_rule(r, "INPUT");
	}

	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		fwd_xt_parse_out(r, &n, 0);
		fwd_xt_get_target(r, "ACCEPT");
		fwd_xt_exec_rule(r, "OUTPUT");
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
			fwd_xt_parse_match(r, m, "--syn", NULL, 0);
		}

		/* -m limit --limit x/second --limit-burst y */
		if( (m = fwd_xt_get_match(r, "limit")) != NULL )
		{
			sprintf(buf, "%i/second", def->syn_rate);
			fwd_xt_parse_match(r, m, "--limit", buf, 0);

			sprintf(buf, "%i", def->syn_burst);
			fwd_xt_parse_match(r, m, "--limit-burst", buf, 0);
		}

		/* -j RETURN; -A syn_flood */
		fwd_xt_get_target(r, "RETURN");
		fwd_xt_exec_rule(r, "syn_flood");
	}

	/* drop rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{	
		/* -j DROP; -A syn_flood */
		fwd_xt_get_target(r, "DROP");
		fwd_xt_exec_rule(r, "syn_flood");
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
			fwd_xt_parse_match(r, m, "--syn", NULL, 0);
		}

		/* -j syn_flood; -A INPUT */
		fwd_xt_get_target(r, "syn_flood");
		fwd_xt_exec_rule(r, "INPUT");
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
			fwd_xt_parse_target(r, t, "--reject-with", "tcp-reset", 0);
		}

		/* -A handle_reject */
		fwd_xt_exec_rule(r, "handle_reject");
	}

	/* common reject rule */
	if( (r = fwd_xt_init_rule(h)) != NULL )
	{
		/* -j REJECT --reject-with icmp-port-unreachable */
		if( (t = fwd_xt_get_target(r, "REJECT")) != NULL )
		{
			fwd_xt_parse_target(r, t, "--reject-with",
				"icmp-port-unreachable", 0);
		}

		/* -A handle_reject */
		fwd_xt_exec_rule(r, "handle_reject");
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
		/* -j DROP; -A handle_reject */
		fwd_xt_get_target(r, "DROP");
		fwd_xt_exec_rule(r, "handle_reject");
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
		fwd_xt_exec_rule(r, "handle_accept");
	}
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
	fwd_r_jump_chain(h_nat, "POSTROUTING", "zonemasq");
	fwd_r_jump_chain(h_nat, "PREROUTING", "redirects");
	fwd_r_jump_chain(h_nat, "POSTROUTING", "redirects");

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
				printf("\n## DEFAULTS\n");
				fwd_ipt_defaults_create(e);
				break;

			case FWD_S_INCLUDE:
				printf("\n## INCLUDE %s\n", e->section.include.path);
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
	struct fwd_network_list *n;

	for( e = h->conf; e; e = e->next )
		if( e->type == FWD_S_ZONE )
			for( n = e->section.zone.networks; n; n = n->next )
				if( !strcmp(n->name, net) )
					return &e->section.zone;

	return NULL;
}

static struct fwd_network_list *
fwd_lookup_network(struct fwd_zone *z, const char *net)
{
	struct fwd_network_list *n;

	for( n = z->networks; n; n = n->next )
		if( !strcmp(n->name, net) )
			return n;

	return NULL;
}

static struct fwd_addr_list *
fwd_lookup_addr(struct fwd_handle *h, struct fwd_network_list *n)
{
	struct fwd_addr_list *a;

	if( n != NULL )
		for( a = h->addrs; a; a = a->next )
			if( !strcmp(a->ifname, n->ifname) )
				return a;

	return NULL;
}

void fwd_ipt_addif(struct fwd_handle *h, const char *net)
{
	struct fwd_data *e;
	struct fwd_zone *z;
	struct fwd_ipt_rulebuf *b;
	struct fwd_rule *c;
	struct fwd_redirect *r;
	struct fwd_forwarding *f;
	struct fwd_addr_list *a, *a2;
	struct fwd_network_list *n, *n2;

	if( !(z = fwd_lookup_zone(h, net)) )
		return;

	if( !(n = fwd_lookup_network(z, net)) )
		return;

	if( !(a = fwd_lookup_addr(h, n)) )
		return;

	printf("\n\n#\n# addif(%s)\n#\n", net);

	/* Build masquerading rule */
	if( z->masq )
	{
		printf("\n# Net %s (%s) - masq\n", n->name, n->ifname);

		b = fwd_ipt_init("nat");
		fwd_ipt_add_format(b, " -A zonemasq -o %s -j MASQUERADE", n->ifname);
		fwd_ipt_add_comment(b, "masq", z, NULL, n);
		fwd_ipt_exec(b);
	}

	/* Build MSS fix rule */
	if( z->mtu_fix )
	{
		printf("\n# Net %s (%s) - mtu_fix\n", n->name, n->ifname);

		b = fwd_ipt_init("filter");
		fwd_ipt_add_format(b,
			" -A mssfix -o %s -p tcp --tcp-flags SYN,RST SYN"
			" -j TCPMSS --clamp-mss-to-pmtu", n->ifname);
		fwd_ipt_add_comment(b, "mssfix", z, NULL, n);
		fwd_ipt_exec(b);
	}

	/* Build intra-zone forwarding rules */
	for( n2 = z->networks; n2; n2 = n2->next )
	{
		if( (a2 = fwd_lookup_addr(h, n2)) != NULL )
		{
			printf("\n# Net %s (%s) - intra-zone-forwarding"
			       " Z:%s N:%s I:%s -> Z:%s N:%s I:%s\n",
				n->name, n->ifname, z->name, n->name, n->ifname,
				z->name, n2->name, n2->ifname);

			b = fwd_ipt_init("filter");
			fwd_ipt_add_format(b, " -A zones -i %s -o %s",
				n->ifname, n2->ifname);
			fwd_ipt_add_policy_target(b, z->forward);
			fwd_ipt_add_comment(b, "zone", z, n, n2);
			fwd_ipt_exec(b);
		}
	}

	/* Build inter-zone forwarding rules */
	for( e = z->forwardings; e && (f = &e->section.forwarding); e = e->next )
	{
		for( n2 = f->dest->networks; n2; n2 = n2->next )
		{
			printf("\n# Net %s (%s) - inter-zone-forwarding"
                   " Z:%s N:%s I:%s -> Z:%s N:%s I:%s\n",
				n->name, n->ifname, z->name, n->name, n->ifname,
				f->dest->name, n2->name, n2->ifname);

			/* Build forwarding rule */
			b = fwd_ipt_init("filter");
			fwd_ipt_add_format(b, " -A forwardings -i %s -o %s",
				n->ifname, n2->ifname);
			fwd_ipt_add_policy_target(b, FWD_P_ACCEPT);
			fwd_ipt_add_comment(b, "forward", z, n, n2);
			fwd_ipt_exec(b);
		}
	}

	/* Build DNAT rules */
	for( e = z->redirects; e && (r = &e->section.redirect); e = e->next )
	{
		printf("\n# Net %s (%s) - redirect Z:%s N:%s I:%s\n",
			n->name, n->ifname, z->name, n->name, n->ifname);

		/* DNAT */
		b = fwd_ipt_init("nat");
		fwd_ipt_add_format(b, " -A redirects -i %s -d %s",
			n->ifname, inet_ntoa(a->ipaddr.v4));
		fwd_ipt_add_proto(b, r->proto);
		fwd_ipt_add_srcaddr(b, r->src_ip);
		fwd_ipt_add_srcport(b, r->src_port);
		fwd_ipt_add_destport(b, r->src_dport);
		fwd_ipt_add_srcmac(b, r->src_mac);
		fwd_ipt_add_dnat_target(b, r->dest_ip, r->dest_port);
		fwd_ipt_add_comment(b, "redir", z, n, NULL);
		fwd_ipt_exec(b);

		/* Forward */
		b = fwd_ipt_init("filter");
		fwd_ipt_add_format(b, " -A redirects -i %s", n->ifname);
		fwd_ipt_add_proto(b, r->proto);
		fwd_ipt_add_srcmac(b, r->src_mac);
		fwd_ipt_add_srcaddr(b, r->src_ip);
		fwd_ipt_add_srcport(b, r->src_port);
		fwd_ipt_add_destaddr(b, r->dest_ip);
		fwd_ipt_add_destport(b, r->dest_port);
		fwd_ipt_add_policy_target(b, FWD_P_ACCEPT);
		fwd_ipt_add_comment(b, "redir", z, n, NULL);
		fwd_ipt_exec(b);

		/* Add loopback rule if neither src_ip nor src_mac are defined */
		if( !r->src_ip && !r->src_mac )
		{
			b = fwd_ipt_init("nat");
			fwd_ipt_add_format(b, " -A redirects -i ! %s -d %s",
				n->ifname, inet_ntoa(r->dest_ip->addr));
			fwd_ipt_add_proto(b, r->proto);
			fwd_ipt_add_srcport(b, r->src_port);
			fwd_ipt_add_destport(b, r->src_dport);
			fwd_ipt_add_format(b, " -j MASQUERADE");
			fwd_ipt_add_comment(b, "redir", z, n, NULL);
			fwd_ipt_exec(b);
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
				printf("\n# Net %s (%s) - rule+dest"
		               " Z:%s N:%s I:%s -> Z:%s N:%s I:%s\n",
					n->name, n->ifname, z->name, n->name, n->ifname,
					f->dest->name, n2->name, n2->ifname);

				b = fwd_ipt_init("filter");
				fwd_ipt_add_format(b, " -A rules -i %s -o %s",
					n->ifname, n2->ifname);
				fwd_ipt_add_proto(b, c->proto);
				fwd_ipt_add_icmptype(b, c->icmp_type);
				fwd_ipt_add_srcmac(b, c->src_mac);
				fwd_ipt_add_srcaddr(b, c->src_ip);
				fwd_ipt_add_srcport(b, c->src_port);
				fwd_ipt_add_destaddr(b, c->dest_ip);
				fwd_ipt_add_destport(b, c->dest_port);
				fwd_ipt_add_policy_target(b, c->target);
				fwd_ipt_add_comment(b, "rule", z, n, n2);
				fwd_ipt_exec(b);
			}
		}

		/* No destination specified, treat it as input rule */
		else
		{
			printf("\n# Net %s (%s) - rule Z:%s N:%s I:%s\n",
				n->name, n->ifname, z->name, n->name, n->ifname);

			b = fwd_ipt_init("filter");
			fwd_ipt_add_format(b, " -A rules -i %s", n->ifname);
			fwd_ipt_add_proto(b, c->proto);
			fwd_ipt_add_icmptype(b, c->icmp_type);
			fwd_ipt_add_srcmac(b, c->src_mac);
			fwd_ipt_add_srcaddr(b, c->src_ip);
			fwd_ipt_add_srcport(b, c->src_port);
			fwd_ipt_add_destaddr(b, c->dest_ip);
			fwd_ipt_add_destport(b, c->dest_port);
			fwd_ipt_add_policy_target(b, c->target);
			fwd_ipt_add_comment(b, "rule", z, n, n2);
			fwd_ipt_exec(b);
		}
	}
}

