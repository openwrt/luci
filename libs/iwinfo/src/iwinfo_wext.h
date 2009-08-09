/*
 * iwinfo - Wireless Information Library - Linux Wireless Extension Headers
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
 */

#ifndef __IWINFO_WEXT_H_
#define __IWINFO_WEXT_H_

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

#include "include/wext.h"

int wext_probe(const char *ifname);
int wext_get_mode(const char *ifname, char *buf);
int wext_get_ssid(const char *ifname, char *buf);
int wext_get_bssid(const char *ifname, char *buf);
int wext_get_channel(const char *ifname, int *buf);
int wext_get_bitrate(const char *ifname, int *buf);
int wext_get_signal(const char *ifname, int *buf);
int wext_get_noise(const char *ifname, int *buf);
int wext_get_quality(const char *ifname, int *buf);
int wext_get_quality_max(const char *ifname, int *buf);
int wext_get_enctype(const char *ifname, char *buf);
int wext_get_assoclist(const char *ifname, char *buf, int *len);

#endif
