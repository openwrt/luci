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
#define DB_IF_FILE	DB_PATH "/if/%s"
#define DB_LD_FILE	DB_PATH "/load"

#define IF_SCAN_PATTERN \
	" %[^ :]:%" SCNu64 " %" SCNu64 \
	" %*d %*d %*d %*d %*d %*d" \
	" %" SCNu64 " %" SCNu64

#define LD_SCAN_PATTERN \
	"%f %f %f"


struct traffic_entry {
	uint64_t time;
	uint64_t rxb;
	uint64_t rxp;
	uint64_t txb;
	uint64_t txp;
};

struct load_entry {
	uint64_t time;
	uint16_t load1;
	uint16_t load5;
	uint16_t load15;
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


static int init_directory(char *path)
{
	char *p = path;

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

	return 0;
}

static int update_file(const char *path, void *entry, int esize)
{
	int rv = -1;
	int file;
	char *map;

	if ((file = open(path, O_RDWR)) >= 0)
	{
		map = mmap(NULL, esize * STEP_COUNT, PROT_READ | PROT_WRITE,
				   MAP_SHARED | MAP_LOCKED, file, 0);

		if ((map != NULL) && (map != MAP_FAILED))
		{
			memmove(map, map + esize, esize * (STEP_COUNT-1));
			memcpy(map + esize * (STEP_COUNT-1), entry, esize);

			munmap(map, esize * STEP_COUNT);

			rv = 0;
		}

		close(file);
	}

	return rv;
}


static int init_ifstat(const char *ifname)
{
	int i, file;
	char path[1024];
	struct traffic_entry e = { 0 };

	snprintf(path, sizeof(path), DB_IF_FILE, ifname);

	if (init_directory(path))
		return -1;

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

static int update_ifstat(
	const char *ifname, uint64_t rxb, uint64_t rxp, uint64_t txb, uint64_t txp
) {
	char path[1024];

	struct stat s;
	struct traffic_entry e;

	snprintf(path, sizeof(path), DB_IF_FILE, ifname);

	if (stat(path, &s))
	{
		if (init_ifstat(ifname))
		{
			fprintf(stderr, "Failed to init %s: %s\n",
					path, strerror(errno));

			return -1;
		}
	}

	e.time = htonll(time(NULL));
	e.rxb  = htonll(rxb);
	e.rxp  = htonll(rxp);
	e.txb  = htonll(txb);
	e.txp  = htonll(txp);

	return update_file(path, &e, sizeof(struct traffic_entry));
}

static int init_ldstat(void)
{
	int i, file;
	char path[1024];
	struct load_entry e = { 0 };

	snprintf(path, sizeof(path), DB_LD_FILE);

	if (init_directory(path))
		return -1;

	if ((file = open(path, O_WRONLY | O_CREAT, 0600)) >= 0)
	{
		for (i = 0; i < STEP_COUNT; i++)
		{
			if (write(file, &e, sizeof(struct load_entry)) < 0)
				break;
		}

		close(file);

		return 0;
	}

	return -1;
}

static int update_ldstat(uint16_t load1, uint16_t load5, uint16_t load15)
{
	char path[1024];

	struct stat s;
	struct load_entry e;

	snprintf(path, sizeof(path), DB_LD_FILE);

	if (stat(path, &s))
	{
		if (init_ldstat())
		{
			fprintf(stderr, "Failed to init %s: %s\n",
					path, strerror(errno));

			return -1;
		}
	}

	e.time   = htonll(time(NULL));
	e.load1  = htons(load1);
	e.load5  = htons(load5);
	e.load15 = htons(load15);

	return update_file(path, &e, sizeof(struct load_entry));
}

static int run_daemon(int nofork)
{
	FILE *info;
	uint64_t rxb, txb, rxp, txp;
	float lf1, lf5, lf15;
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

				if (sscanf(line, IF_SCAN_PATTERN, ifname, &rxb, &rxp, &txb, &txp))
				{
					if (strncmp(ifname, "lo", sizeof(ifname)))
						update_ifstat(ifname, rxb, rxp, txb, txp);
				}
			}

			fclose(info);
		}

		if ((info = fopen("/proc/loadavg", "r")) != NULL)
		{
			if (fscanf(info, LD_SCAN_PATTERN, &lf1, &lf5, &lf15))
			{
				update_ldstat((uint16_t)(lf1  * 100),
							  (uint16_t)(lf5  * 100),
							  (uint16_t)(lf15 * 100));
			}

			fclose(info);
		}

		sleep(STEP_TIME);
	}
}

static int run_dump_ifname(const char *ifname)
{
	int rv = 1;

	int i, file;
	int entrysize = sizeof(struct traffic_entry);
	int mapsize = STEP_COUNT * entrysize;

	char path[1024];
	char *map;

	struct traffic_entry *e;

	snprintf(path, sizeof(path), DB_IF_FILE, ifname);

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

static int run_dump_load(void)
{
	int rv = 1;

	int i, file;
	int entrysize = sizeof(struct load_entry);
	int mapsize = STEP_COUNT * entrysize;

	char path[1024];
	char *map;

	struct load_entry *e;

	snprintf(path, sizeof(path), DB_LD_FILE);

	if ((file = open(path, O_RDONLY)) >= 0)
	{
		map = mmap(NULL, mapsize, PROT_READ, MAP_SHARED | MAP_LOCKED, file, 0);

		if ((map != NULL) && (map != MAP_FAILED))
		{
			for (i = 0; i < mapsize; i += entrysize)
			{
				e = (struct load_entry *) &map[i];

				if (!e->time)
					continue;

				printf("[ %" PRIu64 ", %u, %u, %u ]%s\n",
					ntohll(e->time),
					ntohs(e->load1), ntohs(e->load5), ntohs(e->load15),
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
	int iprint = 0;
	int lprint = 0;
	char *ifname = NULL;

	while ((opt = getopt(argc, argv, "dfi:l")) > -1)
	{
		switch (opt)
		{
			case 'd':
				daemon = 1;
				break;

			case 'f':
				nofork = 1;
				break;

			case 'i':
				iprint = 1;
				ifname = optarg;
				break;

			case 'l':
				lprint = 1;
				break;

			default:
				break;
		}
	}

	if (daemon)
		return run_daemon(nofork);

	else if (iprint && ifname)
		return run_dump_ifname(ifname);

	else if (lprint)
		return run_dump_load();

	else
		fprintf(stderr,
			"Usage:\n"
			"	%s -d [-f]\n"
			"	%s -i ifname\n"
			"	%s -l\n",
				argv[0], argv[0], argv[0]
		);

	return 1;
}
