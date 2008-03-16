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
require("ffluci.util")
local class = ffluci.util.class


-- Node pseudo abstract class
Node = class()

function Node.__init__(self, title, description)
	self.children = {}
	self.title = title
	self.description = description
end

function Node.append(self, obj)
	table.insert(self.children, obj)
end


-- CBI Map
Map = class(Node)

function Map.__init__(self, ...)
	Node.__init__(self, ...)
end

function Map.render(self, template)
	-- ToDo
end
