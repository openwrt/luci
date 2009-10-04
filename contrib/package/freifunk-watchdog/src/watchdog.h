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
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 */

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdint.h>
#include <stdlib.h>
#include <syslog.h>
#include <ctype.h>
#include <errno.h>
#include <dirent.h>
#include <fcntl.h>
#include <math.h>
#include <time.h>
#include <signal.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <linux/types.h>
#include <linux/watchdog.h>

#include "ucix.h"
#include "wireless.22.h"


/* Watchdog poll interval */
#define BASE_INTERVAL	5

/* Action interval (N * BASE_INTERVAL) */
#define ACTION_INTERVAL	6

/* Hysteresis */
#define HYSTERESIS		3

/* How to call myself in the logs */
#define SYSLOG_IDENT	"Freifunk Watchdog"

/* Wifi error action */
#define WIFI_ACTION		"/sbin/wifi", "/sbin/wifi"

/* Crond error action */
#define CRON_ACTION		"/etc/init.d/cron", "/etc/init.d/cron", "restart"

/* SSHd error action */
#define SSHD_ACTION		"/etc/init.d/dropbear", "/etc/init.d/dropbear", "restart"

/* Watchdog device */
#define WATCH_DEVICE	"/dev/watchdog"
#define WATCH_SHUTDOWN	'V'
#define WATCH_KEEPALIVE	'\0'

/* System load error action and treshold */
#define LOAD_TRESHOLD	15.00
#define LOAD_ACTION		"/sbin/reboot", "/sbin/reboot"

/* Fallback binary name (passed by makefile) */
#ifndef BINARY
#define BINARY "ffwatchd"
#endif


/* ifname/bssid/channel tuples */
struct wifi_tuple {
	char ifname[16];
	char bssid[18];
	int channel;
	struct wifi_tuple *next;
};

/* structure to hold tuple-list and uci context during iteration */
struct uci_itr_ctx {
	struct wifi_tuple *list;
	struct uci_context *ctx;
};

typedef struct wifi_tuple wifi_tuple_t;


/* ioctl() helper (stolen from iwlib) */
static inline int
iw_ioctl(int                  skfd,           /* Socket to the kernel */
         const char *         ifname,         /* Device name */
         int                  request,        /* WE ID */
         struct iwreq *       pwrq)           /* Fixed part of the request */
{
  /* Set device name */
  strncpy(pwrq->ifr_ifrn.ifrn_name, ifname, 16);

  /* Do the request */
  return(ioctl(skfd, request, pwrq));
}

/* fork() & execl() helper */
#define EXEC(x)														\
	do {															\
		switch(fork())												\
		{															\
			case -1:												\
				syslog(LOG_CRIT, "Unable to fork child: %s",		\
					strerror(errno));								\
				break;												\
																	\
			case 0:													\
				execl(x, NULL);										\
				syslog(LOG_CRIT, "Unable to execute action: %s",	\
					strerror(errno));								\
				return 1;											\
		}															\
	} while(0)

