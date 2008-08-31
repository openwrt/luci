
require("curses");

curses.initscr();
curses.nl();
curses.noecho();


if (curses.has_colors()) then
    curses.start_color();
    curses.init_pair(1, curses.COLOR_BLUE, curses.COLOR_BLACK);
    curses.init_pair(2, curses.COLOR_CYAN, curses.COLOR_BLACK);
end

curses.curs_set(0);
curses.timeout(0);

math.randomseed(os.time());

lines = curses.LINES();
cols = curses.COLS();

xpos = {};
ypos = {};
r = lines - 4;
c = cols - 4;
for i = 0, 4 do
  xpos[i] = c * math.random() + 2;
  ypos[i] = r * math.random() + 2;
end

function dec(i, max)
    if (curses.has_colors()) then
	local z = 3 * math.random();
	local c = curses.COLOR_PAIR(z);
	curses.attrset(c);
	if (math.floor(z) > 0) then
	    curses.attron(curses.A_BOLD);
	end
    end

    if (i > 0) then return i - 1;
    else return max;
    end
end

i = 0;
while(true) do
    x = c * math.random() + 2;
    y = r * math.random() + 2;

    curses.mvaddstr(y, x, ".");

    curses.mvaddstr(ypos[i], xpos[i],           "o");

    i = dec(i, 4);
    curses.mvaddstr(ypos[i], xpos[i],           "O");

    i = dec(i, 4);
    curses.mvaddstr(ypos[i] - 1, xpos[i],       "-");
    curses.mvaddstr(ypos[i],     xpos[i] - 1,  "|.|");
    curses.mvaddstr(ypos[i] + 1, xpos[i],       "-");

    i = dec(i, 4);
    curses.mvaddstr(ypos[i] - 2, xpos[i],       "-");
    curses.mvaddstr(ypos[i] - 1, xpos[i] - 1,  "/ \\");
    curses.mvaddstr(ypos[i],     xpos[i] - 2, "| O |");
    curses.mvaddstr(ypos[i] + 1, xpos[i] - 1, "\\ /");
    curses.mvaddstr(ypos[i] + 2, xpos[i],       "-");

    i = dec(i, 4);
    curses.mvaddstr(ypos[i] - 2, xpos[i],       " ");
    curses.mvaddstr(ypos[i] - 1, xpos[i] - 1,  "   ");
    curses.mvaddstr(ypos[i],     xpos[i] - 2, "     ");
    curses.mvaddstr(ypos[i] + 1, xpos[i] - 1,  "   ");
    curses.mvaddstr(ypos[i] + 2, xpos[i],       " ");


    xpos[i] = x;
    ypos[i] = y;
    
    local ch = curses.getch();
    if (ch == string.byte('q', 1)) or (ch == string.byte('Q', 1)) then break; end
    curses.refresh();
    curses.napms(50);
end

curses.endwin();

