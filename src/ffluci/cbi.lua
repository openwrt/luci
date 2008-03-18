--[[
FFLuCI - Configuration Bind Interface

Description:
Offers an interface for binding confiugration values to certain
data types. Supports value and range validation and basic dependencies.

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
module("ffluci.cbi", package.seeall)
require("ffluci.template")
require("ffluci.util")
local Template = ffluci.template.Template
local class = ffluci.util.class
local instanceof = ffluci.util.instanceof


-- Node pseudo abstract class
Node = class()

function Node.__init__(self, title, description)
	self.children = {}
	self.title = title
	self.description = description
	self.template = "cbi/node"
end

function Node.append(self, obj)
	table.insert(self.children, obj)
end

function Node.render(self)
	ffluci.template.render(self.template, self)
end


--[[
Map - A map describing a configuration file 
]]--
Map = class(Node)

function Map.__init__(self, config, ...)
	Node.__init__(self, ...)
	self.config = config
	self.template = "cbi/map"
end

function Map.section(self, class, ...)
	if instanceof(class, AbstractSection) then
		local obj = class(...)
		obj.map = self.config
		table.insert(self.children, obj)
		return obj
	else
		error("class must be a descendent of AbstractSection")
	end
end


--[[
AbstractSection
]]--
AbstractSection = class(Node)

function AbstractSection.__init__(self, sectiontype, ...)
	Node.__init__(self, ...)
	self.sectiontype = sectiontype
end

function AbstractSection.option(self, class, ...)
	if instanceof(class, AbstractValue) then
		local obj = class(...)
		obj.map   = self.map
		table.insert(self.children, obj)
		return obj
	else
		error("class must be a descendent of AbstractValue")
	end	
end
	


--[[
NamedSection - A fixed configuration section defined by its name
]]--
NamedSection = class(AbstractSection)

function NamedSection.__init__(self, section, ...)
	AbstractSection.__init__(self, ...)
	self.template = "cbi/nsection"
	
	self.section = section
end

function NamedSection.option(self, ...)
	local obj = AbstractSection.option(self, ...)
	obj.section = self.section
	return obj
end


--[[
TypedSection - A (set of) configuration section(s) defined by the type
	addremove: 	Defines whether the user can add/remove sections of this type
	anonymous:  Allow creating anonymous sections
	valid: 		a table with valid names or a function returning nil if invalid
]]--
TypedSection = class(AbstractSection)

function TypedSection.__init__(self, ...)
	AbstractSection.__init__(self, ...)
	self.template  = "cbi/tsection"
	
	self.addremove = true
	self.anonymous = false
	self.valid     = nil
end


--[[
AbstractValue - An abstract Value Type
	null:		Value can be empty
	valid:		A function returning nil if invalid
	depends:	A table of option => value pairs of which one must be true
	default:	The default value
]]--
AbstractValue = class(Node)

function AbstractValue.__init__(self, option, ...)
	Node.__init__(self, ...)
	self.option  = option
	
	self.valid   = nil
	self.depends = nil
	self.default = nil
end
	

--[[
Value - A one-line value
	maxlength:	The maximum length
	isnumber:	The value must be a valid (floating point) number
	isinteger:  The value must be a valid integer
]]--
Value = class(AbstractValue)

function Value.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/value"
	
	self.maxlength = nil
	self.isnumber  = false
	self.isinteger = false
end


--[[
ListValue - A one-line value predefined in a list
]]--
ListValue = class(AbstractValue)

function ListValue.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/value"
	
	self.list = {}
end

function ListValue.addValue(self, key, val)
	val = val or key
	self.list[key] = val
end