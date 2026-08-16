#!/bin/sh
# Periodic driver for service-health.sh (procd instance, ~60 s cadence).
while :; do
	/usr/libexec/wificalling-gateway/service-health.sh
	sleep 60
done
