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


-- Node pseudo abstract class
Node = ffluci.util.class()
function Node.render(self)
end
function Node.append(self, obj)
end


Map = ffluci.util.class(Node)
