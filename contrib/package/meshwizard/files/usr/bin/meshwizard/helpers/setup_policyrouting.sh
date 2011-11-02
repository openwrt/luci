#!/bin/sh

. $dir/functions.sh

uci batch << EOF
	set freifunk-policyrouting.pr.enable=1
	set freifunk-policyrouting.pr.strict=1
	set freifunk-policyrouting.pr.zones="freifunk"
EOF

uci_commitverbose "Setup policyrouting" freifunk-policyrouting
