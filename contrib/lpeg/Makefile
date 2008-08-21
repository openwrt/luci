include ../../build/config.mk
include ../../build/gccconfig.mk

LPEG_VERSION = 0.8.1
LPEG_SITE = http://www.inf.puc-rio.br/~roberto/lpeg
LPEG_DIR = lpeg-$(LPEG_VERSION)
LPEG_FILE = $(LPEG_DIR).tar.gz
LPEG_URL = $(LPEG_SITE)/$(LPEG_FILE)

all: compile

include ../../build/module.mk

$(LPEG_FILE):
	wget -O $@ $(LPEG_URL) || rm -f $@

$(LPEG_DIR)/.prepared: $(LPEG_FILE)
	rm -rf $(LPEG_DIR)
	tar xvfz $(LPEG_FILE)
	touch $@

compile: $(LPEG_DIR)/.prepared
	$(MAKE) -C $(LPEG_DIR) CC=$(CC) COPT="$(CFLAGS) $(LUA_CFLAGS) -fpic"
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp $(LPEG_DIR)/{lpeg.so,re.lua} dist$(LUA_LIBRARYDIR)

luasource:
luastrip:
luacompile:
compile-all: compile

clean:
	rm -rf $(LPEG_DIR) $(LPEG_FILE)
