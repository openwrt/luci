#!/bin/sh
command="$1"
interval="$2"; [ -z "$interval" ] && interval=1

if [ -z $command ]; then
        echo 'Usage: watch.sh "command [options]" [interval], e.g. watch "ifconfig ath0" 2'
        echo 'interval is optional and defaults to 1'
        exit 1
fi

while true; do clear; $command; sleep $interval; done
