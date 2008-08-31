#include <stdlib.h>
#include <string.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

typedef struct mklualib_regnum
{
    const char* name;
    lua_Number num;
} mklualib_regnum;

void mklualib_regstring(lua_State* L, const char* name, const char* s)
{
    lua_pushstring(L, name);
    lua_pushstring(L, s);
    lua_settable(L, -3);
}

void mklualib_regchar(lua_State* L, const char* name, char c)
{
    lua_pushstring(L, name);
    lua_pushlstring(L, &c, 1);
    lua_settable(L, -3);
}

void mklualib_regnumbers(lua_State* L, const mklualib_regnum* l)
{
    for (; l->name; l++)
    {
	lua_pushstring(L, l->name);
	lua_pushnumber(L, l->num);
	lua_settable(L, -3);
    }
}


#include <curses.h>
#include "luacurses.h"
#define MKLUALIB_MODULE_CURSES "curses"
/* curses.COLORS*/
int mklualib_curses_COLORS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_COLORS_ret = (int) COLORS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_COLORS_ret);
	return 1;
}

/* curses.COLOR_PAIRS*/
int mklualib_curses_COLOR_PAIRS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_COLOR_PAIRS_ret = (int) COLOR_PAIRS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_COLOR_PAIRS_ret);
	return 1;
}

/* curses.NCURSES_ACS*/
int mklualib_curses_NCURSES_ACS(lua_State* mklualib_lua_state)
{
	char c = (char) lua_tostring(mklualib_lua_state, 1)[0];
	int mklualib_curses_NCURSES_ACS_ret = (int) NCURSES_ACS(c);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_NCURSES_ACS_ret);
	return 1;
}

/* curses.ACS_ULCORNER*/
int mklualib_curses_ACS_ULCORNER(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_ULCORNER_ret = (int) ACS_ULCORNER;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_ULCORNER_ret);
	return 1;
}

/* curses.ACS_LLCORNER*/
int mklualib_curses_ACS_LLCORNER(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_LLCORNER_ret = (int) ACS_LLCORNER;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_LLCORNER_ret);
	return 1;
}

/* curses.ACS_URCORNER*/
int mklualib_curses_ACS_URCORNER(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_URCORNER_ret = (int) ACS_URCORNER;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_URCORNER_ret);
	return 1;
}

/* curses.ACS_LRCORNER*/
int mklualib_curses_ACS_LRCORNER(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_LRCORNER_ret = (int) ACS_LRCORNER;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_LRCORNER_ret);
	return 1;
}

/* curses.ACS_LTEE*/
int mklualib_curses_ACS_LTEE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_LTEE_ret = (int) ACS_LTEE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_LTEE_ret);
	return 1;
}

/* curses.ACS_RTEE*/
int mklualib_curses_ACS_RTEE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_RTEE_ret = (int) ACS_RTEE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_RTEE_ret);
	return 1;
}

/* curses.ACS_BTEE*/
int mklualib_curses_ACS_BTEE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BTEE_ret = (int) ACS_BTEE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BTEE_ret);
	return 1;
}

/* curses.ACS_TTEE*/
int mklualib_curses_ACS_TTEE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_TTEE_ret = (int) ACS_TTEE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_TTEE_ret);
	return 1;
}

/* curses.ACS_HLINE*/
int mklualib_curses_ACS_HLINE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_HLINE_ret = (int) ACS_HLINE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_HLINE_ret);
	return 1;
}

/* curses.ACS_VLINE*/
int mklualib_curses_ACS_VLINE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_VLINE_ret = (int) ACS_VLINE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_VLINE_ret);
	return 1;
}

/* curses.ACS_PLUS*/
int mklualib_curses_ACS_PLUS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_PLUS_ret = (int) ACS_PLUS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_PLUS_ret);
	return 1;
}

/* curses.ACS_S1*/
int mklualib_curses_ACS_S1(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_S1_ret = (int) ACS_S1;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_S1_ret);
	return 1;
}

/* curses.ACS_S9*/
int mklualib_curses_ACS_S9(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_S9_ret = (int) ACS_S9;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_S9_ret);
	return 1;
}

/* curses.ACS_DIAMOND*/
int mklualib_curses_ACS_DIAMOND(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_DIAMOND_ret = (int) ACS_DIAMOND;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_DIAMOND_ret);
	return 1;
}

/* curses.ACS_CKBOARD*/
int mklualib_curses_ACS_CKBOARD(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_CKBOARD_ret = (int) ACS_CKBOARD;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_CKBOARD_ret);
	return 1;
}

/* curses.ACS_DEGREE*/
int mklualib_curses_ACS_DEGREE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_DEGREE_ret = (int) ACS_DEGREE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_DEGREE_ret);
	return 1;
}

/* curses.ACS_PLMINUS*/
int mklualib_curses_ACS_PLMINUS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_PLMINUS_ret = (int) ACS_PLMINUS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_PLMINUS_ret);
	return 1;
}

/* curses.ACS_BULLET*/
int mklualib_curses_ACS_BULLET(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BULLET_ret = (int) ACS_BULLET;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BULLET_ret);
	return 1;
}

/* curses.ACS_LARROW*/
int mklualib_curses_ACS_LARROW(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_LARROW_ret = (int) ACS_LARROW;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_LARROW_ret);
	return 1;
}

/* curses.ACS_RARROW*/
int mklualib_curses_ACS_RARROW(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_RARROW_ret = (int) ACS_RARROW;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_RARROW_ret);
	return 1;
}

/* curses.ACS_DARROW*/
int mklualib_curses_ACS_DARROW(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_DARROW_ret = (int) ACS_DARROW;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_DARROW_ret);
	return 1;
}

/* curses.ACS_UARROW*/
int mklualib_curses_ACS_UARROW(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_UARROW_ret = (int) ACS_UARROW;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_UARROW_ret);
	return 1;
}

/* curses.ACS_BOARD*/
int mklualib_curses_ACS_BOARD(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BOARD_ret = (int) ACS_BOARD;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BOARD_ret);
	return 1;
}

/* curses.ACS_LANTERN*/
int mklualib_curses_ACS_LANTERN(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_LANTERN_ret = (int) ACS_LANTERN;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_LANTERN_ret);
	return 1;
}

/* curses.ACS_BLOCK*/
int mklualib_curses_ACS_BLOCK(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BLOCK_ret = (int) ACS_BLOCK;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BLOCK_ret);
	return 1;
}

/* curses.ACS_S3*/
int mklualib_curses_ACS_S3(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_S3_ret = (int) ACS_S3;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_S3_ret);
	return 1;
}

/* curses.ACS_S7*/
int mklualib_curses_ACS_S7(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_S7_ret = (int) ACS_S7;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_S7_ret);
	return 1;
}

/* curses.ACS_LEQUAL*/
int mklualib_curses_ACS_LEQUAL(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_LEQUAL_ret = (int) ACS_LEQUAL;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_LEQUAL_ret);
	return 1;
}

/* curses.ACS_GEQUAL*/
int mklualib_curses_ACS_GEQUAL(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_GEQUAL_ret = (int) ACS_GEQUAL;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_GEQUAL_ret);
	return 1;
}

/* curses.ACS_PI*/
int mklualib_curses_ACS_PI(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_PI_ret = (int) ACS_PI;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_PI_ret);
	return 1;
}

/* curses.ACS_NEQUAL*/
int mklualib_curses_ACS_NEQUAL(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_NEQUAL_ret = (int) ACS_NEQUAL;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_NEQUAL_ret);
	return 1;
}

/* curses.ACS_STERLING*/
int mklualib_curses_ACS_STERLING(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_STERLING_ret = (int) ACS_STERLING;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_STERLING_ret);
	return 1;
}

/* curses.ACS_BSSB*/
int mklualib_curses_ACS_BSSB(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BSSB_ret = (int) ACS_BSSB;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BSSB_ret);
	return 1;
}

/* curses.ACS_SSBB*/
int mklualib_curses_ACS_SSBB(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_SSBB_ret = (int) ACS_SSBB;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_SSBB_ret);
	return 1;
}

/* curses.ACS_BBSS*/
int mklualib_curses_ACS_BBSS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BBSS_ret = (int) ACS_BBSS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BBSS_ret);
	return 1;
}

/* curses.ACS_SBBS*/
int mklualib_curses_ACS_SBBS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_SBBS_ret = (int) ACS_SBBS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_SBBS_ret);
	return 1;
}

/* curses.ACS_SBSS*/
int mklualib_curses_ACS_SBSS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_SBSS_ret = (int) ACS_SBSS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_SBSS_ret);
	return 1;
}

/* curses.ACS_SSSB*/
int mklualib_curses_ACS_SSSB(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_SSSB_ret = (int) ACS_SSSB;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_SSSB_ret);
	return 1;
}

/* curses.ACS_SSBS*/
int mklualib_curses_ACS_SSBS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_SSBS_ret = (int) ACS_SSBS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_SSBS_ret);
	return 1;
}

/* curses.ACS_BSSS*/
int mklualib_curses_ACS_BSSS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BSSS_ret = (int) ACS_BSSS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BSSS_ret);
	return 1;
}

/* curses.ACS_BSBS*/
int mklualib_curses_ACS_BSBS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_BSBS_ret = (int) ACS_BSBS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_BSBS_ret);
	return 1;
}

/* curses.ACS_SBSB*/
int mklualib_curses_ACS_SBSB(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_SBSB_ret = (int) ACS_SBSB;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_SBSB_ret);
	return 1;
}

/* curses.ACS_SSSS*/
int mklualib_curses_ACS_SSSS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ACS_SSSS_ret = (int) ACS_SSSS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ACS_SSSS_ret);
	return 1;
}

/* curses.delscreen */
/* SCREEN*:delscreen */
int mklualib_curses_delscreen(lua_State* mklualib_lua_state)
{
	SCREEN* _arg0 = luacurses_toscreen(mklualib_lua_state, 1);
	delscreen(_arg0);
	return 0;
}

/* curses.set_term */
/* SCREEN*:set_term */
int mklualib_curses_set_term(lua_State* mklualib_lua_state)
{
	SCREEN* _arg0 = luacurses_toscreen(mklualib_lua_state, 1);
	SCREEN* mklualib_curses_set_term_ret = (SCREEN*) set_term(_arg0);
	SCREEN** mklualib_curses_set_term_ret_retptr = luacurses_newscreen(mklualib_lua_state);
	*mklualib_curses_set_term_ret_retptr = mklualib_curses_set_term_ret;
	return 1;
}

/* SCREEN*:__tostring */
int mklualib_curses_screen___tostring(lua_State* mklualib_lua_state)
{
	SCREEN* s = luacurses_toscreen(mklualib_lua_state, 1);
	char* mklualib_curses_screen___tostring_ret = (char*) luacurses_screen_tostring(s);
	lua_pushstring(mklualib_lua_state, mklualib_curses_screen___tostring_ret);
	free(mklualib_curses_screen___tostring_ret);
	return 1;
}

/* SCREEN*:__gc */
int mklualib_curses_screen___gc(lua_State* mklualib_lua_state)
{
	SCREEN* s = luacurses_toscreen(mklualib_lua_state, 1);
	luacurses_screen_free(s);
	return 0;
}

/* WINDOW*:__tostring */
int mklualib_curses_window___tostring(lua_State* mklualib_lua_state)
{
	WINDOW* w = luacurses_towindow(mklualib_lua_state, 1);
	char* mklualib_curses_window___tostring_ret = (char*) luacurses_window_tostring(w);
	lua_pushstring(mklualib_lua_state, mklualib_curses_window___tostring_ret);
	free(mklualib_curses_window___tostring_ret);
	return 1;
}

/* WINDOW*:__gc */
int mklualib_curses_window___gc(lua_State* mklualib_lua_state)
{
	WINDOW* w = luacurses_towindow(mklualib_lua_state, 1);
	luacurses_window_free(w);
	return 0;
}

/* curses.box */
/* WINDOW*:box */
int mklualib_curses_box(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	chtype _arg2 = (chtype) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_box_ret = (int) box(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_box_ret);
	return 1;
}

/* curses.clearok */
/* WINDOW*:clearok */
int mklualib_curses_clearok(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_clearok_ret = (int) clearok(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_clearok_ret);
	return 1;
}

/* curses.delwin */
/* WINDOW*:delwin */
int mklualib_curses_delwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_delwin_ret = (int) delwin(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_delwin_ret);
	return 1;
}

/* curses.derwin */
/* WINDOW*:derwin */
int mklualib_curses_derwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	WINDOW* mklualib_curses_derwin_ret = (WINDOW*) derwin(_arg0, _arg1, _arg2, _arg3, _arg4);
	WINDOW** mklualib_curses_derwin_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_derwin_ret_retptr = mklualib_curses_derwin_ret;
	return 1;
}

/* curses.dupwin */
/* WINDOW*:dupwin */
int mklualib_curses_dupwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	WINDOW* mklualib_curses_dupwin_ret = (WINDOW*) dupwin(_arg0);
	WINDOW** mklualib_curses_dupwin_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_dupwin_ret_retptr = mklualib_curses_dupwin_ret;
	return 1;
}

/* curses.getbkgd */
/* WINDOW*:getbkgd */
int mklualib_curses_getbkgd(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype mklualib_curses_getbkgd_ret = (chtype) getbkgd(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_getbkgd_ret);
	return 1;
}

/* curses.idcok */
/* WINDOW*:idcok */
int mklualib_curses_idcok(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	idcok(_arg0, _arg1);
	return 0;
}

