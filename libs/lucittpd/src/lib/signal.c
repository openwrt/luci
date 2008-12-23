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
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <lib/log.h>

void handler_INT(int signo)
{
	log_printf("away we go\n");
	exit(0);
}

void handler_CHLD(int signo)
{
	while(waitpid(-1, NULL, WNOHANG) > 0);
}

void setup_signals(void)
{
	struct sigaction s1, s2, s3;
	s1.sa_handler = handler_INT;
	s1.sa_flags = 0;
	sigaction(SIGINT, &s1, NULL);
	s2.sa_handler = handler_INT;
	s2.sa_flags = 0;
	sigaction(SIGTERM, &s2, NULL);
	s3.sa_handler = handler_CHLD;
	s3.sa_flags = SA_RESTART;
	sigaction(SIGCHLD, &s3, NULL);
}
