/*
 *   This program is free software; you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation; either version 2 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program; if not, write to the Free Software
 *   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307, USA.
 *
 *   Copyright (C) 2008 John Crispin <blogic@openwrt.org> 
 *
 *   Changed by Jo-Philipp Wich <jow@openwrt.org>
 */

#include <string.h>
#include <stdlib.h>

#include <uci_config.h>
#include <uci.h>
#include "ucix.h"

static struct uci_ptr ptr;

static inline int ucix_get_ptr(struct uci_context *ctx, const char *p, const char *s, const char *o, const char *t)
{
	memset(&ptr, 0, sizeof(ptr));
	ptr.package = p;
	ptr.section = s;
	ptr.option = o;
	ptr.value = t;
	return uci_lookup_ptr(ctx, &ptr, NULL, true);
}

struct uci_context* ucix_init(const char *config_file)
{
	struct uci_context *ctx = uci_alloc_context();
#ifdef uci_to_delta
	uci_add_delta_path(ctx, "/var/state");
#else
	uci_add_history_path(ctx, "/var/state");
#endif
	if(uci_load(ctx, config_file, NULL) != UCI_OK)
	{
		return NULL;
	}
	return ctx;
}

void ucix_cleanup(struct uci_context *ctx)
{
	uci_free_context(ctx);
}

const char* ucix_get_option(struct uci_context *ctx, const char *p, const char *s, const char *o)
{
	struct uci_element *e = NULL;
	const char *value = NULL;
	if(ucix_get_ptr(ctx, p, s, o, NULL))
		return NULL;
	if (!(ptr.flags & UCI_LOOKUP_COMPLETE))
		return NULL;
	e = ptr.last;
	switch (e->type)
	{
	case UCI_TYPE_SECTION:
		value = uci_to_section(e)->type;
		break;
	case UCI_TYPE_OPTION:
		switch(ptr.o->type) {
			case UCI_TYPE_STRING:
				value = ptr.o->v.string;
				break;
			default:
				value = NULL;
				break;
		}
		break;
	default:
		return 0;
	}

	return value;
}

void ucix_for_each_section_type(struct uci_context *ctx,
	const char *p, const char *t,
	void (*cb)(const char*, void*), void *priv)
{
	struct uci_element *e;
	if(ucix_get_ptr(ctx, p, NULL, NULL, NULL))
		return;
	uci_foreach_element(&ptr.p->sections, e)
		if (!strcmp(t, uci_to_section(e)->type))
			cb(e->name, priv);
}

