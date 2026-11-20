add_luci_statistics_conffiles()
{
	local filelist="$1"
	# get list of our files (and create a backup if needed)
	/etc/init.d/luci_statistics sysupgrade_backup $filelist
}

sysupgrade_init_conffiles="$sysupgrade_init_conffiles add_luci_statistics_conffiles"
