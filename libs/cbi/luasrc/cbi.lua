--[[
LuCI - Configuration Bind Interface

Description:
Offers an interface for binding configuration values to certain
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
local util = require("luci.util")
require("luci.http")
require("luci.uvl")


--local event      = require "luci.sys.event"
local fs         = require("nixio.fs")
local uci        = require("luci.model.uci")
local class      = util.class
local instanceof = util.instanceof

FORM_NODATA  =  0
FORM_PROCEED =  0
FORM_VALID   =  1
FORM_DONE	 =  1
FORM_INVALID = -1
FORM_CHANGED =  2
FORM_SKIP    =  4

AUTO = true

CREATE_PREFIX = "cbi.cts."
REMOVE_PREFIX = "cbi.rts."

-- Loads a CBI map from given file, creating an environment and returns it
function load(cbimap, ...)
	local fs   = require "nixio.fs"
	local i18n = require "luci.i18n"
	require("luci.config")
	require("luci.util")

	local upldir = "/lib/uci/upload/"
	local cbidir = luci.util.libpath() .. "/model/cbi/"

	assert(fs.stat(cbimap) or
		fs.stat(cbidir..cbimap..".lua") or
		fs.stat(cbidir..cbimap..".lua.gz"),
			"Model not found!")

	local func, err = loadfile(cbimap)
	if not func then
		func, err = loadfile(cbidir..cbimap..".lua") or
			loadfile(cbidir..cbimap..".lua.gz")
	end
	assert(func, err)

	luci.i18n.loadc("cbi")
	luci.i18n.loadc("uvl")

	local env = {
		translate=i18n.translate,
		translatef=i18n.translatef,
	 	arg={...}
	}

	setfenv(func, setmetatable(env, {__index =
		function(tbl, key)
			return rawget(tbl, key) or _M[key] or _G[key]
		end}))

	local maps       = { func() }
	local uploads    = { }
	local has_upload = false

	for i, map in ipairs(maps) do
		if not instanceof(map, Node) then
			error("CBI map returns no valid map object!")
			return nil
		else
			map:prepare()
			if map.upload_fields then
				has_upload = true
				for _, field in ipairs(map.upload_fields) do
					uploads[
						field.config .. '.' ..
						field.section.sectiontype .. '.' ..
						field.option
					] = true
				end
			end
		end
	end

	if has_upload then
		local uci = luci.model.uci.cursor()
		local prm = luci.http.context.request.message.params
		local fd, cbid

		luci.http.setfilehandler(
			function( field, chunk, eof )
				if not field then return end
				if field.name and not cbid then
					local c, s, o = field.name:gmatch(
						"cbid%.([^%.]+)%.([^%.]+)%.([^%.]+)"
					)()

					if c and s and o then
						local t = uci:get( c, s )
						if t and uploads[c.."."..t.."."..o] then
							local path = upldir .. field.name
							fd = io.open(path, "w")
							if fd then
								cbid = field.name
								prm[cbid] = path
							end
						end
					end
				end

				if field.name == cbid and fd then
					fd:write(chunk)
				end

				if eof and fd then
					fd:close()
					fd   = nil
					cbid = nil
				end
			end
		)
	end

	return maps
end

local function _uvl_validate_section(node, name)
	local co = node.map:get()

	luci.uvl.STRICT_UNKNOWN_OPTIONS = false
	luci.uvl.STRICT_UNKNOWN_SECTIONS = false

	local function tag_fields(e)
		if e.option and node.fields[e.option] then
			if node.fields[e.option].error then
				node.fields[e.option].error[name] = e
			else
				node.fields[e.option].error = { [name] = e }
			end
		elseif e.childs then
			for _, c in ipairs(e.childs) do tag_fields(c) end
		end
	end

	local function tag_section(e)
		local s = { }
		for _, c in ipairs(e.childs or { e }) do
			if c.childs and not c:is(luci.uvl.errors.ERR_DEPENDENCY) then
				table.insert( s, c.childs[1]:string() )
			else
				table.insert( s, c:string() )
			end
		end
		if #s > 0 then
			if node.error then
				node.error[name] = s
			else
				node.error = { [name] = s }
			end
		end
	end

	local stat, err = node.map.validator:validate_section(node.config, name, co)
	if err then
		node.map.save = false
		tag_fields(err)
		tag_section(err)
	end

end

local function _uvl_strip_remote_dependencies(deps)
	local clean = {}

	for k, v in pairs(deps) do
		k = k:gsub("%$config%.%$section%.", "")
		if k:match("^[%w_]+$") and type(v) == "string" then
			clean[k] = v
		end
	end

	return clean
end


-- Node pseudo abstract class
Node = class()

function Node.__init__(self, title, description)
	self.children = {}
	self.title = title or ""
	self.description = description or ""
	self.template = "cbi/node"
end

-- i18n helper
function Node._i18n(self, config, section, option, title, description)

	-- i18n loaded?
	if type(luci.i18n) == "table" then

		local key = config and config:gsub("[^%w]+", "") or ""

		if section then	key = key .. "_" .. section:lower():gsub("[^%w]+", "") end
		if option  then key = key .. "_" .. tostring(option):lower():gsub("[^%w]+", "")  end

		self.title = title or luci.i18n.translate( key, option or section or config )
		self.description = description or luci.i18n.translate( key .. "_desc", "" )
	end
end

-- Prepare nodes
function Node.prepare(self, ...)
	for k, child in ipairs(self.children) do
		child:prepare(...)
	end
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

function Template.render(self)
	luci.template.render(self.template, {self=self})
end

function Template.parse(self, readinput)
	self.readinput = (readinput ~= false)
	return Map.formvalue(self, "cbi.submit") and FORM_DONE or FORM_NODATA
end


--[[
Map - A map describing a configuration file
]]--
Map = class(Node)

function Map.__init__(self, config, ...)
	Node.__init__(self, ...)
	Node._i18n(self, config, nil, nil, ...)

	self.config = config
	self.parsechain = {self.config}
	self.template = "cbi/map"
	self.apply_on_parse = nil
	self.readinput = true
	self.proceed = false
	self.flow = {}

	self.uci = uci.cursor()
	self.save = true

	self.changed = false

	if not self.uci:load(self.config) then
		error("Unable to read UCI data: " .. self.config)
	end

	self.validator = luci.uvl.UVL()
	self.scheme = self.validator:get_scheme(self.config)

end

function Map.formvalue(self, key)
	return self.readinput and luci.http.formvalue(key)
end

function Map.formvaluetable(self, key)
	return self.readinput and luci.http.formvaluetable(key) or {}
end

function Map.get_scheme(self, sectiontype, option)
	if not option then
		return self.scheme and self.scheme.sections[sectiontype]
	else
		return self.scheme and self.scheme.variables[sectiontype]
		 and self.scheme.variables[sectiontype][option]
	end
end

function Map.submitstate(self)
	return self:formvalue("cbi.submit")
end

-- Chain foreign config
function Map.chain(self, config)
	table.insert(self.parsechain, config)
end

function Map.state_handler(self, state)
	return state
end

-- Use optimized UCI writing
function Map.parse(self, readinput, ...)
	self.readinput = (readinput ~= false)

	if self:formvalue("cbi.skip") then
		self.state = FORM_SKIP
		return self:state_handler(self.state)
	end

	Node.parse(self, ...)

	if self.save then
		for i, config in ipairs(self.parsechain) do
			self.uci:save(config)
		end
		if self:submitstate() and not self.proceed and (self.flow.autoapply or luci.http.formvalue("cbi.apply")) then
			for i, config in ipairs(self.parsechain) do
				self.uci:commit(config)

				-- Refresh data because commit changes section names
				self.uci:load(config)
			end
			if self.apply_on_parse then
				self.uci:apply(self.parsechain)
			else
				self._apply = function()
					local cmd = self.uci:apply(self.parsechain, true)
					return io.popen(cmd)
				end
			end

			-- Reparse sections
			Node.parse(self, true)

		end
		for i, config in ipairs(self.parsechain) do
			self.uci:unload(config)
		end
		if type(self.commit_handler) == "function" then
			self:commit_handler(self:submitstate())
		end
	end

	if self:submitstate() then
		if not self.save then
			self.state = FORM_INVALID
		elseif self.proceed then
			self.state = FORM_PROCEED
		else
			self.state = self.changed and FORM_CHANGED or FORM_VALID
		end
	else
		self.state = FORM_NODATA
	end

	return self:state_handler(self.state)
end

function Map.render(self, ...)
	Node.render(self, ...)
	if self._apply then
		local fp = self._apply()
		fp:read("*a")
		fp:close()
	end
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
	return self.uci:add(self.config, sectiontype)
end

-- UCI set
function Map.set(self, section, option, value)
	if option then
		return self.uci:set(self.config, section, option, value)
	else
		return self.uci:set(self.config, section, value)
	end
end

-- UCI del
function Map.del(self, section, option)
	if option then
		return self.uci:delete(self.config, section, option)
	else
		return self.uci:delete(self.config, section)
	end
end

-- UCI get
function Map.get(self, section, option)
	if not section then
		return self.uci:get_all(self.config)
	elseif option then
		return self.uci:get(self.config, section, option)
	else
		return self.uci:get_all(self.config, section)
	end
end

--[[
Compound - Container
]]--
Compound = class(Node)

function Compound.__init__(self, ...)
	Node.__init__(self)
	self.template = "cbi/compound"
	self.children = {...}
end

function Compound.populate_delegator(self, delegator)
	for _, v in ipairs(self.children) do
		v.delegator = delegator
	end
end

function Compound.parse(self, ...)
	local cstate, state = 0

	for k, child in ipairs(self.children) do
		cstate = child:parse(...)
		state = (not state or cstate < state) and cstate or state
	end

	return state
end


--[[
Delegator - Node controller
]]--
Delegator = class(Node)
function Delegator.__init__(self, ...)
	Node.__init__(self, ...)
	self.nodes = {}
	self.defaultpath = {}
	self.pageaction = false
	self.readinput = true
	self.allow_reset = false
	self.allow_back = false
	self.allow_finish = false
	self.template = "cbi/delegator"
end

function Delegator.set(self, name, node)
	if type(node) == "table" and getmetatable(node) == nil then
		node = Compound(unpack(node))
	end
	assert(type(node) == "function" or instanceof(node, Compound), "Invalid")
	assert(not self.nodes[name], "Duplicate entry")

	self.nodes[name] = node
end

function Delegator.add(self, name, node)
	node = self:set(name, node)
	self.defaultpath[#self.defaultpath+1] = name
end

function Delegator.insert_after(self, name, after)
	local n = #self.chain
	for k, v in ipairs(self.chain) do
		if v == state then
			n = k + 1
			break
		end
	end
	table.insert(self.chain, n, name)
end

function Delegator.set_route(self, ...)
	local n, chain, route = 0, self.chain, {...}
	for i = 1, #chain do
		if chain[i] == self.current then
			n = i
			break
		end
	end
	for i = 1, #route do
		n = n + 1
		chain[n] = route[i]
	end
	for i = n + 1, #chain do
		chain[i] = nil
	end
end

function Delegator.get(self, name)
	return self.nodes[name]
end

function Delegator.parse(self, ...)
	local newcurrent
	self.chain = self.chain or self:get_chain()
	self.current = self.current or self:get_active()
	self.active = self.active or self:get(self.current)
	assert(self.active, "Invalid state")
	
	local stat = FORM_DONE
	if type(self.active) ~= "function" then
		self.active:populate_delegator(self)
		stat = self.active:parse() 
	else
		self:active()
	end

	if stat > FORM_PROCEED then
		if Map.formvalue(self, "cbi.delg.back") then
			newcurrent = self:get_prev(self.current)
		else
			newcurrent = self:get_next(self.current)
		end
	end
	
	if not Map.formvalue(self, "cbi.submit") then
		return FORM_NODATA
	elseif not newcurrent or not self:get(newcurrent) then
		return FORM_DONE
	else
		self.current = newcurrent
		self.active = self:get(self.current)
		if type(self.active) ~= "function" then
			self.active:parse(false)
			return FROM_PROCEED
		else
			return self:parse(...)
		end
	end
end

function Delegator.get_next(self, state)
	for k, v in ipairs(self.chain) do
		if v == state then
			return self.chain[k+1]
		end
	end
end

function Delegator.get_prev(self, state)
	for k, v in ipairs(self.chain) do
		if v == state then
			return self.chain[k-1]
		end
	end
end

function Delegator.get_chain(self)
	local x = Map.formvalue(self, "cbi.delg.path") or self.defaultpath
	return type(x) == "table" and x or {x}
end

function Delegator.get_active(self)
	return Map.formvalue(self, "cbi.delg.current") or self.chain[1]
end

--[[
Page - A simple node
]]--

Page = class(Node)
Page.__init__ = Node.__init__
Page.parse    = function() end


--[[
SimpleForm - A Simple non-UCI form
]]--
SimpleForm = class(Node)

function SimpleForm.__init__(self, config, title, description, data)
	Node.__init__(self, title, description)
	self.config = config
	self.data = data or {}
	self.template = "cbi/simpleform"
	self.dorender = true
	self.pageaction = false
	self.readinput = true
end

SimpleForm.formvalue = Map.formvalue
SimpleForm.formvaluetable = Map.formvaluetable

function SimpleForm.parse(self, readinput, ...)
	self.readinput = (readinput ~= false)

	if self:formvalue("cbi.skip") then
		return FORM_SKIP
	end

	if self:submitstate() then
		Node.parse(self, 1, ...)
	end

	local valid = true
	for k, j in ipairs(self.children) do
		for i, v in ipairs(j.children) do
			valid = valid
			 and (not v.tag_missing or not v.tag_missing[1])
			 and (not v.tag_invalid or not v.tag_invalid[1])
			 and (not v.error)
		end
	end

	local state =
		not self:submitstate() and FORM_NODATA
		or valid and FORM_VALID
		or FORM_INVALID

	self.dorender = not self.handle
	if self.handle then
		local nrender, nstate = self:handle(state, self.data)
		self.dorender = self.dorender or (nrender ~= false)
		state = nstate or state
	end
	return state
end

function SimpleForm.render(self, ...)
	if self.dorender then
		Node.render(self, ...)
	end
end

function SimpleForm.submitstate(self)
	return self:formvalue("cbi.submit")
end

function SimpleForm.section(self, class, ...)
	if instanceof(class, AbstractSection) then
		local obj  = class(self, ...)
		self:append(obj)
		return obj
	else
		error("class must be a descendent of AbstractSection")
	end
end

-- Creates a child field
function SimpleForm.field(self, class, ...)
	local section
	for k, v in ipairs(self.children) do
		if instanceof(v, SimpleSection) then
			section = v
			break
		end
	end
	if not section then
		section = self:section(SimpleSection)
	end

	if instanceof(class, AbstractValue) then
		local obj  = class(self, section, ...)
		obj.track_missing = true
		section:append(obj)
		return obj
	else
		error("class must be a descendent of AbstractValue")
	end
end

function SimpleForm.set(self, section, option, value)
	self.data[option] = value
end


function SimpleForm.del(self, section, option)
	self.data[option] = nil
end


function SimpleForm.get(self, section, option)
	return self.data[option]
end


function SimpleForm.get_scheme()
	return nil
end


Form = class(SimpleForm)

function Form.__init__(self, ...)
	SimpleForm.__init__(self, ...)
	self.embedded = true
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
	self.defaults = {}
	self.fields = {}
	self.tag_error = {}
	self.tag_invalid = {}
	self.tag_deperror = {}
	self.changed = false

	self.optional = true
	self.addremove = false
	self.dynamic = false
end

-- Appends a new option
function AbstractSection.option(self, class, option, ...)
	-- Autodetect from UVL
	if class == true and self.map:get_scheme(self.sectiontype, option) then
		local vs = self.map:get_scheme(self.sectiontype, option)
		if vs.type == "boolean" then
			class = Flag
		elseif vs.type == "list" then
			class = DynamicList
		elseif vs.type == "enum" or vs.type == "reference" then
			class = ListValue
		else
			class = Value
		end
	end

	if instanceof(class, AbstractValue) then
		local obj  = class(self.map, self, option, ...)

		Node._i18n(obj, self.config, self.section or self.sectiontype, option, ...)

		self:append(obj)
		self.fields[option] = obj
		return obj
	elseif class == true then
		error("No valid class was given and autodetection failed.")
	else
		error("class must be a descendant of AbstractValue")
	end
end

-- Parse optional options
function AbstractSection.parse_optionals(self, section)
	if not self.optional then
		return
	end

	self.optionals[section] = {}

	local field = self.map:formvalue("cbi.opt."..self.config.."."..section)
	for k,v in ipairs(self.children) do
		if v.optional and not v:cfgvalue(section) then
			if field == v.option then
				field = nil
				self.map.proceed = true
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
	local form = self.map:formvaluetable("cbid."..self.config.."."..section)
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
			self.map.proceed = true
			self:add_dynamic(key, true)
		end
	end
end

-- Returns the section's UCI table
function AbstractSection.cfgvalue(self, section)
	return self.map:get(section)
end

-- Push events
function AbstractSection.push_events(self)
	--luci.util.append(self.map.events, self.events)
	self.map.changed = true
end

-- Removes the section
function AbstractSection.remove(self, section)
	self.map.proceed = true
	return self.map:del(section)
end

-- Creates the section
function AbstractSection.create(self, section)
	local stat

	if section then
		stat = section:match("^%w+$") and self.map:set(section, nil, self.sectiontype)
	else
		section = self.map:add(self.sectiontype)
		stat = section
	end

	if stat then
		for k,v in pairs(self.children) do
			if v.default then
				self.map:set(section, v.option, v.default)
			end
		end

		for k,v in pairs(self.defaults) do
			self.map:set(section, k, v)
		end
	end

	self.map.proceed = true

	return stat
end


SimpleSection = class(AbstractSection)

function SimpleSection.__init__(self, form, ...)
	AbstractSection.__init__(self, form, nil, ...)
	self.template = "cbi/nullsection"
end


Table = class(AbstractSection)

function Table.__init__(self, form, data, ...)
	local datasource = {}
	local tself = self
	datasource.config = "table"
	self.data = data or {}

	datasource.formvalue = Map.formvalue
	datasource.formvaluetable = Map.formvaluetable
	datasource.readinput = true

	function datasource.get(self, section, option)
		return tself.data[section] and tself.data[section][option]
	end

	function datasource.submitstate(self)
		return Map.formvalue(self, "cbi.submit")
	end

	function datasource.del(...)
		return true
	end

	function datasource.get_scheme()
		return nil
	end

	AbstractSection.__init__(self, datasource, "table", ...)
	self.template = "cbi/tblsection"
	self.rowcolors = true
	self.anonymous = true
end

function Table.parse(self, readinput)
	self.map.readinput = (readinput ~= false)
	for i, k in ipairs(self:cfgsections()) do
		if self.map:submitstate() then
			Node.parse(self, k)
		end
	end
end

function Table.cfgsections(self)
	local sections = {}

	for i, v in luci.util.kspairs(self.data) do
		table.insert(sections, i)
	end

	return sections
end

function Table.update(self, data)
	self.data = data
end



--[[
NamedSection - A fixed configuration section defined by its name
]]--
NamedSection = class(AbstractSection)

function NamedSection.__init__(self, map, section, stype, ...)
	AbstractSection.__init__(self, map, stype, ...)
	Node._i18n(self, map.config, section, nil, ...)

	-- Defaults
	self.addremove = false

	-- Use defaults from UVL
	if not self.override_scheme and self.map:get_scheme(self.sectiontype) then
		local vs = self.map:get_scheme(self.sectiontype)
		self.addremove = not vs.unique and not vs.required
		self.dynamic   = vs.dynamic
		self.title       = self.title or vs.title
		self.description = self.description or vs.descr
	end

	self.template = "cbi/nsection"
	self.section = section
end

function NamedSection.parse(self, novld)
	local s = self.section
	local active = self:cfgvalue(s)

	if self.addremove then
		local path = self.config.."."..s
		if active then -- Remove the section
			if self.map:formvalue("cbi.rns."..path) and self:remove(s) then
				self:push_events()
				return
			end
		else           -- Create and apply default values
			if self.map:formvalue("cbi.cns."..path) then
				self:create(s)
				return
			end
		end
	end

	if active then
		AbstractSection.parse_dynamic(self, s)
		if self.map:submitstate() then
			Node.parse(self, s)

			if not novld and not self.override_scheme and self.map.scheme then
				_uvl_validate_section(self, s)
			end
		end
		AbstractSection.parse_optionals(self, s)

		if self.changed then
			self:push_events()
		end
	end
end


--[[
TypedSection - A (set of) configuration section(s) defined by the type
	addremove: 	Defines whether the user can add/remove sections of this type
	anonymous:  Allow creating anonymous sections
	validate: 	a validation function returning nil if the section is invalid
]]--
TypedSection = class(AbstractSection)

function TypedSection.__init__(self, map, type, ...)
	AbstractSection.__init__(self, map, type, ...)
	Node._i18n(self, map.config, type, nil, ...)

	self.template  = "cbi/tsection"
	self.deps = {}
	self.anonymous = false

	-- Use defaults from UVL
	if not self.override_scheme and self.map:get_scheme(self.sectiontype) then
		local vs = self.map:get_scheme(self.sectiontype)
		self.addremove = not vs.unique and not vs.required
		self.dynamic   = vs.dynamic
		self.anonymous = not vs.named
		self.title       = self.title or vs.title
		self.description = self.description or vs.descr
	end
end

-- Return all matching UCI sections for this TypedSection
function TypedSection.cfgsections(self)
	local sections = {}
	self.map.uci:foreach(self.map.config, self.sectiontype,
		function (section)
			if self:checkscope(section[".name"]) then
				table.insert(sections, section[".name"])
			end
		end)

	return sections
end

-- Limits scope to sections that have certain option => value pairs
function TypedSection.depends(self, option, value)
	table.insert(self.deps, {option=option, value=value})
end

function TypedSection.parse(self, novld)
	if self.addremove then
		-- Remove
		local crval = REMOVE_PREFIX .. self.config
		local name = self.map:formvaluetable(crval)
		for k,v in pairs(name) do
			if k:sub(-2) == ".x" then
				k = k:sub(1, #k - 2)
			end
			if self:cfgvalue(k) and self:checkscope(k) then
				self:remove(k)
			end
		end
	end

	local co
	for i, k in ipairs(self:cfgsections()) do
		AbstractSection.parse_dynamic(self, k)
		if self.map:submitstate() then
			Node.parse(self, k, novld)

			if not novld and not self.override_scheme and self.map.scheme then
				_uvl_validate_section(self, k)
			end
		end
		AbstractSection.parse_optionals(self, k)
	end

	if self.addremove then
		-- Create
		local created
		local crval = CREATE_PREFIX .. self.config .. "." .. self.sectiontype
		local name  = self.map:formvalue(crval)
		if self.anonymous then
			if name then
				created = self:create()
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

				if name and #name > 0 then
					created = self:create(name) and name
					if not created then
						self.invalid_cts = true
					end
				end
			end
		end

		if created then
			AbstractSection.parse_optionals(self, created)
		end
	end

	if created or self.changed then
		self:push_events()
	end
end

-- Verifies scope of sections
function TypedSection.checkscope(self, section)
	-- Check if we are not excluded
	if self.filter and not self:filter(section) then
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

function AbstractValue.__init__(self, map, section, option, ...)
	Node.__init__(self, ...)
	self.section = section
	self.option  = option
	self.map     = map
	self.config  = map.config
	self.tag_invalid = {}
	self.tag_missing = {}
	self.tag_reqerror = {}
	self.tag_error = {}
	self.deps = {}
	--self.cast = "string"

	self.track_missing = false
	self.rmempty   = true
	self.default   = nil
	self.size      = nil
	self.optional  = false
end

function AbstractValue.prepare(self)
	-- Use defaults from UVL
	if not self.override_scheme
	 and self.map:get_scheme(self.section.sectiontype, self.option) then
		local vs = self.map:get_scheme(self.section.sectiontype, self.option)
		if self.cast == nil then
			self.cast = (vs.type == "list") and "list" or "string"
		end
		self.title       = self.title or vs.title
		self.description = self.description or vs.descr
		if self.default == nil then
			self.default = vs.default
		end

		if vs.depends and not self.override_dependencies then
			for i, deps in ipairs(vs.depends) do
				deps = _uvl_strip_remote_dependencies(deps)
				if next(deps) then
					self:depends(deps)
				end
			end
		end
	end

	self.cast = self.cast or "string"
end

-- Add a dependencie to another section field
function AbstractValue.depends(self, field, value)
	local deps
	if type(field) == "string" then
		deps = {}
	 	deps[field] = value
	else
		deps = field
	end

	table.insert(self.deps, {deps=deps, add=""})
end

-- Generates the unique CBID
function AbstractValue.cbid(self, section)
	return "cbid."..self.map.config.."."..section.."."..self.option
end

-- Return whether this object should be created
function AbstractValue.formcreated(self, section)
	local key = "cbi.opt."..self.config.."."..section
	return (self.map:formvalue(key) == self.option)
end

-- Returns the formvalue for this object
function AbstractValue.formvalue(self, section)
	return self.map:formvalue(self:cbid(section))
end

function AbstractValue.additional(self, value)
	self.optional = value
end

function AbstractValue.mandatory(self, value)
	self.rmempty = not value
end

function AbstractValue.parse(self, section, novld)
	local fvalue = self:formvalue(section)
	local cvalue = self:cfgvalue(section)

	if fvalue and #fvalue > 0 then -- If we have a form value, write it to UCI
		fvalue = self:transform(self:validate(fvalue, section))
		if not fvalue and not novld then
			if self.error then
				self.error[section] = "invalid"
			else
				self.error = { [section] = "invalid" }
			end
			if self.section.error then
				table.insert(self.section.error[section], "invalid")
			else
				self.section.error = {[section] = {"invalid"}}
			end 
			self.map.save = false
		end
		if fvalue and not (fvalue == cvalue) then
			if self:write(section, fvalue) then
				-- Push events
				self.section.changed = true
				--luci.util.append(self.map.events, self.events)
			end
		end
	else							-- Unset the UCI or error
		if self.rmempty or self.optional then
			if self:remove(section) then
				-- Push events
				self.section.changed = true
				--luci.util.append(self.map.events, self.events)
			end
		elseif cvalue ~= fvalue and not novld then
			self:write(section, fvalue or "")
			if self.error then
				self.error[section] = "missing"
			else
				self.error = { [section] = "missing" }
			end
			self.map.save = false
		end
	end
end

-- Render if this value exists or if it is mandatory
function AbstractValue.render(self, s, scope)
	if not self.optional or self:cfgvalue(s) or self:formcreated(s) then
		scope = scope or {}
		scope.section   = s
		scope.cbid      = self:cbid(s)
		scope.striptags = luci.util.striptags

		scope.ifattr = function(cond,key,val)
			if cond then
				return string.format(
					' %s="%s"', tostring(key),
					luci.util.pcdata(tostring( val
					 or scope[key]
					 or (type(self[key]) ~= "function" and self[key])
					 or "" ))
				)
			else
				return ''
			end
		end

		scope.attr = function(...)
			return scope.ifattr( true, ... )
		end

		Node.render(self, scope)
	end
end

-- Return the UCI value of this object
function AbstractValue.cfgvalue(self, section)
	local value = self.map:get(section, self.option)
	if not value then
		return nil
	elseif not self.cast or self.cast == type(value) then
		return value
	elseif self.cast == "string" then
		if type(value) == "table" then
			return value[1]
		end
	elseif self.cast == "table" then
		return luci.util.split(value, "%s+", nil, true)
	end
end

-- Validate the form value
function AbstractValue.validate(self, value)
	return value
end

AbstractValue.transform = AbstractValue.validate


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
]]--
Value = class(AbstractValue)

function Value.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/value"
	self.keylist = {}
	self.vallist = {}
end

function Value.value(self, key, val)
	val = val or key
	table.insert(self.keylist, tostring(key))
	table.insert(self.vallist, tostring(val))
end


-- DummyValue - This does nothing except being there
DummyValue = class(AbstractValue)

function DummyValue.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template = "cbi/dvalue"
	self.value = nil
end

function DummyValue.cfgvalue(self, section)
	local value
	if self.value then
		if type(self.value) == "function" then
			value = self:value(section)
		else
			value = self.value
		end
	else
		value = AbstractValue.cfgvalue(self, section)
	end
	return value
end

function DummyValue.parse(self)

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

function ListValue.prepare(self, ...)
	AbstractValue.prepare(self, ...)
	if not self.override_scheme
	 and self.map:get_scheme(self.section.sectiontype, self.option) then
		local vs = self.map:get_scheme(self.section.sectiontype, self.option)
		if self.value and vs.valuelist and not self.override_values then
			for k, v in ipairs(vs.valuelist) do
				local deps = {}
				if not self.override_dependencies
				 and vs.enum_depends and vs.enum_depends[v.value] then
					for i, dep in ipairs(vs.enum_depends[v.value]) do
						table.insert(deps, _uvl_strip_remote_dependencies(dep))
					end
				end
				self:value(v.value, v.title or v.value, unpack(deps))
			end
		end
	end
end

function ListValue.value(self, key, val, ...)
	if luci.util.contains(self.keylist, key) then
		return
	end

	val = val or key
	table.insert(self.keylist, tostring(key))
	table.insert(self.vallist, tostring(val))

	for i, deps in ipairs({...}) do
		table.insert(self.deps, {add = "-"..key, deps=deps})
	end
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

function MultiValue.render(self, ...)
	if self.widget == "select" and not self.size then
		self.size = #self.vallist
	end

	AbstractValue.render(self, ...)
end

function MultiValue.value(self, key, val)
	if luci.util.contains(self.keylist, key) then
		return
	end

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
	val = (type(val) == "table") and val or {val}

	local result

	for i, value in ipairs(val) do
		if luci.util.contains(self.keylist, value) then
			result = result and (result .. self.delimiter .. value) or value
		end
	end

	return result
end


StaticList = class(MultiValue)

function StaticList.__init__(self, ...)
	MultiValue.__init__(self, ...)
	self.cast = "table"
	self.valuelist = self.cfgvalue

	if not self.override_scheme
	 and self.map:get_scheme(self.section.sectiontype, self.option) then
		local vs = self.map:get_scheme(self.section.sectiontype, self.option)
		if self.value and vs.values and not self.override_values then
			for k, v in pairs(vs.values) do
				self:value(k, v)
			end
		end
	end
end

function StaticList.validate(self, value)
	value = (type(value) == "table") and value or {value}

	local valid = {}
	for i, v in ipairs(value) do
		if luci.util.contains(self.keylist, v) then
			table.insert(valid, v)
		end
	end
	return valid
end


DynamicList = class(AbstractValue)

function DynamicList.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/dynlist"
	self.cast = "table"
	self.keylist = {}
	self.vallist = {}
end

function DynamicList.value(self, key, val)
	val = val or key
	table.insert(self.keylist, tostring(key))
	table.insert(self.vallist, tostring(val))
end

function DynamicList.write(self, ...)
	self.map.proceed = true
	return AbstractValue.write(self, ...)
end

function DynamicList.formvalue(self, section)
	local value = AbstractValue.formvalue(self, section)
	value = (type(value) == "table") and value or {value}

	local valid = {}
	for i, v in ipairs(value) do
		if v and #v > 0
		 and not self.map:formvalue("cbi.rle."..section.."."..self.option.."."..i)
		 and not self.map:formvalue("cbi.rle."..section.."."..self.option.."."..i..".x") then
			table.insert(valid, v)
		end
	end

	return valid
end


--[[
TextValue - A multi-line value
	rows:	Rows
]]--
TextValue = class(AbstractValue)

function TextValue.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/tvalue"
end

--[[
Button
]]--
Button = class(AbstractValue)

function Button.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template  = "cbi/button"
	self.inputstyle = nil
	self.rmempty = true
end


FileUpload = class(AbstractValue)

function FileUpload.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template = "cbi/upload"
	if not self.map.upload_fields then
		self.map.upload_fields = { self }
	else
		self.map.upload_fields[#self.map.upload_fields+1] = self
	end
end

function FileUpload.formcreated(self, section)
	return AbstractValue.formcreated(self, section) or
		self.map:formvalue("cbi.rlf."..section.."."..self.option) or
		self.map:formvalue("cbi.rlf."..section.."."..self.option..".x")
end

function FileUpload.cfgvalue(self, section)
	local val = AbstractValue.cfgvalue(self, section)
	if val and fs.access(val) then
		return val
	end
	return nil
end

function FileUpload.formvalue(self, section)
	local val = AbstractValue.formvalue(self, section)
	if val then
		if not self.map:formvalue("cbi.rlf."..section.."."..self.option) and
		   not self.map:formvalue("cbi.rlf."..section.."."..self.option..".x")
		then
			return val
		end
		fs.unlink(val)
		self.value = nil
	end
	return nil
end

function FileUpload.remove(self, section)
	local val = AbstractValue.formvalue(self, section)
	if val and fs.access(val) then fs.unlink(val) end
	return AbstractValue.remove(self, section)
end


FileBrowser = class(AbstractValue)

function FileBrowser.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template = "cbi/browser"
end
