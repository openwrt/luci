.PHONY: all compile source clean

all: compile

source:
	mkdir -p dist$(LUCI_INSTALLDIR)
	[ -d root ] && cp root/* dist -R
	[ -d src ] && cp src/* dist$(LUCI_INSTALLDIR) -R
	for i in $$(find dist -name .svn); do rm $$i -rf; done  
	
compile: source
	for i in $$(find dist -name *.lua); do $(LUAC) $(LUAC_OPTIONS) -o $$i $$i; done
	
clean:
	rm dist -rf
