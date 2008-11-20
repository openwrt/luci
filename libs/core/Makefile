include ../../build/config.mk
include ../../build/module.mk

%.o: %.c
	$(COMPILE) $(LUA_CFLAGS) $(FPIC) -c -o $@ $<

compile: src/luci_cutil.o
	mkdir -p dist$(LUCI_LIBRARYDIR)
	$(LINK) $(SHLIB_FLAGS) -o dist$(LUCI_LIBRARYDIR)/cutil.so src/luci_cutil.o

clean: luaclean
	rm -f src/*.o
