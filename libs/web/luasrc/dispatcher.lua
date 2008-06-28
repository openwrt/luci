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
require("luci.init")
require("luci.http")
require("luci.sys")
require("luci.fs")

context = luci.util.threadlocal()

-- Index table
local index = nil

-- Fastindex
local fi


-- Builds a URL
function build_url(...)
	return luci.http.getenv("SCRIPT_NAME") .. "/" .. table.concat(arg, "/")
end

-- Sends a 404 error code and renders the "error404" template if available
function error404(message)
	luci.http.status(404, "Not Found")
	message = message or "Not Found"

	require("luci.template")
	if not luci.util.copcall(luci.template.render, "error404") then
		luci.http.prepare_content("text/plain")
		luci.http.write(message)
	end
	return false
end

-- Sends a 500 error code and renders the "error500" template if available
function error500(message)
	luci.http.status(500, "Internal Server Error")

	require("luci.template")
	if not luci.util.copcall(luci.template.render, "error500", {message=message}) then
		luci.http.prepare_content("text/plain")
		luci.http.write(message)
	end
	return false
end

-- Renders an authorization form
function sysauth(default)
	local user = luci.http.formvalue("username")
	local pass = luci.http.formvalue("password")
	
	if user and luci.sys.user.checkpasswd(user, pass) then
		local sid = luci.sys.uniqueid(16)
		luci.http.header("Set-Cookie", "sysauth=" .. sid)
		luci.sauth.write(sid, user)
		return true
	else
		require("luci.i18n")
		require("luci.template")
		context.path = {}
		luci.template.render("sysauth", {duser=default, fuser=user})
		return false
	end
end

-- Creates a request object for dispatching
function httpdispatch(request)
	luci.http.context.request = request
	context.request = {}
	local pathinfo = request:getenv("PATH_INFO") or ""

	for node in pathinfo:gmatch("[^/]+") do
		table.insert(context.request, node)
	end

	dispatch(context.request)
	luci.http.close()
end

-- Dispatches a request
function dispatch(request)
	context.path = request
	
	require("luci.i18n")
	luci.i18n.setlanguage(require("luci.config").main.lang)
	
	if not context.tree then
		createtree()
	end
	
	local c = context.tree
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

	if track.i18n then
		require("luci.i18n").loadc(track.i18n)
	end
	
	-- Init template engine
	local tpl = require("luci.template")
	local viewns = {}
	tpl.context.viewns = viewns
	viewns.write       = luci.http.write
	viewns.translate   = function(...) return require("luci.i18n").translate(...) end
	viewns.controller  = luci.http.getenv("SCRIPT_NAME")
	viewns.media       = luci.config.main.mediaurlbase
	viewns.resource    = luci.config.main.resourcebase
	viewns.REQUEST_URI = luci.http.getenv("SCRIPT_NAME") .. (luci.http.getenv("PATH_INFO") or "")
	
	if track.sysauth then
		require("luci.sauth")
		local def  = (type(track.sysauth) == "string") and track.sysauth
		local accs = def and {track.sysauth} or track.sysauth
		local user = luci.sauth.read(luci.http.getcookie("sysauth"))
		
		
		if not luci.util.contains(accs, user) then
			if not sysauth(def) then
				return
			end
		end
	end

	if track.setgroup then
		luci.sys.process.setgroup(track.setgroup)
	end

	if track.setuser then
		luci.sys.process.setuser(track.setuser)
	end

	if c and type(c.target) == "function" then
		context.dispatched = c
		stat, mod = luci.util.copcall(require, c.module)
		if stat then
			luci.util.updfenv(c.target, mod)
		end
		
		stat, err = luci.util.copcall(c.target)
		if not stat then
			error500(err)
		end
	else
		error404()
	end
end

-- Generates the dispatching tree
function createindex()
	local path = luci.sys.libpath() .. "/controller/"
	local suff = ".lua"
	
	if luci.util.copcall(require, "luci.fastindex") then
		createindex_fastindex(path, suff)
	else
		createindex_plain(path, suff)
	end
end

-- Uses fastindex to create the dispatching tree
function createindex_fastindex(path, suffix)
	index = {}
		
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
	index = {}

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
			stat, mod = luci.util.copcall(require, module)
	
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
	if not index then
		createindex()
	end
	
	context.tree = {nodes={}}
	require("luci.i18n")
		
	-- Load default translation
	luci.i18n.loadc("default")
	
	local scope = luci.util.clone(_G)
	for k,v in pairs(luci.dispatcher) do
		if type(v) == "function" then
			scope[k] = v
		end
	end

	for k, v in pairs(index) do
		scope._NAME = k
		setfenv(v, scope)

		local stat, err = luci.util.copcall(v)
		if not stat then
			error500("createtree failed: " .. k .. ": " .. err)
			luci.http.close()
			os.exit(1)
		end
	end
end

-- Reassigns a node to another position
function assign(path, clone, title, order)
	local obj  = node(path)
	obj.nodes  = nil
	obj.module = nil
	
	obj.title = title
	obj.order = order
	
	local c = context.tree
	for k, v in ipairs(clone) do
		if not c.nodes[v] then
			c.nodes[v] = {nodes={}}
		end

		c = c.nodes[v]
	end
	
	setmetatable(obj, {__index = c})
	
	return obj
end

-- Shortcut for creating a dispatching node
function entry(path, target, title, order)
	local c = node(path)
	
	c.target = target
	c.title  = title
	c.order  = order
	c.module = getfenv(2)._NAME

	return c
end

-- Fetch a dispatching node
function node(...)
	local c = context.tree
	arg.n = nil
	if arg[1] then
		if type(arg[1]) == "table" then
			arg = arg[1]
		end
	end

	for k,v in ipairs(arg) do
		if not c.nodes[v] then
			c.nodes[v] = {nodes={}}
		end

		c = c.nodes[v]
	end

	c.module = getfenv(2)._NAME
	c.path = arg

	return c
end

-- Subdispatchers --
function alias(...)
	local req = arg
	return function()
		dispatch(req)
	end
end

function rewrite(n, ...)
	local req = arg
	return function()
		for i=1,n do 
			table.remove(context.path, 1)
		end
		
		for i,r in ipairs(req) do
			table.insert(context.path, i, r)
		end
		
		dispatch()
	end
end

function call(name, ...)
	local argv = {...}
	return function() return getfenv()[name](unpack(argv)) end
end

function template(name)
	require("luci.template")
	return function() luci.template.render(name) end
end

function cbi(model)
	require("luci.cbi")
	require("luci.template")

	return function()
		local stat, res = luci.util.copcall(luci.cbi.load, model)
		if not stat then
			error500(res)
			return true
		end

		local stat, err = luci.util.copcall(res.parse, res)
		if not stat then
			error500(err)
			return true
		end

		luci.template.render("cbi/header")
		res:render()
		luci.template.render("cbi/footer")
	end
end
