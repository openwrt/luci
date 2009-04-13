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


#include "lar.h"

static int lar_read32( int fd, uint32_t *val )
{
	uint8_t buffer[5];

	if( read(fd, buffer, 4) < 4 )
		LAR_DIE("Unexpected EOF while reading data");

	buffer[4] = 0;
	*val = ntohl(*((uint32_t *) buffer));

	return 0;
}

static int lar_read16( int fd, uint16_t *val )
{
	uint8_t buffer[3];

	if( read(fd, buffer, 2) < 2 )
		LAR_DIE("Unexpected EOF while reading data");

	buffer[2] = 0;
	*val = ntohs(*((uint16_t *) buffer));

	return 0;
}

static void lar_md5( char *md5, const char *data, int len )
{
	md5_state_t state;

	md5_init(&state);
	md5_append(&state, (const md5_byte_t *)data, len);
	md5_finish(&state, (md5_byte_t *)md5);
}

static int lar_read_filenames( lar_archive *ar )
{
	int i;
	int j;
	char *filelist;
	size_t pgof;
	size_t pgsz = getpagesize();
	lar_index *idx_ptr;
	lar_index *idx_filelist = ar->index;

	while(idx_filelist)
	{
		if( idx_filelist->type == LAR_TYPE_FILELIST )
			break;

		idx_filelist = idx_filelist->next;
	}

	if( idx_filelist != NULL )
	{
		pgof = ( idx_filelist->offset % pgsz );

		filelist = mmap(
			0, idx_filelist->length + pgof, PROT_READ, MAP_PRIVATE,
			ar->fd, idx_filelist->offset - pgof
		);

		if( filelist == MAP_FAILED )
			LAR_DIE("Failed to mmap() file list");


		idx_ptr = ar->index;
		i = pgof;

		while(idx_ptr)
		{
			if( idx_ptr->type == LAR_TYPE_REGULAR )
			{
				j = strlen(&filelist[i]) + 1;

				if( (j >= LAR_FNAME_BUFFER) ||
				    ((i+j) > (idx_filelist->length+pgof)) )
						LAR_DIE("Filename exceeds maximum allowed length");

				idx_ptr->filename = (char *)malloc(j);
				memcpy(idx_ptr->filename, &filelist[i], j);

				i += j;
			}

			idx_ptr = idx_ptr->next;
		}

		munmap(filelist, idx_filelist->length + pgof);

		return 1;
	}

	return 0;
}

lar_index * lar_get_index( lar_archive *ar )
{
	uint32_t i;
	uint32_t idx_offset;
	uint32_t idx_length;
	lar_index *idx_map;
	lar_index *idx_ptr;

	if( lseek(ar->fd, -(sizeof(idx_offset)), SEEK_END) == -1 )
		LAR_DIE("Unable to seek to end of archive");

	lar_read32(ar->fd, &idx_offset);
	idx_length = ( ar->length - idx_offset - sizeof(idx_offset) );

	if( lseek(ar->fd, idx_offset, SEEK_SET) == -1 )
		LAR_DIE("Unable to seek to archive index");


	idx_map = NULL;

	for( i = 0; i < idx_length; i += (sizeof(lar_index) - 2 * sizeof(char *)) )
	{
		idx_ptr = (lar_index *)malloc(sizeof(lar_index));
		idx_ptr->filename = NULL;

		lar_read32(ar->fd, &idx_ptr->offset);
		lar_read32(ar->fd, &idx_ptr->length);
		lar_read16(ar->fd, &idx_ptr->type);
		lar_read16(ar->fd, &idx_ptr->flags);

		if(read(ar->fd,&idx_ptr->id,sizeof(idx_ptr->id)) < sizeof(idx_ptr->id))
			LAR_DIE("Unexpected EOF while reading member id");

		idx_ptr->next = idx_map;
		idx_map = idx_ptr;
	}

	return idx_map;
}

