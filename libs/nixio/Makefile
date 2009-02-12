include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk

%.o: %.c
	$(COMPILE) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

compile: src/nixio.o src/socket.o src/sockopt.o src/bind.o src/address.o src/poll.o src/io.o src/file.o src/splice.o
	$(LINK) $(SHLIB_FLAGS) -o src/nixio.so src/*.o
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp src/nixio.so dist$(LUA_LIBRARYDIR)/nixio.so

clean: luaclean
	rm -f src/*.o src/*.so
