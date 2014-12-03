#!/bin/sh

if svn info >/dev/null 2>/dev/null; then
	if [ "${4%%/*}" = "branches" ]; then
		variant="LuCI ${4##*[-/]} Branch"
	elif [ "${4%%/*}" = "tags" ]; then
		variant="LuCI ${4##*[-/]} Release"
	else
		variant="LuCI Trunk"
	fi
elif git status >/dev/null 2>/dev/null; then
	tag="$(git describe --tags 2>/dev/null)"
	branch="$(git symbolic-ref --short -q HEAD 2>/dev/null)"

	if [ -n "$tag" ]; then
		variant="LuCI $tag Release"
	elif [ "$branch" != "master" ]; then
		variant="LuCI ${branch##*-} Branch"
	else
		variant="LuCI Master"
	fi
else
	variant="LuCI"
fi

cat <<EOF > $1
local pcall, dofile, _G = pcall, dofile, _G

module "luci.version"

if pcall(dofile, "/etc/openwrt_release") and _G.DISTRIB_DESCRIPTION then
	distname    = ""
	distversion = _G.DISTRIB_DESCRIPTION
else
	distname    = "OpenWrt"
	distversion = "Development Snapshot"
end

luciname    = "$variant"
luciversion = "${2:-Git}"
EOF
