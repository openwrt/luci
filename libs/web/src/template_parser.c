/*
 * LuCI Template - Parser implementation
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

#include "template_parser.h"


/* leading and trailing code for different types */
const char * gen_code[6][2] = {
	{ "write(\"",			"\")"	},
	{ NULL,					NULL	},
	{ "write(tostring(",	"))"	},
	{ "include(\"",			"\")"	},
	{ "write(translate(\"",	"\"))"	},
	{ NULL,					" "		}
};

/* Simple strstr() like function that takes len arguments for both haystack and needle. */
static char *strfind(char *haystack, int hslen, const char *needle, int ndlen)
{
	int match = 0;
	int i, j;

	for( i = 0; i < hslen; i++ )
	{
		if( haystack[i] == needle[0] )
		{
			match = ((ndlen == 1) || ((i + ndlen) <= hslen));

			for( j = 1; (j < ndlen) && ((i + j) < hslen); j++ )
			{
				if( haystack[i+j] != needle[j] )
				{
					match = 0;
					break;
				}
			}

			if( match )
				return &haystack[i];
		}
	}

	return NULL;
}

/* 
 * Inspect current read buffer and find the number of "vague" characters at the end 
 * which could indicate an opening token. Returns the number of "vague" chars.
 * The last continuous sequence of whitespace, optionally followed by a "<" is
 * treated as "vague" because whitespace may be discarded if the upcoming opening
 * token indicates pre-whitespace-removal ("<%-"). A single remaining "<" char 
 * can't be differentiated from an opening token ("<%"), so it's kept to be processed
 * in the next cycle.
 */
static int stokscan(struct template_parser *data, int off, int no_whitespace)
{
	int i;
	int skip = 0;
	int tokoff = data->bufsize - 1;

	for( i = tokoff; i >= off; i-- )
	{
		if( data->buf[i] == T_TOK_START[0] )
		{
			skip = tokoff - i + 1;
			tokoff = i - 1;
			break;
		}
	}

	if( !no_whitespace )
	{
		for( i = tokoff; i >= off; i-- )
		{
			if( isspace(data->buf[i]) )
				skip++;
			else
				break;
		}
	}

	return skip;
}

/*
 * Similar to stokscan() but looking for closing token indicators.
 * Matches "-", optionally followed by a "%" char.
 */
static int etokscan(struct template_parser *data)
{
	int skip = 0;

	if( (data->bufsize > 0) && (data->buf[data->bufsize-1] == T_TOK_END[0]) )
		skip++;

	if( (data->bufsize > skip) && (data->buf[data->bufsize-skip-1] == T_TOK_SKIPWS[0]) )
		skip++;

	return skip;
}

/*
 * Generate Lua expressions from the given raw code, write it into the
 * output buffer and set the lua_Reader specific size pointer.
 * Takes parser-state, lua_Reader's size pointer and generator flags
 * as parameter. The given flags indicate whether leading or trailing
 * code should be added. Returns a pointer to the output buffer.
 */
