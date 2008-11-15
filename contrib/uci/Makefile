include ../../build/config.mk
include ../../build/gccconfig.mk

UCI_VERSION  = 0.6.4
UCI_SITE    = http://mirror2.openwrt.org/sources
UCI_DIR     = uci-$(UCI_VERSION)
UCI_FILE    = $(UCI_DIR).tar.gz
UCI_URL     = $(UCI_SITE)/$(UCI_FILE)
#UCI_GITREV   = c79cc497e7b0caa0f9f6a2c978fa9a5f0f097463
#UCI_SITE     = http://nbd.name
#UCI_DIR      = uci.git
#UCI_FILE     = uci-$(UCI_VERSION)$(UCI_APPEND).tar.gz
#UCI_URL      = $(UCI_SITE)/gitweb.cgi?p=uci.git;a=snapshot;h=$(UCI_GITREV)
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
	touch $@

compile: $(UCI_DIR)/.prepared
	$(MAKE) -C $(UCI_DIR) CC=$(CC) CFLAGS="$(CFLAGS)" LDFLAGS="$(LDFLAGS)" OS="$(OS)"
	mkdir -p dist/usr/lib dist/usr/bin
	$(MAKE) -C $(UCI_DIR) install DESTDIR=../dist prefix=/usr
	$(MAKE) -C $(UCI_DIR)/lua CC=$(CC) CFLAGS="$(CFLAGS)" LDFLAGS="$(LDFLAGS)" OS="$(OS)"
	$(MAKE) -C $(UCI_DIR)/lua install DESTDIR=../../dist luadir=$(LUA_LIBRARYDIR)

compile-all: compile

clean:
	rm -rf $(UCI_DIR) $(UCI_FILE)
