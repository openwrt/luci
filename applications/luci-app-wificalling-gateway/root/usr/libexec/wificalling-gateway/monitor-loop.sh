#!/bin/sh
clients=$1; output=$2; nodes=$3; node_output=$4; events=$5; state=$6; event_interval=${7:-60}; max_events=${8:-20}; log_enabled=${9:-1}; tick=0
while :; do
	/usr/libexec/wificalling-gateway/passwall-bypass.sh ensure "$clients"
	/usr/libexec/wificalling-gateway/monitor.sh "$clients" /proc/net/nf_conntrack "$output" "$state" "$events" "$event_interval" "$max_events" "$log_enabled"
	if [ "$tick" -eq 0 ]; then
		/usr/libexec/wificalling-gateway/node-health.sh "$nodes" "$node_output"
	fi
	tick=$(( (tick + 1) % 6 ))
	sleep 5
done
