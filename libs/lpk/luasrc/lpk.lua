module("luci.lpk", package.seeall)
require("luci.lpk.util")
require("luci.lpk.core")

__appname__ = "LuCI »lpk« Package Manager"
__version__ = "0.1"
__authors__ = "Steven Barth, Jo-Philipp Wich"
__cpyrght__ = string.format("Copyright (c) 2008 %s", __authors__)
 

options, arguments = luci.lpk.util.getopt(arg)
config  = luci.util.dtable()
machine = luci.lpk.core.Machine()

local cfgdump = loadfile("/etc/lpk.conf")
if cfgdump then
	setfenv(cfgdump, config)
	pcall(cfgdump)
end

if #arguments < 1 then
	luci.lpk.util.splash()
else
	local task, error = machine:task(table.remove(arguments, 1),
	 unpack(arguments))
		
	if task then
		local stat, error = task:perform()
		if not stat then
			luci.util.perror(error or task.register.errstr or "Unknown Error")
			os.exit(task.register.error or 1)
		end
	else
		luci.util.perror((error or "Unknown Error") .. "\n")
		luci.lpk.util.splash()
		os.exit(1)
	end		
end



