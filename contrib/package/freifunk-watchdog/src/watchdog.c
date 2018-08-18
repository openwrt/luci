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
 *   Copyright (C) 2009 Jo-Philipp Wich <jow@openwrt.org>
 */

#include "watchdog.h"

/* Global watchdog fd, required by signal handler */
int wdfd = -1;

/* Handle finished children */
static void sigchld_handler(int sig)
{
	pid_t pid;

	while( (pid = waitpid(-1, NULL, WNOHANG)) > 0 )
		syslog(LOG_INFO, "Child returned (pid %d)", pid);
}

/* Watchdog shutdown helper */
static void shutdown_watchdog(int sig)
{
	static const char wshutdown = WATCH_SHUTDOWN;

	if( wdfd > -1 )
	{
		syslog(LOG_INFO, "Stopping watchdog timer");
		write(wdfd, &wshutdown, 1);
		close(wdfd);
		wdfd = -1;
	}

	exit(0);
}

/* Get BSSID of given interface */
static int iw_get_bssid(int iwfd, const char *ifname, char *bssid)
{
	struct iwreq iwrq;

	if( iw_ioctl(iwfd, ifname, SIOCGIWAP, &iwrq) >= 0 )
	{
		unsigned char *addr = (unsigned char *)iwrq.u.ap_addr.sa_data;

		sprintf(bssid, "%02X:%02X:%02X:%02X:%02X:%02X",
			addr[0], addr[1], addr[2], addr[3], addr[4], addr[5]);

		return 0;
	}

	return -1;
}

/* Get channel of given interface */
static int iw_get_channel(int iwfd, const char *ifname, int *channel)
{
	int i;
	char buffer[sizeof(struct iw_range)];
	double cur_freq, cmp_freq;
	struct iwreq iwrq;
	struct iw_range *range;

	memset(buffer, 0, sizeof(buffer));

	iwrq.u.data.pointer = (char *)buffer;
	iwrq.u.data.length = sizeof(buffer);
	iwrq.u.data.flags = 0;

	if( iw_ioctl(iwfd, ifname, SIOCGIWRANGE, &iwrq) < 0)
	{
		*channel = -1;
		return -1;
	}

	range = (struct iw_range *)buffer;

	if( iw_ioctl(iwfd, ifname, SIOCGIWFREQ, &iwrq) >= 0 )
	{
		cur_freq = ((double)iwrq.u.freq.m) * pow(10, iwrq.u.freq.e);
		if( cur_freq < 1000.00 )
		{
			*channel = (int)cur_freq;
			return 0;
		}

		for(i = 0; i < range->num_frequency; i++)
		{
			cmp_freq = ((double)range->freq[i].m) * pow(10, range->freq[i].e);
			if( cmp_freq == cur_freq )
			{
				*channel = (int)range->freq[i].i;
				return 0;
			}
		}
	}

	*channel = -1;
	return -1;
}

/* Get the (first) pid of given process name */
static int find_process(const char *name)
{
	int pid = -1;
	int file;
	char buffer[128];
	char cmpname[128];
	DIR *dir;
	struct dirent *entry;

	if( (dir = opendir("/proc")) != NULL )
	{
		snprintf(cmpname, sizeof(cmpname), "Name:\t%s\n", name);

		while( (entry = readdir(dir)) != NULL )
		{
			if( !strcmp(entry->d_name, "..") || !isdigit(*entry->d_name) )
				continue;

			sprintf(buffer, "/proc/%s/status", entry->d_name);
			if( (file = open(buffer, O_RDONLY)) > -1 )
			{
				read(file, buffer, sizeof(buffer));
				close(file);

				if( strstr(buffer, cmpname) == buffer )
				{
					pid = atoi(entry->d_name);

					/* Skip myself ... */
					if( pid == getpid() )
						pid = -1;
					else
						break;
				}
			}
		}

		closedir(dir);
		return pid;
	}

	syslog(LOG_CRIT, "Unable to open /proc: %s",
		strerror(errno));

	return -1;
}

/* Get the 5 minute load average */
static double find_loadavg(void)
{
	int fd;
	char buffer[10];
	double load = 0.00;

	if( (fd = open("/proc/loadavg", O_RDONLY)) > -1 )
	{
		if( read(fd, buffer, sizeof(buffer)) == sizeof(buffer) )
			load = atof(&buffer[5]);

		close(fd);
	}

	return load;
}

/* Check if given uci file was updated */
static int check_uci_update(const char *config, time_t *mtime)
{
	struct stat s;
	char path[128];

	snprintf(path, sizeof(path), "/var/state/%s", config);
	if( stat(path, &s) > -1 )
	{
		if( (*mtime == 0) || (s.st_mtime > *mtime) )
		{
			*mtime = s.st_mtime;
			return 1;
		}
	}

	return 0;
}

