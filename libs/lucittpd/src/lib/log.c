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
 *   Provided by fon.com
 *   Copyright (C) 2008 John Crispin <blogic@openwrt.org> 
 */

#include <stdio.h>
#include <syslog.h>
#include <stdarg.h>

static int daemonize = 0;

void log_start(int daemon)
{
	daemonize = daemon;
	openlog("lucittpd", 0, 0);
}

void log_printf(char *fmt, ...)
{
	char p[256];
	va_list ap;

	va_start(ap, fmt);
	vsnprintf(p, 256, fmt, ap);
	va_end(ap);

	if(daemonize)
		syslog(10, "%s", p);
	else
		printf("%s", p);
}
