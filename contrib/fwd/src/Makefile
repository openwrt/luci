CFLAGS  := -ggdb3 -O0 -Wall -I./uci -I./iptables-1.4.5/include
LDFLAGS := -luci -liptc -lxtables -ldl -L./iptables-1.4.5/libiptc/.libs -L./iptables-1.4.5/.libs -Wl,--export-dynamic

fwd:
	$(CC) $(CFLAGS) -c -o ucix.o ucix.c
	$(CC) $(CFLAGS) -c -o fwd_addr.o fwd_addr.c
	$(CC) $(CFLAGS) -c -o fwd_rules.o fwd_rules.c
	$(CC) $(CFLAGS) -c -o fwd_config.o fwd_config.c
	$(CC) $(CFLAGS) -c -o fwd_xtables.o fwd_xtables.c
	$(CC) $(CFLAGS) -c -o fwd_ipc.o fwd_ipc.c
	$(CC) $(CFLAGS) -c -o fwd_utils.o fwd_utils.c
	$(CC) $(CFLAGS) -c -o fwd.o fwd.c
	$(CC) $(LDFLAGS) -o fwd fwd.o fwd_addr.o fwd_rules.o fwd_config.o fwd_xtables.o fwd_ipc.o fwd_utils.o ucix.o
	ln -s fwd fw

clean:
	rm -f *~ fwd fw *.o

