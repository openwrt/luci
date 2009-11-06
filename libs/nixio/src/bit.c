/*
 * nixio - Linux I/O library for lua
 *
 *   Copyright (C) 2009 Steven Barth <steven@midlink.org>
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

#include "nixio.h"
#include <stdint.h>
#include <stdlib.h>

/* 52 bit maximum precision */
#define NIXIO_BIT_BMAX 32
#define NIXIO_BIT_NMAX 0xffffffff

#define NIXIO_BIT_XOP(BIT_XOP)						\
	uint64_t oper = luaL_checkinteger(L, 1);			\
	const int args = lua_gettop(L);					\
													\
	for (int i = 2; i <= args; i++) {				\
		uint64_t oper2 = luaL_checkinteger(L, i);	\
		oper BIT_XOP oper2;							\
	}												\
													\
	lua_pushinteger(L, oper);						\
	return 1;										\


static int nixio_bit_or(lua_State *L) {
	NIXIO_BIT_XOP(|=);
}

static int nixio_bit_and(lua_State *L) {
	NIXIO_BIT_XOP(&=);
}

static int nixio_bit_xor(lua_State *L) {
	NIXIO_BIT_XOP(^=);
}

static int nixio_bit_unset(lua_State *L) {
	NIXIO_BIT_XOP(&= ~);
}

static int nixio_bit_not(lua_State *L) {
	lua_pushinteger(L, (~((uint64_t)luaL_checkinteger(L, 1))) & NIXIO_BIT_NMAX);
	return 1;
}

static int nixio_bit_shl(lua_State *L) {
	uint64_t oper = luaL_checkinteger(L, 1);
	oper <<= luaL_checkinteger(L, 2);
	if (oper > NIXIO_BIT_NMAX) {
		return luaL_error(L, "arithmetic overflow");
	} else {
		lua_pushinteger(L, oper);
		return 1;
	}
}

static int nixio_bit_ashr(lua_State *L) {
	int64_t oper = luaL_checkinteger(L, 1);
	lua_pushinteger(L, oper >> luaL_checkinteger(L, 2));
	return 1;
}

static int nixio_bit_shr(lua_State *L) {
	uint64_t oper = luaL_checkinteger(L, 1);
	lua_pushinteger(L, oper >> luaL_checkinteger(L, 2));
	return 1;
}

static int nixio_bit_div(lua_State *L) {
	NIXIO_BIT_XOP(/=);
}

static int nixio_bit_check(lua_State *L) {
	uint64_t oper  = luaL_checkinteger(L, 1);
	uint64_t oper2 = luaL_checkinteger(L, 2);
	lua_pushboolean(L, (oper & oper2) == oper2);
	return 1;
}

static int nixio_bit_cast(lua_State *L) {
	lua_pushinteger(L, ((uint64_t)luaL_checkinteger(L, 1)) & NIXIO_BIT_NMAX);
	return 1;
}

static int nixio_bit_swap(lua_State *L) {
	uint64_t op = luaL_checkinteger(L, 1);
	op = (op >> 24) | ((op >> 8) & 0xff00) | ((op & 0xff00) << 8) | (op << 24);
	lua_pushinteger(L, op);
	return 1;
}

/* module table */
static const luaL_reg R[] = {
	{"bor",			nixio_bit_or},
	{"set",			nixio_bit_or},
	{"band",		nixio_bit_and},
	{"bxor",		nixio_bit_xor},
	{"unset",		nixio_bit_unset},
	{"bnot",		nixio_bit_not},
	{"rshift",		nixio_bit_shr},
	{"arshift",		nixio_bit_ashr},
	{"lshift",		nixio_bit_shl},
	{"div",			nixio_bit_div},
	{"check",		nixio_bit_check},
	{"cast",		nixio_bit_cast},
	{"tobit",		nixio_bit_cast},
	{"bswap",		nixio_bit_swap},
	{NULL,			NULL}
};

void nixio_open_bit(lua_State *L) {
	lua_newtable(L);
	luaL_register(L, NULL, R);
	lua_pushinteger(L, NIXIO_BIT_BMAX);
	lua_setfield(L, -2, "bits");
	lua_pushinteger(L, NIXIO_BIT_NMAX);
	lua_setfield(L, -2, "max");
	lua_setfield(L, -2, "bit");
}
