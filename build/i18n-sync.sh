#!/bin/sh

print_help() {	
	echo "Execute as ./build/i18n-sync.sh [-b]" >&2
	echo "Or run as: ./build/i18n-sync.sh [-b] [module folder e.g. applications/luci-app-example]" >&2
	echo "Options:"
	echo "	-b: Generate the base .pot file ( invokes ./build/mkbasepot.sh )"
}

[ -d ./build ] || {
	print_help
	exit 1
}

case $1 in
	-h | --help )
		print_help
		exit 0
		;;
	-b )
		./build/mkbasepot.sh
		shift
		;;
esac

[ -n "$1" ] && set -- "${1%/}"

[ -n "$1" ] || ./build/mkbasepot.sh

# Absent a [folder] parameter, use the current path
find "${1:-.}" -name '*.pot' -and -not -name base.pot | sort | \
    xargs -P 10 -I{} sh -c '
        dir="${1%/po/templates/*}"
        echo "Updating ${1#./} ... "
        ./build/i18n-scan.pl "$dir" > "$1"
        echo "done"
    ' sh {}

	# while read path; do
	# 	dir="${path%/po/templates/*}"
	# 	echo "Updating ${path#./} ... "
	# 	# Scan for strings in a directory and stash them in the .pot file:
	# 	./build/i18n-scan.pl "$dir" > "$path"
	# 	echo "done"
	# done


if [ -n "$1" ]; then
	if [ "$(uname)" = "Darwin" ] || [ "$(uname)" = "FreeBSD" ]; then
	    # macOS-specific commands
	    find "$1" -path '*/templates/*.pot' -print0 | xargs -0r stat -f '%N' | \
	    	xargs -r -n 1 dirname | \
	    	xargs -r -n 1 dirname | sort | \
	    	xargs -r -n 1 -P 40 ./build/i18n-update.pl
	elif [ "$(uname)" = "Linux" ]; then
	    # Linux-specific commands
		find "$1" -path '*/templates/*.pot' -printf '%h ' | \
			xargs -r -n 1 dirname | \
			xargs -r -n 1 -P 40 ./build/i18n-update.pl
	# elif [ "$(uname)" = "SunOS" ]; then
	# 	# Solaris-specific commands
	else
		# GNU specific commands can go here:
		find "$1" -path '*/templates/*.pot' -printf '%h ' | \
			xargs -r -n 1 dirname | \
			xargs -r -n 1 -P 40 ./build/i18n-update.pl
	fi
else
	# this performs operations on all .po files
	./build/i18n-update.pl
fi