/* curses.idlok */
/* WINDOW*:idlok */
int mklualib_curses_idlok(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_idlok_ret = (int) idlok(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_idlok_ret);
	return 1;
}

/* curses.immedok */
/* WINDOW*:immedok */
int mklualib_curses_immedok(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	immedok(_arg0, _arg1);
	return 0;
}

/* curses.intrflush */
/* WINDOW*:intrflush */
int mklualib_curses_intrflush(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_intrflush_ret = (int) intrflush(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_intrflush_ret);
	return 1;
}

/* curses.is_linetouched */
/* WINDOW*:is_linetouched */
int mklualib_curses_is_linetouched(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_is_linetouched_ret = (bool) is_linetouched(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_is_linetouched_ret);
	return 1;
}

/* curses.is_wintouched */
/* WINDOW*:is_wintouched */
int mklualib_curses_is_wintouched(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool mklualib_curses_is_wintouched_ret = (bool) is_wintouched(_arg0);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_is_wintouched_ret);
	return 1;
}

/* curses.keypad */
/* WINDOW*:keypad */
int mklualib_curses_keypad(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_keypad_ret = (int) keypad(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_keypad_ret);
	return 1;
}

/* curses.leaveok */
/* WINDOW*:leaveok */
int mklualib_curses_leaveok(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_leaveok_ret = (int) leaveok(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_leaveok_ret);
	return 1;
}

/* curses.meta */
/* WINDOW*:meta */
int mklualib_curses_meta(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_meta_ret = (int) meta(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_meta_ret);
	return 1;
}

/* curses.mvderwin */
/* WINDOW*:mvderwin */
int mklualib_curses_mvderwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_mvderwin_ret = (int) mvderwin(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvderwin_ret);
	return 1;
}

/* curses.mvwaddch */
/* WINDOW*:mvaddch */
int mklualib_curses_mvwaddch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	chtype _arg3 = (chtype) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvwaddch_ret = (int) mvwaddch(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwaddch_ret);
	return 1;
}

/* curses.mvwaddstr */
/* WINDOW*:mvaddstr */
int mklualib_curses_mvwaddstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	char* _arg3 = (char*) lua_tostring(mklualib_lua_state, 4);
	int mklualib_curses_mvwaddstr_ret = (int) mvwaddstr(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwaddstr_ret);
	return 1;
}

/* curses.mvwchgat */
/* WINDOW*:mvchgat */
int mklualib_curses_mvwchgat(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	attr_t _arg4 = (attr_t) lua_tonumber(mklualib_lua_state, 5);
	short _arg5 = (short) lua_tonumber(mklualib_lua_state, 6);
	int mklualib_curses_mvwchgat_ret = (int) mvwchgat(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwchgat_ret);
	return 1;
}

/* curses.mvwdelch */
/* WINDOW*:mvdelch */
int mklualib_curses_mvwdelch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_mvwdelch_ret = (int) mvwdelch(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwdelch_ret);
	return 1;
}

/* curses.mvwgetch */
/* WINDOW*:mvgetch */
int mklualib_curses_mvwgetch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_mvwgetch_ret = (int) mvwgetch(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwgetch_ret);
	return 1;
}

/* curses.mvwgetnstr */
/* WINDOW*:mvgetnstr */
int mklualib_curses_mvwgetnstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	char* mklualib_curses_mvwgetnstr_ret = (char*) luacurses_mvwgetnstr(_arg0, _arg1, _arg2, _arg3);
	lua_pushstring(mklualib_lua_state, mklualib_curses_mvwgetnstr_ret);
	return 1;
}

/* curses.mvwhline */
/* WINDOW*:mvhline */
int mklualib_curses_mvwhline(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	chtype _arg3 = (chtype) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	int mklualib_curses_mvwhline_ret = (int) mvwhline(_arg0, _arg1, _arg2, _arg3, _arg4);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwhline_ret);
	return 1;
}

/* curses.mvwin */
/* WINDOW*:mvin */
int mklualib_curses_mvwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_mvwin_ret = (int) mvwin(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwin_ret);
	return 1;
}

/* curses.mvwinch */
/* WINDOW*:mvinch */
int mklualib_curses_mvwinch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	chtype mklualib_curses_mvwinch_ret = (chtype) mvwinch(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwinch_ret);
	return 1;
}

/* curses.mvwinnstr */
/* WINDOW*:mvinnstr */
int mklualib_curses_mvwinnstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	char* _arg3 = (char*) lua_tostring(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	int mklualib_curses_mvwinnstr_ret = (int) mvwinnstr(_arg0, _arg1, _arg2, _arg3, _arg4);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwinnstr_ret);
	return 1;
}

/* curses.mvwinsch */
/* WINDOW*:mvinsch */
int mklualib_curses_mvwinsch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	chtype _arg3 = (chtype) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvwinsch_ret = (int) mvwinsch(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwinsch_ret);
	return 1;
}

/* curses.mvwinsnstr */
/* WINDOW*:mvinsnstr */
int mklualib_curses_mvwinsnstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	char* _arg3 = (char*) lua_tostring(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	int mklualib_curses_mvwinsnstr_ret = (int) mvwinsnstr(_arg0, _arg1, _arg2, _arg3, _arg4);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwinsnstr_ret);
	return 1;
}

/* curses.mvwinsstr */
/* WINDOW*:mvinsstr */
int mklualib_curses_mvwinsstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	char* _arg3 = (char*) lua_tostring(mklualib_lua_state, 4);
	int mklualib_curses_mvwinsstr_ret = (int) mvwinsstr(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwinsstr_ret);
	return 1;
}

/* curses.mvwinstr */
/* WINDOW*:mvinstr */
int mklualib_curses_mvwinstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	char* _arg3 = (char*) lua_tostring(mklualib_lua_state, 4);
	int mklualib_curses_mvwinstr_ret = (int) mvwinstr(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwinstr_ret);
	return 1;
}

/* curses.mvwvline */
/* WINDOW*:mvvline */
int mklualib_curses_mvwvline(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	chtype _arg3 = (chtype) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	int mklualib_curses_mvwvline_ret = (int) mvwvline(_arg0, _arg1, _arg2, _arg3, _arg4);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvwvline_ret);
	return 1;
}

/* curses.nodelay */
/* WINDOW*:nodelay */
int mklualib_curses_nodelay(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_nodelay_ret = (int) nodelay(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_nodelay_ret);
	return 1;
}

/* curses.notimeout */
/* WINDOW*:notimeout */
int mklualib_curses_notimeout(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_notimeout_ret = (int) notimeout(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_notimeout_ret);
	return 1;
}

/* curses.pechochar */
/* WINDOW*:pechochar */
int mklualib_curses_pechochar(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_pechochar_ret = (int) pechochar(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_pechochar_ret);
	return 1;
}

/* curses.pnoutrefresh */
/* WINDOW*:pnoutrefresh */
int mklualib_curses_pnoutrefresh(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	int _arg5 = (int) lua_tonumber(mklualib_lua_state, 6);
	int _arg6 = (int) lua_tonumber(mklualib_lua_state, 7);
	int mklualib_curses_pnoutrefresh_ret = (int) pnoutrefresh(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5, _arg6);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_pnoutrefresh_ret);
	return 1;
}

/* curses.prefresh */
/* WINDOW*:prefresh */
int mklualib_curses_prefresh(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	int _arg5 = (int) lua_tonumber(mklualib_lua_state, 6);
	int _arg6 = (int) lua_tonumber(mklualib_lua_state, 7);
	int mklualib_curses_prefresh_ret = (int) prefresh(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5, _arg6);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_prefresh_ret);
	return 1;
}

/* curses.putwin */
/* WINDOW*:putwin */
int mklualib_curses_putwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	FILE* _arg1 = tofile(mklualib_lua_state, 2);
	int mklualib_curses_putwin_ret = (int) putwin(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_putwin_ret);
	return 1;
}

/* curses.redrawwin */
/* WINDOW*:redrawwin */
int mklualib_curses_redrawwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_redrawwin_ret = (int) redrawwin(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_redrawwin_ret);
	return 1;
}

/* curses.scroll */
/* WINDOW*:scroll */
int mklualib_curses_scroll(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_scroll_ret = (int) scroll(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_scroll_ret);
	return 1;
}

/* curses.scrollok */
/* WINDOW*:scrollok */
int mklualib_curses_scrollok(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_scrollok_ret = (int) scrollok(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_scrollok_ret);
	return 1;
}

/* curses.touchline */
/* WINDOW*:touchline */
int mklualib_curses_touchline(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_touchline_ret = (int) touchline(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_touchline_ret);
	return 1;
}

/* curses.touchwin */
/* WINDOW*:touchwin */
int mklualib_curses_touchwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_touchwin_ret = (int) touchwin(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_touchwin_ret);
	return 1;
}

/* curses.untouchwin */
/* WINDOW*:untouchwin */
int mklualib_curses_untouchwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_untouchwin_ret = (int) untouchwin(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_untouchwin_ret);
	return 1;
}

/* curses.waddch */
/* WINDOW*:addch */
int mklualib_curses_waddch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_waddch_ret = (int) waddch(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_waddch_ret);
	return 1;
}

/* curses.waddnstr */
/* WINDOW*:addnstr */
int mklualib_curses_waddnstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	char* _arg1 = (char*) lua_tostring(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_waddnstr_ret = (int) waddnstr(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_waddnstr_ret);
	return 1;
}

/* curses.waddstr */
/* WINDOW*:addstr */
int mklualib_curses_waddstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	char* _arg1 = (char*) lua_tostring(mklualib_lua_state, 2);
	int mklualib_curses_waddstr_ret = (int) waddstr(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_waddstr_ret);
	return 1;
}

/* curses.wattron */
/* WINDOW*:attron */
int mklualib_curses_wattron(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wattron_ret = (int) wattron(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wattron_ret);
	return 1;
}

/* curses.wattroff */
/* WINDOW*:attroff */
int mklualib_curses_wattroff(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wattroff_ret = (int) wattroff(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wattroff_ret);
	return 1;
}

/* curses.wattrset */
/* WINDOW*:attrset */
int mklualib_curses_wattrset(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wattrset_ret = (int) wattrset(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wattrset_ret);
	return 1;
}

/* curses.wattr_get */
/* WINDOW*:attr_get */
int mklualib_curses_wattr_get(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	attr_t _arg1;
	short _arg2;
	int mklualib_curses_wattr_get_ret = (int) wattr_get(_arg0, &_arg1, &_arg2, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wattr_get_ret);
	lua_pushnumber(mklualib_lua_state, _arg1);
	lua_pushnumber(mklualib_lua_state, _arg2);
	return 3;
}

/* curses.wattr_on */
/* WINDOW*:attr_on */
int mklualib_curses_wattr_on(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	attr_t _arg1 = (attr_t) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wattr_on_ret = (int) wattr_on(_arg0, _arg1, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wattr_on_ret);
	return 1;
}

/* curses.wattr_off */
/* WINDOW*:attr_off */
int mklualib_curses_wattr_off(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	attr_t _arg1 = (attr_t) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wattr_off_ret = (int) wattr_off(_arg0, _arg1, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wattr_off_ret);
	return 1;
}

/* curses.wattr_set */
/* WINDOW*:attr_set */
int mklualib_curses_wattr_set(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	attr_t _arg1 = (attr_t) lua_tonumber(mklualib_lua_state, 2);
	short _arg2 = (short) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_wattr_set_ret = (int) wattr_set(_arg0, _arg1, _arg2, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wattr_set_ret);
	return 1;
}

/* curses.wbkgd */
/* WINDOW*:bkgd */
int mklualib_curses_wbkgd(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wbkgd_ret = (int) wbkgd(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wbkgd_ret);
	return 1;
}

/* curses.wbkgdset */
/* WINDOW*:bkgdset */
int mklualib_curses_wbkgdset(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	wbkgdset(_arg0, _arg1);
	return 0;
}

/* curses.wborder */
/* WINDOW*:border */
int mklualib_curses_wborder(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	chtype _arg2 = (chtype) lua_tonumber(mklualib_lua_state, 3);
	chtype _arg3 = (chtype) lua_tonumber(mklualib_lua_state, 4);
	chtype _arg4 = (chtype) lua_tonumber(mklualib_lua_state, 5);
	chtype _arg5 = (chtype) lua_tonumber(mklualib_lua_state, 6);
	chtype _arg6 = (chtype) lua_tonumber(mklualib_lua_state, 7);
	chtype _arg7 = (chtype) lua_tonumber(mklualib_lua_state, 8);
	chtype _arg8 = (chtype) lua_tonumber(mklualib_lua_state, 9);
	int mklualib_curses_wborder_ret = (int) wborder(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5, _arg6, _arg7, _arg8);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wborder_ret);
	return 1;
}

/* curses.wchgat */
/* WINDOW*:chgat */
int mklualib_curses_wchgat(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	attr_t _arg2 = (attr_t) lua_tonumber(mklualib_lua_state, 3);
	short _arg3 = (short) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_wchgat_ret = (int) wchgat(_arg0, _arg1, _arg2, _arg3, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wchgat_ret);
	return 1;
}

/* curses.wclear */
/* WINDOW*:clear */
int mklualib_curses_wclear(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wclear_ret = (int) wclear(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wclear_ret);
	return 1;
}

/* curses.wclrtobot */
/* WINDOW*:clrtobot */
int mklualib_curses_wclrtobot(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wclrtobot_ret = (int) wclrtobot(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wclrtobot_ret);
	return 1;
}

/* curses.wclrtoeol */
/* WINDOW*:clrtoeol */
int mklualib_curses_wclrtoeol(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wclrtoeol_ret = (int) wclrtoeol(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wclrtoeol_ret);
	return 1;
}

