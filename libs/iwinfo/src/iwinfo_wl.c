/*
 * iwinfo - Wireless Information Library - Broadcom wl.o Backend
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
 * This code is based on the wlc.c utility published by OpenWrt.org . 
 */

#include "iwinfo_wl.h"
#include "iwinfo_wext.h"

static int ioctl_socket = -1;

static int wl_ioctl(const char *name, int cmd, void *buf, int len)
{
	struct ifreq ifr;
	wl_ioctl_t ioc;

	/* prepare socket */
	if( ioctl_socket == -1 )
		ioctl_socket = socket(AF_INET, SOCK_DGRAM, 0);

	/* do it */
	ioc.cmd = cmd;
	ioc.buf = buf;
	ioc.len = len;
	strncpy(ifr.ifr_name, name, IFNAMSIZ);
	ifr.ifr_data = (caddr_t) &ioc;

	return ioctl(ioctl_socket, SIOCDEVPRIVATE, &ifr);
}

static struct wl_maclist * wl_read_assoclist(const char *ifname)
{
	struct wl_maclist *macs;
	int maclen = 4 + WL_MAX_STA_COUNT * 6;

	if( (macs = (struct wl_maclist *) malloc(maclen)) != NULL )
	{
		memset(macs, 0, maclen);
		macs->count = WL_MAX_STA_COUNT;

		if( !wl_ioctl(ifname, WLC_GET_ASSOCLIST, macs, maclen) )
			return macs;

		free(macs);
	}

	return NULL;
}


int wl_probe(const char *ifname)
{
	int magic;

	if( !wl_ioctl(ifname, WLC_GET_MAGIC, &magic, sizeof(magic)) && (magic == WLC_IOCTL_MAGIC))
		return 1;

	return 0;
}

int wl_get_mode(const char *ifname, char *buf)
{
	int ret = -1;
	int ap, infra, passive;

	if( (ret = wl_ioctl(ifname, WLC_GET_AP, &ap, sizeof(ap))) )
		return ret;

	if( (ret = wl_ioctl(ifname, WLC_GET_INFRA, &infra, sizeof(infra))) )
		return ret;

	if( (ret = wl_ioctl(ifname, WLC_GET_PASSIVE, &passive, sizeof(passive))) )
		return ret;

	if( passive )
		sprintf(buf, "Monitor");
	else if( !infra )
		sprintf(buf, "Ad-Hoc");
	else if( ap )
		sprintf(buf, "Master");
	else
		sprintf(buf, "Client");

	return 0;
}

int wl_get_ssid(const char *ifname, char *buf)
{
	int ret = -1;
	wlc_ssid_t ssid;

	if( !(ret = wl_ioctl(ifname, WLC_GET_SSID, &ssid, sizeof(ssid))) )
		memcpy(buf, ssid.ssid, ssid.ssid_len);

	return ret;
}

int wl_get_bssid(const char *ifname, char *buf)
{
	int ret = -1;
	char bssid[6];

	if( !(ret = wl_ioctl(ifname, WLC_GET_BSSID, bssid, 6)) )
		sprintf(buf, "%02X:%02X:%02X:%02X:%02X:%02X",
			(uint8_t)bssid[0], (uint8_t)bssid[1], (uint8_t)bssid[2],
			(uint8_t)bssid[3], (uint8_t)bssid[4], (uint8_t)bssid[5]
		);

	return ret;
}

int wl_get_channel(const char *ifname, int *buf)
{
	return wl_ioctl(ifname, WLC_GET_CHANNEL, buf, sizeof(buf));
}

int wl_get_bitrate(const char *ifname, int *buf)
{
	int ret = -1;
	int rate = 0;

	if( !(ret = wl_ioctl(ifname, WLC_GET_RATE, &rate, sizeof(rate))) && (rate > 0))
		*buf = rate / 2;

	return ret;
}

int wl_get_signal(const char *ifname, int *buf)
{
	unsigned int ap, rssi, i, rssi_count;
	int ioctl_req_version = 0x2000;
	char tmp[WLC_IOCTL_MAXLEN];
	struct wl_maclist *macs = NULL;
	wl_sta_rssi_t starssi;

	memset(tmp, 0, WLC_IOCTL_MAXLEN);
	memcpy(tmp, &ioctl_req_version, sizeof(ioctl_req_version));

	wl_ioctl(ifname, WLC_GET_BSS_INFO, tmp, WLC_IOCTL_MAXLEN);

	rssi = 0;
	rssi_count = 0;

	if( !wl_ioctl(ifname, WLC_GET_AP, &ap, sizeof(ap)) && !ap )
	{
		rssi = tmp[WL_BSS_RSSI_OFFSET];
		rssi_count = 1;
	}
	else
	{
		/* Calculate average rssi from conntected stations */
		if( (macs = wl_read_assoclist(ifname)) != NULL )
		{
			for( i = 0; i < macs->count; i++ )
			{
				memcpy(starssi.mac, &macs->ea[i], 6);

				if( !wl_ioctl(ifname, WLC_GET_RSSI, &starssi, 12) )
				{
					rssi += starssi.rssi;
					rssi_count++;
				}
			}

			free(macs);
		}
	}

	*buf = (rssi == 0 || rssi_count == 0) ? 1 : (rssi / rssi_count);

	return 0;
}

