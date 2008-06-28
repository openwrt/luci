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
	ln -s .$(LUCI_MODULEDIR) host/luci

runboa: host
	export LUA_PATH="`pwd`/host$(LUCI_MODULEDIR);;"
	export LUA_CPATH="`pwd`/host$(LUCI_LIBRARYDIR);;"
	libs/sgi-webuci/host/buildconfig.sh `pwd`/host  > host/etc/boa/boa.conf
	./host/usr/bin/boa -c ./host/etc/boa -d

runluci: luahost
	export LUA_PATH="`pwd`/host$(LUCI_MODULEDIR);;"
	export LUA_CPATH="`pwd`/host$(LUCI_LIBRARYDIR);;"
	libs/httpd/host/runluci host$(HTDOCS)

hostclean: clean
	rm -rf host

run:
	#	make run is deprecated			#
	#	Please use:				#
	#						#
	#	make runluci to use LuCI HTTPD		#
	#	make runboa  to use Boa / Webuci	#
