include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk

BWC_LDFLAGS    = -ldl
BWC_CFLAGS     =
BWC_BIN        = luci-bwc
BWC_OBJ        = src/luci-bwc.o

%.o: %.c
	$(COMPILE) $(BWC_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $<

compile: build-clean $(BWC_OBJ)
	$(LINK) -o src/$(BWC_BIN) $(BWC_OBJ) $(BWC_LDFLAGS)
	mkdir -p dist/usr/bin
	cp src/$(BWC_BIN) dist/usr/bin/$(BWC_BIN)

install: build
	cp -pR dist/usr/bin/$(BWC_BIN) /usr/bin/$(BWC_BIN)

clean: build-clean

build-clean:
	rm -f src/*.o src/$(BWC_BIN)
