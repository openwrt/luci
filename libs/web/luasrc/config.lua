--[[
LuCI - Configuration

Description:
Some LuCI configuration values read from uci file "luci"


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

local uci  = require("luci.model.uci")
local util = require("luci.util")
module("luci.config")

-- Warning! This is only for fallback and compatibility purporses! --
main = {}

-- This is where stylesheets and images go
main.mediaurlbase = "/luci/media"

-- Does anybody think about browser autodetect here?
-- Too bad busybox doesn't populate HTTP_ACCEPT_LANGUAGE
main.lang = "de"


-- Now overwrite with UCI values
local ucidata = uci.sections("luci")
if ucidata then
	util.update(_M, ucidata)
end