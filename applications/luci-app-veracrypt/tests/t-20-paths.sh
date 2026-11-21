# All filesystem paths are confined to /mnt/<name>/... (or a disk device).
inroot 'rm -f /tmp/vcstub.state'

run_err() { # run_err <json>: error text of a run call ("" if it started)
	r=$(rpc run "$1")
	if [ "$(field "$r" '@.ok')" = true ]; then
		j=$(field "$r" '@.job')
		[ -n "$j" ] && wait_job "$j" >/dev/null
		echo ""
	else
		field "$r" '@.error'
	fi
}
denied() { # denied <desc> <json> [expected error text]
	e=$(run_err "$2")
	if [ -z "$e" ]; then
		nok "denied: $1" "call was accepted"
	elif [ -n "${3:-}" ] && case $e in *"$3"*) false ;; *) true ;; esac; then
		nok "denied: $1" "error was: $e"
	else
		ok "denied: $1"
	fi
}
allowed() { # allowed <desc> <json>
	e=$(run_err "$2")
	[ -z "$e" ] && ok "allowed: $1" || nok "allowed: $1" "$e"
}

denied "mount volume from /etc" '{"action":"mount","volume":"/etc/passwd","mountpoint":"/mnt/A","password":"x"}'
denied "mount on /etc" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/etc","password":"x"}'
denied "mount on /overlay/upper" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/overlay/upper","password":"x"}'
denied "mount on /root" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/root","password":"x"}'
denied "mount on /mnt itself" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt","password":"x"}'
denied "mount through a /mnt symlink to /etc" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/usb/etclink/x","password":"x"}'
denied "volume on router flash" '{"action":"mount","volume":"/dev/mtdblock0","mountpoint":"/mnt/A","password":"x"}'
denied "volume with .. escape" '{"action":"mount","volume":"/mnt/usb/../../etc/passwd","mountpoint":"/mnt/A","password":"x"}'
denied "create container in /root" '{"action":"create","volume":"/root/x.hc","size":"1M","password":"x"}'
denied "create keyfile in /etc" '{"action":"create-keyfile","volume":"/etc/k"}'
denied "header backup to /etc" '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/etc/hdr","password":"x"}'
denied "keyfile list with /etc/shadow" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","keyfiles":"/mnt/usb/b.hc,/etc/shadow"}'
denied "relative keyfile" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","keyfiles":"usb/b.hc"}'
denied "token library outside /usr/lib" '{"action":"list-token-keyfiles","token_lib":"/tmp/evil.so"}'

allowed "mount /mnt/usb/a.hc on /mnt/A" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x"}'
allowed "keyfiles under /mnt, token path and ,, escape" '{"action":"mount","volume":"/mnt/usb/b.hc","mountpoint":"/mnt/B","password":"x","keyfiles":"/mnt/usb/k,,1,token://slot/1/file/k"}'
allowed "create keyfile under /mnt" '{"action":"create-keyfile","volume":"/mnt/usb/new.key"}'
lib=$(inroot 'ls /usr/lib/*.so* 2>/dev/null | head -n1')
printf '1\t/mnt/usb/a.hc\t/dev/loop1\t/mnt/A1\n' > "$TR/tmp/vcstub.state"
allowed "token library under /usr/lib ($lib)" "{\"action\":\"volume-properties\",\"volume\":\"/mnt/usb/a.hc\",\"token_lib\":\"$lib\"}"
rm -f "$TR/tmp/vcstub.state"

r=$(rpc listdir '{"path":"/"}');           expect "listdir / refused" "$(field "$r" '@.ok')" false
r=$(rpc listdir '{"path":"/etc"}');        expect "listdir /etc refused" "$(field "$r" '@.ok')" false
r=$(rpc listdir '{"path":"/mnt/usb/etclink"}'); expect "listdir via symlink to /etc refused" "$(field "$r" '@.ok')" false
r=$(rpc listdir '{"path":"/mnt"}');        expect "listdir /mnt allowed" "$(field "$r" '@.ok')" true
expect "listdir /mnt has no .. entry" "$(field "$r" '@.entries[@.name=".."].name')" ""
r=$(rpc listdir '{"path":"/mnt/usb/sub dir/"}'); expect "listdir path with space and trailing slash" "$(field "$r" '@.path')" "/mnt/usb/sub dir"

# listdev offers disks and partitions only, never flash, loop or mapper nodes.
mkdir -p "$TR/sys"
printf '{}' > "$TR/tmp/req.json"
r=$(unshare -r -m sh -c 'mount --rbind /proc "$1/proc" && mount --rbind /dev "$1/dev" && mount --rbind /sys "$1/sys" &&
	exec /usr/sbin/chroot "$1" /usr/libexec/rpcd/luci.veracrypt call listdev < "$1/tmp/req.json"' sh "$TR")
case $r in
	*'"/dev/loop'*|*'"/dev/dm-'*|*'"/dev/mtd'*|*'"/dev/ubi'*|*'/dev/mapper'*) nok "listdev offers only disks" "$r" ;;
	*'"ok": true'*) ok "listdev offers only disks" ;;
	*) nok "listdev offers only disks" "$r" ;;
esac

# New files go on a mounted disk (/mnt/usb is a mount here), never into a
# plain /mnt directory on the router's flash.
denied "create container on router flash" '{"action":"create","volume":"/mnt/flash/x.hc","size":"1M","password":"x"}'
denied "create keyfile on router flash" '{"action":"create-keyfile","volume":"/mnt/flash/k"}'
denied "header backup to router flash" '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/flash/h.bak","password":"x"}'
allowed "mount on a mountpoint directory on flash" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/FlashVol","password":"x"}'
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/a.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null

# A single backslash is refused too: awk -v would expand \t in such a path.
denied "mountpoint with a single backslash" '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/usb/a\\tb","password":"x"}'
denied "volume with a single backslash" '{"action":"mount","volume":"/mnt/usb/a\\b.hc","mountpoint":"/mnt/A","password":"x"}'
