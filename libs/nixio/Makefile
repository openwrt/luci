include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk

AXTLS_VERSION = 1.2.1
AXTLS_DIR     = axTLS
AXTLS_FILE    = $(AXTLS_DIR)-$(AXTLS_VERSION).tar.gz
NIXIO_TLS    ?= axtls
EXTRA_CFLAGS  = -std=c99
NIXIO_CFLAGS  = -D_XOPEN_SOURCE=500

NIXIO_OBJ = src/nixio.o src/socket.o src/sockopt.o src/bind.o src/address.o \
	    src/poll.o src/io.o src/file.o src/splice.o src/process.o \
	    src/tls-context.o src/tls-socket.o

ifeq ($(NIXIO_TLS),axtls)
	TLS_CFLAGS = -IaxTLS/{ssl,crypto,config} -include src/openssl-compat.h
	TLS_LDFLAGS =
	TLS_DEPENDS = src/openssl-compat.o
	NIXIO_OBJ += src/openssl-compat.o src/libaxtls.a
endif

ifeq ($(NIXIO_TLS),openssl)
	TLS_LDFLAGS = -lssl
endif

ifeq ($(OS),Linux)
	NIXIO_CFLAGS = -D_GNU_SOURCE
endif

%.o: %.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

src/tls-context.o: $(TLS_DEPENDS) src/tls-context.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) $(TLS_CFLAGS) -c -o $@ src/tls-context.c
	
src/tls-socket.o: $(TLS_DEPENDS) src/tls-socket.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) $(TLS_CFLAGS) -c -o $@ src/tls-socket.c
	
src/openssl-compat.o: src/libaxtls.a src/openssl-compat.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) $(TLS_CFLAGS) -c -o $@ src/openssl-compat.c
	mkdir -p dist
	cp -pR axtls-root/* dist/
	

compile: $(NIXIO_OBJ)
	$(LINK) $(SHLIB_FLAGS) $(TLS_LDFLAGS) -o src/nixio.so $(NIXIO_OBJ)
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp src/nixio.so dist$(LUA_LIBRARYDIR)/nixio.so

$(AXTLS_DIR)/.prepared:
	#rm -rf $(AXTLS_DIR)
	#tar xvfz $(AXTLS_FILE)
	cp axtls-config/{.config,config.h} $(AXTLS_DIR)/config
	touch $@

src/libaxtls.a: $(AXTLS_DIR)/.prepared
	$(MAKE) -C $(AXTLS_DIR) CC=$(CC) CFLAGS="$(CFLAGS) $(EXTRA_CFLAGS) $(FPIC) '-Dalloca(size)=__builtin_alloca(size)' -Wall -pedantic -I../config -I../ssl -I../crypto" LDFLAGS="$(LDFLAGS)" OS="$(OS)" clean all
	cp -p $(AXTLS_DIR)/_stage/libaxtls.a src

clean: luaclean
	rm -f src/*.o src/*.so src/*.a
	rm -f $(AXTLS_DIR)/.prepared