lar_member * lar_mmap_member( lar_archive *ar, lar_index *idx_ptr )
{
	lar_member *member;
	size_t pgsz = getpagesize();
	size_t pgof = ( idx_ptr->offset % pgsz );

	char *memberdata = mmap(
		0, idx_ptr->length + pgof, PROT_READ, MAP_PRIVATE,
		ar->fd, idx_ptr->offset - pgof
	);

	if( memberdata == MAP_FAILED )
		LAR_DIE("Failed to mmap() member data");

	member = (lar_member *)malloc(sizeof(lar_member));
	member->type   = idx_ptr->type;
	member->flags  = idx_ptr->flags;
	member->length = idx_ptr->length;
	member->data   = &memberdata[pgof];

	member->mmap   = memberdata;
	member->mlen   = idx_ptr->length + pgof;

	return member;
}

lar_member * lar_open_member( lar_archive *ar, const char *name )
{
	lar_index *idx_ptr = ar->index;
	char mbid[sizeof(idx_ptr->id)];

	lar_md5(mbid, name, strlen(name));

	while(idx_ptr)
	{
		if( !strncmp(mbid, idx_ptr->id, sizeof(mbid)) )
			return lar_mmap_member(ar, idx_ptr);

		idx_ptr = idx_ptr->next;
	}

	return NULL;
}

int lar_close_member( lar_member *member )
{
	int stat = munmap(member->mmap, member->mlen);
	free(member);
	member = NULL;

	return stat;
}

lar_archive * lar_open( const char *filename )
{
	int fd;
	struct stat as;
	lar_archive *ar;

	if( stat(filename, &as) == -1 )
		return NULL;

	if( !(as.st_mode & S_IFREG) )
		return NULL;

	if( (fd = open(filename, O_RDONLY)) != -1 )
	{
		ar = (lar_archive *)malloc(sizeof(lar_archive));
		ar->fd       = fd;
		ar->length   = as.st_size;
		ar->index    = lar_get_index(ar);
		strncpy(ar->filename, filename, sizeof(ar->filename));

		ar->has_filenames = lar_read_filenames(ar);

		return ar;
	}

	return NULL;
}

int lar_close( lar_archive *ar )
{
	lar_index *idx_head;
	lar_index *idx_next;

	close(ar->fd);

	idx_head = ar->index;
	do {
		idx_next = idx_head->next;
		free(idx_head->filename);
		free(idx_head);
	} while( (idx_head = idx_next) != NULL );

	free(ar);
	ar = NULL;

	return 0;
}

lar_archive * lar_find_archive( const char *package, const char *path, int pkg )
{
	uint32_t i;
	uint32_t j;
	uint32_t seg = 1;
	uint32_t len = 0;
	uint32_t pln = 0;
	char sep = ( pkg ? '.' : '/' );
	struct stat s;
	LAR_FNAME(buffer);

	if( path )
	{
		for( pln = 0; path[pln] != '\0'; pln++ )
			if( pln >= (sizeof(buffer) - 5) )
				LAR_DIE("Library path exceeds maximum allowed length");

		memcpy(buffer, path, pln);
	}

	if( buffer[pln-1] != '/' )
		buffer[pln++] = '/';

	for( len = 0; package[len] != '\0'; len++ )
	{
		if( len >= (sizeof(buffer) - 5 - pln) )
			LAR_DIE("Package name exceeds maximum allowed length");

		if( package[len] == sep ) seg++;
	}

	while( seg > 0 )
	{
		for( i = 0, j = 1; (i < len) && (j <= seg); i++ )
		{
			if( package[i] == sep ) {
				if( j < seg ) j++; else break;
			}

			buffer[pln+i] = ( package[i] == sep ) ? LAR_DIRSEP : package[i];
		}

		strcpy(&buffer[pln+i], ".lar");

		if( (stat(buffer, &s) > -1) && (s.st_mode & S_IFREG) )
			return lar_open(buffer);

		seg--;
	}

	return NULL;
}

lar_member * lar_find_member( lar_archive *ar, const char *package )
{
	int len;
	LAR_FNAME(buffer);

	for( len = 0; package[len] != '\0'; len++ )
	{
		if( len >= (sizeof(buffer) - 5) )
			LAR_DIE("Package name exceeds maximum allowed length");

		buffer[len] = ( package[len] == '.' ) ? '/' : package[len];
	}

	strcpy(&buffer[len], ".lua");

	return lar_open_member(ar, buffer);
}
