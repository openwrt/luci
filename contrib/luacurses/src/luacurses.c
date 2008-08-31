
#include <stdlib.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

#include <curses.h>
#include "luacurses.h"

SCREEN* luacurses_toscreen(lua_State* L, int index)
{
    SCREEN** pscreen = (SCREEN**) luaL_checkudata(L, index, MKLUALIB_META_CURSES_SCREEN);
    if (!pscreen) luaL_argerror(L, index, "bad screen");
    if (!*pscreen) luaL_error(L, "attempt to use invalid screen");
    return *pscreen;
}

SCREEN** luacurses_newscreen(lua_State* L)
{
    SCREEN** pscreen = (SCREEN**) lua_newuserdata(L, sizeof(SCREEN*));
    *pscreen = 0;
    luaL_getmetatable(L, MKLUALIB_META_CURSES_SCREEN);
    lua_setmetatable(L, -2);
    return pscreen;
}

void luacurses_regscreen(lua_State* L, const char* name, SCREEN* userdata)
{
    lua_pushstring(L, name);
    SCREEN** pscreen = luacurses_newscreen(L);
    *pscreen = userdata;
    lua_settable(L, -3);
}

WINDOW* luacurses_towindow(lua_State* L, int index)
{
    WINDOW** pwindow = (WINDOW**) luaL_checkudata(L, index, MKLUALIB_META_CURSES_WINDOW);
    if (!pwindow) luaL_argerror(L, index, "bad window");
    if (!*pwindow) luaL_error(L, "attempt to use invalid window");
    return *pwindow;
}

WINDOW** luacurses_newwindow(lua_State* L)
{
    WINDOW** pwindow = (WINDOW**) lua_newuserdata(L, sizeof(WINDOW*));
    *pwindow = 0;
    luaL_getmetatable(L, MKLUALIB_META_CURSES_WINDOW);
    lua_setmetatable(L, -2);
    return pwindow;
}

void luacurses_regwindow(lua_State* L, const char* name, WINDOW* userdata)
{
    lua_pushstring(L, name);
    WINDOW** pwindow = luacurses_newwindow(L);
    *pwindow = userdata;
    lua_settable(L, -3);
}

FILE* tofile(lua_State* L, int index)
{
    FILE** pf = (FILE**) luaL_checkudata(L, index, MKLUALIB_META_CURSES_FILE);
    if (!pf) luaL_argerror(L, index, "bad file");
    if (!*pf) luaL_error(L, "attempt to use invalid file");
    return *pf;
}

FILE** newfile(lua_State* L)
{
    FILE** pf = (FILE**) lua_newuserdata(L, sizeof(FILE*));
    *pf = 0;
    luaL_getmetatable(L, MKLUALIB_META_CURSES_FILE);
    lua_setmetatable(L, -2);
    return pf;
}

void luacurses_regfile(lua_State* L, const char* name, FILE* f)
{
    lua_pushstring(L, name);
    FILE** pf = newfile(L);
    *pf = f;
    lua_settable(L, -3);
}

char* luacurses_wgetnstr(WINDOW* w, int n)
{
    char* s = (char*) malloc(n + 1);
    wgetnstr(w, s, n);
    return s;
}

char* luacurses_window_tostring(WINDOW* w)
{
    char* buf = (char*) malloc(64);
    sprintf(buf, "window %p", w);
    return buf;
}

char* luacurses_screen_tostring(SCREEN* s)
{
    char* buf = (char*) malloc(64);
    sprintf(buf, "screen %p", s);
    return buf;  
}

bool luacurses_getmouse(short* id, int* x, int* y, int* z, mmask_t* bstate)
{
    MEVENT e;
    int res = getmouse(&e);

    *id = e.id;
    *x = e.x;
    *y = e.y;
    *z = e.z;
    *bstate = e.bstate;
    return (res == OK);
}

bool luacurses_ungetmouse (short id, int x, int y, int z, mmask_t bstate)
{
    MEVENT e;
    e.id = id;
    e.x = x;
    e.y = y;
    e.z = z;
    e.bstate = bstate;
    return (ungetmouse(&e) == OK);
}

mmask_t luacurses_addmousemask(mmask_t m)
{
    mmask_t old;
    mousemask(m, &old);
    return mousemask(old | m, 0);
}

