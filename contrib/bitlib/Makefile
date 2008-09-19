include ../../build/config.mk
include ../../build/gccconfig.mk

BITLIB_VERSION = 25
BITLIB_SITE = http://dev.luci.freifunk-halle.net/sources/
BITLIB_DIR = bitlib-$(BITLIB_VERSION)
BITLIB_FILE = $(BITLIB_DIR).tar.gz
BITLIB_URL = $(BITLIB_SITE)/$(BITLIB_FILE)

all: compile

include ../../build/module.mk

$(BITLIB_FILE):
	wget -O $@ $(BITLIB_URL) || rm -f $@

$(BITLIB_DIR)/.prepared: $(BITLIB_FILE)
	rm -rf $(BITLIB_DIR)
	tar xvfz $(BITLIB_FILE)
	test -f $(BITLIB_DIR)/config.h || cp $(BITLIB_DIR)/config.h.in $(BITLIB_DIR)/config.h
	touch $@

compile: $(BITLIB_DIR)/.prepared dist$(LUA_LIBRARYDIR)/bit.so

dist$(LUA_LIBRARYDIR)/bit.so:
	mkdir -p dist$(LUA_LIBRARYDIR)
	$(COMPILE) -DHAVE_CONFIG_H -I$(BITLIB_DIR) -O2 -c $(BITLIB_DIR)/lbitlib.c $(FPIC) $(LUA_CFLAGS) -o $(BITLIB_DIR)/lbitlib.o
	$(LINK) $(SHLIB_FLAGS) $(LDFLAGS) $(BITLIB_DIR)/lbitlib.o $(LUA_SHLIBS) -lm -ldl -o dist$(LUA_LIBRARYDIR)/bit.so

luasource:
luastrip:
luacompile:
compile-all: compile

clean:
	rm -rf $(BITLIB_DIR) $(BITLIB_FILE)
