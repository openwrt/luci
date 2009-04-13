/*
 * lar - Lua Archive Library
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


#ifndef __LAR_H
#define __LAR_H

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdint.h>
#include <fcntl.h>
#include <string.h>
#include <errno.h>
#include <arpa/inet.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <sys/stat.h>

#include "md5.h"

#define LAR_DIE(s) \
	do { \
		fprintf(stderr, "%s(%i): %s(): %s\n", \
			__FILE__, __LINE__, __FUNCTION__, s); \
		if( errno ) fprintf(stderr, "%s(%i): %s\n", \
			__FILE__, __LINE__, strerror(errno) ); \
		exit(1); \
	} while(0)


#define LAR_FNAME_BUFFER 1024
#define LAR_FNAME(s) char s[LAR_FNAME_BUFFER]

#define LAR_TYPE_REGULAR	0x0000
#define LAR_TYPE_FILELIST	0xFFFF

#ifdef __WIN32__
#define LAR_DIRSEP	'\\'
#else
#define LAR_DIRSEP	'/'
#endif


struct lar_index_item {
	uint32_t offset;
	uint32_t length;
	uint16_t type;
	uint16_t flags;
	char id[16];
	char *filename;
	struct lar_index_item *next;
};

struct lar_member_item {
	uint16_t type;
	uint16_t flags;
	uint32_t length;
	char *data;
	char *mmap;
	size_t mlen;
};

struct lar_archive_handle {
	int fd;
	int has_filenames;
	off_t length;
	char filename[LAR_FNAME_BUFFER];
	struct lar_index_item *index;
};

typedef struct lar_index_item lar_index;
typedef struct lar_member_item lar_member;
typedef struct lar_archive_handle lar_archive;


lar_index * lar_get_index( lar_archive *ar );

lar_member * lar_mmap_member( lar_archive *ar, lar_index *idx_ptr );

lar_member * lar_open_member( lar_archive *ar, const char *name );

int lar_close_member( lar_member *member );

lar_archive * lar_open( const char *filename );

int lar_close( lar_archive *ar );

lar_archive * lar_find_archive( const char *package, const char *path, int pkg);

lar_member * lar_find_member( lar_archive *ar, const char *package );

#endif
