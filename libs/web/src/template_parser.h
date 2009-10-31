/*
 * LuCI Template - Parser header
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

#ifndef _TEMPLATE_PARSER_H_
#define _TEMPLATE_PARSER_H_

#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
#include <ctype.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>


#define T_READBUFSZ			1024
#define T_OUTBUFSZ			T_READBUFSZ * 3

/* parser states */
#define T_STATE_TEXT_INIT	0
#define T_STATE_TEXT_NEXT	1
#define T_STATE_CODE_INIT	2
#define T_STATE_CODE_NEXT	3
#define T_STATE_SKIP 		4

/* parser flags */
#define T_FLAG_EOF			0x01
#define T_FLAG_SKIPWS		0x02

/* tokens used in matching and expression generation */
#define T_TOK_START			"<%"
#define T_TOK_END			"%>"
#define T_TOK_SKIPWS		"-"

/* generator flags */
#define T_GEN_START			0x01
#define T_GEN_END			0x02

/* code types */
#define T_TYPE_TEXT			0
#define T_TYPE_COMMENT		1
#define T_TYPE_EXPR			2
#define T_TYPE_INCLUDE 		3
#define T_TYPE_I18N			4
#define T_TYPE_I18N_RAW		5
#define T_TYPE_CODE			6

/* parser state */
struct template_parser {
	int fd;
	int bufsize;
	int outsize;
	int state;
	int flags;
	int type;
	char buf[T_READBUFSZ];
	char out[T_OUTBUFSZ];
};


const char *template_reader(lua_State *L, void *ud, size_t *sz);

#endif
