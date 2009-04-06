#ifndef __LAR_H
#define __LAR_H

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdint.h>
#include <fcntl.h>
#include <string.h>
#include <arpa/inet.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <sys/stat.h>


int errno;

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

#ifdef __WIN32__
#define LAR_DIRSEP	'\\'
#else
#define LAR_DIRSEP	'/'
#endif


struct lar_index_item {
	uint32_t noffset;
	uint32_t nlength;
	uint32_t foffset;
	uint32_t flength;
	uint16_t type;
	uint16_t flags;
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
	off_t length;
	char filename[LAR_FNAME_BUFFER];
	struct lar_index_item *index;
};

typedef struct lar_index_item lar_index;
typedef struct lar_member_item lar_member;
typedef struct lar_archive_handle lar_archive;


int lar_read32( int fd, uint32_t *val );
int lar_read16( int fd, uint16_t *val );

lar_index * lar_get_index( lar_archive *ar );

uint32_t lar_get_filename( lar_archive *ar,
	lar_index *idx_ptr, char *filename );

lar_member * lar_open_member( lar_archive *ar, const char *name );

int lar_close_member( lar_member *member );

lar_archive * lar_open( const char *filename );

int lar_close( lar_archive *ar );

lar_archive * lar_find_archive( const char *package );

lar_member * lar_find_member( lar_archive *ar, const char *package );

#endif

