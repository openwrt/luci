/*
 * Copyright (C) 2022 Jo-Philipp Wich <jo@mein.io>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

#include <lua.h>
#include <lauxlib.h>
#include <lualib.h>
#include <errno.h>
#include <string.h>
#include <math.h>
#include <dlfcn.h>

#include "ucode/module.h"

static uc_resource_type_t *vm_type, *lv_type;


typedef struct {
	uc_vm_t *vm;
	uc_value_t *uv;
} ucv_userdata_t;

typedef struct {
	uc_value_t *uvL;
	int ref;
} lua_resource_t;

static int
lua_uv_gc(lua_State *L)
{
	ucv_userdata_t *ud = luaL_checkudata(L, 1, "ucode.value");

	ucv_put(ud->uv);
	ud->uv = NULL;

	return 0;
}

static lua_Integer
lua_table_is_arraylike(lua_State *L, int index)
{
	lua_Integer max = 0, count = 0;
	lua_Number k;

	lua_pushnil(L);

	/* check for non-integer keys */
	while (lua_next(L, index)) {
		if (lua_type(L, -2) == LUA_TNUMBER && (k = lua_tonumber(L, -2)) >= 1) {
			if (floor(k) == k) {
				if (k > max)
					max = k;

				count++;

				lua_pop(L, 1);

				continue;
			}
		}

		lua_pop(L, 2);

		return -1;
	}

	if (max > count * 2)
		return -1;

	return max;
}

static bool
lua_table_new_or_ref(lua_State *L, struct lh_table *visited, uc_value_t *uv)
{
	struct lh_entry *entry;
	unsigned long hash;

	hash = lh_get_hash(visited, uv);
	entry = lh_table_lookup_entry_w_hash(visited, uv, hash);

	if (!entry) {
		lua_newtable(L);
		lua_pushvalue(L, -1);
		lh_table_insert_w_hash(visited, uv,
			(void *)(intptr_t)luaL_ref(L, LUA_REGISTRYINDEX), hash, 0);

		return true;
	}

	lua_rawgeti(L, LUA_REGISTRYINDEX, (int)(intptr_t)entry->v);

	return false;
}

static void
ucv_to_lua(uc_vm_t *vm, uc_value_t *uv, lua_State *L, struct lh_table *visited);

