#!/bin/sh
# Tests for the luci.veracrypt-lite rpcd plugin. Calls the plugin with ucode
# inside an OpenWrt rootfs with a fake veracrypt, using an unprivileged
# user+mount namespace and chroot (no rpcd/ubus needed).
# Usage: tests/run.sh <openwrt-rootfs.tar.gz>
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
APP=$(dirname "$HERE")

if [ "${1:-}" != --inner ]; then
	TR=$(mktemp -d)
	trap 'rm -rf "$TR"' EXIT
	tar -xzf "${1:?rootfs tarball}" -C "$TR" 2>/dev/null
	unshare -r -m "$0" --inner "$TR"
	exit
fi
TR=$2
umask 022

install -D -m 644 "$APP/root/usr/share/rpcd/ucode/luci.veracrypt-lite" "$TR/usr/share/rpcd/ucode/luci.veracrypt-lite"
install -D -m 755 "$APP/root/usr/libexec/luci-veracrypt-lite-job" "$TR/usr/libexec/luci-veracrypt-lite-job"
install -m 755 "$HERE/veracrypt-stub" "$TR/usr/bin/veracrypt"
cat > "$TR/tmp/call.uc" <<'EOF'
// call.uc <method> [<json args>]: call one plugin method, print the reply
const methods = loadfile('/usr/share/rpcd/ucode/luci.veracrypt-lite')()['luci.veracrypt-lite'];
printf('%J\n', methods[ARGV[0]].call({ args: json(ARGV[1] ?? '{}') }));
EOF

# A fake /dev and /sys (see t-50-devices.sh); /mnt/usb is a mounted disk,
# /mnt/flash is on the root filesystem.
mount -t tmpfs -o mode=755 vctest "$TR/dev"
for n in null zero urandom; do
	touch "$TR/dev/$n" && mount --bind "/dev/$n" "$TR/dev/$n"
done
mount -t tmpfs -o mode=755 vctest "$TR/sys"
mount --rbind /proc "$TR/proc"
mkdir -p "$TR/mnt/usb" "$TR/mnt/flash" "$TR/var/run"
mount -t tmpfs -o mode=755 /dev/root "$TR/mnt/usb"

# rpc <method> [<json>]: call the plugin; VCSTUB_* variables are passed on.
rpc() {
	/usr/sbin/chroot "$TR" /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin \
		VCSTUB_DELAY="${VCSTUB_DELAY:-}" VCSTUB_PW="${VCSTUB_PW:-x}" \
		/usr/bin/ucode /tmp/call.uc "$1" "${2:-{\}}"
}

# field <json> <jsonfilter expr>
field() {
	/usr/sbin/chroot "$TR" /usr/bin/jsonfilter -s "$1" -e "$2"
}

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
nok() { fail=$((fail + 1)); echo "FAIL - $1"; [ -n "${2:-}" ] && echo "       $2"; }
expect() { # expect <desc> <actual> <expected>
	if [ "$2" = "$3" ]; then ok "$1"; else nok "$1" "got '$2', want '$3'"; fi
}
expect_error() { # expect_error <desc> <reply> <part of the message>
	case $(field "$2" '@.error') in
		*"$3"*) ok "$1" ;;
		*) nok "$1" "$2" ;;
	esac
}

# last_argv: the arguments of the last veracrypt call, joined with '|'
last_argv() {
	awk 'BEGIN { RS = "\n--\n" } { r = $0 } END { gsub("\n", "|", r); print r }' "$TR/tmp/vcstub.argv"
}

# wait_job: poll until the job has ended, print the final job reply
wait_job() {
	n=0
	while [ "$n" -lt 30 ]; do
		r=$(rpc job)
		[ "$(field "$r" '@.running')" = true ] || break
		n=$((n + 1))
		sleep 1
	done
	printf '%s' "$r"
}

for t in "$HERE"/t-*.sh; do
	rm -f "$TR"/tmp/vcstub.*
	. "$t"
	wait_job > /dev/null
done

echo "# pass $pass fail $fail"
[ "$fail" = 0 ]
