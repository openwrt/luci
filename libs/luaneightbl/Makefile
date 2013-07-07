ifneq (,$(wildcard ../../build/config.mk))
include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk
else
include standalone.mk
endif

NEIGHTBL_CFLAGS = $(CPPFLAGS) $(CFLAGS) $(EXTRA_CFLAGS) $(WFLAGS)

NEIGHTBL_OBJ = src/neightbl.o
NEIGHTBL_LIB = src/neightbl.so

%.o: %.c
	$(CC) $(NEIGHTBL_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $<

compile: $(NEIGHTBL_OBJ)
	$(LINK) $(SHLIB_FLAGS) -o $(NEIGHTBL_LIB) $(NEIGHTBL_OBJ)
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp $(NEIGHTBL_LIB) dist$(LUA_LIBRARYDIR)/

clean: luaclean
	rm -f src/*.o src/*.so src/*.a src/*.dll

