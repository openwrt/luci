
#include <curses.h>

#define MKLUALIB_META_CURSES_SCREEN "SCREEN*"

SCREEN* luacurses_toscreen(lua_State* L, int index);
SCREEN** luacurses_newscreen(lua_State* L);
void luacurses_regscreen(lua_State* L, const char* name, SCREEN* userdata);

#define MKLUALIB_META_CURSES_WINDOW "WINDOW*"

WINDOW* luacurses_towindow(lua_State* L, int index);
WINDOW** luacurses_newwindow(lua_State* L);
void luacurses_regwindow(lua_State* L, const char* name, WINDOW* userdata);

#define MKLUALIB_META_CURSES_FILE "FILE*"

FILE* tofile(lua_State* L, int index);
FILE** newfile(lua_State* L);
void luacurses_regfile(lua_State* L, const char* name, FILE* f);

char* luacurses_wgetnstr(WINDOW* w, int n);
char* luacurses_wgetstr(WINDOW* w);

#define luacurses_mvwgetnstr(w, y, x, n) (wmove(w, y, x) == ERR ? 0 : luacurses_wgetnstr(w, n))
#define luacurses_getnstr(n) luacurses_wgetnstr(stdscr, n)
#define luacurses_mvgetnstr(y, x, n) luacurses_mvwgetnstr(stdscr, y, x, n)

char* luacurses_window_tostring(WINDOW* w);
char* luacurses_screen_tostring(SCREEN* s);

#define luacurses_window_free(w) {delwin(w); w = 0;}
#define luacurses_screen_free(s) {delscreen(s); s = 0;}

bool luacurses_getmouse(short* id, int* x, int* y, int* z, mmask_t* bstate);
bool luacurses_ungetmouse (short id, int x, int y, int z, mmask_t bstate);
mmask_t luacurses_addmousemask(mmask_t m);

