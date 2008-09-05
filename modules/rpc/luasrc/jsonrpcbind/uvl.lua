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

local uvl   = require "luci.uvl".UVL()
local table = require "table"

module "luci.jsonrpcbind.uvl"
_M, _PACKAGE, _NAME = nil, nil, nil


function get_scheme(...)
	return uvl:get_scheme(...)
end

function validate(...)
	return {uvl:validate(...)}
end

function validate_config(...)
	return {uvl:validate_config(...)}
end

function validate_section(...)
	return {uvl:validate_section(...)}
end

function validate_option(...)
	return {uvl:validate_option(...)}
end