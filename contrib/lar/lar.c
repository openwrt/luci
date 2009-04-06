#include "lar.h"

int lar_read32( int fd, uint32_t *val )
{
	uint8_t buffer[5];

	if( read(fd, buffer, 4) < 4 )
		LAR_DIE("Unexpected EOF while reading data");

	buffer[4] = 0;
	*val = ntohl(*((uint32_t *) buffer));

	return 0;
}

int lar_read16( int fd, uint16_t *val )
{
	uint8_t buffer[3];

	if( read(fd, buffer, 2) < 2 )
		LAR_DIE("Unexpected EOF while reading data");

	buffer[2] = 0;
	*val = ntohs(*((uint16_t *) buffer));

	return 0;
}

lar_index * lar_get_index( lar_archive *ar )
{
	uint32_t i;
	uint32_t idx_offset;
	uint32_t idx_length;
	lar_index *idx_map, *idx_ptr;

	if( lseek(ar->fd, -(sizeof(idx_offset)), SEEK_END) == -1 )
		LAR_DIE("Unable to seek to end of archive");

	lar_read32(ar->fd, &idx_offset);
	idx_length = ( ar->length - idx_offset - sizeof(idx_offset) );

	if( lseek(ar->fd, idx_offset, SEEK_SET) == -1 )
		LAR_DIE("Unable to seek to archive index");


	idx_map = NULL;

	for( i = 0; i < idx_length; \
		i += (sizeof(lar_index) - sizeof(char *))
	) {
		idx_ptr = (lar_index *)malloc(sizeof(lar_index));

		lar_read32(ar->fd, &idx_ptr->noffset);
		lar_read32(ar->fd, &idx_ptr->nlength);
		lar_read32(ar->fd, &idx_ptr->foffset);
		lar_read32(ar->fd, &idx_ptr->flength);
		lar_read16(ar->fd, &idx_ptr->type);
		lar_read16(ar->fd, &idx_ptr->flags);

		idx_ptr->next = idx_map;
		idx_map = idx_ptr;
	}

	return idx_map;
}

uint32_t lar_get_filename( lar_archive *ar,
	lar_index *idx_ptr, char *filename
) {
	if( idx_ptr->nlength >= LAR_FNAME_BUFFER )
		LAR_DIE("Filename exceeds maximum allowed length");

	if( lseek(ar->fd, idx_ptr->noffset, SEEK_SET) == -1 )
		LAR_DIE("Unexpected EOF while seeking filename");

	if( read(ar->fd, filename, idx_ptr->nlength) < idx_ptr->nlength )
		LAR_DIE("Unexpected EOF while reading filename");

	filename[idx_ptr->nlength] = 0;

	return idx_ptr->nlength;
}

lar_member * lar_open_member( lar_archive *ar, const char *name )
{
	lar_index *idx_ptr = ar->index;
	lar_member *member;
	char memberfile[LAR_FNAME_BUFFER];
	char *memberdata;
	size_t pgsz  = getpagesize();

	while(idx_ptr)
	{
		lar_get_filename(ar, idx_ptr, memberfile);

		if( !strncmp(memberfile, name, idx_ptr->nlength) )
		{
			memberdata = mmap(
				0, idx_ptr->flength + ( idx_ptr->foffset % pgsz ),
				PROT_READ, MAP_PRIVATE,	ar->fd,
				idx_ptr->foffset - ( idx_ptr->foffset % pgsz )
			);

			if( memberdata == MAP_FAILED )
				LAR_DIE("Failed to mmap() member data");

			member = (lar_member *)malloc(sizeof(lar_member));
			member->type   = idx_ptr->type;
			member->flags  = idx_ptr->flags;
			member->length = idx_ptr->flength;
			member->data   = &memberdata[idx_ptr->foffset % pgsz];

			member->mmap   = memberdata;
			member->mlen   = idx_ptr->flength + ( idx_ptr->foffset % pgsz );

			return member;
		}

		idx_ptr = idx_ptr->next;
	}

	return NULL;
}

int lar_close_member( lar_member *member )
{
	int stat = munmap(member->mmap, member->mlen);
	free(member);

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
		free(idx_head);
	} while( (idx_head = idx_next) != NULL );

	free(ar);

	return 0;
}

lar_archive * lar_find_archive( const char *package, const char *path )
{
	int seg = 1;
	int len = 0;
	int pln = 0;
	int i, j;
	struct stat s;
	LAR_FNAME(buffer);

	if( path )
	{
		for( pln = 0; path[pln] != '\0'; pln++ )
			if( pln >= (sizeof(buffer) - 5) )
				LAR_DIE("Library path exceeds maximum allowed length");

		memcpy(buffer, path, pln);
	}

	for( len = 0; package[len] != '\0'; len++ )
	{
		if( len >= (sizeof(buffer) - 5 - pln) )
			LAR_DIE("Package name exceeds maximum allowed length");

		if( package[len] == '.' ) seg++;
	}

	while( seg > 0 )
	{
		for( i = 0, j = 1; (i < len) && (j <= seg); i++ )
		{
			if( package[i] == '.' ) {
				if( j < seg ) j++; else break;
			}

			buffer[pln+i] = ( package[i] == '.' ) ? LAR_DIRSEP : package[i];
		}

		buffer[pln+i+0] = '.'; buffer[pln+i+1] = 'l'; buffer[pln+i+2] = 'a';
		buffer[pln+i+3] = 'r'; buffer[pln+i+4] = '\0';

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

	buffer[len+0] = '.'; buffer[len+1] = 'l'; buffer[len+2] = 'u';
	buffer[len+3] = 'a'; buffer[len+4] = '\0';

	return lar_open_member(ar, buffer);
}
