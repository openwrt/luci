/*
 * lmo - Lua Machine Objects - Base functions
 *
 *   Copyright (C) 2009-2010 Jo-Philipp Wich <jow@openwrt.org>
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
#include "plural_formula.h"

/*
 * Hash function from http://www.azillionmonkeys.com/qed/hash.html
 * Copyright (C) 2004-2008 by Paul Hsieh
 */

uint32_t sfh_hash(const char *data, int len)
{
	uint32_t hash = len, tmp;
	int rem;

	if (len <= 0 || data == NULL) return 0;

	rem = len & 3;
	len >>= 2;

	/* Main loop */
	for (;len > 0; len--) {
		hash  += sfh_get16(data);
		tmp    = (sfh_get16(data+2) << 11) ^ hash;
		hash   = (hash << 16) ^ tmp;
		data  += 2*sizeof(uint16_t);
		hash  += hash >> 11;
	}

	/* Handle end cases */
	switch (rem) {
		case 3: hash += sfh_get16(data);
			hash ^= hash << 16;
			hash ^= (signed char)data[sizeof(uint16_t)] << 18;
			hash += hash >> 11;
			break;
		case 2: hash += sfh_get16(data);
			hash ^= hash << 11;
			hash += hash >> 17;
			break;
		case 1: hash += (signed char)*data;
			hash ^= hash << 10;
			hash += hash >> 1;
	}

	/* Force "avalanching" of final 127 bits */
	hash ^= hash << 3;
	hash += hash >> 5;
	hash ^= hash << 4;
	hash += hash >> 17;
	hash ^= hash << 25;
	hash += hash >> 6;

	return hash;
}

uint32_t lmo_canon_hash(const char *str, int len,
                        const char *ctx, int ctxlen, int plural)
{
	char res[4096];
	char *ptr, *end, prev;
	int off;

	if (!str)
		return 0;

	ptr = res;
	end = res + sizeof(res);

	if (ctx)
	{
		for (prev = ' ', off = 0; off < ctxlen; prev = *ctx, off++, ctx++)
		{
			if (ptr >= end)
				return 0;

			if (isspace(*ctx))
			{
				if (!isspace(prev))
					*ptr++ = ' ';
			}
			else
			{
				*ptr++ = *ctx;
			}
		}

		if ((ptr > res) && isspace(*(ptr-1)))
			ptr--;

		if (ptr >= end)
			return 0;

		*ptr++ = '\1';
	}

	for (prev = ' ', off = 0; off < len; prev = *str, off++, str++)
	{
		if (ptr >= end)
			return 0;

		if (isspace(*str))
		{
			if (!isspace(prev))
				*ptr++ = ' ';
		}
		else
		{
			*ptr++ = *str;
		}
	}

	if ((ptr > res) && isspace(*(ptr-1)))
		ptr--;

	if (plural > -1)
	{
		if (plural >= 100 || ptr + 3 >= end)
			return 0;

		ptr += snprintf(ptr, 3, "\2%d", plural);
	}

	return sfh_hash(res, ptr - res);
}

lmo_archive_t * lmo_open(const char *file)
{
	int in = -1;
	uint32_t idx_offset = 0;
	struct stat s;

	lmo_archive_t *ar = NULL;

	if (stat(file, &s) == -1)
		goto err;

	if ((in = open(file, O_RDONLY)) == -1)
		goto err;

	if ((ar = (lmo_archive_t *)malloc(sizeof(*ar))) != NULL)
	{
		memset(ar, 0, sizeof(*ar));

		ar->fd     = in;
		ar->size = s.st_size;

		fcntl(ar->fd, F_SETFD, fcntl(ar->fd, F_GETFD) | FD_CLOEXEC);

		if ((ar->mmap = mmap(NULL, ar->size, PROT_READ, MAP_SHARED, ar->fd, 0)) == MAP_FAILED)
			goto err;

		idx_offset = ntohl(*((const uint32_t *)
		                     (ar->mmap + ar->size - sizeof(uint32_t))));

		if (idx_offset >= ar->size)
			goto err;

		ar->index  = (lmo_entry_t *)(ar->mmap + idx_offset);
		ar->length = (ar->size - idx_offset - sizeof(uint32_t)) / sizeof(lmo_entry_t);
		ar->end    = ar->mmap + ar->size;

		return ar;
	}

err:
	if (in > -1)
		close(in);

	if (ar != NULL)
	{
		if ((ar->mmap != NULL) && (ar->mmap != MAP_FAILED))
			munmap(ar->mmap, ar->size);

		free(ar);
	}

	return NULL;
}

