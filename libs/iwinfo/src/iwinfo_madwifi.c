/*
 * iwinfo - Wireless Information Library - Madwifi Backend
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
 * The signal handling code is derived from the official madwifi tools,
 * wlanconfig.c in particular. The encryption property handling was
 * inspired by the hostapd madwifi driver.
 */

#include "iwinfo_madwifi.h"
#include "iwinfo_wext.h"

static int ioctl_socket = -1;

static int madwifi_ioctl(struct iwreq *wrq, const char *ifname, int cmd, void *data, size_t len)
{
	/* prepare socket */
	if( ioctl_socket == -1 )
		ioctl_socket = socket(AF_INET, SOCK_DGRAM, 0);

  	strncpy(wrq->ifr_name, ifname, IFNAMSIZ);

	if( data != NULL )
	{
		if( len < IFNAMSIZ )
		{
			memcpy(wrq->u.name, data, len);
		}
		else
		{
			wrq->u.data.pointer = data;
			wrq->u.data.length = len;
		}
	}

	return ioctl(ioctl_socket, cmd, wrq);
}

static int get80211priv(const char *ifname, int op, void *data, size_t len)
{
	struct iwreq iwr;

	if( madwifi_ioctl(&iwr, ifname, op, data, len) < 0 )
		return -1;

	return iwr.u.data.length;
}


int madwifi_probe(const char *ifname)
{
	int fd, ret;
	char path[32];
	char name[5];

	sprintf(path, "/proc/sys/net/%s/%%parent", ifname);
	ret = 0;

	if( (fd = open(path, O_RDONLY)) > -1 )
	{
		if( read(fd, name, 4) == 4 )
			ret = strncmp(name, "wifi", 4) ? 0 : 1;

		(void) close(fd);
	}

	return ret;
}

int madwifi_get_mode(const char *ifname, char *buf)
{
	return wext_get_mode(ifname, buf);
}

int madwifi_get_ssid(const char *ifname, char *buf)
{
	return wext_get_ssid(ifname, buf);
}

int madwifi_get_bssid(const char *ifname, char *buf)
{
	return wext_get_bssid(ifname, buf);
}

int madwifi_get_channel(const char *ifname, int *buf)
{
	int i;
	uint16_t freq;
	struct iwreq wrq;
	struct ieee80211req_chaninfo chans;

	if( madwifi_ioctl(&wrq, ifname, SIOCGIWFREQ, NULL, 0) >= 0 )
	{
		/* Madwifi returns a Hz frequency, get it's freq list to find channel index */
		freq = (uint16_t)(wrq.u.freq.m / 100000);

		if( get80211priv(ifname, IEEE80211_IOCTL_GETCHANINFO, &chans, sizeof(chans)) >= 0 )
		{
			*buf = 0;

			for( i = 0; i < chans.ic_nchans; i++ )
			{
				if( freq == chans.ic_chans[i].ic_freq )
				{
					*buf = chans.ic_chans[i].ic_ieee;
					break;
				}
			}

			return 0;
		}
	}

	return -1;
}

int madwifi_get_frequency(const char *ifname, int *buf)
{
	struct iwreq wrq;

	if( madwifi_ioctl(&wrq, ifname, SIOCGIWFREQ, NULL, 0) >= 0 )
	{
		*buf = (uint16_t)(wrq.u.freq.m / 100000);
		return 0;
	}

	return -1;
}

