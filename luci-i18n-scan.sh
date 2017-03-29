#!/bin/sh

SECTION=${1}
MODULE="${2}"
LANGUAGES="ca cs de el en es fr he hu it ja ms no pl pt-br pt ro ru sk sv tr uk vi zh-cn zh-tw"

NAME=""

[ -e ./luci.mk ] || {
	echo "Execute in feed dir" <&2
	exit 1
}

usage(){
	echo "Usage: ./$(basename $0) [app|proto|theme|modules] [module]"
	echo "          module: asterisk mmc-over-gpio ..."
	exit 1
}

[ -n "${SECTION}" ] || {
	usage
}

case ${SECTION} in
	proto)
		NAME="protocols"
		;;
	app)
		NAME="applications"
		;;
	theme)
		NAME="themes"
		;;
	modules)
		NAME="modules"
		;;
	*)
		usage
		;;
esac

[ "${MODULE}" = "base" ] || {
	[ -n "${MODULE}" ] || {
		usage
	}
}

if [ -d "./${NAME}/luci-${SECTION}-${MODULE}" ]; then
	if [ -d "./${NAME}/luci-${SECTION}-${MODULE}/luasrc" ]; then
		mkdir -p "./${NAME}/luci-${SECTION}-${MODULE}/po/templates"
		./build/i18n-scan.pl "./${NAME}/luci-${SECTION}-${MODULE}/luasrc" > "./${NAME}/luci-${SECTION}-${MODULE}/po/templates/${MODULE}.pot"
		echo "Scan source to update template file for ${SECTION} ${MODULE} module"
		for language in ${LANGUAGES}; do
			[ -d "./${NAME}/luci-${SECTION}-${MODULE}/po/${language}" ] || {
				mkdir -p "./${NAME}/luci-${SECTION}-${MODULE}/po/${language}"
				touch "./${NAME}/luci-${SECTION}-${MODULE}/po/${language}/${MODULE}.po"
				echo "Add language ${language} to ${SECTION} ${MODULE} module"
			}
		done
	else
		echo "\"./${NAME}/luci-${SECTION}-${MODULE}/luasrc\" does not exist"
		exit 1
	fi
elif [ -d "./${NAME}/luci-${MODULE}" ]; then
	if [ -d "./${NAME}/luci-${MODULE}/luasrc" ]; then
		mkdir -p "./${NAME}/luci-${MODULE}/po/templates"
		./build/i18n-scan.pl "./${NAME}/luci-${MODULE}/luasrc" > "./${NAME}/luci-${MODULE}/po/templates/${MODULE}.pot"
		echo "Scan source to update template file for ${MODULE} module"

		for language in ${LANGUAGES}; do
			[ -d "./${NAME}/luci-${MODULE}/po/${language}" ] || {
				mkdir -p "./${NAME}/luci-${MODULE}/po/${language}"
				touch "./${NAME}/luci-${MODULE}/po/${language}/${MODULE}.po"
				echo "Add language ${language} to ${MODULE} module"
			}
		done
	else
		echo "\"./${NAME}/luci-${MODULE}/luasrc\" does not exist"
		exit 1
	fi

else
	echo "${SECTION} \"${MODULE}\" src does not exist or"
	exit 1
fi
