#!/bin/sh

uci -q batch <<-EOF >/dev/null
	delete ucitrack.@shadowsocks[-1]
	add ucitrack shadowsocks
	set ucitrack.@shadowsocks[-1].init=shadowsocks
	commit ucitrack
EOF

rm -f /tmp/luci-indexcache
exit 0
