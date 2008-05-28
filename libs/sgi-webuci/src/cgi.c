/*
 * CGI routines for luci
 * Copyright (C) 2008 Felix Fietkau <nbd@openwrt.org>

 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/* 
 * Based on code from cgilib:
 * 
 *   cgi.c - Some simple routines for CGI programming
 *   Copyright (c) 1996-9,2007,8  Martin Schulze <joey@infodrom.org>
 *
 *   This program is free software; you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation; either version 2 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program; if not, write to the Free Software Foundation
 *   Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

#define _GNU_SOURCE 1

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <stdbool.h>
#include <strings.h>
#include <ctype.h>
#include <lauxlib.h>

#define BUFSIZE 128

static char *
cgiGetLine (FILE *stream)
{
	static char *line = NULL;
	static size_t size = 0;
	char buf[BUFSIZE];
	char *cp;

	if (!line) {
		if ((line = (char *)malloc (BUFSIZE)) == NULL)
			return NULL;
		size = BUFSIZE;
	}
	line[0] = '\0';

	while (!feof (stream)) {
		if ((cp = fgets (buf, sizeof (buf), stream)) == NULL)
			return NULL;

		if (strlen(line)+strlen(buf)+1 > size) {
			if ((cp = (char *)realloc (line, size + BUFSIZE)) == NULL)
				return line;
			size += BUFSIZE;
			line = cp;
		}

		strcat (line, buf);
		if (line[strlen(line)-1] == '\n') {
			line[strlen(line)-1] = '\0';
			if (line[strlen(line)-1] == '\r')
				line[strlen(line)-1] = '\0';
			return line;
		}
	}

	return NULL;
}


static const char *
luci_getenv(lua_State *L, const char *name)
{
	const char *ret;

	lua_getfield(L, lua_upvalueindex(2), name);
	ret = lua_tostring(L, -1);
	lua_pop(L, 1);
	return ret;
}

static void
luci_setvar(lua_State *L, const char *name, const char *value, bool append)
{
	/* Check if there is an existing value already */
	lua_getfield(L, lua_upvalueindex(1), name);
	if (lua_isnil(L, -1)) {
		/* nope, we're safe - add a new one */
		lua_pushstring(L, value);
		lua_setfield(L, lua_upvalueindex(1), name);
	} else if (lua_istable(L, -1) && append) {
		/* it's a table already, but appending is requested
		 * take the last element and append the new string to it */
		int tlast = lua_objlen(L, -1);
		lua_rawgeti(L, -1, tlast);
		lua_pushstring(L, value);
		lua_pushstring(L, "\n");
		lua_concat(L, 3);
		lua_rawseti(L, -2, tlast);
	} else if (lua_istable(L, -1)) {
		/* it's a table, which means we already have two
		 * or more entries, add the next one */

		int tnext = lua_objlen(L, -1) + 1; /* next entry */

		lua_pushstring(L, value);
		luaL_setn(L, -2, tnext);
		lua_rawseti(L, -2, tnext);
	} else if (lua_isstring(L, -1) && append) {
		/* append the new string to the existing variable */
		lua_pushstring(L, value);
		lua_pushstring(L, "\n");
		lua_concat(L, 3);
		lua_setfield(L, lua_upvalueindex(1), name);
	} else if (lua_isstring(L, -1)) {
		/* we're trying to add a variable that already has
		 * a string value. convert the string value to a
		 * table and add our new value to the table as well
		 */
		lua_createtable(L, 2, 0);
		lua_pushvalue(L, -2); /* copy of the initial string value */
		lua_rawseti(L, -2, 1);

		lua_pushstring(L, value);
		lua_rawseti(L, -2, 2);
		lua_setfield(L, lua_upvalueindex(1), name);
	} else {
		luaL_error(L, "Invalid table entry type for index '%s'", name);
	}
}

char *cgiDecodeString (char *text)
{
	char *cp, *xp;

	for (cp=text,xp=text; *cp; cp++) {
		if (*cp == '%') {
			if (strchr("0123456789ABCDEFabcdef", *(cp+1))
				&& strchr("0123456789ABCDEFabcdef", *(cp+2))) {
				if (islower(*(cp+1)))
					*(cp+1) = toupper(*(cp+1));
				if (islower(*(cp+2)))
					*(cp+2) = toupper(*(cp+2));
				*(xp) = (*(cp+1) >= 'A' ? *(cp+1) - 'A' + 10 : *(cp+1) - '0' ) * 16
					+ (*(cp+2) >= 'A' ? *(cp+2) - 'A' + 10 : *(cp+2) - '0');
				xp++;cp+=2;
			}
		} else {
			*(xp++) = *cp;
		}
	}
	memset(xp, 0, cp-xp);
	return text;
}

