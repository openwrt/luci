PROGS=luanet.so
STRIP?=strip
CFLAGS?=
CFLAGS+=-pedantic -Werror -Wall -I/usr/include/lua5.1/ -std=gnu99
LDFLAGS?=
LDFLAGS+=
OBJS=ifconfig.o bridge.o iwconfig.o helper.o route.o vconfig.o main.o df.o base64.o

all: $(PROGS)

$(PROGS): $(OBJS)
	$(CC) $(CFLAGS) -shared -Wl,-soname,luanet -liw $(LDFLAGS) $^ -o $@

clean:
	rm -f $(PROGS) *.o *.so

%.o: %.c
	$(CC) $(CFLAGS) -c  $^ -o $@
