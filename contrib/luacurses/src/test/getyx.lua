
require("curses");

curses.initscr();
while (true) do
    local s = curses.getnstr(1000);
    curses.addstr(s);
    curses.addstr(":" .. table.concat({curses.getyx(curses.stdscr())}, ' ') .. "\n");
    if (s == "exit") then break; end
end

curses.endwin();

