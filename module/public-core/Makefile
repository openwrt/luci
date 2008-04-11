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
	for i in $(CPFILES); do if [ -f "$$i" ]; then i=$$(echo $$i | cut -d/ -f2-); \
		mkdir -p dist/$$(dirname $$i); cp src/$$i dist/$$i; fi; done

compile: depends
	for i in $(INFILES); do if [ -f "$$i" ]; then i=$$(echo $$i | cut -d/ -f2-); \
		mkdir -p dist/$$(dirname $$i); $(LUAC) $(LUAC_OPTIONS) -o dist/$$i src/$$i; fi; done
	
source: depends
	for i in $(INFILES); do if [ -f "$$i" ]; then i=$$(echo $$i | cut -d/ -f2-); \
		mkdir -p dist/$$(dirname $$i); cp src/$$i dist/$$i; fi; done
	
	
clean:
	rm dist -rf
