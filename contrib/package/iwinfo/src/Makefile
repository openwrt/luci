IWINFO_BACKENDS   = $(if $(BACKENDS),$(BACKENDS),madwifi nl80211)
IWINFO_LDFLAGS    = $(LDFLAGS) -shared -llua
IWINFO_CFLAGS     = $(CFLAGS) -std=gnu99 -fstrict-aliasing
IWINFO_SO         = iwinfo.so
IWINFO_OBJ        = iwinfo_wext.o iwinfo_wext_scan.o iwinfo_lualib.o

ifneq ($(filter wl,$(IWINFO_BACKENDS)),)
	IWINFO_CFLAGS  += -DUSE_WL
	IWINFO_OBJ     += iwinfo_wl.o
endif

ifneq ($(filter madwifi,$(IWINFO_BACKENDS)),)
	IWINFO_CFLAGS  += -DUSE_MADWIFI
	IWINFO_OBJ     += iwinfo_madwifi.o
endif

ifneq ($(filter nl80211,$(IWINFO_BACKENDS)),)
	IWINFO_CFLAGS  += -DUSE_NL80211
	IWINFO_LDFLAGS += -lnl-tiny
	IWINFO_OBJ     += iwinfo_nl80211.o
endif


%.o: %.c
	$(CC) $(IWINFO_CFLAGS) $(LUA_CFLAGS) $(FPIC) -c -o $@ $< 

compile: clean $(IWINFO_OBJ)
	$(LD) $(IWINFO_LDFLAGS) -o $(IWINFO_SO) $(IWINFO_OBJ)

clean:
	rm -f *.o $(IWINFO_SO)

