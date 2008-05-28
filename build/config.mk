OS ?= $(shell uname)

LUAC = luac
LUAC_OPTIONS = -s
LUCI_INSTALLDIR = /usr/lib/lua/luci
LUA_SHLIBS = $(shell pkg-config --silence-errors --libs lua5.1)
LUA_LIBS = $(if $(LUA_SHLIBS),$(LUA_SHLIBS),$(firstword $(wildcard /usr/lib/liblua.a /usr/local/lib/liblua.a /opt/local/lib/liblua.a)))
LUA_CFLAGS = $(shell pkg-config --silence-errors --cflags lua5.1)
ifeq ($(LUA_LIBS),)
  $(error LUA installation not found)
endif

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
LINK = $(CC)

