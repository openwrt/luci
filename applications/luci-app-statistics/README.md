# Backups

The backup scheme implemented in `/etc/init.d/luci_statistics` aims to
limit writes to stable storage, to preserve flash memory lifetime.
(Flash-memory based routers may have limited lifetime of write cycles,
we want to conserve those.)  While it would be simpler to run a periodic
backup as a cron job, you'd risk wearing out the flash memory.  This
scheme only writes backups to flash during shutdowns/reboots and
upgrades.

The backup is only enabled if the administrator sets
`luci_statistics.collectd_rrdtool.backup=1`.

We only want to restore a sysupgrade backup file if:

1. It was installed by `sysupgrade -r` (restore configuration files), and
   we have rebooted.  In this case, there is an orderly shutdown that calls
   the shutdown methods.  We do not want to overwrite the
   restored sysupgrade backup file during shutdown, but after reboot we
   do want to restore it.

1. It was generated during a true sysupgrade, and we are rebooting into
   the new image: `sysupgrade` with any or none of `-o`, `-c`, `-f`,
   `-u`, resulting in a new image being installed and a config file
   being preserved for processing after reboot.  In this case we do not
   want to overwrite the backup while rebooting during the upgrade.
   `sysupgrade` in this case stores a `.tgz` archive of all preserved
   files where it can be found after rebooting into the new image, and
   it does not run the shutdown scripts before rebooting.

When the administrator runs `sysupgrade -b` (command line or LuCI), we
create a sysupgrade backup file and it is included in the combined
backup.  Then the system continues running.  When we later stop or
restart or reboot (orderly conditions, when
`/etc/init.d/luci_statistics` is called to shut down), we do not want to
use the saved sysupgrade backup.  If we had a control path after
`sysupgrade -b` that would allow us to remove the sysupgrade backup, this
would be simple.  But we don't!

What we *can* do is arrange that a sysupgrade backup contains enough
information to indicate if it should be restored.

1. True sysupgrade is straightforward: we arrange that the backed-up
   file list only includes the sysupgrade backup file and one twin file
   (see below).  The next starting of `/etc/init.d/luci_statistics`
   after a sysupgrade will restore the sysupgrade backup.

1. Continued system operation after `sysupgrade -b`: next time we stop the
   service (during reboot or during other init script actions), we check
   for a stale sysupgrade backup, and if we detect it we remove it.

1. `sysupgrade -r` only unpacks the backup files, it does not erase
   other non-backed-up files still in the overlay.  Its intended use is
   to then immediately reboot, which will run an orderly shutdown/normal
   backup.  We must ensure the orderly shutdown in this case preserves
   the sysupgrade backup, unlike the previous case.

To implement these cases, we use a pair of twinned files, only one of
which is included in the list of files preserved by sysupgrade.  If we
detect mismatched files (or only one file present) during service
shutdown or startup, we trust that the sysupgrade backup should be kept
and restored.  If the files are matched, that indicates that we have not
restored files since the sysupgrade backup, and the current normal
backup should be used instead.

## During sysupgrade backup

`/etc/init.d/luci_statistics sysupgrade_backup` is invoked by sysupgrade
for true upgrade or for the `-l` or `-b` flags.  We detect the list flag
(`-l`) by checking the process environment, and if found, we only
generate a list: we don't actually do a backup.  For all cases, we edit
the list of files listed already and remove any other mentions of
`/etc/luci_statistics` to ensure that only the backup file and one of
the twin files is in the backup list.

## During sysupgrade

During a true sysupgrade, only the sysupgrade backup file and one of the
twin files is restored after the image reboots, so the first running of
startup scripting will restore the sysupgrade backup.  This could be at
the time of first boot, if the image has been built to include this
package, or it could be later when the package is downloaded, installed,
and the service is started.

## During backup (including orderly shutdown)

During backup (run during shutdown), if there is a matched set of twins,
then we know that sometime since the last service start the
administrator ran `sysupgrade -b` and had the chance to copy the
resulting backup.  We can now erase the twins and the sysupgrade backup.

If there is a mismatched set of twins, then someone restored a backup
such as with `sysupgrade -r` and we should now be rebooting, so we
should leave the sysupgrade files alone to be processed on service
restart (after reboot).

If someone takes a `sysupgrade -b` backup and then restores it before
they reboot or restart statistics, the twins will still match, and we
then don't keep the statistics from the restored backup, we instead take
a new backup from current data and use that on reboot.

## During startup

If there are matched twin files (the normal case for shutdown/reboot
without sysupgrade), then the sysupgrade backup is ignored and the
regular backup is restored.  If there are mismatched twin files, then
the sysupgrade backup is restored.

## During disorderly reboot

In a system crash or other disorderly reboot, the shutdown scripts do
not run.  What remains on the system is the previous contents of
`/etc/luci_statistics`.

* If the system never started luci_statistics, or it was cleanly shut
  down before the crash, then there is no difference in behavior from
  normal startup: we restore either the sysupgrade backup (if
  luci_statistics had never run) or the regular backup (if
  luci_statistics was cleanly stopped)

* If luci_statistics and collectd were running at the time of the crash,
  there could be a regular backup and a sysupgrade backup present, plus
  volatile data in /tmp (which are lost in the crash).  The regular
  backup would be from the most recent time the system cleanly stopped
  luci_statistics.  During the subsequent reboot/service start up:

  * If there is a sysupgrade backup on disk from having run `sysupgrade
    -b`, with both twin files matching (meaning the administrator had
    taken a backup sometime during the life of the system, before the
    crash), they are ignored and a regular backup (if any) is restored.

  * If the sysupgrade backup has mismatched twin files or only one twin,
	then it is used to restore state.  This would be the case if a
	sysupgrade restored configuration (`sysupgrade -r`), whether or not
	it did an orderly shutdown/reboot, or if the file system were
	damaged in a crash and only one of the twin files survived.