static void
ucv_to_lua(uc_vm_t *vm, uc_value_t *uv, lua_State *L, struct lh_table *visited)
{
	struct lh_entry *entry;
	bool freetbl = false;
	lua_resource_t **lv;
	ucv_userdata_t *ud;
	lua_State **lvL;
	uc_value_t *e;
	size_t i;
	char *s;

	switch (ucv_type(uv)) {
	case UC_BOOLEAN:
		lua_pushboolean(L, ucv_boolean_get(uv));
		break;

	case UC_STRING:
		lua_pushlstring(L, ucv_string_get(uv), ucv_string_length(uv));
		break;

	case UC_DOUBLE:
		lua_pushnumber(L, (lua_Number)ucv_double_get(uv));
		break;

	case UC_INTEGER:
#ifdef LUA_TINT
		lua_pushinteger(L, (lua_Integer)ucv_int64_get(uv));
#else
		lua_pushnumber(L, (lua_Number)ucv_int64_get(uv));
#endif
		break;

	case UC_REGEXP:
		s = ucv_to_string(vm, uv);

		if (s)
			lua_pushstring(L, s);
		else
			lua_pushnil(L);

		free(s);

		break;

	case UC_ARRAY:
	case UC_OBJECT:
		if (ucv_prototype_get(uv)) {
			ud = lua_newuserdata(L, sizeof(*ud));

			if (ud) {
				ud->vm = vm;
				ud->uv = ucv_get(uv);

				luaL_getmetatable(L, "ucode.value");
				lua_setmetatable(L, -2);
			}
			else {
				lua_pushnil(L);
			}
		}
		else {
			if (!visited) {
				freetbl = true;
				visited = lh_kptr_table_new(16, NULL);
			}

			if (visited) {
				if (lua_table_new_or_ref(L, visited, uv)) {
					if (ucv_type(uv) == UC_ARRAY) {
						for (i = 0; i < ucv_array_length(uv); i++) {
							e = ucv_array_get(uv, i);
							ucv_to_lua(vm, e, L, visited);
							lua_rawseti(L, -2, (int)i + 1);
						}
					}
					else {
						ucv_object_foreach(uv, key, val) {
							ucv_to_lua(vm, val, L, visited);
							lua_setfield(L, -2, key);
						}
					}
				}
			}
			else {
				lua_pushnil(L);
			}
		}

		break;

	case UC_CFUNCTION:
	case UC_CLOSURE:
		ud = lua_newuserdata(L, sizeof(*ud));

		if (ud) {
			ud->vm = vm;
			ud->uv = ucv_get(uv);

			luaL_getmetatable(L, "ucode.value");
			lua_setmetatable(L, -2);
		}
		else {
			lua_pushnil(L);
		}

		break;

	case UC_RESOURCE:
		lv = (lua_resource_t **)ucv_resource_dataptr(uv, "lua.value");
		lvL = (lv && *lv) ? (lua_State **)ucv_resource_dataptr((*lv)->uvL, "lua.vm") : NULL;

		if (lvL && *lvL == L)
			lua_rawgeti(L, LUA_REGISTRYINDEX, (*lv)->ref);
		else
			lua_pushnil(L);

		break;

	default:
		lua_pushnil(L);
		break;
	}

	if (freetbl) {
		lh_foreach(visited, entry)
			luaL_unref(L, LUA_REGISTRYINDEX, (int)(intptr_t)entry->v);

		lh_table_free(visited);
	}
}

static uc_value_t *
ucv_table_new_or_ref(lua_State *L, int index, uc_vm_t *vm, struct lh_table *visited, lua_Integer *nkeys)
{
	struct lh_entry *entry;
	unsigned long hash;
	const void *tptr;
	uc_value_t *uv;

	tptr = lua_topointer(L, index);
	hash = lh_get_hash(visited, tptr);
	entry = lh_table_lookup_entry_w_hash(visited, tptr, hash);

	if (!entry) {
		*nkeys = lua_table_is_arraylike(L, index);
		uv = (*nkeys > 0) ? ucv_array_new(vm) : ucv_object_new(vm);
		lh_table_insert_w_hash(visited, tptr, uv, hash, 0);

		return uv;
	}

	*nkeys = -2;
	uv = (uc_value_t *)entry->v;

	return ucv_get(uv);
}

static uc_value_t *
ucv_this_to_uvL(uc_vm_t *vm)
{
	uc_value_t *ctx = uc_vector_last(&vm->callframes)->ctx;
	void *p;

	p = ucv_resource_dataptr(ctx, "lua.vm");

	if (p)
		return ucv_get(ctx);

	p = ucv_resource_dataptr(ctx, "lua.value");

	if (p)
		return ucv_get((*(lua_resource_t **)p)->uvL);

	return NULL;
}

static uc_value_t *
lua_to_ucv(lua_State *L, int index, uc_vm_t *vm, struct lh_table *visited);