/* curses.wcolor_set */
/* WINDOW*:color_set */
int mklualib_curses_wcolor_set(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	short _arg1 = (short) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wcolor_set_ret = (int) wcolor_set(_arg0, _arg1, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wcolor_set_ret);
	return 1;
}

/* curses.wcursyncup */
/* WINDOW*:cursyncup */
int mklualib_curses_wcursyncup(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	wcursyncup(_arg0);
	return 0;
}

/* curses.wdelch */
/* WINDOW*:delch */
int mklualib_curses_wdelch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wdelch_ret = (int) wdelch(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wdelch_ret);
	return 1;
}

/* curses.wdeleteln */
/* WINDOW*:deleteln */
int mklualib_curses_wdeleteln(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wdeleteln_ret = (int) wdeleteln(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wdeleteln_ret);
	return 1;
}

/* curses.wechochar */
/* WINDOW*:echochar */
int mklualib_curses_wechochar(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wechochar_ret = (int) wechochar(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wechochar_ret);
	return 1;
}

/* curses.werase */
/* WINDOW*:erase */
int mklualib_curses_werase(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_werase_ret = (int) werase(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_werase_ret);
	return 1;
}

/* curses.wgetch */
/* WINDOW*:getch */
int mklualib_curses_wgetch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wgetch_ret = (int) wgetch(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wgetch_ret);
	return 1;
}

/* curses.wgetnstr */
/* WINDOW*:getnstr */
int mklualib_curses_wgetnstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* mklualib_curses_wgetnstr_ret = (char*) luacurses_wgetnstr(_arg0, _arg1);
	lua_pushstring(mklualib_lua_state, mklualib_curses_wgetnstr_ret);
	return 1;
}

/* curses.whline */
/* WINDOW*:hline */
int mklualib_curses_whline(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_whline_ret = (int) whline(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_whline_ret);
	return 1;
}

/* curses.winch */
/* WINDOW*:inch */
int mklualib_curses_winch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype mklualib_curses_winch_ret = (chtype) winch(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winch_ret);
	return 1;
}

/* curses.winnstr */
/* WINDOW*:innstr */
int mklualib_curses_winnstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	char* _arg1 = (char*) lua_tostring(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_winnstr_ret = (int) winnstr(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winnstr_ret);
	return 1;
}

/* curses.winsch */
/* WINDOW*:insch */
int mklualib_curses_winsch(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_winsch_ret = (int) winsch(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winsch_ret);
	return 1;
}

/* curses.winsdelln */
/* WINDOW*:insdelln */
int mklualib_curses_winsdelln(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_winsdelln_ret = (int) winsdelln(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winsdelln_ret);
	return 1;
}

/* curses.winsertln */
/* WINDOW*:insertln */
int mklualib_curses_winsertln(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_winsertln_ret = (int) winsertln(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winsertln_ret);
	return 1;
}

/* curses.winsnstr */
/* WINDOW*:insnstr */
int mklualib_curses_winsnstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	char* _arg1 = (char*) lua_tostring(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_winsnstr_ret = (int) winsnstr(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winsnstr_ret);
	return 1;
}

/* curses.winsstr */
/* WINDOW*:insstr */
int mklualib_curses_winsstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	char* _arg1 = (char*) lua_tostring(mklualib_lua_state, 2);
	int mklualib_curses_winsstr_ret = (int) winsstr(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winsstr_ret);
	return 1;
}

/* curses.winstr */
/* WINDOW*:instr */
int mklualib_curses_winstr(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	char* _arg1 = (char*) lua_tostring(mklualib_lua_state, 2);
	int mklualib_curses_winstr_ret = (int) winstr(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_winstr_ret);
	return 1;
}

/* curses.wmove */
/* WINDOW*:move */
int mklualib_curses_wmove(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_wmove_ret = (int) wmove(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wmove_ret);
	return 1;
}

/* curses.wnoutrefresh */
/* WINDOW*:noutrefresh */
int mklualib_curses_wnoutrefresh(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wnoutrefresh_ret = (int) wnoutrefresh(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wnoutrefresh_ret);
	return 1;
}

/* curses.wredrawln */
/* WINDOW*:redrawln */
int mklualib_curses_wredrawln(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_wredrawln_ret = (int) wredrawln(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wredrawln_ret);
	return 1;
}

/* curses.wrefresh */
/* WINDOW*:refresh */
int mklualib_curses_wrefresh(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wrefresh_ret = (int) wrefresh(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wrefresh_ret);
	return 1;
}

/* curses.wscrl */
/* WINDOW*:scrl */
int mklualib_curses_wscrl(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_wscrl_ret = (int) wscrl(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wscrl_ret);
	return 1;
}

/* curses.wsetscrreg */
/* WINDOW*:setscrreg */
int mklualib_curses_wsetscrreg(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_wsetscrreg_ret = (int) wsetscrreg(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wsetscrreg_ret);
	return 1;
}

/* curses.wstandout */
/* WINDOW*:standout */
int mklualib_curses_wstandout(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wstandout_ret = (int) wstandout(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wstandout_ret);
	return 1;
}

/* curses.wstandend */
/* WINDOW*:standend */
int mklualib_curses_wstandend(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int mklualib_curses_wstandend_ret = (int) wstandend(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wstandend_ret);
	return 1;
}

/* curses.wsyncdown */
/* WINDOW*:syncdown */
int mklualib_curses_wsyncdown(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	wsyncdown(_arg0);
	return 0;
}

/* curses.wsyncup */
/* WINDOW*:syncup */
int mklualib_curses_wsyncup(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	wsyncup(_arg0);
	return 0;
}

/* curses.wtimeout */
/* WINDOW*:timeout */
int mklualib_curses_wtimeout(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	wtimeout(_arg0, _arg1);
	return 0;
}

/* curses.wtouchln */
/* WINDOW*:touchln */
int mklualib_curses_wtouchln(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_wtouchln_ret = (int) wtouchln(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wtouchln_ret);
	return 1;
}

/* curses.wvline */
/* WINDOW*:vline */
int mklualib_curses_wvline(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_wvline_ret = (int) wvline(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wvline_ret);
	return 1;
}

/* curses.wenclose */
/* WINDOW*:enclose */
int mklualib_curses_wenclose(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	bool mklualib_curses_wenclose_ret = (bool) wenclose(_arg0, _arg1, _arg2);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_wenclose_ret);
	return 1;
}

/* curses.wmouse_trafo */
/* WINDOW*:mouse_trafo */
int mklualib_curses_wmouse_trafo(lua_State* mklualib_lua_state)
{
	WINDOW* win = luacurses_towindow(mklualib_lua_state, 1);
	int y = (int) lua_tonumber(mklualib_lua_state, 2);
	int x = (int) lua_tonumber(mklualib_lua_state, 3);
	bool to_screen = (bool) lua_toboolean(mklualib_lua_state, 4);
	bool mklualib_curses_wmouse_trafo_ret = (bool) wmouse_trafo(win, &y, &x, to_screen);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_wmouse_trafo_ret);
	lua_pushnumber(mklualib_lua_state, y);
	lua_pushnumber(mklualib_lua_state, x);
	return 3;
}

/* curses.stdscr*/
int mklualib_curses_stdscr(lua_State* mklualib_lua_state)
{
	WINDOW* mklualib_curses_stdscr_ret = (WINDOW*) stdscr;
	WINDOW** mklualib_curses_stdscr_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_stdscr_ret_retptr = mklualib_curses_stdscr_ret;
	return 1;
}

/* curses.curscr*/
int mklualib_curses_curscr(lua_State* mklualib_lua_state)
{
	WINDOW* mklualib_curses_curscr_ret = (WINDOW*) curscr;
	WINDOW** mklualib_curses_curscr_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_curscr_ret_retptr = mklualib_curses_curscr_ret;
	return 1;
}

/* curses.newscr*/
int mklualib_curses_newscr(lua_State* mklualib_lua_state)
{
	WINDOW* mklualib_curses_newscr_ret = (WINDOW*) newscr;
	WINDOW** mklualib_curses_newscr_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_newscr_ret_retptr = mklualib_curses_newscr_ret;
	return 1;
}

/* curses.LINES*/
int mklualib_curses_LINES(lua_State* mklualib_lua_state)
{
	int mklualib_curses_LINES_ret = (int) LINES;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_LINES_ret);
	return 1;
}

/* curses.COLS*/
int mklualib_curses_COLS(lua_State* mklualib_lua_state)
{
	int mklualib_curses_COLS_ret = (int) COLS;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_COLS_ret);
	return 1;
}

/* curses.TABSIZE*/
int mklualib_curses_TABSIZE(lua_State* mklualib_lua_state)
{
	int mklualib_curses_TABSIZE_ret = (int) TABSIZE;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_TABSIZE_ret);
	return 1;
}

/* curses.ESCDELAY*/
int mklualib_curses_ESCDELAY(lua_State* mklualib_lua_state)
{
	int mklualib_curses_ESCDELAY_ret = (int) ESCDELAY;
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ESCDELAY_ret);
	return 1;
}

/* curses.is_term_resized*/
int mklualib_curses_is_term_resized(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_is_term_resized_ret = (bool) is_term_resized(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_is_term_resized_ret);
	return 1;
}

/* curses.keybound*/
int mklualib_curses_keybound(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* mklualib_curses_keybound_ret = (char*) keybound(_arg0, _arg1);
	lua_pushstring(mklualib_lua_state, mklualib_curses_keybound_ret);
	free(mklualib_curses_keybound_ret);
	return 1;
}

/* curses.curses_version*/
int mklualib_curses_curses_version(lua_State* mklualib_lua_state)
{
	char* mklualib_curses_curses_version_ret = (char*) curses_version();
	lua_pushstring(mklualib_lua_state, mklualib_curses_curses_version_ret);
	return 1;
}

/* curses.assume_default_colors*/
int mklualib_curses_assume_default_colors(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_assume_default_colors_ret = (int) assume_default_colors(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_assume_default_colors_ret);
	return 1;
}

/* curses.define_key*/
int mklualib_curses_define_key(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_define_key_ret = (int) define_key(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_define_key_ret);
	return 1;
}

/* curses.key_defined*/
int mklualib_curses_key_defined(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_key_defined_ret = (int) key_defined(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_key_defined_ret);
	return 1;
}

/* curses.keyok*/
int mklualib_curses_keyok(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_keyok_ret = (int) keyok(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_keyok_ret);
	return 1;
}

/* curses.resize_term*/
int mklualib_curses_resize_term(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_resize_term_ret = (int) resize_term(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_resize_term_ret);
	return 1;
}

/* curses.resizeterm*/
int mklualib_curses_resizeterm(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_resizeterm_ret = (int) resizeterm(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_resizeterm_ret);
	return 1;
}

/* curses.use_default_colors*/
int mklualib_curses_use_default_colors(lua_State* mklualib_lua_state)
{
	int mklualib_curses_use_default_colors_ret = (int) use_default_colors();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_use_default_colors_ret);
	return 1;
}

/* curses.use_extended_names*/
int mklualib_curses_use_extended_names(lua_State* mklualib_lua_state)
{
	bool _arg0 = (bool) lua_toboolean(mklualib_lua_state, 1);
	int mklualib_curses_use_extended_names_ret = (int) use_extended_names(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_use_extended_names_ret);
	return 1;
}

/* curses.wresize*/
int mklualib_curses_wresize(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_wresize_ret = (int) wresize(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_wresize_ret);
	return 1;
}

/* curses.addch*/
int mklualib_curses_addch(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_addch_ret = (int) addch(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_addch_ret);
	return 1;
}

/* curses.addnstr*/
int mklualib_curses_addnstr(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_addnstr_ret = (int) addnstr(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_addnstr_ret);
	return 1;
}

/* curses.addstr*/
int mklualib_curses_addstr(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_addstr_ret = (int) addstr(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_addstr_ret);
	return 1;
}

/* curses.attroff*/
int mklualib_curses_attroff(lua_State* mklualib_lua_state)
{
	attr_t _arg0 = (attr_t) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_attroff_ret = (int) attroff(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_attroff_ret);
	return 1;
}

/* curses.attron*/
int mklualib_curses_attron(lua_State* mklualib_lua_state)
{
	attr_t _arg0 = (attr_t) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_attron_ret = (int) attron(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_attron_ret);
	return 1;
}

/* curses.attrset*/
int mklualib_curses_attrset(lua_State* mklualib_lua_state)
{
	attr_t _arg0 = (attr_t) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_attrset_ret = (int) attrset(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_attrset_ret);
	return 1;
}

/* curses.attr_get*/
int mklualib_curses_attr_get(lua_State* mklualib_lua_state)
{
	attr_t _arg0;
	short _arg1;
	int mklualib_curses_attr_get_ret = (int) attr_get(&_arg0, &_arg1, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_attr_get_ret);
	lua_pushnumber(mklualib_lua_state, _arg0);
	lua_pushnumber(mklualib_lua_state, _arg1);
	return 3;
}

/* curses.attr_off*/
int mklualib_curses_attr_off(lua_State* mklualib_lua_state)
{
	attr_t _arg0 = (attr_t) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_attr_off_ret = (int) attr_off(_arg0, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_attr_off_ret);
	return 1;
}

/* curses.attr_on*/
int mklualib_curses_attr_on(lua_State* mklualib_lua_state)
{
	attr_t _arg0 = (attr_t) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_attr_on_ret = (int) attr_on(_arg0, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_attr_on_ret);
	return 1;
}

