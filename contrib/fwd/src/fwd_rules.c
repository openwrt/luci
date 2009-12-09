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

static void fwd_ipt_exec(struct fwd_ipt_rulebuf *r)
{
	if( r->len )
		printf("%s\n", r->buf);

	fwd_free_ptr(r->buf);
	fwd_free_ptr(r);
}

static const char * fwd_str_policy(enum fwd_policy pol)
{
	return (pol == FWD_P_ACCEPT ? "ACCEPT" : "DROP");
}

static const char * fwd_str_target(enum fwd_policy pol)
{
	switch(pol)
	{
		case FWD_P_ACCEPT:
			return "ACCEPT";

		case FWD_P_REJECT:
			return "REJECT";

		default:
			return "DROP";
	}

	return "DROP";
}


static void fwd_ipt_defaults_create(struct fwd_data *d)
{
	struct fwd_defaults *def = &d->section.defaults;

	/* policies */
	fwd_ipt_exec_format("filter", " -P INPUT %s", fwd_str_policy(def->input));
	fwd_ipt_exec_format("filter", " -P OUTPUT %s", fwd_str_policy(def->output));
	fwd_ipt_exec_format("filter", " -P FORWARD %s", fwd_str_policy(def->forward));

	/* invalid state drop */
	if( def->drop_invalid )
	{
		fwd_ipt_exec_format("filter", " -A INPUT --state INVALID -j DROP");
		fwd_ipt_exec_format("filter", " -A OUTPUT --state INVALID -j DROP");
		fwd_ipt_exec_format("filter", " -A FORWARD --state INVALID -j DROP");
	}

	/* default accept related */
	fwd_ipt_exec_format("filter", " -A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT");
	fwd_ipt_exec_format("filter", " -A OUTPUT -m state --state RELATED,ESTABLISHED -j ACCEPT");
	fwd_ipt_exec_format("filter", " -A FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT");

	/* default accept on lo */
	fwd_ipt_exec_format("filter", " -A INPUT -i lo -j ACCEPT");
	fwd_ipt_exec_format("filter", " -A OUTPUT -o lo -j ACCEPT");

	/* syn flood protection */
	if( def->syn_flood )
	{
		fwd_ipt_exec_format("filter", " -N syn_flood");

		fwd_ipt_exec_format("filter",
			" -A syn_flood -p tcp --syn -m limit --limit %i/second"
			" --limit-burst %i -j RETURN",
				def->syn_rate, def->syn_burst);

		fwd_ipt_exec_format("filter", " -A syn_flood -j DROP");
		fwd_ipt_exec_format("filter", " -A INPUT -p tcp --syn -j syn_flood");
	}

	/* standard input/output/forward chain */
	fwd_ipt_exec_format("filter", " -N input");
	fwd_ipt_exec_format("filter", " -N output");
	fwd_ipt_exec_format("filter", " -N forward");
	fwd_ipt_exec_format("filter", " -A INPUT -j input");
	fwd_ipt_exec_format("filter", " -A OUTPUT -j output");
	fwd_ipt_exec_format("filter", " -A FORWARD -j forward");

	/* standard reject chain */
	fwd_ipt_exec_format("filter", " -N reject");
	fwd_ipt_exec_format("filter", " -A reject -p tcp -j REJECT --reject-with tcp-reset");
	fwd_ipt_exec_format("filter", " -A reject -j REJECT --reject-with icmp-port-unreachable");
}

