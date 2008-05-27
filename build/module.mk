.PHONY: all compile compile-module source source-module clean clean-module

all: compile
compile: compile-module
clean: clean-module
source: source-module

source-module:
	mkdir -p dist$(LUCI_INSTALLDIR)
	cp root/* dist -R 2>/dev/null || true
	cp luasrc/* dist$(LUCI_INSTALLDIR) -R 2>/dev/null || true
	for i in $$(find dist -name .svn); do rm $$i -rf; done  
	
compile-module: source-module
	for i in $$(find dist -name *.lua -not -name debug.lua); do $(LUAC) $(LUAC_OPTIONS) -o $$i $$i; done

clean-module:
	rm -rf dist

