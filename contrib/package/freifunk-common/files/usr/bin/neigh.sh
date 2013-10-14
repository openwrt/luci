#!/bin/sh

. /usr/share/libubox/jshn.sh

VARS="localIP:Local remoteIP:Remote validityTime:vTime linkQuality:LQ neighborLinkQuality:NLQ linkCost:Cost"

for HOST in 127.0.0.1 ::1;do
	json_init
	json_load "$(echo /links|nc ${HOST} 9090)"
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