#if 0
/* cgiReadFile()
 *
 * Read and save a file fro a multipart request
 */
#include <errno.h>
char *cgiReadFile (FILE *stream, char *boundary)
{
	char *crlfboundary, *buf;
	size_t boundarylen;
	int c;
	unsigned int pivot;
	char *cp;
	char template[]= "/tmp/cgilibXXXXXX";
	FILE *tmpfile;
	int fd;

	boundarylen = strlen(boundary)+3;
	if ((crlfboundary = (char *)malloc (boundarylen)) == NULL)
		return NULL;
	sprintf (crlfboundary, "\r\n%s", boundary);

	if ((buf = (char *)malloc (boundarylen)) == NULL) {
		free (crlfboundary);
		return NULL;
	}
	memset (buf, 0, boundarylen);
	pivot = 0;

	if ((fd = mkstemp (template)) == -1) {
		free (crlfboundary);
		free (buf);
		return NULL;
	}

	if ((tmpfile = fdopen (fd, "w")) == NULL) {
		free (crlfboundary);
		free (buf);
		unlink (template);
		return NULL;
	}
	
	while (!feof (stream)) {
		c = fgetc (stream);

		if (c == 0) {
			if (strlen (buf)) {
				for (cp=buf; *cp; cp++)
					putc (*cp, tmpfile);
				memset (buf, 0, boundarylen);
				pivot = 0;
			}
			putc (c, tmpfile);
			continue;
		}

		if (strlen (buf)) {
			if (crlfboundary[pivot+1] == c) {
				buf[++pivot] = c;

				if (strlen (buf) == strlen (crlfboundary))
					break;
				else
					continue;
			} else {
				for (cp=buf; *cp; cp++)
					putc (*cp, tmpfile);
				memset (buf, 0, boundarylen);
				pivot = 0;
			}
		}

		if (crlfboundary[0] == c) {
			buf[0] = c;
		} else {
			fputc (c, tmpfile);
		}
	}

	if (!feof (stream))
		fgets (buf, boundarylen, stream);

	fclose (tmpfile);

	free (crlfboundary);
	free (buf);

	return strdup (template);
}
#endif

/*
 * Decode multipart/form-data
 */
#define MULTIPART_DELTA 5
void luci_parse_multipart (lua_State *L, char *boundary)
{
	char *line;
	char *cp, *xp;
	char *name = NULL, *type = NULL;
	char *fname = NULL;
	int header = 1;
	bool append = false;

	while ((line = cgiGetLine (stdin)) != NULL) {
		if (!strncmp (line, boundary, strlen(boundary))) {
			header = 1;
			if (name)
				free(name);
			if (type)
				free(type);
			name = NULL;
			type = NULL;
			append = false;
		} else if (header && !name && !strncasecmp (line, "Content-Disposition: form-data; ", 32)) {
			if ((cp = strstr (line, "name=\"")) == NULL)
				continue;
			cp += 6;
			if ((xp = strchr (cp, '\"')) == NULL)
				continue;
			name = malloc(xp-cp + 1);
			strncpy(name, cp, xp-cp);
			name[xp-cp] = 0;
			cgiDecodeString (name);

			if ((cp = strstr (line, "filename=\"")) == NULL)
				continue;
			cp += 10;
			if ((xp = strchr (cp, '\"')) == NULL)
				continue;
			fname = malloc(xp-cp + 1);
			strncpy(fname, cp, xp-cp);
			fname[xp-cp] = 0;
			cgiDecodeString (fname);
		} else if (header && !type && !strncasecmp (line, "Content-Type: ", 14)) {
			cp = line + 14;
			type = strdup (cp);
		} else if (header) {
			if (!strlen(line)) {
				header = 0;

				if (fname) {
#if 0
					header = 1;
					tmpfile = cgiReadFile (stdin, boundary);

					if (!tmpfile) {
						free (name);
						free (fname);
						if (type)
							free (type);
						name = fname = type = NULL;
					}

					cgiDebugOutput (2, "Wrote %s (%s) to file: %s", name, fname, tmpfile);

					if (!strlen (fname)) {
						cgiDebugOutput (3, "Found empty filename, removing");
						unlink (tmpfile);
						free (tmpfile);
						free (name);
						free (fname);
						if (type)
							free (type);
						name = fname = type = NULL;
					} else {
						if ((file = (s_file *)malloc (sizeof (s_file))) == NULL) {
							cgiDebugOutput (3, "malloc failed, ignoring %s=%s", name, fname);
							unlink (tmpfile);
							free (tmpfile);
							free (name);
							free (fname);
							if (type)
								free (type);
							name = fname = type = NULL;
							continue;
						}

						file->name = name;
						file->type = type;
						file->tmpfile = tmpfile;
						if ((cp = rindex (fname, '/')) == NULL)
							file->filename = fname;
						else {
							file->filename = strdup (++cp);
							free (fname);
						}
						name = type = fname = NULL;

						if (!files) {
							if ((files = (s_file **)malloc(2*sizeof (s_file *))) == NULL) {
								cgiDebugOutput (3, "malloc failed, ignoring %s=%s", name, fname);
								unlink (tmpfile);
								free (tmpfile);
								free (name);
								name = NULL;
								if (type) {
									free (type);
									type = NULL;
								}
								free (file->filename);
								free (file);
								continue;
							}
							memset (files, 0, 2*sizeof (s_file *));
							index = 0;
						} else {
							for (index=0; files[index]; index++);
							if ((tmpf = (s_file **)realloc(files, (index+2)*sizeof (s_file *))) == NULL) {
								cgiDebugOutput (3, "realloc failed, ignoring %s=%s", name, fname);
								unlink (tmpfile);
								free (tmpfile);
								free (name);
								if (type)
									free (type);
								free (file->filename);
								free (file);
								name = type = fname = NULL;
								continue;
							}
							files = tmpf;
							memset (files + index, 0, 2*sizeof (s_file *));
						}
						files[index] = file;
					}
#else
					free(fname);
					fname = NULL;
#endif
				}
			}
		} else {
			if (!name)
				return;

			cgiDecodeString(line);
			luci_setvar(L, name, line, append);
			if (!append) /* beginning of variable contents */
				append = true;
		}
	}
}

