/*
 * LuCI Template - Utility functions
 *
 *   Copyright (C) 2010 Jo-Philipp Wich <xm@subsignal.org>
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

#include "template_utils.h"

/* initialize a buffer object */
static struct template_buffer * buf_init(void)
{
	struct template_buffer *buf;

	buf = (struct template_buffer *)malloc(sizeof(struct template_buffer));

	if (buf != NULL)
	{
		buf->fill = 0;
		buf->size = 1024;
		buf->data = (unsigned char *)malloc(buf->size);

		if (buf->data != NULL)
		{
			buf->dptr = buf->data;
			buf->data[0] = 0;

			return buf;
		}

		free(buf);
	}

	return NULL;
}

/* grow buffer */
static int buf_grow(struct template_buffer *buf)
{
	unsigned int off = (buf->dptr - buf->data);
	unsigned char *data =
		(unsigned char *)realloc(buf->data, buf->size + 1024);

	if (data != NULL)
	{
		buf->data  = data;
		buf->dptr  = data + off;
		buf->size += 1024;

		return buf->size;
	}

	return 0;
}

/* put one char into buffer object */
static int buf_putchar(struct template_buffer *buf, unsigned char c)
{
	if( ((buf->fill + 1) >= buf->size) && !buf_grow(buf) )
		return 0;

	*(buf->dptr++) = c;
	*(buf->dptr) = 0;

	buf->fill++;
	return 1;
}

/* append data to buffer */
static int buf_append(struct template_buffer *buf, unsigned char *s, int len)
{
	while ((buf->fill + len + 1) >= buf->size)
	{
		if (!buf_grow(buf))
			return 0;
	}

	memcpy(buf->dptr, s, len);
	buf->fill += len;
	buf->dptr += len;

	*(buf->dptr) = 0;

	return len;
}

/* destroy buffer object and return pointer to data */
static char * buf_destroy(struct template_buffer *buf)
{
	unsigned char *data = buf->data;

	free(buf);
	return (char *)data;
}


/* calculate the number of expected continuation chars */
static inline int mb_num_chars(unsigned char c)
{
	if ((c & 0xE0) == 0xC0)
		return 2;
	else if ((c & 0xF0) == 0xE0)
		return 3;
	else if ((c & 0xF8) == 0xF0)
		return 4;
	else if ((c & 0xFC) == 0xF8)
		return 5;
	else if ((c & 0xFE) == 0xFC)
		return 6;

	return 1;
}

/* test whether the given byte is a valid continuation char */
static inline int mb_is_cont(unsigned char c)
{
	return ((c >= 0x80) && (c <= 0xBF));
}

/* test whether the byte sequence at the given pointer with the given
 * length is the shortest possible representation of the code point */
static inline int mb_is_shortest(unsigned char *s, int n)
{
	switch (n)
	{
		case 2:
			/* 1100000x (10xxxxxx) */
			return ((*s & 0x1E) > 0);

		case 3:
			/* 11100000 100xxxxx (10xxxxxx) */
			return ((*s & 0x1F) > 0) && ((*(s+1) & 0x60) > 0);

		case 4:
			/* 11110000 1000xxxx (10xxxxxx 10xxxxxx) */
			return ((*s & 0x0F) > 0) && ((*(s+1) & 0x70) > 0);

		case 5:
			/* 11111000 10000xxx (10xxxxxx 10xxxxxx 10xxxxxx) */
			return ((*s & 0x07) > 0) && ((*(s+1) & 0x78) > 0);

		case 6:
			/* 11111100 100000xx (10xxxxxx 10xxxxxx 10xxxxxx 10xxxxxx) */
			return ((*s & 0x03) > 0) && ((*(s+1) & 0x7C) > 0);
	}

	return 1;
}

/* test whether the byte sequence at the given pointer with the given
 * length is an UTF-16 surrogate */
static inline int mb_is_surrogate(unsigned char *s, int n)
{
	return ((n == 3) && (*s == 0xED) && (*(s+1) >= 0xA0) && (*(s+1) <= 0xBF));
}

/* test whether the byte sequence at the given pointer with the given
 * length is an illegal UTF-8 code point */
