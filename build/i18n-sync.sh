#!/bin/sh

for m in */*/Makefile; do
	if grep -qE '^PO *=' $m; then
		p="${m%/Makefile}"
		t="$(sed -ne 's/^PO *= *//p' $m)"

		case "$t" in
			*\ *)
				echo "WARNING: Cannot handle $p" >&2
				continue
			;;
			*base*)
				continue
			;;
		esac

		if [ -f "po/templates/$t.pot" ]; then
			./build/i18n-scan.pl "$p" > "po/templates/$t.pot"
		fi
	fi
done

./build/mkbasepot.sh
./build/i18n-update.pl po
