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

#include "lib/lmo.h"

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
	int i;

	if (fwrite(ptr, size, nmemb, stream) == 0)
		die("Failed to write");

	for (i = 0; i <	((4 - (size % 4)) % 4); i++)
		if (fputc(0, stream))
			die("Failed to write");
}

static int extract_string(const char *src, char *dest, int len)
{
	int pos = 0;
	int esc = 0;
	int off = -1;

	if (*src == '#')
		return -1;

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

struct msg {
	int plural_num;
	char *ctxt;
	char *id;
	char *id_plural;
	char *val[10];
	size_t len;
	char **cur;
};

static void *array = NULL;
static int n_entries = 0;
static size_t offset = 0;

static void print_msg(struct msg *msg, FILE *out)
{
	char key[4096], *field, *p;
	uint32_t key_id, val_id;
	lmo_entry_t *entry;
	size_t len;
	int esc, i;

	if (msg->id && msg->val[0]) {
		for (i = 0; i <= msg->plural_num; i++) {
			if (!msg->val[i])
				continue;

			if (msg->ctxt && msg->id_plural)
				snprintf(key, sizeof(key), "%s\1%s\2%d", msg->ctxt, msg->id, i);
			else if (msg->ctxt)
				snprintf(key, sizeof(key), "%s\1%s", msg->ctxt, msg->id);
			else if (msg->id_plural)
				snprintf(key, sizeof(key), "%s\2%d", msg->id, i);
			else
				snprintf(key, sizeof(key), "%s", msg->id);

			len = strlen(key);
			key_id = sfh_hash(key, len, len);

			len = strlen(msg->val[i]);
			val_id = sfh_hash(msg->val[i], len, len);

			if (key_id != val_id) {
				n_entries++;
				array = realloc(array, n_entries * sizeof(lmo_entry_t));

				if (!array)
					die("Out of memory");

				entry = (lmo_entry_t *)array + n_entries - 1;
				entry->key_id = key_id;
				entry->val_id = msg->plural_num + 1;
				entry->offset = offset;
				entry->length = strlen(msg->val[i]);

				len = entry->length + ((4 - (entry->length % 4)) % 4);

				print(msg->val[i], entry->length, 1, out);
				offset += len;
			}
		}
	}
	else if (msg->val[0]) {
		for (field = msg->val[0], p = field, esc = 0; *p; p++) {
			if (esc) {
				if (*p == 'n') {
					p[-1] = 0;

					if (!strncasecmp(field, "Plural-Forms: ", 14)) {
						field += 14;

						n_entries++;
						array = realloc(array, n_entries * sizeof(lmo_entry_t));

						if (!array)
							die("Out of memory");

						entry = (lmo_entry_t *)array + n_entries - 1;
						entry->key_id = 0;
						entry->val_id = 0;
						entry->offset = offset;
						entry->length = strlen(field);

						len = entry->length + ((4 - (entry->length % 4)) % 4);

						print(field, entry->length, 1, out);
						offset += len;
						break;
					}

					field = p + 1;
				}

				esc = 0;
			}
			else if (*p == '\\') {
				esc = 1;
			}
		}
	}

	free(msg->ctxt);
	free(msg->id);
	free(msg->id_plural);

	for (i = 0; i < sizeof(msg->val) / sizeof(msg->val[0]); i++)
		free(msg->val[i]);

	memset(msg, 0, sizeof(*msg));
}

int main(int argc, char *argv[])
{
	struct msg msg = { .plural_num = -1 };
	char line[4096], tmp[4096];
	FILE *in, *out;
	ssize_t len;
	int eof;

	if ((argc != 3) || ((in = fopen(argv[1], "r")) == NULL) || ((out = fopen(argv[2], "w")) == NULL))
		usage(argv[0]);

	while (1) {
		line[0] = 0;
		eof = !fgets(line, sizeof(line), in);

		if (!strncmp(line, "msgctxt \"", 9)) {
			if (msg.id || msg.val[0])
				print_msg(&msg, out);
			else
				free(msg.ctxt);

			msg.ctxt = NULL;
			msg.cur = &msg.ctxt;
			msg.len = 0;
		}
		else if (eof || !strncmp(line, "msgid \"", 7)) {
			if (msg.id || msg.val[0])
				print_msg(&msg, out);
			else
				free(msg.id);

			msg.id = NULL;
			msg.cur = &msg.id;
			msg.len = 0;
		}
		else if (!strncmp(line, "msgid_plural \"", 14)) {
			free(msg.id_plural);
			msg.id_plural = NULL;
			msg.cur = &msg.id_plural;
			msg.len = 0;
		}
		else if (!strncmp(line, "msgstr \"", 8) || !strncmp(line, "msgstr[", 7)) {
			if (line[6] == '[')
				msg.plural_num = strtoul(line + 7, NULL, 10);
			else
				msg.plural_num = 0;

			if (msg.plural_num >= 10)
				die("Too many plural forms");

			free(msg.val[msg.plural_num]);
			msg.val[msg.plural_num] = NULL;
			msg.cur = &msg.val[msg.plural_num];
			msg.len = 0;
		}

		if (eof)
			break;

		if (msg.cur) {
			len = extract_string(line, tmp, sizeof(tmp));

			if (len > 0) {
				*msg.cur = realloc(*msg.cur, msg.len + len + 1);

				if (!*msg.cur)
					die("Out of memory");

				memcpy(*msg.cur + msg.len, tmp, len + 1);
				msg.len += len;
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
