#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <sys/mman.h>

#include "nvram.h"


static nvram_handle_t * nvram_open_rdonly(void)
{
	const char *file = nvram_find_staging();

	if( file == NULL )
		file = nvram_find_mtd();

	if( file != NULL )
		return nvram_open(file, NVRAM_RO);

	return NULL;
}

static nvram_handle_t * nvram_open_staging(void)
{
	if( nvram_find_staging() != NULL || nvram_to_staging() == 0 )
		return nvram_open(NVRAM_STAGING, NVRAM_RW);

	return NULL;
}

static int do_show(nvram_handle_t *nvram)
{
	nvram_tuple_t *t;
	int stat = 1;

	if( (t = nvram_getall(nvram)) != NULL )
	{
		while( t )
		{
			printf("%s=%s\n", t->name, t->value);
			t = t->next;
		}

		stat = 0;
	}

	return stat;
}

static int do_get(nvram_handle_t *nvram, const char *var)
{
	const char *val;
	int stat = 1;

	if( (val = nvram_get(nvram, var)) != NULL )
	{
		printf("%s\n", val);
		stat = 0;
	}

	return stat;
}

static int do_unset(nvram_handle_t *nvram, const char *var)
{
	return nvram_unset(nvram, var);
}

static int do_set(nvram_handle_t *nvram, const char *pair)
{
	char *val = strstr(pair, "=");
	char var[strlen(pair)];
	int stat = 1;

	if( val != NULL )
	{
		memset(var, 0, sizeof(var));
		strncpy(var, pair, (int)(val-pair));
		stat = nvram_set(nvram, var, (char *)(val + 1));
	}

	return stat;
}


int main( int argc, const char *argv[] )
{
	nvram_handle_t *nvram;
	int commit = 0;
	int write = 0;
	int stat = 1;
	int i;

	/* Ugly... iterate over arguments to see whether we can expect a write */
	for( i = 1; i < argc; i++ )
		if( ( !strcmp(argv[i], "set")   && ++i < argc ) ||
			( !strcmp(argv[i], "unset") && ++i < argc ) ||
			!strcmp(argv[i], "commit") )
		{
			write = 1;
			break;
		}


	if( (nvram = write ? nvram_open_staging() : nvram_open_rdonly()) != NULL )
	{
		for( i = 1; i < argc; i++ )
		{
			if( !strcmp(argv[i], "show") )
			{
				stat = do_show(nvram);
			}
			else if( !strcmp(argv[i], "get") && ++i < argc )
			{
				stat = do_get(nvram, argv[i]);
			}
			else if( !strcmp(argv[i], "unset") && ++i < argc )
			{
				stat = do_unset(nvram, argv[i]);
			}
			else if( !strcmp(argv[i], "set") && ++i < argc )
			{
				stat = do_set(nvram, argv[i]);
			}
			else if( !strcmp(argv[i], "commit") )
			{
				commit = 1;
			}
			else
			{
				fprintf(stderr,
					"Usage:\n"
					"	nvram show\n"
					"	nvram get variable\n"
					"	nvram set variable=value [set ...]\n"
					"	nvram unset variable [unset ...]\n"
					"	nvram commit\n"
				);

				return 1;
			}
		}

		if( write )
			stat = nvram_commit(nvram);

		nvram_close(nvram);

		if( commit )
			stat = staging_to_nvram();
	}

	return stat;
}
