#include "uhttpd.h"
#include "uhttpd-utils.h"

#ifdef HAVE_TLS
#include "uhttpd-tls.h"
#endif


static char *uh_index_files[] = {
	"index.html",
	"index.htm",
	"default.html",
	"default.htm"
};


const char * sa_straddr(void *sa)
{
	static char str[INET6_ADDRSTRLEN];
	struct sockaddr_in *v4 = (struct sockaddr_in *)sa;
	struct sockaddr_in6 *v6 = (struct sockaddr_in6 *)sa;

	if( v4->sin_family == AF_INET )
		return inet_ntop(AF_INET, &(v4->sin_addr), str, sizeof(str));
	else
		return inet_ntop(AF_INET6, &(v6->sin6_addr), str, sizeof(str));
}

const char * sa_strport(void *sa)
{
	static char str[6];
	snprintf(str, sizeof(str), "%i", sa_port(sa));
	return str;
}

int sa_port(void *sa)
{
	return ntohs(((struct sockaddr_in6 *)sa)->sin6_port);
}

/* Simple strstr() like function that takes len arguments for both haystack and needle. */
char *strfind(char *haystack, int hslen, const char *needle, int ndlen)
{
	int match = 0;
	int i, j;

	for( i = 0; i < hslen; i++ )
	{
		if( haystack[i] == needle[0] )
		{
			match = ((ndlen == 1) || ((i + ndlen) <= hslen));

			for( j = 1; (j < ndlen) && ((i + j) < hslen); j++ )
			{
				if( haystack[i+j] != needle[j] )
				{
					match = 0;
					break;
				}
			}

			if( match )
				return &haystack[i];
		}
	}

	return NULL;
}


int uh_tcp_send(struct client *cl, const char *buf, int len)
{
	fd_set writer;
	struct timeval timeout;

	FD_ZERO(&writer);
	FD_SET(cl->socket, &writer);

	timeout.tv_sec = 0;
	timeout.tv_usec = 500000;

	if( select(cl->socket + 1, NULL, &writer, NULL, &timeout) > 0 )
	{
#ifdef HAVE_TLS
		if( cl->tls )
			return SSL_write(cl->tls, buf, len);
		else
#endif
			return send(cl->socket, buf, len, 0);
	}

	return -1;
}

int uh_tcp_peek(struct client *cl, char *buf, int len)
{
	int sz = uh_tcp_recv(cl, buf, len);

	/* store received data in peek buffer */
	if( sz > 0 )
	{
		cl->peeklen = sz;
		memcpy(cl->peekbuf, buf, sz);
	}

	return sz;
}

int uh_tcp_recv(struct client *cl, char *buf, int len)
{
	int sz = 0;
	int rsz = 0;

	/* first serve data from peek buffer */
	if( cl->peeklen > 0 )
	{
		sz = min(cl->peeklen, len);
		len -= sz; cl->peeklen -= sz;

		memcpy(buf, cl->peekbuf, sz);
		memmove(cl->peekbuf, &cl->peekbuf[sz], cl->peeklen);
	}

	/* caller wants more */
	if( len > 0 )
	{
#ifdef HAVE_TLS
		if( cl->tls )
			rsz = SSL_read(cl->tls, (void *)&buf[sz], len);
		else
#endif
			rsz = recv(cl->socket, (void *)&buf[sz], len, 0);

		if( (sz == 0) || (rsz > 0) )
			sz += rsz;
	}

	return sz;
}

#define ensure(x) \
	do { if( x < 0 ) return -1; } while(0)

int uh_http_sendhf(struct client *cl, int code, const char *summary, const char *fmt, ...)
{
	va_list ap;

	char buffer[UH_LIMIT_MSGHEAD];
	int len;

	len = snprintf(buffer, sizeof(buffer),
		"HTTP/1.1 %03i %s\r\n"
		"Content-Type: text/plain\r\n"
		"Transfer-Encoding: chunked\r\n\r\n",
			code, summary
	);

	ensure(uh_tcp_send(cl, buffer, len));

	va_start(ap, fmt);
	len = vsnprintf(buffer, sizeof(buffer), fmt, ap);
	va_end(ap);

	ensure(uh_http_sendc(cl, buffer, len));
	ensure(uh_http_sendc(cl, NULL, 0));

	return 0;
}


int uh_http_sendc(struct client *cl, const char *data, int len)
{
	char chunk[8];
	int clen;

	if( len == -1 )
		len = strlen(data);

	if( len > 0 )
	{
	 	clen = snprintf(chunk, sizeof(chunk), "%X\r\n", len);
		ensure(uh_tcp_send(cl, chunk, clen));
		ensure(uh_tcp_send(cl, data, len));
		ensure(uh_tcp_send(cl, "\r\n", 2));
	}
	else
	{
		ensure(uh_tcp_send(cl, "0\r\n\r\n", 5));
	}

	return 0;
}

