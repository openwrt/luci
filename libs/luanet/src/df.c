/* based on busybox code */
#include <stdio.h>
#include <string.h>
#include <mntent.h>
#include <sys/vfs.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

#include "helper.h"

struct mntent *find_mount_point(const char *name, const char *table)
{
	struct stat s;
	dev_t mountDevice;
	FILE *mountTable;
	struct mntent *mountEntry;

	if (stat(name, &s) != 0)
		return 0;

	if ((s.st_mode & S_IFMT) == S_IFBLK)
		mountDevice = s.st_rdev;
	else
		mountDevice = s.st_dev;


	mountTable = setmntent(table ? table : "/etc/mtab", "r");
	if (!mountTable)
		return 0;

	while ((mountEntry = getmntent(mountTable)) != 0) {
		if (strcmp(name, mountEntry->mnt_dir) == 0
			|| strcmp(name, mountEntry->mnt_fsname) == 0
			) { /* String match. */
			break;
			}
		if (stat(mountEntry->mnt_fsname, &s) == 0 && s.st_rdev == mountDevice)  /* Match the device. */
			break;
		if (stat(mountEntry->mnt_dir, &s) == 0 && s.st_dev == mountDevice)  /* Match the directory's mount point. */
			break;
	}
	endmntent(mountTable);
	return mountEntry;
}

static unsigned long kscale(unsigned long b, unsigned long bs)
{
	return (b * (unsigned long long) bs + 1024/2) / 1024;
}

int df(lua_State *L)
{
	unsigned long blocks_used;
	unsigned blocks_percent_used;
	FILE *mount_table;
	struct mntent *mount_entry = 0;
	struct statfs s;
	/* default display is kilobytes */
	const char *disp_units_hdr = "1k-blocks";
	int cnt = 0;
	printf("Filesystem           %-15sUsed Available Use%% Mounted on\n",
			disp_units_hdr);

	mount_table = NULL;
	mount_table = setmntent("/etc/mtab", "r");
	lua_newtable(L);
	while (1) {
		const char *device;
		const char *mount_point;

		if (mount_table) {
			mount_entry = getmntent(mount_table);
			if (!mount_entry) {
				endmntent(mount_table);
				break;
			}
		}

		device = mount_entry->mnt_fsname;
		mount_point = mount_entry->mnt_dir;

		if (statfs(mount_point, &s) != 0) {
			perror(mount_point);
			continue;
		}

		if ((s.f_blocks > 0) || !mount_table)
		{
			blocks_used = s.f_blocks - s.f_bfree;
			blocks_percent_used = 0;
			if (blocks_used + s.f_bavail)
			{
				blocks_percent_used = (blocks_used * 100ULL	+ (blocks_used + s.f_bavail) / 2 )
					/ (blocks_used + s.f_bavail);
			}
			lua_pushinteger(L, ++cnt);
	        lua_newtable(L);

			add_table_entry_int(L, "blocks", kscale(s.f_blocks, s.f_bsize));
			add_table_entry_int(L, "used", kscale(s.f_blocks-s.f_bfree, s.f_bsize));
			add_table_entry_int(L, "avail", kscale(s.f_bavail, s.f_bsize));
			add_table_entry_int(L, "percent", blocks_percent_used);
			add_table_entry(L, "device", device);
			add_table_entry(L, "mountpoint", mount_point);
			add_table_entry_int(L, "blocksize",  s.f_bsize);
			lua_settable(L, -3);

			/*printf("\n%-20s" + 1, device)
			printf(" %9lu %9lu %9lu %3u%% %s\n",
				kscale(s.f_blocks, s.f_bsize),
				kscale(s.f_blocks-s.f_bfree, s.f_bsize),
				kscale(s.f_bavail, s.f_bsize),
				blocks_percent_used, mount_point);*/
		}
	}
	return 1;
}