static uc_value_t *
lua_to_ucv(lua_State *L, int index, uc_vm_t *vm, struct lh_table *visited)
{
	bool freetbl = false;
	lua_Integer nkeys, i;
	lua_resource_t *lv;
	ucv_userdata_t *ud;
	const char *key;
	uc_value_t *rv;
	size_t len;

	switch (lua_type(L, index)) {
	case LUA_TNIL:
		rv = NULL;
		break;

	case LUA_TTABLE:
		if (!visited) {
			freetbl = true;
			visited = lh_kptr_table_new(16, NULL);
		}

		rv = ucv_table_new_or_ref(L, index, vm, visited, &nkeys);

		if (nkeys > 0) {
			for (i = 1; i <= nkeys; i++) {
				lua_rawgeti(L, index, i);
				ucv_array_push(rv, lua_to_ucv(L, lua_gettop(L), vm, visited));
				lua_pop(L, 1);
			}
		}
		else if (nkeys == -1) {
			lua_pushnil(L);

			while (lua_next(L, index)) {
				lua_pushvalue(L, -2);
				key = lua_tostring(L, -1);

				if (key)
					ucv_object_add(rv, key, lua_to_ucv(L, lua_gettop(L) - 1, vm, visited));

				lua_pop(L, 2);
			}
		}

		if (freetbl)
			lh_table_free(visited);

		break;

	case LUA_TBOOLEAN:
		rv = ucv_boolean_new(lua_toboolean(L, index));
		break;

	case LUA_TNUMBER:
#ifdef LUA_TINT
		if (lua_isinteger(L, index))
			rv = ucv_int64_new(lua_tointeger(L, index));
		else
			rv = ucv_double_new(lua_tonumber(L, index));
#else
		lua_Number n = lua_tonumber(L, index);
		i = lua_tointeger(L, index);

		if ((lua_Number)i == n)
			rv = ucv_int64_new(i);
		else
			rv = ucv_double_new(n);
#endif

		break;

	case LUA_TSTRING:
		key = lua_tolstring(L, index, &len);
		rv = ucv_string_new_length(key, len);
		break;

	case LUA_TUSERDATA:
		rv = NULL;

		if (lua_getmetatable(L, index)) {
			luaL_getmetatable(L, "ucode.value");

			if (lua_rawequal(L, -1, -2)) {
				ud = lua_touserdata(L, index);
				rv = (ud->vm == vm) ? ucv_get(ud->uv) : NULL;
			}

			lua_pop(L, 2);
		}

		if (rv)
			break;

		/* fall through */

	default:
		lua_pushvalue(L, index);

		lv = xalloc(sizeof(*lv));
		lv->ref = luaL_ref(L, LUA_REGISTRYINDEX);
		lv->uvL = ucv_this_to_uvL(vm);

		rv = uc_resource_new(lv_type, lv);
		break;
	}

	return rv;
}

static const char *
uc_exception_type_name(uc_exception_type_t type)
{
	switch (type) {
	case EXCEPTION_SYNTAX:		return "Syntax error";
	case EXCEPTION_RUNTIME:		return "Runtime error";
	case EXCEPTION_TYPE:		return "Type error";
	case EXCEPTION_REFERENCE:	return "Reference error";
	case EXCEPTION_EXIT:		return "Exit";
	default:					return "Exception";
	}
}

static int
lua_uv_call(lua_State *L)
{
	ucv_userdata_t *ud = luaL_checkudata(L, 1, "ucode.value");
	int nargs = lua_gettop(L), i;
	uc_value_t *rv;
	lua_Debug ar;
	bool mcall;

	if (!ucv_is_callable(ud->uv))
		return luaL_error(L, "%s: Invoked value is not a function",
			uc_exception_type_name(EXCEPTION_TYPE));

	if (!lua_getstack(L, 0, &ar) || !lua_getinfo(L, "n", &ar))
		return luaL_error(L, "%s: Unable to obtain stackframe information",
			uc_exception_type_name(EXCEPTION_RUNTIME));

	mcall = !strcmp(ar.namewhat, "method");

	if (mcall)
		uc_vm_stack_push(ud->vm, lua_to_ucv(L, 2, ud->vm, NULL));

	uc_vm_stack_push(ud->vm, ucv_get(ud->uv));

	for (i = 2 + mcall; i <= nargs; i++)
		uc_vm_stack_push(ud->vm, lua_to_ucv(L, i, ud->vm, NULL));

	if (uc_vm_call(ud->vm, mcall, nargs - 1 - mcall)) {
		rv = ucv_object_get(ucv_array_get(ud->vm->exception.stacktrace, 0), "context", NULL);

		return luaL_error(L, "%s: %s%s%s",
			uc_exception_type_name(ud->vm->exception.type),
			ud->vm->exception.message,
			rv ? "\n" : "", rv ? ucv_string_get(rv) : "");
	}

	rv = uc_vm_stack_pop(ud->vm);

	ucv_to_lua(ud->vm, rv, L, NULL);
	ucv_put(rv);

	return 1;
}