int uh_http_sendf(
	struct client *cl, struct http_request *req, const char *fmt, ...
) {
	va_list ap;
	char buffer[UH_LIMIT_MSGHEAD];
	int len;

	va_start(ap, fmt);
	len = vsnprintf(buffer, sizeof(buffer), fmt, ap);
	va_end(ap);

	if( (req != NULL) && (req->version > 1.0) )
		ensure(uh_http_sendc(cl, buffer, len));
	else if( len > 0 )
		ensure(uh_tcp_send(cl, buffer, len));

	return 0;
}

int uh_http_send(
	struct client *cl, struct http_request *req, const char *buf, int len
) {
	if( len < 0 )
		len = strlen(buf);

	if( (req != NULL) && (req->version > 1.0) )
		ensure(uh_http_sendc(cl, buf, len));
	else if( len > 0 )
		ensure(uh_tcp_send(cl, buf, len));

	return 0;
}


int uh_urldecode(char *buf, int blen, const char *src, int slen)
{
	int i;
	int len = 0;

#define hex(x) \
	(((x) <= '9') ? ((x) - '0') : \
		(((x) <= 'F') ? ((x) - 'A' + 10) : \
			((x) - 'a' + 10)))

	for( i = 0; (i <= slen) && (i <= blen); i++ )
	{
		if( src[i] == '%' )
		{
			if( ((i+2) <= slen) && isxdigit(src[i+1]) && isxdigit(src[i+2]) )
			{
				buf[len++] = (char)(16 * hex(src[i+1]) + hex(src[i+2]));
				i += 2;
			}
			else
			{
				buf[len++] = '%';
			}
		}
		else
		{
			buf[len++] = src[i];
		}
	}

	return len;
}

int uh_urlencode(char *buf, int blen, const char *src, int slen)
{
	int i;
	int len = 0;
	const char hex[] = "0123456789abcdef";

	for( i = 0; (i <= slen) && (i <= blen); i++ )
	{
		if( isalnum(src[i]) || (src[i] == '-') || (src[i] == '_') ||
		    (src[i] == '.') || (src[i] == '~') )
		{
			buf[len++] = src[i];
		}
		else if( (len+3) <= blen )
		{
			buf[len++] = '%';
			buf[len++] = hex[(src[i] >> 4) & 15];
			buf[len++] = hex[(src[i] & 15) & 15];
		}
		else
		{
			break;
		}
	}

	return len;
}

int uh_path_normalize(char *buf, int blen, const char *src, int slen)
{
	int i, skip;
	int len = 0;

	for( i = 0, skip = 1; (i <= slen) && (src[i] != 0); i++ )
	{
		/* collapse multiple "/" into one */
		if( src[i] == '/' )
		{
			/* collapse "/../" to "/" */
			if( ((i+2) <= slen) && (src[i+1] == '.') && (src[i+2] == '.') &&
				(((i+3) > slen) || (src[i+3] == '/'))
			) {
				i += 2;
				continue;
			}

			/* collapse "/./" to "/" */
			else if( ((i+1) <= slen) && (src[i+1] == '.') &&
			    (((i+2) > slen) || (src[i+2] == '/'))
			) {
				i += 1;
				continue;
			}

			/* skip repeating "/" */
			else if( skip )
			{
				continue;
			}

			skip++;
		}

		/* finally a harmless char */
		else
		{
			skip = 0;
		}

		buf[len++] = src[i];
	}

	return len;
}


struct uh_path_info * uh_path_lookup(struct client *cl, const char *url)
{
	static char path_phys[PATH_MAX];
	static char path_info[PATH_MAX];
	static struct uh_path_info p;

	char buffer[UH_LIMIT_MSGHEAD];
	char *docroot = cl->server->conf->docroot;
	char *pathptr = NULL;

	int skip = 0;
	int plen = 0;

	struct stat s;


	memset(path_phys, 0, sizeof(path_phys));
	memset(path_info, 0, sizeof(path_info));
	memset(buffer, 0, sizeof(buffer));
	memset(&p, 0, sizeof(p));

	/* first separate query string from url */
	if( (pathptr = strchr(url, '?')) != NULL )
	{
		p.query = pathptr[1] ? pathptr + 1 : NULL;

		/* urldecode component w/o query */
		if( pathptr > url )
			plen = uh_urldecode(
				buffer, sizeof(buffer), url,
				(int)(pathptr - url) - 1
			);
		else
			plen = 0;
	}

	/* no query string, decode all of url */
	else
	{
		plen = uh_urldecode(
			buffer, sizeof(buffer), url, strlen(url)
		);
	}

	/* copy docroot */
	memcpy(path_phys, docroot, sizeof(path_phys));

	/* append normalized path, leave two bytes free
	 * for trailing slash and terminating zero byte */
	plen = strlen(docroot) + uh_path_normalize(
		&path_phys[strlen(docroot)],
		sizeof(path_phys) - strlen(docroot) - 2,
		buffer, plen
	);