int wl_get_noise(const char *ifname, int *buf)
{
	unsigned int ap, noise;
	int ioctl_req_version = 0x2000;
	char tmp[WLC_IOCTL_MAXLEN];

	memset(tmp, 0, WLC_IOCTL_MAXLEN);
	memcpy(tmp, &ioctl_req_version, sizeof(ioctl_req_version));

	wl_ioctl(ifname, WLC_GET_BSS_INFO, tmp, WLC_IOCTL_MAXLEN);

	if ((wl_ioctl(ifname, WLC_GET_AP, &ap, sizeof(ap)) < 0) || ap)
	{
		if (wl_ioctl(ifname, WLC_GET_PHY_NOISE, &noise, sizeof(noise)) < 0)
			noise = 0;
	}
	else
	{
		noise = tmp[WL_BSS_NOISE_OFFSET];
	}

	*buf = noise;

	return 0;
}

int wl_get_quality(const char *ifname, int *buf)
{
	return wext_get_quality(ifname, buf);
}

int wl_get_quality_max(const char *ifname, int *buf)
{
	return wext_get_quality_max(ifname, buf);
}

int wl_get_enctype(const char *ifname, char *buf)
{
	uint32_t wsec, wpa;
	char algo[9];

	if( wl_ioctl(ifname, WLC_GET_WPA_AUTH, &wpa, sizeof(uint32_t)) ||
	    wl_ioctl(ifname, WLC_GET_WSEC, &wsec, sizeof(uint32_t)) )
			return -1;

	switch(wsec)
	{
		case 2:
			sprintf(algo, "TKIP");
			break;

		case 4:
			sprintf(algo, "CCMP");
			break;

		case 6:
			sprintf(algo, "TKIP, CCMP");
			break;
	}

	switch(wpa)
	{
		case 0:
			sprintf(buf, "%s", wsec ? "WEP" : "None");
			break;

		case 2:
			sprintf(buf, "WPA 802.1X (%s)", algo);
			break;

		case 4:
			sprintf(buf, "WPA PSK (%s)", algo);
			break;

		case 32:
			sprintf(buf, "802.1X (%s)", algo);
			break;

		case 64:
			sprintf(buf, "WPA2 802.1X (%s)", algo);
			break;

		case 66:
			sprintf(buf, "mixed WPA/WPA2 802.1X (%s)", algo);
			break;

		case 128:
			sprintf(buf, "WPA2 PSK (%s)", algo);
			break;

		case 132:
			sprintf(buf, "mixed WPA/WPA2 PSK (%s)", algo);
			break;

		default:
			sprintf(buf, "Unkown");
	}

	return 0;
}

int wl_get_assoclist(const char *ifname, char *buf, int *len)
{
	int i, j, noise;
	int ap, infra, passive;
	char line[128];
	char macstr[18];
	char devstr[IFNAMSIZ];
	struct wl_maclist *macs;
	struct wl_sta_rssi rssi;
	struct iwinfo_assoclist_entry entry;
	FILE *arp;

	ap = infra = passive = 0;

	wl_ioctl(ifname, WLC_GET_AP, &ap, sizeof(ap));
	wl_ioctl(ifname, WLC_GET_INFRA, &infra, sizeof(infra));
	wl_ioctl(ifname, WLC_GET_PASSIVE, &passive, sizeof(passive));

	if( wl_get_noise(ifname, &noise) )
		noise = 0;

	if( (ap || infra || passive) && ((macs = wl_read_assoclist(ifname)) != NULL) )
	{
		for( i = 0, j = 0; i < macs->count; i++, j += sizeof(struct iwinfo_assoclist_entry) )
		{
			memcpy(rssi.mac, &macs->ea[i], 6);

			if( !wl_ioctl(ifname, WLC_GET_RSSI, &rssi, sizeof(struct wl_sta_rssi)) )
				entry.signal = (rssi.rssi - 0x100);
			else
				entry.signal = 0;

			entry.noise = noise;
			memcpy(entry.mac, &macs->ea[i], 6);
			memcpy(&buf[j], &entry, sizeof(entry));
		}

		*len = j;
		free(macs);
		return 0;
	}
	else if( (arp = fopen("/proc/net/arp", "r")) != NULL )
	{
		j = 0;

		while( fgets(line, sizeof(line), arp) != NULL )
		{
			if( sscanf(line, "%*s 0x%*d 0x%*d %17s %*s %s", macstr, devstr) && !strcmp(devstr, ifname) )
			{
				rssi.mac[0] = strtol(&macstr[0],  NULL, 16);
				rssi.mac[1] = strtol(&macstr[3],  NULL, 16);
				rssi.mac[2] = strtol(&macstr[6],  NULL, 16);
				rssi.mac[3] = strtol(&macstr[9],  NULL, 16);
				rssi.mac[4] = strtol(&macstr[12], NULL, 16);
				rssi.mac[5] = strtol(&macstr[15], NULL, 16);

				if( !wl_ioctl(ifname, WLC_GET_RSSI, &rssi, sizeof(struct wl_sta_rssi)) )
					entry.signal = (rssi.rssi - 0x100);
				else
					entry.signal = 0;

				entry.noise = noise;
				memcpy(entry.mac, rssi.mac, 6);
				memcpy(&buf[j], &entry, sizeof(entry));

				j += sizeof(entry);
			}
		}

		*len = j;
		(void) fclose(arp);
		return 0;
	}

	return -1;
}

