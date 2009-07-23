/*
 * lmo - Lua Machine Objects - Lookup utility
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
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
 */

#include "lmo.h"

extern char _lmo_error[1024];

static void die(const char *msg)
{
	printf("Error: %s\n", msg);
	exit(1);
}

static void usage(const char *name)
{
	printf("Usage: %s input.lmo key\n", name);
	exit(1);
}

int main(int argc, char *argv[])
{
	char val[4096];
	lmo_archive_t *ar = NULL;

	if( argc != 3 )
		usage(argv[0]);

	if( (ar = (lmo_archive_t *) lmo_open(argv[1])) != NULL )
	{
		if( lmo_lookup(ar, argv[2], val, sizeof(val)) > -1 )
		{
			printf("%s\n", val);
		}

		lmo_close(ar);
	}
	else
	{
		die(lmo_error());
	}

	return 0;
}