	/* copy result to info buffer */
	memcpy(path_info, path_phys, sizeof(path_info));

	/* find path */
	while( 1 )
	{
		/* test current path */
		if( !stat(path_phys, &p.stat) )
		{
			/* is a regular file */
			if( p.stat.st_mode & S_IFREG )
			{
				p.root = docroot;
				p.phys = path_phys;
				p.name = &path_phys[strlen(docroot)-1];

				/* find workdir */
				if( (pathptr = strrchr(path_phys, '/')) != NULL )
				{
					path_info[(int)(pathptr - path_phys) + 1] = 0;
					p.wdir = path_info;
				}
				else
				{
					p.wdir = docroot;
				}

				/* find path info */
				if( path_info[strlen(path_phys)] != 0 )
				{
					p.info = &path_info[strlen(path_phys)];
				}

				break;
			}

			/* is a directory */
			else if( (p.stat.st_mode & S_IFDIR) && (skip < 1) )
			{
				/* ensure trailing slash */
				if( path_phys[plen-1] != '/' )
					path_phys[plen] = '/';

				/* try to locate index file */
				memset(buffer, 0, sizeof(buffer));
				memcpy(buffer, path_phys, sizeof(buffer));
				pathptr = &buffer[strlen(buffer)];

				for( skip = 0; skip < array_size(uh_index_files); skip++ )
				{
					strncat(buffer, uh_index_files[skip], sizeof(buffer));

					if( !stat(buffer, &s) && (s.st_mode & S_IFREG) )
					{
						memset(path_info, 0, sizeof(path_info));
						memcpy(path_info, path_phys, strlen(path_phys));
						memcpy(path_phys, buffer, sizeof(path_phys));
						memcpy(&p.stat, &s, sizeof(p.stat));
						p.wdir = path_info;
						break;
					}

					*pathptr = 0;
				}

				p.root = docroot;
				p.phys = path_phys;
				p.name = &path_phys[strlen(docroot)-1];

				break;
			}

			/* not found */
			else if( skip )
			{
				break;
			}
		}

		else if( (strlen(path_phys) > strlen(docroot)) &&
		         ((pathptr = strrchr(path_phys, '/')) != NULL)
		) {
			*pathptr = 0;
			skip = 1;
		}

		else
		{
			break;
		}
	}

	return p.phys ? &p : NULL;
}


static char uh_listeners[UH_LIMIT_LISTENERS * sizeof(struct listener)] = { 0 };
static char uh_clients[UH_LIMIT_CLIENTS * sizeof(struct client)] = { 0 };

static int uh_listener_count = 0;
static int uh_client_count = 0;


struct listener * uh_listener_add(int sock, struct config *conf)
{
	struct listener *new = NULL;
	socklen_t sl;

	if( uh_listener_count < UH_LIMIT_LISTENERS )
	{
		new = (struct listener *)
			&uh_listeners[uh_listener_count * sizeof(struct listener)];

		new->socket = sock;
		new->conf   = conf;

		/* get local endpoint addr */
		sl = sizeof(struct sockaddr_in6);
		memset(&(new->addr), 0, sl);
		getsockname(sock, (struct sockaddr *) &(new->addr), &sl);

		uh_listener_count++;
	}

	return new;
}

struct listener * uh_listener_lookup(int sock)
{
	struct listener *cur = NULL;
	int i;

	for( i = 0; i < uh_listener_count; i++ )
	{
		cur = (struct listener *) &uh_listeners[i * sizeof(struct listener)];

		if( cur->socket == sock )
			return cur;
	}

	return NULL;
}


struct client * uh_client_add(int sock, struct listener *serv)
{
	struct client *new = NULL;
	socklen_t sl;

	if( uh_client_count < UH_LIMIT_CLIENTS )
	{
		new = (struct client *)
			&uh_clients[uh_client_count * sizeof(struct client)];

		new->socket = sock;
		new->server = serv;

		/* get remote endpoint addr */
		sl = sizeof(struct sockaddr_in6);
		memset(&(new->peeraddr), 0, sl);
		getpeername(sock, (struct sockaddr *) &(new->peeraddr), &sl);

		/* get local endpoint addr */
		sl = sizeof(struct sockaddr_in6);
		memset(&(new->servaddr), 0, sl);
		getsockname(sock, (struct sockaddr *) &(new->servaddr), &sl);

		uh_client_count++;
	}

	return new;
}

struct client * uh_client_lookup(int sock)
{
	struct client *cur = NULL;
	int i;

	for( i = 0; i < uh_client_count; i++ )
	{
		cur = (struct client *) &uh_clients[i * sizeof(struct client)];

		if( cur->socket == sock )
			return cur;
	}

	return NULL;
}

void uh_client_remove(int sock)
{
	struct client *del = uh_client_lookup(sock);

	if( del )
	{
		memmove(del, del + 1,
			sizeof(uh_clients) - (int)((char *)del - uh_clients) - sizeof(struct client));

		uh_client_count--;
	}
}


