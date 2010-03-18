#include "uhttpd.h"
#include "uhttpd-tls.h"
#include "uhttpd-utils.h"


SSL_CTX * uh_tls_ctx_init()
{
	SSL_CTX *c = NULL;
	SSL_load_error_strings();
	SSL_library_init();

	if( (c = SSL_CTX_new(TLSv1_server_method())) != NULL )
		SSL_CTX_set_verify(c, SSL_VERIFY_NONE, NULL);

	return c;
}

void uh_tls_ctx_free(struct listener *l)
{
	SSL_CTX_free(l->tls);
}


void uh_tls_client_accept(struct client *c)
{
	if( c->server && c->server->tls )
	{
		c->tls = SSL_new(c->server->tls);
		SSL_set_fd(c->tls, c->socket);
	}
}

void uh_tls_client_close(struct client *c)
{
	if( c->tls )
	{
		SSL_shutdown(c->tls);
		SSL_free(c->tls);

		c->tls = NULL;
	}
}
