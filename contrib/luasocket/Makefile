include ../../build/config.mk
include ../../build/gccconfig.mk

LUASOCKET_VERSION = 2.0.2
LUASOCKET_SITE = http://dev.luci.freifunk-halle.net/sources/
LUASOCKET_DIR = luasocket-$(LUASOCKET_VERSION)
LUASOCKET_FILE = $(LUASOCKET_DIR).tar.gz
LUASOCKET_URL = $(LUASOCKET_SITE)/$(LUASOCKET_FILE)
INSTALL_MODULEDIR = dist$(LUA_MODULEDIR)
INSTALL_LIBRARYDIR = dist$(LUA_LIBRARYDIR)

all: compile

include ../../build/module.mk

$(LUASOCKET_FILE):
	wget -O $@ $(LUASOCKET_URL) || rm -f $@

$(LUASOCKET_DIR)/.prepared: $(LUASOCKET_FILE)
	rm -rf $(LUASOCKET_DIR)
	tar xvfz $(LUASOCKET_FILE)
	touch $@

compile: $(LUASOCKET_DIR)/.prepared
	$(MAKE) -C $(LUASOCKET_DIR) CC=$(CC) CFLAGS="$(CFLAGS) $(LUA_CFLAGS) $(FPIC)" LDFLAGS="$(LDFLAGS) $(LUA_SHLIBS) $(SHLIB_FLAGS)" OS="$(OS)"
	mkdir -p $(INSTALL_LIBRARYDIR) $(INSTALL_MODULEDIR)
	$(MAKE) -C $(LUASOCKET_DIR) install INSTALL_TOP_SHARE=../../$(INSTALL_MODULEDIR) INSTALL_TOP_LIB=../../$(INSTALL_LIBRARYDIR)

compile-all: compile

clean:
	rm -rf $(LUASOCKET_DIR) $(LUASOCKET_FILE)
