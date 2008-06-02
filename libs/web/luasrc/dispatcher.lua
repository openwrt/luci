--[[
LuCI - Dispatcher

Description:
The request dispatcher and module dispatcher generators

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
module("luci.dispatcher", package.seeall)
require("luci.http")
require("luci.sys")
require("luci.fs")

-- Dirty OpenWRT fix
if (os.time() < luci.fs.mtime(luci.sys.libpath() .. "/dispatcher.lua")) then
	os.execute('date -s '..os.date('%m%d%H%M%Y', luci.fs.mtime(luci.sys.libpath() .. "/dispatcher.lua"))..' > /dev/null 2>&1')
end

-- Local dispatch database
local tree = {nodes={}}

-- Index table
local index = {}

-- Global request object
request = {}

-- Active dispatched node
dispatched = nil

-- Status fields
built_index = false
built_tree  = false

-- Fastindex
local fi


-- Builds a URL
function build_url(...)
	return luci.http.dispatcher() .. "/" .. table.concat(arg, "/")
end

-- Prints an error message or renders the "error401" template if available
function error401(message)
	message = message or "Unauthorized"

	require("luci.template")
	if not pcall(luci.template.render, "error401") then
		luci.http.prepare_content("text/plain")
		print(message)
	end
	return false
end

-- Sends a 404 error code and renders the "error404" template if available
function error404(message)
	luci.http.status(404, "Not Found")
	message = message or "Not Found"

	require("luci.template")
	if not pcall(luci.template.render, "error404") then
		luci.http.prepare_content("text/plain")
		print(message)
	end
	return false
end

-- Sends a 500 error code and renders the "error500" template if available
function error500(message)
	luci.http.status(500, "Internal Server Error")

	require("luci.template")
	if not pcall(luci.template.render, "error500", {message=message}) then
		luci.http.prepare_content("text/plain")
		print(message)
	end
	return false
end

-- Creates a request object for dispatching
function httpdispatch()
	local pathinfo = luci.http.env.PATH_INFO or ""
	local c = tree

	for s in pathinfo:gmatch("([%w-]+)") do
		table.insert(request, s)
	end

	dispatch()
end

-- Dispatches a request
function dispatch()
	if not built_tree then
		createtree()
	end

	local c = tree
	local track = {}

	for i, s in ipairs(request) do
		c = c.nodes[s]
		if not c or c.leaf then
			break
		end

		for k, v in pairs(c) do
			track[k] = v
		end
	end

	if track.sysauth then
		local accs = track.sysauth
		accs = (type(accs) == "string") and {accs} or accs
		
		local function sysauth(user, password)
			return (luci.util.contains(accs, user)
				and luci.sys.user.checkpasswd(user, password)) 
		end
		
		if not luci.http.basic_auth(sysauth) then
			error401()
			return
		end
	end

	if track.i18n then
		require("luci.i18n").loadc(track.i18n)
	end

	if track.setgroup then
		luci.sys.process.setgroup(track.setgroup)
	end

	if track.setuser then
		luci.sys.process.setuser(track.setuser)
	end
	
	-- Init template engine
	local tpl = require("luci.template")
	tpl.viewns.translate   = function(...) return require("luci.i18n").translate(...) end
	tpl.viewns.controller  = luci.http.dispatcher()
	tpl.viewns.uploadctrl  = luci.http.dispatcher_upload()
	tpl.viewns.media       = luci.config.main.mediaurlbase
	tpl.viewns.resource    = luci.config.main.resourcebase
	tpl.viewns.REQUEST_URI = luci.http.env.SCRIPT_NAME .. luci.http.env.PATH_INFO
	

	if c and type(c.target) == "function" then
		dispatched = c
		stat, mod = pcall(require, c.module)
		if stat then
			luci.util.updfenv(c.target, mod)
		end
		
		stat, err = pcall(c.target)
		if not stat then
			error500(err)
		end
	else
		error404()
	end
end

-- Generates the dispatching tree
function createindex()
	index = {}
	local path = luci.sys.libpath() .. "/controller/"
	local suff = ".lua"
	
	if pcall(require, "luci.fastindex") then
		createindex_fastindex(path, suff)
	else
		createindex_plain(path, suff)
	end
	
	built_index = true
end

-- Uses fastindex to create the dispatching tree
function createindex_fastindex(path, suffix)	
	if not fi then
		fi = luci.fastindex.new("index")
		fi.add(path .. "*" .. suffix)
		fi.add(path .. "*/*" .. suffix)
	end
	fi.scan()
	
	for k, v in pairs(fi.indexes) do
		index[v[2]] = v[1]
	end
end

-- Calls the index function of all available controllers
-- Fallback for transition purposes / Leave it in as long as it works otherwise throw it away
function createindex_plain(path, suffix)
	if built_index then
		return
	end

	local cache = nil 
	
	local controllers = luci.util.combine(
		luci.fs.glob(path .. "*" .. suffix) or {},
		luci.fs.glob(path .. "*/*" .. suffix) or {}
	)
	
	if indexcache then
		cache = luci.fs.mtime(indexcache)
		
		if not cache then
			luci.fs.mkdir(indexcache)
			luci.fs.chmod(indexcache, "a=,u=rwx")
			cache = luci.fs.mtime(indexcache)
		end
	end

	for i,c in ipairs(controllers) do
		local module = "luci.controller." .. c:sub(#path+1, #c-#suffix):gsub("/", ".")
		local cachefile
		local stime
		local ctime
		
		if cache then
			cachefile = indexcache .. "/" .. module
			stime = luci.fs.mtime(c) or 0
			ctime = luci.fs.mtime(cachefile) or 0
		end
		
		if not cache or stime > ctime then 
			stat, mod = pcall(require, module)
	
			if stat and mod and type(mod.index) == "function" then
				index[module] = mod.index
				
				if cache then
					luci.fs.writefile(cachefile, luci.util.dump(mod.index))
				end
			end
		else
			index[module] = loadfile(cachefile)
		end
	end
end

-- Creates the dispatching tree from the index
function createtree()
	if not built_index then
		createindex()
	end
	
	require("luci.i18n")
		
	-- Load default translation
	luci.i18n.loadc("default")
	
	local scope = luci.util.clone(_G)
	for k,v in pairs(_M) do
		if type(v) == "function" then
			scope[k] = v
		end
	end

	for k, v in pairs(index) do
		scope._NAME = k
		setfenv(v, scope)
		
		local stat, err = pcall(v)
		if not stat then
			error500(err)	
			os.exit(1)
		end
	end
	
	built_tree = true
end

-- Shortcut for creating a dispatching node
function entry(path, target, title, order, add)
	add = add or {}

	local c = node(path)
	c.target = target
	c.title  = title
	c.order  = order
	c.module = getfenv(2)._NAME

	for k,v in pairs(add) do
		c[k] = v
	end

	return c
end

-- Fetch a dispatching node
function node(...)
	local c = tree

	if arg[1] and type(arg[1]) == "table" then
		arg = arg[1]
	end

	for k,v in ipairs(arg) do
		if not c.nodes[v] then
			c.nodes[v] = {nodes={}, module=getfenv(2)._NAME}
		end

		c = c.nodes[v]
	end

	return c
end

-- Subdispatchers --
function alias(...)
	local req = arg
	return function()
		request = req
		dispatch()
	end
end

function rewrite(n, ...)
	local req = arg
	return function()
		for i=1,n do 
			table.remove(request, 1)
		end
		
		for i,r in ipairs(req) do
			table.insert(request, i, r)
		end
		
		dispatch()
	end
end

function call(name)
	return function() getfenv()[name]() end
end

function template(name)
	require("luci.template")
	return function() luci.template.render(name) end
end

function cbi(model)
	require("luci.cbi")
	require("luci.template")

	return function()
		local stat, res = pcall(luci.cbi.load, model)
		if not stat then
			error500(res)
			return true
		end

		local stat, err = pcall(res.parse, res)
		if not stat then
			error500(err)
			return true
		end

		luci.template.render("cbi/header")
		res:render()
		luci.template.render("cbi/footer")
	end
end
