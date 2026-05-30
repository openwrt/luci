#!/bin/sh

PATTERN=$1
SCM=

echo $(basename "$0") "initialises po/ i18n catalogues in empty language sub-folders."
echo $(basename "$0") "is deprecated and may be removed in the future."
echo "Hint: run i18n-add-language.sh instead."

[ -d .svn ] && SCM="svn"
git=$( command -v git 2>/dev/null )
[ "$git" ] && "$git" status >/dev/null && SCM="git"

[ -z "$SCM" ] && {
	echo "Unsupported SCM tool" >&2
	exit 1
}

[ -z "$PATTERN" ] && PATTERN="*.pot"

[ "${1#luci-}" ] && {
	# user passed e.g. applications/luci-app-example - build template pot
	path="${1%/}"
	mkdir -p "$path/po/templates"
	./build/i18n-scan.pl "$1" > "$1"/po/templates/"${path##*-}".pot && echo "Created $1/po/templates/${path##*-}.pot"
	slashes="${path//[^\/]}/"  # Keep only slashes
	depth="${#slashes}"        # Get the length of the remaining string (number of slashes)
	prefix=$(printf '../%.0s' $(seq 1 "$depth"))
	pushd "$path" 2&>/dev/null || exit
	"$prefix"build/i18n-add-language.sh
}

for lang in $(cd po; echo ?? ??_??); do
	for file in $(cd po/templates; echo $PATTERN); do
		if [ -f po/templates/$file -a ! -f "po/$lang/${file%.pot}.po" ]; then
			msginit --no-translator -l "$lang" -i "po/templates/$file" -o "po/$lang/${file%.pot}.po"
			$SCM add "po/$lang/${file%.pot}.po"
		fi
	done
done

popd 2&>/dev/null|| exit