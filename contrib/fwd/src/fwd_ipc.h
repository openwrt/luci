/*
 * fwd - OpenWrt firewall daemon - unix domain socket headers
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

#ifndef __FWD_IPC_H__
#define __FWD_IPC_H__

#include <unistd.h>
#include <fcntl.h>
#include <errno.h>

#include <sys/socket.h>
#include <sys/un.h>

#define FWD_SOCKET_PATH	"/var/run/fwd.sock"


enum fwd_ipc_msgtype {
	FWD_IPC_OK     = 0,
	FWD_IPC_ERROR  = 1,
	FWD_IPC_FLUSH  = 2,
	FWD_IPC_BUILD  = 3,
	FWD_IPC_RELOAD = 4,
	FWD_IPC_ADDIF  = 5,
	FWD_IPC_DELIF  = 6
};

struct fwd_ipc_msg {
	enum fwd_ipc_msgtype type;
	union {
		char network[256];
	} data;
};

int fwd_ipc_listen(void);
int fwd_ipc_accept(int);

int fwd_ipc_connect(void);

int fwd_ipc_recvmsg(int, void *, int);
int fwd_ipc_sendmsg(int, void *, int);

void fwd_ipc_shutdown(int);

int fwd_ipc_sendtype(int, enum fwd_ipc_msgtype);

#endif