static int
lua_uv_index(lua_State *L)
{
	ucv_userdata_t *ud = luaL_checkudata(L, 1, "ucode.value");
	const char *key = luaL_checkstring(L, 2);
	long long idx;
	char *e;

	if (ucv_type(ud->uv) == UC_ARRAY) {
		idx = strtoll(key, &e, 10);

		if (e != key && *e == 0 && idx >= 1 && idx <= (long long)ucv_array_length(ud->uv)) {
			ucv_to_lua(ud->vm, ucv_array_get(ud->uv, (size_t)(idx - 1)), L, NULL);

			return 1;
		}
	}

	ucv_to_lua(ud->vm, ucv_property_get(ud->uv, key), L, NULL);

	return 1;
}

static int
lua_uv_tostring(lua_State *L)
{
	ucv_userdata_t *ud = luaL_checkudata(L, 1, "ucode.value");
	char *s = ucv_to_string(ud->vm, ud->uv);

	lua_pushstring(L, s);
	free(s);

	return 1;
}

static const luaL_reg ucode_ud_methods[] = {
	{ "__gc",			lua_uv_gc         },
	{ "__call",			lua_uv_call       },
	{ "__index",		lua_uv_index      },
	{ "__tostring",		lua_uv_tostring   },

	{ }
};

static uc_value_t *
uc_lua_vm_claim_result(uc_vm_t *vm, lua_State *L, int oldtop)
{
	int nargs = lua_gettop(L) - oldtop - 1, i;
	uc_value_t *uv;

	if (nargs > 1) {
		uv = ucv_array_new_length(vm, nargs);

		for (i = 2; i <= nargs; i++)
			ucv_array_push(uv, lua_to_ucv(L, oldtop + i, vm, NULL));
	}
	else if (nargs == 1) {
		uv = lua_to_ucv(L, oldtop + 2, vm, NULL);
	}
	else {
		uv = NULL;
	}

	return uv;
}

static int
uc_lua_vm_pcall_error_cb(lua_State *L)
{
	const char *message = luaL_checkstring(L, 1);
	uc_stringbuf_t *buf = xprintbuf_new();
	lua_Debug ar;
	int level;

	ucv_stringbuf_printf(buf, "%s\n", message);

	for (level = 1; lua_getstack(L, level, &ar) == 1; level++) {
		if (lua_getinfo(L, "Snl", &ar) == 0)
			continue;

		if (level == 1) {
			ucv_stringbuf_printf(buf, "\nIn %s(), file %s",
				ar.name ? ar.name : "[anonymous function]", ar.short_src);

			if (ar.currentline > -1)
				ucv_stringbuf_printf(buf, ", line %d", ar.currentline);

			ucv_stringbuf_append(buf, "\n");
		}
		else {
			ucv_stringbuf_printf(buf, "  called from function %s (%s",
				ar.name ? ar.name : "[anonymous function]", ar.short_src);

			if (ar.currentline > -1)
				ucv_stringbuf_printf(buf, ":%d", ar.currentline);

			ucv_stringbuf_append(buf, ")\n");
		}
	}

	lua_pushstring(L, buf->buf);
	printbuf_free(buf);

	return 1;
}

