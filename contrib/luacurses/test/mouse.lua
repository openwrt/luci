
require("curses");

function show_message(m)
  local width = string.len(m) + 6;
  local win = curses.newwin(5, width, (lines - 5) / 2, (cols - width) / 2);
  win:keypad(true);
  win:attron(curses.COLOR_PAIR(curses.COLOR_RED));
  win:box('|', '-', '+');
  win:mvaddstr(2, 3, m);
  win:refresh();
  win:getch();
  win:delwin();
end

curses.initscr();
curses.start_color();
curses.init_pair(curses.COLOR_BLUE, curses.COLOR_BLUE, curses.COLOR_WHITE);
curses.init_pair(curses.COLOR_RED, curses.COLOR_RED, curses.COLOR_WHITE);
curses.cbreak();
curses.noecho();
curses.keypad(curses.stdscr(), true);

lines = curses.LINES();
cols = curses.COLS();

mmasks =
{
    curses.BUTTON1_CLICKED,
    curses.BUTTON2_CLICKED,
    curses.BUTTON3_CLICKED,
    curses.BUTTON4_CLICKED
};

table.foreachi(mmasks, function(_i, _m) curses.addmousemask(_m) end);
curses.attron(curses.COLOR_PAIR(curses.COLOR_BLUE));
curses.attron(curses.A_BOLD);
curses.mvaddstr((lines - 5) / 2, (cols - 10) / 2, "click");

curses.refresh();
while(true) do
    local c = curses.getch();
    if (c == curses.KEY_MOUSE) then
	local r, id, x, y, z, bstate = curses.getmouse();
	if (r) then
	    show_message("id = " .. id .. ", x = " .. x .. ", y = " .. y .. ", z = " .. z .. ", bstate = " ..
			 string.format("0x%x", bstate));
	end
	break;
    end
end

curses.endwin();