/* curses.attr_set*/
int mklualib_curses_attr_set(lua_State* mklualib_lua_state)
{
	attr_t _arg0 = (attr_t) lua_tonumber(mklualib_lua_state, 1);
	short _arg1 = (short) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_attr_set_ret = (int) attr_set(_arg0, _arg1, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_attr_set_ret);
	return 1;
}

/* curses.baudrate*/
int mklualib_curses_baudrate(lua_State* mklualib_lua_state)
{
	int mklualib_curses_baudrate_ret = (int) baudrate();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_baudrate_ret);
	return 1;
}

/* curses.beep*/
int mklualib_curses_beep(lua_State* mklualib_lua_state)
{
	int mklualib_curses_beep_ret = (int) beep();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_beep_ret);
	return 1;
}

/* curses.bkgd*/
int mklualib_curses_bkgd(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_bkgd_ret = (int) bkgd(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_bkgd_ret);
	return 1;
}

/* curses.bkgdset*/
int mklualib_curses_bkgdset(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	bkgdset(_arg0);
	return 0;
}

/* curses.border*/
int mklualib_curses_border(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	chtype _arg1 = (chtype) lua_tonumber(mklualib_lua_state, 2);
	chtype _arg2 = (chtype) lua_tonumber(mklualib_lua_state, 3);
	chtype _arg3 = (chtype) lua_tonumber(mklualib_lua_state, 4);
	chtype _arg4 = (chtype) lua_tonumber(mklualib_lua_state, 5);
	chtype _arg5 = (chtype) lua_tonumber(mklualib_lua_state, 6);
	chtype _arg6 = (chtype) lua_tonumber(mklualib_lua_state, 7);
	chtype _arg7 = (chtype) lua_tonumber(mklualib_lua_state, 8);
	int mklualib_curses_border_ret = (int) border(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5, _arg6, _arg7);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_border_ret);
	return 1;
}

/* curses.can_change_color*/
int mklualib_curses_can_change_color(lua_State* mklualib_lua_state)
{
	bool mklualib_curses_can_change_color_ret = (bool) can_change_color();
	lua_pushboolean(mklualib_lua_state, mklualib_curses_can_change_color_ret);
	return 1;
}

/* curses.cbreak*/
int mklualib_curses_cbreak(lua_State* mklualib_lua_state)
{
	int mklualib_curses_cbreak_ret = (int) cbreak();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_cbreak_ret);
	return 1;
}

/* curses.chgat*/
int mklualib_curses_chgat(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	attr_t _arg1 = (attr_t) lua_tonumber(mklualib_lua_state, 2);
	short _arg2 = (short) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_chgat_ret = (int) chgat(_arg0, _arg1, _arg2, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_chgat_ret);
	return 1;
}

/* curses.clear*/
int mklualib_curses_clear(lua_State* mklualib_lua_state)
{
	int mklualib_curses_clear_ret = (int) clear();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_clear_ret);
	return 1;
}

/* curses.clrtobot*/
int mklualib_curses_clrtobot(lua_State* mklualib_lua_state)
{
	int mklualib_curses_clrtobot_ret = (int) clrtobot();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_clrtobot_ret);
	return 1;
}

/* curses.clrtoeol*/
int mklualib_curses_clrtoeol(lua_State* mklualib_lua_state)
{
	int mklualib_curses_clrtoeol_ret = (int) clrtoeol();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_clrtoeol_ret);
	return 1;
}

/* curses.color_content*/
int mklualib_curses_color_content(lua_State* mklualib_lua_state)
{
	short _arg0 = (short) lua_tonumber(mklualib_lua_state, 1);
	short _arg1;
	short _arg2;
	short _arg3;
	int mklualib_curses_color_content_ret = (int) color_content(_arg0, &_arg1, &_arg2, &_arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_color_content_ret);
	lua_pushnumber(mklualib_lua_state, _arg1);
	lua_pushnumber(mklualib_lua_state, _arg2);
	lua_pushnumber(mklualib_lua_state, _arg3);
	return 4;
}

/* curses.color_set*/
int mklualib_curses_color_set(lua_State* mklualib_lua_state)
{
	short _arg0 = (short) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_color_set_ret = (int) color_set(_arg0, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_color_set_ret);
	return 1;
}

/* curses.COLOR_PAIR*/
int mklualib_curses_COLOR_PAIR(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_COLOR_PAIR_ret = (int) COLOR_PAIR(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_COLOR_PAIR_ret);
	return 1;
}

/* curses.copywin*/
int mklualib_curses_copywin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	WINDOW* _arg1 = luacurses_towindow(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	int _arg5 = (int) lua_tonumber(mklualib_lua_state, 6);
	int _arg6 = (int) lua_tonumber(mklualib_lua_state, 7);
	int _arg7 = (int) lua_tonumber(mklualib_lua_state, 8);
	int _arg8 = (int) lua_tonumber(mklualib_lua_state, 9);
	int mklualib_curses_copywin_ret = (int) copywin(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5, _arg6, _arg7, _arg8);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_copywin_ret);
	return 1;
}

/* curses.curs_set*/
int mklualib_curses_curs_set(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_curs_set_ret = (int) curs_set(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_curs_set_ret);
	return 1;
}

/* curses.def_prog_mode*/
int mklualib_curses_def_prog_mode(lua_State* mklualib_lua_state)
{
	int mklualib_curses_def_prog_mode_ret = (int) def_prog_mode();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_def_prog_mode_ret);
	return 1;
}

/* curses.def_shell_mode*/
int mklualib_curses_def_shell_mode(lua_State* mklualib_lua_state)
{
	int mklualib_curses_def_shell_mode_ret = (int) def_shell_mode();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_def_shell_mode_ret);
	return 1;
}

/* curses.delay_output*/
int mklualib_curses_delay_output(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_delay_output_ret = (int) delay_output(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_delay_output_ret);
	return 1;
}

/* curses.delch*/
int mklualib_curses_delch(lua_State* mklualib_lua_state)
{
	int mklualib_curses_delch_ret = (int) delch();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_delch_ret);
	return 1;
}

/* curses.deleteln*/
int mklualib_curses_deleteln(lua_State* mklualib_lua_state)
{
	int mklualib_curses_deleteln_ret = (int) deleteln();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_deleteln_ret);
	return 1;
}

/* curses.doupdate*/
int mklualib_curses_doupdate(lua_State* mklualib_lua_state)
{
	int mklualib_curses_doupdate_ret = (int) doupdate();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_doupdate_ret);
	return 1;
}

/* curses.echo*/
int mklualib_curses_echo(lua_State* mklualib_lua_state)
{
	int mklualib_curses_echo_ret = (int) echo();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_echo_ret);
	return 1;
}

/* curses.echochar*/
int mklualib_curses_echochar(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_echochar_ret = (int) echochar(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_echochar_ret);
	return 1;
}

/* curses.erase*/
int mklualib_curses_erase(lua_State* mklualib_lua_state)
{
	int mklualib_curses_erase_ret = (int) erase();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_erase_ret);
	return 1;
}

/* curses.endwin*/
int mklualib_curses_endwin(lua_State* mklualib_lua_state)
{
	int mklualib_curses_endwin_ret = (int) endwin();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_endwin_ret);
	return 1;
}

/* curses.erasechar*/
int mklualib_curses_erasechar(lua_State* mklualib_lua_state)
{
	char mklualib_curses_erasechar_ret = (char) erasechar();
	lua_pushlstring(mklualib_lua_state, &mklualib_curses_erasechar_ret, 1);
	return 1;
}

/* curses.filter*/
int mklualib_curses_filter(lua_State* mklualib_lua_state)
{
	filter();
	return 0;
}

/* curses.flash*/
int mklualib_curses_flash(lua_State* mklualib_lua_state)
{
	int mklualib_curses_flash_ret = (int) flash();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_flash_ret);
	return 1;
}

/* curses.flushinp*/
int mklualib_curses_flushinp(lua_State* mklualib_lua_state)
{
	int mklualib_curses_flushinp_ret = (int) flushinp();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_flushinp_ret);
	return 1;
}

/* curses.getch*/
int mklualib_curses_getch(lua_State* mklualib_lua_state)
{
	int mklualib_curses_getch_ret = (int) getch();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_getch_ret);
	return 1;
}

/* curses.getnstr*/
int mklualib_curses_getnstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	char* mklualib_curses_getnstr_ret = (char*) luacurses_getnstr(_arg0);
	lua_pushstring(mklualib_lua_state, mklualib_curses_getnstr_ret);
	return 1;
}

/* curses.getwin*/
int mklualib_curses_getwin(lua_State* mklualib_lua_state)
{
	FILE* _arg0 = tofile(mklualib_lua_state, 1);
	WINDOW* mklualib_curses_getwin_ret = (WINDOW*) getwin(_arg0);
	WINDOW** mklualib_curses_getwin_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_getwin_ret_retptr = mklualib_curses_getwin_ret;
	return 1;
}

/* curses.halfdelay*/
int mklualib_curses_halfdelay(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_halfdelay_ret = (int) halfdelay(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_halfdelay_ret);
	return 1;
}

/* curses.has_colors*/
int mklualib_curses_has_colors(lua_State* mklualib_lua_state)
{
	bool mklualib_curses_has_colors_ret = (bool) has_colors();
	lua_pushboolean(mklualib_lua_state, mklualib_curses_has_colors_ret);
	return 1;
}

/* curses.has_ic*/
int mklualib_curses_has_ic(lua_State* mklualib_lua_state)
{
	bool mklualib_curses_has_ic_ret = (bool) has_ic();
	lua_pushboolean(mklualib_lua_state, mklualib_curses_has_ic_ret);
	return 1;
}

/* curses.has_il*/
int mklualib_curses_has_il(lua_State* mklualib_lua_state)
{
	bool mklualib_curses_has_il_ret = (bool) has_il();
	lua_pushboolean(mklualib_lua_state, mklualib_curses_has_il_ret);
	return 1;
}

/* curses.hline*/
int mklualib_curses_hline(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_hline_ret = (int) hline(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_hline_ret);
	return 1;
}

/* curses.inch*/
int mklualib_curses_inch(lua_State* mklualib_lua_state)
{
	chtype mklualib_curses_inch_ret = (chtype) inch();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_inch_ret);
	return 1;
}

/* curses.initscr*/
int mklualib_curses_initscr(lua_State* mklualib_lua_state)
{
	WINDOW* mklualib_curses_initscr_ret = (WINDOW*) initscr();
	WINDOW** mklualib_curses_initscr_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_initscr_ret_retptr = mklualib_curses_initscr_ret;
	return 1;
}

/* curses.init_color*/
int mklualib_curses_init_color(lua_State* mklualib_lua_state)
{
	short _arg0 = (short) lua_tonumber(mklualib_lua_state, 1);
	short _arg1 = (short) lua_tonumber(mklualib_lua_state, 2);
	short _arg2 = (short) lua_tonumber(mklualib_lua_state, 3);
	short _arg3 = (short) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_init_color_ret = (int) init_color(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_init_color_ret);
	return 1;
}

/* curses.init_pair*/
int mklualib_curses_init_pair(lua_State* mklualib_lua_state)
{
	short _arg0 = (short) lua_tonumber(mklualib_lua_state, 1);
	short _arg1 = (short) lua_tonumber(mklualib_lua_state, 2);
	short _arg2 = (short) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_init_pair_ret = (int) init_pair(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_init_pair_ret);
	return 1;
}

/* curses.innstr*/
int mklualib_curses_innstr(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_innstr_ret = (int) innstr(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_innstr_ret);
	return 1;
}

/* curses.insch*/
int mklualib_curses_insch(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_insch_ret = (int) insch(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_insch_ret);
	return 1;
}

/* curses.insdelln*/
int mklualib_curses_insdelln(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_insdelln_ret = (int) insdelln(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_insdelln_ret);
	return 1;
}

/* curses.insertln*/
int mklualib_curses_insertln(lua_State* mklualib_lua_state)
{
	int mklualib_curses_insertln_ret = (int) insertln();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_insertln_ret);
	return 1;
}

/* curses.insnstr*/
int mklualib_curses_insnstr(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_insnstr_ret = (int) insnstr(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_insnstr_ret);
	return 1;
}

/* curses.insstr*/
int mklualib_curses_insstr(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_insstr_ret = (int) insstr(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_insstr_ret);
	return 1;
}

/* curses.instr*/
int mklualib_curses_instr(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_instr_ret = (int) instr(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_instr_ret);
	return 1;
}

/* curses.isendwin*/
int mklualib_curses_isendwin(lua_State* mklualib_lua_state)
{
	bool mklualib_curses_isendwin_ret = (bool) isendwin();
	lua_pushboolean(mklualib_lua_state, mklualib_curses_isendwin_ret);
	return 1;
}

/* curses.keyname*/
int mklualib_curses_keyname(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	char* mklualib_curses_keyname_ret = (char*) keyname(_arg0);
	lua_pushstring(mklualib_lua_state, mklualib_curses_keyname_ret);
	return 1;
}

/* curses.killchar*/
int mklualib_curses_killchar(lua_State* mklualib_lua_state)
{
	char mklualib_curses_killchar_ret = (char) killchar();
	lua_pushlstring(mklualib_lua_state, &mklualib_curses_killchar_ret, 1);
	return 1;
}

/* curses.longname*/
int mklualib_curses_longname(lua_State* mklualib_lua_state)
{
	char* mklualib_curses_longname_ret = (char*) longname();
	lua_pushstring(mklualib_lua_state, mklualib_curses_longname_ret);
	return 1;
}

/* curses.move*/
int mklualib_curses_move(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_move_ret = (int) move(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_move_ret);
	return 1;
}

