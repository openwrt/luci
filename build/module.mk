.PHONY: all build compile luacompile luasource clean luaclean

all: build

build: luabuild gccbuild

luabuild: lua$(LUA_TARGET)

gccbuild: compile
compile:

clean: luaclean

luasource:
	mkdir -p dist$(LUCI_INSTALLDIR)
	cp -a root/* dist -R 2>/dev/null || true
	cp -a luasrc/* dist$(LUCI_INSTALLDIR) -R 2>/dev/null || true
	for i in $$(find dist -name .svn); do rm $$i -rf; done  
	
luacompile: luasource
	for i in $$(find dist -name *.lua -not -name debug.lua); do $(LUAC) $(LUAC_OPTIONS) -o $$i $$i; done

luaclean:
	rm -rf dist

