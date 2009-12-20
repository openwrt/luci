/*
 * fwd - OpenWrt firewall daemon - libiptc/libxtables interface headers
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


#ifndef __FWD_XTABLES_H__
#define __FWD_XTABLES_H__

#include <iptables.h>
#include <xtables.h>
#include <libiptc/libxtc.h>

#include <dlfcn.h>
#include <errno.h>

#include <sys/stat.h>
#include <sys/utsname.h>



struct fwd_xt_rule {
	struct iptc_handle *iptc;
	struct ipt_entry *entry;
	struct xtables_rule_match *matches;
	struct xtables_target *target;
};


/* Required by certain extensions like SNAT and DNAT */
extern int kernel_version;
extern void get_kernel_version(void);


void fwd_xt_init(void);

struct fwd_xt_rule * fwd_xt_init_rule(struct iptc_handle *h);

void fwd_xt_parse_proto(struct fwd_xt_rule *r, struct fwd_proto *p, int inv);
void fwd_xt_parse_in(struct fwd_xt_rule *r, struct fwd_network *n, int inv);
void fwd_xt_parse_out(struct fwd_xt_rule *r, struct fwd_network *n, int inv);
void fwd_xt_parse_src(struct fwd_xt_rule *r, struct fwd_cidr *c, int inv);
void fwd_xt_parse_dest(struct fwd_xt_rule *r, struct fwd_cidr *c, int inv);
void fwd_xt_parse_frag(struct fwd_xt_rule *r, int frag, int inv);

struct xtables_match * fwd_xt_get_match(struct fwd_xt_rule *r, const char *name);
void __fwd_xt_parse_match(struct fwd_xt_rule *r, struct xtables_match *m, ...);
#define fwd_xt_parse_match(r, m, ...) __fwd_xt_parse_match(r, m, __VA_ARGS__, NULL)

struct xtables_target * fwd_xt_get_target(struct fwd_xt_rule *r, const char *name);
void __fwd_xt_parse_target(struct fwd_xt_rule *r, struct xtables_target *t, ...);
#define fwd_xt_parse_target(r, t, ...) __fwd_xt_parse_target(r, t, __VA_ARGS__, NULL)

int fwd_xt_append_rule(struct fwd_xt_rule *r, const char *chain);
int fwd_xt_insert_rule(struct fwd_xt_rule *r, const char *chain, unsigned int pos);

#endif
