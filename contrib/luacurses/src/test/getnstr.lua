
require("curses");

curses.initscr();

curses.keypad(curses.stdscr(), true);
s = curses.mvgetnstr(10, 10, 10);
curses.addstr(s);
curses.getch();

curses.endwin();

