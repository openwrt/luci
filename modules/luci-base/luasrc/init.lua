--[[
LuCI - Lua Configuration Interface

Description:
Main class

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

local require = require

-- Make sure that bitlib is loaded
if not _G.bit then
	_G.bit = require "bit"
end

module "luci"

local v = require "luci.version"

__version__ = v.luciversion or "trunk"
__appname__ = v.luciname    or "LuCI"
