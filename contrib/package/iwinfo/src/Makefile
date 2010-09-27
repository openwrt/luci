IWINFO_LDFLAGS    = $(LDFLAGS) -shared -llua $(if $(CRAP),,-lnl-tiny)
IWINFO_CFLAGS     = $(CFLAGS) -std=gnu99 -fstrict-aliasing $(if $(CRAP),-DUSE_WL,-DUSE_MADWIFI -DUSE_NL80211)
IWINFO_SO         = iwinfo.so
IWINFO_OBJ        = $(if $(CRAP),iwinfo_wl.o,iwinfo_madwifi.o iwinfo_nl80211.o) \
	iwinfo_wext.o iwinfo_wext_scan.o iwinfo_lualib.o

%.o: %.c
	$(CC) $(IWINFO_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

compile: clean $(IWINFO_OBJ)
	$(LD) $(IWINFO_LDFLAGS) -o $(IWINFO_SO) $(IWINFO_OBJ)

clean:
	rm -f *.o $(IWINFO_SO)