/* Add tuple */
static void load_wifi_uci_add_iface(const char *section, struct uci_wifi_iface_itr_ctx *itr)
{
	wifi_tuple_t *t;
	const char *ucitmp;
	int val = 0;

	ucitmp = ucix_get_option(itr->ctx, "wireless", section, "mode");
	if( ucitmp && !strncmp(ucitmp, "adhoc", 5) )
	{
		if( (t = (wifi_tuple_t *)malloc(sizeof(wifi_tuple_t))) != NULL )
		{
			ucitmp = ucix_get_option(itr->ctx, "wireless", section, "ifname");
			if(ucitmp)
			{
				strncpy(t->ifname, ucitmp, sizeof(t->ifname));
				val++;
			}

			ucitmp = ucix_get_option(itr->ctx, "wireless", section, "bssid");
			if(ucitmp)
			{
				strncpy(t->bssid, ucitmp, sizeof(t->bssid));
				val++;
			}

			ucitmp = ucix_get_option(itr->ctx, "wireless", section, "device");
			if(ucitmp)
			{
				ucitmp = ucix_get_option(itr->ctx, "wireless", ucitmp, "channel");
				if(ucitmp)
				{
					t->channel = atoi(ucitmp);
					val++;
				}
			}

			if( val == 3 )
			{
				syslog(LOG_INFO, "Monitoring %s: bssid=%s channel=%d",
					t->ifname, t->bssid, t->channel);

				t->next = itr->list;
				itr->list = t;
			}
			else
			{
				free(t);
			}
		}
	}
}

/* Load config */
static wifi_tuple_t * load_wifi_uci(wifi_tuple_t *ifs, time_t *modtime)
{
	struct uci_context *ctx;
	struct uci_wifi_iface_itr_ctx itr;
	wifi_tuple_t *cur, *next;

	if( check_uci_update("wireless", modtime) )
	{
		syslog(LOG_INFO, "Wireless config changed, reloading");

		if( (ctx = ucix_init("wireless")) != NULL )
		{
			if( ifs != NULL )
			{
				for(cur = ifs; cur; cur = next)
				{
					next = cur->next;
					free(cur);
				}
			}

			itr.list = NULL;
			itr.ctx = ctx;

			ucix_for_each_section_type(ctx, "wireless", "wifi-iface",
				(void *)load_wifi_uci_add_iface, &itr);

			return itr.list;
		}
	}

	return ifs;
}

/* Add tuple */
static void load_watchdog_uci_add_process(const char *section, struct uci_process_itr_ctx *itr)
{
	process_tuple_t *t;
	const char *ucitmp;
	int val = 0;

	if( (t = (process_tuple_t *)malloc(sizeof(process_tuple_t))) != NULL )
	{
		t->restart = 0;

		ucitmp = ucix_get_option(itr->ctx, "freifunk-watchdog", section, "process");
		if(ucitmp)
		{
			strncpy(t->process, ucitmp, sizeof(t->process));
			val++;
		}

		ucitmp = ucix_get_option(itr->ctx, "freifunk-watchdog", section, "initscript");
		if(ucitmp)
		{
			strncpy(t->initscript, ucitmp, sizeof(t->initscript));
			val++;
		}

		if( val == 2 )
		{
			syslog(LOG_INFO, "Monitoring %s: initscript=%s",
				t->process, t->initscript);

				t->next = itr->list;
				itr->list = t;
		}
		else
		{
			free(t);
		}
	}
}

/* Load config */
static process_tuple_t * load_watchdog_uci(process_tuple_t *procs)
{
	struct uci_context *ctx;
	struct uci_process_itr_ctx itr;
	process_tuple_t *cur, *next;

	syslog(LOG_INFO, "Loading watchdog config");

	if( (ctx = ucix_init("freifunk-watchdog")) != NULL )
	{
		if( procs != NULL )
		{
			for(cur = procs; cur; cur = next)
			{
				next = cur->next;
				free(cur);
			}
		}

		itr.list = NULL;
		itr.ctx = ctx;

		ucix_for_each_section_type(ctx, "freifunk-watchdog", "process",
			(void *)load_watchdog_uci_add_process, &itr);

		return itr.list;
	}

	return procs;
}

