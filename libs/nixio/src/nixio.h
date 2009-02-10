#ifndef NIXIO_H_
#define NIXIO_H_

#define NIXIO_META "nixio.socket"
#define NIXIO_BUFFERSIZE 8096

struct nixio_socket {
	int fd;
	int domain;
	int type;
	int protocol;
};

typedef struct nixio_socket nixio_sock;

int nixio__perror(lua_State *L);
int nixio__pstatus(lua_State *L, int condition);
nixio_sock* nixio__checksock(lua_State *L);
int nixio__checksockfd(lua_State *L);
int nixio__checkfd(lua_State *L, int ud);
int nixio__tofd(lua_State *L, int ud);

/* Module functions */
void nixio_open_socket(lua_State *L);
void nixio_open_sockopt(lua_State *L);
void nixio_open_bind(lua_State *L);
void nixio_open_address(lua_State *L);
void nixio_open_poll(lua_State *L);
void nixio_open_io(lua_State *L);

/* Method functions */

#endif /* NIXIO_H_ */
