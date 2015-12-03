#!/bin/sh

uci -q batch <<-EOF >/dev/null
	delete ucitrack.@adkill[-1]
	add ucitrack adkill
	set ucitrack.@adkill[-1].init=adkill
	commit ucitrack
EOF

rm -f /tmp/luci-indexcache
exit 0