int madwifi_get_bitrate(const char *ifname, int *buf)
{
	unsigned int mode, len, rate, rate_count;
	uint8_t tmp[24*1024];
	uint8_t *cp;
	struct iwreq wrq;
	struct ieee80211req_sta_info *si;

	if( madwifi_ioctl(&wrq, ifname, SIOCGIWMODE, NULL, 0) >= 0 )
	{
		mode = wrq.u.mode;

		/* Calculate bitrate average from associated stations in ad-hoc mode */
		if( mode == 1 )
		{
			rate = rate_count = 0;

			if( (len = get80211priv(ifname, IEEE80211_IOCTL_STA_INFO, tmp, 24*1024)) > 0 )
			{
				cp = tmp;

				do {
					si = (struct ieee80211req_sta_info *) cp;

					if( si->isi_rssi > 0 )
					{
						rate_count++;
						rate += ((si->isi_rates[si->isi_txrate] & IEEE80211_RATE_VAL) / 2);
					}

					cp   += si->isi_len;
					len  -= si->isi_len;
				} while (len >= sizeof(struct ieee80211req_sta_info));
			}

			*buf = (rate == 0 || rate_count == 0) ? 0 : (rate / rate_count);
			return 0;
		}

		/* Return whatever wext tells us ... */
		return wext_get_bitrate(ifname, buf);
	}

	return -1;
}

int madwifi_get_signal(const char *ifname, int *buf)
{
	unsigned int mode, len, rssi, rssi_count;
	uint8_t tmp[24*1024];
	uint8_t *cp;
	struct iwreq wrq;
	struct ieee80211req_sta_info *si;

	if( madwifi_ioctl(&wrq, ifname, SIOCGIWMODE, NULL, 0) >= 0 )
	{
		mode = wrq.u.mode;

		/* Calculate signal average from associated stations in ap or ad-hoc mode */
		if( mode == 1 )
		{
			rssi = rssi_count = 0;

			if( (len = get80211priv(ifname, IEEE80211_IOCTL_STA_INFO, tmp, 24*1024)) > 0 )
			{
				cp = tmp;

				do {
					si = (struct ieee80211req_sta_info *) cp;

					if( si->isi_rssi > 0 )
					{
						rssi_count++;
						rssi -= (si->isi_rssi - 95);
					}

					cp   += si->isi_len;
					len  -= si->isi_len;
				} while (len >= sizeof(struct ieee80211req_sta_info));
			}

			*buf = (rssi == 0 || rssi_count == 0) ? 1 : -(rssi / rssi_count);
			return 0;
		}

		/* Return whatever wext tells us ... */
		return wext_get_signal(ifname, buf);
	}

	return -1;
}

int madwifi_get_noise(const char *ifname, int *buf)
{
	return wext_get_noise(ifname, buf);
}

int madwifi_get_quality(const char *ifname, int *buf)
{
	unsigned int mode, len, quality, quality_count;
	uint8_t tmp[24*1024];
	uint8_t *cp;
	struct iwreq wrq;
	struct ieee80211req_sta_info *si;

	if( madwifi_ioctl(&wrq, ifname, SIOCGIWMODE, NULL, 0) >= 0 )
	{
		mode = wrq.u.mode;

		/* Calculate signal average from associated stations in ad-hoc mode */
		if( mode == 1 )
		{
			quality = quality_count = 0;

			if( (len = get80211priv(ifname, IEEE80211_IOCTL_STA_INFO, tmp, 24*1024)) > 0 )
			{
				cp = tmp;

				do {
					si = (struct ieee80211req_sta_info *) cp;

					if( si->isi_rssi > 0 )
					{
						quality_count++;
						quality += si->isi_rssi;
					}

					cp   += si->isi_len;
					len  -= si->isi_len;
				} while (len >= sizeof(struct ieee80211req_sta_info));
			}

			*buf = (quality == 0 || quality_count == 0) ? 0 : (quality / quality_count);
			return 0;
		}

		/* Return whatever wext tells us ... */
		return wext_get_quality(ifname, buf);
	}

	return -1;
}

int madwifi_get_quality_max(const char *ifname, int *buf)
{
	return wext_get_quality_max(ifname, buf);
}

