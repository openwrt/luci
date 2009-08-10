/*
 * Custom OID/ioctl definitions for
 * Broadcom 802.11abg Networking Device Driver
 *
 * Definitions subject to change without notice.
 *
 * Copyright 2006, Broadcom Corporation
 * All Rights Reserved.
 * 
 * THIS SOFTWARE IS OFFERED "AS IS", AND BROADCOM GRANTS NO WARRANTIES OF ANY
 * KIND, EXPRESS OR IMPLIED, BY STATUTE, COMMUNICATION OR OTHERWISE. BROADCOM
 * SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A SPECIFIC PURPOSE OR NONINFRINGEMENT CONCERNING THIS SOFTWARE.
 *
 */

#ifndef _BROADCOM_H
#define _BROADCOM_H

#define WL_MCSSET_LEN				16
#define WL_MAX_STA_COUNT			32

#define WL_BSS_RSSI_OFFSET			82
#define WL_BSS_NOISE_OFFSET			84

#define WLC_IOCTL_MAGIC				0x14e46c77
#define	WLC_IOCTL_MAXLEN			8192

#define WLC_GET_MAGIC				0
#define WLC_GET_RATE				12
#define WLC_GET_INFRA				19
#define WLC_GET_BSSID				23
#define WLC_GET_SSID				25
#define WLC_GET_CHANNEL				29
#define WLC_GET_PASSIVE 			48
#define WLC_GET_AP					117
#define WLC_GET_RSSI				127
#define WLC_GET_WSEC				133
#define WLC_GET_PHY_NOISE			135
#define WLC_GET_BSS_INFO			136
#define WLC_GET_ASSOCLIST			159
#define WLC_GET_WPA_AUTH			164
#define WLC_GET_VAR					262


struct wl_ether_addr {
	uint8_t					octet[6];
};

struct wl_maclist {
	uint					count;
	struct wl_ether_addr 	ea[1];
};

typedef struct wl_sta_rssi {
	int						rssi;
	char					mac[6];
	uint16_t				foo;
} wl_sta_rssi_t;

typedef struct wlc_ssid {
	uint32_t				ssid_len;
	unsigned char			ssid[32];
} wlc_ssid_t;

/* Linux network driver ioctl encoding */
typedef struct wl_ioctl {
	uint32_t				cmd;	/* common ioctl definition */
	void					*buf;	/* pointer to user buffer */
	uint32_t				len;	/* length of user buffer */
	uint8_t					set;	/* get or set request (optional) */
	uint32_t				used;	/* bytes read or written (optional) */
	uint32_t				needed;	/* bytes needed (optional) */
} wl_ioctl_t;

#endif
