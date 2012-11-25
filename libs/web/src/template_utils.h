/*
 * LuCI Template - Utility header
 *
 *   Copyright (C) 2010-2012 Jo-Philipp Wich <xm@subsignal.org>
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

#ifndef _TEMPLATE_UTILS_H_
#define _TEMPLATE_UTILS_H_

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <dlfcn.h>


/* buffer object */
struct template_buffer {
	char *data;
	char *dptr;
	unsigned int size;
	unsigned int fill;
};

struct template_buffer * buf_init(int size);
int buf_grow(struct template_buffer *buf, int size);
int buf_putchar(struct template_buffer *buf, char c);
int buf_append(struct template_buffer *buf, const char *s, int len);
int buf_length(struct template_buffer *buf);
char * buf_destroy(struct template_buffer *buf);

char * sanitize_utf8(const char *s, unsigned int l);
char * sanitize_pcdata(const char *s, unsigned int l);

void escape_luastr(struct template_buffer *out, const char *s, unsigned int l, int escape_xml);
void translate_luastr(struct template_buffer *out, const char *s, unsigned int l, int escape_xml);

#endif
