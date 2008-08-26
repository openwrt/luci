include ../../build/config.mk
include ../../build/gccconfig.mk

UCI_VERSION  = 0.6.0
UCI_APPEND   = +luci1
#UCI_SITE    = http://mirror2.openwrt.org/sources
#UCI_DIR     = uci-$(UCI_VERSION)
#UCI_FILE    = $(UCI_DIR).tar.gz
#UCI_URL     = $(UCI_SITE)/$(UCI_FILE)
UCI_GITREV   = 12c5b22102873e303e540f886489831461d54ea9
UCI_SITE     = http://nbd.name
UCI_DIR      = uci.git
UCI_FILE     = uci-$(UCI_VERSION)$(UCI_APPEND).tar.gz
UCI_URL      = $(UCI_SITE)/gitweb.cgi?p=uci.git;a=snapshot;h=$(UCI_GITREV)
UCI_PATCHDIR = patches

all: compile

include ../../build/module.mk

$(UCI_FILE):
	wget -O $@ "$(UCI_URL)" || rm -f $@

$(UCI_PATCHDIR)/series:
	(cd $(UCI_PATCHDIR); ls *.patch | sort > series)

$(UCI_DIR)/.prepared: $(UCI_FILE)
	rm -rf $(UCI_DIR)
	tar xvfz $(UCI_FILE)
	ln -s ../$(UCI_PATCHDIR) $(UCI_DIR)/patches
	touch $@

$(UCI_DIR)/.patched: $(UCI_DIR)/.prepared $(UCI_PATCHDIR)/series
	(cd $(UCI_DIR); \
		if [ -x "$$(which quilt 2>/dev/null)" ]; then \
			quilt push -a; \
		else \
			cat patches/*.patch | patch -p1; \
		fi; \
	)
	touch $@

refresh: $(UCI_DIR)/.patched
	(cd $(UCI_DIR); \
		for i in $$(quilt series); do \
			quilt refresh $$i; \
		done; \
	)

compile: $(UCI_DIR)/.patched
	$(MAKE) -C $(UCI_DIR) CC=$(CC) CFLAGS="$(CFLAGS)" LDFLAGS="$(LDFLAGS)" OS="$(OS)"
	mkdir -p dist/usr/lib dist/usr/bin
	$(MAKE) -C $(UCI_DIR) install DESTDIR=../dist prefix=/usr
	$(MAKE) -C $(UCI_DIR)/lua CC=$(CC) CFLAGS="$(CFLAGS)" LDFLAGS="$(LDFLAGS)" OS="$(OS)"
	$(MAKE) -C $(UCI_DIR)/lua install DESTDIR=../../dist luadir=$(LUA_LIBRARYDIR)


compile-all: compile

clean:
	rm -rf $(UCI_DIR) $(UCI_FILE)
