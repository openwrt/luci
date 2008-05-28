include build/config.mk

MODULES = applications/* libs/* modules/* themes/* i18n/*
LUA_TARGET = compile
OS:=$(shell uname)
export OS
ifeq ($(OS),Darwin)
  MODULES += contrib/luaposix
endif

.PHONY: all build clean host hostclean

all: build

build:
	for i in $(MODULES); do make -C$$i $(LUA_TARGET); done

clean:
	for i in $(MODULES); do make -C$$i clean; done

host: build
	mkdir -p host
	for i in $(MODULES); do cp $$i/dist/* host/ -R 2>/dev/null || true; done
	ln -sf .$(LUCI_INSTALLDIR) host/luci
	
hostclean: clean
	rm host -rf
