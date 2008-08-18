include ../../build/config.mk
include ../../build/gccconfig.mk

#UCI_VERSION = 0.4.8
#UCI_SITE = http://mirror2.openwrt.org/sources
#UCI_DIR = uci-$(UCI_VERSION)
#UCI_FILE = $(UCI_DIR).tar.gz
#UCI_URL = $(UCI_SITE)/$(UCI_FILE)
UCI_VERSION = 0.4.8+git20080818-1
UCI_SITE = http://nbd.name
UCI_DIR = uci.git
UCI_FILE = 672d68a8765c242dd939a31b520acbe1c9c1d7c2.tar.gz
UCI_URL = $(UCI_SITE)/gitweb.cgi?p=uci.git;a=snapshot;h=672d68a8765c242dd939a31b520acbe1c9c1d7c2

all: compile

include ../../build/module.mk

$(UCI_FILE):
	wget -O $@ "$(UCI_URL)" || rm -f $@

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
