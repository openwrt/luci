include build/config.mk

MODULES = applications/* libs/* modules/* themes/* i18n/*
LUA_TARGET = source

### luaposix merge (temporary) ###
OS:=$(shell uname)
export OS
ifeq ($(OS),Darwin)
  MODULES += contrib/luaposix
endif


.PHONY: all build gccbuild luabuild clean host gcchost luahost hostcopy hostclean

all: build

build: luabuild gccbuild

gccbuild:
	for i in $(MODULES); do make -C$$i compile; done	

luabuild:
	for i in $(MODULES); do make -C$$i lua$(LUA_TARGET); done

clean:
	for i in $(MODULES); do make -C$$i clean; done


host: build hostcopy

gcchost: gccbuild hostcopy

luahost: luabuild hostcopy

hostcopy: 
	mkdir -p host
	for i in $(MODULES); do cp $$i/dist/* host/ -R 2>/dev/null || true; done
	ln -sf .$(LUCI_INSTALLDIR) host/luci

run: host
	./host/usr/bin/boa -c ./host/etc/boa -d

hostclean: clean
	rm -rf host
