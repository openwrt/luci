#!/bin/sh

. /usr/share/libubox/jshn.sh

for HOST in 127.0.0.1 ::1;do
	json_init
	json_load "$(echo /links|nc ${HOST} 9090)"
	if json_is_a links array;then
		echo "LocalIP		RemoteIP	vTime	LQ		NLQ		Cost"
		json_select links
		i=1
		while json_is_a ${i} object;do
			json_select ${i}
			json_get_vars localIP remoteIP validityTime linkQuality neighborLinkQuality linkCost
			echo "${localIP}	${remoteIP}	${validityTime}	${linkQuality}	${neighborLinkQuality}	${linkCost}"
			json_select 
			i=$(( i + 1 ))
		done
	fi
	echo
done

