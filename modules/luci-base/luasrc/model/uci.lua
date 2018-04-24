-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

local os    = require "os"
local util  = require "luci.util"
local table = require "table"


local setmetatable, rawget, rawset = setmetatable, rawget, rawset
local require, getmetatable, assert = require, getmetatable, assert
local error, pairs, ipairs = error, pairs, ipairs
local type, tostring, tonumber, unpack = type, tostring, tonumber, unpack

-- The typical workflow for UCI is:  Get a cursor instance from the
-- cursor factory, modify data (via Cursor.add, Cursor.delete, etc.),
-- save the changes to the staging area via Cursor.save and finally
-- Cursor.commit the data to the actual config files.
-- LuCI then needs to Cursor.apply the changes so deamons etc. are
-- reloaded.
module "luci.model.uci"

local ERRSTR = {
	"Invalid command",
	"Invalid argument",
	"Method not found",
	"Entry not found",
	"No data",
	"Permission denied",
	"Timeout",
	"Not supported",
	"Unknown error",
	"Connection failed"
}

local session_id = nil

local function call(cmd, args)
	if type(args) == "table" and session_id then
		args.ubus_rpc_session = session_id
	end
	return util.ubus("uci", cmd, args)
end


function cursor()
	return _M
end

function cursor_state()
	return _M
end

function substate(self)
	return self
end


function get_confdir(self)
	return "/etc/config"
end

function get_savedir(self)
	return "/tmp/.uci"
end

function get_session_id(self)
	return session_id
end

function set_confdir(self, directory)
	return false
end

function set_savedir(self, directory)
	return false
end

function set_session_id(self, id)
	session_id = id
	return true
end


function load(self, config)
	return true
end

function save(self, config)
	return true
end

function unload(self, config)
	return true
end


