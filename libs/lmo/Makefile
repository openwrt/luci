ifneq (,$(wildcard ../../build/config.mk))
include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk
else
include standalone.mk
endif

LMO_LDFLAGS    =
LMO_CFLAGS     =
LMO_SO         = lmo.so
LMO_PO2LMO     = po2lmo
LMO_LOOKUP     = lookup
LMO_COMMON_OBJ = src/lmo_core.o src/lmo_hash.o
LMO_PO2LMO_OBJ = src/lmo_po2lmo.o
LMO_LOOKUP_OBJ = src/lmo_lookup.o
LMO_LUALIB_OBJ = src/lmo_lualib.o

%.o: %.c
	$(COMPILE) $(LMO_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

compile: $(LMO_COMMON_OBJ) $(LMO_PO2LMO_OBJ) $(LMO_LOOKUP_OBJ) $(LMO_LUALIB_OBJ)
	$(LINK) $(SHLIB_FLAGS) $(LMO_LDFLAGS) -o src/$(LMO_SO) \
		$(LMO_COMMON_OBJ) $(LMO_LUALIB_OBJ)
	$(LINK) $(LMO_LDFLAGS) -o src/$(LMO_PO2LMO) $(LMO_COMMON_OBJ) $(LMO_PO2LMO_OBJ)
	$(LINK) $(LMO_LDFLAGS) -o src/$(LMO_LOOKUP) $(LMO_COMMON_OBJ) $(LMO_LOOKUP_OBJ)
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp src/$(LMO_SO) dist$(LUA_LIBRARYDIR)/$(LMO_SO)

install: build
	cp -pR dist$(LUA_LIBRARYDIR)/* $(LUA_LIBRARYDIR)

clean: build-clean

build-clean:
	rm -f src/*.o src/lookup src/po2lmo src/lmo.so

host-compile: build-clean host-clean $(LMO_COMMON_OBJ) $(LMO_PO2LMO_OBJ)
	$(LINK) $(LMO_LDFLAGS) -o src/$(LMO_PO2LMO) $(LMO_COMMON_OBJ) $(LMO_PO2LMO_OBJ)

host-install: host-compile
	cp src/$(LMO_PO2LMO) ../../build/$(LMO_PO2LMO)

host-clean:
	rm -f ../../build/$(LMO_PO2LMO)

