%.o: %.c
	$(CC) $(CPPFLAGS) $(CFLAGS) $(FPIC) -DNDEBUG -c -o $@ $<

contrib/lemon: contrib/lemon.c contrib/lempar.c
	cc -o contrib/lemon $<

lib/plural_formula.c: lib/plural_formula.y contrib/lemon
	./contrib/lemon -q $<

lib/lmo.c: lib/plural_formula.c

core.so: lib/luci.o lib/lmo.o lib/plural_formula.o
	$(CC) $(LDFLAGS) -shared -lcrypt -o $@ $^

version.uc:
	echo "export const revision = '$(LUCI_VERSION)', branch = '$(LUCI_GITBRANCH)';" > $@

clean:
	rm -f contrib/lemon lib/*.o lib/plural_formula.c lib/plural_formula.h core.so version.uc

jsmin: jsmin.o
	$(CC) $(LDFLAGS) -o $@ $^

po2lmo: po2lmo.o lib/lmo.o lib/plural_formula.o
	$(CC) $(LDFLAGS) -o $@ $^

compile: core.so version.uc

install: compile
	mkdir -p $(DESTDIR)/usr/lib/ucode/luci
	cp core.so $(DESTDIR)/usr/lib/ucode/luci/core.so

	mkdir -p $(DESTDIR)/usr/share/ucode/luci
	cp version.uc $(DESTDIR)/usr/share/ucode/luci/version.uc
