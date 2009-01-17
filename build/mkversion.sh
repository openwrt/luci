#!/bin/sh

local variant

if [ "${4%%/*}" = "branches" ]; then
	variant="LuCI ${4##*[-/]} Branch"
elif [ "${4%%/*}" = "tags" ]; then
	variant="LuCI ${4##*[-/]} Release"
else
	variant="LuCI Trunk"
fi

cat <<EOF > $1
module "luci.version"

distname    = "${2:-OpenWrt}"
distversion = "${3:-Development Snapshot}"

luciname    = "$variant"
luciversion = "${5:-svn}"
EOF