static const char * generate_expression(struct template_parser *data, size_t *sz, int what)
{
	char tmp[T_OUTBUFSZ];
	int i;
	int size = 0;
	int start = 0;
	int i18n_hasdef = 0;

	memset(tmp, 0, T_OUTBUFSZ);

	/* Inject leading expression code (if any) */
	if( (what & T_GEN_START) && (gen_code[data->type][0] != NULL) )
	{
		memcpy(tmp, gen_code[data->type][0], strlen(gen_code[data->type][0]));
		size += strlen(gen_code[data->type][0]);
	}

	/* Parse source buffer */
	for( i = 0; i < data->outsize; i++ )
	{
		/* Skip leading whitespace for non-raw and non-expr chunks */
		if( !start && isspace(data->out[i]) && (data->type == T_TYPE_I18N || data->type == T_TYPE_INCLUDE) )
			continue;
		else if( !start )
			start = 1;

		/* Found whitespace after i18n key */
		if( (data->type == T_TYPE_I18N) && (i18n_hasdef == 1) )
		{
			/* At non-whitespace char, inject seperator token */
			if( !isspace(data->out[i]) )
			{
				memcpy(&tmp[size], T_TOK_I18NSEP, strlen(T_TOK_I18NSEP));
				size += strlen(T_TOK_I18NSEP);
				i18n_hasdef = 2;
			}

			/* At further whitespace, skip */
			else
			{
				continue;
			}
		}

		/* Escape quotes, backslashes and newlines for plain, i18n and include expressions */
		if( (data->type == T_TYPE_TEXT || data->type == T_TYPE_I18N || data->type == T_TYPE_INCLUDE) &&
		    (data->out[i] == '\\' || data->out[i] == '"' || data->out[i] == '\n' || data->out[i] == '\t') )
		{
			tmp[size++] = '\\';

			switch(data->out[i])
			{
				case '\n':
					tmp[size++] = 'n';
					break;

				case '\t':
					tmp[size++] = 't';
					break;

				default:
					tmp[size++] = data->out[i];
			}
		}

		/* Found whitespace in i18n expression, raise flag */
		else if( isspace(data->out[i]) && (data->type == T_TYPE_I18N) )
		{
			i18n_hasdef = 1;
		}

		/* Normal char */
		else
		{
			tmp[size++] = data->out[i];
		}
	}

	/* Processed i18n expression without default text, inject separator */
	if( (data->type == T_TYPE_I18N) && (i18n_hasdef < 2) )
	{
		memcpy(&tmp[size], T_TOK_I18NSEP, strlen(T_TOK_I18NSEP));
		size += strlen(T_TOK_I18NSEP);
	}

	/* Inject trailing expression code (if any) */
	if( (what & T_GEN_END) && (gen_code[data->type][1] != NULL) )
	{
		memcpy(&tmp[size], gen_code[data->type][1], strlen(gen_code[data->type][1]));
		size += strlen(gen_code[data->type][1]);
	}

	*sz = data->outsize = size;
	memset(data->out, 0, T_OUTBUFSZ);
	memcpy(data->out, tmp, size);

	//printf("<<<%i|%i|%i|%s>>>\n", what, data->type, *sz, data->out);

	return data->out;
}

/*
 * Move the number of bytes specified in data->bufsize from the
 * given source pointer to the beginning of the read buffer.
 */
static void bufmove(struct template_parser *data, const char *src)
{
	if( data->bufsize > 0 )
		memmove(data->buf, src, data->bufsize);
	else if( data->bufsize < 0 )
		data->bufsize = 0;

	data->buf[data->bufsize] = 0;
}

/*
 * Move the given amount of bytes from the given source pointer
 * to the output buffer and set data->outputsize.
 */
static void bufout(struct template_parser *data, const char *src, int len)
{
	if( len >= 0 )
	{
		memset(data->out, 0, T_OUTBUFSZ);
		memcpy(data->out, src, len);
		data->outsize = len;
	}
	else
	{
		data->outsize = 0;
	}
}

/*
 * lua_Reader compatible function that parses template code on demand from
 * the given file handle.
 */
