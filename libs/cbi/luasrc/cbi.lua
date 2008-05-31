--[[
LuCI - Configuration Bind Interface

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
module("luci.cbi", package.seeall)

require("luci.template")
require("luci.util")
require("luci.http")
require("luci.model.uci")

local class      = luci.util.class
local instanceof = luci.util.instanceof

-- Loads a CBI map from given file, creating an environment and returns it
function load(cbimap)
	require("luci.fs")
	require("luci.i18n")
	require("luci.config")
	require("luci.sys")
	
	local cbidir = luci.sys.libpath() .. "/model/cbi/"
	local func, err = loadfile(cbidir..cbimap..".lua")
	
	if not func then
		return nil
	end
	
	luci.i18n.loadc("cbi")
	
	luci.util.resfenv(func)
	luci.util.updfenv(func, luci.cbi)
	luci.util.extfenv(func, "translate", luci.i18n.translate)
	luci.util.extfenv(func, "translatef", luci.i18n.translatef)
	
	local map = func()
	
	if not instanceof(map, Map) then
		error("CBI map returns no valid map object!")
		return nil
	end
	
	return map
end

-- Node pseudo abstract class
Node = class()

function Node.__init__(self, title, description)
	self.children = {}
	self.title = title or ""
	self.description = description or ""
	self.template = "cbi/node"
end

-- Append child nodes
function Node.append(self, obj)
	table.insert(self.children, obj)
end

-- Parse this node and its children
function Node.parse(self, ...)
	for k, child in ipairs(self.children) do
		child:parse(...)
	end
end

-- Render this node
function Node.render(self, scope)
	scope = scope or {}
	scope.self = self

	luci.template.render(self.template, scope)
end

-- Render the children
function Node.render_children(self, ...)
	for k, node in ipairs(self.children) do
		node:render(...)
	end
end


--[[
A simple template element
]]--
Template = class(Node)

function Template.__init__(self, template)
	Node.__init__(self)
	self.template = template
end


--[[
Map - A map describing a configuration file 
]]--
Map = class(Node)

function Map.__init__(self, config, ...)
	Node.__init__(self, ...)
	self.config = config
	self.template = "cbi/map"
	self.uci = luci.model.uci.Session()
	self.ucidata, self.uciorder = self.uci:sections(self.config)
	if not self.ucidata or not self.uciorder then
		error("Unable to read UCI data: " .. self.config)
	end
end

-- Use optimized UCI writing
function Map.parse(self, ...)
	self.uci:t_load(self.config)
	Node.parse(self, ...)
	self.uci:t_save(self.config)
end

-- Creates a child section
function Map.section(self, class, ...)
	if instanceof(class, AbstractSection) then
		local obj  = class(self, ...)
		self:append(obj)
		return obj
	else
		error("class must be a descendent of AbstractSection")
	end
end

-- UCI add
function Map.add(self, sectiontype)
	local name = self.uci:t_add(self.config, sectiontype)
	if name then
		self.ucidata[name] = {}
		self.ucidata[name][".type"] = sectiontype
		table.insert(self.uciorder, name)
	end
	return name
end

-- UCI set
function Map.set(self, section, option, value)
	local stat = self.uci:t_set(self.config, section, option, value)
	if stat then
		local val = self.uci:t_get(self.config, section, option)
		if option then
			self.ucidata[section][option] = val
		else
			if not self.ucidata[section] then
				self.ucidata[section] = {}
			end
			self.ucidata[section][".type"] = val
			table.insert(self.uciorder, section)
		end
	end
	return stat
end

-- UCI del
function Map.del(self, section, option)
	local stat = self.uci:t_del(self.config, section, option)
	if stat then
		if option then
			self.ucidata[section][option] = nil
		else
			self.ucidata[section] = nil
			for i, k in ipairs(self.uciorder) do
				if section == k then
					table.remove(self.uciorder, i)
				end
			end
		end
	end
	return stat
end

-- UCI get (cached)
function Map.get(self, section, option)
	if not section then
		return self.ucidata, self.uciorder
	elseif option and self.ucidata[section] then
		return self.ucidata[section][option]
	else
		return self.ucidata[section]
	end
end


--[[
AbstractSection
]]--
AbstractSection = class(Node)

function AbstractSection.__init__(self, map, sectiontype, ...)
	Node.__init__(self, ...)
	self.sectiontype = sectiontype
	self.map = map
	self.config = map.config
	self.optionals = {}
	
	self.optional = true
	self.addremove = false
	self.dynamic = false
end

-- Appends a new option
function AbstractSection.option(self, class, ...)
	if instanceof(class, AbstractValue) then
		local obj  = class(self.map, ...)
		self:append(obj)
		return obj
	else
		error("class must be a descendent of AbstractValue")
	end	
end

-- Parse optional options
function AbstractSection.parse_optionals(self, section)
	if not self.optional then
		return
	end
	
	self.optionals[section] = {}
	
	local field = luci.http.formvalue("cbi.opt."..self.config.."."..section)
	for k,v in ipairs(self.children) do
		if v.optional and not v:cfgvalue(section) then
			if field == v.option then
				field = nil
			else
				table.insert(self.optionals[section], v)
			end
		end
	end
	
	if field and #field > 0 and self.dynamic then
		self:add_dynamic(field)
	end
end

-- Add a dynamic option
function AbstractSection.add_dynamic(self, field, optional)
	local o = self:option(Value, field, field)
	o.optional = optional
end

-- Parse all dynamic options
function AbstractSection.parse_dynamic(self, section)
	if not self.dynamic then
		return
	end
	
	local arr  = luci.util.clone(self:cfgvalue(section))
	local form = luci.http.formvaluetable("cbid."..self.config.."."..section)
	for k, v in pairs(form) do
		arr[k] = v
	end
	
	for key,val in pairs(arr) do
		local create = true
		
		for i,c in ipairs(self.children) do
			if c.option == key then
				create = false
			end
		end
		
		if create and key:sub(1, 1) ~= "." then
			self:add_dynamic(key, true)
		end
	end
end	

-- Returns the section's UCI table
function AbstractSection.cfgvalue(self, section)
	return self.map:get(section)
end

-- Removes the section
function AbstractSection.remove(self, section)
	return self.map:del(section)
end

-- Creates the section
function AbstractSection.create(self, section)
	return self.map:set(section, nil, self.sectiontype)
end



--[[
NamedSection - A fixed configuration section defined by its name
]]--
NamedSection = class(AbstractSection)

function NamedSection.__init__(self, map, section, ...)
	AbstractSection.__init__(self, map, ...)
	self.template = "cbi/nsection"
	
	self.section = section
	self.addremove = false
end

function NamedSection.parse(self)
	local s = self.section	
	local active = self:cfgvalue(s)
	
	
	if self.addremove then
		local path = self.config.."."..s
		if active then -- Remove the section
			if luci.http.formvalue("cbi.rns."..path) and self:remove(s) then
				return
			end
		else           -- Create and apply default values
			if luci.http.formvalue("cbi.cns."..path) and self:create(s) then
				for k,v in pairs(self.children) do
					v:write(s, v.default)
				end
			end
		end
	end
	
	if active then
		AbstractSection.parse_dynamic(self, s)
		if luci.http.formvalue("cbi.submit") then
			Node.parse(self, s)
		end
		AbstractSection.parse_optionals(self, s)
	end	
end


--[[
TypedSection - A (set of) configuration section(s) defined by the type
	addremove: 	Defines whether the user can add/remove sections of this type
	anonymous:  Allow creating anonymous sections
	validate: 	a validation function returning nil if the section is invalid 
]]--
TypedSection = class(AbstractSection)

function TypedSection.__init__(self, ...)
	AbstractSection.__init__(self, ...)
	self.template  = "cbi/tsection"
	self.deps = {}
	self.excludes = {}
	
	self.anonymous = false
end

-- Return all matching UCI sections for this TypedSection
function TypedSection.cfgsections(self)
	local sections = {}
	local map, order = self.map:get()
	
	for i, k in ipairs(order) do
		if map[k][".type"] == self.sectiontype then
			if self:checkscope(k) then
				table.insert(sections, k)
			end
		end
	end
	
	return sections	
end

-- Creates a new section of this type with the given name (or anonymous)
function TypedSection.create(self, name)
	if name then	
		self.map:set(name, nil, self.sectiontype)
	else
		name = self.map:add(self.sectiontype)
	end
	
	for k,v in pairs(self.children) do
		if v.default then
			self.map:set(name, v.option, v.default)
		end
	end
end

-- Limits scope to sections that have certain option => value pairs
function TypedSection.depends(self, option, value)
	table.insert(self.deps, {option=option, value=value})
end

-- Excludes several sections by name
function TypedSection.exclude(self, field)
	self.excludes[field] = true
end

function TypedSection.parse(self)
	if self.addremove then
		-- Create
		local crval = "cbi.cts." .. self.config .. "." .. self.sectiontype
		local name  = luci.http.formvalue(crval)
		if self.anonymous then
			if name then
				self:create()
			end
		else		
			if name then
				-- Ignore if it already exists
				if self:cfgvalue(name) then
					name = nil;
				end
				
				name = self:checkscope(name)
				
				if not name then
					self.err_invalid = true
				end		
				
				if name and name:len() > 0 then
					self:create(name)
				end
			end
		end
		
		-- Remove
		crval = "cbi.rts." .. self.config
		name = luci.http.formvaluetable(crval)
		for k,v in pairs(name) do
			if self:cfgvalue(k) and self:checkscope(k) then
				self:remove(k)
			end
		end	
	end
	
	for i, k in ipairs(self:cfgsections()) do
		AbstractSection.parse_dynamic(self, k)
		if luci.http.formvalue("cbi.submit") then
			Node.parse(self, k)
		end
		AbstractSection.parse_optionals(self, k)
	end
end

-- Verifies scope of sections
function TypedSection.checkscope(self, section)
	-- Check if we are not excluded
	if self.excludes[section] then
		return nil
	end
	
	-- Check if at least one dependency is met
	if #self.deps > 0 and self:cfgvalue(section) then
		local stat = false
		
		for k, v in ipairs(self.deps) do
			if self:cfgvalue(section)[v.option] == v.value then
				stat = true
			end
		end
		
		if not stat then
			return nil
		end
	end
	
	return self:validate(section)
end


-- Dummy validate function
function TypedSection.validate(self, section)
	return section
end


--[[
AbstractValue - An abstract Value Type
	null:		Value can be empty
	valid:		A function returning the value if it is valid otherwise nil 
	depends:	A table of option => value pairs of which one must be true
	default:	The default value
	size:		The size of the input fields
	rmempty:	Unset value if empty
	optional:	This value is optional (see AbstractSection.optionals)
]]--
AbstractValue = class(Node)

function AbstractValue.__init__(self, map, option, ...)
	Node.__init__(self, ...)
	self.option = option
	self.map    = map
	self.config = map.config
	self.tag_invalid = {}
	self.deps = {}
	
	self.rmempty  = false
	self.default  = nil
	self.size     = nil
	self.optional = false
end

-- Add a dependencie to another section field
function AbstractValue.depends(self, field, value)
	table.insert(self.deps, {field=field, value=value})
end

-- Return whether this object should be created
function AbstractValue.formcreated(self, section)
	local key = "cbi.opt."..self.config.."."..section
	return (luci.http.formvalue(key) == self.option)
end

-- Returns the formvalue for this object
function AbstractValue.formvalue(self, section)
	local key = "cbid."..self.map.config.."."..section.."."..self.option
	return luci.http.formvalue(key)
end

function AbstractValue.parse(self, section)
	local fvalue = self:formvalue(section)
	
	if fvalue and fvalue ~= "" then -- If we have a form value, write it to UCI
		fvalue = self:validate(fvalue)
		if not fvalue then
			self.tag_invalid[section] = true
		end
		if fvalue and not (fvalue == self:cfgvalue(section)) then
			self:write(section, fvalue)
		end 
	else							-- Unset the UCI or error
		if self.rmempty or self.optional then
			self:remove(section)
		end
	end
end

-- Render if this value exists or if it is mandatory
function AbstractValue.render(self, s, scope)
	if not self.optional or self:cfgvalue(s) or self:formcreated(s) then
		scope = scope or {}
		scope.section = s
		Node.render(self, scope)
	end
end

-- Return the UCI value of this object
function AbstractValue.cfgvalue(self, section)
	return self.map:get(section, self.option)
end

-- Validate the form value
function AbstractValue.validate(self, value)
	return value
end

-- Write to UCI
function AbstractValue.write(self, section, value)
	return self.map:set(section, self.option, value)
end

-- Remove from UCI
function AbstractValue.remove(self, section)
	return self.map:del(section, self.option)
end




--[[
Value - A one-line value
	maxlength:	The maximum length
	isnumber:	The value must be a valid (floating point) number
	isinteger:  The value must be a valid integer
	ispositive: The value must be positive (and a number)
]]--
Value = class(AbstractValue)

function Value.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/value"
	
	self.maxlength  = nil
	self.isnumber   = false
	self.isinteger  = false
end

-- This validation is a bit more complex
function Value.validate(self, val)
	if self.maxlength and tostring(val):len() > self.maxlength then
		val = nil
	end
	
	return luci.util.validate(val, self.isnumber, self.isinteger)
end


-- DummyValue - This does nothing except being there
DummyValue = class(AbstractValue)

function DummyValue.__init__(self, map, ...)
	AbstractValue.__init__(self, map, ...)
	self.template = "cbi/dvalue"
	self.value = nil
end

function DummyValue.parse(self)
	
end

function DummyValue.render(self, s)
	luci.template.render(self.template, {self=self, section=s})
end


--[[
Flag - A flag being enabled or disabled
]]--
Flag = class(AbstractValue)

function Flag.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/fvalue"
	
	self.enabled = "1"
	self.disabled = "0"
end

-- A flag can only have two states: set or unset
function Flag.parse(self, section)
	local fvalue = self:formvalue(section)
	
	if fvalue then
		fvalue = self.enabled
	else
		fvalue = self.disabled
	end	
	
	if fvalue == self.enabled or (not self.optional and not self.rmempty) then 		
		if not(fvalue == self:cfgvalue(section)) then
			self:write(section, fvalue)
		end 
	else
		self:remove(section)
	end
end



--[[
ListValue - A one-line value predefined in a list
	widget: The widget that will be used (select, radio)
]]--
ListValue = class(AbstractValue)

function ListValue.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/lvalue"
	self.keylist = {}
	self.vallist = {}
	
	self.size   = 1
	self.widget = "select"
end

function ListValue.value(self, key, val)
	val = val or key
	table.insert(self.keylist, tostring(key))
	table.insert(self.vallist, tostring(val)) 
end

function ListValue.validate(self, val)
	if luci.util.contains(self.keylist, val) then
		return val
	else
		return nil
	end
end



--[[
MultiValue - Multiple delimited values
	widget: The widget that will be used (select, checkbox)
	delimiter: The delimiter that will separate the values (default: " ")
]]--
MultiValue = class(AbstractValue)

function MultiValue.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template = "cbi/mvalue"
	self.keylist = {}
	self.vallist = {}	
	
	self.widget = "checkbox"
	self.delimiter = " "
end

function MultiValue.value(self, key, val)
	val = val or key
	table.insert(self.keylist, tostring(key))
	table.insert(self.vallist, tostring(val)) 
end

function MultiValue.valuelist(self, section)
	local val = self:cfgvalue(section)
	
	if not(type(val) == "string") then
		return {}
	end
	
	return luci.util.split(val, self.delimiter)
end

function MultiValue.validate(self, val)
	if not(type(val) == "string") then
		return nil
	end
	
	local result = ""
	
	for value in val:gmatch("[^\n]+") do
		if luci.util.contains(self.keylist, value) then
			result = result .. self.delimiter .. value
		end 
	end
	
	if result:len() > 0 then
		return result:sub(self.delimiter:len() + 1)
	else
		return nil
	end
end