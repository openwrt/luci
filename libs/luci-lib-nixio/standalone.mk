LUAC = luac
LUAC_OPTIONS = -s
LUA_TARGET ?= source

LUA_MODULEDIR = /usr/local/share/lua/5.1
LUA_LIBRARYDIR = /usr/local/lib/lua/5.1

OS ?= $(shell uname)

LUA_SHLIBS = $(shell pkg-config --silence-errors --libs lua5.1 || pkg-config --silence-errors --libs lua-5.1 || pkg-config --silence-errors --libs lua)
LUA_LIBS = $(if $(LUA_SHLIBS),$(LUA_SHLIBS),$(firstword $(wildcard /usr/lib/liblua.a /usr/local/lib/liblua.a /opt/local/lib/liblua.a)))
LUA_CFLAGS = $(shell pkg-config --silence-errors --cflags lua5.1 || pkg-config --silence-errors --cflags lua-5.1 || pkg-config --silence-errors --cflags lua)

CC = gcc
AR = ar
RANLIB = ranlib
CFLAGS = -O2
FPIC = -fPIC
EXTRA_CFLAGS = --std=gnu99
WFLAGS = -Wall -Werror -pedantic
CPPFLAGS =
COMPILE = $(CC) $(CPPFLAGS) $(CFLAGS) $(EXTRA_CFLAGS) $(WFLAGS)
ifeq ($(OS),Darwin)
  SHLIB_FLAGS = -bundle -undefined dynamic_lookup
else
  SHLIB_FLAGS = -shared
endif
LINK = $(CC) $(LDFLAGS)

.PHONY: all build compile luacompile luasource clean luaclean

all: build

build: luabuild gccbuild

luabuild: lua$(LUA_TARGET)

gccbuild: compile
compile:

clean: luaclean

luasource:
	mkdir -p dist$(LUA_MODULEDIR)
	cp -pR lua/* dist$(LUA_MODULEDIR) 2>/dev/null || true
	for i in $$(find dist -name .svn); do rm -rf $$i || true; done

luastrip: luasource
	for i in $$(find dist -type f -name '*.lua'); do perl -e 'undef $$/; open( F, "< $$ARGV[0]" ) || die $$!; $$src = <F>; close F; $$src =~ s/--\[\[.*?\]\](--)?//gs; $$src =~ s/^\s*--.*?\n//gm; open( F, "> $$ARGV[0]" ) || die $$!; print F $$src; close F' $$i; done

luacompile: luasource
	for i in $$(find dist -name *.lua -not -name debug.lua); do $(LUAC) $(LUAC_OPTIONS) -o $$i $$i; done

luaclean:
	rm -rf dist