static uc_value_t *
uc_lua_vm_pcall(uc_vm_t *vm, lua_State *L, int oldtop)
{
	uc_value_t *uv;

	switch (lua_pcall(L, lua_gettop(L) - oldtop - 2, LUA_MULTRET, oldtop + 1)) {
	case LUA_ERRRUN:
	case LUA_ERRMEM:
	case LUA_ERRERR:
		uc_vm_raise_exception(vm, EXCEPTION_RUNTIME,
			"%s", lua_tostring(L, -1));

		uv = NULL;
		break;

	default:
		uv = uc_lua_vm_claim_result(vm, L, oldtop);
		break;
	}

	return uv;
}

static uc_value_t *
uc_lua_vm_invoke(uc_vm_t *vm, size_t nargs)
{
	lua_State **L = uc_fn_this("lua.vm");
	uc_value_t *name = uc_fn_arg(0);
	uc_value_t *uv;
	size_t i;
	int top;

	if (!L || !*L || ucv_type(name) != UC_STRING)
		return NULL;

	top = lua_gettop(*L);

	lua_pushcfunction(*L, uc_lua_vm_pcall_error_cb);
	lua_getglobal(*L, ucv_string_get(name));

	for (i = 1; i < nargs; i++) {
		uv = uc_fn_arg(i);
		ucv_to_lua(vm, uv, *L, NULL);
	}

	uv = uc_lua_vm_pcall(vm, *L, top);

	lua_settop(*L, top);

	return uv;
}

static uc_value_t *
uc_lua_vm_eval(uc_vm_t *vm, size_t nargs)
{
	lua_State **L = uc_fn_this("lua.vm");
	uc_value_t *source = uc_fn_arg(0);
	uc_value_t *uv = NULL;
	int top;

	if (!L || !*L || ucv_type(source) != UC_STRING)
		return NULL;

	top = lua_gettop(*L);

	lua_pushcfunction(*L, uc_lua_vm_pcall_error_cb);

	switch (luaL_loadstring(*L, ucv_string_get(source))) {
	case LUA_ERRSYNTAX:
		uc_vm_raise_exception(vm, EXCEPTION_SYNTAX,
			"%s", lua_tostring(*L, -1));

		break;

	case LUA_ERRMEM:
		uc_vm_raise_exception(vm, EXCEPTION_RUNTIME,
			"Out of memory while compiling Lua code: %s",
			lua_tostring(*L, -1));

		break;

	default:
		uv = uc_lua_vm_pcall(vm, *L, top);
		break;
	}

	lua_settop(*L, top);

	return uv;
}

static uc_value_t *
uc_lua_vm_include(uc_vm_t *vm, size_t nargs)
{
	lua_State **L = uc_fn_this("lua.vm");
	uc_value_t *path = uc_fn_arg(0);
	uc_value_t *uv = NULL;
	int top;

	if (!L || !*L || ucv_type(path) != UC_STRING)
		return NULL;

	top = lua_gettop(*L);

	lua_pushcfunction(*L, uc_lua_vm_pcall_error_cb);

	switch (luaL_loadfile(*L, ucv_string_get(path))) {
	case LUA_ERRSYNTAX:
		uc_vm_raise_exception(vm, EXCEPTION_SYNTAX,
			"Syntax error while compiling Lua file: %s",
			lua_tostring(*L, -1));

		break;

	case LUA_ERRFILE:
		uc_vm_raise_exception(vm, EXCEPTION_RUNTIME,
			"IO error while compiling Lua file: %s",
			lua_tostring(*L, -1));

		break;

	case LUA_ERRMEM:
		uc_vm_raise_exception(vm, EXCEPTION_RUNTIME,
			"Out of memory while compiling Lua file: %s",
			lua_tostring(*L, -1));

		break;

	default:
		uv = uc_lua_vm_pcall(vm, *L, top);
		break;
	}

	lua_settop(*L, top);

	return uv;
}

