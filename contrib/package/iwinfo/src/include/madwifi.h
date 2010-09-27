/*
 * Header bits derived from MadWifi source:
 *   Copyright (c) 2001 Atsushi Onoe
 *   Copyright (c) 2002-2005 Sam Leffler, Errno Consulting
 *   All rights reserved.
 *
 * Distributed under the terms of the GPLv2 license.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef _MADWIFI_H
#define _MADWIFI_H

/* ieee80211.h */
#define	IEEE80211_ADDR_LEN		6
#define	IEEE80211_RATE_VAL		0x7f


/* ieee80211_crypto.h */
#define	IEEE80211_KEYBUF_SIZE		16
#define	IEEE80211_MICBUF_SIZE		16
#define IEEE80211_TID_SIZE			17

#define	IEEE80211_CIPHER_WEP		0
#define	IEEE80211_CIPHER_TKIP		1
#define	IEEE80211_CIPHER_AES_OCB	2
#define	IEEE80211_CIPHER_AES_CCM	3
#define	IEEE80211_CIPHER_CKIP		5
#define	IEEE80211_CIPHER_NONE		6
#define	IEEE80211_CIPHER_MAX		(IEEE80211_CIPHER_NONE + 1)


/* ieee80211_ioctl.h */
#define	IEEE80211_KEY_DEFAULT		0x80
#define	IEEE80211_CHAN_MAX			255
#define	IEEE80211_CHAN_BYTES		32
#define	IEEE80211_RATE_MAXSIZE		15

#define	IEEE80211_IOCTL_GETKEY		(SIOCDEVPRIVATE+3)
#define	IEEE80211_IOCTL_STA_STATS	(SIOCDEVPRIVATE+5)
#define	IEEE80211_IOCTL_STA_INFO	(SIOCDEVPRIVATE+6)

#define	IEEE80211_IOCTL_GETPARAM	(SIOCIWFIRSTPRIV+1)
#define	IEEE80211_IOCTL_GETMODE		(SIOCIWFIRSTPRIV+3)
#define	IEEE80211_IOCTL_GETCHANLIST	(SIOCIWFIRSTPRIV+7)
#define	IEEE80211_IOCTL_GETCHANINFO	(SIOCIWFIRSTPRIV+13)

enum {
	IEEE80211_PARAM_AUTHMODE		= 3,	/* authentication mode */
	IEEE80211_PARAM_MCASTCIPHER		= 5,	/* multicast/default cipher */
	IEEE80211_PARAM_MCASTKEYLEN		= 6,	/* multicast key length */
	IEEE80211_PARAM_UCASTCIPHERS	= 7,	/* unicast cipher suites */
	IEEE80211_PARAM_WPA				= 10,	/* WPA mode (0,1,2) */
};

/*
 * Authentication mode.
 */
enum ieee80211_authmode {
	IEEE80211_AUTH_NONE	= 0,
	IEEE80211_AUTH_OPEN	= 1,	/* open */
	IEEE80211_AUTH_SHARED	= 2,	/* shared-key */
	IEEE80211_AUTH_8021X	= 3,	/* 802.1x */
	IEEE80211_AUTH_AUTO	= 4,	/* auto-select/accept */
	/* NB: these are used only for ioctls */
	IEEE80211_AUTH_WPA	= 5,	/* WPA/RSN w/ 802.1x/PSK */
};

struct ieee80211_channel {
	u_int16_t ic_freq;	/* setting in MHz */
	u_int16_t ic_flags;	/* see below */
	u_int8_t ic_ieee;	/* IEEE channel number */
	int8_t ic_maxregpower;	/* maximum regulatory tx power in dBm */
	int8_t ic_maxpower;	/* maximum tx power in dBm */
	int8_t ic_minpower;	/* minimum tx power in dBm */
	u_int8_t ic_scanflags;
	u_int8_t ic_idletime; /* phy idle time in % */
};

struct ieee80211req_key {
	u_int8_t ik_type;		/* key/cipher type */
	u_int8_t ik_pad;
	u_int16_t ik_keyix;	/* key index */
	u_int8_t ik_keylen;		/* key length in bytes */
	u_int8_t ik_flags;
	u_int8_t ik_macaddr[IEEE80211_ADDR_LEN];
	u_int64_t ik_keyrsc;		/* key receive sequence counter */
	u_int64_t ik_keytsc;		/* key transmit sequence counter */
	u_int8_t ik_keydata[IEEE80211_KEYBUF_SIZE+IEEE80211_MICBUF_SIZE];
};

