MAKEPATH:=$(dir $(lastword $(MAKEFILE_LIST)))
-include $(MAKEPATH)config.mk
-include $(MAKEPATH)gccconfig.mk

.PHONY: all build compile luacompile luasource clean luaclean

all: build

build: luabuild gccbuild

luabuild: lua$(LUA_TARGET)

gccbuild: compile
compile:

clean: luaclean

luasource:
	mkdir -p dist$(LUA_MODULEDIR)
	mkdir -p dist$(LUCI_MODULEDIR)
	mkdir -p dist$(HTDOCS)
	cp -pR root/* dist 2>/dev/null || true
	cp -pR luasrc/* dist$(LUCI_MODULEDIR) 2>/dev/null || true
	cp -pR lua/* dist$(LUA_MODULEDIR) 2>/dev/null || true
	cp -pR htdocs/* dist$(HTDOCS) 2>/dev/null || true
	for i in $$(find dist -name .svn -o -name .gitignore); do rm -rf $$i || true; done
  ifneq ($(PO),)
	mkdir -p dist$(LUCI_I18NDIR)
	for file in $(PO); do \
	  cp $(HOST)/lua-po/$$file.$(if $(PO_LANG),$(PO_LANG),*).* dist$(LUCI_I18NDIR)/ 2>/dev/null || true; \
	done
  endif


luadiet: luasource
	for i in $$(find dist -type f -name '*.lua'); do LUA_PATH="../../contrib/luasrcdiet/lua/?.lua" $(LUA) ../../contrib/luasrcdiet/lua/LuaSrcDiet.lua --maximum $$i -o $$i.diet && mv $$i.diet $$i; done

luastrip: luasource
	for i in $$(find dist -type f -name '*.lua'); do perl -e 'undef $$/; open( F, "< $$ARGV[0]" ) || die $$!; $$src = <F>; close F; $$src =~ s/--\[\[.*?\]\](--)?//gs; $$src =~ s/^\s*--.*?\n//gm; open( F, "> $$ARGV[0]" ) || die $$!; print F $$src; close F' $$i; done

luacompile: luasource
	for i in $$(find dist -name *.lua -not -name debug.lua| sort); do if ! $(LUAC) $(LUAC_OPTIONS) -o $$i $$i; then echo "Error compiling $$i"; exit 1; fi; done

luaclean:
	rm -rf dist

