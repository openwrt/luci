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
WFLAGS = -Wall -pedantic
CPPFLAGS =
COMPILE = $(CC) $(CPPFLAGS) $(CFLAGS) $(EXTRA_CFLAGS) $(WFLAGS)
ifeq ($(OS),Darwin)
  SHLIB_FLAGS = -bundle -undefined dynamic_lookup
else
  SHLIB_FLAGS = -shared
endif
LINK = $(CC) $(LDFLAGS)