int madwifi_get_enctype(const char *ifname, char *buf)
{
	struct iwreq wrq;
	struct ieee80211req_key wk;
	int wpa_version = 0, ciphers = 0, key_type = 0;
	char cipher_string[32];

	sprintf(buf, "Unknown");

	memset(&wrq, 0, sizeof(wrq));
	memset(&wk, 0, sizeof(wk));
	memset(wk.ik_macaddr, 0xff, IEEE80211_ADDR_LEN);

	/* Get key information */
	if( get80211priv(ifname, IEEE80211_IOCTL_GETKEY, &wk, sizeof(wk)) >= 0 )
		key_type = wk.ik_type;

	/* Get wpa protocol version */
	wrq.u.mode = IEEE80211_PARAM_WPA;
	if( madwifi_ioctl(&wrq, ifname, IEEE80211_IOCTL_GETPARAM, NULL, 0) >= 0 )
		wpa_version = wrq.u.mode;

	/* Get used pairwise ciphers */
	wrq.u.mode = IEEE80211_PARAM_UCASTCIPHERS;
	if( madwifi_ioctl(&wrq, ifname, IEEE80211_IOCTL_GETPARAM, NULL, 0) >= 0 )
	{
		ciphers = wrq.u.mode;

		if( wpa_version > 0 )
		{
			memset(cipher_string, 0, sizeof(cipher_string));

			/* Looks like mixed wpa/wpa2 ? */
			if( (ciphers & (1<<IEEE80211_CIPHER_TKIP)) && (ciphers & (1<<IEEE80211_CIPHER_AES_CCM)) )
				wpa_version = 3;


			if( (ciphers & (1<<IEEE80211_CIPHER_TKIP)) )
				strcat(cipher_string, "TKIP, ");

			if( (ciphers & (1<<IEEE80211_CIPHER_AES_CCM)) )
				strcat(cipher_string, "CCMP, ");

			if( (ciphers & (1<<IEEE80211_CIPHER_AES_OCB)) )
				strcat(cipher_string, "AES-OCB, ");

			if( (ciphers & (1<<IEEE80211_CIPHER_CKIP)) )
				strcat(cipher_string, "CKIP, ");

			cipher_string[strlen(cipher_string)-2] = 0;
		}

		switch(wpa_version)
		{
			case 3:
				sprintf(buf, "mixed WPA/WPA2 (%s)", cipher_string);
				break;

			case 2:
				sprintf(buf, "WPA2 (%s)", cipher_string);
				break;

			case 1:
				sprintf(buf, "WPA (%s)", cipher_string);
				break;
			
			default:
				sprintf(buf, "%s", (key_type == 0) ? "WEP" : "None");
		}
	}

	return 0;
}

int madwifi_get_assoclist(const char *ifname, char *buf, int *len)
{
	int bl, tl, noise;
	uint8_t *cp;
	uint8_t tmp[24*1024];
	struct ieee80211req_sta_info *si;
	struct iwinfo_assoclist_entry entry;

	if( (tl = get80211priv(ifname, IEEE80211_IOCTL_STA_INFO, tmp, 24*1024)) > 0 )
	{
		cp = tmp;
		bl = 0;

		if( madwifi_get_noise(ifname, &noise) )
			noise = 0;

		do {
			si = (struct ieee80211req_sta_info *) cp;

			entry.signal = (si->isi_rssi - 95);
			entry.noise  = noise;
			memcpy(entry.mac, &si->isi_macaddr, 6);
			memcpy(&buf[bl], &entry, sizeof(struct iwinfo_assoclist_entry));

			bl += sizeof(struct iwinfo_assoclist_entry);
			cp += si->isi_len;
			tl -= si->isi_len;
		} while (tl >= sizeof(struct ieee80211req_sta_info));

		*len = bl;
		return 0;
	}

	return -1;
}

int madwifi_get_txpwrlist(const char *ifname, char *buf, int *len)
{
	return wext_get_txpwrlist(ifname, buf, len);
}

int madwifi_get_mbssid_support(const char *ifname, int *buf)
{
	/* We assume that multi bssid is always possible */
	*buf = 1;
	return 0;
}

