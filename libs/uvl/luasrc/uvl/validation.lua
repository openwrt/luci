--[[

UCI Validation Layer - Validation helper
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module( "luci.uvl.validation", package.seeall )

require("luci.fs")
require("luci.sys")


function _exec( bin, args )
	local cmd, output = "", nil

	for _, v in ipairs({ bin, unpack(args) }) do
		cmd = cmd .. string.format("%q ",v):gsub("([%$`])","\\%1")
	end

	local tmpfile = "/tmp/uvl" .. luci.sys.uniqueid(8)
	local retval  = os.execute( cmd .. " 1>" .. tmpfile .. " 2>" .. tmpfile )

	if luci.fs.access(tmpfile) then
		output = luci.fs.readfile(tmpfile)
		luci.fs.unlink(tmpfile)
	end

	return retval, output
end

function check( self, object )
	local item = object:option()

	if item.validators then
		for _, val in ipairs(item.validators) do
			local ok, err = false, nil
			local args = {
				item.type, unpack(object.cref), item.datatype, object:value()
			}

			if type(val) == "function" then
				ok, err = val(unpack(args))
			else
				ok, err = _exec( val, args )
				ok = ( ok == 0 )
			end

			if not ok then
				return false, err
			end
		end
	end

	return true, nil
end
