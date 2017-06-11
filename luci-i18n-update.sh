#!/bin/sh

SECTION=${1}
MODULE="${2}"

NAME=""

[ -e ./luci.mk ] || {
	echo "Execute in luci feed dir" <&2
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

[ -n "${MODULE}" ] || {
	usage
}

if [ -d "./${NAME}/luci-${SECTION}-${MODULE}" ]; then
	if [ -f "./${NAME}/luci-${SECTION}-${MODULE}/po/templates/${MODULE}.pot" ]; then
		./build/i18n-update.pl "./${NAME}/luci-${SECTION}-${MODULE}/po"
	else
		echo "templates.pot of ${SECTION} \"${MODULE}\" does not exist"
		echo "run first ./luci-i18n-scan.sh ${SECTION} ${MODULE}"
		exit 1
	fi
elif [ -d "./${NAME}/luci-${MODULE}" ]; then
	if [ -f "./${NAME}/luci-${MODULE}/po/templates/${MODULE}.pot" ]; then
		./build/i18n-update.pl "./${NAME}/luci-${MODULE}/po"
	else
		echo "templates.pot of ${NAME} \"${MODULE}\" does not exist"
		echo "run first ./luci-i18n-scan.sh ${NAME} ${MODULE}"
		exit 1
	fi
else
	echo "${SECTION} \"${MODULE}\" does not exist"
	exit 1
fi
