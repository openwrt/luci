ifneq (,$(wildcard ../../build/config.mk))
include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk
else
include standalone.mk
endif

TPL_LDFLAGS    =
TPL_CFLAGS     =
TPL_SO         = parser.so
TPL_PO2LMO     = po2lmo
TPL_PO2LMO_OBJ = src/po2lmo.o
TPL_LMO_OBJ    = src/template_lmo.o
TPL_COMMON_OBJ = src/template_parser.o src/template_utils.o
TPL_LUALIB_OBJ = src/template_lualib.o

%.o: %.c
	$(COMPILE) $(TPL_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $<

compile: build-clean $(TPL_COMMON_OBJ) $(TPL_LUALIB_OBJ) $(TPL_LMO_OBJ) $(TPL_PO2LMO_OBJ)
	$(LINK) $(SHLIB_FLAGS) $(TPL_LDFLAGS) -o src/$(TPL_SO) \
		$(TPL_COMMON_OBJ) $(TPL_LMO_OBJ) $(TPL_LUALIB_OBJ)
	$(LINK) -o src/$(TPL_PO2LMO) \
		$(TPL_LMO_OBJ) $(TPL_PO2LMO_OBJ)
	mkdir -p dist$(LUCI_LIBRARYDIR)/template
	cp src/$(TPL_SO) dist$(LUCI_LIBRARYDIR)/template/$(TPL_SO)

install: build
	cp -pR dist$(LUA_LIBRARYDIR)/* $(LUA_LIBRARYDIR)

clean: build-clean

build-clean:
	rm -f src/*.o src/$(TPL_SO)

host-compile: build-clean host-clean $(TPL_LMO_OBJ) $(TPL_PO2LMO_OBJ)
	$(LINK) -o src/$(TPL_PO2LMO) $(TPL_LMO_OBJ) $(TPL_PO2LMO_OBJ)

host-install: host-compile
	cp src/$(TPL_PO2LMO) ../../build/$(TPL_PO2LMO)

host-clean:
	rm -f ../../build/$(TPL_PO2LMO)