static void fwd_ipt_zone_create(struct fwd_data *d)
{
	struct fwd_zone *z = &d->section.zone;

	if( !strcmp(z->name, "loopback") )
		return;

	fwd_ipt_exec_format("filter", " -N zone_%s",         z->name);
	fwd_ipt_exec_format("filter", " -N zone_%s_forward", z->name);
	fwd_ipt_exec_format("filter", " -N zone_%s_ACCEPT",  z->name);
	fwd_ipt_exec_format("filter", " -N zone_%s_REJECT",  z->name);
	fwd_ipt_exec_format("filter", " -N zone_%s_DROP",    z->name);
	fwd_ipt_exec_format("filter", " -N zone_%s_MSSFIX",  z->name);

	if( z->forward != FWD_P_UNSPEC )
		fwd_ipt_exec_format("filter", " -A zone_%s_forward -j zone_%s_%s",
			z->name, z->name, fwd_str_target(z->forward));

	if( z->input != FWD_P_UNSPEC )
		fwd_ipt_exec_format("filter", " -A zone_%s -j zone_%s_%s",
			z->name, z->name, fwd_str_target(z->input));

	if( z->output != FWD_P_UNSPEC )
		fwd_ipt_exec_format("filter", " -A output -j zone_%s_%s",
			z->name, fwd_str_target(z->output));

	fwd_ipt_exec_format("nat", " -N zone_%s_nat",        z->name);
	fwd_ipt_exec_format("nat", " -N zone_%s_prerouting", z->name);
	fwd_ipt_exec_format("raw", " -N zone_%s_notrack",    z->name);

	if( z->masq )
		fwd_ipt_exec_format("nat", " -A POSTROUTING -j zone_%s_nat",
			z->name);

	if( z->mtu_fix )
		fwd_ipt_exec_format("filter", " -A FORWARD -j zone_%s_MSSFIX",
			z->name);
}

static void fwd_ipt_forwarding_create(struct fwd_data *d)
{
	struct fwd_forwarding *f = &d->section.forwarding;
	struct fwd_ipt_rulebuf *b;

	b = fwd_ipt_init("filter");

	if( f->src )
		fwd_ipt_add_format(b, " -I zone_%s_forward 1", f->src->name);
	else
		fwd_ipt_add_format(b, " -I forward 1");

	if( f->dest )
		fwd_ipt_add_format(b, " -j zone_%s_ACCEPT", f->dest->name);
	else
		fwd_ipt_add_format(b, " -j ACCEPT");

	fwd_ipt_exec(b);
}

static void fwd_ipt_redirect_create(struct fwd_data *d)
{
	struct fwd_redirect *r = &d->section.redirect;
	struct fwd_ipt_rulebuf *b;

	b = fwd_ipt_init("nat");
	fwd_ipt_add_format(b, " -A zone_%s_prerouting", r->src->name);
	fwd_ipt_add_proto(b, r->proto);
	fwd_ipt_add_srcaddr(b, r->src_ip);
	fwd_ipt_add_srcport(b, r->src_port);
	fwd_ipt_add_destport(b, r->src_dport);
	fwd_ipt_add_srcmac(b, r->src_mac);
	fwd_ipt_add_dnat_target(b, r->dest_ip, r->dest_port);
	fwd_ipt_exec(b);

	b = fwd_ipt_init("nat");
	fwd_ipt_add_format(b, " -I zone_%s_forward 1", r->src->name);
	fwd_ipt_add_proto(b, r->proto);
	fwd_ipt_add_srcmac(b, r->src_mac);
	fwd_ipt_add_srcaddr(b, r->src_ip);
	fwd_ipt_add_srcport(b, r->src_port);
	fwd_ipt_add_destaddr(b, r->dest_ip);
	fwd_ipt_add_destport(b, r->dest_port);
	fwd_ipt_add_format(b, " -j ACCEPT");
	fwd_ipt_exec(b);
}

static void fwd_ipt_rule_create(struct fwd_data *d)
{
	struct fwd_rule *r = &d->section.rule;
	struct fwd_ipt_rulebuf *b;

	b = fwd_ipt_init("filter");

	if( r->dest )
		fwd_ipt_add_format(b, " -A zone_%s_forward", r->src->name);
	else
		fwd_ipt_add_format(b, " -A zone_%s", r->src->name);

	fwd_ipt_add_proto(b, r->proto);
	fwd_ipt_add_icmptype(b, r->icmp_type);
	fwd_ipt_add_srcmac(b, r->src_mac);
	fwd_ipt_add_srcaddr(b, r->src_ip);
	fwd_ipt_add_srcport(b, r->src_port);
	fwd_ipt_add_destaddr(b, r->dest_ip);
	fwd_ipt_add_destport(b, r->dest_port);

	if( r->dest )
		fwd_ipt_add_format(b, " -j zone_%s_%s",
			r->dest->name, fwd_str_target(r->target));
	else
		fwd_ipt_add_format(b, " -j %s", fwd_str_target(r->target));

	fwd_ipt_exec(b);
}


