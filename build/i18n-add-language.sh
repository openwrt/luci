#!/usr/bin/env bash

LANGS=$@
if [ "$#" -eq 0 ]; then
	echo $(basename "$0") "adds i18n catalogue(s) in po/ folders (luci-app-*, luci-mod-*, etc) for each LUCI_LANG.* in luci.mk"
	echo "Hint: run in the root of the luci repo or in your luci-app-* folder."

	# get existing language codes from luci.mk
	language_codes=$(grep -o 'LUCI_LANG\.[a-zA-Z_-]*' $(dirname "$0")/../luci.mk | cut -d '.' -f 2 | sort -u)
	LANGS=$language_codes

else
	for LANG in $LANGS; do
		case "$LANG" in
			[a-z][a-z]|[a-z][a-z][_-][A-Za-z][A-Za-z]*) : ;;
			*)
				echo $(basename "$0") "adds i18n catalogues in each folder (luci-app-*, luci-mod-*, etc)."
				echo "Usage: $(basename "$0") <ISO_CODE> [<ISO_CODE> <ISO_CODE> ...]" >&2
				exit 1
			;;
		esac
	done
fi

ADDED=false

for podir in $(find . -type d -name "po"); do
	[ -d "$podir/templates" ] || continue
	for LANG in $LANGS; do
		# if "$podir/$LANG" doesn't exist, mkdir
		[ -d "$podir/$LANG" ] || mkdir "$podir/$LANG"
		for catalog in $(cd "$podir/templates"; echo *.pot); do
			if [ -f "$podir/templates/$catalog" -a ! -f "$podir/$LANG/${catalog%.pot}.po" ]; then
				msginit --no-translator -l "$LANG" -i "$podir/templates/$catalog" -o "$podir/$LANG/${catalog%.pot}.po"
				git add "$podir/$LANG/${catalog%.pot}.po"
				ADDED=true
			fi
		done
	done
done

start_marker="^#LUCI_LANG_START$"
end_marker="^#LUCI_LANG_END$"

if [ $ADDED ]; then
	for LANG in $LANGS; do
		if [[ $language_codes != *"$LANG"* ]]; then

			# Read the contents of the luci.mk file
			file_content=$(cat "$(dirname "$0")/../luci.mk")

			# Extract the section between start and end markers
			section=$(awk -v start="$start_marker" -v end="$end_marker" '
			$0 ~ start {RS="\n"; printf ""; flag=1; next}
			$0 ~ end {flag=0} flag' <<< "$file_content")

			# Add the new language code to the section
			section+="\nLUCI_LANG.$LANG=New language"
			# Sort the section and remove duplicates
			updated_content=$(echo -e "$section" | sort -u | sed -E "/$start_marker/,/$end_marker/{ /$start_marker/{p; r /dev/stdin
			}; /$end_marker/p; d
			}" $(dirname "$0")/../luci.mk)

			# Write the updated content back to the .mk file
			echo "$updated_content" > $(dirname "$0")/../luci.mk

			echo "Be sure to update the new language name in $(dirname "$0")/../luci.mk"

		fi
	done
fi
