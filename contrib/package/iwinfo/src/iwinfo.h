#ifndef __IWINFO_H_
#define __IWINFO_H_

#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <glob.h>
#include <ctype.h>
#include <dirent.h>
#include <stdint.h>

#include <sys/ioctl.h>
#include <net/if.h>
#include <errno.h>

#include "iwinfo_wext.h"

#ifdef USE_WL
#include "iwinfo_wl.h"
#endif

#ifdef USE_MADWIFI
#include "iwinfo_madwifi.h"
#endif

#ifdef USE_NL80211
#include "iwinfo_nl80211.h"
#endif


#define IWINFO_BUFSIZE	24 * 1024

#define IWINFO_80211_A       (1 << 0)
#define IWINFO_80211_B       (1 << 1)
#define IWINFO_80211_G       (1 << 2)
#define IWINFO_80211_N       (1 << 3)

#define IWINFO_CIPHER_NONE   (1 << 0)
#define IWINFO_CIPHER_WEP40  (1 << 1)
#define IWINFO_CIPHER_TKIP   (1 << 2)
#define IWINFO_CIPHER_WRAP   (1 << 3)
#define IWINFO_CIPHER_CCMP   (1 << 4)
#define IWINFO_CIPHER_WEP104 (1 << 5)
#define IWINFO_CIPHER_AESOCB (1 << 6)
#define IWINFO_CIPHER_CKIP   (1 << 7)

#define IWINFO_KMGMT_NONE    (1 << 0)
#define IWINFO_KMGMT_8021x   (1 << 1)
#define IWINFO_KMGMT_PSK     (1 << 2)

#define IWINFO_AUTH_OPEN     (1 << 0)
#define IWINFO_AUTH_SHARED   (1 << 1)


struct iwinfo_assoclist_entry {
	uint8_t	mac[6];
	int8_t signal;
	int8_t noise;
};

struct iwinfo_txpwrlist_entry {
	uint8_t  dbm;
	uint16_t mw;
};

struct iwinfo_freqlist_entry {
	uint8_t channel;
	uint32_t mhz;
	uint8_t restricted;
};

struct iwinfo_crypto_entry {
	uint8_t	enabled;
	uint8_t wpa_version;
	uint8_t group_ciphers;
	uint8_t pair_ciphers;
	uint8_t auth_suites;
	uint8_t auth_algs;
};

struct iwinfo_scanlist_entry {
	uint8_t mac[6];
	uint8_t ssid[IW_ESSID_MAX_SIZE+1];
	uint8_t mode[8];
	uint8_t channel;
	uint8_t signal;
	uint8_t quality;
	uint8_t quality_max;
	struct iwinfo_crypto_entry crypto;
};

struct iwinfo_country_entry {
	uint16_t iso3166;
	uint8_t ccode[4];
};

struct iwinfo_iso3166_label {
	uint16_t iso3166;
	uint8_t  name[28];
};

#endif
