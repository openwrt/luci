#!/bin/sh

[ -d ./build ] || {
	echo "Execute as ./build/i18n-sync.sh" >&2
	exit 1
}

[ -n "$1" ] || ./build/mkbasepot.sh

find "${1:-.}" -name '*.pot' -and -not -name base.pot | \
	while read path; do
		dir="${path%/po/templates/*}"
		echo -n "Updating ${path#./} ... "
		./build/i18n-scan.pl "$dir" > "$path"
		echo "done"
	done

if [ -n "$1" ]; then
	find "$1" -path '*/templates/*.pot' -printf '%h ' | \
		xargs -r -n 1 dirname | \
		xargs -r -n 1 ./build/i18n-update.pl
else
	./build/i18n-update.pl
fi
