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
 */

#include <string.h>
#include <stdlib.h>
#include <ctype.h>

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
	uci_add_history_path(ctx, "/var/state");
	if(uci_load(ctx, config_file, NULL) != UCI_OK)
	{
		printf("%s/%s is missing or corrupt\n", ctx->savedir, config_file);
		return NULL;
	}
	return ctx;
}

struct uci_context* ucix_init_path(const char *path, const char *config_file)
{
	struct uci_context *ctx = uci_alloc_context();
	if(path)
		uci_set_confdir(ctx, path);
	if(uci_load(ctx, config_file, NULL) != UCI_OK)
	{
		printf("%s/%s is missing or corrupt\n", ctx->savedir, config_file);
		return NULL;
	}
	return ctx;
}

int ucix_load(struct uci_context *ctx, const char *config_file)
{
	if(uci_load(ctx, config_file, NULL) != UCI_OK)
	{
		printf("%s/%s is missing or corrupt\n", ctx->savedir, config_file);
		return 0;
	}
	return 1;
}

void ucix_cleanup(struct uci_context *ctx)
{
	uci_free_context(ctx);
}

void ucix_save(struct uci_context *ctx)
{
	uci_set_savedir(ctx, "/tmp/.uci/");
	uci_save(ctx, NULL);
}

void ucix_save_state(struct uci_context *ctx)
{
	uci_set_savedir(ctx, "/var/state/");
	uci_save(ctx, NULL);
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

int ucix_for_each_list(
	struct uci_context *ctx, const char *p, const char *s, const char *o,
	void (*cb)(const char*, void*), void *priv)
{
	struct uci_element *e = NULL;
	char *value = NULL;
	int count = 0;
	if(ucix_get_ptr(ctx, p, s, o, NULL))
		return -1;
	if (!(ptr.flags & UCI_LOOKUP_COMPLETE))
		return -1;
	e = ptr.last;
	if(e->type == UCI_TYPE_OPTION)
	{
		switch(ptr.o->type)
		{
			case UCI_TYPE_LIST:
				uci_foreach_element(&ptr.o->v.list, e) {
					cb(e->name, priv);
					count++;
				}
				break;

			case UCI_TYPE_STRING:
				if( (value = strdup(ptr.o->v.string)) != NULL )
				{
					char *ts, *tt, *tp;
					for( ts = value; 1; ts = NULL )
					{
						if( (tt = strtok_r(ts, " \t", &tp)) != NULL )
						{
							cb(tt, priv);
							count++;
						}
						else
						{
							break;
						}
					}
					free(value);
				}
				break;
		}

		return count;
	}

	return -1;
}

int ucix_get_option_int(struct uci_context *ctx, const char *p, const char *s, const char *o, int def)
{
	const char *tmp = ucix_get_option(ctx, p, s, o);
	int ret = def;

	if (tmp)
		ret = atoi(tmp);
	return ret;
}

void ucix_add_section(struct uci_context *ctx, const char *p, const char *s, const char *t)
{
	if(ucix_get_ptr(ctx, p, s, NULL, t))
		return;
	uci_set(ctx, &ptr);
}

void ucix_add_option(struct uci_context *ctx, const char *p, const char *s, const char *o, const char *t)
{
	if(ucix_get_ptr(ctx, p, s, o, (t)?(t):("")))
		return;
	uci_set(ctx, &ptr);
}

void ucix_add_option_int(struct uci_context *ctx, const char *p, const char *s, const char *o, int t)
{
	char tmp[64];
	snprintf(tmp, 64, "%d", t);
	ucix_add_option(ctx, p, s, o, tmp);
}

void ucix_del(struct uci_context *ctx, const char *p, const char *s, const char *o)
{
	if(!ucix_get_ptr(ctx, p, s, o, NULL))
		uci_delete(ctx, &ptr);
}

void ucix_revert(struct uci_context *ctx, const char *p, const char *s, const char *o)
{
	if(!ucix_get_ptr(ctx, p, s, o, NULL))
		uci_revert(ctx, &ptr);
}

void ucix_for_each_section_type(struct uci_context *ctx,
	const char *p, const char *t,
	void (*cb)(struct uci_context *, const char*, void*), void *priv)
{
	struct uci_element *e;
	if(ucix_get_ptr(ctx, p, NULL, NULL, NULL))
		return;
	uci_foreach_element(&ptr.p->sections, e)
		if (!strcmp(t, uci_to_section(e)->type))
			cb(ctx, e->name, priv);
}

int ucix_commit(struct uci_context *ctx, const char *p)
{
	if(ucix_get_ptr(ctx, p, NULL, NULL, NULL))
		return 1;
	return uci_commit(ctx, &ptr.p, false);
}