function changes(self, config)
	local rv = call("changes", { config = config })
	local res = {}

	if type(rv) == "table" and type(rv.changes) == "table" then
		local package, changes
		for package, changes in pairs(rv.changes) do
			res[package] = {}

			local _, change
			for _, change in ipairs(changes) do
				local operation, section, option, value = unpack(change)
				if option and value and operation ~= "add" then
					res[package][section] = res[package][section] or { }

					if operation == "list-add" then
						local v = res[package][section][option]
						if type(v) == "table" then
							v[#v+1] = value or ""
						elseif v ~= nil then
							res[package][section][option] = { v, value }
						else
							res[package][section][option] = { value }
						end
					else
						res[package][section][option] = value or ""
					end
				else
					res[package][section] = res[package][section] or {}
					res[package][section][".type"] = option or ""
				end
			end
		end
	end

	return res
end


function revert(self, config)
	local _, err = call("revert", { config = config })
	return (err == nil), ERRSTR[err]
end

function commit(self, config)
	local _, err = call("commit", { config = config })
	return (err == nil), ERRSTR[err]
end

--[[
function apply(self, configs, command)
	local _, config

	assert(not command, "Apply command not supported anymore")

	if type(configs) == "table" then
		for _, config in ipairs(configs) do
			call("service", "event", {
				type = "config.change",
				data = { package = config }
			})
		end
	end
end
]]


function foreach(self, config, stype, callback)
	if type(callback) == "function" then
		local rv, err = call("get", {
			config = config,
			type   = stype
		})

		if type(rv) == "table" and type(rv.values) == "table" then
			local sections = { }
			local res = false
			local index = 1

			local _, section
			for _, section in pairs(rv.values) do
				section[".index"] = section[".index"] or index
				sections[index] = section
				index = index + 1
			end

			table.sort(sections, function(a, b)
				return a[".index"] < b[".index"]
			end)

			for _, section in ipairs(sections) do
				local continue = callback(section)
				res = true
				if continue == false then
					break
				end
			end
			return res
		else
			return false, ERRSTR[err] or "No data"
		end
	else
		return false, "Invalid argument"
	end
end

local function _get(self, operation, config, section, option)
	if section == nil then
		return nil
	elseif type(option) == "string" and option:byte(1) ~= 46 then
		local rv, err = call(operation, {
			config  = config,
			section = section,
			option  = option
		})

		if type(rv) == "table" then
			return rv.value or nil
		elseif err then
			return false, ERRSTR[err]
		else
			return nil
		end
	elseif option == nil then
		local values = self:get_all(config, section)
		if values then
			return values[".type"], values[".name"]
		else
			return nil
		end
	else
		return false, "Invalid argument"
	end
end

function get(self, ...)
	return _get(self, "get", ...)
end

function get_state(self, ...)
	return _get(self, "state", ...)
end

function get_all(self, config, section)
	local rv, err = call("get", {
		config  = config,
		section = section
	})

	if type(rv) == "table" and type(rv.values) == "table" then
		return rv.values
	elseif err then
		return false, ERRSTR[err]
	else
		return nil
	end
end

function get_bool(self, ...)
	local val = self:get(...)
	return (val == "1" or val == "true" or val == "yes" or val == "on")
end

function get_first(self, config, stype, option, default)
	local rv = default

	self:foreach(config, stype, function(s)
		local val = not option and s[".name"] or s[option]

		if type(default) == "number" then
			val = tonumber(val)
		elseif type(default) == "boolean" then
			val = (val == "1" or val == "true" or
			       val == "yes" or val == "on")
		end

		if val ~= nil then
			rv = val
			return false
		end
	end)

	return rv
end

function get_list(self, config, section, option)
	if config and section and option then
		local val = self:get(config, section, option)
		return (type(val) == "table" and val or { val })
	end
	return { }
end


function section(self, config, stype, name, values)
	local rv, err = call("add", {
		config = config,
		type   = stype,
		name   = name,
		values = values
	})

	if type(rv) == "table" then
		return rv.section
	elseif err then
		return false, ERRSTR[err]
	else
		return nil
	end
end


function add(self, config, stype)
	return self:section(config, stype)
end

function set(self, config, section, option, value)
	if value == nil then
		local sname, err = self:section(config, option, section)
		return (not not sname), err
	else
		local _, err = call("set", {
			config  = config,
			section = section,
			values  = { [option] = value }
		})
		return (err == nil), ERRSTR[err]
	end
end

function set_list(self, config, section, option, value)
	if section == nil or option == nil then
		return false
	elseif value == nil or (type(value) == "table" and #value == 0) then
		return self:delete(config, section, option)
	elseif type(value) == "table" then
		return self:set(config, section, option, value)
	else
		return self:set(config, section, option, { value })
	end
end

function tset(self, config, section, values)
	local _, err = call("set", {
		config  = config,
		section = section,
		values  = values
	})
	return (err == nil), ERRSTR[err]
end

function reorder(self, config, section, index)
	local sections

	if type(section) == "string" and type(index) == "number" then
		local pos = 0

		sections = { }

		self:foreach(config, nil, function(s)
			if pos == index then
				pos = pos + 1
			end

			if s[".name"] ~= section then
				pos = pos + 1
				sections[pos] = s[".name"]
			else
				sections[index + 1] = section
			end
		end)
	elseif type(section) == "table" then
		sections = section
	else
		return false, "Invalid argument"
	end

	local _, err = call("order", {
		config   = config,
		sections = sections
	})

	return (err == nil), ERRSTR[err]
end


function delete(self, config, section, option)
	local _, err = call("delete", {
		config  = config,
		section = section,
		option  = option
	})
	return (err == nil), ERRSTR[err]
end

function delete_all(self, config, stype, comparator)
	local _, err
	if type(comparator) == "table" then
		_, err = call("delete", {
			config = config,
			type   = stype,
			match  = comparator
		})
	elseif type(comparator) == "function" then
		local rv = call("get", {
			config = config,
			type   = stype
		})

		if type(rv) == "table" and type(rv.values) == "table" then
			local sname, section
			for sname, section in pairs(rv.values) do
				if comparator(section) then
					_, err = call("delete", {
						config  = config,
						section = sname
					})
				end
			end
		end
	elseif comparator == nil then
		_, err = call("delete", {
			config  = config,
			type    = stype
		})
	else
		return false, "Invalid argument"
	end

	return (err == nil), ERRSTR[err]
end


function apply(self, configlist, command)
	configlist = self:_affected(configlist)
	if command then
		return { "/sbin/luci-reload", unpack(configlist) }
	else
		return os.execute("/sbin/luci-reload %s >/dev/null 2>&1"
			% util.shellquote(table.concat(configlist, " ")))
	end
end

-- Return a list of initscripts affected by configuration changes.
function _affected(self, configlist)
	configlist = type(configlist) == "table" and configlist or { configlist }

	-- Resolve dependencies
	local reloadlist = { }

	local function _resolve_deps(name)
		local reload = { name }
		local deps = { }

		self:foreach("ucitrack", name,
			function(section)
				if section.affects then
					for i, aff in ipairs(section.affects) do
						deps[#deps+1] = aff
					end
				end
			end)

		local i, dep
		for i, dep in ipairs(deps) do
			local j, add
			for j, add in ipairs(_resolve_deps(dep)) do
				reload[#reload+1] = add
			end
		end

		return reload
	end

	-- Collect initscripts
	local j, config
	for j, config in ipairs(configlist) do
		local i, e
		for i, e in ipairs(_resolve_deps(config)) do
			if not util.contains(reloadlist, e) then
				reloadlist[#reloadlist+1] = e
			end
		end
	end

	return reloadlist
end
