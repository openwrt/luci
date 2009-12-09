CFLAGS  := -g -Wall -I./uci -I./iptables-1.4.5/include
LDFLAGS := -luci -liptc -L./iptables-1.4.5/libiptc/.libs

fwd:
	$(CC) $(CFLAGS) -c -o ucix.o ucix.c
	$(CC) $(CFLAGS) -c -o fwd_addr.o fwd_addr.c
	$(CC) $(CFLAGS) -c -o fwd_rules.o fwd_rules.c
	$(CC) $(CFLAGS) -c -o fwd_config.o fwd_config.c
	$(CC) $(CFLAGS) -c -o fwd.o fwd.c
	$(CC) $(LDFLAGS) -o fwd fwd.o fwd_addr.o fwd_rules.o fwd_config.o ucix.o

clean:
	rm -f *~ fwd *.o

