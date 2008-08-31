
require("curses");

function read_cmd()
    curses.attron(curses.A_BOLD);
    curses.addstr("Command: ");
    curses.attron(underline);
    local s = "";
    while (true) do
	local c = string.char(curses.getch());
	if (c == '\n') then break; end
	s = s .. c;
    end
    curses.attroff(underline);
    curses.attroff(curses.A_BOLD);
    curses.addch("\n");

    return s;
end


curses.filter();
curses.initscr();
curses.cbreak();
curses.keypad(curses.stdscr(), TRUE);

if (curses.has_colors()) then
    curses.start_color();
    curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK);
    underline = curses.COLOR_PAIR(1);
else
    underline = curses.A_UNDERLINE;
end

while (true) do
    local s = read_cmd();
    if (s == "exit") then break; end
    curses.reset_shell_mode();
    io.write("\n");
    io.flush(io.stdout);
    os.execute(s);
    curses.reset_prog_mode();
    curses.touchwin(curses.stdscr());
    curses.erase();
    curses.refresh();
end

curses.endwin();