struct ieee80211req_chanlist {
	u_int8_t ic_channels[IEEE80211_CHAN_BYTES];
};

struct ieee80211req_chaninfo {
	u_int ic_nchans;
	struct ieee80211_channel ic_chans[IEEE80211_CHAN_MAX];
};

struct ieee80211req_sta_info {
	u_int16_t isi_len;		/* length (mult of 4) */
	u_int16_t isi_freq;		/* MHz */
	u_int16_t isi_flags;		/* channel flags */
	u_int16_t isi_state;		/* state flags */
	u_int8_t isi_authmode;		/* authentication algorithm */
	u_int8_t isi_rssi;
	int8_t isi_noise;
	u_int16_t isi_capinfo;		/* capabilities */
	u_int8_t isi_athflags;		/* Atheros capabilities */
	u_int8_t isi_erp;		/* ERP element */
	u_int8_t isi_macaddr[IEEE80211_ADDR_LEN];
	u_int8_t isi_nrates;		/* negotiated rates */
	u_int8_t isi_rates[IEEE80211_RATE_MAXSIZE];
	u_int8_t isi_txrate;		/* index to isi_rates[] */
	u_int16_t isi_ie_len;		/* IE length */
	u_int16_t isi_associd;		/* assoc response */
	u_int16_t isi_txpower;		/* current tx power */
	u_int16_t isi_vlan;		/* vlan tag */
	u_int16_t isi_txseqs[17];	/* seq to be transmitted */
	u_int16_t isi_rxseqs[17];	/* seq previous for qos frames*/
	u_int16_t isi_inact;		/* inactivity timer */
	u_int8_t isi_uapsd;		/* UAPSD queues */
	u_int8_t isi_opmode;		/* sta operating mode */
};

/*
 * Country/Region Codes from MS WINNLS.H
 * Numbering from ISO 3166
 * XXX belongs elsewhere
 */

