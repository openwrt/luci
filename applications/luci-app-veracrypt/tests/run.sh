#!/bin/sh
# Tests for the luci.veracrypt rpcd backend. Runs the backend inside an
# OpenWrt rootfs (busybox, jshn, uci) with a fake veracrypt, using an
# unprivileged user+mount namespace chroot.
# Usage: tests/run.sh <openwrt-rootfs.tar.gz>
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
APP=$(dirname "$HERE")
ROOTFS_TGZ=${1:?rootfs tarball}
TR=$(mktemp -d)
trap 'rm -rf "$TR"' EXIT

tar -xzf "$ROOTFS_TGZ" -C "$TR" 2>/dev/null
mkdir -p "$TR/usr/libexec/rpcd" "$TR/mnt/usb/sub dir" "$TR/mnt/flash" "$TR/etc/config" "$TR/tmp/run"
install -m 755 "$APP/root/usr/libexec/rpcd/luci.veracrypt" "$TR/usr/libexec/rpcd/luci.veracrypt"
install -m 755 "$HERE/veracrypt-stub" "$TR/usr/bin/veracrypt"
printf "config settings 'main'\n\toption timeout '300'\n" > "$TR/etc/config/veracrypt"
: > "$TR/mnt/usb/a.hc"
: > "$TR/mnt/usb/b.hc"
: > "$TR/mnt/usb/sub dir/c d.hc"
ln -s /etc "$TR/mnt/usb/etclink"

# Run a shell snippet inside the test root.
inroot() {
	unshare -r -m sh -c '
		mount --rbind /proc "$1/proc" && mount --rbind /dev "$1/dev" &&
		mount --bind "$1/mnt/usb" "$1/mnt/usb" &&
		exec /usr/sbin/chroot "$1" /usr/bin/env PATH=/usr/sbin:/usr/bin:/sbin:/bin /bin/sh -c "$2"' sh "$TR" "$1"
}

# rpc <method> <json>
rpc() {
	printf '%s' "$2" > "$TR/tmp/req.json"
	inroot "/usr/libexec/rpcd/luci.veracrypt call $1 < /tmp/req.json"
}

# field <json> <jsonfilter expr>
field() {
	printf '%s' "$1" > "$TR/tmp/res.json"
	inroot "jsonfilter -i /tmp/res.json -e '$2'"
}

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
nok() { fail=$((fail + 1)); echo "FAIL - $1"; [ -n "${2:-}" ] && echo "       $2"; }
expect() { # expect <desc> <actual> <expected>
	if [ "$2" = "$3" ]; then ok "$1"; else nok "$1" "got '$2', want '$3'"; fi
}

# wait_job <id>: poll until the job is no longer pending, print final reply
wait_job() {
	n=0
	while [ "$n" -lt 60 ]; do
		r=$(rpc job "{\"id\":\"$1\"}")
		[ "$(field "$r" '@.pending')" = true ] || { printf '%s' "$r"; return; }
		n=$((n + 1))
		sleep 1
	done
	printf '%s' "$r"
}

# busy: a process (a job of a previous test) still runs inside the test root
busy() {
	for _p in /proc/[0-9]*; do
		[ "$(readlink "$_p/root" 2>/dev/null)" = "$TR" ] && return 0
	done
	return 1
}

# settle: wait until no job of a previous test is still running
settle() {
	n=0
	while [ "$n" -lt 60 ] && busy; do
		n=$((n + 1))
		sleep 1
	done
}

for t in "$HERE"/t-*.sh; do
	settle
	. "$t"
done

echo "# pass $pass fail $fail"
[ "$fail" = 0 ]
