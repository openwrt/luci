/*
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 *   Copyright (C) 2008 John Crispin <blogic@openwrt.org> 
 *   Copyright (C) 2008 Steven Barth <steven@midlink.org>
 */

#include <net/if.h>
#include <net/if_arp.h>
#include <net/route.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <linux/sockios.h>
#include "iwlib.h"

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

#include "helper.h"

static int sock_iwconfig = 0;

typedef struct iwscan_state
{
	/* State */
	int ap_num;     /* Access Point number 1->N */
	int val_index;  /* Value in table 0->(N-1) */
} iwscan_state;

int iwc_startup(void)
{
	if(!sock_iwconfig)
		sock_iwconfig = iw_sockets_open();
	return sock_iwconfig;
}

void iwc_shutdown(void)
{
	if(!sock_iwconfig)
		return;
	iw_sockets_close(sock_iwconfig);
	sock_iwconfig = 0;
}

/* taken from wireless tools */
static int
get_info(char * ifname, struct wireless_info * info)
{
	struct iwreq wrq;

	memset((char*) info, 0, sizeof(struct wireless_info));

	/* Get basic information */
	if(iw_get_basic_config(sock_iwconfig, ifname, &(info->b)) < 0)
	{
		/* If no wireless name : no wireless extensions */
		/* But let's check if the interface exists at all */
		struct ifreq ifr;

		strncpy(ifr.ifr_name, ifname, IFNAMSIZ);
		if(ioctl(sock_iwconfig, SIOCGIFFLAGS, &ifr) < 0)
			return(-ENODEV);
		else
			return(-ENOTSUP);
	}

	/* Get ranges */
	if(iw_get_range_info(sock_iwconfig, ifname, &(info->range)) >= 0)
		info->has_range = 1;

	/* Get AP address */
	if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWAP, &wrq) >= 0)
	{
		info->has_ap_addr = 1;
		memcpy(&(info->ap_addr), &(wrq.u.ap_addr), sizeof (sockaddr));
	}

	/* Get bit rate */
	if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWRATE, &wrq) >= 0)
	{
		info->has_bitrate = 1;
		memcpy(&(info->bitrate), &(wrq.u.bitrate), sizeof(iwparam));
	}

	/* Get Power Management settings */
	wrq.u.power.flags = 0;
	if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWPOWER, &wrq) >= 0)
	{
		info->has_power = 1;
		memcpy(&(info->power), &(wrq.u.power), sizeof(iwparam));
	}

	/* Get stats */
	if(iw_get_stats(sock_iwconfig, ifname, &(info->stats),
		&info->range, info->has_range) >= 0)
	{
		info->has_stats = 1;
	}

	/* Get NickName */
	wrq.u.essid.pointer = (caddr_t) info->nickname;
	wrq.u.essid.length = IW_ESSID_MAX_SIZE + 1;
	wrq.u.essid.flags = 0;
	if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWNICKN, &wrq) >= 0)
		if(wrq.u.data.length > 1)
			info->has_nickname = 1;

	if((info->has_range) && (info->range.we_version_compiled > 9))
	{
		/* Get Transmit Power */
		if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWTXPOW, &wrq) >= 0)
		{
			info->has_txpower = 1;
			memcpy(&(info->txpower), &(wrq.u.txpower), sizeof(iwparam));
		}
	}

	/* Get sensitivity */
	if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWSENS, &wrq) >= 0)
	{
		info->has_sens = 1;
		memcpy(&(info->sens), &(wrq.u.sens), sizeof(iwparam));
	}

	if((info->has_range) && (info->range.we_version_compiled > 10))
	{
		/* Get retry limit/lifetime */
		if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWRETRY, &wrq) >= 0)
		{
			info->has_retry = 1;
			memcpy(&(info->retry), &(wrq.u.retry), sizeof(iwparam));
		}
	}

	/* Get RTS threshold */
	if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWRTS, &wrq) >= 0)
	{
		info->has_rts = 1;
		memcpy(&(info->rts), &(wrq.u.rts), sizeof(iwparam));
	}

	/* Get fragmentation threshold */
	if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWFRAG, &wrq) >= 0)
	{
		info->has_frag = 1;
		memcpy(&(info->frag), &(wrq.u.frag), sizeof(iwparam));
	}

	return(0);
}

