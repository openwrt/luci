LUAC = luac
LUAC_OPTIONS = -s

FILES = 

CFILES = ffluci/util.lua ffluci/http.lua ffluci/fs.lua \
ffluci/sys.lua ffluci/model/uci.lua ffluci/model/ipkg.lua \
ffluci/config.lua ffluci/i18n.lua ffluci/template.lua \
ffluci/cbi.lua ffluci/dispatcher.lua ffluci/menu.lua ffluci/init.lua 

DIRECTORIES = dist/ffluci/model/cbi dist/ffluci/model/menu dist/ffluci/controller dist/ffluci/i18n dist/ffluci/view

INFILES = $(CFILES:%=src/%)
OUTFILE = ffluci/init.lua

.PHONY: all dist-compile dist-source examples-compile examples-source dist examples compile source clean

all: compile

dist-compile: compile dist
dist-source: source dist

dist:
	cp src/ffluci/controller/* dist/ffluci/controller/ -R
	cp src/ffluci/i18n/* dist/ffluci/i18n/
	cp src/ffluci/view/* dist/ffluci/view/ -R
	cp src/ffluci/model/cbi/* dist/ffluci/model/cbi/ -R
	cp src/ffluci/model/menu/* dist/ffluci/model/menu/ -R

compile:
	mkdir -p $(DIRECTORIES)
	$(LUAC) $(LUAC_OPTIONS) -o dist/$(OUTFILE) $(INFILES)
	for i in $(CFILES); do [ -f dist/$$i ] || ln -s `dirname $$i | cut -s -d / -f 2- | sed -e 's/[^/]*\/*/..\//g'``basename $(OUTFILE)` dist/$$i; done
	for i in $(FILES); do cp src/$$i dist/$$i; done

source:
	mkdir -p $(DIRECTORIES)
	for i in $(CFILES); do cp src/$$i dist/$$i; done
	for i in $(FILES); do cp src/$$i dist/$$i; done
	
clean:
	rm dist -rf
