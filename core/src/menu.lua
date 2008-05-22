--[[
FFLuCI - Menu Builder

Description:
Collects menu building information from controllers

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
module("ffluci.menu", package.seeall)

require("ffluci.fs")
require("ffluci.util")
require("ffluci.sys")
require("ffluci.dispatcher")

-- Default modelpath
modelpattern = ffluci.sys.libpath() .. "/model/menu/*.lua"

-- Menu definition extra scope
scope = {
	translate = function(...) return require("ffluci.i18n").translate(...) end,
	loadtrans = function(...) return require("ffluci.i18n").loadc(...) end,
	isfile    = ffluci.fs.isfile
}

-- Returns the menu information
function get()
	return menu
end