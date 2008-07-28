module("luci.lpk", package.seeall)
require("luci.lpk.util")
require("luci.lpk.core")

__appname__ = "LuCI »lpk« Package Manager"
__version__ = "0.1"
__authors__ = "Steven Barth, Jo-Philipp Wich"
__cpyrght__ = string.format("Copyright (c) 2008 %s", __authors__)
__welcome__ = string.format("%s v%s\n%s",
 __appname__, __version__, __cpyrght__)
 

options, arguments = luci.lpk.util.getopt(arg)
config = luci.util.dtable()

local cfgdump = loadfile("/etc/lpk.conf")
if cfgdump then
	setfenv(cfgdump, config)
	pcall(cfgdump)
end

if #arguments < 1 then
	print(__welcome__)
	print([[
	
Usage:
 lpk [options] <command> [arguments]
 lpk [options] install|remove pkg1 [pkg2] [...] [pkgn]

Commands:
 install	-	Install packages
 remove		-	Remove packages
 purge		-	Remove packages and their configuration files
 
Options:
 --force-depends	-	Ignore unresolvable dependencies
]])
else
	-- Start machine
end



