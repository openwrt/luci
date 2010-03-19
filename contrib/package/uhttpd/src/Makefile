CGI_SUPPORT ?= 1
LUA_SUPPORT ?= 1
TLS_SUPPORT ?= 1

LDFLAGS ?= -L./lua-5.1.4/src -L./cyassl-1.4.0/src/.libs -lm
CFLAGS  ?= -Wall -I./lua-5.1.4/src -I./cyassl-1.4.0/include -O0 -ggdb3

CFLAGS += --std=c99 -D_POSIX_C_SOURCE=200112L -D_XOPEN_SOURCE=500
LDFLAGS += -lm -lcrypt

OBJ = uhttpd.o uhttpd-file.o uhttpd-utils.o

ifeq ($(CGI_SUPPORT),1)
	OBJ += uhttpd-cgi.o
	CFLAGS += -DHAVE_CGI
endif

ifeq ($(LUA_SUPPORT),1)
	OBJ += uhttpd-lua.o
	CFLAGS += -DHAVE_LUA
	LDFLAGS += -ldl -llua
endif

ifeq ($(TLS_SUPPORT),1)
	OBJ += uhttpd-tls.o
	CFLAGS += -DHAVE_TLS
	LDFLAGS += -lpthread -lz -lcyassl
endif

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $< 

compile: $(OBJ)
	$(CC) -o uhttpd $(LDFLAGS) $(OBJ)

clean:
	rm -f *.o uhttpd

