include build/config.mk

MODULES = contrib/* applications/* libs/* modules/* themes/* i18n/*

OS:=$(shell uname)
export OS

.PHONY: all build gccbuild luabuild clean host gcchost luahost hostcopy hostclean

all: build

build: gccbuild luabuild

gccbuild:
	for i in $(MODULES); do make -C$$i compile; done

luabuild:
	for i in $(MODULES); do make -C$$i luabuild; done

clean:
	rm -rf docs
	for i in $(MODULES); do make -C$$i clean; done


host: build hostcopy

gcchost: gccbuild hostcopy

luahost: luabuild hostcopy

hostcopy: 
	mkdir -p host/tmp
	for i in $(MODULES); do cp -pR $$i/dist/* host/ 2>/dev/null || true; done
	for i in $(MODULES); do cp -pR $$i/hostfiles/* host/ 2>/dev/null || true; done
	rm -f host/luci
	ln -s .$(LUCI_MODULEDIR) host/luci
	rm -rf /tmp/luci-* || true

hostenv: host ucidefaults

ucidefaults:
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "$(realpath host)/bin/uci-defaults --exclude luci-freifunk-*"

runboa: hostenv
	libs/sgi-webuci/host/buildconfig.sh $(realpath host) > host/etc/boa/boa.conf
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "$(realpath host/usr/bin/boa) -c $(realpath host/etc/boa) -d"

runhttpd: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "$(realpath host/usr/bin/lucittpd) $(realpath host)/usr/lib/lucittpd/plugins"

runluci: runhttpd

runlua: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) lua

runshell: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) $$SHELL

hostclean: clean
	rm -rf host

apidocs: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) "build/makedocs.sh host/luci/ docs"

uvldocs: hostenv
	build/hostenv.sh $(realpath host) $(LUA_MODULEDIR) $(LUA_LIBRARYDIR) \
	"build/uvldoc $(realpath host) $(UVL_SCHEMEDIR) uvldocs $(DOCS)"

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
