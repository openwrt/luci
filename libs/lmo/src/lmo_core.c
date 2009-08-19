/*
 * lmo - Lua Machine Objects - Base functions
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

#include "lmo.h"

extern char _lmo_error[1024];

static int lmo_read32( int fd, uint32_t *val )
{
	if( read(fd, val, 4) < 4 )
		return -1;

	*val = ntohl(*val);

	return 4;
}

static char * error(const char *message, int add_errno)
{
	memset(_lmo_error, 0, sizeof(_lmo_error));

	if( add_errno )
		snprintf(_lmo_error, sizeof(_lmo_error),
			"%s: %s", message, strerror(errno));
	else
		snprintf(_lmo_error, sizeof(_lmo_error), "%s", message);

	return NULL;
}

const char * lmo_error(void)
{
	return _lmo_error;
}

lmo_archive_t * lmo_open(const char *file)
{
	int in = -1;
	uint32_t idx_offset = 0;
	uint32_t i;
	struct stat s;

	lmo_archive_t *ar    = NULL;
	lmo_entry_t   *head  = NULL;
	lmo_entry_t   *entry = NULL;

	if( stat(file, &s) == -1 )
	{
		error("Can not stat file", 1);
		goto cleanup;
	}

	if( (in = open(file, O_RDONLY)) == -1 )
	{
		error("Can not open file", 1);
		goto cleanup;
	}

	if( lseek(in, -sizeof(uint32_t), SEEK_END) == -1 )
	{
		error("Can not seek to eof", 1);
		goto cleanup;
	}

	if( lmo_read32(in, &idx_offset) != 4 )
	{
		error("Unexpected EOF while reading index offset", 0);
		goto cleanup;
	}

	if( lseek(in, (off_t)idx_offset, SEEK_SET) == -1 )
	{
		error("Can not seek to index offset", 1);
		goto cleanup;
	}

	if( (ar = (lmo_archive_t *) malloc(sizeof(lmo_archive_t))) != NULL )
	{
		ar->fd     = in;
		ar->length = idx_offset;

		for( i = idx_offset;
		     i < (s.st_size - sizeof(uint32_t));
		     i += (4 * sizeof(uint32_t))
		) {
			if( (entry = (lmo_entry_t *) malloc(sizeof(lmo_entry_t))) != NULL )
			{
				if( (lmo_read32(ar->fd, &entry->key_id) == 4) &&
				    (lmo_read32(ar->fd, &entry->val_id) == 4) &&
				    (lmo_read32(ar->fd, &entry->offset) == 4) &&
				    (lmo_read32(ar->fd, &entry->length) == 4)
				) {
					entry->next = head;
					head = entry;
				}
				else
				{
					error("Unexpected EOF while reading index entry", 0);
					goto cleanup;
				}
			}
			else
			{
				error("Out of memory", 0);
				goto cleanup;
			}
		}

		ar->index = head;

		if( lseek(ar->fd, 0, SEEK_SET) == -1 )
		{
			error("Can not seek to start", 1);
			goto cleanup;
		}

		if( (ar->mmap = mmap(NULL, ar->length, PROT_READ, MAP_PRIVATE, ar->fd, 0)) == MAP_FAILED )
		{
			error("Failed to memory map archive contents", 1);
			goto cleanup;
		}

		return ar;
	}
	else
	{
		error("Out of memory", 0);
		goto cleanup;
	}


	cleanup:

	if( in > -1 )
		close(in);

	if( head != NULL )
	{
		entry = head;

		while( entry != NULL )
		{
			head = entry->next;
			free(entry);
			entry = head;
		}

		head = entry = NULL;
	}

	if( ar != NULL )
	{
		if( (ar->mmap != NULL) && (ar->mmap != MAP_FAILED) )
			munmap(ar->mmap, ar->length);

		free(ar);
		ar = NULL;
	}

	return NULL;
}

void lmo_close(lmo_archive_t *ar)
{
	lmo_entry_t *head  = NULL;
	lmo_entry_t *entry = NULL;

	if( ar != NULL )
	{
		entry = ar->index;

		while( entry != NULL )
		{
			head = entry->next;
			free(entry);
			entry = head;
		}

		head = entry = NULL;

		if( (ar->mmap != NULL) && (ar->mmap != MAP_FAILED) )
			munmap(ar->mmap, ar->length);

		close(ar->fd);
		free(ar);

		ar = NULL;
	}
}

int lmo_lookup(lmo_archive_t *ar, const char *key, char *dest, int len)
{
	uint32_t look_key = sfh_hash(key, strlen(key));
	int copy_len = -1;
	lmo_entry_t *entry;

	if( !ar )
		return copy_len;

	entry = ar->index;

	while( entry != NULL )
	{
		if( entry->key_id == look_key )
		{
			copy_len = ((len - 1) > entry->length) ? entry->length : (len - 1);
			memcpy(dest, &ar->mmap[entry->offset], copy_len);
			data[copy_len] = '\0';

			break;
		}

		entry = entry->next;
	}

	return copy_len;
}

