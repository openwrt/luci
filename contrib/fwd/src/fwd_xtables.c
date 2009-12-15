/*
 * fwd - OpenWrt firewall daemon - libiptc/libxtables interface
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
#include "fwd_xtables.h"


/* Required by certain extensions like SNAT and DNAT */
int kernel_version;

extern void
get_kernel_version(void) {
	static struct utsname uts;
	int x = 0, y = 0, z = 0;

	if (uname(&uts) == -1) {
		fprintf(stderr, "Unable to retrieve kernel version.\n");
		xtables_free_opts(1);
		exit(1);
	}

	sscanf(uts.release, "%d.%d.%d", &x, &y, &z);
	kernel_version = LINUX_VERSION(x, y, z);
}


static void xt_exit_error(enum xtables_exittype status, const char *msg, ...)
{
	va_list ap;
	va_start(ap, msg);
	vprintf(msg, ap);
	va_end(ap);	
	exit(1);
}

void fwd_xt_init(void)
{
	struct xtables_globals xt_globals = {
		.option_offset = 0,
		.program_version = IPTABLES_VERSION,
		.opts = 0,
		.orig_opts = 0,
		.exit_err = (void *)&xt_exit_error,
	};

	xtables_init();
	xtables_set_nfproto(NFPROTO_IPV4);
	xtables_set_params(&xt_globals);
}


struct fwd_xt_rule * fwd_xt_init_rule(struct iptc_handle *h)
{
	struct fwd_xt_rule *r;

	if( (r = fwd_alloc_ptr(struct fwd_xt_rule)) != NULL )
	{
		if( (r->entry = fwd_alloc_ptr(struct ipt_entry)) != NULL )
		{
			r->iptc = h;
			return r;
		}
	}

	fwd_free_ptr(r);
	return NULL;
}


void fwd_xt_parse_proto(
	struct fwd_xt_rule *r, struct fwd_proto *p, int inv
) {
	if( p != NULL )
	{
		switch(p->type)
		{
			case FWD_PR_TCP:
				r->entry->ip.proto = 6;
				break;

			case FWD_PR_UDP:
				r->entry->ip.proto = 17;
				break;

			case FWD_PR_ICMP:
				r->entry->ip.proto = 1;
				break;

			case FWD_PR_CUSTOM:
				r->entry->ip.proto = p->proto;
				break;

			case FWD_PR_ALL:
			case FWD_PR_TCPUDP:
				r->entry->ip.proto = 0;
				break;
		}

		if( inv )
			r->entry->ip.invflags |= IPT_INV_PROTO;
	}
}

void fwd_xt_parse_in(
	struct fwd_xt_rule *r, struct fwd_network_list *n, int inv
) {
	if( n != NULL )
	{
		strncpy(r->entry->ip.iniface, n->ifname, IFNAMSIZ);

		if( inv )
			r->entry->ip.invflags |= IPT_INV_VIA_IN;
	}
}

void fwd_xt_parse_out(
	struct fwd_xt_rule *r, struct fwd_network_list *n, int inv
) {
	if( n != NULL )
	{
		strncpy(r->entry->ip.outiface, n->ifname, IFNAMSIZ);

		if( inv )
			r->entry->ip.invflags |= IPT_INV_VIA_OUT;
	}
}

void fwd_xt_parse_src(
	struct fwd_xt_rule *r, struct fwd_cidr *c, int inv
) {
	if( c != NULL )
	{
		r->entry->ip.src.s_addr  = c->addr.s_addr;
		r->entry->ip.smsk.s_addr = htonl(~((1 << (32 - c->prefix)) - 1));

		if( inv )
			r->entry->ip.invflags |= IPT_INV_SRCIP;
	}
}

void fwd_xt_parse_dest(
	struct fwd_xt_rule *r, struct fwd_cidr *c, int inv
) {
	if( c != NULL )
	{
		r->entry->ip.dst.s_addr  = c->addr.s_addr;
		r->entry->ip.dmsk.s_addr = htonl(~((1 << (32 - c->prefix)) - 1));

		if( inv )
			r->entry->ip.invflags |= IPT_INV_DSTIP;
	}
}


