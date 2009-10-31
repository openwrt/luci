/*
 * lmo - Lua Machine Objects - PO to LMO conversion tool
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

static void die(const char *msg)
{
	fprintf(stderr, "Error: %s\n", msg);
	exit(1);
}

static void usage(const char *name)
{
	fprintf(stderr, "Usage: %s input.po output.lmo\n", name);
	exit(1);
}

static void print(const void *ptr, size_t size, size_t nmemb, FILE *stream)
{
	if( fwrite(ptr, size, nmemb, stream) == 0 )
		die("Failed to write stdout");
}

static int extract_string(const char *src, char *dest, int len)
{
	int pos = 0;
	int esc = 0;
	int off = -1;

	for( pos = 0; (pos < strlen(src)) && (pos < len); pos++ )
	{
		if( (off == -1) && (src[pos] == '"') )
		{
			off = pos + 1;
		}
		else if( off >= 0 )
		{
			if( esc == 1 )
			{
				dest[pos-off] = src[pos];
				esc = 0;
			}
			else if( src[pos] == '\\' )
			{
				off++;
				esc = 1;
				
			}
			else if( src[pos] != '"' )
			{
				dest[pos-off] = src[pos];
			}
			else
			{
				dest[pos-off] = '\0';
				break;
			}
		}
	}

	return (off > -1) ? strlen(dest) : -1;
}

int main(int argc, char *argv[])
{
	char line[4096];
	char key[4096];
	char val[4096];
	char tmp[4096];
	int state  = 0;
	int offset = 0;
	int length = 0;

	FILE *in;
	FILE *out;

	lmo_entry_t *head  = NULL;
	lmo_entry_t *entry = NULL;

	if( (argc != 3) || ((in = fopen(argv[1], "r")) == NULL) || ((out = fopen(argv[2], "w")) == NULL) )
		usage(argv[0]);

	memset(line, 0, sizeof(key));
	memset(key, 0, sizeof(val));
	memset(val, 0, sizeof(val));

	while( (NULL != fgets(line, sizeof(line), in)) || (state >= 3 && feof(in)) )
	{
		if( state == 0 && strstr(line, "msgid \"") == line )
		{
			switch(extract_string(line, key, sizeof(key)))
			{
				case -1:
					die("Syntax error in msgid");
				case 0:
					state = 1;
					break;
				default:
					state = 2;
			}
		}
		else if( state == 1 || state == 2 )
		{
			if( strstr(line, "msgstr \"") == line || state == 2 )
			{
				switch(extract_string(line, val, sizeof(val)))
				{
					case -1:
						state = 4;
						break;
					case 0:
						state = 2;
						break;
					default:
						state = 3;
				}
			}
			else
			{
				switch(extract_string(line, tmp, sizeof(tmp)))
				{
					case -1:
						state = 4;
						break;
					default:
						strcat(key, tmp);
				}
			}
		}
		else if( state == 3 )
		{
			switch(extract_string(line, tmp, sizeof(tmp)))
			{
				case -1:
					state = 4;
					break;
				default:
					strcat(val, tmp);
			}
		}
		else if( state == 4 )
		{
			if( strlen(key) > 0 && strlen(val) > 0 )
			{
				if( (entry = (lmo_entry_t *) malloc(sizeof(lmo_entry_t))) != NULL )
				{
					memset(entry, 0, sizeof(entry));
					length = strlen(val) + ((4 - (strlen(val) % 4)) % 4);

					entry->key_id = htonl(sfh_hash(key, strlen(key)));
					entry->val_id = htonl(sfh_hash(val, strlen(val)));
					entry->offset = htonl(offset);
					entry->length = htonl(strlen(val));

					print(val, length, 1, out);
					offset += length;

					entry->next = head;
					head = entry;
				}
				else
				{
					die("Out of memory");
				}
			}

			state = 0;
			memset(key, 0, sizeof(key));
			memset(val, 0, sizeof(val));
		}

		memset(line, 0, sizeof(line));
	}

	entry = head;
	while( entry != NULL )
	{
		print(&entry->key_id, sizeof(uint32_t), 1, out);
		print(&entry->val_id, sizeof(uint32_t), 1, out);
		print(&entry->offset, sizeof(uint32_t), 1, out);
		print(&entry->length, sizeof(uint32_t), 1, out);
		entry = entry->next;
	}

	if( offset > 0 )
	{
		offset = htonl(offset);
		print(&offset, sizeof(uint32_t), 1, out);
		fsync(fileno(out));
		fclose(out);
	}
	else
	{
		fclose(out);
		unlink(argv[2]);
	}

	fclose(in);
	return(0);
}