void lmo_close(lmo_archive_t *ar)
{
	if (ar != NULL)
	{
		if ((ar->mmap != NULL) && (ar->mmap != MAP_FAILED))
			munmap(ar->mmap, ar->size);

		close(ar->fd);
		free(ar);

		ar = NULL;
	}
}


lmo_catalog_t *_lmo_catalogs = NULL;
lmo_catalog_t *_lmo_active_catalog = NULL;

int lmo_load_catalog(const char *lang, const char *dir)
{
	DIR *dh = NULL;
	char pattern[16];
	char path[PATH_MAX];
	struct dirent *de = NULL;

	lmo_archive_t *ar = NULL;
	lmo_catalog_t *cat = NULL;

	if (!lmo_change_catalog(lang))
		return 0;

	if (!dir || !(dh = opendir(dir)))
		goto err;

	if (!(cat = malloc(sizeof(*cat))))
		goto err;

	memset(cat, 0, sizeof(*cat));

	snprintf(cat->lang, sizeof(cat->lang), "%s", lang);
	snprintf(pattern, sizeof(pattern), "*.%s.lmo", lang);

	while ((de = readdir(dh)) != NULL)
	{
		if (!fnmatch(pattern, de->d_name, 0))
		{
			snprintf(path, sizeof(path), "%s/%s", dir, de->d_name);
			ar = lmo_open(path);

			if (ar)
			{
				ar->next = cat->archives;
				cat->archives = ar;
			}
		}
	}

	closedir(dh);

	cat->next = _lmo_catalogs;
	_lmo_catalogs = cat;

	if (!_lmo_active_catalog)
		_lmo_active_catalog = cat;

	return cat->archives ? 0 : -1;

err:
	if (dh) closedir(dh);
	if (cat) free(cat);

	return -1;
}

int lmo_change_catalog(const char *lang)
{
	lmo_catalog_t *cat;

	for (cat = _lmo_catalogs; cat; cat = cat->next)
	{
		if (!strncmp(cat->lang, lang, sizeof(cat->lang)))
		{
			_lmo_active_catalog = cat;
			return 0;
		}
	}

	return -1;
}

static lmo_entry_t * lmo_find_entry(lmo_archive_t *ar, uint32_t hash)
{
	unsigned int m, l, r;
	uint32_t k;

	l = 0;
	r = ar->length - 1;

	while (1)
	{
		m = l + ((r - l) / 2);

		if (r < l)
			break;

		k = ntohl(ar->index[m].key_id);

		if (k == hash)
			return &ar->index[m];

		if (k > hash)
		{
			if (!m)
				break;

			r = m - 1;
		}
		else
		{
			l = m + 1;
		}
	}

	return NULL;
}

void *pluralParseAlloc(void *(*)(size_t));
void pluralParse(void *, int, int, void *);
void pluralParseFree(void *, void (*)(void *));

static int lmo_eval_plural(const char *expr, int len, int val)
{
	struct { int num; int res; } s = { .num = val, .res = -1 };
	const char *p = NULL;
	void *pParser = NULL;
	int t, n;
	char c;

	while (len > 7) {
		if (*expr == 'p') {
			if (!strncmp(expr, "plural=", 7)) {
				p = expr + 7;
				len -= 7;
				break;
			}
		}

		expr++;
		len--;
	}

	if (!p)
		goto out;

	pParser = pluralParseAlloc(malloc);

	if (!pParser)
		goto out;

	while (len-- > 0) {
		c = *p++;
		t = -1;
		n = 0;

		switch (c) {
		case ' ':
		case '\t':
			continue;

		case '0': case '1': case '2': case '3': case '4':
		case '5': case '6': case '7': case '8': case '9':
			t = T_NUM;
			n = c - '0';

			while (*p >= '0' && *p <= '9') {
				n *= 10;
				n += *p - '0';
				p++;
			}

			break;

		case '=':
			if (*p == '=') {
				t = T_EQ;
				p++;
			}

			break;

		case '!':
			if (*p == '=') {
				t = T_NE;
				p++;
			}
			else {
				t = T_NOT;
			}

			break;

		case '&':
			if (*p == '&') {
				t = T_AND;
				p++;
			}

			break;

		case '|':
			if (*p == '|') {
				t = T_OR;
				p++;
			}

			break;

		case '<':
			if (*p == '=') {
				t = T_LE;
				p++;
			}
			else {
				t = T_LT;
			}

			break;

		case '>':
			if (*p == '=') {
				t = T_GE;
				p++;
			}
			else {
				t = T_GT;
			}

			break;

		case '*':
			t = T_MUL;
			break;

		case '/':
			t = T_DIV;
			break;

		case '%':
			t = T_MOD;
			break;

		case '+':
			t = T_ADD;
			break;

		case '-':
			t = T_SUB;
			break;

		case 'n':
			t = T_N;
			break;

		case '?':
			t = T_QMARK;
			break;

		case ':':
			t = T_COLON;
			break;

		case '(':
			t = T_LPAREN;
			break;

		case ')':
			t = T_RPAREN;
			break;

		case ';':
		case '\n':
		case '\0':
			t = 0;
			break;
		}

		/* syntax error */
		if (t < 0)
			goto out;

		pluralParse(pParser, t, n, &s);

		/* eof */
		if (t == 0)
			break;
	}

	pluralParse(pParser, 0, 0, &s);

out:
	pluralParseFree(pParser, free);

	return s.res;
}