enum CountryCode {
	CTRY_ALBANIA              = 8,       /* Albania */
	CTRY_ALGERIA              = 12,      /* Algeria */
	CTRY_ARGENTINA            = 32,      /* Argentina */
	CTRY_ARMENIA              = 51,      /* Armenia */
	CTRY_AUSTRALIA            = 36,      /* Australia */
	CTRY_AUSTRIA              = 40,      /* Austria */
	CTRY_AZERBAIJAN           = 31,      /* Azerbaijan */
	CTRY_BAHRAIN              = 48,      /* Bahrain */
	CTRY_BELARUS              = 112,     /* Belarus */
	CTRY_BELGIUM              = 56,      /* Belgium */
	CTRY_BELIZE               = 84,      /* Belize */
	CTRY_BOLIVIA              = 68,      /* Bolivia */
	CTRY_BRAZIL               = 76,      /* Brazil */
	CTRY_BRUNEI_DARUSSALAM    = 96,      /* Brunei Darussalam */
	CTRY_BULGARIA             = 100,     /* Bulgaria */
	CTRY_CANADA               = 124,     /* Canada */
	CTRY_CHILE                = 152,     /* Chile */
	CTRY_CHINA                = 156,     /* People's Republic of China */
	CTRY_COLOMBIA             = 170,     /* Colombia */
	CTRY_COSTA_RICA           = 188,     /* Costa Rica */
	CTRY_CROATIA              = 191,     /* Croatia */
	CTRY_CYPRUS               = 196,
	CTRY_CZECH                = 203,     /* Czech Republic */
	CTRY_DENMARK              = 208,     /* Denmark */
	CTRY_DOMINICAN_REPUBLIC   = 214,     /* Dominican Republic */
	CTRY_ECUADOR              = 218,     /* Ecuador */
	CTRY_EGYPT                = 818,     /* Egypt */
	CTRY_EL_SALVADOR          = 222,     /* El Salvador */
	CTRY_ESTONIA              = 233,     /* Estonia */
	CTRY_FAEROE_ISLANDS       = 234,     /* Faeroe Islands */
	CTRY_FINLAND              = 246,     /* Finland */
	CTRY_FRANCE               = 250,     /* France */
	CTRY_FRANCE2              = 255,     /* France2 */
	CTRY_GEORGIA              = 268,     /* Georgia */
	CTRY_GERMANY              = 276,     /* Germany */
	CTRY_GREECE               = 300,     /* Greece */
	CTRY_GUATEMALA            = 320,     /* Guatemala */
	CTRY_HONDURAS             = 340,     /* Honduras */
	CTRY_HONG_KONG            = 344,     /* Hong Kong S.A.R., P.R.C. */
	CTRY_HUNGARY              = 348,     /* Hungary */
	CTRY_ICELAND              = 352,     /* Iceland */
	CTRY_INDIA                = 356,     /* India */
	CTRY_INDONESIA            = 360,     /* Indonesia */
	CTRY_IRAN                 = 364,     /* Iran */
	CTRY_IRAQ                 = 368,     /* Iraq */
	CTRY_IRELAND              = 372,     /* Ireland */
	CTRY_ISRAEL               = 376,     /* Israel */
	CTRY_ITALY                = 380,     /* Italy */
	CTRY_JAMAICA              = 388,     /* Jamaica */
	CTRY_JAPAN                = 392,     /* Japan */
	CTRY_JAPAN1               = 393,     /* Japan (JP1) */
	CTRY_JAPAN2               = 394,     /* Japan (JP0) */
	CTRY_JAPAN3               = 395,     /* Japan (JP1-1) */
	CTRY_JAPAN4               = 396,     /* Japan (JE1) */
	CTRY_JAPAN5               = 397,     /* Japan (JE2) */
	CTRY_JAPAN6               = 399,	 /* Japan (JP6) */
	CTRY_JAPAN7               = 900,	 /* Japan */
	CTRY_JAPAN8               = 901,	 /* Japan */
	CTRY_JAPAN9               = 902,	 /* Japan */
	CTRY_JAPAN10	      = 903,	 /* Japan */
	CTRY_JAPAN11	      = 904,	 /* Japan */
	CTRY_JAPAN12	      = 905,	 /* Japan */
	CTRY_JAPAN13	      = 906,	 /* Japan */
	CTRY_JAPAN14	      = 907,	 /* Japan */
	CTRY_JAPAN15	      = 908,	 /* Japan */
	CTRY_JAPAN16	      = 909,	 /* Japan */
	CTRY_JAPAN17	      = 910,	 /* Japan */
	CTRY_JAPAN18	      = 911,	 /* Japan */
	CTRY_JAPAN19	      = 912,	 /* Japan */
	CTRY_JAPAN20	      = 913,	 /* Japan */
	CTRY_JAPAN21	      = 914,	 /* Japan */
	CTRY_JAPAN22	      = 915,	 /* Japan */
	CTRY_JAPAN23	      = 916,	 /* Japan */
	CTRY_JAPAN24	      = 917,	 /* Japan */
	CTRY_JAPAN25	      = 918,	 /* Japan */
	CTRY_JAPAN26	      = 919,	 /* Japan */
	CTRY_JAPAN27	      = 920,	 /* Japan */
	CTRY_JAPAN28	      = 921,	 /* Japan */
	CTRY_JAPAN29	      = 922,	 /* Japan */
	CTRY_JAPAN30	      = 923,	 /* Japan */
	CTRY_JAPAN31	      = 924,	 /* Japan */
	CTRY_JAPAN32	      = 925,	 /* Japan */
	CTRY_JAPAN33	      = 926,	 /* Japan */
	CTRY_JAPAN34	      = 927,	 /* Japan */
	CTRY_JAPAN35	      = 928,	 /* Japan */
	CTRY_JAPAN36	      = 929,	 /* Japan */
	CTRY_JAPAN37	      = 930,	 /* Japan */
	CTRY_JAPAN38	      = 931,	 /* Japan */
	CTRY_JAPAN39	      = 932,	 /* Japan */
	CTRY_JAPAN40	      = 933,	 /* Japan */
	CTRY_JAPAN41	      = 934,	 /* Japan */
	CTRY_JAPAN42	      = 935,	 /* Japan */
	CTRY_JAPAN43	      = 936,	 /* Japan */
	CTRY_JAPAN44	      = 937,	 /* Japan */
	CTRY_JAPAN45	      = 938,	 /* Japan */
	CTRY_JAPAN46	      = 939,	 /* Japan */
	CTRY_JAPAN47	      = 940,	 /* Japan */
	CTRY_JAPAN48	      = 941,	 /* Japan */
	CTRY_JORDAN               = 400,     /* Jordan */
	CTRY_KAZAKHSTAN           = 398,     /* Kazakhstan */
	CTRY_KENYA                = 404,     /* Kenya */
	CTRY_KOREA_NORTH          = 408,     /* North Korea */
	CTRY_KOREA_ROC            = 410,     /* South Korea */
	CTRY_KOREA_ROC2           = 411,     /* South Korea */
	CTRY_KUWAIT               = 414,     /* Kuwait */
	CTRY_LATVIA               = 428,     /* Latvia */
	CTRY_LEBANON              = 422,     /* Lebanon */
	CTRY_LIBYA                = 434,     /* Libya */
	CTRY_LIECHTENSTEIN        = 438,     /* Liechtenstein */
	CTRY_LITHUANIA            = 440,     /* Lithuania */
	CTRY_LUXEMBOURG           = 442,     /* Luxembourg */
	CTRY_MACAU                = 446,     /* Macau */
	CTRY_MACEDONIA            = 807,     /* the Former Yugoslav Republic of Macedonia */
	CTRY_MALAYSIA             = 458,     /* Malaysia */
	CTRY_MEXICO               = 484,     /* Mexico */
	CTRY_MONACO               = 492,     /* Principality of Monaco */
	CTRY_MOROCCO              = 504,     /* Morocco */
	CTRY_NETHERLANDS          = 528,     /* Netherlands */
	CTRY_NEW_ZEALAND          = 554,     /* New Zealand */
	CTRY_NICARAGUA            = 558,     /* Nicaragua */
	CTRY_NORWAY               = 578,     /* Norway */
	CTRY_OMAN                 = 512,     /* Oman */
	CTRY_PAKISTAN             = 586,     /* Islamic Republic of Pakistan */
	CTRY_PANAMA               = 591,     /* Panama */
	CTRY_PARAGUAY             = 600,     /* Paraguay */
	CTRY_PERU                 = 604,     /* Peru */
	CTRY_PHILIPPINES          = 608,     /* Republic of the Philippines */
	CTRY_POLAND               = 616,     /* Poland */
	CTRY_PORTUGAL             = 620,     /* Portugal */
	CTRY_PUERTO_RICO          = 630,     /* Puerto Rico */
	CTRY_QATAR                = 634,     /* Qatar */
	CTRY_ROMANIA              = 642,     /* Romania */
	CTRY_RUSSIA               = 643,     /* Russia */
	CTRY_SAUDI_ARABIA         = 682,     /* Saudi Arabia */
	CTRY_SINGAPORE            = 702,     /* Singapore */
	CTRY_SLOVAKIA             = 703,     /* Slovak Republic */
	CTRY_SLOVENIA             = 705,     /* Slovenia */
	CTRY_SOUTH_AFRICA         = 710,     /* South Africa */
	CTRY_SPAIN                = 724,     /* Spain */
	CTRY_SWEDEN               = 752,     /* Sweden */
	CTRY_SWITZERLAND          = 756,     /* Switzerland */
	CTRY_SYRIA                = 760,     /* Syria */
	CTRY_TAIWAN               = 158,     /* Taiwan */
	CTRY_THAILAND             = 764,     /* Thailand */
	CTRY_TRINIDAD_Y_TOBAGO    = 780,     /* Trinidad y Tobago */
	CTRY_TUNISIA              = 788,     /* Tunisia */
	CTRY_TURKEY               = 792,     /* Turkey */
	CTRY_UAE                  = 784,     /* U.A.E. */
	CTRY_UKRAINE              = 804,     /* Ukraine */
	CTRY_UNITED_KINGDOM       = 826,     /* United Kingdom */
	CTRY_UNITED_STATES        = 840,     /* United States */
	CTRY_UNITED_STATES_FCC49  = 842,     /* United States (Public Safety)*/
	CTRY_URUGUAY              = 858,     /* Uruguay */
	CTRY_UZBEKISTAN           = 860,     /* Uzbekistan */
	CTRY_VENEZUELA            = 862,     /* Venezuela */
	CTRY_VIET_NAM             = 704,     /* Viet Nam */
	CTRY_YEMEN                = 887,     /* Yemen */
	CTRY_ZIMBABWE             = 716      /* Zimbabwe */
};


#endif