const char *template_reader(lua_State *L, void *ud, size_t *sz)
{
	struct template_parser *data = ud;
	char *match = NULL;
	int off = 0;
	int ignore = 0;
	int genflags = 0;
	int readlen = 0;
	int vague = 0;

	while( !(data->flags & T_FLAG_EOF) || (data->bufsize > 0) )
	{
		/* Fill buffer */
		if( !(data->flags & T_FLAG_EOF) && (data->bufsize < T_READBUFSZ) )
		{
			if( (readlen = read(data->fd, &data->buf[data->bufsize], T_READBUFSZ - data->bufsize)) > 0 )
				data->bufsize += readlen;
			else if( readlen == 0 )
				data->flags |= T_FLAG_EOF;
			else
				return NULL;
		}

		/* Evaluate state */
		switch(data->state)
		{
			/* Plain text chunk (before "<%") */
			case T_STATE_TEXT_INIT:
			case T_STATE_TEXT_NEXT:
				off = 0; ignore = 0; *sz = 0;
				data->type = T_TYPE_TEXT;

				/* Skip leading whitespace if requested */
				if( data->flags & T_FLAG_SKIPWS )
				{
					data->flags &= ~T_FLAG_SKIPWS;
					while( (off < data->bufsize) && isspace(data->buf[off]) )
						off++;
				}

				/* Found "<%" */
				if( (match = strfind(&data->buf[off], data->bufsize - off - 1, T_TOK_START, strlen(T_TOK_START))) != NULL )
				{
					readlen = (int)(match - &data->buf[off]);
					data->bufsize -= (readlen + strlen(T_TOK_START) + off);
					match += strlen(T_TOK_START);

					/* Check for leading '-' */
					if( match[0] == T_TOK_SKIPWS[0] )
					{
						data->bufsize--;
						match++;

						while( (readlen > 1) && isspace(data->buf[off+readlen-1]) )
						{
							readlen--;
						}
					}

					bufout(data, &data->buf[off], readlen);
					bufmove(data, match);
					data->state = T_STATE_CODE_INIT;
				}

				/* Maybe plain chunk */
				else
				{
					/* Preserve trailing "<" or white space, maybe a start token */
					vague = stokscan(data, off, 0);

					/* We can process some bytes ... */
					if( vague < data->bufsize )
					{
						readlen = data->bufsize - vague - off;
					}

					/* No bytes to process, so try to remove at least whitespace ... */
					else
					{
						/* ... but try to preserve trailing "<" ... */
						vague = stokscan(data, off, 1);

						if( vague < data->bufsize )
						{
							readlen = data->bufsize - vague - off;
						}

						/* ... no chance, push out buffer */
						else
						{
							readlen = vague - off;
							vague   = 0;
						}
					}

					bufout(data, &data->buf[off], readlen);

					data->state   = T_STATE_TEXT_NEXT;
					data->bufsize = vague;
					bufmove(data, &data->buf[off+readlen]);
				}

				if( ignore || data->outsize == 0 )
					continue;
				else
					return generate_expression(data, sz, T_GEN_START | T_GEN_END);

				break;

			/* Ignored chunk (inside "<%# ... %>") */
			case T_STATE_SKIP:
				ignore = 1;

			/* Initial code chunk ("<% ...") */
			case T_STATE_CODE_INIT:
				off = 0;

				/* Check for leading '-' */
				if( data->buf[off] == T_TOK_SKIPWS[0] )
					off++;

				/* Determine code type */
				switch(data->buf[off])
				{
					case '#':
						ignore = 1;
						off++;
						data->type = T_TYPE_COMMENT;
						break;

					case '=':
						off++;
						data->type = T_TYPE_EXPR;
						break;

					case '+':
						off++;
						data->type = T_TYPE_INCLUDE;
						break;

					case ':':
						off++;
						data->type = T_TYPE_I18N;
						break;

					default:
						data->type = T_TYPE_CODE;
						break;
				}

			/* Subsequent code chunk ("..." or "... %>") */ 
			case T_STATE_CODE_NEXT:
				/* Found "%>" */
				if( (match = strfind(&data->buf[off], data->bufsize - off, T_TOK_END, strlen(T_TOK_END))) != NULL )
				{
					genflags = ( data->state == T_STATE_CODE_INIT )
						? (T_GEN_START | T_GEN_END) : T_GEN_END;

					readlen = (int)(match - &data->buf[off]);

					/* Check for trailing '-' */
					if( (match > data->buf) && (*(match-1) == T_TOK_SKIPWS[0]) )
					{
						readlen--;
						data->flags |= T_FLAG_SKIPWS;
					}

					bufout(data, &data->buf[off], readlen);

					data->state = T_STATE_TEXT_INIT;
					data->bufsize -= ((int)(match - &data->buf[off]) + strlen(T_TOK_END) + off);
					bufmove(data, &match[strlen(T_TOK_END)]);
				}

				/* Code chunk */
				else
				{
					genflags = ( data->state == T_STATE_CODE_INIT ) ? T_GEN_START : 0;

					/* Preserve trailing "%" and "-", maybe an end token */
					vague   = etokscan(data);
					readlen = data->bufsize - off - vague;
					bufout(data, &data->buf[off], readlen);

					data->state   = T_STATE_CODE_NEXT;
					data->bufsize = vague;
					bufmove(data, &data->buf[readlen+off]);
				}

				if( ignore || (data->outsize == 0 && !genflags) )
					continue;
				else
					return generate_expression(data, sz, genflags);

				break;
		}
	}

	*sz = 0;
	return NULL;
}