/* curses.mvaddch*/
int mklualib_curses_mvaddch(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	chtype _arg2 = (chtype) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_mvaddch_ret = (int) mvaddch(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvaddch_ret);
	return 1;
}

/* curses.mvaddnstr*/
int mklualib_curses_mvaddnstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* _arg2 = (char*) lua_tostring(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvaddnstr_ret = (int) mvaddnstr(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvaddnstr_ret);
	return 1;
}

/* curses.mvaddstr*/
int mklualib_curses_mvaddstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* _arg2 = (char*) lua_tostring(mklualib_lua_state, 3);
	int mklualib_curses_mvaddstr_ret = (int) mvaddstr(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvaddstr_ret);
	return 1;
}

/* curses.mvchgat*/
int mklualib_curses_mvchgat(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	attr_t _arg3 = (attr_t) lua_tonumber(mklualib_lua_state, 4);
	short _arg4 = (short) lua_tonumber(mklualib_lua_state, 5);
	int mklualib_curses_mvchgat_ret = (int) mvchgat(_arg0, _arg1, _arg2, _arg3, _arg4, 0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvchgat_ret);
	return 1;
}

/* curses.mvcur*/
int mklualib_curses_mvcur(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvcur_ret = (int) mvcur(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvcur_ret);
	return 1;
}

/* curses.mvdelch*/
int mklualib_curses_mvdelch(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_mvdelch_ret = (int) mvdelch(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvdelch_ret);
	return 1;
}

/* curses.mvgetch*/
int mklualib_curses_mvgetch(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_mvgetch_ret = (int) mvgetch(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvgetch_ret);
	return 1;
}

/* curses.mvgetnstr*/
int mklualib_curses_mvgetnstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	char* mklualib_curses_mvgetnstr_ret = (char*) luacurses_mvgetnstr(_arg0, _arg1, _arg2);
	lua_pushstring(mklualib_lua_state, mklualib_curses_mvgetnstr_ret);
	return 1;
}

/* curses.mvhline*/
int mklualib_curses_mvhline(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	chtype _arg2 = (chtype) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvhline_ret = (int) mvhline(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvhline_ret);
	return 1;
}

/* curses.mvinch*/
int mklualib_curses_mvinch(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	chtype mklualib_curses_mvinch_ret = (chtype) mvinch(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvinch_ret);
	return 1;
}

/* curses.mvinnstr*/
int mklualib_curses_mvinnstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* _arg2 = (char*) lua_tostring(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvinnstr_ret = (int) mvinnstr(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvinnstr_ret);
	return 1;
}

/* curses.mvinsch*/
int mklualib_curses_mvinsch(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	chtype _arg2 = (chtype) lua_tonumber(mklualib_lua_state, 3);
	int mklualib_curses_mvinsch_ret = (int) mvinsch(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvinsch_ret);
	return 1;
}

/* curses.mvinsnstr*/
int mklualib_curses_mvinsnstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* _arg2 = (char*) lua_tostring(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvinsnstr_ret = (int) mvinsnstr(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvinsnstr_ret);
	return 1;
}

/* curses.mvinsstr*/
int mklualib_curses_mvinsstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* _arg2 = (char*) lua_tostring(mklualib_lua_state, 3);
	int mklualib_curses_mvinsstr_ret = (int) mvinsstr(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvinsstr_ret);
	return 1;
}

/* curses.mvinstr*/
int mklualib_curses_mvinstr(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	char* _arg2 = (char*) lua_tostring(mklualib_lua_state, 3);
	int mklualib_curses_mvinstr_ret = (int) mvinstr(_arg0, _arg1, _arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvinstr_ret);
	return 1;
}

/* curses.mvvline*/
int mklualib_curses_mvvline(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	chtype _arg2 = (chtype) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int mklualib_curses_mvvline_ret = (int) mvvline(_arg0, _arg1, _arg2, _arg3);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mvvline_ret);
	return 1;
}

/* curses.napms*/
int mklualib_curses_napms(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_napms_ret = (int) napms(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_napms_ret);
	return 1;
}

/* curses.newpad*/
int mklualib_curses_newpad(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	WINDOW* mklualib_curses_newpad_ret = (WINDOW*) newpad(_arg0, _arg1);
	WINDOW** mklualib_curses_newpad_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_newpad_ret_retptr = mklualib_curses_newpad_ret;
	return 1;
}

/* curses.newterm*/
int mklualib_curses_newterm(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	FILE* _arg1 = tofile(mklualib_lua_state, 2);
	FILE* _arg2 = tofile(mklualib_lua_state, 3);
	SCREEN* mklualib_curses_newterm_ret = (SCREEN*) newterm(_arg0, _arg1, _arg2);
	SCREEN** mklualib_curses_newterm_ret_retptr = luacurses_newscreen(mklualib_lua_state);
	*mklualib_curses_newterm_ret_retptr = mklualib_curses_newterm_ret;
	return 1;
}

/* curses.newwin*/
int mklualib_curses_newwin(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	WINDOW* mklualib_curses_newwin_ret = (WINDOW*) newwin(_arg0, _arg1, _arg2, _arg3);
	WINDOW** mklualib_curses_newwin_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_newwin_ret_retptr = mklualib_curses_newwin_ret;
	return 1;
}

/* curses.nl*/
int mklualib_curses_nl(lua_State* mklualib_lua_state)
{
	int mklualib_curses_nl_ret = (int) nl();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_nl_ret);
	return 1;
}

/* curses.nocbreak*/
int mklualib_curses_nocbreak(lua_State* mklualib_lua_state)
{
	int mklualib_curses_nocbreak_ret = (int) nocbreak();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_nocbreak_ret);
	return 1;
}

/* curses.noecho*/
int mklualib_curses_noecho(lua_State* mklualib_lua_state)
{
	int mklualib_curses_noecho_ret = (int) noecho();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_noecho_ret);
	return 1;
}

/* curses.nonl*/
int mklualib_curses_nonl(lua_State* mklualib_lua_state)
{
	int mklualib_curses_nonl_ret = (int) nonl();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_nonl_ret);
	return 1;
}

/* curses.noqiflush*/
int mklualib_curses_noqiflush(lua_State* mklualib_lua_state)
{
	noqiflush();
	return 0;
}

/* curses.noraw*/
int mklualib_curses_noraw(lua_State* mklualib_lua_state)
{
	int mklualib_curses_noraw_ret = (int) noraw();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_noraw_ret);
	return 1;
}

/* curses.overlay*/
int mklualib_curses_overlay(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	WINDOW* _arg1 = luacurses_towindow(mklualib_lua_state, 2);
	int mklualib_curses_overlay_ret = (int) overlay(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_overlay_ret);
	return 1;
}

/* curses.overwrite*/
int mklualib_curses_overwrite(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	WINDOW* _arg1 = luacurses_towindow(mklualib_lua_state, 2);
	int mklualib_curses_overwrite_ret = (int) overwrite(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_overwrite_ret);
	return 1;
}

/* curses.pair_content*/
int mklualib_curses_pair_content(lua_State* mklualib_lua_state)
{
	short _arg0 = (short) lua_tonumber(mklualib_lua_state, 1);
	short _arg1;
	short _arg2;
	int mklualib_curses_pair_content_ret = (int) pair_content(_arg0, &_arg1, &_arg2);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_pair_content_ret);
	lua_pushnumber(mklualib_lua_state, _arg1);
	lua_pushnumber(mklualib_lua_state, _arg2);
	return 3;
}

/* curses.PAIR_NUMBER*/
int mklualib_curses_PAIR_NUMBER(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_PAIR_NUMBER_ret = (int) PAIR_NUMBER(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_PAIR_NUMBER_ret);
	return 1;
}

/* curses.putp*/
int mklualib_curses_putp(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_putp_ret = (int) putp(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_putp_ret);
	return 1;
}

/* curses.qiflush*/
int mklualib_curses_qiflush(lua_State* mklualib_lua_state)
{
	qiflush();
	return 0;
}

/* curses.raw*/
int mklualib_curses_raw(lua_State* mklualib_lua_state)
{
	int mklualib_curses_raw_ret = (int) raw();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_raw_ret);
	return 1;
}

/* curses.refresh*/
int mklualib_curses_refresh(lua_State* mklualib_lua_state)
{
	int mklualib_curses_refresh_ret = (int) refresh();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_refresh_ret);
	return 1;
}

/* curses.resetty*/
int mklualib_curses_resetty(lua_State* mklualib_lua_state)
{
	int mklualib_curses_resetty_ret = (int) resetty();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_resetty_ret);
	return 1;
}

/* curses.reset_prog_mode*/
int mklualib_curses_reset_prog_mode(lua_State* mklualib_lua_state)
{
	int mklualib_curses_reset_prog_mode_ret = (int) reset_prog_mode();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_reset_prog_mode_ret);
	return 1;
}

/* curses.reset_shell_mode*/
int mklualib_curses_reset_shell_mode(lua_State* mklualib_lua_state)
{
	int mklualib_curses_reset_shell_mode_ret = (int) reset_shell_mode();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_reset_shell_mode_ret);
	return 1;
}

/* curses.savetty*/
int mklualib_curses_savetty(lua_State* mklualib_lua_state)
{
	int mklualib_curses_savetty_ret = (int) savetty();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_savetty_ret);
	return 1;
}

/* curses.scr_dump*/
int mklualib_curses_scr_dump(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_scr_dump_ret = (int) scr_dump(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_scr_dump_ret);
	return 1;
}

/* curses.scr_init*/
int mklualib_curses_scr_init(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_scr_init_ret = (int) scr_init(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_scr_init_ret);
	return 1;
}

/* curses.scrl*/
int mklualib_curses_scrl(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_scrl_ret = (int) scrl(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_scrl_ret);
	return 1;
}

/* curses.scr_restore*/
int mklualib_curses_scr_restore(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_scr_restore_ret = (int) scr_restore(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_scr_restore_ret);
	return 1;
}

/* curses.scr_set*/
int mklualib_curses_scr_set(lua_State* mklualib_lua_state)
{
	char* _arg0 = (char*) lua_tostring(mklualib_lua_state, 1);
	int mklualib_curses_scr_set_ret = (int) scr_set(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_scr_set_ret);
	return 1;
}

/* curses.setscrreg*/
int mklualib_curses_setscrreg(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_setscrreg_ret = (int) setscrreg(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_setscrreg_ret);
	return 1;
}

/* curses.standout*/
int mklualib_curses_standout(lua_State* mklualib_lua_state)
{
	int mklualib_curses_standout_ret = (int) standout();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_standout_ret);
	return 1;
}

/* curses.standend*/
int mklualib_curses_standend(lua_State* mklualib_lua_state)
{
	int mklualib_curses_standend_ret = (int) standend();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_standend_ret);
	return 1;
}

/* curses.start_color*/
int mklualib_curses_start_color(lua_State* mklualib_lua_state)
{
	int mklualib_curses_start_color_ret = (int) start_color();
	lua_pushnumber(mklualib_lua_state, mklualib_curses_start_color_ret);
	return 1;
}

/* curses.subpad*/
int mklualib_curses_subpad(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	WINDOW* mklualib_curses_subpad_ret = (WINDOW*) subpad(_arg0, _arg1, _arg2, _arg3, _arg4);
	WINDOW** mklualib_curses_subpad_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_subpad_ret_retptr = mklualib_curses_subpad_ret;
	return 1;
}

/* curses.subwin*/
int mklualib_curses_subwin(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int _arg2 = (int) lua_tonumber(mklualib_lua_state, 3);
	int _arg3 = (int) lua_tonumber(mklualib_lua_state, 4);
	int _arg4 = (int) lua_tonumber(mklualib_lua_state, 5);
	WINDOW* mklualib_curses_subwin_ret = (WINDOW*) subwin(_arg0, _arg1, _arg2, _arg3, _arg4);
	WINDOW** mklualib_curses_subwin_ret_retptr = luacurses_newwindow(mklualib_lua_state);
	*mklualib_curses_subwin_ret_retptr = mklualib_curses_subwin_ret;
	return 1;
}

/* curses.syncok*/
int mklualib_curses_syncok(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	bool _arg1 = (bool) lua_toboolean(mklualib_lua_state, 2);
	int mklualib_curses_syncok_ret = (int) syncok(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_syncok_ret);
	return 1;
}

/* curses.timeout*/
int mklualib_curses_timeout(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	timeout(_arg0);
	return 0;
}

/* curses.typeahead*/
int mklualib_curses_typeahead(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_typeahead_ret = (int) typeahead(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_typeahead_ret);
	return 1;
}

/* curses.ungetch*/
int mklualib_curses_ungetch(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_ungetch_ret = (int) ungetch(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_ungetch_ret);
	return 1;
}

/* curses.use_env*/
int mklualib_curses_use_env(lua_State* mklualib_lua_state)
{
	bool _arg0 = (bool) lua_toboolean(mklualib_lua_state, 1);
	use_env(_arg0);
	return 0;
}

/* curses.vidattr*/
int mklualib_curses_vidattr(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_vidattr_ret = (int) vidattr(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_vidattr_ret);
	return 1;
}

/* curses.vline*/
int mklualib_curses_vline(lua_State* mklualib_lua_state)
{
	chtype _arg0 = (chtype) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	int mklualib_curses_vline_ret = (int) vline(_arg0, _arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_vline_ret);
	return 1;
}

/* curses.getyx*/
int mklualib_curses_getyx(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int y;
	int x;
	getyx(_arg0, y, x);
	lua_pushnumber(mklualib_lua_state, y);
	lua_pushnumber(mklualib_lua_state, x);
	return 2;
}

