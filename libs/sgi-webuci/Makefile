include ../../build/config.mk
include ../../build/gccconfig.mk
include ../../build/module.mk

BOA_VERSION = 0.94.13
BOA_SITE = http://www.boa.org
BOA_DIR = boa-$(BOA_VERSION)
BOA_FILE = $(BOA_DIR).tar.gz
BOA_URL = $(BOA_SITE)/$(BOA_FILE)
BOA_PATCHDIR = boa-patches

$(BOA_FILE):
	wget -O $@ $(BOA_URL) || rm -f $@

$(BOA_PATCHDIR)/series:
	(cd $(BOA_PATCHDIR); ls *.patch | sort > series)

$(BOA_DIR)/.prepared: $(BOA_FILE)
	rm -rf $(BOA_DIR)
	tar xvfz $(BOA_FILE)
	ln -s ../$(BOA_PATCHDIR) $(BOA_DIR)/patches
	touch $@

$(BOA_DIR)/.patched: $(BOA_DIR)/.prepared $(BOA_PATCHDIR)/series
	(cd $(BOA_DIR); \
		if [ -x "$$(which quilt 2>/dev/null)" ]; then \
			[ "$$(quilt top 2>/dev/null)" = "$$(tail -n1 patches/series)" ] || quilt push -a; \
		else \
			cat patches/*.patch | patch -p1; \
		fi; \
	)
	touch $@

$(BOA_DIR)/.configured: $(BOA_DIR)/.patched
	(cd $(BOA_DIR)/src; ./configure --disable-debug) 
	touch $@

boa-compile: $(BOA_DIR)/.configured
	$(MAKE) -C $(BOA_DIR)/src CC=$(CC) CFLAGS="$(CFLAGS) -DINET6 -DACCEPT_ON -DWHEN_DOES_THIS_APPLY"

%.o: %.c
	$(COMPILE) $(LUA_CFLAGS) -I$(BOA_DIR)/src $(FPIC) -c -o $@ $< 

compile: boa-compile src/luci.o src/cgi.o
	mkdir -p dist/usr/bin dist/usr/lib/boa
	cp $(BOA_DIR)/src/boa $(BOA_DIR)/src/boa_indexer dist/usr/bin
	$(LINK) $(SHLIB_FLAGS) -o dist/usr/lib/boa/luci.so src/luci.o src/cgi.o $(LDFLAGS) $(LUA_LIBS)

clean:
	rm -rf $(BOA_DIR) $(BOA_FILE)
	rm -f boa-patches/series
	rm -f src/*.o
