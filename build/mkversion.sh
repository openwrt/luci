#!/bin/sh
if [ "${4%%/*}" = "branches" ]; then
	variant="LuCI ${4##*[-/]} Branch"
elif [ "${4%%/*}" = "tags" ]; then
	variant="LuCI ${4##*[-/]} Release"
else
	variant="LuCI Trunk"
fi

cat <<EOF > $1
local pcall, dofile, _G = pcall, dofile, _G

module "luci.version"

if pcall(dofile, "/etc/openwrt_release") and _G.DISTRIB_DESCRIPTION then
	distname    = ""
	distversion = _G.DISTRIB_DESCRIPTION
else
	distname    = "${2:-OpenWrt}"
	distversion = "${3:-Development Snapshot}"
end

luciname    = "$variant"
luciversion = "${5:-svn}"
EOF
