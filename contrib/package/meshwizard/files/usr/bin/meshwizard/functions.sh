uci_remove_list_element() {
	local option="$1"
	local value="$2"
	local list="$(uci get $option)"
	local elem

	uci delete $option
	for elem in $list; do
		if [ "$elem" != "$value" ]; then
			uci add_list $option=$elem
		fi
	done
}

set_defaults() {
	for def in $(env |grep "^$1"); do
		option=${def/$1/}
		uci set $2.$option
		echo "    ${option/=/: }"
	done
}

# 1 argument: section to remove
section_cleanup() {
	uci -q delete $1 && msg_cleanup $1 || msg_cleanup_error $1
}

# 3 arguements: 1=config name 2=oldname 3=newname
section_rename() {
	uci -q rename $1.$2=$3 && msg_rename $1.$2 $1.$3 || msg_rename_error $1.2 $1.$3
}

msg_start() {
	echo "  Starting configuration of $1"
}

msg_cleanup() {
	echo "    Cleanup: Removed section $1."
}

msg_cleanup_error() {
	echo -e "    \033[1mWarning:\033[0m Cleanup of $1 failed."
}

msg_missing_value() {
	echo -e "    \033[1mWarning:\033[0m Configuration option for $2 is missing in $1."
}

msg_success() {
	echo "    Finished."
}

msg_error() {
	echo "    \033[1mError: \033[0mThere was a problem."
}

msg_rename() {
	echo "    Renamed unnamed section $1 to $2."
}

msg_rename_error() {
	echo "    \033[1mWarning:\033[0m Could not rename $1 to $2."
}
