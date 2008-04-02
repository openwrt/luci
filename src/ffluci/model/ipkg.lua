--[[
FFLuCI - IPKG wrapper library

Description:
Wrapper for the ipkg Package manager

Any return value of false or nil can be interpreted as an error

FileId:
$Id$

License:
Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at 

	http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

]]--
module("ffluci.model.ipkg", package.seeall)
require("ffluci.sys")
require("ffluci.util")

ipkg = "ipkg"
local statuslist = nil

-- Returns repository information
function info(pkg)
	-- To be implemented
end

-- Returns a table with status information
function status(refresh)
	if not statuslist or refresh then
		statuslist = _parselist(ffluci.sys.exec(ipkg .. " status"))
	end
	
	return statuslist 
end

-- Installs a package
function install(pkg)
	if not pkg then
		return nil
	end
	
	local c = ipkg .. " install '" .. pkg:gsub("'", "") .. "' >/dev/null 2>&1"
	local r = os.execute(c)
	return (r == 0), r	
end

function installed(pkg, ...)
	local p = status(...)[pkg]
	return (p and p.Status and p.Status.installed)
end

function _parselist(rawdata)	
	if type(rawdata) ~= "string" then
		error("IPKG: Invalid rawdata given")
	end
	
	rawdata = ffluci.util.split(rawdata) 
	local data = {}
	local c = {}
	local l = nil
	
	for k, line in pairs(rawdata) do
		if line:sub(1, 1) ~= " " then
			local split = ffluci.util.split(line, ":", 1)
			local key = nil
			local val = nil
			
			if split[1] then
				key = ffluci.util.trim(split[1])
			end
			
			if split[2] then
				val = ffluci.util.trim(split[2])
			end
			
			if key and val then
				if key == "Package" then
					c = {Package = val}
					data[val] = c
				elseif key == "Status" then
					c.Status = {}
					for i, j in pairs(ffluci.util.split(val, " ")) do
						c.Status[j] = true
					end
				else
					c[key] = val
				end
				l = key
			end
		else
			-- Multi-line field
			c[l] = c[l] .. "\n" .. line:sub(2)
		end
	end
	
	return data
end