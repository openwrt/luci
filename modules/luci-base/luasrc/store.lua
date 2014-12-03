--[[

LuCI - Lua Development Framework
(c) 2009 Steven Barth <steven@midlink.org>
(c) 2009 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

local util = require "luci.util"
module("luci.store", util.threadlocal)