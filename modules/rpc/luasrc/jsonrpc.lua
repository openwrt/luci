--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.jsonrpc", package.seeall)

function resolve(mod, method)
	local path = luci.util.split(value, ".")
	
	for j=1, #path-1 do
		if not type(mod) == "table" then
			break
		end
		mod = mod[path[j]]
		if not mod then
			break
		end
	end
	mod = type(mod) == "table" and mod[path[#path]] or nil
	if type(mod) == "function" then
		return mod
	end
end

function handle(tbl, rawdata)
	local stat, json = luci.util.copcall(luci.json.Decode, rawdata)
	local response
	local success = false
	
	if stat then
		if type(json.method) == "string"
		 and (not json.params or type(json.params) == "table") then
			if tbl[json.method] then
				response = reply(json.jsonrpc, json.id,
				 proxy(resolve(tbl, json.method), unpack(json.params)))
			else
		 		response = reply(json.jsonrpc, json.id,
			 	 nil, {code=-32601, message="Method not found."})
			end
		else
			response = reply(json.jsonrpc, json.id,
			 nil, {code=-32600, message="Invalid request."})
		end
	else
		response = reply(json.jsonrpc, nil,
		 nil, {code=-32700, message="Parse error."})
	end

	return luci.json.Encode(response)
end

function reply(jsonrpc, id, res, err)
	require "luci.json"
	id = id or luci.json.Null
	
	-- 1.0 compatibility
	if jsonrpc ~= "2.0" then
		jsonrpc = nil
		res = res or luci.json.Null
		err = err or luci.json.Null
	end
	
	return {id=id, result=res, error=err, jsonrpc=jsonrpc}
end

function proxy(method, ...)
	local res = {luci.util.copcall(method, unpack(params))}
	local stat = table.remove(res, 1)
	
	if not stat then
		return nil, {code=-32602, message="Invalid params.", data=table.remove(res, 1)} 
	else
		return (#res <= 1) and res[1] or res
	end
end