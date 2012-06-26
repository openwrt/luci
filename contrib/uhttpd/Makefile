include ../../build/config.mk
include ../../build/gccconfig.mk

UHTTPD_SRC		= svn://svn.openwrt.org/openwrt/branches/backfire/package/uhttpd/src
UHTTPD_DIR		= uhttpd-src
UHTTPD_PATCHDIR = patches

all: compile

include ../../build/module.mk

$(UHTTPD_DIR)/Makefile:
	svn co $(UHTTPD_SRC) $(UHTTPD_DIR)

$(UHTTPD_DIR)/.prepared: $(UHTTPD_DIR)/Makefile
	(cd $(UHTTPD_PATCHDIR); ls *.patch | sort > series) || true
	[ -f "$(UHTTPD_PATCHDIR)/series" ] && while read patch; do \
		patch -d $(UHTTPD_DIR) -p1 < $(UHTTPD_PATCHDIR)/$$patch; \
	done < $(UHTTPD_PATCHDIR)/series || true
	touch $@

compile: $(UHTTPD_DIR)/.prepared
	(cd $(UHTTPD_DIR); $(MAKE) LUA_SUPPORT=0 TLS_SUPPORT=0 CGI_SUPPORT=1)
	mkdir -p dist/usr/sbin
	cp $(UHTTPD_DIR)/uhttpd dist/usr/sbin

compile-all: compile

clean:
	rm -rf $(UHTTPD_DIR)
