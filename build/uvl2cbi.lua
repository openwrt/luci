#!/usr/bin/lua
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

local uvl  = require "luci.uvl"
local util = require "luci.util"

if not arg[1] then
 	util.perror("Usage %s scheme_name" % arg[0])
 	os.exit(1)
end



local scheme, error = uvl.UVL():get_scheme(arg[1])

if not scheme then
	print( error:string() )
	os.exit(1)
end


print('cbimap = Map(%q, %q, %q)\n'
	% { scheme.name, scheme.title or scheme.name, scheme.description or "" } )


for sn, sv in util.kspairs(scheme.sections) do
	print('%s = cbimap:section(TypedSection, %q, %q, %q)'
		% { sn, sn, sv.title or "", sv.description or "" } )

	if not sv.named   then print('%s.anonymous = true' % sn) end
	if not sv.unique  then print('%s.addremove = true' % sn) end
	if     sv.dynamic then print('%s.dynamic = true'   % sn) end

	if sv.depends then
		for _, dep in ipairs(sv.depends) do
			print('%s:depends(%s)' % { sn, util.serialize_data(dep) } )
		end
	end

	print('')

	for vn, vv in util.kspairs(scheme.variables[sn]) do
		if not vv.type or vv.type == "variable" then
			print('%s = %s:option(%s, %q, %q, %q)'
				% { vn, sn, vv.datatype == "boolean" and "Flag" or "Value",
					vn, vv.title or "", vv.description or "" } )
		elseif vv.type == "enum" then
			print('%s = %s:option(%s, %q, %q, %q)'
				% { vn, sn, vv.multival and "MultiValue" or "ListValue",
					vn, vv.title or "", vv.description or "" } )

			for _, val in ipairs(vv.valuelist or {}) do
				print('%s:value(%q, %q)'
					% { vn, val.value, val.title or val.value } )
			end
		elseif vv.type == "list" or vv.type == "lazylist" then
			print('%s = %s:option(DynamicList, %q, %q, %q)'
				% { vn, sn, vn, vv.title or "", vv.description or "" } )
		else
			print('-- option: type(%s) ?' % { vv.type or "" } )
		end

		if     vv.default  then print('%s.default = %q'     % { vn, vv.default } ) end
		if     vv.required then print('%s.optional = false' % vn ) end
		if not vv.required then print('%s.rmempty = true'   % vn ) end

		for _, dep in ipairs(vv.depends or {}) do
			print('%s:depends(%s)' % { vn, util.serialize_data(dep) } )
		end

		print('')
	end

	print('\nreturn cbimap')
end