static uc_value_t *
uc_lua_vm_set(uc_vm_t *vm, size_t nargs)
{
	lua_State **L = uc_fn_this("lua.vm");
	uc_value_t *key = uc_fn_arg(0);
	uc_value_t *val = uc_fn_arg(1);

	if (!L || !*L)
		return NULL;

	if (ucv_type(key) == UC_OBJECT && !val) {
		ucv_object_foreach(key, k, v) {
			ucv_to_lua(vm, v, *L, NULL);
			lua_setglobal(*L, k);
		}
	}
	else if (ucv_type(key) == UC_STRING) {
		ucv_to_lua(vm, val, *L, NULL);
		lua_setglobal(*L, ucv_string_get(key));
	}
	else {
		return NULL;
	}

	return ucv_boolean_new(true);
}

static uc_value_t *
uc_lua_vm_get(uc_vm_t *vm, size_t nargs)
{
	lua_State **L = uc_fn_this("lua.vm");
	uc_value_t *key = uc_fn_arg(0);
	lua_resource_t *lv;
	size_t i;
	int top;

	if (!L || !*L || ucv_type(key) != UC_STRING)
		return NULL;

	top = lua_gettop(*L);

	lua_getglobal(*L, ucv_string_get(key));

	for (i = 1; i < nargs; i++) {
		if (lua_type(*L, -1) != LUA_TTABLE) {
			lua_settop(*L, top);

			return NULL;
		}

		ucv_to_lua(vm, uc_fn_arg(i), *L, NULL);
		lua_gettable(*L, -2);
	}

	lv = xalloc(sizeof(*lv));
	lv->ref = luaL_ref(*L, LUA_REGISTRYINDEX);
	lv->uvL = ucv_this_to_uvL(vm);

	lua_settop(*L, top);

	return uc_resource_new(lv_type, lv);
}


static lua_State *
uc_lua_lv_to_L(lua_resource_t **lv)
{
	lua_State **L;

	if (!lv || !*lv)
		return NULL;

	L = (lua_State **)ucv_resource_dataptr((*lv)->uvL, "lua.vm");

	if (!L)
		return NULL;

	return *L;
}

static uc_value_t *
uc_lua_lv_call(uc_vm_t *vm, size_t nargs)
{
	lua_resource_t **lv = uc_fn_this("lua.value");
	lua_State *L = uc_lua_lv_to_L(lv);
	uc_value_t *rv;
	int oldtop;
	size_t i;

	if (!L)
		return NULL;

	oldtop = lua_gettop(L);

	lua_pushcfunction(L, uc_lua_vm_pcall_error_cb);
	lua_rawgeti(L, LUA_REGISTRYINDEX, (*lv)->ref);

	for (i = 0; i < nargs; i++)
		ucv_to_lua(vm, uc_fn_arg(i), L, NULL);

	rv = uc_lua_vm_pcall(vm, L, oldtop);

	lua_settop(L, oldtop);

	return rv;
}

static uc_value_t *
uc_lua_lv_invoke(uc_vm_t *vm, size_t nargs)
{
	lua_resource_t **lv = uc_fn_this("lua.value");
	lua_State *L = uc_lua_lv_to_L(lv);
	uc_value_t *method = uc_fn_arg(0);
	uc_value_t *rv;
	int oldtop;
	size_t i;

	if (!L)
		return NULL;

	oldtop = lua_gettop(L);

	lua_pushcfunction(L, uc_lua_vm_pcall_error_cb);
	lua_rawgeti(L, LUA_REGISTRYINDEX, (*lv)->ref);
	ucv_to_lua(vm, method, L, NULL);
	lua_gettable(L, -2);
	lua_pushvalue(L, -2);

	for (i = 1; i < nargs; i++)
		ucv_to_lua(vm, uc_fn_arg(i), L, NULL);

	rv = uc_lua_vm_pcall(vm, L, oldtop + 1);

	lua_settop(L, oldtop);

	return rv;
}

