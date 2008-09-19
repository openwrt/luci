include ../../build/config.mk
include ../../build/gccconfig.mk

LUAPOSIX_VERSION = 5.1.3
LUAPOSIX_SITE = http://dev.luci.freifunk-halle.net/sources/
LUAPOSIX_DIR = luaposix-$(LUAPOSIX_VERSION)
LUAPOSIX_FILE = $(LUAPOSIX_DIR).tar.gz
LUAPOSIX_URL = $(LUAPOSIX_SITE)/$(LUAPOSIX_FILE)
LUAPOSIX_PATCHDIR = patches

all: compile

include ../../build/module.mk

$(LUAPOSIX_FILE):
	wget -O $@ $(LUAPOSIX_URL) || rm -f $@

$(LUAPOSIX_PATCHDIR)/series:
	(cd $(LUAPOSIX_PATCHDIR); ls *.patch | sort > series)

$(LUAPOSIX_DIR)/.prepared: $(LUAPOSIX_FILE)
	rm -rf $(LUAPOSIX_DIR)
	tar xvfz $(LUAPOSIX_FILE)
	ln -s ../$(LUAPOSIX_PATCHDIR) $(LUAPOSIX_DIR)/patches
	touch $@

$(LUAPOSIX_DIR)/.patched: $(LUAPOSIX_DIR)/.prepared $(LUAPOSIX_PATCHDIR)/series
	(cd $(LUAPOSIX_DIR); \
		if [ -x "$$(which quilt 2>/dev/null)" ]; then \
			quilt push -a; \
		else \
			cat patches/*.patch | patch -p1; \
		fi; \
	)
	touch $@

compile: $(LUAPOSIX_DIR)/.patched
	$(MAKE) -C $(LUAPOSIX_DIR) CC=$(CC) CFLAGS="$(CFLAGS) $(LUA_CFLAGS)" LDFLAGS="$(LDFLAGS) $(LUA_SHLIBS)" OS="$(OS)"
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp $(LUAPOSIX_DIR)/posix.so dist$(LUA_LIBRARYDIR)

luasource:
luastrip:
luacompile:
compile-all: compile

clean:
	rm -rf $(LUAPOSIX_DIR) $(LUAPOSIX_FILE)
	rm -f $(LUAPOSIX_PATCHDIR)/series
