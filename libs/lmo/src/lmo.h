/*
 * lmo - Lua Machine Objects - General header
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

#ifndef _LMO_H_
#define _LMO_H_

#include <stdlib.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <errno.h>


#if (defined(__GNUC__) && defined(__i386__))
#define sfh_get16(d) (*((const uint16_t *) (d)))
#else
#define sfh_get16(d) ((((uint32_t)(((const uint8_t *)(d))[1])) << 8)\
					   +(uint32_t)(((const uint8_t *)(d))[0]) )
#endif


struct lmo_entry {
	uint32_t key_id;
	uint32_t val_id;
	uint32_t offset;
	uint32_t length;
	struct lmo_entry *next;
} __attribute__((packed));

typedef struct lmo_entry lmo_entry_t;


struct lmo_archive {
	int         fd;
	uint32_t    length;
	lmo_entry_t *index;
	char        *mmap;
};

typedef struct lmo_archive lmo_archive_t;


uint32_t sfh_hash(const char * data, int len);

char _lmo_error[1024];
const char * lmo_error(void);

lmo_archive_t * lmo_open(const char *file);
int lmo_lookup(lmo_archive_t *ar, const char *key, char *dest, int len);
void lmo_close(lmo_archive_t *ar);

#endif
