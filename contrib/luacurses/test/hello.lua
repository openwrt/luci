
require("curses");

function show_message(message)
  local width = string.len(message) + 6;
  win = curses.newwin(5, width, (curses.LINES() - 5) / 2, (curses.COLS() - width) / 2);
  win:box('|', '-');
  win:mvaddstr(2, 3, message);
  win:getch();
  win:delwin();
end

curses.initscr();
curses.cbreak();
curses.mvaddstr((curses.LINES() - 5) / 2, (curses.COLS() - 10) / 2, "Hit any key");
curses.getch();
show_message("Hello, World!")

curses.endwin();

