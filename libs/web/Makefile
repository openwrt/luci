include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk

TPL_LDFLAGS    =
TPL_CFLAGS     =
TPL_SO         = parser.so
TPL_COMMON_OBJ = src/template_parser.o
TPL_LUALIB_OBJ = src/template_lualib.o

%.o: %.c
	$(COMPILE) $(TPL_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

compile: build-clean $(TPL_COMMON_OBJ) $(TPL_LUALIB_OBJ)
	$(LINK) $(SHLIB_FLAGS) $(TPL_LDFLAGS) -o src/$(TPL_SO) \
		$(TPL_COMMON_OBJ) $(TPL_LUALIB_OBJ)
	mkdir -p dist$(LUCI_LIBRARYDIR)/template
	cp src/$(TPL_SO) dist$(LUCI_LIBRARYDIR)/template/$(TPL_SO)

install: build
	cp -pR dist$(LUA_LIBRARYDIR)/* $(LUA_LIBRARYDIR)

clean: build-clean

build-clean:
	rm -f src/*.o src/$(TPL_SO)


