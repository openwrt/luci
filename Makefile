include build/config.mk

MODULES = contrib/* applications/* libs/* modules/* themes/* i18n/*

OS:=$(shell uname)
MODULES:=$(foreach item,$(wildcard $(MODULES)),$(if $(realpath $(wildcard $(item)/Makefile)),$(item)))

export OS

.PHONY: all build gccbuild luabuild clean host gcchost luahost hostcopy hostclean

all: build

build: gccbuild luabuild

gccbuild:
	make -C libs/web CC="cc" CFLAGS="" LDFLAGS="" SDK="$(shell test -f .running-sdk && echo 1)" host-install
	for i in $(MODULES); do \
		make -C$$i SDK="$(shell test -f .running-sdk && echo 1)" compile || { \
			echo "*** Compilation of $$i failed!"; \
			exit 1; \
		}; \
	done

luabuild: i18nbuild
	for i in $(MODULES); do HOST=$(realpath host) \
		SDK="$(shell test -f .running-sdk && echo 1)" make -C$$i luabuild; done

i18nbuild:
	mkdir -p host/lua-po
	./build/i18n-po2lua.pl ./po host/lua-po

clean:
	rm -f .running-sdk
	rm -rf docs
	make -C libs/lmo host-clean
	for i in $(MODULES); do make -C$$i clean; done


host: build hostcopy

gcchost: gccbuild hostcopy

luahost: luabuild hostcopy

hostcopy: 
	mkdir -p host/tmp
	mkdir -p host/var/state
	for i in $(MODULES); do cp -pR $$i/dist/* host/ 2>/dev/null || true; done
	for i in $(MODULES); do cp -pR $$i/hostfiles/* host/ 2>/dev/null || true; done
	rm -f host/luci
	ln -s .$(LUCI_MODULEDIR) host/luci
	rm -rf /tmp/luci-* || true

hostenv: sdk host ucidefaults

sdk:
	touch .running-sdk

ucidefaults:
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "$(realpath host)/bin/uci-defaults --exclude luci-freifunk-*"

runhttpd: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "lua build/lucid.lua"

runuhttpd: hostenv
	cp $(realpath build)/luci.cgi $(realpath host)/www/cgi-bin/luci
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "$(realpath host)/usr/sbin/uhttpd -p 8080 -h $(realpath host)/www -f"

runlua: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "lua -i build/setup.lua"

runshell: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) $$SHELL

hostclean: clean
	rm -rf host

apidocs: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "build/makedocs.sh host/luci/ docs"

nixiodocs: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "build/makedocs.sh libs/nixio/ nixiodocs"

po: host
	for L in $${LANGUAGE:-$$(find i18n/ -path 'i18n/*/luasrc/i18n/*' -name 'default.*.lua' | \
	  sed -e 's!.*/default\.\(.*\)\.lua!\1!')}; do \
	    build/i18n-lua2po.pl . $(realpath host)/po $$L; \
	done

run:
	#	make run is deprecated				#
	#	Please use:					#
	#							#
	#	To run LuCI WebUI using LuCIttpd		#
	#	make runhttpd					#
	#							#
	#	To run LuCI WebUI using Boa/Webuci		#
	#	make runboa 					#
	#							#
	#	To start a shell in the LuCI environment	#
	#	make runshell					#
	#							#
	#	To run Lua CLI in the LuCI environment		#
	#	make runlua					#
