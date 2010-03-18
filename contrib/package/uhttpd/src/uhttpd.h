#ifndef _UHTTPD_

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <linux/limits.h>
#include <netdb.h>
#include <ctype.h>

#ifdef HAVE_TLS
#include <openssl/ssl.h>
#endif


#define UH_LIMIT_MSGHEAD	4096
#define UH_LIMIT_HEADERS	64

#define UH_LIMIT_LISTENERS	16
#define UH_LIMIT_CLIENTS	64

#define UH_HTTP_MSG_GET		0
#define UH_HTTP_MSG_HEAD	1
#define UH_HTTP_MSG_POST	2


struct config {
	char docroot[PATH_MAX];
#ifdef HAVE_CGI
	char *cgi_prefix;
#endif
#ifdef HAVE_LUA
	char *lua_prefix;
	char *lua_handler;
#endif
#ifdef HAVE_TLS
	char *cert;
	char *key;
	SSL_CTX *tls;
#endif
};

struct listener {
	int socket;
	struct sockaddr_in6 addr;
	struct config *conf;
#ifdef HAVE_TLS
	SSL_CTX *tls;
#endif
};

struct client {
	int socket;
	int peeklen;
	char peekbuf[UH_LIMIT_MSGHEAD];
	struct listener *server;
	struct sockaddr_in6 servaddr;
	struct sockaddr_in6 peeraddr;
#ifdef HAVE_TLS
	SSL *tls;
#endif
};

struct http_request {
	int	method;
	float version;
	char *url;
	char *headers[UH_LIMIT_HEADERS];
};

struct http_response {
	int statuscode;
	char *statusmsg;
	char *headers[UH_LIMIT_HEADERS];
};

#endif