void iwc_get(lua_State *L, char *ifname)
{
	struct wireless_info info;
	int rc = get_info(ifname, &info);
	char buffer[128];
	if(rc)
		return;

	lua_pushstring(L, ifname);
	lua_newtable(L);

	if(info.b.has_essid)
	{
		if(info.b.essid_on)
			add_table_entry(L, "essid", info.b.essid);
		else
			add_table_entry(L, "essid", "off");
	}

	if(info.b.has_mode)
		add_table_entry(L, "mode", iw_operation_mode[info.b.mode]);

	if(info.b.has_freq)
	{
		double freq = info.b.freq;    /* Frequency/channel */
		int channel = -1;       /* Converted to channel */
		char tmp[4];
		if(info.has_range && (freq < KILO))
			channel = iw_channel_to_freq((int) freq, &freq, &info.range);
		iw_print_freq(buffer, sizeof(buffer), freq, -1, info.b.freq_flags);
		snprintf(tmp, 4, "%d", channel);
		add_table_entry(L, "channel", tmp);
		add_table_entry(L, "freq", buffer);
	}

	if(info.has_ap_addr)
		add_table_entry(L, "macap", iw_sawap_ntop(&info.ap_addr, buffer));

	if(info.has_bitrate)
	{
		iw_print_bitrate(buffer, sizeof(buffer), info.bitrate.value);
		add_table_entry(L, "bitrate", buffer);
	}

	if(info.has_txpower)
	{
		iw_print_txpower(buffer, sizeof(buffer), &info.txpower);
		add_table_entry(L, "txpower", buffer);
	}
	lua_settable(L, -3);
}

int iwc_getall(lua_State *L)
{
	FILE *fp;
	char buffer[128];
	char *b = buffer;
	fp = fopen("/proc/net/wireless", "r");
	if(!fp)
		return -1;
	fgets(buffer, 128, fp);
	fgets(buffer, 128, fp);
	lua_newtable(L);
	while(fgets(buffer, 128, fp))
	{
		char *t;
		b = buffer;
		while(*b == ' ')
			b++;
		t = strstr(b, ":");
		if(t)
			*t = '\0';
		iwc_get(L, b);
	}
	return 1;
}

/* taken from wireless tools */
int iwc_set_essid(lua_State *L)
{
	struct iwreq wrq;
	int i = 1;
	char essid[IW_ESSID_MAX_SIZE + 1];
	int we_kernel_version;
	char *ifname, *e;
	if(lua_gettop(L) != 2)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
	ifname = (char *)lua_tostring (L, 1);
	e = (char *)lua_tostring (L, 2);

	if((!strcasecmp(e, "off")) | (!strcasecmp(e, "any")))
	{
		wrq.u.essid.flags = 0;
		essid[0] = '\0';
	} else if(!strcasecmp(e, "on"))
	{
		/* Get old essid */
		memset(essid, '\0', sizeof(essid));
		wrq.u.essid.pointer = (caddr_t) essid;
		wrq.u.essid.length = IW_ESSID_MAX_SIZE + 1;
		wrq.u.essid.flags = 0;
		if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWESSID, &wrq) < 0)
			return 0;
		wrq.u.essid.flags = 1;
	} else {
		wrq.u.essid.flags = 1;
		strcpy(essid, e); /* Size checked, all clear */
		i++;
	}

	/* Get version from kernel, device may not have range... */
	we_kernel_version = iw_get_kernel_we_version();

	/* Finally set the ESSID value */
	wrq.u.essid.pointer = (caddr_t) essid;
	wrq.u.essid.length = strlen(essid);
	if(we_kernel_version < 21)
		wrq.u.essid.length++;

	if(!iw_set_ext(sock_iwconfig, ifname, SIOCSIWESSID, &wrq))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

