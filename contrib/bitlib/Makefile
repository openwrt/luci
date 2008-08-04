include ../../build/config.mk
include ../../build/gccconfig.mk

BITLIB_VERSION = 25
BITLIB_SITE = http://luaforge.net/frs/download.php/3065/
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
	touch $@

$(BITLIB_DIR)/.configured: $(BITLIB_DIR)/.prepared
	( cd $(BITLIB_DIR); ./configure )
	touch $@

compile: $(BITLIB_DIR)/.configured
	$(MAKE) -C $(BITLIB_DIR) CC=$(CC) CFLAGS="$(CFLAGS) $(LUA_CFLAGS)" LDFLAGS="$(LDFLAGS) $(LUA_SHLIBS)" OS="$(OS)"
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp $(BITLIB_DIR)/.libs/bit.so.0.0.0 dist$(LUA_LIBRARYDIR)/bit.so

luasource:
luastrip:
luacompile:
compile-all: compile

clean:
	rm -rf $(BITLIB_DIR) $(BITLIB_FILE)
