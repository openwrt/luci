PROGS=lucittpd
STRIP?=strip
CFLAGS?=
CFLAGS+=-pedantic -Werror -Wall -std=gnu99 -I/usr/include/lua5.1/
CPPFLAGS=-I./include
LDFLAGS?=
LDFLAGS+=-luci -llua5.1
OBJS=main.o lib/log.o lib/signal.o lib/uci.o lib/luaplugin.o

all: $(PROGS)

$(PROGS): $(OBJS)
	$(CC) $(CFLAGS)  $(LDFLAGS) $(MYLDFLAGS) $^ -o $@ 
	#$(CC) $(CFLAGS) -shared -Wl,-soname,gdata $(LDFLAGS) $^ -o $@ 
	
clean:
	rm -f $(PROGS) *.o *.so lib/*.o

%.o: %.c
	$(CC) $(CPPFLAGS) $(CFLAGS) $(MYCFLAGS) -c  $^ -o $@
