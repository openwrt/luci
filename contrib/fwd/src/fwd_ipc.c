/*
 * fwd - OpenWrt firewall daemon - unix domain socket parts
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
 * The fwd program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation.
 *
 * The fwd program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with the fwd program. If not, see http://www.gnu.org/licenses/.
 */


#include "fwd.h"
#include "fwd_ipc.h"


int fwd_ipc_listen(void)
{
	int fd;
	struct sockaddr_un addr;

	if( (fd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0 )
		fwd_fatal("Cannot create AF_UNIX socket: %m");

	memset(&addr, 0, sizeof(struct sockaddr_un));
	strcpy(addr.sun_path, FWD_SOCKET_PATH);
	addr.sun_family = AF_UNIX;

	unlink(FWD_SOCKET_PATH);

	if( bind(fd, (struct sockaddr *)&addr, sizeof(struct sockaddr_un)) < 0 )
		fwd_fatal("Cannot bind AF_UNIX socket: %m");

	if( listen(fd, 1) < 0 )
		fwd_fatal("Cannot listen on AF_UNIX socket: %m");

	//fcntl(fd, F_SETFL, O_NONBLOCK);

	return fd;
}

int fwd_ipc_accept(int fd)
{
	return accept(fd, NULL, NULL);
}

int fwd_ipc_connect(void)
{
	int fd;
	struct sockaddr_un addr;

	if( (fd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0 )
		fwd_fatal("Cannot create AF_UNIX socket: %m");

	memset(&addr, 0, sizeof(struct sockaddr_un));
	strcpy(addr.sun_path, FWD_SOCKET_PATH);
	addr.sun_family = AF_UNIX;

	if( connect(fd, (struct sockaddr *)&addr, sizeof(struct sockaddr_un)) < 0 )
		fwd_fatal("Cannot connect AF_UNIX socket: %m");

	fcntl(fd, F_SETFL, O_NONBLOCK);

	return fd;
}

int fwd_ipc_recvmsg(int fd, void *buf, int len)
{
	return recv(fd, buf, len, 0);
}

int fwd_ipc_sendmsg(int fd, void *buf, int len)
{
	return send(fd, buf, len, 0);
}

void fwd_ipc_shutdown(int fd)
{
	shutdown(fd, SHUT_RDWR);
	close(fd);
}

int fwd_ipc_sendtype(int fd, enum fwd_ipc_msgtype type)
{
	struct fwd_ipc_msg msg;

	memset(&msg, 0, sizeof(struct fwd_ipc_msg));
	msg.type = type;

	return fwd_ipc_sendmsg(fd, &msg, sizeof(struct fwd_ipc_msg));
}
