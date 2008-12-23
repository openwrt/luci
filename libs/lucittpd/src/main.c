/*
 *   This program is free software; you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation; either version 2 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program; if not, write to the Free Software
 *   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307, USA.
 *
 *   Copyright (C) 2008 John Crispin <blogic@openwrt.org>
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <sys/wait.h>
#include <signal.h>
#include <features.h>

#include <lib/uci.h>
#include <lib/log.h>
#include <lib/signal.h>
#include <lib/luaplugin.h>

#ifndef __UCLIBC__
#include <sys/sendfile.h>
#endif

#define BACKLOG 10

static int port = 0;
static const char *plugin_path = NULL;
static struct luaplugin_ctx ctx;
static struct luaplugin_entry *e;
static struct timeval timeout;

static void load_config(void)
{
	timeout.tv_usec = 0;

	static struct uci_context* uci = 0;
	uci = ucix_init("lucittpd");
	if(uci)
	{
		plugin_path = ucix_get_option(uci, "lucittpd", "lucittpd", "path");
		port = ucix_get_option_int(uci, "lucittpd", "lucittpd", "port", 80);
		timeout.tv_sec = ucix_get_option_int(uci, "lucittpd", "lucittpd", "timeout", 90);
	} else {
		port = 8080;
		timeout.tv_sec = 90;
	}
	if(!plugin_path)
		plugin_path = strdup("/usr/lib/lucittpd/plugins/");

	// ToDo: Check why below command segfaults in uci_free_context
	//ucix_cleanup(uci);
}

static int webuci_read(lua_State *L)
{
	int len = luaL_checkinteger(L, 1);
	if (len <= 0) {
		return luaL_argerror(L, 1, "too low");
	}

	char *buffer = malloc(len);
	if (!buffer) {
		return luaL_error(L, "malloc() failed");
	}

	int sockfd = lua_tointeger(L, lua_upvalueindex(1));

	len = read(sockfd, buffer, len);
	if (len > 0) {
		lua_pushlstring(L, buffer, len);
		free(buffer);
	} else {
		free(buffer);
		lua_pushnil(L);
		lua_pushinteger(L, (len == 0) ? 0 : errno);
		return 2;
	}

	/* fprintf(stderr, "%s:%s[%d] %d %d\n", __FILE__, __func__, __LINE__, sockfd, len); */

	return 1;
}

static int webuci_close(lua_State *L)
{
	int sockfd = lua_tointeger(L, lua_upvalueindex(1));
	int result = shutdown(sockfd, SHUT_RDWR);
	close(sockfd);
	/*log_printf("%s:%s[%d] %d %d\n", __FILE__, __func__, __LINE__, sockfd, result);*/

	if (result < 0) {
		lua_pushnil(L);
		lua_pushinteger(L, errno);
		return 2;
	} else {
		lua_pushboolean(L, 1);
		return 1;
	}
}

static int webuci_write(lua_State *L)
{
	luaL_checktype(L, 1, LUA_TSTRING);

	size_t len;
	const char *data = lua_tolstring(L, 1, &len);
	int sockfd = lua_tointeger(L, lua_upvalueindex(1));

	len = send(sockfd, data, len, 0);
	/*log_printf("%s:%s[%d] %d %d - %s\n", __FILE__, __func__, __LINE__, sockfd, len, data);*/
	if (len < 0) {
		lua_pushnil(L);
		lua_pushinteger(L, errno);
		return 2;
	} else {
		lua_pushinteger(L, len);
		return 1;
	}
}

static int webuci_sendfile(lua_State *L)
{
	FILE **fp = (FILE **)luaL_checkudata(L, 1, LUA_FILEHANDLE);
	if (*fp == NULL) {
	    return luaL_error(L, "attempt to use a closed file");
	}

	off_t offset = luaL_checkinteger(L, 2);
	size_t size  = luaL_checkinteger(L, 3);

	int sockfd = lua_tointeger(L, lua_upvalueindex(1));

	int cork = 1;
	setsockopt(sockfd, SOL_TCP, TCP_CORK, &cork, sizeof(cork));

#ifdef __UCLIBC__
	// uclibc is teh sux, it does not implement sendfile correctly
	char tmp[1024];
	size_t c, toread = size, oldpos = ftell(*fp);

	fseek(*fp, offset, SEEK_SET);

	while(toread > 0 && (c = fread(tmp, 1, (toread < 1024) ? toread : 1024, *fp)) > 0)
	{
		size += c;
		toread -= c;
		write(sockfd, tmp, c);
	}

	fseek(*fp, oldpos, SEEK_SET);
#else
	size = sendfile(sockfd, fileno(*fp), &offset, size);
	/*log_printf("%s:%s[%d] %d %d - %d\n", __FILE__, __func__, __LINE__, sockfd, fileno(*fp), size);*/
#endif

	cork = 0;
	setsockopt(sockfd, SOL_TCP, TCP_CORK, &cork, sizeof(cork));

	if (size < 1) {
		lua_pushnil(L);
		lua_pushinteger(L, errno);
	} else {
		lua_pushinteger(L, size);
		lua_pushinteger(L, offset);
	}

	return 2;
}


static void load_luci(const char *plugindir)
{
	luaplugin_init(&ctx, plugindir);
	luaplugin_scan(&ctx);

	list_for_each_entry(e, &ctx.entries, list)
	{
		lua_pushstring(ctx.L, "initialize");
		luaplugin_call(e, 0);
	}

	list_for_each_entry(e, &ctx.entries, list)
	{
		lua_pushstring(ctx.L, "register");
		luaplugin_call(e, 0);
	}

	list_for_each_entry(e, &ctx.entries, list)
	{
		lua_pushstring(ctx.L, "filter");
		luaplugin_call(e, 0);
	}
}

static void run_luci(int sockfd)
{
	lua_pushinteger(ctx.L, sockfd);
	lua_pushcclosure(ctx.L, webuci_read, 1);
	lua_setfield(ctx.L, LUA_GLOBALSINDEX, "webuci_read");

	lua_pushinteger(ctx.L, sockfd);
	lua_pushcclosure(ctx.L, webuci_write, 1);
	lua_setfield(ctx.L, LUA_GLOBALSINDEX, "webuci_write");

	lua_pushinteger(ctx.L, sockfd);
	lua_pushcclosure(ctx.L, webuci_close, 1);
	lua_setfield(ctx.L, LUA_GLOBALSINDEX, "webuci_close");

	lua_pushinteger(ctx.L, sockfd);
	lua_pushcclosure(ctx.L, webuci_sendfile, 1);
	lua_setfield(ctx.L, LUA_GLOBALSINDEX, "webuci_sendfile");

	list_for_each_entry(e, &ctx.entries, list)
	{
		lua_pushstring(ctx.L, "accept");
		luaplugin_call(e, 0);
	}
}

static void cleanup_luci(void)
{
	luaplugin_done(&ctx);
}

int main(int argc, char **argv)
{
	int sockfd, new_fd;
	struct sockaddr_storage their_addr;
	socklen_t sin_size;
	int yes = 1;
	struct sockaddr_in myaddr;

	log_start(1);

	load_config();

	setup_signals();

	/* used by sdk to override plugin dir */
	if(argc != 2)
	{
		load_luci(plugin_path);
	} else {
		load_luci(argv[1]);
		port = 8080;
	}

	myaddr.sin_family = AF_INET;
	myaddr.sin_port = htons(port);
	//inet_pton(AF_INET, "63.161.169.137", &myaddr.sin_addr.s_addr);
	myaddr.sin_addr.s_addr = INADDR_ANY;

	sockfd = socket(PF_INET, SOCK_STREAM, 0);

	if(sockfd == -1)
	{
		perror("server: socket");
		exit(1);
	}

	if(setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(int)) == -1)
	{
		perror("setsockopt");
		exit(1);
	}

	if(bind(sockfd, (struct sockaddr *)&myaddr, sizeof(myaddr)) == -1)
	{
		close(sockfd);
		perror("server: bind");
		exit(1);
	}

	if(listen(sockfd, BACKLOG) == -1)
	{
		perror("listen");
		exit(1);
	}

	/*log_printf("server: waiting for connections...\n");*/

	while(1)
	{
		sin_size = sizeof their_addr;
		new_fd = accept(sockfd, (struct sockaddr *)&their_addr, &sin_size);
		if(new_fd == -1)
		{
			perror("accept");
			continue;
		}

		/*inet_ntop(their_addr.ss_family,
			(void*)&((struct sockaddr_in*)&their_addr)->sin_addr, s, sizeof s);
		log_printf("server: got connection from %s\n", s);*/

		if(!fork())
		{
			/* child */
			close(sockfd);

			setsockopt(new_fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
			setsockopt(new_fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));

			run_luci(new_fd);
			cleanup_luci();
			close(new_fd);

			exit(0);
		}
		close(new_fd);
	}

	return 0;
}
