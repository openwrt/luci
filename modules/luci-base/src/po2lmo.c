/*
 * lmo - Lua Machine Objects - PO to LMO conversion tool
 *
 *   Copyright (C) 2009-2012 Jo-Philipp Wich <jow@openwrt.org>
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

#include "template_lmo.h"

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
				switch (src[pos])
				{
				case '"':
				case '\\':
					off++;
					break;
				}
				dest[pos-off] = src[pos];
				esc = 0;
			}
			else if( src[pos] == '\\' )
			{
				dest[pos-off] = src[pos];
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

static int cmp_index(const void *a, const void *b)
{
	uint32_t x = ((const lmo_entry_t *)a)->key_id;
	uint32_t y = ((const lmo_entry_t *)b)->key_id;

	if (x < y)
		return -1;
	else if (x > y)
		return 1;

	return 0;
}

static void print_uint32(uint32_t x, FILE *out)
{
	uint32_t y = htonl(x);
	print(&y, sizeof(uint32_t), 1, out);
}

static void print_index(void *array, int n, FILE *out)
{
	lmo_entry_t *e;

	qsort(array, n, sizeof(*e), cmp_index);

	for (e = array; n > 0; n--, e++)
	{
		print_uint32(e->key_id, out);
		print_uint32(e->val_id, out);
		print_uint32(e->offset, out);
		print_uint32(e->length, out);
	}
}

enum fieldtype {
	UNSPEC        = 0,
	MSG_CTXT      = 1,
	MSG_ID        = 2,
	MSG_ID_PLURAL = 3,
	MSG_STR       = 4
};

int main(int argc, char *argv[])
{
	char line[4096];
	char key[4096];
	char val[4096];
	char tmp[4096];
	int offset = 0;
	int length = 0;
	int n_entries = 0;
	void *array = NULL;
	lmo_entry_t *entry = NULL;
	uint32_t key_id, val_id;
	enum fieldtype type = UNSPEC, prev_type = UNSPEC;
	int plural_num = -1, prev_plural_num = -1;
	char *ctxt = NULL, *id = NULL, *p;
	int eof, esc;

	FILE *in;
	FILE *out;

	if( (argc != 3) || ((in = fopen(argv[1], "r")) == NULL) || ((out = fopen(argv[2], "w")) == NULL) )
		usage(argv[0]);

	while (1) {
		line[0] = 0;
		eof = !fgets(line, sizeof(line), in);

		if (!strncmp(line, "msgctxt \"", 9)) {
			free(ctxt);
			type = MSG_CTXT;
			ctxt = NULL;
		}
		else if (!strncmp(line, "msgid \"", 7)) {
			if (prev_type != MSG_CTXT) {
				free(ctxt);
				ctxt = NULL;
			}

			free(id);
			type = MSG_ID;
			id = NULL;
		}
		else if (!strncmp(line, "msgid_plural \"", 14)) {
			type = MSG_ID_PLURAL;
		}
		else if (!strncmp(line, "msgstr \"", 8) || !strncmp(line, "msgstr[", 7)) {
			type = MSG_STR;

			if (line[6] == '[')
				plural_num = strtoul(line + 7, NULL, 10);
			else
				plural_num = -1;
		}

		if (type != prev_type || plural_num != prev_plural_num || eof) {
			switch (prev_type) {
			case MSG_CTXT:
				ctxt = strdup(val);
				break;

			case MSG_ID:
				id = strdup(val);
				break;

			case MSG_STR:
				if (id && id[0] && val[0]) {
					if (ctxt && ctxt[0] && prev_plural_num > -1)
						snprintf(key, sizeof(key), "%s\1%s\2%d", ctxt, id, prev_plural_num);
					else if (ctxt && ctxt[0])
						snprintf(key, sizeof(key), "%s\1%s", ctxt, id);
					else if (prev_plural_num > -1)
						snprintf(key, sizeof(key), "%s\2%d", id, prev_plural_num);
					else
						snprintf(key, sizeof(key), "%s", id);

					key_id = sfh_hash(key, strlen(key));
					val_id = sfh_hash(val, strlen(val));

					if (key_id != val_id) {
						n_entries++;
						array = realloc(array, n_entries * sizeof(lmo_entry_t));
						entry = (lmo_entry_t *)array + n_entries - 1;

						if (!array)
							die("Out of memory");

						entry->key_id = key_id;
						entry->val_id = prev_plural_num + 1;
						entry->offset = offset;
						entry->length = strlen(val);

						length = strlen(val) + ((4 - (strlen(val) % 4)) % 4);

						print(val, length, 1, out);
						offset += length;
					}
				}
				else if (id && id[0] == 0) {
					for (id = val, p = val; *p; p++) {
						if (esc) {
							if (*p == 'n') {
								p[-1] = 0;

								if (!strncasecmp(id, "Plural-Forms: ", 14)) {
									id += 14;

									n_entries++;
									array = realloc(array, n_entries * sizeof(lmo_entry_t));
									entry = (lmo_entry_t *)array + n_entries - 1;

									if (!array)
										die("Out of memory");

									entry->key_id = 0;
									entry->val_id = 0;
									entry->offset = offset;
									entry->length = strlen(id);

									length = strlen(id) + ((4 - (strlen(id) % 4)) % 4);

									print(id, length, 1, out);
									offset += length;
								}
							}

							id = p + 1;
							esc = 0;
						}
						else if (*p == '\\') {
							esc = 1;
						}
					}

					id = NULL;
				}

				break;

			default:
				break;
			}

			val[0] = 0;
			prev_type = type;
			prev_plural_num = plural_num;
		}

		if (eof)
			break;

		if (prev_type != UNSPEC) {
			switch (extract_string(line, tmp, sizeof(tmp))) {
			case -1:
				type = UNSPEC;
				plural_num = -1;
				break;

			default:
				strcat(val, tmp);
			}
		}
	}

	print_index(array, n_entries, out);

	if (offset > 0) {
		print_uint32(offset, out);
		fsync(fileno(out));
		fclose(out);
	}
	else {
		fclose(out);
		unlink(argv[2]);
	}

	fclose(in);
	return(0);
}
