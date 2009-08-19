ifneq (,$(wildcard ../../build/config.mk))
include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk
else
include standalone.mk
endif

IWINFO_LDFLAGS    =
IWINFO_CFLAGS     = -fstrict-aliasing
IWINFO_SO         = iwinfo.so
IWINFO_LUA        = iwinfo.lua
IWINFO_OBJ        = src/iwinfo_wl.o src/iwinfo_madwifi.o src/iwinfo_wext.o src/iwinfo_lualib.o

%.o: %.c
	$(COMPILE) $(IWINFO_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

ifeq ($(SDK),)
compile: clean $(IWINFO_OBJ)
	$(LINK) $(SHLIB_FLAGS) $(IWINFO_LDFLAGS) -o src/$(IWINFO_SO) $(IWINFO_OBJ)
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp src/$(IWINFO_SO) dist$(LUA_LIBRARYDIR)/$(IWINFO_SO)
else
compile: clean
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp src/dummy.lua dist$(LUA_LIBRARYDIR)/$(IWINFO_LUA)
endif

install: build
	cp -pR dist$(LUA_LIBRARYDIR)/* $(LUA_LIBRARYDIR)

clean:
	rm -f src/*.o src/$(IWINFO_SO)

host-compile:
