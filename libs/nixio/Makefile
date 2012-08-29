ifneq (,$(wildcard ../../build/config.mk))
include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk
else
include standalone.mk
endif

AXTLS_VERSION = 1.2.1
AXTLS_DIR     = axTLS
AXTLS_FILE    = $(AXTLS_DIR)-$(AXTLS_VERSION).tar.gz
#NIXIO_TLS    ?= openssl
NIXIO_SHADOW ?= $(shell echo 'int main(void){ return !getspnam("root"); }' | $(CC) $(CFLAGS) -include shadow.h -xc -o/dev/null - 2>/dev/null && echo yes)
NIXIO_SO      = nixio.so
NIXIO_LDFLAGS =

ifeq (,$(findstring Darwin,$(OS)))
	NIXIO_LDFLAGS += -lcrypt
else
	EXTRA_CFLAGS += -D__DARWIN__
endif

NIXIO_OBJ = src/nixio.o src/socket.o src/sockopt.o src/bind.o src/address.o \
	    src/protoent.o src/poll.o src/io.o src/file.o src/splice.o src/process.o \
	    src/syslog.o src/bit.o src/binary.o src/fs.o src/user.o \
	    $(if $(NIXIO_TLS),src/tls-crypto.o src/tls-context.o src/tls-socket.o,)

ifeq ($(NIXIO_TLS),axtls)
	TLS_CFLAGS = -IaxTLS/ssl -IaxTLS/crypto -IaxTLS/config -include src/axtls-compat.h
	TLS_DEPENDS = src/axtls-compat.o
	NIXIO_OBJ += src/axtls-compat.o src/libaxtls.a
endif

ifeq ($(NIXIO_TLS),openssl)
	NIXIO_LDFLAGS += -lssl -lcrypto
endif

ifeq ($(NIXIO_TLS),cyassl)
	NIXIO_LDFLAGS += -lcyassl
	TLS_DEPENDS = src/cyassl-compat.o
	TLS_CFLAGS = -include src/cyassl-compat.h
	NIXIO_OBJ += src/cyassl-compat.o
endif

ifeq ($(NIXIO_TLS),)
	NIXIO_CFLAGS += -DNO_TLS
endif

ifneq ($(NIXIO_SHADOW),yes)
	NIXIO_CFLAGS += -DNO_SHADOW
endif


ifeq ($(OS),SunOS)
	NIXIO_LDFLAGS += -lsocket -lnsl -lsendfile
endif

ifneq (,$(findstring MINGW,$(OS))$(findstring mingw,$(OS))$(findstring Windows,$(OS)))
	NIXIO_CROSS_CC:=$(shell which i586-mingw32msvc-cc)
ifneq (,$(NIXIO_CROSS_CC))
	CC:=$(NIXIO_CROSS_CC)
endif
	NIXIO_OBJ += src/mingw-compat.o
	NIXIO_LDFLAGS_POST:=-llua -lssl -lcrypto -lws2_32 -lgdi32
	FPIC:=
	EXTRA_CFLAGS += -D_WIN32_WINNT=0x0501
	LUA_CFLAGS:=
	NIXIO_SO:=nixio.dll
	NIXIO_LDFLAGS:=
endif


%.o: %.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

ifneq ($(NIXIO_TLS),)
src/tls-crypto.o: $(TLS_DEPENDS) src/tls-crypto.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) $(TLS_CFLAGS) -c -o $@ src/tls-crypto.c

src/tls-context.o: $(TLS_DEPENDS) src/tls-context.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) $(TLS_CFLAGS) -c -o $@ src/tls-context.c
	
src/tls-socket.o: $(TLS_DEPENDS) src/tls-socket.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) $(TLS_CFLAGS) -c -o $@ src/tls-socket.c
	
src/axtls-compat.o: src/libaxtls.a src/axtls-compat.c
	$(COMPILE) $(NIXIO_CFLAGS) $(LUA_CFLAGS) $(FPIC) $(TLS_CFLAGS) -c -o $@ src/axtls-compat.c
	mkdir -p dist
	cp -pR axtls-root/* dist/
endif	

compile: $(NIXIO_OBJ)
	$(LINK) $(SHLIB_FLAGS) -o src/$(NIXIO_SO) $(NIXIO_OBJ) $(NIXIO_LDFLAGS) $(NIXIO_LDFLAGS_POST)
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp src/$(NIXIO_SO) dist$(LUA_LIBRARYDIR)/$(NIXIO_SO)

$(AXTLS_DIR)/.prepared:
	#rm -rf $(AXTLS_DIR)
	#tar xvfz $(AXTLS_FILE)
	cp axtls-config/.config axtls-config/config.h $(AXTLS_DIR)/config
	touch $@

src/libaxtls.a: $(AXTLS_DIR)/.prepared
	$(MAKE) -C $(AXTLS_DIR) CC="$(CC)" CFLAGS="$(CFLAGS) $(EXTRA_CFLAGS) $(FPIC) -Wall -pedantic -I../config -I../ssl -I../crypto" LDFLAGS="$(LDFLAGS)" OS="$(OS)" clean all
	cp -p $(AXTLS_DIR)/_stage/libaxtls.a src
	# *************************************************************************
	#
	#
	#
	# *** WARNING ***
	# The use of the axTLS cryptographical provider is discouraged!
	# Please switch to either CyaSSL or OpenSSL.
	# Support for axTLS might be removed in the near future.
	#
	#
	#
	#**************************************************************************

clean: luaclean
	rm -f src/*.o src/*.so src/*.a src/*.dll
	rm -f $(AXTLS_DIR)/.prepared

install: build
	cp -pR dist$(LUA_MODULEDIR)/* $(LUA_MODULEDIR)
	cp -pR dist$(LUA_LIBRARYDIR)/* $(LUA_LIBRARYDIR)
