add_luci_conffiles()
{
	local filelist="$1"

	# save ssl certs
	if [ -d /etc/nixio ]; then
		find /etc/nixio >> $filelist
	fi
}

sysupgrade_init_conffiles="$sysupgrade_init_conffiles add_luci_conffiles"

