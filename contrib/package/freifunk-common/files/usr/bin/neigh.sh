#!/bin/sh

. /usr/share/libubox/jshn.sh

hostsfile_getname()
{
	local config="$1"
	local i=0
	local value file

	while value="$( uci -q get $config.@LoadPlugin[$i].library )"; do {
		case "$value" in
			'olsrd_nameservice'*)
				file="$( uci -q get $config.@LoadPlugin[$i].hosts_file )"
				break
			;;
		esac

		i=$(( i + 1 ))
	} done

	echo "${file:-/var/run/hosts_olsr}"
}

read_hostnames()
{
	local file_list=" $( hostsfile_getname 'olsrd' ) $(hostsfile_getname 'olsrd6' ) "
	local line ip hostname file file_list_uniq

	for file in $file_list; do {
		case " $file_list_uniq " in
			*" $file "*)
			;;
			*)
				file_list_uniq="$file_list_uniq $file"
			;;
		esac
	} done

	for file in $file_list_uniq; do {
		[ -e "$file" ] || continue

		while read -r line; do {
			case "$line" in
				[0-9]*)
					# 2001:bf7:820:901::1 stuttgarter-core.olsr   # myself
					# 10.63.160.161  AlexLaterne    # 10.63.160.161
					set -f
					set +f -- $line
					ip="$1"
					hostname="$2"

					# global vars, e.g.
					# IP_1_2_3_4='foo' or IP_2001_bf7_820_901__1='bar'
					eval IP_${ip//[.:]/_}="$hostname"
				;;
			esac
		} done <"$file"
	} done
}

read_hostnames

VARS='localIP:Local remoteIP:Remote validityTime:vTime linkQuality:LQ'
VARS="$VARS neighborLinkQuality:NLQ linkCost:Cost remoteHostname:Host"

for HOST in '127.0.0.1' '::1';do
	json_init
	json_load "$( echo /links | nc $HOST 9090 | sed -n '/^[}{ ]/p' )"	# remove header/non-json

	if json_is_a links array;then
		json_select links
		for v in ${VARS};do
			eval _${v%:*}=0
		done
		for j in 0 1;do
			case ${j} in 1)
				for v in ${VARS};do
					eval printf \"%-\${_${v%:*}}s \" ${v#*:}
				done
				echo
			;;esac
			i=1;while json_is_a ${i} object;do
				json_select ${i}
				json_get_vars $(for v in ${VARS};do echo ${v%:*};done)
				case ${j} in 0)
					for v in ${VARS};do
						eval "test \${_${v%:*}} -lt \${#${v%:*}} && _${v%:*}=\${#${v%:*}}"
					done
				;;*)
					for v in ${VARS};do
						eval printf \"%-\${_${v%:*}}s \" \$${v%:*}
						eval remoteHostname="\$IP_${remoteIP//[.:]/_}"
					done
					echo
				;;esac
				json_select ..
				i=$(( i + 1 ))
			done
		done
	fi
	echo
done
