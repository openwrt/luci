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

local io = require "io"
local fs = require "luci.fs"
local uvl = require "luci.uvl"
local util = require "luci.util"
local ltn12 = require "luci.ltn12"
local template = require "luci.template"

local ipairs, getfenv, pairs, require = ipairs, getfenv, pairs, require
local luci = luci

module "luci.uvldoc.renderer"


Generator = util.class()

function Generator.__init__(self, schemes, output)
	self.names   = schemes
	self.output  = output or "doc"
	self.schemes = {}
	self.uvl     = uvl.UVL()
	
	self.extension = ".xml"
	self.additionals = {"uvldoc.css"}
	self.sourcedir = util.libpath() .. "/uvldoc/proto/xhtml/"
end


function Generator.make(self)
	for i, scheme in ipairs(self.names) do
		self.schemes[scheme] = self.uvl:get_scheme(scheme)
	end

	fs.mkdir(self.output)

	for i, file in ipairs(self.additionals) do
		fs.copy(self.sourcedir .. file, self.output)
	end

	template.compiler_mode = "memory"
	template.viewdir = self.sourcedir
	template.context.viewns = {
		include = function(name) template.Template(name):render(getfenv(2)) end,
		luci = luci,
		require = require
	}

	self:_make_index()

	for scheme, package in pairs(self.schemes) do
		self:_make_package(scheme)
		for type, section in pairs(package.sections) do
			self:_make_section(scheme, type)
		end
	end
end

function Generator._make_index(self)
	local t = template.Template("index.xml")
	local sink = ltn12.sink.file(
		io.open(self.output .. "/" .. self:_index_filename(), "w")
	)
	t:render({self = self, write = sink})
	sink()
end

function Generator._make_package(self, scheme)
	local t = template.Template("scheme.xml")
	local sink = ltn12.sink.file(
		io.open(self.output .. "/" .. self:_scheme_filename(scheme), "w")
	)
	t:render({self = self, package = self.schemes[scheme], scheme = scheme, write = sink})
	sink()
end

function Generator._make_section(self, scheme, section)
	local t = template.Template("section.xml")
	local sink = ltn12.sink.file(
		io.open(self.output .. "/" .. self:_section_filename(scheme, section), "w")
	)
	local pkg = self.schemes[scheme]
	t:render({self = self, package = pkg,
		scheme = scheme, type=section, section=pkg.sections[section],
		write = sink})
	sink()
end

function Generator._index_filename(self)
	return "index%s" % self.extension
end

function Generator._scheme_filename(self, scheme)
	return "scheme.%s%s" % {scheme, self.extension}
end

function Generator._section_filename(self, scheme, section)
	return "section.%s.%s%s" % {scheme, section, self.extension}
end
