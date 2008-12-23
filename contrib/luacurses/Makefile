include ../../build/module.mk
include ../../build/config.mk
include ../../build/gccconfig.mk

compile: dist$(LUA_LIBRARYDIR)/curses.so
	
dist$(LUA_LIBRARYDIR)/curses.so:
	mkdir -p dist$(LUA_LIBRARYDIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(EXTRA_CFLAGS) $(SHLIB_FLAGS) -pedantic \
	-Wall $(FPIC) $(LUA_CFLAGS) -o dist$(LUA_LIBRARYDIR)/curses.so src/curses.c src/luacurses.c
