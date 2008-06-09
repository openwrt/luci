include build/config.mk

MODULES = applications/* libs/* modules/* themes/* i18n/* contrib/luaposix
LUA_TARGET = source

OS:=$(shell uname)
export OS

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
	for i in $(MODULES); do cp -a $$i/dist/* host/ -R 2>/dev/null || true; done
	rm -f host/luci
	ln -s .$(LUCI_INSTALLDIR) host/luci

run: host
	./host/usr/bin/boa -c ./host/etc/boa -d

hostclean: clean
	rm -rf host
