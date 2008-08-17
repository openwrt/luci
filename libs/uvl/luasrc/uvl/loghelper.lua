--[[

UCI Validation Layer - Logging utilities
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module( "luci.uvl.loghelper", package.seeall )

function config_error( config, message )
	return string.format(
		'Error in config "%s":\n%s',
			config, message or "Unknown error"
	)
end

function section_error( section, message )
	return string.format(
		'Error in section "%s":\n%s',
			section:cid(), message or "Unknown error"
	)
end

function validator_error( option, message )
	return string.format(
		'External validator in option "%s" failed:\n%s',
			option:cid(), message or "Unknown error"
	)
end

function scheme_error( scheme, message )
	return string.format(
		'Error while loading scheme "%s":\n%s',
			scheme, message:gsub("^.-:.-: ","")
	)
end

function dump_dependency( dep, ref, v, e )
	local str = nil

	for k, v in luci.util.spairs( dep,
		function(a,b)
			a = ( type(dep[a]) ~= "boolean" and "_" or "" ) .. a
			b = ( type(dep[b]) ~= "boolean" and "_" or "" ) .. b
			return a < b
		end
	) do
		str = ( str and str .. " and " or "Dependency (" ) .. k ..
			( type(v) ~= "boolean" and "=" .. v or "" )
	end

	str = string.format(
		'%s) failed:\n\t%s',
		str, e and e:gsub("\n","\n\t") or string.format(
			'Option "%s" %s',
			table.concat( ref, "." ), (
				type(v) == "boolean"
					and "has no value" or 'is not equal "' .. v .. '"'
			)
		)
	)

	return str
end
