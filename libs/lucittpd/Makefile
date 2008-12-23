ifeq ($(CFLAGS),)
	MYLDFLAGS ?= -L../../../contrib/uci/dist/usr/lib/
endif

include ../../build/module.mk
include ../../build/config.mk
include ../../build/gccconfig.mk

compile:
	make -Csrc \
		CFLAGS="$(CFLAGS) $(FPIC) $(LUA_CFLAGS) $(EXTRA_CFLAGS) $(WFLAGS)" \
		LDFLAGS="$(LDFLAGS) $(LUA_SHLIBS) -luci" \
		MYLDFLAGS="$(MYLDFLAGS)"
	mkdir -p dist/usr/bin
	cp src/lucittpd dist/usr/bin

clean: luaclean
	make -Csrc clean
