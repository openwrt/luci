/*
 * fwd - OpenWrt firewall daemon - commmon utility header
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

#ifndef __FWD_UTILS_H__
#define __FWD_UTILS_H__

#include <syslog.h>

#include "fwd.h"

void fwd_log_init(void);
void __fwd_log(int, const char *, ...);
#define fwd_log_info(...) __fwd_log(LOG_INFO, __VA_ARGS__)
#define fwd_log_err(...) __fwd_log(LOG_ERR, __VA_ARGS__)

int fwd_empty_cidr(struct fwd_cidr *);
int fwd_equal_cidr(struct fwd_cidr *, struct fwd_cidr *);
void fwd_update_cidr(struct fwd_cidr *, struct fwd_cidr *);

/* fwd_zmalloc(size_t)
 * Allocates a zeroed buffer of the given size. */
void * fwd_zmalloc(size_t);

/* fwd_alloc_ptr(type)
 * Allocates a buffer with the size of the given datatype
 * and returns a pointer to it. */
#define fwd_alloc_ptr(t) (t *) fwd_zmalloc(sizeof(t))

/* fwd_free_ptr(void *)
 * Frees the given pointer and sets it to NULL.
 * Safe for NULL values. */
#define fwd_free_ptr(x) do { if(x != NULL) free(x); x = NULL; } while(0)

#endif

