MAKEPATH:=$(dir $(lastword $(MAKEFILE_LIST)))
-include $(MAKEPATH)config.mk
-include $(MAKEPATH)gccconfig.mk

.PHONY: all build compile luacompile luasource clean luaclean

all: build

build: luabuild gccbuild

luabuild: i18n lua$(LUA_TARGET)

gccbuild: compile
compile:

clean: luaclean

i18n:
	[ -n "$(XSLTPROC)" ] && for i in luasrc/i18n/*.xml; do [ "$$i" -nt "$${i%%[.]xml}.lua" ]\
	&& $(XSLTPROC) $(MAKEPATH)i18n-lua-xhtml1.xsl $$i > $${i%%[.]xml}.lua; done || true

luasource:
	mkdir -p dist$(LUA_MODULEDIR)
	mkdir -p dist$(LUCI_MODULEDIR)
	mkdir -p dist$(HTDOCS)
	cp -pR root/* dist 2>/dev/null || true
	cp -pR luasrc/* dist$(LUCI_MODULEDIR) 2>/dev/null || true
	cp -pR lua/* dist$(LUA_MODULEDIR) 2>/dev/null || true
	cp -pR htdocs/* dist$(HTDOCS) 2>/dev/null || true
	for i in $$(find dist -name .svn); do rm -rf $$i || true; done
	for i in dist$(LUCI_MODULEDIR)/i18n/*.xml; do [ -f "$$i" ] && rm $$i; done || true


luastrip: luasource
	for i in $$(find dist -type f -name '*.lua'); do perl -e 'undef $$/; open( F, "< $$ARGV[0]" ) || die $$!; $$src = <F>; close F; $$src =~ s/--\[\[.*?\]\](--)?//gs; $$src =~ s/^\s*--.*?\n//gm; open( F, "> $$ARGV[0]" ) || die $$!; print F $$src; close F' $$i; done

luacompile: luasource
	for i in $$(find dist -name *.lua -not -name debug.lua); do $(LUAC) $(LUAC_OPTIONS) -o $$i $$i; done

luagzip: luacompile
	for i in $$(find dist -name *.lua -not -name debug.lua); do gzip -f9 $$i; done

luaclean:
	rm -rf dist

