#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
set -eu

if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' 'Run as root, for example: sudo sh install-server.sh' >&2
    exit 1
fi

if [ ! -r /etc/os-release ]; then
    printf '%s\n' 'Cannot determine Linux distribution.' >&2
    exit 1
fi
. /etc/os-release
case "${ID:-}" in
    debian|ubuntu) ;;
    *)
        printf 'Unsupported distribution: %s. Use Debian or Ubuntu.\n' "${ID:-unknown}" >&2
        exit 1
        ;;
esac

set --
for package in openssh-server iproute2 nftables iptables python3; do
    status=$(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || :)
    if [ "$status" != 'install ok installed' ]; then
        set -- "$@" "$package"
    fi
done

if [ "$#" -gt 0 ]; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=120 install -y --no-install-recommends "$@"
fi

dpkg-query -W -f='${Package} ${Version}\n' openssh-server iproute2 nftables iptables python3
if [ ! -c /dev/net/tun ]; then
    printf '%s\n' 'Packages are installed. The kernel or hosting provider must enable /dev/net/tun.' >&2
    exit 1
fi
if ! ( : <> /dev/net/tun ); then
    printf '%s\n' 'Packages are installed, but this environment does not allow opening /dev/net/tun.' >&2
    exit 1
fi
install -d -m 0755 /usr/local/libexec
target=/usr/local/libexec/ssh-tunnel-vpn
temporary=$(mktemp "$target.XXXXXX")
trap 'rm -f "$temporary"' EXIT
cat > "$temporary" <<'PYTHON'
#!/usr/bin/python3
"""Carry framed IPv4 packets over an authenticated SSH exec channel."""
import fcntl
import json
import os
import select
import signal
import struct
import subprocess
import sys
import time

DEVICE = "sshvpn0"
TABLE = "ssh_tunnel_vpn"
CLIENT = bytes([172, 31, 255, 2])
MAX_PACKET = 1420


def command(*args, **kwargs):
    return subprocess.run(args, check=True, stdout=subprocess.DEVNULL, **kwargs)


def write_all(fd, data):
    view = memoryview(data)
    while view:
        view = view[os.write(fd, view):]


def forward(tun):
    pending = bytearray()
    write_all(1, b"SSHVPN1\n")
    while True:
        ready, _, _ = select.select([0, tun], [], [])
        if 0 in ready:
            incoming = os.read(0, 16384)
            if not incoming:
                return
            pending.extend(incoming)
            while len(pending) >= 2:
                length = int.from_bytes(pending[:2], "big")
                if not 20 <= length <= MAX_PACKET:
                    raise ValueError("invalid IPv4 frame length")
                if len(pending) < length + 2:
                    break
                packet = pending[2:length + 2]
                del pending[:length + 2]
                if packet[0] >> 4 != 4 or packet[12:16] != CLIENT:
                    continue
                if os.write(tun, packet) != length:
                    raise OSError("short write to TUN")
        if tun in ready:
            packet = os.read(tun, MAX_PACKET)
            if not packet:
                return
            if len(packet) < 20 or packet[0] >> 4 != 4 or packet[16:20] != CLIENT:
                continue
            write_all(1, len(packet).to_bytes(2, "big") + packet)


def acquire_vpn_lock(lock):
    deadline = time.monotonic() + 8
    while True:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return
        except BlockingIOError as error:
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    "Another System VPN session still holds the server interface. "
                    "Disconnect it or wait for it to close, then reconnect."
                ) from error
            # SSH stdin reaches EOF if the waiting connection closes.
            ready, _, _ = select.select([0], [], [], 0.25)
            if ready:
                raise RuntimeError("SSH channel closed before the VPN started.")


def main():
    if os.geteuid() != 0 or len(sys.argv) != 1:
        raise RuntimeError("ssh-tunnel-vpn requires root and takes no arguments")
    if open("/proc/sys/net/ipv4/ip_forward", encoding="ascii").read().strip() != "1":
        raise RuntimeError("IPv4 forwarding is disabled. Run install-server.sh.")
    for sig in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: sys.exit(0))
    with open("/run/ssh-tunnel-vpn.lock", "a", encoding="ascii") as lock:
        acquire_vpn_lock(lock)
        uplink = json.loads(subprocess.check_output(
            ["ip", "-j", "-4", "route", "get", "1.1.1.1"]
        ))[0]["dev"]
        tun = os.open("/dev/net/tun", os.O_RDWR | os.O_CLOEXEC)
        table_created = False
        filters = []
        try:
            fcntl.ioctl(tun, 0x400454CA, struct.pack("16sH22x", DEVICE.encode(), 0x1001))
            command("ip", "-4", "address", "add", "172.31.255.1/30", "dev", DEVICE)
            command("ip", "link", "set", DEVICE, "mtu", str(MAX_PACKET), "up")
            command("nft", "create", "table", "ip", TABLE)
            table_created = True
            rules = f"""
                add chain ip {TABLE} postrouting {{ type nat hook postrouting priority srcnat; }}
                add rule ip {TABLE} postrouting iifname "{DEVICE}" oifname {json.dumps(uplink)} ip saddr 172.31.255.2 masquerade
            """
            command("nft", "-f", "-", input=rules.encode())
            for rule in (
                ["-i", DEVICE, "-o", uplink, "-s", "172.31.255.2/32",
                 "--ctstate", "NEW,ESTABLISHED,RELATED"],
                ["-i", uplink, "-o", DEVICE, "-d", "172.31.255.2/32",
                 "--ctstate", "ESTABLISHED,RELATED"],
            ):
                match = rule[:-2] + ["-m", "conntrack"] + rule[-2:]
                match += ["-m", "comment", "--comment", TABLE, "-j", "ACCEPT"]
                command("iptables", "-w", "-I", "FORWARD", "1", *match)
                filters.append(match)
            forward(tun)
        finally:
            try:
                for match in reversed(filters):
                    subprocess.run(["iptables", "-w", "-D", "FORWARD", *match], check=False)
                if table_created:
                    command("nft", "delete", "table", "ip", TABLE)
            finally:
                os.close(tun)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"SSH Tunnel VPN: {error}", file=sys.stderr)
        sys.exit(1)
PYTHON
chmod 0755 "$temporary"
mv -f "$temporary" "$target"
printf '%s\n' 'net.ipv4.ip_forward = 1' > /etc/sysctl.d/91-ssh-tunnel-vpn.conf
sysctl -w net.ipv4.ip_forward=1
install -d -m 0755 /var/lib/ssh-tunnel-vpn
touch /var/lib/ssh-tunnel-vpn/installed-v2
printf '%s\n' "VPN handler installed at $target."
