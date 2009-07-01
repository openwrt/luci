platform_check_image() {
	[ "$ARGC" -gt 1 ] && return 1

	case "$(get_magic_word "$1")" in
		# Freifunk .img files
		4646)
			local kern_name=$(dd if="$1" bs=2 skip=5 count=8 2>/dev/null); kern_name="${kern_name%% *}"
			local root_name=$(dd if="$1" bs=2 skip=17 count=8 2>/dev/null); root_name="${root_name%% *}"

			if grep -q '"'$kern_name'"' /proc/mtd && grep -q '"'$root_name'"' /proc/mtd; then
				return 0
			else
				echo "Invalid image. Missing the '$kern_name' or '$root_name' partition"
				return 1
			fi
		;;
		*)
			echo "Invalid image. Use combined .img files on this platform"
			return 1
		;;
	esac
}

platform_do_upgrade() {
	local kern_length=$((0x$(dd if="$1" bs=2 skip=1 count=4 2>/dev/null)/65536))
	local kern_name=$(dd if="$1" bs=2 skip=5 count=8 2>/dev/null); kern_name="${kern_name%% *}"
	local root_length=$((0x$(dd if="$1" bs=2 skip=13 count=4 2>/dev/null)/65536))
	local root_name=$(dd if="$1" bs=2 skip=17 count=8 2>/dev/null); root_name="${root_name%% *}"

	if grep -q '"'$kern_name'"' /proc/mtd && grep -q '"'$root_name'"' /proc/mtd; then
		local append=""
		[ -f "$CONF_TAR" -a "$SAVE_CONFIG" -eq 1 ] && append="-j $CONF_TAR"

		if [ -n "$kern_name" -a -n "$root_name" ] && \
		   [ ${kern_length:-0} -gt 0 -a ${root_length:-0} -gt ${kern_length:-0} ];
		then
			dd if="$1" bs=65536 skip=1 count=$kern_length 2>/dev/null | \
				mtd -e $kern_name write - $kern_name

			dd if="$1" bs=65536 skip=$((1+$kern_length)) count=$root_length 2>/dev/null | \
				mtd -e $root_name $append write - $root_name
		fi
	fi
}
