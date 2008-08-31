
require("curses");

curses.initscr();

curses.start_color();
curses.init_pair(1, curses.COLOR_BLUE, curses.COLOR_YELLOW);
curses.init_pair(2, curses.COLOR_CYAN, curses.COLOR_RED);

for i = 1, 2 do
    local r, f, b = curses.pair_content(i);
    curses.attrset(curses.COLOR_PAIR(i));
    curses.addstr(f .. ", " .. b .. "\n");
end

curses.getch();
curses.endwin();

