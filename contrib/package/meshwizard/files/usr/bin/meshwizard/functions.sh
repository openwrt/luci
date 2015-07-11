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

# string_contains(string, substring)
#
# Returns 0 if the specified string contains the specified substring,
# otherwise returns 1.
string_contains() {
    string="$1"
    substring="$2"
    if test "${string#*$substring}" != "$string"
    then
        return 0    # $substring is in $string
    else
        return 1    # $substring is not in $string
    fi
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
		string_contains "$a" "_LENGTH" && continue
		string_contains "$a" "_ITEM" && {
		    # special threatment for lists. use add_list and remove the
		    # item index (_ITEMx).
		    uci add_list $2.${a//_ITEM[0-9]*/}="$b"
		} || {
		    uci set $2.$a="$b"
		}
	done
}

# 3 arguments: 1=config name 2=oldname 3=newname
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


restore_factory_defaults() {
    echo "+ Restore default config as requested with cleanup=1"
    cp -f /rom/etc/config/* /etc/config/
    rm /etc/config/wireless
    wifi detect > /etc/config/wireless
    rm /etc/config/network
    if [ -f /etc/init.d/defconfig ]; then
        # legacy (AA)
        /etc/init.d/defconfig start
	[ -f /rom/etc/uci-defaults/network ] && sh /rom/etc/uci-defaults/network
    else
        sh /rom/etc/uci-defaults/02_network
    fi
}

is_in_list() {
    # checks if an item is in a list
    local list="$1"
    local item="$2"
    for word in $list; do
	[ $word = "$item" ] && return 0
    done
    return 1
}

add_to_list() {
    local list="$1"
    local item="$2"
    is_in_list "$list" "$item" && echo $list
    if [ -z "$list" ]; then
	echo "$item"
    else
	echo "$list $item"
    fi
}
