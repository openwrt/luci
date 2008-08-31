
SRC=src/curses.c src/luacurses.c
INCLUDE=/usr/include/lua5.1
CFLAGS=-shared -ansi -Wall -O2 -I$(INCLUDE) -fpic

all: lib/curses.so

lib/curses.so: $(SRC)
	if ! [ -d lib ]; then mkdir lib; fi
	gcc $(CFLAGS) -o lib/curses.so $(SRC)

clean:
	rm -Rf lib
	
	