int lmo_translate(const char *key, int keylen, char **out, int *outlen)
{
	return lmo_translate_ctxt(key, keylen, NULL, 0, out, outlen);
}

int lmo_translate_ctxt(const char *key, int keylen,
                       const char *ctx, int ctxlen,
                       char **out, int *outlen)
{
	uint32_t hash;
	lmo_entry_t *e;
	lmo_archive_t *ar;

	if (!key || !_lmo_active_catalog)
		return -2;

	hash = lmo_canon_hash(key, keylen, ctx, ctxlen, -1);

	if (hash > 0)
	{
		for (ar = _lmo_active_catalog->archives; ar; ar = ar->next)
		{
			if ((e = lmo_find_entry(ar, hash)) != NULL)
			{
				*out = ar->mmap + ntohl(e->offset);
				*outlen = ntohl(e->length);
				return 0;
			}
		}
	}

	return -1;
}

int lmo_translate_plural(int n, const char *skey, int skeylen,
                                const char *pkey, int pkeylen,
                                char **out, int *outlen)
{
	return lmo_translate_plural_ctxt(n, skey, skeylen, pkey, pkeylen,
	                                 NULL, 0, out, outlen);
}

int lmo_translate_plural_ctxt(int n, const char *skey, int skeylen,
                                     const char *pkey, int pkeylen,
                                     const char *ctx, int ctxlen,
                                     char **out, int *outlen)
{
	int pid = -1;
	uint32_t hash;
	lmo_entry_t *e;
	lmo_archive_t *ar;
	const char *plural_formula;

	if (!skey || !pkey || !_lmo_active_catalog)
		return -2;

	for (ar = _lmo_active_catalog->archives; ar; ar = ar->next) {
		e = lmo_find_entry(ar, 0);

		if (e != NULL) {
			pid = lmo_eval_plural(ar->mmap + ntohl(e->offset), ntohl(e->length), n);
			break;
		}
	}

	if (pid == -1)
		pid = (n != 1);

	hash = lmo_canon_hash(skey, skeylen, ctx, ctxlen, pid);

	if (hash == 0)
		return -1;

	for (ar = _lmo_active_catalog->archives; ar; ar = ar->next)
	{
		if ((e = lmo_find_entry(ar, hash)) != NULL)
		{
			*out = ar->mmap + ntohl(e->offset);
			*outlen = ntohl(e->length);
			return 0;
		}
	}

	if (n != 1)
	{
		*out = (char *)pkey;
		*outlen = pkeylen;
	}
	else
	{
		*out = (char *)skey;
		*outlen = skeylen;
	}

	return 0;
}

void lmo_iterate(lmo_iterate_cb_t cb, void *priv)
{
	unsigned int i;
	lmo_entry_t *e;
	lmo_archive_t *ar;

	if (!_lmo_active_catalog)
		return;

	for (ar = _lmo_active_catalog->archives; ar; ar = ar->next)
		for (i = 0, e = &ar->index[0]; i < ar->length; e = &ar->index[++i])
			cb(ntohl(e->key_id), ar->mmap + ntohl(e->offset), ntohl(e->length), priv);
}

void lmo_close_catalog(const char *lang)
{
	lmo_archive_t *ar, *next;
	lmo_catalog_t *cat, *prev;

	for (prev = NULL, cat = _lmo_catalogs; cat; prev = cat, cat = cat->next)
	{
		if (!strncmp(cat->lang, lang, sizeof(cat->lang)))
		{
			if (prev)
				prev->next = cat->next;
			else
				_lmo_catalogs = cat->next;

			for (ar = cat->archives; ar; ar = next)
			{
				next = ar->next;
				lmo_close(ar);
			}

			free(cat);
			break;
		}
	}
}
