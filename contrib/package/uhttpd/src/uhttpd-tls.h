#ifndef _UHTTPD_TLS_

#include <openssl/ssl.h>


SSL_CTX * uh_tls_ctx_init();

void uh_tls_ctx_free(struct listener *l);
void uh_tls_client_accept(struct client *c);
void uh_tls_client_close(struct client *c);

#endif

