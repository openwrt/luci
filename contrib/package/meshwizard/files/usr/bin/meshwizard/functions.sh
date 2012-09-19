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

# Takes 2 arguments
# $1 = text to be displayed in the output for this section
# $2 = section (optional)
uci_commitverbose() {
	echo "+ $1"
	uci changes $2 | while read line; do
		echo "    $line"
	done
	uci commit $2
}

set_defaults() {
	for def in $(env |grep "^$1" | sed 's/ /_/g'); do
		option="${def/$1/}"
		a="$(echo $option |cut -d '=' -f1)"
		b="$(echo $option |cut -d '=' -f2-)"
		b="${b//_/ }"
		uci set $2.$a="$b"
	done
}

# 3 arguements: 1=config name 2=oldname 3=newname
section_rename() {
	uci -q rename $1.$2=$3 && msg_rename $1.$2 $1.$3 || msg_rename_error $1.$2 $1.$3
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
