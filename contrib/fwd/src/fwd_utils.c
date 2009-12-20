/*
 * fwd - OpenWrt firewall daemon - commmon utility functions
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


#include "fwd_utils.h"


void fwd_log_init(void)
{
	openlog("Firewall", 0, LOG_DAEMON | LOG_PERROR);
}

void __fwd_log(int prio, const char *msg, ...)
{
	va_list ap;
	va_start(ap, msg);
	vsyslog(prio, msg, ap);
	va_end(ap);
}



int fwd_empty_cidr(struct fwd_cidr *c)
{
	if( (c == NULL) || ((c->addr.s_addr == 0) && (c->prefix == 0)) )
		return 1;

	return 0;
}

int fwd_equal_cidr(struct fwd_cidr *a, struct fwd_cidr *b)
{
	if( fwd_empty_cidr(a) && fwd_empty_cidr(b) )
		return 1;
	else if( (a->addr.s_addr == b->addr.s_addr) && (a->prefix == b->prefix) )
		return 1;

	return 0;
}

void fwd_update_cidr(struct fwd_cidr *a, struct fwd_cidr *b)
{
	if( a != NULL )
	{
		a->addr.s_addr = b ? b->addr.s_addr : 0;
		a->prefix = b ? b->prefix : 0;
	}
}


/* fwd_zmalloc(size_t)
 * Allocates a zeroed buffer of the given size. */
void * fwd_zmalloc(size_t s)
{
	void *b = malloc(s);

	if( b != NULL )
		memset(b, 0, s);

	return b;
}


