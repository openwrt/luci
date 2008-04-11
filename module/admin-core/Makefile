LUAC = luac
LUAC_OPTIONS = -s

FILES = i18n/* view/*/*.htm

CFILES = controller/*/*.lua model/cbi/*/*.lua model/menu/*.lua 

DIRECTORIES = model/cbi model/menu controller i18n view


INFILES = $(CFILES:%=src/%)
OUTDIRS = $(DIRECTORIES:%=dist/%)
CPFILES = $(FILES:%=src/%)

.PHONY: all compile source clean depends

all: compile


depends:
	mkdir -p $(OUTDIRS)
	for i in $(CPFILES); do [ -f "$$i" ] && (i=$$(echo $$i | cut -d/ -f2-); \
		mkdir -p dist/$$(dirname $$i); cp src/$$i dist/$$i); done

compile: depends
	for i in $(INFILES); do [ -f "$$i" ] && (i=$$(echo $$i | cut -d/ -f2-); \
		mkdir -p dist/$$(dirname $$i); $(LUAC) $(LUAC_OPTIONS) -o dist/$$i src/$$i); done
	

source: depends
	for i in $(INFILES); do [ -f "$$i" ] && (i=$$(echo $$i | cut -d/ -f2-); \
		mkdir -p dist/$$(dirname $$i); cp src/$$i dist/$$i); done
	
	
clean:
	rm dist -rf
