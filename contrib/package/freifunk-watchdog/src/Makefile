WD_BINARY:=ffwatchd
WD_CFLAGS:=$(CFLAGS) -c -DBINARY=\"$(WD_BINARY)\"
WD_LDFLAGS:=$(LDFLAGS) -lm -luci

watchdog:
	$(CC) $(WD_CFLAGS) -o ucix.o ucix.c
	$(CC) $(WD_CFLAGS) -o watchdog.o watchdog.c
	$(CC) $(WD_LDFLAGS) -o $(WD_BINARY) watchdog.o ucix.o

clean:
	rm -f *~ $(WD_BINARY) *.o

