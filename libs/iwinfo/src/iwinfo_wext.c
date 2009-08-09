/*
 * iwinfo - Wireless Information Library - Linux Wireless Extension Backend
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
 * The iwinfo library is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation.
 *
 * The iwinfo library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with the iwinfo library. If not, see http://www.gnu.org/licenses/.
 *
 * Parts of this code are derived from the Linux wireless tools, iwlib.c,
 * iwlist.c and iwconfig.c in particular.
 */

#include "iwinfo.h"
#include "iwinfo_wext.h"

static int ioctl_socket = -1;

static double wext_freq2float(const struct iw_freq *in)
{
	int		i;
	double	res = (double) in->m;
	for(i = 0; i < in->e; i++) res *= 10;
	return res;
}

static int wext_ioctl(const char *ifname, int cmd, struct iwreq *wrq)
{
	/* prepare socket */
	if( ioctl_socket == -1 )
		ioctl_socket = socket(AF_INET, SOCK_DGRAM, 0);

  	strncpy(wrq->ifr_name, ifname, IFNAMSIZ);
	return ioctl(ioctl_socket, cmd, wrq);
}


int wext_probe(const char *ifname)
{
	struct iwreq wrq;

	if(wext_ioctl(ifname, SIOCGIWNAME, &wrq) >= 0)
		return 1;

	return 0;
}

int wext_get_mode(const char *ifname, char *buf)
{
	struct iwreq wrq;

	if(wext_ioctl(ifname, SIOCGIWMODE, &wrq) >= 0)
	{
		switch(wrq.u.mode)
		{
			case 0:
				sprintf(buf, "Auto");
				break;

			case 1:
				sprintf(buf, "Ad-Hoc");
				break;

			case 2:
				sprintf(buf, "Client");
				break;

			case 3:
				sprintf(buf, "Master");
				break;

			case 4:
				sprintf(buf, "Repeater");
				break;

			case 5:
				sprintf(buf, "Secondary");
				break;

			case 6:
				sprintf(buf, "Monitor");
				break;

			default:
				sprintf(buf, "Unknown");
		}

		return 0;
	}

	return -1;
}

int wext_get_ssid(const char *ifname, char *buf)
{
	struct iwreq wrq;

	wrq.u.essid.pointer = (caddr_t) buf;
	wrq.u.essid.length  = IW_ESSID_MAX_SIZE + 1;
	wrq.u.essid.flags   = 0;

	if(wext_ioctl(ifname, SIOCGIWESSID, &wrq) >= 0)
		return 0;

	return -1;
}

int wext_get_bssid(const char *ifname, char *buf)
{
	struct iwreq wrq;

	if(wext_ioctl(ifname, SIOCGIWAP, &wrq) >= 0)
	{
		sprintf(buf, "%02X:%02X:%02X:%02X:%02X:%02X",
			(uint8_t)wrq.u.ap_addr.sa_data[0], (uint8_t)wrq.u.ap_addr.sa_data[1],
			(uint8_t)wrq.u.ap_addr.sa_data[2], (uint8_t)wrq.u.ap_addr.sa_data[3],
			(uint8_t)wrq.u.ap_addr.sa_data[4], (uint8_t)wrq.u.ap_addr.sa_data[5]);

		return 0;
	}

	return -1;	
}

int wext_get_bitrate(const char *ifname, int *buf)
{
	struct iwreq wrq;

	if(wext_ioctl(ifname, SIOCGIWRATE, &wrq) >= 0)
	{
		*buf = wrq.u.bitrate.value;
		return 0;
	}

	return -1;	
}

int wext_get_channel(const char *ifname, int *buf)
{
	struct iwreq wrq;

	if(wext_ioctl(ifname, SIOCGIWFREQ, &wrq) >= 0)
	{
		/* FIXME: iwlib has some strange workarounds here, maybe we need them as well... */
		*buf = (int) wext_freq2float(&wrq.u.freq);
		return 0;
	}

	return -1;	
}

int wext_get_signal(const char *ifname, int *buf)
{
	struct iwreq wrq;
	struct iw_statistics stats;

	wrq.u.data.pointer = (caddr_t) &stats;
	wrq.u.data.length  = sizeof(struct iw_statistics);
	wrq.u.data.flags   = 1;

	if(wext_ioctl(ifname, SIOCGIWSTATS, &wrq) >= 0)
	{
		*buf = (stats.qual.level - 0x100);
		return 0;
	}

	return -1;
}

int wext_get_noise(const char *ifname, int *buf)
{
	struct iwreq wrq;
	struct iw_statistics stats;

	wrq.u.data.pointer = (caddr_t) &stats;
	wrq.u.data.length  = sizeof(struct iw_statistics);
	wrq.u.data.flags   = 1;

	if(wext_ioctl(ifname, SIOCGIWSTATS, &wrq) >= 0)
	{
		*buf = (stats.qual.noise - 0x100);
		return 0;
	}

	return -1;
}

int wext_get_quality(const char *ifname, int *buf)
{
	struct iwreq wrq;
	struct iw_statistics stats;

	wrq.u.data.pointer = (caddr_t) &stats;
	wrq.u.data.length  = sizeof(struct iw_statistics);
	wrq.u.data.flags   = 1;

	if(wext_ioctl(ifname, SIOCGIWSTATS, &wrq) >= 0)
	{
		*buf = stats.qual.qual;
		return 0;
	}

	return -1;
}

int wext_get_quality_max(const char *ifname, int *buf)
{
	struct iwreq wrq;
	struct iw_range range;

	wrq.u.data.pointer = (caddr_t) &range;
	wrq.u.data.length  = sizeof(struct iw_range);
	wrq.u.data.flags   = 0;

	if(wext_ioctl(ifname, SIOCGIWRANGE, &wrq) >= 0)
	{
		*buf = range.max_qual.qual;
		return 0;
	}

	return -1;
}

int wext_get_enctype(const char *ifname, char *buf)
{
	/* Stub */
	return -1;
}

int wext_get_assoclist(const char *ifname, char *buf, int *len)
{
	/* Stub */
	return -1;
}

