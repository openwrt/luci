include ../../build/module.mk
include ../../build/config.mk
include ../../build/gccconfig.mk

compile:
	mkdir -p dist$(LUA_LIBRARYDIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(EXTRA_CFLAGS) $(SHLIB_FLAGS) -pedantic \
	-Wall $(FPIC) $(LUA_CFLAGS) -o dist$(LUA_LIBRARYDIR)/curses.so src/src/curses.c src/src/luacurses.c
