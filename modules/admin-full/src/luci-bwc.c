/*
 * luci-bwc - Very simple bandwidth collector cache for LuCI realtime graphs
 *
 *   Copyright (C) 2010 Jo-Philipp Wich <xm@subsignal.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * 	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <inttypes.h>
#include <fcntl.h>
#include <time.h>
#include <errno.h>
#include <unistd.h>

#include <sys/stat.h>
#include <sys/mman.h>
#include <arpa/inet.h>


#define STEP_COUNT	60
#define STEP_TIME	1

#define DB_PATH		"/var/lib/luci-bwc"
#define DB_FILE		DB_PATH "/%s"

#define SCAN_PATTERN \
	" %[^ :]:%" SCNu64 " %" SCNu64 \
	" %*d %*d %*d %*d %*d %*d" \
	" %" SCNu64 " %" SCNu64


struct traffic_entry {
	uint64_t time;
	uint64_t rxb;
	uint64_t rxp;
	uint64_t txb;
	uint64_t txp;
};

static uint64_t htonll(uint64_t value)
{
	int num = 1;

	if (*(char *)&num == 1)
		return htonl((uint32_t)(value & 0xFFFFFFFF)) |
		       htonl((uint32_t)(value >> 32));

	return value;
}

#define ntohll htonll


static int init_minutely(const char *ifname)
{
	int i, file;
	char path[1024];
	char *p;
	struct traffic_entry e = { 0 };

	snprintf(path, sizeof(path), DB_FILE, ifname);

	for (p = &path[1]; *p; p++)
	{
		if (*p == '/')
		{
			*p = 0;

			if (mkdir(path, 0700) && (errno != EEXIST))
				return -1;

			*p = '/';
		}
	}

	if ((file = open(path, O_WRONLY | O_CREAT, 0600)) >= 0)
	{
		for (i = 0; i < STEP_COUNT; i++)
		{
			if (write(file, &e, sizeof(struct traffic_entry)) < 0)
				break;
		}

		close(file);

		return 0;
	}

	return -1;
}

static int update_minutely(
	const char *ifname, uint64_t rxb, uint64_t rxp, uint64_t txb, uint64_t txp
) {
	int rv = -1;

	int file;
	int entrysize = sizeof(struct traffic_entry);
	int mapsize = STEP_COUNT * entrysize;

	char path[1024];
	char *map;

	struct stat s;
	struct traffic_entry e;

	snprintf(path, sizeof(path), DB_FILE, ifname);

	if (stat(path, &s))
	{
		if (init_minutely(ifname))
		{
			fprintf(stderr, "Failed to init %s: %s\n",
					path, strerror(errno));

			return rv;
		}
	}

	if ((file = open(path, O_RDWR)) >= 0)
	{
		map = mmap(NULL, mapsize, PROT_READ | PROT_WRITE,
				   MAP_SHARED | MAP_LOCKED, file, 0);

		if ((map != NULL) && (map != MAP_FAILED))
		{
			e.time = htonll(time(NULL));
			e.rxb  = htonll(rxb);
			e.rxp  = htonll(rxp);
			e.txb  = htonll(txb);
			e.txp  = htonll(txp);

			memmove(map, map + entrysize, mapsize - entrysize);
			memcpy(map + mapsize - entrysize, &e, entrysize);

			munmap(map, mapsize);

			rv = 0;
		}

		close(file);
	}

	return rv;
}

static int run_daemon(int nofork)
{
	FILE *info;
	uint64_t rxb, txb, rxp, txp;
	char line[1024];
	char ifname[16];


	if (!nofork)
	{
		switch (fork())
		{
			case -1:
				perror("fork()");
				return -1;

			case 0:
				if (chdir("/") < 0)
				{
					perror("chdir()");
					exit(1);
				}

				close(0);
				close(1);
				close(2);
				break;

			default:
				exit(0);
		}
	}


	/* go */
	while (1)
	{
		if ((info = fopen("/proc/net/dev", "r")) != NULL)
		{
			while (fgets(line, sizeof(line), info))
			{
				if (strchr(line, '|'))
					continue;

				if (sscanf(line, SCAN_PATTERN, ifname, &rxb, &rxp, &txb, &txp))
				{
					if (strncmp(ifname, "lo", sizeof(ifname)))
						update_minutely(ifname, rxb, rxp, txb, txp);
				}
			}

			fclose(info);
		}

		sleep(STEP_TIME);
	}
}

static int run_dump(const char *ifname)
{
	int rv = 1;

	int i, file;
	int entrysize = sizeof(struct traffic_entry);
	int mapsize = STEP_COUNT * entrysize;

	char path[1024];
	char *map;

	struct traffic_entry *e;

	snprintf(path, sizeof(path), DB_FILE, ifname);

	if ((file = open(path, O_RDONLY)) >= 0)
	{
		map = mmap(NULL, mapsize, PROT_READ, MAP_SHARED | MAP_LOCKED, file, 0);

		if ((map != NULL) && (map != MAP_FAILED))
		{
			for (i = 0; i < mapsize; i += entrysize)
			{
				e = (struct traffic_entry *) &map[i];

				if (!e->time)
					continue;

				printf("[ %" PRIu64 ", %" PRIu64 ", %" PRIu64
					   ", %" PRIu64 ", %" PRIu64 " ]%s\n",
					ntohll(e->time),
					ntohll(e->rxb), ntohll(e->rxp),
					ntohll(e->txb), ntohll(e->txp),
					((i + entrysize) < mapsize) ? "," : "");
			}

			munmap(map, mapsize);
			rv = 0;
		}

		close(file);
	}
	else
	{
		fprintf(stderr, "Failed to open %s: %s\n", path, strerror(errno));
	}

	return rv;
}


int main(int argc, char *argv[])
{
	int opt;
	int daemon = 0;
	int nofork = 0;
	int dprint = 0;
	char *ifname = NULL;

	while ((opt = getopt(argc, argv, "dfp:")) > -1)
	{
		switch (opt)
		{
			case 'd':
				daemon = 1;
				break;

			case 'f':
				nofork = 1;
				break;

			case 'p':
				dprint = 1;
				ifname = optarg;
				break;

			default:
				break;
		}
	}

	if (daemon)
		return run_daemon(nofork);

	else if (dprint && ifname)
		return run_dump(ifname);

	else
		fprintf(stderr,
			"Usage:\n"
			"	%s -d [-f]\n"
			"	%s -p ifname\n",
				argv[0], argv[0]
		);

	return 1;
}