/* curses.getbegyx*/
int mklualib_curses_getbegyx(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int y;
	int x;
	getbegyx(_arg0, y, x);
	lua_pushnumber(mklualib_lua_state, y);
	lua_pushnumber(mklualib_lua_state, x);
	return 2;
}

/* curses.getmaxyx*/
int mklualib_curses_getmaxyx(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int y;
	int x;
	getmaxyx(_arg0, y, x);
	lua_pushnumber(mklualib_lua_state, y);
	lua_pushnumber(mklualib_lua_state, x);
	return 2;
}

/* curses.getparyx*/
int mklualib_curses_getparyx(lua_State* mklualib_lua_state)
{
	WINDOW* _arg0 = luacurses_towindow(mklualib_lua_state, 1);
	int y;
	int x;
	getparyx(_arg0, y, x);
	lua_pushnumber(mklualib_lua_state, y);
	lua_pushnumber(mklualib_lua_state, x);
	return 2;
}

/* curses.KEY_F*/
int mklualib_curses_KEY_F(lua_State* mklualib_lua_state)
{
	int n = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_KEY_F_ret = (int) KEY_F(n);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_KEY_F_ret);
	return 1;
}

/* curses.BUTTON_RELEASE*/
int mklualib_curses_BUTTON_RELEASE(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_BUTTON_RELEASE_ret = (bool) BUTTON_RELEASE(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_BUTTON_RELEASE_ret);
	return 1;
}

/* curses.BUTTON_PRESS*/
int mklualib_curses_BUTTON_PRESS(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_BUTTON_PRESS_ret = (bool) BUTTON_PRESS(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_BUTTON_PRESS_ret);
	return 1;
}

/* curses.BUTTON_CLICK*/
int mklualib_curses_BUTTON_CLICK(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_BUTTON_CLICK_ret = (bool) BUTTON_CLICK(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_BUTTON_CLICK_ret);
	return 1;
}

/* curses.BUTTON_DOUBLE_CLICK*/
int mklualib_curses_BUTTON_DOUBLE_CLICK(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_BUTTON_DOUBLE_CLICK_ret = (bool) BUTTON_DOUBLE_CLICK(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_BUTTON_DOUBLE_CLICK_ret);
	return 1;
}

/* curses.BUTTON_TRIPLE_CLICK*/
int mklualib_curses_BUTTON_TRIPLE_CLICK(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_BUTTON_TRIPLE_CLICK_ret = (bool) BUTTON_TRIPLE_CLICK(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_BUTTON_TRIPLE_CLICK_ret);
	return 1;
}

/* curses.BUTTON_RESERVED_EVENT*/
int mklualib_curses_BUTTON_RESERVED_EVENT(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool mklualib_curses_BUTTON_RESERVED_EVENT_ret = (bool) BUTTON_RESERVED_EVENT(_arg0, _arg1);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_BUTTON_RESERVED_EVENT_ret);
	return 1;
}

/* curses.getmouse*/
int mklualib_curses_getmouse(lua_State* mklualib_lua_state)
{
	short id;
	int x;
	int y;
	int z;
	mmask_t bstate;
	bool mklualib_curses_getmouse_ret = (bool) luacurses_getmouse(&id, &x, &y, &z, &bstate);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_getmouse_ret);
	lua_pushnumber(mklualib_lua_state, id);
	lua_pushnumber(mklualib_lua_state, x);
	lua_pushnumber(mklualib_lua_state, y);
	lua_pushnumber(mklualib_lua_state, z);
	lua_pushnumber(mklualib_lua_state, bstate);
	return 6;
}

/* curses.ungetmouse*/
int mklualib_curses_ungetmouse(lua_State* mklualib_lua_state)
{
	short id = (short) lua_tonumber(mklualib_lua_state, 1);
	int x = (int) lua_tonumber(mklualib_lua_state, 2);
	int y = (int) lua_tonumber(mklualib_lua_state, 3);
	int z = (int) lua_tonumber(mklualib_lua_state, 4);
	mmask_t bstate = (mmask_t) lua_tonumber(mklualib_lua_state, 5);
	bool mklualib_curses_ungetmouse_ret = (bool) luacurses_ungetmouse(id, x, y, z, bstate);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_ungetmouse_ret);
	return 1;
}

/* curses.mousemask*/
int mklualib_curses_mousemask(lua_State* mklualib_lua_state)
{
	mmask_t _arg0 = (mmask_t) lua_tonumber(mklualib_lua_state, 1);
	mmask_t _arg1;
	mmask_t mklualib_curses_mousemask_ret = (mmask_t) mousemask(_arg0, &_arg1);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mousemask_ret);
	lua_pushnumber(mklualib_lua_state, _arg1);
	return 2;
}

/* curses.addmousemask*/
int mklualib_curses_addmousemask(lua_State* mklualib_lua_state)
{
	mmask_t _arg0 = (mmask_t) lua_tonumber(mklualib_lua_state, 1);
	mmask_t mklualib_curses_addmousemask_ret = (mmask_t) luacurses_addmousemask(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_addmousemask_ret);
	return 1;
}

/* curses.mouseinterval*/
int mklualib_curses_mouseinterval(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int mklualib_curses_mouseinterval_ret = (int) mouseinterval(_arg0);
	lua_pushnumber(mklualib_lua_state, mklualib_curses_mouseinterval_ret);
	return 1;
}

/* curses.mouse_trafo*/
int mklualib_curses_mouse_trafo(lua_State* mklualib_lua_state)
{
	int _arg0 = (int) lua_tonumber(mklualib_lua_state, 1);
	int _arg1 = (int) lua_tonumber(mklualib_lua_state, 2);
	bool _arg2 = (bool) lua_toboolean(mklualib_lua_state, 3);
	bool mklualib_curses_mouse_trafo_ret = (bool) mouse_trafo(&_arg0, &_arg1, _arg2);
	lua_pushboolean(mklualib_lua_state, mklualib_curses_mouse_trafo_ret);
	lua_pushnumber(mklualib_lua_state, _arg0);
	lua_pushnumber(mklualib_lua_state, _arg1);
	return 3;
}

