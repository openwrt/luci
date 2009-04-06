GCC     := gcc
CFLAGS  := -Wall
LDFLAGS :=

OBJ = cli.o lar.o
BIN = lar

cli: $(OBJ)
	$(GCC) $(CFLAGS) -o $(BIN) $(OBJ) $(LDFLAGS)

clean:
	rm -f $(OBJ) $(BIN)
