#!/usr/bin/lua
-- uvl2i18n.lua - Convert uvl schemes to i18n files
-- $Id$

require("luci.util")
require("luci.uvl")

local shm = luci.uvl.UVL():get_scheme(arg[1])

for s, o in luci.util.kspairs(shm.sections) do
	print( string.format( '%s_%s = %q', shm.name, s:gsub("_",""), o.title or s ) )

	if o.description and #o.description > 0 then
		print( string.format(
			'%s_%s_desc = %q', shm.name, s:gsub("_",""), o.description
		) )
	end

	for v, o in luci.util.kspairs(shm.variables[s]) do
		print( string.format(
			'%s_%s_%s = %q', shm.name, s:gsub("_",""), v:gsub("_",""), o.title or v
		) )

		if o.description and #o.description > 0 then
			print( string.format(
				'%s_%s_%s_desc = %q', shm.name, s:gsub("_",""),
				v:gsub("_",""), o.description
			) )
		end
	end

	print()
end
