--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local require, pairs, unpack = require, pairs, unpack
module "luci.controller.niu.system"

function index()
	entry({"niu", "system"}, nil, "System").dbtemplate = "niu/system"

	entry({"niu", "system", "general"}, 
	cbi("niu/system/general", {on_success_to={"niu"}}), "General", 10)
	
	entry({"niu", "system", "backup"}, call("backup"), "Backup Settings", 20)
end

function backup()
	local os = require "os"
	local uci = require "luci.model.uci".cursor()
	local nixio, nutl = require "nixio", require "nixio.util"
	local fs = require "nixio.fs"
	local http = require "luci.http"
	
	
	local call = {"/bin/tar", "-cz"}
	for k, v in pairs(uci:get_all("luci", "flash_keep")) do
		if k:byte() ~= 46 then	-- k[1] ~= "."
			nutl.consume(fs.glob(v), call)
		end
	end
	
	
	http.header(
		'Content-Disposition', 'attachment; filename="backup-%s-%s.tar.gz"' % {
			nixio.uname().nodename, os.date("%Y-%m-%d")
		}
	)
	http.prepare_content("application/x-targz")
	
	
	local fdin, fdout = nixio.pipe()
	local devnull = nixio.open("/dev/null", "r+")
	local proc = nixio.fork()
	
	if proc == 0 then
		fdin:close()
		nixio.dup(devnull, nixio.stdin)
		nixio.dup(devnull, nixio.stderr)
		nixio.dup(fdout, nixio.stdout)
		nixio.exec(unpack(call))
		os.exit(1)
	end
	
	fdout:close()
	http.splice(fdin)
	http.close()
end