GCC     := gcc
CFLAGS  := -Wall
LDFLAGS :=

OBJ = cli.o lar.o md5.o
BIN = lar

compile:
cli: $(OBJ)
	$(GCC) $(CFLAGS) -o $(BIN) $(OBJ) $(LDFLAGS)

clean:
	rm -f $(OBJ) $(BIN)
