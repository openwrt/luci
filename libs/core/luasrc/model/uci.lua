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
module("luci.model.uci", package.seeall)

-- Default savedir
savedir = "/tmp/.uci"

-- Test whether to load libuci-Wrapper or /sbin/uci-Wrapper
if pcall(require, "uci") then
	Session = require("luci.model.uci.libuci").Session
else
	Session = require("luci.model.uci.wrapper").Session
end

-- The default Session
local default = Session()
local state   = Session("/var/state")

-- The state Session
function StateSession()
	return state
end


-- Wrapper for "uci add"
function add(...)
	return default:add(...)
end


-- Wrapper for "uci changes"
function changes(...)
	return default:changes(...)
end

-- Wrapper for "uci commit"
function commit(...)
	return default:commit(...)
end


-- Wrapper for "uci del"
function del(...)
	return default:del(...)
end


-- Wrapper for "uci get"
function get(...)
	return default:get(...)
end


-- Wrapper for "uci revert"
function revert(...)
	return default:revert(...)
end


-- Wrapper for "uci show"
function sections(...)
	return default:sections(...)
end


-- Wrapper for "uci set"
function set(...)
	return default:set(...)
end