static uc_value_t *
uc_lua_lv_get_common(uc_vm_t *vm, size_t nargs, bool raw)
{
	lua_resource_t **lv = uc_fn_this("lua.value"), *ref;
	lua_State *L = uc_lua_lv_to_L(lv);
	uc_value_t *key;
	size_t i;
	int top;

	if (!L)
		return NULL;

	top = lua_gettop(L);

	lua_rawgeti(L, LUA_REGISTRYINDEX, (*lv)->ref);

	for (i = 0; i < nargs; i++) {
		key = uc_fn_arg(i);

		if (lua_type(L, -1) != LUA_TTABLE) {
			lua_settop(L, top);

			return NULL;
		}

		if (raw) {
			if (ucv_type(key) == UC_INTEGER) {
				lua_rawgeti(L, -1, (int)ucv_int64_get(key));
			}
			else {
				ucv_to_lua(vm, key, L, NULL);
				lua_rawget(L, -2);
			}
		}
		else {
			ucv_to_lua(vm, key, L, NULL);
			lua_gettable(L, -2);
		}
	}

	ref = xalloc(sizeof(*ref));
	ref->ref = luaL_ref(L, LUA_REGISTRYINDEX);
	ref->uvL = ucv_this_to_uvL(vm);

	lua_settop(L, top);

	return uc_resource_new(lv_type, ref);
}

static uc_value_t *
uc_lua_lv_get(uc_vm_t *vm, size_t nargs)
{
	return uc_lua_lv_get_common(vm, nargs, false);
}

static uc_value_t *
uc_lua_lv_getraw(uc_vm_t *vm, size_t nargs)
{
	return uc_lua_lv_get_common(vm, nargs, true);
}

static uc_value_t *
uc_lua_lv_getmt(uc_vm_t *vm, size_t nargs)
{
	lua_resource_t **lv = uc_fn_this("lua.value"), *ref;
	uc_value_t *key = uc_fn_arg(0), *uv = NULL;
	lua_State *L = uc_lua_lv_to_L(lv);
	int oldtop;

	if (!L || (key && ucv_type(key) != UC_STRING))
		return NULL;

	oldtop = lua_gettop(L);

	lua_rawgeti(L, LUA_REGISTRYINDEX, (*lv)->ref);

	if (lua_getmetatable(L, -1)) {
		if (key)
			lua_getfield(L, -1, ucv_string_get(key));

		if (!lua_isnil(L, -1)) {
			ref = xalloc(sizeof(*ref));
			ref->ref = luaL_ref(L, LUA_REGISTRYINDEX);
			ref->uvL = ucv_this_to_uvL(vm);

			uv = uc_resource_new(lv_type, ref);
		}
	}

	lua_settop(L, oldtop);

	return uv;
}

static uc_value_t *
uc_lua_lv_value(uc_vm_t *vm, size_t nargs)
{
	lua_resource_t **lv = uc_fn_this("lua.value");
	lua_State *L = uc_lua_lv_to_L(lv);
	uc_value_t *uv;

	if (!L)
		return NULL;

	lua_rawgeti(L, LUA_REGISTRYINDEX, (*lv)->ref);

	uv = lua_to_ucv(L, lua_gettop(L), vm, NULL);

	lua_pop(L, 1);

	return uv;
}

