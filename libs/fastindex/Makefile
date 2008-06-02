include ../../build/config.mk
include ../../build/gccconfig.mk

%.o: %.c
	$(COMPILE) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

compile: src/fastindex.o
	mkdir -p dist/usr/lib/lua/luci
	$(LINK) $(SHLIB_FLAGS) -o dist/usr/lib/lua/luci/fastindex.so src/fastindex.o $(LUA_SHLIBS)

clean:
	rm -f src/*.o