/* parse the request header and store variables
 * in the array supplied as function argument 1 on the stack
 */
int luci_parse_header (lua_State *L)
{
	int length;
	char *line = NULL;
	int numargs;
	char *cp = NULL, *ip = NULL, *esp = NULL;
	const char *ct, *il;
	int i;

	if (!lua_istable(L, lua_upvalueindex(1)))
		luaL_error(L, "Invalid argument");

	if (!lua_istable(L, lua_upvalueindex(2)))
		luaL_error(L, "Invalid argument");

	ct = luci_getenv(L, "content_type");
	if (ct) {
		ct = cp = strdup(ct);
	}
	if (cp && strstr(cp, "multipart/form-data") && strstr(cp, "boundary=")) {
		cp = strstr(cp, "boundary=") + strlen ("boundary=") - 2;
		*cp = *(cp+1) = '-';
		luci_parse_multipart(L, cp);
		free((char *) ct);
		return 0;
	}
	free((char *) ct);

	ct = luci_getenv(L, "request_method");
	il = luci_getenv(L, "content_length");

	if (!ct) {
		fprintf(stderr, "no request method!\n");
		return 0;
	}

	if (!strcmp(ct, "POST")) {
		if (il) {
			length = atoi(il);
			if (length <= 0)
				return 0;
			line = (char *)malloc (length+2);
			if (line)
				fgets(line, length+1, stdin);
		}
	} else if (!strcmp(ct, "GET")) {
		ct = luci_getenv(L, "query_string");
		if (ct)
			esp = strdup(ct);
		if (esp && strlen(esp)) {
			line = (char *)malloc (strlen(esp)+2);
			if (line)
				strcpy (line, esp);
		}
		free(esp);
	}

	if (!line)
		return 0;

	/*
	 *  From now on all cgi variables are stored in the variable line
	 *  and look like  foo=bar&foobar=barfoo&foofoo=
	 */
	for (cp=line; *cp; cp++)
		if (*cp == '+')
			*cp = ' ';

	if (strlen(line)) {
		for (numargs=1,cp=line; *cp; cp++)
			if (*cp == '&' || *cp == ';' ) numargs++;
	} else
		numargs = 0;

	cp = line;
	i=0;
	while (*cp) {
		char *name;
		char *value;

		if ((ip = (char *)strchr(cp, '&')) != NULL) {
			*ip = '\0';
		} else if ((ip = (char *)strchr(cp, ';')) != NULL) {
			*ip = '\0';
		} else
			ip = cp + strlen(cp);

		if ((esp=(char *)strchr(cp, '=')) == NULL)
			goto skip;

		if (!strlen(esp))
			goto skip;

		if (i >= numargs)
			goto skip;

		esp[0] = 0;
		name = cp;
		cgiDecodeString (name);

		cp = ++esp;
		value = cp;
		cgiDecodeString (value);

		luci_setvar(L, name, value, false);
skip:
		cp = ++ip;
	}
	free(line);
	return 0;
}

