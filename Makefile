include build/config.mk

MODULES = applications/* core modules/* themes/*
LUA_TARGET = source


.PHONY: all build clean host hostclean

all: build

build:
	for i in $(MODULES); do make -C$$i $(LUA_TARGET); done

clean:
	for i in $(MODULES); do make -C$$i clean; done

host: build
	mkdir -p host/ffluci
	for i in $(MODULES); do cp $$i/dist$(LUCI_INSTALLDIR) host/ffluci -R; done
	
hostclean:
	rm host -rf