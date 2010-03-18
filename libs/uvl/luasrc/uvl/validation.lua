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

local os = require "os"
local fs = require "nixio.fs"
local sys = require "luci.sys"
local ERR = require "luci.uvl.errors".error

local ipairs, unpack, type, tostring = ipairs, unpack, type, tostring

module "luci.uvl.validation"

function _exec( bin, args )
	local cmd, output = "", nil

	for _, v in ipairs({ bin, unpack(args) }) do
		cmd = cmd .. ("%q " % v):gsub("([%$`])","\\%1")
	end

	local tmpfile = "/tmp/uvl" .. sys.uniqueid(8)
	local retval  = os.execute( cmd .. " 1>" .. tmpfile .. " 2>" .. tmpfile )

	if fs.access(tmpfile) then
		output = fs.readfile(tmpfile)
		fs.unlink(tmpfile)
	end

	return retval, output
end

function check( self, object )
	if object:scheme('validators') then
		for _, val in ipairs(object:scheme('validators')) do
			local ok, err = false, nil

			local values = object:value()
			      values = type(values) == "table" and values or { values }

			local args = {
				object:scheme('type'), object:scheme('datatype'),
				object.cref[1], object.cref[2], object.cref[3] or '',
				unpack(values)
			}

			if type(val) == "function" then
				ok, err = val(unpack(args))
			else
				ok, err = _exec( val, args )
				ok = ( ok == 0 )
			end

			if not ok then
				return false, ERR('SME_ERRVAL', object, {tostring(val), err})
			end
		end
	end

	return true, nil
end
