#ifndef NIXIO_TLS_H_
#define NIXIO_TLS_H_

#include "nixio.h"

#ifndef WITHOUT_OPENSSL
#include <openssl/ssl.h>
#endif

#define NIXIO_TLS_CTX_META "nixio.tls.ctx"
#define NIXIO_TLS_SOCK_META "nixio.tls.sock"

typedef struct nixio_tls_socket {
	SSL		*socket;
#ifdef WITH_AXTLS
	size_t	pbufsiz;
	char	*pbufpos;
	char	*pbuffer;
#endif
} nixio_tls_sock;

#endif /* NIXIO_TLS_H_ */
