#ifndef _UHTTPD_CGI_

#include <errno.h>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <linux/limits.h>

void uh_cgi_request(struct client *cl, struct http_request *req);

struct path_info {
	char *root;
	char *wdir;
	char *phys;
	char *name;
	char *info;
	char *query;
};

#endif
