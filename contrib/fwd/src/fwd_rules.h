/*
 * fwd - OpenWrt firewall daemon - header for iptables rule set
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

#ifndef __FWD_RULES_H__
#define __FWD_RULES_H__

#include "fwd.h"

void fwd_ipt_build_ruleset(struct fwd_handle *h);
void fwd_ipt_clear_ruleset(struct fwd_handle *h);

void fwd_ipt_addif(struct fwd_handle *h, const char *net);
void fwd_ipt_delif(struct fwd_handle *h, const char *net);
void fwd_ipt_chgif(struct fwd_handle *h, const char *net);

#endif

