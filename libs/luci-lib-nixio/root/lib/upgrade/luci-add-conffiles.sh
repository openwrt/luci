add_luci_conffiles()
{
	add_luci_conffiles_helper()
	{
		[ ! -f "$1" ] && return
		grep -q "$1" "$2" && return
		echo "$1" >> "$2"
	}

	local filelist="$1"

	# save ssl certs
	if [ -d /etc/nixio ]; then
		find /etc/nixio -type f | while read ff; do
			add_luci_conffiles_helper "$ff" "$filelist"
		done
	fi

	# save uhttpd certs
	add_luci_conffiles_helper /etc/uhttpd.key "$filelist"
	add_luci_conffiles_helper /etc/uhttpd.crt "$filelist"

	unset -f add_luci_conffiles_helper
}

sysupgrade_init_conffiles="$sysupgrade_init_conffiles add_luci_conffiles"

