include ../../build/module.mk
include ../../build/config.mk
include ../../build/gccconfig.mk

%.o: %.c
	$(COMPILE) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

compile: src/fastindex.o
	mkdir -p dist$(LUCI_LIBRARYDIR)
	$(LINK) $(SHLIB_FLAGS) -o dist$(LUCI_LIBRARYDIR)/fastindex.so src/fastindex.o $(LUA_SHLIBS)

clean:
	rm -f src/*.o
