ifeq ($(CFLAGS),)
	MYLDFLAGS ?= -L../../../contrib/uci/dist/usr/lib/
endif

include ../../build/module.mk
include ../../build/config.mk
include ../../build/gccconfig.mk

compile: 
ifneq ($(OS),Darwin)
	make -Csrc \
		CFLAGS="$(CFLAGS) $(FPIC) $(LUA_CFLAGS) $(EXTRA_CFLAGS)" \
		LDFLAGS="$(LDFLAGS)" \
		MYLDFLAGS="$(MYLDFLAGS)"
	mkdir -p dist/usr/lib/lua/
	cp src/luanet.so dist/usr/lib/lua
endif

clean: luaclean
	make -Csrc clean