static struct fwd_network_list *
fwd_lookup_network(struct fwd_network_list *n, const char *net)
{
	struct fwd_network_list *e;

	if( n != NULL )
		for( e = n; e; e = e->next )
			if( !strcmp(e->name, net) )
				return e;

	return NULL;
}

static struct fwd_addr_list *
fwd_lookup_addr(struct fwd_addr_list *a, const char *ifname)
{
	struct fwd_addr_list *e;

	if( a != NULL )
		for( e = a; e; e = e->next )
			if( !strcmp(e->ifname, ifname) )
				return e;

	return NULL;
}


void fwd_ipt_build_ruleset(struct fwd_handle *h)
{
	struct fwd_data *e;

	for( e = h->conf; e; e = e->next )
	{
		switch(e->type)
		{
			case FWD_S_DEFAULTS:
				printf("\n## DEFAULTS\n");
				fwd_ipt_defaults_create(e);
				break;

			case FWD_S_ZONE:
				printf("\n## ZONE %s\n", e->section.zone.name);
				fwd_ipt_zone_create(e);
				break;

			case FWD_S_FORWARD:
				printf("\n## FORWARD %s -> %s\n",
					e->section.forwarding.src
						? e->section.forwarding.src->name : "(all)",
					e->section.forwarding.dest
						? e->section.forwarding.dest->name : "(all)");
				fwd_ipt_forwarding_create(e);
				break;

			case FWD_S_REDIRECT:
				printf("\n## REDIRECT %s\n", e->section.forwarding.src->name);
				fwd_ipt_redirect_create(e);
				break;

			case FWD_S_RULE:
				printf("\n## RULE %s\n", e->section.rule.src->name);
				fwd_ipt_rule_create(e);
				break;

			case FWD_S_INCLUDE:
				printf("\n## INCLUDE %s\n", e->section.include.path);
				break;
		}
	}
}

void fwd_ipt_addif(struct fwd_handle *h, const char *net)
{
	struct fwd_data *e;
	struct fwd_zone *z;
	struct fwd_addr_list *a;
	struct fwd_network_list *n;

	for( e = h->conf; e; e = e->next )
	{
		if( (e->type != FWD_S_ZONE) ||
            !(n = fwd_lookup_network(e->section.zone.networks, net)) ||
			!(a = fwd_lookup_addr(h->addrs, n->ifname)) )
				continue;

		z = &e->section.zone;

		printf("\n## NETWORK %s (%s - %s/%u)\n",
			n->name, n->ifname,
			inet_ntoa(a->ipaddr.v4), a->prefix
		);

		fwd_ipt_exec_format("filter", " -A input -i %s -j zone_%s",
			n->ifname, z->name);

		fwd_ipt_exec_format("filter",
			" -I zone_%s_MSSFIX 1 -o %s -p tcp --tcp-flags SYN,RST SYN"
			" -j TCPMSS --clamp-mss-to-pmtu",
				z->name, n->ifname);

		fwd_ipt_exec_format("filter", " -I zone_%s_ACCEPT 1 -o %s -j ACCEPT",
			z->name, n->ifname);

		fwd_ipt_exec_format("filter", " -I zone_%s_DROP 1 -o %s -j DROP",
			z->name, n->ifname);

		fwd_ipt_exec_format("filter", " -I zone_%s_REJECT 1 -o %s -j reject",
			z->name, n->ifname);

		fwd_ipt_exec_format("filter", " -I zone_%s_ACCEPT 1 -i %s -j ACCEPT",
			z->name, n->ifname);

		fwd_ipt_exec_format("filter", " -I zone_%s_DROP 1 -i %s -j DROP",
			z->name, n->ifname);

		fwd_ipt_exec_format("filter", " -I zone_%s_REJECT 1 -i %s -j reject",
			z->name, n->ifname);

		fwd_ipt_exec_format("filter",
			" -I zone_%s_nat 1 -t nat -o %s -j MASQUERADE",
				z->name, n->ifname);

		fwd_ipt_exec_format("filter",
			" -I PREROUTING 1 -t nat -i %s -j zone_%s_prerouting",
				n->ifname, z->name);

		fwd_ipt_exec_format("filter", " -A forward -i %s -j zone_%s_forward",
			n->ifname, z->name);

		fwd_ipt_exec_format("raw", " -I PREROUTING 1 -i %s -j zone_%s_notrack",
			n->ifname, z->name);
	}
}