static uc_value_t *
uc_lua_lv_tostring(uc_vm_t *vm, size_t nargs)
{
	lua_resource_t **lv = uc_fn_this("lua.value");
	lua_State *L = uc_lua_lv_to_L(lv);
	uc_value_t *uv = NULL;
	uc_stringbuf_t *buf;
	const char *s;
	size_t len;

	if (!L)
		return NULL;

	lua_rawgeti(L, LUA_REGISTRYINDEX, (*lv)->ref);

	if (luaL_callmeta(L, -1, "__tostring")) {
		if (lua_isstring(L, -1)) {
			s = lua_tolstring(L, -1, &len);
			uv = ucv_string_new_length(s, len);
			lua_pop(L, 2);

			return uv;
		}

		lua_pop(L, 1);
	}

	buf = ucv_stringbuf_new();

	switch (lua_type(L, lua_gettop(L))) {
	case LUA_TNIL:
	case LUA_TTABLE:
	case LUA_TBOOLEAN:
	case LUA_TNUMBER:
	case LUA_TSTRING:
		uv = lua_to_ucv(L, lua_gettop(L), vm, NULL);
		ucv_to_stringbuf(vm, buf, uv, false);
		ucv_put(uv);
		break;

	default:
		ucv_stringbuf_printf(buf, "%s (%p)",
			lua_typename(L, lua_type(L, lua_gettop(L))),
			lua_topointer(L, lua_gettop(L)));
		break;
	}

	lua_pop(L, 1);

	return ucv_stringbuf_finish(buf);
}


static uc_value_t *
uc_lua_create(uc_vm_t *vm, size_t nargs)
{
	lua_State *L = luaL_newstate();

	luaL_openlibs(L);

	luaL_newmetatable(L, "ucode.value");
	luaL_register(L, NULL, ucode_ud_methods);
	lua_pop(L, 1);

	return uc_resource_new(vm_type, L);
}


static const uc_function_list_t vm_fns[] = {
	{ "invoke",		uc_lua_vm_invoke },
	{ "eval",		uc_lua_vm_eval },
	{ "include",	uc_lua_vm_include },
	{ "set",		uc_lua_vm_set },
	{ "get",		uc_lua_vm_get },
};

static const uc_function_list_t lv_fns[] = {
	{ "call",		uc_lua_lv_call },
	{ "invoke",		uc_lua_lv_invoke },
	{ "get",		uc_lua_lv_get },
	{ "getraw",		uc_lua_lv_getraw },
	{ "getmt",		uc_lua_lv_getmt },
	{ "value",		uc_lua_lv_value },
	{ "tostring",	uc_lua_lv_tostring },
};

static const uc_function_list_t lua_fns[] = {
	{ "create",		uc_lua_create },
};

static void
free_vm(void *ud)
{
	lua_State *L = ud;

	if (L)
		lua_close(L);
}

static void
free_lv(void *ud)
{
	lua_resource_t *lv = ud;
	lua_State **L = (lua_State **)ucv_resource_dataptr(lv->uvL, "lua.vm");

	luaL_unref(*L, LUA_REGISTRYINDEX, lv->ref);
	ucv_put(lv->uvL);
	free(lv);
}

static void
dlopen_self(uc_vm_t *vm)
{
	uc_value_t *search, *entry;
	char *path, *wildcard;
	void *dlh = NULL;
	size_t i;

	search = ucv_property_get(uc_vm_scope_get(vm), "REQUIRE_SEARCH_PATH");

	for (i = 0; !dlh && i < ucv_array_length(search); i++) {
		entry = ucv_array_get(search, i);
		path = ucv_string_get(entry);
		wildcard = path ? strchr(path, '*') : NULL;

		if (wildcard) {
			xasprintf(&path, "%.*slua%s", (int)(wildcard - path), path, wildcard + 1);
			dlh = dlopen(path, RTLD_LAZY|RTLD_GLOBAL);
			dlerror(); /* clear error */
			free(path);
		}
	}
}

void uc_module_init(uc_vm_t *vm, uc_value_t *scope)
{
	uc_function_list_register(scope, lua_fns);

	vm_type = uc_type_declare(vm, "lua.vm", vm_fns, free_vm);
	lv_type = uc_type_declare(vm, "lua.value", lv_fns, free_lv);

	/* reopen ourself using dlopen(RTLD_GLOBAL) to make liblua symbols
	 * available to dynamic Lua extensions loaded by this module through
	 * Lua's require() */
	dlopen_self(vm);
}