/* Daemon implementation */
static int do_daemon(void)
{
	static int wdtrigger = 1;
	static int wdtimeout = BASE_INTERVAL * 2;
	static const char wdkeepalive = WATCH_KEEPALIVE;

	int iwfd;
	int channel;
	char bssid[18];
	struct sigaction sa;

	wifi_tuple_t *ifs = NULL, *curr_if;
	process_tuple_t *procs = NULL, *curr_proc;
	time_t wireless_modtime = 0;

	int action_intv = 0;
	int restart_wifi = 0;
	int loadavg_panic = 0;

	openlog(SYSLOG_IDENT, 0, LOG_DAEMON);
	memset(&sa, 0, sizeof(sa));

	if( (iwfd = socket(AF_INET, SOCK_DGRAM, 0)) == -1 )
	{
		syslog(LOG_ERR, "Can not open wireless control socket: %s",
			strerror(errno));

		return 1;
	}

	if( (wdfd = open(WATCH_DEVICE, O_WRONLY)) > -1 )
	{
		syslog(LOG_INFO, "Opened %s - polling every %i seconds",
			WATCH_DEVICE, BASE_INTERVAL);

		/* Install signal handler to halt watchdog on shutdown */
		sa.sa_handler = shutdown_watchdog;
		sa.sa_flags = SA_NOCLDWAIT | SA_RESTART;
		sigaction(SIGHUP,  &sa, NULL);
		sigaction(SIGINT,  &sa, NULL);
		sigaction(SIGPIPE, &sa, NULL);
		sigaction(SIGTERM, &sa, NULL);
		sigaction(SIGUSR1, &sa, NULL);
		sigaction(SIGUSR2, &sa, NULL);

		/* Set watchdog timeout to twice the interval */
		ioctl(wdfd, WDIOC_SETTIMEOUT, &wdtimeout);
	}

	/* Install signal handler to reap children */
	sa.sa_handler = sigchld_handler;
	sa.sa_flags = 0;
	sigaction(SIGCHLD, &sa, NULL);

	/* Load watchdog configuration only once */
	procs = load_watchdog_uci(procs);

	while( 1 )
	{
		/* Check/increment action interval */
		if( ++action_intv >= ACTION_INTERVAL )
		{
			/* Reset action interval */
			action_intv = 0;

			/* Check average load */
			if( find_loadavg() >= LOAD_TRESHOLD )
				loadavg_panic++;
			else
				loadavg_panic = 0;

			/* Check wireless interfaces */
			ifs = load_wifi_uci(ifs, &wireless_modtime);
			for( curr_if = ifs; curr_if; curr_if = curr_if->next )
			{
				/* Get current channel and bssid */
				if( (iw_get_bssid(iwfd, curr_if->ifname, bssid) == 0) &&
			    (iw_get_channel(iwfd, curr_if->ifname, &channel) == 0) )
				{
					/* Check BSSID */
					if( strcasecmp(bssid, curr_if->bssid) != 0 )
					{
						syslog(LOG_WARNING, "BSSID mismatch on %s: current=%s wanted=%s",
							curr_if->ifname, bssid, curr_if->bssid);

						restart_wifi++;
					}

					/* Check channel */
					else if( channel != curr_if->channel )
					{
						syslog(LOG_WARNING, "Channel mismatch on %s: current=%d wanted=%d",
							curr_if->ifname, channel, curr_if->channel);

						restart_wifi++;
					}
				}
				else
				{
					syslog(LOG_WARNING, "Requested interface %s not present", curr_if->ifname);
				}
			}

			/* Check processes */
			for( curr_proc = procs; curr_proc; curr_proc = curr_proc->next )
			{
				if( find_process(curr_proc->process) < 0 )
					curr_proc->restart++;
				else
					curr_proc->restart = 0;

				/* Process restart required? */
				if( curr_proc->restart >= HYSTERESIS )
				{
					curr_proc->restart = 0;
					syslog(LOG_WARNING, "The %s process died, restarting", curr_proc->process);
					EXEC(PROC_ACTION);
				}
			}


			/* Wifi restart required? */
			if( restart_wifi >= HYSTERESIS )
			{
				restart_wifi = 0;
				syslog(LOG_WARNING, "Channel or BSSID mismatch on wireless interface, restarting");
				EXEC(WIFI_ACTION);
			}

			/* Is there a load problem? */
			if( loadavg_panic >= HYSTERESIS )
			{
				syslog(LOG_EMERG, "Critical system load level, triggering reset!");

				/* Try watchdog, fall back to reboot */
				if( wdfd > -1 )
					ioctl(wdfd, WDIOC_SETTIMEOUT, &wdtrigger);
				else
					EXEC(LOAD_ACTION);
			}
		}


		/* Reset watchdog timer */
		if( wdfd > -1 )
			write(wdfd, &wdkeepalive, 1);

		sleep(BASE_INTERVAL);
	}

	shutdown_watchdog(0);
	closelog();

	return 0;
}


int main(int argc, char *argv[])
{
	/* Check if watchdog is running ... */
	if( (argc > 1) && (strcmp(argv[1], "running") == 0) )
	{
		return (find_process(BINARY) == -1);
	}

	/* Start daemon */
	return do_daemon();
}
