LUAC = luac
LUAC_OPTIONS = -s

FILES = ffluci/debug.lua ffluci/view/*.htm ffluci/view/cbi/*.htm

CFILES = ffluci/util.lua ffluci/http.lua ffluci/fs.lua \
ffluci/sys.lua ffluci/model/uci.lua ffluci/model/ipkg.lua \
ffluci/config.lua ffluci/i18n.lua ffluci/template.lua \
ffluci/cbi.lua ffluci/dispatcher.lua ffluci/menu.lua ffluci/init.lua 

DIRECTORIES = ffluci/model/cbi ffluci/model/menu ffluci/controller ffluci/i18n ffluci/view/cbi

OUTDIRS = $(DIRECTORIES:%=dist/%)
INFILES = $(CFILES:%=src/%)
OUTFILE = ffluci/init.lua
CPFILES = $(FILES:%=src/%)

.PHONY: all compile source depends clean

all: compile

depends:
	mkdir -p $(OUTDIRS)
	for i in $(CPFILES); do [ -f "$$i" ] && (i=$$(echo $$i | cut -d/ -f2-); \
		mkdir -p dist/$$(dirname $$i); cp src/$$i dist/$$i); done

compile: depends
	$(LUAC) $(LUAC_OPTIONS) -o dist/$(OUTFILE) $(INFILES)
	for i in $(CFILES); do [ -f dist/$$i ] || ln -s `dirname $$i | cut -s -d / -f 2- | sed -e 's/[^/]*\/*/..\//g'``basename $(OUTFILE)` dist/$$i; done
	

source: depends
	for i in $(CFILES); do cp src/$$i dist/$$i; done
	
	
clean:
	rm dist -rf