struct xtables_match * fwd_xt_get_match(
	struct fwd_xt_rule *r, const char *name
) {
	struct xtables_match *m = xtables_find_match(name, XTF_TRY_LOAD, &r->matches);
	size_t s;

	if( m != NULL )
	{
		s = IPT_ALIGN(sizeof(struct ipt_entry_match)) + m->size;

		if(	(m->m = malloc(s)) != NULL )
		{
			memset(m->m, 0, s);
			strcpy(m->m->u.user.name, m->name);
			m->m->u.match_size = s;

			if( m->init )
				m->init(m->m);

			return m;
		}
	}

	return NULL;
}

void fwd_xt_parse_match(
	struct fwd_xt_rule *r, struct xtables_match *m,
	const char *opt, const char *val, int inv
) {
	char optcode;
	const char *opts[3] = { "x", opt, val };

	optind  = 0;
	optcode = getopt_long(val ? 3 : 2, (char **)opts, "", m->extra_opts, NULL);

	if( (optcode > -1) && (optcode != '?') )
		m->parse(optcode, (char **)opts, inv, &m->mflags, r->entry, &m->m);
}


struct xtables_target * fwd_xt_get_target(
	struct fwd_xt_rule *r, const char *name
) {
	struct xtables_target *t = xtables_find_target(name, XTF_TRY_LOAD);
	size_t s;

	if( !t )
		t = xtables_find_target(IPT_STANDARD_TARGET, XTF_LOAD_MUST_SUCCEED);

	if( t != NULL )
	{
		s = IPT_ALIGN(sizeof(struct ipt_entry_target)) + t->size;

		if(	(t->t = malloc(s)) != NULL )
		{
			memset(t->t, 0, s);
			strcpy(t->t->u.user.name, name);
			t->t->u.target_size = s;
			xtables_set_revision(t->t->u.user.name, t->revision);

			if( t->init )
				t->init(t->t);

			r->target = t;

			return t;
		}
	}

	return NULL;
}

void fwd_xt_parse_target(
	struct fwd_xt_rule *r, struct xtables_target *t,
	const char *opt, const char *val, int inv
) {
	char optcode;
	const char *opts[3] = { "x", opt, val };

	optind  = 0;
	optcode = getopt_long(val ? 3 : 2, (char **)opts, "", t->extra_opts, NULL);

	if( (optcode > -1) && (optcode != '?') )
		t->parse(optcode, (char **)opts, inv, &t->tflags, r->entry, &t->t);
}

int fwd_xt_exec_rule(struct fwd_xt_rule *r, const char *chain)
{
	size_t s;
	struct xtables_rule_match *m, *next;
	struct xtables_match *em;
	struct xtables_target *et;
	struct ipt_entry *e;
	int rv = 0;

	s = IPT_ALIGN(sizeof(struct ipt_entry));

	for( m = r->matches; m; m = m->next )
		s += m->match->m->u.match_size;

	if( (e = malloc(s + r->target->t->u.target_size)) != NULL )
	{
		memset(e, 0, s + r->target->t->u.target_size);
		memcpy(e, r->entry, sizeof(struct ipt_entry));

		e->target_offset = s;
		e->next_offset = s + r->target->t->u.target_size;

		s = 0;

		for( m = r->matches; m; m = m->next )
		{
			memcpy(e->elems + s, m->match->m, m->match->m->u.match_size);
			s += m->match->m->u.match_size;
		}

		memcpy(e->elems + s, r->target->t, r->target->t->u.target_size);

		rv = iptc_append_entry(chain, e, r->iptc);
	}
	else
	{
		errno = ENOMEM;
	}


	fwd_free_ptr(e);
	fwd_free_ptr(r->entry);
	fwd_free_ptr(r->target->t);

	for( m = r->matches; m; )
	{
		next = m->next;
		fwd_free_ptr(m->match->m);

		if( m->match == m->match->next )
			fwd_free_ptr(m->match);

		fwd_free_ptr(m);
		m = next;
	}

	fwd_free_ptr(r);

	/* reset all targets and matches */
	for (em = xtables_matches; em; em = em->next)
		em->mflags = 0;

	for (et = xtables_targets; et; et = et->next)
	{
		et->tflags = 0;
		et->used = 0;
	}

	return rv;
}