const luaL_reg mklualib_curses_lib[] = {
	{"COLORS", mklualib_curses_COLORS},
	{"COLOR_PAIRS", mklualib_curses_COLOR_PAIRS},
	{"NCURSES_ACS", mklualib_curses_NCURSES_ACS},
	{"ACS_ULCORNER", mklualib_curses_ACS_ULCORNER},
	{"ACS_LLCORNER", mklualib_curses_ACS_LLCORNER},
	{"ACS_URCORNER", mklualib_curses_ACS_URCORNER},
	{"ACS_LRCORNER", mklualib_curses_ACS_LRCORNER},
	{"ACS_LTEE", mklualib_curses_ACS_LTEE},
	{"ACS_RTEE", mklualib_curses_ACS_RTEE},
	{"ACS_BTEE", mklualib_curses_ACS_BTEE},
	{"ACS_TTEE", mklualib_curses_ACS_TTEE},
	{"ACS_HLINE", mklualib_curses_ACS_HLINE},
	{"ACS_VLINE", mklualib_curses_ACS_VLINE},
	{"ACS_PLUS", mklualib_curses_ACS_PLUS},
	{"ACS_S1", mklualib_curses_ACS_S1},
	{"ACS_S9", mklualib_curses_ACS_S9},
	{"ACS_DIAMOND", mklualib_curses_ACS_DIAMOND},
	{"ACS_CKBOARD", mklualib_curses_ACS_CKBOARD},
	{"ACS_DEGREE", mklualib_curses_ACS_DEGREE},
	{"ACS_PLMINUS", mklualib_curses_ACS_PLMINUS},
	{"ACS_BULLET", mklualib_curses_ACS_BULLET},
	{"ACS_LARROW", mklualib_curses_ACS_LARROW},
	{"ACS_RARROW", mklualib_curses_ACS_RARROW},
	{"ACS_DARROW", mklualib_curses_ACS_DARROW},
	{"ACS_UARROW", mklualib_curses_ACS_UARROW},
	{"ACS_BOARD", mklualib_curses_ACS_BOARD},
	{"ACS_LANTERN", mklualib_curses_ACS_LANTERN},
	{"ACS_BLOCK", mklualib_curses_ACS_BLOCK},
	{"ACS_S3", mklualib_curses_ACS_S3},
	{"ACS_S7", mklualib_curses_ACS_S7},
	{"ACS_LEQUAL", mklualib_curses_ACS_LEQUAL},
	{"ACS_GEQUAL", mklualib_curses_ACS_GEQUAL},
	{"ACS_PI", mklualib_curses_ACS_PI},
	{"ACS_NEQUAL", mklualib_curses_ACS_NEQUAL},
	{"ACS_STERLING", mklualib_curses_ACS_STERLING},
	{"ACS_BSSB", mklualib_curses_ACS_BSSB},
	{"ACS_SSBB", mklualib_curses_ACS_SSBB},
	{"ACS_BBSS", mklualib_curses_ACS_BBSS},
	{"ACS_SBBS", mklualib_curses_ACS_SBBS},
	{"ACS_SBSS", mklualib_curses_ACS_SBSS},
	{"ACS_SSSB", mklualib_curses_ACS_SSSB},
	{"ACS_SSBS", mklualib_curses_ACS_SSBS},
	{"ACS_BSSS", mklualib_curses_ACS_BSSS},
	{"ACS_BSBS", mklualib_curses_ACS_BSBS},
	{"ACS_SBSB", mklualib_curses_ACS_SBSB},
	{"ACS_SSSS", mklualib_curses_ACS_SSSS},
	{"delscreen", mklualib_curses_delscreen},
	{"set_term", mklualib_curses_set_term},
	{"box", mklualib_curses_box},
	{"clearok", mklualib_curses_clearok},
	{"delwin", mklualib_curses_delwin},
	{"derwin", mklualib_curses_derwin},
	{"dupwin", mklualib_curses_dupwin},
	{"getbkgd", mklualib_curses_getbkgd},
	{"idcok", mklualib_curses_idcok},
	{"idlok", mklualib_curses_idlok},
	{"immedok", mklualib_curses_immedok},
	{"intrflush", mklualib_curses_intrflush},
	{"is_linetouched", mklualib_curses_is_linetouched},
	{"is_wintouched", mklualib_curses_is_wintouched},
	{"keypad", mklualib_curses_keypad},
	{"leaveok", mklualib_curses_leaveok},
	{"meta", mklualib_curses_meta},
	{"mvderwin", mklualib_curses_mvderwin},
	{"mvwaddch", mklualib_curses_mvwaddch},
	{"mvwaddstr", mklualib_curses_mvwaddstr},
	{"mvwchgat", mklualib_curses_mvwchgat},
	{"mvwdelch", mklualib_curses_mvwdelch},
	{"mvwgetch", mklualib_curses_mvwgetch},
	{"mvwgetnstr", mklualib_curses_mvwgetnstr},
	{"mvwhline", mklualib_curses_mvwhline},
	{"mvwin", mklualib_curses_mvwin},
	{"mvwinch", mklualib_curses_mvwinch},
	{"mvwinnstr", mklualib_curses_mvwinnstr},
	{"mvwinsch", mklualib_curses_mvwinsch},
	{"mvwinsnstr", mklualib_curses_mvwinsnstr},
	{"mvwinsstr", mklualib_curses_mvwinsstr},
	{"mvwinstr", mklualib_curses_mvwinstr},
	{"mvwvline", mklualib_curses_mvwvline},
	{"nodelay", mklualib_curses_nodelay},
	{"notimeout", mklualib_curses_notimeout},
	{"pechochar", mklualib_curses_pechochar},
	{"pnoutrefresh", mklualib_curses_pnoutrefresh},
	{"prefresh", mklualib_curses_prefresh},
	{"putwin", mklualib_curses_putwin},
	{"redrawwin", mklualib_curses_redrawwin},
	{"scroll", mklualib_curses_scroll},
	{"scrollok", mklualib_curses_scrollok},
	{"touchline", mklualib_curses_touchline},
	{"touchwin", mklualib_curses_touchwin},
	{"untouchwin", mklualib_curses_untouchwin},
	{"waddch", mklualib_curses_waddch},
	{"waddnstr", mklualib_curses_waddnstr},
	{"waddstr", mklualib_curses_waddstr},
	{"wattron", mklualib_curses_wattron},
	{"wattroff", mklualib_curses_wattroff},
	{"wattrset", mklualib_curses_wattrset},
	{"wattr_get", mklualib_curses_wattr_get},
	{"wattr_on", mklualib_curses_wattr_on},
	{"wattr_off", mklualib_curses_wattr_off},
	{"wattr_set", mklualib_curses_wattr_set},
	{"wbkgd", mklualib_curses_wbkgd},
	{"wbkgdset", mklualib_curses_wbkgdset},
	{"wborder", mklualib_curses_wborder},
	{"wchgat", mklualib_curses_wchgat},
	{"wclear", mklualib_curses_wclear},
	{"wclrtobot", mklualib_curses_wclrtobot},
	{"wclrtoeol", mklualib_curses_wclrtoeol},
	{"wcolor_set", mklualib_curses_wcolor_set},
	{"wcursyncup", mklualib_curses_wcursyncup},
	{"wdelch", mklualib_curses_wdelch},
	{"wdeleteln", mklualib_curses_wdeleteln},
	{"wechochar", mklualib_curses_wechochar},
	{"werase", mklualib_curses_werase},
	{"wgetch", mklualib_curses_wgetch},
	{"wgetnstr", mklualib_curses_wgetnstr},
	{"whline", mklualib_curses_whline},
	{"winch", mklualib_curses_winch},
	{"winnstr", mklualib_curses_winnstr},
	{"winsch", mklualib_curses_winsch},
	{"winsdelln", mklualib_curses_winsdelln},
	{"winsertln", mklualib_curses_winsertln},
	{"winsnstr", mklualib_curses_winsnstr},
	{"winsstr", mklualib_curses_winsstr},
	{"winstr", mklualib_curses_winstr},
	{"wmove", mklualib_curses_wmove},
	{"wnoutrefresh", mklualib_curses_wnoutrefresh},
	{"wredrawln", mklualib_curses_wredrawln},
	{"wrefresh", mklualib_curses_wrefresh},
	{"wscrl", mklualib_curses_wscrl},
	{"wsetscrreg", mklualib_curses_wsetscrreg},
	{"wstandout", mklualib_curses_wstandout},
	{"wstandend", mklualib_curses_wstandend},
	{"wsyncdown", mklualib_curses_wsyncdown},
	{"wsyncup", mklualib_curses_wsyncup},
	{"wtimeout", mklualib_curses_wtimeout},
	{"wtouchln", mklualib_curses_wtouchln},
	{"wvline", mklualib_curses_wvline},
	{"wenclose", mklualib_curses_wenclose},
	{"wmouse_trafo", mklualib_curses_wmouse_trafo},
	{"stdscr", mklualib_curses_stdscr},
	{"curscr", mklualib_curses_curscr},
	{"newscr", mklualib_curses_newscr},
	{"LINES", mklualib_curses_LINES},
	{"COLS", mklualib_curses_COLS},
	{"TABSIZE", mklualib_curses_TABSIZE},
	{"ESCDELAY", mklualib_curses_ESCDELAY},
	{"is_term_resized", mklualib_curses_is_term_resized},
	{"keybound", mklualib_curses_keybound},
	{"curses_version", mklualib_curses_curses_version},
	{"assume_default_colors", mklualib_curses_assume_default_colors},
	{"define_key", mklualib_curses_define_key},
	{"key_defined", mklualib_curses_key_defined},
	{"keyok", mklualib_curses_keyok},
	{"resize_term", mklualib_curses_resize_term},
	{"resizeterm", mklualib_curses_resizeterm},
	{"use_default_colors", mklualib_curses_use_default_colors},
	{"use_extended_names", mklualib_curses_use_extended_names},
	{"wresize", mklualib_curses_wresize},
	{"addch", mklualib_curses_addch},
	{"addnstr", mklualib_curses_addnstr},
	{"addstr", mklualib_curses_addstr},
	{"attroff", mklualib_curses_attroff},
	{"attron", mklualib_curses_attron},
	{"attrset", mklualib_curses_attrset},
	{"attr_get", mklualib_curses_attr_get},
	{"attr_off", mklualib_curses_attr_off},
	{"attr_on", mklualib_curses_attr_on},
	{"attr_set", mklualib_curses_attr_set},
	{"baudrate", mklualib_curses_baudrate},
	{"beep", mklualib_curses_beep},
	{"bkgd", mklualib_curses_bkgd},
	{"bkgdset", mklualib_curses_bkgdset},
	{"border", mklualib_curses_border},
	{"can_change_color", mklualib_curses_can_change_color},
	{"cbreak", mklualib_curses_cbreak},
	{"chgat", mklualib_curses_chgat},
	{"clear", mklualib_curses_clear},
	{"clrtobot", mklualib_curses_clrtobot},
	{"clrtoeol", mklualib_curses_clrtoeol},
	{"color_content", mklualib_curses_color_content},
	{"color_set", mklualib_curses_color_set},
	{"COLOR_PAIR", mklualib_curses_COLOR_PAIR},
	{"copywin", mklualib_curses_copywin},
	{"curs_set", mklualib_curses_curs_set},
	{"def_prog_mode", mklualib_curses_def_prog_mode},
	{"def_shell_mode", mklualib_curses_def_shell_mode},
	{"delay_output", mklualib_curses_delay_output},
	{"delch", mklualib_curses_delch},
	{"deleteln", mklualib_curses_deleteln},
	{"doupdate", mklualib_curses_doupdate},
	{"echo", mklualib_curses_echo},
	{"echochar", mklualib_curses_echochar},
	{"erase", mklualib_curses_erase},
	{"endwin", mklualib_curses_endwin},
	{"erasechar", mklualib_curses_erasechar},
	{"filter", mklualib_curses_filter},
	{"flash", mklualib_curses_flash},
	{"flushinp", mklualib_curses_flushinp},
	{"getch", mklualib_curses_getch},
	{"getnstr", mklualib_curses_getnstr},
	{"getwin", mklualib_curses_getwin},
	{"halfdelay", mklualib_curses_halfdelay},
	{"has_colors", mklualib_curses_has_colors},
	{"has_ic", mklualib_curses_has_ic},
	{"has_il", mklualib_curses_has_il},
	{"hline", mklualib_curses_hline},
	{"inch", mklualib_curses_inch},
	{"initscr", mklualib_curses_initscr},
	{"init_color", mklualib_curses_init_color},
	{"init_pair", mklualib_curses_init_pair},
	{"innstr", mklualib_curses_innstr},
	{"insch", mklualib_curses_insch},
	{"insdelln", mklualib_curses_insdelln},
	{"insertln", mklualib_curses_insertln},
	{"insnstr", mklualib_curses_insnstr},
	{"insstr", mklualib_curses_insstr},
	{"instr", mklualib_curses_instr},
	{"isendwin", mklualib_curses_isendwin},
	{"keyname", mklualib_curses_keyname},
	{"killchar", mklualib_curses_killchar},
	{"longname", mklualib_curses_longname},
	{"move", mklualib_curses_move},
	{"mvaddch", mklualib_curses_mvaddch},
	{"mvaddnstr", mklualib_curses_mvaddnstr},
	{"mvaddstr", mklualib_curses_mvaddstr},
	{"mvchgat", mklualib_curses_mvchgat},
	{"mvcur", mklualib_curses_mvcur},
	{"mvdelch", mklualib_curses_mvdelch},
	{"mvgetch", mklualib_curses_mvgetch},
	{"mvgetnstr", mklualib_curses_mvgetnstr},
	{"mvhline", mklualib_curses_mvhline},
	{"mvinch", mklualib_curses_mvinch},
	{"mvinnstr", mklualib_curses_mvinnstr},
	{"mvinsch", mklualib_curses_mvinsch},
	{"mvinsnstr", mklualib_curses_mvinsnstr},
	{"mvinsstr", mklualib_curses_mvinsstr},
	{"mvinstr", mklualib_curses_mvinstr},
	{"mvvline", mklualib_curses_mvvline},
	{"napms", mklualib_curses_napms},
	{"newpad", mklualib_curses_newpad},
	{"newterm", mklualib_curses_newterm},
	{"newwin", mklualib_curses_newwin},
	{"nl", mklualib_curses_nl},
	{"nocbreak", mklualib_curses_nocbreak},
	{"noecho", mklualib_curses_noecho},
	{"nonl", mklualib_curses_nonl},
	{"noqiflush", mklualib_curses_noqiflush},
	{"noraw", mklualib_curses_noraw},
	{"overlay", mklualib_curses_overlay},
	{"overwrite", mklualib_curses_overwrite},
	{"pair_content", mklualib_curses_pair_content},
	{"PAIR_NUMBER", mklualib_curses_PAIR_NUMBER},
	{"putp", mklualib_curses_putp},
	{"qiflush", mklualib_curses_qiflush},
	{"raw", mklualib_curses_raw},
	{"refresh", mklualib_curses_refresh},
	{"resetty", mklualib_curses_resetty},
	{"reset_prog_mode", mklualib_curses_reset_prog_mode},
	{"reset_shell_mode", mklualib_curses_reset_shell_mode},
	{"savetty", mklualib_curses_savetty},
	{"scr_dump", mklualib_curses_scr_dump},
	{"scr_init", mklualib_curses_scr_init},
	{"scrl", mklualib_curses_scrl},
	{"scr_restore", mklualib_curses_scr_restore},
	{"scr_set", mklualib_curses_scr_set},
	{"setscrreg", mklualib_curses_setscrreg},
	{"standout", mklualib_curses_standout},
	{"standend", mklualib_curses_standend},
	{"start_color", mklualib_curses_start_color},
	{"subpad", mklualib_curses_subpad},
	{"subwin", mklualib_curses_subwin},
	{"syncok", mklualib_curses_syncok},
	{"timeout", mklualib_curses_timeout},
	{"typeahead", mklualib_curses_typeahead},
	{"ungetch", mklualib_curses_ungetch},
	{"use_env", mklualib_curses_use_env},
	{"vidattr", mklualib_curses_vidattr},
	{"vline", mklualib_curses_vline},
	{"getyx", mklualib_curses_getyx},
	{"getbegyx", mklualib_curses_getbegyx},
	{"getmaxyx", mklualib_curses_getmaxyx},
	{"getparyx", mklualib_curses_getparyx},
	{"KEY_F", mklualib_curses_KEY_F},
	{"BUTTON_RELEASE", mklualib_curses_BUTTON_RELEASE},
	{"BUTTON_PRESS", mklualib_curses_BUTTON_PRESS},
	{"BUTTON_CLICK", mklualib_curses_BUTTON_CLICK},
	{"BUTTON_DOUBLE_CLICK", mklualib_curses_BUTTON_DOUBLE_CLICK},
	{"BUTTON_TRIPLE_CLICK", mklualib_curses_BUTTON_TRIPLE_CLICK},
	{"BUTTON_RESERVED_EVENT", mklualib_curses_BUTTON_RESERVED_EVENT},
	{"getmouse", mklualib_curses_getmouse},
	{"ungetmouse", mklualib_curses_ungetmouse},
	{"mousemask", mklualib_curses_mousemask},
	{"addmousemask", mklualib_curses_addmousemask},
	{"mouseinterval", mklualib_curses_mouseinterval},
	{"mouse_trafo", mklualib_curses_mouse_trafo},
	{0, 0}
};

