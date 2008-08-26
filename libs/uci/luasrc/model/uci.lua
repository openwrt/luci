--[[
LuCI - UCI mpdel

Description:
Generalized UCI model

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
local uci   = require "uci"
local util  = require "luci.util"
local table = require "table"

local setmetatable, rawget, rawset = setmetatable, rawget, rawset
local error, pairs, ipairs, tostring = error, pairs, ipairs, tostring
local require = require

--- LuCI UCI model library.
module("luci.model.uci", function(m) setmetatable(m, {__index = uci}) end)

savedir_default = "/tmp/.uci"
confdir_default = "/etc/config"

savedir_state = "/var/state"


--- Applies the new config
-- @param config		UCI config
function apply(config)
	local conf = require "luci.config"
	return conf.uci_oncommit[config] and os.execute(conf.uci_oncommit[config])
end

--- Delete all sections of a given type that match certain criteria.
-- @param config		UCI config
-- @param type			UCI section type
-- @param comparator	Function that will be called for each section and
-- returns a boolean whether to delete the current section (optional)
function delete_all(config, type, comparator)
	local del = {}
	local function helper (section)
			if not comparator or comparator(section) then
				table.insert(del, section[".name"])
			end
	end

	foreach(config, type, helper)

	for i, j in ipairs(del) do
		delete(config, j)
	end
end

--- Create a new section and initialize it with data.
-- @param config	UCI config
-- @param type		UCI section type
-- @param name		UCI section name (optional)
-- @param values	Table of key - value pairs to initialize the section with
-- @return			Name of created section
function section(config, type, name, values)
	local stat = true
	if name then
		stat = set(config, name, type)
	else
		name = add(config, type)
		stat = name and true
	end

	if stat and values then
		stat = tset(config, name, values)
	end

	return stat and name
end

--- Savely load the configuration.
-- @param config	Configuration to load
-- @return			Sucess status
-- @see				load_state
-- @see				load
function load_config(...)
	set_confdir(confdir_default)
	set_savedir(savedir_default)
	return load(...)
end

--- Savely load state values.
-- @param config	Configuration to load
-- @return			Sucess status
-- @see				load_config
-- @see				load
function load_state(config)
	set_confdir(confdir_default)
	set_savedir(savedir_state)
	return load(config)
end

--- Save changes to config values.
-- @param config	Configuration to save
-- @return			Sucess status
-- @see				save_state
-- @see				save
function save_config(config)
	set_savedir(savedir_default)
	return save(config)
end

--- Save changes to state values.
-- @param config	Configuration to save
-- @return			Sucess status
-- @see				save_config
-- @see				save
function save_state(config)
	set_savedir(savedir_state)
	return save(config)
end

--- Updated the data of a section using data from a table.
-- @param config	UCI config
-- @param section	UCI section name (optional)
-- @param values	Table of key - value pairs to update the section with
function tset(config, section, values)
	local stat = true
	for k, v in pairs(values) do
		if k:sub(1, 1) ~= "." then
			stat = stat and set(config, section, k, v)
		end
	end
	return stat
end

--- Get an option or list and return values as table.
-- @param config	UCI config
-- @param section	UCI section name
-- @param option	UCI option
-- @return			UCI value
function get_list(config, section, option)
	if config and section and option then
		local val = get(config, section, option)
		return ( type(val) == "table" and val or { val } )
	end
	return nil
end

--- Set given values as list.
-- @param config	UCI config
-- @param section	UCI section name
-- @param option	UCI option
-- @param value		UCI value
-- @return			Boolean whether operation succeeded
function set_list(config, section, option, value)
	if config and section and option then
		return set(
			config, section, option,
			( type(value) == "table" and value or { value } )
		)
	end
	return false
end


--- Add an anonymous section.
-- @class function
-- @name add
-- @param config	UCI config
-- @param type		UCI section type
-- @return			Name of created section

--- Get a table of unsaved changes.
-- @class function
-- @name changes
-- @param config	UCI config
-- @return			Table of changes

--- Commit unsaved changes.
-- @class function
-- @name commit
-- @param config	UCI config
-- @return			Boolean whether operation succeeded
-- @see revert

--- Deletes a section or an option.
-- @class function
-- @name delete
-- @param config	UCI config
-- @param section	UCI section name
-- @param option	UCI option (optional)
-- @return			Boolean whether operation succeeded

--- Call a function for every section of a certain type.
-- @class function
-- @name foreach
-- @param config	UCI config
-- @param type		UCI section type
-- @param callback	Function to be called
-- @return			Boolean whether operation succeeded

--- Get a section type or an option
-- @class function
-- @name get
-- @param config	UCI config
-- @param section	UCI section name
-- @param option	UCI option (optional)
-- @return			UCI value

--- Get all sections of a config or all values of a section.
-- @class function
-- @name get_all
-- @param config	UCI config
-- @param section	UCI section name (optional)
-- @return			Table of UCI sections or table of UCI values

--- Manually load a config.
-- Warning: This function is unsave! You should use load_config or load_state if possible.
-- @class function
-- @name load
-- @param config	UCI config
-- @return			Boolean whether operation succeeded
-- @see load_config
-- @see load_state
-- @see save
-- @see unload

--- Revert unsaved changes.
-- @class function
-- @name revert
-- @param config	UCI config
-- @return			Boolean whether operation succeeded
-- @see commit

--- Saves changes made to a config to make them committable.
-- @class function
-- @name save
-- @param config	UCI config
-- @return			Boolean whether operation succeeded
-- @see load
-- @see unload

--- Set a value or create a named section.
-- @class function
-- @name set
-- @param config	UCI config
-- @param section	UCI section name
-- @param option	UCI option or UCI section type
-- @param value		UCI value or nil if you want to create a section
-- @return			Boolean whether operation succeeded

--- Set the configuration directory.
-- @class function
-- @name set_confdir
-- @param directory	UCI configuration directory
-- @return			Boolean whether operation succeeded

--- Set the directory for uncommited changes.
-- @class function
-- @name set_savedir
-- @param directory	UCI changes directory
-- @return			Boolean whether operation succeeded

--- Discard changes made to a config.
-- @class function
-- @name unload
-- @param config	UCI config
-- @return			Boolean whether operation succeeded
-- @see load
-- @see save
