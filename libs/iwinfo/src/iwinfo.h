#ifndef __IWINFO_H_
#define __IWINFO_H_

#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <glob.h>
#include <ctype.h>
#include <stdint.h>

#include <sys/ioctl.h>
#include <net/if.h>
#include <errno.h>

#include "iwinfo_wl.h"
#include "iwinfo_madwifi.h"
#include "iwinfo_wext.h"


#define IWINFO_BUFSIZE	24 * 1024

struct iwinfo_assoclist_entry {
	uint8_t	mac[6];
	int8_t signal;
	int8_t noise;
};

struct iwinfo_txpwrlist_entry {
	uint8_t	dbm;
	uint8_t	mw;
};

#endif