const mklualib_regnum mklualib_curses_lib_nums[] = {
	{"OK", OK},
	{"ERR", ERR},
	{"WA_ATTRIBUTES", WA_ATTRIBUTES},
	{"WA_NORMAL", WA_NORMAL},
	{"WA_STANDOUT", WA_STANDOUT},
	{"WA_UNDERLINE", WA_UNDERLINE},
	{"WA_REVERSE", WA_REVERSE},
	{"WA_BLINK", WA_BLINK},
	{"WA_DIM", WA_DIM},
	{"WA_BOLD", WA_BOLD},
	{"WA_ALTCHARSET", WA_ALTCHARSET},
	{"WA_INVIS", WA_INVIS},
	{"WA_PROTECT", WA_PROTECT},
	{"WA_HORIZONTAL", WA_HORIZONTAL},
	{"WA_LEFT", WA_LEFT},
	{"WA_LOW", WA_LOW},
	{"WA_RIGHT", WA_RIGHT},
	{"WA_TOP", WA_TOP},
	{"WA_VERTICAL", WA_VERTICAL},
	{"COLOR_BLACK", COLOR_BLACK},
	{"COLOR_RED", COLOR_RED},
	{"COLOR_GREEN", COLOR_GREEN},
	{"COLOR_YELLOW", COLOR_YELLOW},
	{"COLOR_BLUE", COLOR_BLUE},
	{"COLOR_MAGENTA", COLOR_MAGENTA},
	{"COLOR_CYAN", COLOR_CYAN},
	{"COLOR_WHITE", COLOR_WHITE},
	{"A_NORMAL", A_NORMAL},
	{"A_ATTRIBUTES", A_ATTRIBUTES},
	{"A_CHARTEXT", A_CHARTEXT},
	{"A_COLOR", A_COLOR},
	{"A_STANDOUT", A_STANDOUT},
	{"A_UNDERLINE", A_UNDERLINE},
	{"A_REVERSE", A_REVERSE},
	{"A_BLINK", A_BLINK},
	{"A_DIM", A_DIM},
	{"A_BOLD", A_BOLD},
	{"A_ALTCHARSET", A_ALTCHARSET},
	{"A_INVIS", A_INVIS},
	{"A_PROTECT", A_PROTECT},
	{"A_HORIZONTAL", A_HORIZONTAL},
	{"A_LEFT", A_LEFT},
	{"A_LOW", A_LOW},
	{"A_RIGHT", A_RIGHT},
	{"A_TOP", A_TOP},
	{"A_VERTICAL", A_VERTICAL},
	{"KEY_CODE_YES", KEY_CODE_YES},
	{"KEY_MIN", KEY_MIN},
	{"KEY_BREAK", KEY_BREAK},
	{"KEY_SRESET", KEY_SRESET},
	{"KEY_RESET", KEY_RESET},
	{"KEY_DOWN", KEY_DOWN},
	{"KEY_UP", KEY_UP},
	{"KEY_LEFT", KEY_LEFT},
	{"KEY_RIGHT", KEY_RIGHT},
	{"KEY_HOME", KEY_HOME},
	{"KEY_BACKSPACE", KEY_BACKSPACE},
	{"KEY_F0", KEY_F0},
	{"KEY_DL", KEY_DL},
	{"KEY_IL", KEY_IL},
	{"KEY_DC", KEY_DC},
	{"KEY_IC", KEY_IC},
	{"KEY_EIC", KEY_EIC},
	{"KEY_CLEAR", KEY_CLEAR},
	{"KEY_EOS", KEY_EOS},
	{"KEY_EOL", KEY_EOL},
	{"KEY_SF", KEY_SF},
	{"KEY_SR", KEY_SR},
	{"KEY_NPAGE", KEY_NPAGE},
	{"KEY_PPAGE", KEY_PPAGE},
	{"KEY_STAB", KEY_STAB},
	{"KEY_CTAB", KEY_CTAB},
	{"KEY_CATAB", KEY_CATAB},
	{"KEY_ENTER", KEY_ENTER},
	{"KEY_PRINT", KEY_PRINT},
	{"KEY_LL", KEY_LL},
	{"KEY_A1", KEY_A1},
	{"KEY_A3", KEY_A3},
	{"KEY_B2", KEY_B2},
	{"KEY_C1", KEY_C1},
	{"KEY_C3", KEY_C3},
	{"KEY_BTAB", KEY_BTAB},
	{"KEY_BEG", KEY_BEG},
	{"KEY_CANCEL", KEY_CANCEL},
	{"KEY_CLOSE", KEY_CLOSE},
	{"KEY_COMMAND", KEY_COMMAND},
	{"KEY_COPY", KEY_COPY},
	{"KEY_CREATE", KEY_CREATE},
	{"KEY_END", KEY_END},
	{"KEY_EXIT", KEY_EXIT},
	{"KEY_FIND", KEY_FIND},
	{"KEY_HELP", KEY_HELP},
	{"KEY_MARK", KEY_MARK},
	{"KEY_MESSAGE", KEY_MESSAGE},
	{"KEY_MOVE", KEY_MOVE},
	{"KEY_NEXT", KEY_NEXT},
	{"KEY_OPEN", KEY_OPEN},
	{"KEY_OPTIONS", KEY_OPTIONS},
	{"KEY_PREVIOUS", KEY_PREVIOUS},
	{"KEY_REDO", KEY_REDO},
	{"KEY_REFERENCE", KEY_REFERENCE},
	{"KEY_REFRESH", KEY_REFRESH},
	{"KEY_REPLACE", KEY_REPLACE},
	{"KEY_RESTART", KEY_RESTART},
	{"KEY_RESUME", KEY_RESUME},
	{"KEY_SAVE", KEY_SAVE},
	{"KEY_SBEG", KEY_SBEG},
	{"KEY_SCANCEL", KEY_SCANCEL},
	{"KEY_SCOMMAND", KEY_SCOMMAND},
	{"KEY_SCOPY", KEY_SCOPY},
	{"KEY_SCREATE", KEY_SCREATE},
	{"KEY_SDC", KEY_SDC},
	{"KEY_SDL", KEY_SDL},
	{"KEY_SELECT", KEY_SELECT},
	{"KEY_SEND", KEY_SEND},
	{"KEY_SEOL", KEY_SEOL},
	{"KEY_SEXIT", KEY_SEXIT},
	{"KEY_SFIND", KEY_SFIND},
	{"KEY_SHELP", KEY_SHELP},
	{"KEY_SHOME", KEY_SHOME},
	{"KEY_SIC", KEY_SIC},
	{"KEY_SLEFT", KEY_SLEFT},
	{"KEY_SMESSAGE", KEY_SMESSAGE},
	{"KEY_SMOVE", KEY_SMOVE},
	{"KEY_SNEXT", KEY_SNEXT},
	{"KEY_SOPTIONS", KEY_SOPTIONS},
	{"KEY_SPREVIOUS", KEY_SPREVIOUS},
	{"KEY_SPRINT", KEY_SPRINT},
	{"KEY_SREDO", KEY_SREDO},
	{"KEY_SREPLACE", KEY_SREPLACE},
	{"KEY_SRIGHT", KEY_SRIGHT},
	{"KEY_SRSUME", KEY_SRSUME},
	{"KEY_SSAVE", KEY_SSAVE},
	{"KEY_SSUSPEND", KEY_SSUSPEND},
	{"KEY_SUNDO", KEY_SUNDO},
	{"KEY_SUSPEND", KEY_SUSPEND},
	{"KEY_UNDO", KEY_UNDO},
	{"KEY_MOUSE", KEY_MOUSE},
	{"KEY_RESIZE", KEY_RESIZE},
	{"KEY_EVENT", KEY_EVENT},
	{"KEY_MAX", KEY_MAX},
	{"BUTTON1_RELEASED", BUTTON1_RELEASED},
	{"BUTTON1_PRESSED", BUTTON1_PRESSED},
	{"BUTTON1_CLICKED", BUTTON1_CLICKED},
	{"BUTTON1_DOUBLE_CLICKED", BUTTON1_DOUBLE_CLICKED},
	{"BUTTON1_TRIPLE_CLICKED", BUTTON1_TRIPLE_CLICKED},
	{"BUTTON1_RESERVED_EVENT", BUTTON1_RESERVED_EVENT},
	{"BUTTON2_RELEASED", BUTTON2_RELEASED},
	{"BUTTON2_PRESSED", BUTTON2_PRESSED},
	{"BUTTON2_CLICKED", BUTTON2_CLICKED},
	{"BUTTON2_DOUBLE_CLICKED", BUTTON2_DOUBLE_CLICKED},
	{"BUTTON2_TRIPLE_CLICKED", BUTTON2_TRIPLE_CLICKED},
	{"BUTTON2_RESERVED_EVENT", BUTTON2_RESERVED_EVENT},
	{"BUTTON3_RELEASED", BUTTON3_RELEASED},
	{"BUTTON3_PRESSED", BUTTON3_PRESSED},
	{"BUTTON3_CLICKED", BUTTON3_CLICKED},
	{"BUTTON3_DOUBLE_CLICKED", BUTTON3_DOUBLE_CLICKED},
	{"BUTTON3_TRIPLE_CLICKED", BUTTON3_TRIPLE_CLICKED},
	{"BUTTON3_RESERVED_EVENT", BUTTON3_RESERVED_EVENT},
	{"BUTTON4_RELEASED", BUTTON4_RELEASED},
	{"BUTTON4_PRESSED", BUTTON4_PRESSED},
	{"BUTTON4_CLICKED", BUTTON4_CLICKED},
	{"BUTTON4_DOUBLE_CLICKED", BUTTON4_DOUBLE_CLICKED},
	{"BUTTON4_TRIPLE_CLICKED", BUTTON4_TRIPLE_CLICKED},
	{"BUTTON4_RESERVED_EVENT", BUTTON4_RESERVED_EVENT},
	{"BUTTON_CTRL", BUTTON_CTRL},
	{"BUTTON_SHIFT", BUTTON_SHIFT},
	{"BUTTON_ALT", BUTTON_ALT},
	{"ALL_MOUSE_EVENTS", ALL_MOUSE_EVENTS},
	{"REPORT_MOUSE_POSITION", REPORT_MOUSE_POSITION},
	{0, 0}
};

const luaL_reg mklualib_curses_window_lib[] = {
	{"__tostring", mklualib_curses_window___tostring},
	{"__gc", mklualib_curses_window___gc},
	{"box", mklualib_curses_box},
	{"clearok", mklualib_curses_clearok},
	{"delwin", mklualib_curses_delwin},
	{"derwin", mklualib_curses_derwin},
	{"dupwin", mklualib_curses_dupwin},
	{"getbkgd", mklualib_curses_getbkgd},
	{"idcok", mklualib_curses_idcok},
	{"idlok", mklualib_curses_idlok},
	{"immedok", mklualib_curses_immedok},
	{"intrflush", mklualib_curses_intrflush},
	{"is_linetouched", mklualib_curses_is_linetouched},
	{"is_wintouched", mklualib_curses_is_wintouched},
	{"keypad", mklualib_curses_keypad},
	{"leaveok", mklualib_curses_leaveok},
	{"meta", mklualib_curses_meta},
	{"mvderwin", mklualib_curses_mvderwin},
	{"mvaddch", mklualib_curses_mvwaddch},
	{"mvaddstr", mklualib_curses_mvwaddstr},
	{"mvchgat", mklualib_curses_mvwchgat},
	{"mvdelch", mklualib_curses_mvwdelch},
	{"mvgetch", mklualib_curses_mvwgetch},
	{"mvgetnstr", mklualib_curses_mvwgetnstr},
	{"mvhline", mklualib_curses_mvwhline},
	{"mvin", mklualib_curses_mvwin},
	{"mvinch", mklualib_curses_mvwinch},
	{"mvinnstr", mklualib_curses_mvwinnstr},
	{"mvinsch", mklualib_curses_mvwinsch},
	{"mvinsnstr", mklualib_curses_mvwinsnstr},
	{"mvinsstr", mklualib_curses_mvwinsstr},
	{"mvinstr", mklualib_curses_mvwinstr},
	{"mvvline", mklualib_curses_mvwvline},
	{"nodelay", mklualib_curses_nodelay},
	{"notimeout", mklualib_curses_notimeout},
	{"pechochar", mklualib_curses_pechochar},
	{"pnoutrefresh", mklualib_curses_pnoutrefresh},
	{"prefresh", mklualib_curses_prefresh},
	{"putwin", mklualib_curses_putwin},
	{"redrawwin", mklualib_curses_redrawwin},
	{"scroll", mklualib_curses_scroll},
	{"scrollok", mklualib_curses_scrollok},
	{"touchline", mklualib_curses_touchline},
	{"touchwin", mklualib_curses_touchwin},
	{"untouchwin", mklualib_curses_untouchwin},
	{"addch", mklualib_curses_waddch},
	{"addnstr", mklualib_curses_waddnstr},
	{"addstr", mklualib_curses_waddstr},
	{"attron", mklualib_curses_wattron},
	{"attroff", mklualib_curses_wattroff},
	{"attrset", mklualib_curses_wattrset},
	{"attr_get", mklualib_curses_wattr_get},
	{"attr_on", mklualib_curses_wattr_on},
	{"attr_off", mklualib_curses_wattr_off},
	{"attr_set", mklualib_curses_wattr_set},
	{"bkgd", mklualib_curses_wbkgd},
	{"bkgdset", mklualib_curses_wbkgdset},
	{"border", mklualib_curses_wborder},
	{"chgat", mklualib_curses_wchgat},
	{"clear", mklualib_curses_wclear},
	{"clrtobot", mklualib_curses_wclrtobot},
	{"clrtoeol", mklualib_curses_wclrtoeol},
	{"color_set", mklualib_curses_wcolor_set},
	{"cursyncup", mklualib_curses_wcursyncup},
	{"delch", mklualib_curses_wdelch},
	{"deleteln", mklualib_curses_wdeleteln},
	{"echochar", mklualib_curses_wechochar},
	{"erase", mklualib_curses_werase},
	{"getch", mklualib_curses_wgetch},
	{"getnstr", mklualib_curses_wgetnstr},
	{"hline", mklualib_curses_whline},
	{"inch", mklualib_curses_winch},
	{"innstr", mklualib_curses_winnstr},
	{"insch", mklualib_curses_winsch},
	{"insdelln", mklualib_curses_winsdelln},
	{"insertln", mklualib_curses_winsertln},
	{"insnstr", mklualib_curses_winsnstr},
	{"insstr", mklualib_curses_winsstr},
	{"instr", mklualib_curses_winstr},
	{"move", mklualib_curses_wmove},
	{"noutrefresh", mklualib_curses_wnoutrefresh},
	{"redrawln", mklualib_curses_wredrawln},
	{"refresh", mklualib_curses_wrefresh},
	{"scrl", mklualib_curses_wscrl},
	{"setscrreg", mklualib_curses_wsetscrreg},
	{"standout", mklualib_curses_wstandout},
	{"standend", mklualib_curses_wstandend},
	{"syncdown", mklualib_curses_wsyncdown},
	{"syncup", mklualib_curses_wsyncup},
	{"timeout", mklualib_curses_wtimeout},
	{"touchln", mklualib_curses_wtouchln},
	{"vline", mklualib_curses_wvline},
	{"enclose", mklualib_curses_wenclose},
	{"mouse_trafo", mklualib_curses_wmouse_trafo},
	{0, 0}
};

void mklualib_create_curses_window(lua_State* mklualib_lua_state)
{
	luaL_newmetatable(mklualib_lua_state, MKLUALIB_META_CURSES_WINDOW);
	lua_pushliteral(mklualib_lua_state, "__index");
	lua_pushvalue(mklualib_lua_state, -2);
	lua_rawset(mklualib_lua_state, -3);
	luaL_register(mklualib_lua_state, 0, mklualib_curses_window_lib);
}

const luaL_reg mklualib_curses_screen_lib[] = {
	{"delscreen", mklualib_curses_delscreen},
	{"set_term", mklualib_curses_set_term},
	{"__tostring", mklualib_curses_screen___tostring},
	{"__gc", mklualib_curses_screen___gc},
	{0, 0}
};

void mklualib_create_curses_screen(lua_State* mklualib_lua_state)
{
	luaL_newmetatable(mklualib_lua_state, MKLUALIB_META_CURSES_SCREEN);
	lua_pushliteral(mklualib_lua_state, "__index");
	lua_pushvalue(mklualib_lua_state, -2);
	lua_rawset(mklualib_lua_state, -3);
	luaL_register(mklualib_lua_state, 0, mklualib_curses_screen_lib);
}

int luaopen_curses(lua_State* mklualib_lua_state)
{
	mklualib_create_curses_window(mklualib_lua_state);
	mklualib_create_curses_screen(mklualib_lua_state);
	luaL_register(mklualib_lua_state, MKLUALIB_MODULE_CURSES, mklualib_curses_lib);
	mklualib_regnumbers(mklualib_lua_state, mklualib_curses_lib_nums);
	return 1;
}

