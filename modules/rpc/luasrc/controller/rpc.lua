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
module("luci.controller.rpc", package.seeall)

function index()	
	entry({"rpc", "uci"}, call("rpc_uci")).sysauth = "root"
	entry({"rpc", "auth"}, call("rpc_auth"))
end

function rpc_proxy(tbl, jsonrpc, method, params, id)
	local res = {luci.util.copcall(tbl[function], ...)}
	local stat = table.remove(res, 1)
	
	if not stat then
		return nil, {code=-32602, message="Invalid params.", data=table.remove(res, 1)} 
	else
		return res, nil
	end
end