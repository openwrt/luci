include ../../build/config.mk
include ../../build/module.mk
include ../../build/gccconfig.mk

PX5G_LIB_CFLAGS = -Isrc/ -include src/polarssl/rsa.h \
	-include src/polarssl/x509.h \
	$(CPPFLAGS) $(CFLAGS) $(EXTRA_CFLAGS) $(WFLAGS)

PX5G_OBJ_CFLAGS = -Isrc/ \
	$(CPPFLAGS) $(CFLAGS) $(EXTRA_CFLAGS) $(WFLAGS)

PX5G_LIB = src/library/bignum.o src/library/havege.o src/library/rsa.o \
		src/library/sha1.o src/library/timing.o src/library/x509write.o
PX5G_OBJ = src/px5g.o

src/library/%.o: src/library/%.c
	$(CC) $(PX5G_LIB_CFLAGS) $(FPIC) -c -o $@ $<

%.o: %.c
	$(CC) $(PX5G_OBJ_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $<

compile: $(PX5G_LIB) $(PX5G_OBJ)
	$(LINK) $(SHLIB_FLAGS) -o src/px5g.so $(PX5G_OBJ) $(PX5G_LIB)
	mkdir -p dist$(LUA_LIBRARYDIR)
	cp src/px5g.so dist$(LUA_LIBRARYDIR)/px5g.so

clean: luaclean
	rm -f $(PX5G_OBJ) $(PX5G_LIB) src/*.o src/*.so src/*.a src/*.dll
