.PHONY: all compile source clean

all: compile

source:
	mkdir -p dist$(LUCI_INSTALLDIR)
	cp root/* dist -R 2>/dev/null || true
	cp src/* dist$(LUCI_INSTALLDIR) -R 2>/dev/null || true
	for i in $$(find dist -name .svn); do rm $$i -rf; done  
	
compile: source
	for i in $$(find dist -name *.lua -not -name debug.lua); do $(LUAC) $(LUAC_OPTIONS) -o $$i $$i; done
	
clean:
	rm -rf dist