static inline int mb_is_illegal(unsigned char *s, int n)
{
	return ((n == 3) && (*s == 0xEF) && (*(s+1) == 0xBF) &&
			(*(s+2) >= 0xBE) && (*(s+2) <= 0xBF));
}


/* scan given source string, validate UTF-8 sequence and store result
 * in given buffer object */
static int _validate_utf8(unsigned char **s, int l, struct template_buffer *buf)
{
	unsigned char *ptr = *s;
	unsigned int o = 0, v, n;

	//for (o = 0; o < l; o++)
	{
		/* ascii byte without null */
		if ((*(ptr+0) >= 0x01) && (*(ptr+0) <= 0x7F))
		{
			if (!buf_putchar(buf, *ptr++))
				return 0;

			o = 1;
		}

		/* multi byte sequence */
		else if ((n = mb_num_chars(*ptr)) > 1)
		{
			/* count valid chars */
			for (v = 1; (v <= n) && ((o+v) < l) && mb_is_cont(*(ptr+v)); v++);

			switch (n)
			{
				case 6:
				case 5:
					/* five and six byte sequences are always invalid */
					if (!buf_putchar(buf, '?'))
						return 0;

					break;

				default:
					/* if the number of valid continuation bytes matches the
					 * expected number and if the sequence is legal, copy
					 * the bytes to the destination buffer */
					if ((v == n) && mb_is_shortest(ptr, n) &&
						!mb_is_surrogate(ptr, n) && !mb_is_illegal(ptr, n))
					{
						/* copy sequence */
						if (!buf_append(buf, ptr, n))
							return 0;
					}

					/* the found sequence is illegal, skip it */
					else
					{
						/* invalid sequence */
						if (!buf_putchar(buf, '?'))
							return 0;
					}

					break;
			}

			/* advance beyound the last found valid continuation char */
			o = v;
			ptr += v;
		}

		/* invalid byte (0x00) */
		else
		{
			if (!buf_putchar(buf, '?')) /* or 0xEF, 0xBF, 0xBD */
				return 0;

			o = 1;
			ptr++;
		}
	}

	*s = ptr;
	return o;
}

/* sanitize given string and replace all invalid UTF-8 sequences with "?" */
char * sanitize_utf8(const char *s, unsigned int l)
{
	struct template_buffer *buf = buf_init();
	unsigned char *ptr = (unsigned char *)s;

	if (!buf)
		return NULL;

	if (!_validate_utf8(&ptr, l, buf))
	{
		free(buf->data);
		free(buf);
		return NULL;
	}

	return buf_destroy(buf);
}

/* Sanitize given string and strip all invalid XML bytes
 * Validate UTF-8 sequences
 * Escape XML control chars */
char * sanitize_pcdata(const char *s, unsigned int l)
{
	struct template_buffer *buf = buf_init();
	unsigned char *ptr = (unsigned char *)s;
	unsigned int o, v;
	char esq[8];
	int esl;

	if (!buf)
		return NULL;

	for (o = 0; o < l; o++)
	{
		/* Invalid XML bytes */
		if (((*ptr >= 0x00) && (*ptr <= 0x08)) ||
		    ((*ptr >= 0x0B) && (*ptr <= 0x0C)) ||
		    ((*ptr >= 0x0E) && (*ptr <= 0x1F)) ||
		    (*ptr == 0x7F))
		{
			ptr++;
		}

		/* Escapes */
		else if ((*ptr == 0x26) ||
		         (*ptr == 0x27) ||
		         (*ptr == 0x22) ||
		         (*ptr == 0x3C) ||
		         (*ptr == 0x3E))
		{
			esl = snprintf(esq, sizeof(esq), "&#%i;", *ptr);

			if (!buf_append(buf, (unsigned char *)esq, esl))
				break;

			ptr++;
		}

		/* ascii char */
		else if (*ptr <= 0x7F)
		{
			buf_putchar(buf, *ptr++);
		}

		/* multi byte sequence */
		else
		{
			if (!(v = _validate_utf8(&ptr, l - o, buf)))
				break;

			o += (v - 1);
		}
	}

	return buf_destroy(buf);
}
