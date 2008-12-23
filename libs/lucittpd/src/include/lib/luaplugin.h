/*
 * luaplugin - fast lua plugin indexing
 * Copyright (C) 2008 Felix Fietkau <nbd@openwrt.org>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */
#ifndef __LUAPLUGIN_H
#define __LUAPLUGIN_H

#include <sys/time.h>
#include <lualib.h>
#include <lauxlib.h>
#include <stdbool.h>
#include "list.h"

struct luaplugin_entry {
	struct luaplugin_ctx *ctx;
	struct list_head list;
	time_t timestamp;
	int checked;
	bool loaded;
	bool reload;
	char *name;
	char *module;

	/* privdata for the caller */
	void *priv;
};

struct luaplugin_ctx {
	const char *path;
	const struct luaplugin_ops *ops;
	lua_State *L;
	int checked;
	struct list_head *last;
	struct list_head entries;
};

/** luaplugin_init:
 * initialize the luaplugin context (allocates a new lua context)
 */
extern int luaplugin_init(struct luaplugin_ctx *ctx, const char *path);

/** luaplugin_scan:
 * rescan the plugin cache
 */
extern void luaplugin_scan(struct luaplugin_ctx *ctx);

/** luaplugin_call:
 * call out to a lua function.
 * to be able to use this, you need to push the function name on the lua stack (ctx->L)
 * and then narg function arguments afterwards.
 * this call pops (narg + 1) arguments from the stack
 * returns -ENOENT if the function was not found
 */
extern int luaplugin_call(struct luaplugin_entry *e, int narg);

/** luaplugin_done:
 * drop the luaplugin context (and associated lua context)
 * frees all memory allocated by the library
 */
extern void luaplugin_done(struct luaplugin_ctx *ctx);

#endif