/* taken from wireless tools */
int iwc_set_mode(lua_State *L)
{
	struct iwreq wrq;
	unsigned int k;      /* Must be unsigned */
	char *ifname, *mode;

	if(lua_gettop(L) != 2)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
	ifname = (char *)lua_tostring (L, 1);
	mode = (char *)lua_tostring (L, 2);

	/* Check if it is a uint, otherwise get is as a string */
	if(sscanf(mode, "%ui", &k) != 1)
	{
		k = 0;
		while((k < IW_NUM_OPER_MODE) &&	strncasecmp(mode, iw_operation_mode[k], 3))
			k++;
	}
	if(k >= IW_NUM_OPER_MODE)
		return 0;

	wrq.u.mode = k;
	if(!iw_set_ext(sock_iwconfig, ifname, SIOCSIWMODE, &wrq))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

int iwc_set_channel(lua_State *L)
{
	struct iwreq wrq;
	char *ifname;
	int channel;
	if(lua_gettop(L) != 2)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
	ifname = (char *)lua_tostring (L, 1);
	channel = (int)lua_tointeger(L, 2);

	if(channel == -1)
	{
		wrq.u.freq.m = -1;
		wrq.u.freq.e = 0;
		wrq.u.freq.flags = 0;
	} else {
		iw_float2freq(channel, &wrq.u.freq);
		wrq.u.freq.flags = IW_FREQ_FIXED;
	}
	if(!iw_set_ext(sock_iwconfig, ifname, SIOCSIWFREQ, &wrq))
		lua_pushboolean(L, 1);
	else
		lua_pushboolean(L, 0);
	return 1;
}

static const char *	iw_ie_cypher_name[] = {
	"none",
	"WEP-40",
	"TKIP",
	"WRAP",
	"CCMP",
	"WEP-104",
};
#define IW_ARRAY_LEN(x) (sizeof(x)/sizeof((x)[0]))
#define	IW_IE_CYPHER_NUM	IW_ARRAY_LEN(iw_ie_cypher_name)

static const char *	iw_ie_key_mgmt_name[] = {
	"none",
	"802.1x",
	"PSK",
};
#define	IW_IE_KEY_MGMT_NUM	IW_ARRAY_LEN(iw_ie_key_mgmt_name)

static inline void iw_print_ie_wpa(lua_State *L, unsigned char * iebuf, int buflen)
{
	int ielen = iebuf[1] + 2;
	int offset = 2; /* Skip the IE id, and the length. */
	unsigned char wpa1_oui[3] = {0x00, 0x50, 0xf2};
	unsigned char wpa2_oui[3] = {0x00, 0x0f, 0xac};
	unsigned char *wpa_oui;
	int i;
	uint16_t ver = 0;
	uint16_t cnt = 0;
	int wpa1 = 0, wpa2 = 0;
	char buf[256];
	if(ielen > buflen)
		ielen = buflen;

	switch(iebuf[0])
	{
	case 0x30:      /* WPA2 */
		/* Check if we have enough data */
		if(ielen < 4)
			return;
		wpa_oui = wpa2_oui;
		break;

	case 0xdd:      /* WPA or else */
		wpa_oui = wpa1_oui;
		/* Not all IEs that start with 0xdd are WPA. 
		*        * So check that the OUI is valid. */
		if((ielen < 8)
			|| ((memcmp(&iebuf[offset], wpa_oui, 3) != 0)
			&& (iebuf[offset+3] == 0x01)))
		{
			return;
		}

		offset += 4;
		break;

	default:
		return;
	}

	/* Pick version number (little endian) */
	ver = iebuf[offset] | (iebuf[offset + 1] << 8);
	offset += 2;

	if(iebuf[0] == 0xdd)
		wpa1 = 1;
	if(iebuf[0] == 0x30)
		wpa2 = 1;

	if(ielen < (offset + 4))
	{
		if(wpa1)
		{
			add_table_entry(L, "wpa1gcipher", "TKIP");
			add_table_entry(L, "wpa1pcipher", "TKIP");
		} else {
			add_table_entry(L, "wpa2gcipher", "TKIP");
            add_table_entry(L, "wpa2pcipher", "TKIP");
		}
		return;
	}

	if(memcmp(&iebuf[offset], wpa_oui, 3) != 0)
	{
		if(wpa1)
			add_table_entry(L, "wpa1gcipher", "Proprietary");
		else
			add_table_entry(L, "wpa2gcipher", "Proprietary");
	} else {
		if(wpa1)
			add_table_entry(L, "wpa1gcipher", iebuf[offset+3][iw_ie_cypher_name]);
		else
			add_table_entry(L, "wpa2gcipher", iebuf[offset+3][iw_ie_cypher_name]);
	}
	offset += 4;

	if(ielen < (offset + 2))
	{
		if(wpa1)
			add_table_entry(L, "wpa1pcipher", "TKIP");
		else
			add_table_entry(L, "wpa2pcipher", "TKIP");
		return;
	}
	/* Otherwise, we have some number of pairwise ciphers. */
	cnt = iebuf[offset] | (iebuf[offset + 1] << 8);
	offset += 2;
	if(ielen < (offset + 4*cnt))
		return;
	*buf = '\0';
	for(i = 0; i < cnt; i++)
	{
		if(i > 0)
			strncat(buf, " ", 256);
		if(memcmp(&iebuf[offset], wpa_oui, 3) != 0)
		{
			strncat(buf, "Proprietary", 256);
		} else {
			if(iebuf[offset+3] <= IW_IE_CYPHER_NUM)
				strncat(buf, iw_ie_cypher_name[iebuf[offset+3]], 256);
			else
				strncat(buf, "unknown", 256);
		}
		offset+=4;
	}
	if(wpa1)
		add_table_entry(L, "wpa1pcipher", buf);
	else
		add_table_entry(L, "wpa2pcipher", buf);

	/* Check if we are done */
	if(ielen < (offset + 2))
		return;

	/* Now, we have authentication suites. */
	cnt = iebuf[offset] | (iebuf[offset + 1] << 8);
	offset += 2;
	*buf = '\0';
	if(ielen < (offset + 4*cnt))
		return;

	for(i = 0; i < cnt; i++)
	{
		if(i != 0)
			strncat(buf, " ", 256);
		if(memcmp(&iebuf[offset], wpa_oui, 3) != 0)
		{
			strncat(buf, "Proprietary", 256);
		} else {
			if(iebuf[offset+3] <= IW_IE_KEY_MGMT_NUM)
				strncat(buf, iw_ie_key_mgmt_name[iebuf[offset+3]], 256);
			else
				strncat(buf, "unknown", 256);
		}
		offset+=4;
	}
	if(wpa1)
		add_table_entry(L, "wpa1auth", buf);
	else
		add_table_entry(L, "wpa2auth", buf);
	/* Check if we are done */
	if(ielen < (offset + 1))
		return;
}

static inline void print_scanning_token(lua_State *L, struct stream_descr *stream,
	struct iw_event *event, struct iwscan_state *state, struct iw_range *iw_range, int has_range)
{
	char buffer[128];    /* Temporary buffer */

	/* Now, let's decode the event */
	switch(event->cmd)
	{
	case SIOCGIWAP:
		add_table_entry(L, "addr", iw_saether_ntop(&event->u.ap_addr, buffer));
		state->ap_num++;
		break;
	case SIOCGIWFREQ:
		{
		double freq;           /* Frequency/channel */
		int channel = -1;       /* Converted to channel */
		freq = iw_freq2float(&(event->u.freq));
		/* Convert to channel if possible */
		if(has_range)
			channel = iw_freq_to_channel(freq, iw_range);
			snprintf(buffer, 128, "%1.3f", freq);
			add_table_entry(L, "frequency", buffer);
			snprintf(buffer, 128, "%d", channel);
			add_table_entry(L, "channel", buffer);
			//iw_print_freq(buffer, sizeof(buffer), freq, channel, event->u.freq.flags);
			//printf("                    %s\n", buffer);
		}
		break;
	case SIOCGIWMODE:
		/* Note : event->u.mode is unsigned, no need to check <= 0 */
		if(event->u.mode >= IW_NUM_OPER_MODE)
			event->u.mode = IW_NUM_OPER_MODE;
		add_table_entry(L, "mode", iw_operation_mode[event->u.mode]);
		break;
	case SIOCGIWESSID:
		{
		char essid[IW_ESSID_MAX_SIZE+1];
		memset(essid, '\0', sizeof(essid));
		if((event->u.essid.pointer) && (event->u.essid.length))
			memcpy(essid, event->u.essid.pointer, event->u.essid.length);
		if(event->u.essid.flags)
			add_table_entry(L, "essid", essid);
		else
			add_table_entry(L, "essid", "off/any/hidden");
		}
		break;
	case SIOCGIWENCODE:
		{
		unsigned char   key[IW_ENCODING_TOKEN_MAX];
		if(event->u.data.pointer)
			memcpy(key, event->u.data.pointer, event->u.data.length);
		else
			event->u.data.flags |= IW_ENCODE_NOKEY;
		if(event->u.data.flags & IW_ENCODE_DISABLED)
		{
			add_table_entry(L, "key", "off");
		} else {
			iw_print_key(buffer, sizeof(buffer), key, event->u.data.length,
				event->u.data.flags);
			add_table_entry(L, "key", buffer);
		}
		}
		break;
	case SIOCGIWRATE:
		if(state->val_index == 0)
		{
			lua_pushstring(L, "bitrates");
			lua_newtable(L);
		}
		//iw_print_bitrate(buffer, sizeof(buffer), event->u.bitrate.value);
		snprintf(buffer, sizeof(buffer), "%d", event->u.bitrate.value);
		lua_pushinteger(L, state->val_index + 1);
		lua_pushstring(L, buffer);
		lua_settable(L, -3);

		/* Check for termination */
		if(stream->value == NULL)
		{
			lua_settable(L, -3);
			state->val_index = 0;
		} else
			state->val_index++;
		break;
	 case IWEVGENIE:
		{
			int offset = 0;
			unsigned char *buffer = event->u.data.pointer;
			int buflen = event->u.data.length;
			while(offset <= (buflen - 2))
			{
				switch(buffer[offset])
				{
				case 0xdd:  /* WPA1 (and other) */
				case 0x30:  /* WPA2 */
					iw_print_ie_wpa(L, buffer + offset, buflen);
					break;
				default:
					break;
				}
				offset += buffer[offset+1] + 2;
			}
		}
		break;
	default:
		break;
	}    /* switch(event->cmd) */
}

int iwc_scan(lua_State *L)
{
	struct iwreq wrq;
	struct iw_scan_req scanopt;        /* Options for 'set' */
	int scanflags = 0;      /* Flags for scan */
	unsigned char *buffer = NULL;      /* Results */
	int buflen = IW_SCAN_MAX_DATA; /* Min for compat WE<17 */
	struct iw_range range;
	int has_range;
	struct timeval tv;             /* Select timeout */
	int timeout = 15000000;     /* 15s */
	char *ifname;
	if(lua_gettop(L) != 1)
	{
		lua_pushstring(L, "invalid arg list");
		lua_error(L);
		return 0;
	}
	ifname = (char *)lua_tostring (L, 1);

	/* Debugging stuff */
	if((IW_EV_LCP_PK2_LEN != IW_EV_LCP_PK_LEN) || (IW_EV_POINT_PK2_LEN != IW_EV_POINT_PK_LEN))
	{
		fprintf(stderr, "*** Please report to jt@hpl.hp.com your platform details\n");
		fprintf(stderr, "*** and the following line :\n");
		fprintf(stderr, "*** IW_EV_LCP_PK2_LEN = %zu ; IW_EV_POINT_PK2_LEN = %zu\n\n",
			IW_EV_LCP_PK2_LEN, IW_EV_POINT_PK2_LEN);
	}

	/* Get range stuff */
	has_range = (iw_get_range_info(sock_iwconfig, ifname, &range) >= 0);

	/* Check if the interface could support scanning. */
	if((!has_range) || (range.we_version_compiled < 14))
	{
		lua_pushstring(L, "interface does not support scanning");
		lua_error(L);
		return 0;
	}

	/* Init timeout value -> 250ms between set and first get */
	tv.tv_sec = 0;
	tv.tv_usec = 250000;

	/* Clean up set args */
	memset(&scanopt, 0, sizeof(scanopt));

	wrq.u.data.pointer = NULL;
	wrq.u.data.flags = 0;
	wrq.u.data.length = 0;

	/* Initiate Scanning */
	if(iw_set_ext(sock_iwconfig, ifname, SIOCSIWSCAN, &wrq) < 0)
	{
		if((errno != EPERM) || (scanflags != 0))
		{
			lua_pushstring(L, "interface does not support scanning");
			lua_error(L);
			return 0;
		}
		/* If we don't have the permission to initiate the scan, we may
		*        * still have permission to read left-over results.
		*               * But, don't wait !!! */
		#if 0
		/* Not cool, it display for non wireless interfaces... */
		fprintf(stderr, "%-8.16s  (Could not trigger scanning, just reading left-over results)\n", ifname);
		#endif
		tv.tv_usec = 0;
	}
	timeout -= tv.tv_usec;

	/* Forever */
	while(1)
	{
		fd_set rfds;       /* File descriptors for select */
		int last_fd;    /* Last fd */
		int ret;

		/* Guess what ? We must re-generate rfds each time */
		FD_ZERO(&rfds);
		last_fd = -1;
		/* In here, add the rtnetlink fd in the list */

		/* Wait until something happens */
		ret = select(last_fd + 1, &rfds, NULL, NULL, &tv);

		/* Check if there was an error */
		if(ret < 0)
		{
			if(errno == EAGAIN || errno == EINTR)
				continue;
			lua_pushstring(L, "unhandled signal");
			lua_error(L);
			return 0;
		}

		/* Check if there was a timeout */
		if(ret == 0)
		{
			unsigned char *   newbuf;

realloc:
			/* (Re)allocate the buffer - realloc(NULL, len) == malloc(len) */
			newbuf = realloc(buffer, buflen);
			if(newbuf == NULL)
			{
				if(buffer)
					free(buffer);
				fprintf(stderr, "%s: Allocation failed\n", __FUNCTION__);
				return 0;
			}
			buffer = newbuf;

			/* Try to read the results */
			wrq.u.data.pointer = buffer;
			wrq.u.data.flags = 0;
			wrq.u.data.length = buflen;
			if(iw_get_ext(sock_iwconfig, ifname, SIOCGIWSCAN, &wrq) < 0)
			{
				/* Check if buffer was too small (WE-17 only) */
				if((errno == E2BIG) && (range.we_version_compiled > 16))
				{
					/* Some driver may return very large scan results, either
					 * because there are many cells, or because they have many
					 * large elements in cells (like IWEVCUSTOM). Most will
					 * only need the regular sized buffer. We now use a dynamic
					 * allocation of the buffer to satisfy everybody. Of course,
					 * as we don't know in advance the size of the array, we try
					 * various increasing sizes. Jean II */

					/* Check if the driver gave us any hints. */
					if(wrq.u.data.length > buflen)
						buflen = wrq.u.data.length;
					else
						buflen *= 2;

					/* Try again */
					goto realloc;
				}

				/* Check if results not available yet */
				if(errno == EAGAIN)
				{
					/* Restart timer for only 100ms*/
					tv.tv_sec = 0;
					tv.tv_usec = 100000;
					timeout -= tv.tv_usec;
					if(timeout > 0)
						continue;   /* Try again later */
				}

				/* Bad error */
				free(buffer);
				fprintf(stderr, "%-8.16s  Failed to read scan data : %s\n\n",
				ifname, strerror(errno));
				return 0;
			} else
				/* We have the results, go to process them */
				break;
		}

		/* In here, check if event and event type
		*        * if scan event, read results. All errors bad & no reset timeout */
	}

	if(wrq.u.data.length)
	{
		struct iw_event       iwe;
		struct stream_descr   stream;
		struct iwscan_state   state = { .ap_num = 1, .val_index = 0 };
		int           ret;
		int table = 0;
		iw_init_event_stream(&stream, (char *) buffer, wrq.u.data.length);
		lua_newtable(L);
		do
		{
			/* Extract an event and print it */
			ret = iw_extract_event_stream(&stream, &iwe,
				range.we_version_compiled);
			if(ret > 0)
			{
				if(iwe.cmd == SIOCGIWAP)
				{
					if(table)
						lua_settable(L, -3);
					table = 1;
					lua_pushinteger(L, state.ap_num);
					lua_newtable(L);
				}
				print_scanning_token(L, &stream, &iwe, &state, &range, has_range);
			}
		} while(ret > 0);
		lua_settable(L, -3);
		free(buffer);
		return 1;
	}
	free(buffer);
	return 0;
}
