#!/usr/bin/lua
--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id: index.lua 3548 2008-10-09 20:28:07Z Cyrus $
]]--

local cbi = require "luci.cbi"
local i18n = require "luci.i18n"
local util = require "luci.util"

if not arg[1] then
 	util.perror("Usage %s path/to/cbi/model.lua [i18nfilename]" % arg[0])
 	os.exit(1)
end

i18n.load("default", "en")
i18n.load("admin-core", "en")
i18n.load("wifi", "en")

if arg[2] then
	i18n.load(arg[2], "en")
end

if arg[3] then
	pcall(function()
		require "uci"
		require "luci.model.uci".cursor = function(config, save)
			return uci.cursor(config or arg[3] .. "/etc/config", save or arg[3] .. "/tmp/.uci")
		end
	end)
end

local map = cbi.load(arg[1])[1]
assert(map)

print ("package "..map.config)
print ("\nconfig package")

if #map.title > 0 then
	print ("	option title '%s'" % util.striptags(map.title))
end

if #map.description > 0 then
	print ("	option description '%s'" % util.striptags(map.description))
end

for i, sec in pairs(map.children) do if util.instanceof(sec, cbi.AbstractSection) then
	print ("\nconfig section")
	print ("	option name '%s'" % sec.sectiontype)
	print ("	option package '%s'" % map.config)

	if #sec.title > 0 then
		print ("	option title '%s'" % util.striptags(sec.title))
	end

	if #sec.description > 0 then
		print ("	option description '%s'" % util.striptags(sec.description))
	end

	if not sec.addremove then
		print ("	option unique true")
		print ("	option required true")
	end

	if not sec.anonymous then
		print ("	option named true")
	end

	if sec.dynamic then
		print ("	option dynamic true")
	end

	for j, opt in ipairs(sec.children) do
	if opt.option:sub(1,1) ~= "_" or util.instanceof(opt, cbi.Value) then
		print ("\nconfig variable")
		print ("	option name '%s'" % opt.option)
		print ("	option section '%s.%s'" % {map.config, sec.sectiontype})
		if #opt.title > 0 then
			print ("	option title '%s'" % util.striptags(opt.title))
		end

		if #opt.description > 0 then
			print ("	option description '%s'" % util.striptags(opt.description))
		end

		if not opt.rmempty and not opt.optional then
			print ("	option required true")
		end

		if util.instanceof(opt, cbi.Flag) then
			print ("	option datatype boolean")
		elseif util.instanceof(opt, cbi.DynamicList) then
			print ("	option type list")
		elseif util.instanceof(opt, cbi.ListValue) then
			print ("	option type enum")
			util.perror("*** Warning: Please verify '%s.%s.%s' ***" %
				{map.config, sec.sectiontype, opt.option} )
		end

		for i, dep in ipairs(opt.deps) do
			if not dep.add or dep.add == "" then
				local depstring
				for k, v in pairs(dep.deps) do
					depstring = (depstring and depstring .. "," or "") .. "%s=%s" % {k, v}
				end
				print ("	list depends '%s'" % depstring)
			else
				util.perror("*** Warning: Unable to decode dependency '%s' in '%s.%s.%s[%s]' ***" %
					{util.serialize_data(dep.deps), map.config, sec.sectiontype, opt.option, dep.add})
			end
		end

		if util.instanceof(opt, cbi.ListValue) then
			for k, key in ipairs(opt.keylist) do
				print ("\nconfig enum")
				print ("	option variable '%s.%s.%s'" % {map.config, sec.sectiontype, opt.option})
				print ("	option value '%s'" % key)
				if opt.vallist[k] and opt.vallist[k] ~= opt.keylist[k] then
					print ("	option title '%s'" % util.striptags(opt.vallist[k]))
				end
			end
		end
	end
	end
end end
