--[[
LuCI - UCI libuci wrapper

Description:
Wrapper for the libuci Lua bindings

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

module("luci.model.uci.libuci", package.seeall)

require("uci")
require("luci.util")
require("luci.sys")

-- Session class
Session = luci.util.class()

-- Session constructor
function Session.__init__(self, savedir)
	self.savedir = savedir or luci.model.uci.savedir
	uci.set_savedir(self.savedir)
end

function Session.add(self, config, section_type)
	return uci.add(config, section_type)
end

function Session.changes(self, config)
	if config then
		return uci.changes(config)
	else
		return uci.changes()
	end
end

function Session.commit(self, config)
	return self:t_commit(config)
end

function Session.del(self, config, section, option)
	return uci.del(config, section, option)
end

function Session.get(self, config, section, option)
	return self:t_get(config, section, option)
end

function Session.revert(self, config)
	return self:t_revert(config)
end

function Session.sections(self, config)
	return self:t_sections(config)
end

function Session.set(self, config, section, option, value)
	return self:t_set(config, section, option, value) and self:t_save(config)
end

function Session.synchronize(self)
	return uci.set_savedir(self.savedir)
end


-- UCI-Transactions

function Session.t_load(self, config)
	return self:synchronize() and uci.load(config)
end

function Session.t_save(self, config)
	return uci.save(config)
end

function Session.t_add(self, config, type)
	return self:add(config, type)
end

function Session.t_commit(self, config)
	return uci.commit(config)
end

function Session.t_del(self, config, section, option)
	return self:del(config, section, option)
end

function Session.t_get(self, config, section, option)
	if option then
		return uci.get(config, section, option)
	else
		return uci.get(config, section)
	end
end

function Session.t_revert(self, config)
	return uci.revert(config)
end

function Session.t_sections(self, config)
	return uci.get_all(config)
end

function Session.t_set(self, config, section, option, value)
	if option then
		return uci.set(config, section, option, value)
	else
		return uci.set(config, section, value)
	end
end

