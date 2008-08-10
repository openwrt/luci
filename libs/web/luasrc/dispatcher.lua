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

--- LuCI web dispatcher.
module("luci.dispatcher", package.seeall)
require("luci.init")
require("luci.http")
require("luci.sys")
require("luci.fs")

context = luci.util.threadlocal()

authenticator = {}

-- Index table
local index = nil

-- Fastindex
local fi


--- Build the URL relative to the server webroot from given virtual path.
-- @param ...	Virtual path
-- @return 		Relative URL
function build_url(...)
	return luci.http.getenv("SCRIPT_NAME") .. "/" .. table.concat(arg, "/")
end

--- Send a 404 error code and render the "error404" template if available.
-- @param message	Custom error message (optional)
-- @return			false
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

--- Send a 500 error code and render the "error500" template if available.
-- @param message	Custom error message (optional)#
-- @return			false
function error500(message)
	luci.http.status(500, "Internal Server Error")

	require("luci.template")
	if not luci.util.copcall(luci.template.render, "error500", {message=message}) then
		luci.http.prepare_content("text/plain")
		luci.http.write(message)
	end
	return false
end

function authenticator.htmlauth(validator, default)
	local user = luci.http.formvalue("username")
	local pass = luci.http.formvalue("password")
	
	if user and validator(user, pass) then
		return user
	end
	
	require("luci.i18n")
	require("luci.template")
	context.path = {}
	luci.template.render("sysauth", {duser=default, fuser=user})
	return false
	
end

--- Dispatch an HTTP request.
-- @param request	LuCI HTTP Request object
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

--- Dispatches a LuCI virtual path.
-- @param request	Virtual path
function dispatch(request)
	context.path = request
	
	require("luci.i18n")
	luci.i18n.setlanguage(require("luci.config").main.lang)
	
	if not context.tree then
		createtree()
	end
	
	local c = context.tree
	local track = {}
	local args = {}
	local n

	for i, s in ipairs(request) do
		c = c.nodes[s]
		n = i
		if not c or c.leaf then
			break
		end

		for k, v in pairs(c) do
			track[k] = v
		end
	end

	if c and c.leaf then
		for j=n+1, #request do
			table.insert(args, request[j])
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
	
	if track.dependent then
		local stat, err = pcall(assert, not track.auto)
		if not stat then
			error500(err)
			return
		end
	end
	
	if track.sysauth then
		require("luci.sauth")
		local authen = authenticator[track.sysauth_authenticator]
		local def  = (type(track.sysauth) == "string") and track.sysauth
		local accs = def and {track.sysauth} or track.sysauth
		local user = luci.sauth.read(luci.http.getcookie("sysauth"))
		
		if not luci.util.contains(accs, user) then
			if authen then
				local user = authen(luci.sys.user.checkpasswd, def)
				if not user or not luci.util.contains(accs, user) then
					return
				else
					local sid = luci.sys.uniqueid(16)
					luci.http.header("Set-Cookie", "sysauth=" .. sid.."; path=/")
					luci.sauth.write(sid, user)
				end
			else
				luci.http.status(403, "Forbidden")
				return
			end
		else
			luci.http.status(403, "Forbidden")
			return
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
		
		stat, err = luci.util.copcall(c.target, unpack(args))
		if not stat then
			error500(err)
		end
	else
		error404()
	end
end

--- Generate the dispatching index using the best possible strategy.
function createindex()
	local path = luci.util.libpath() .. "/controller/"
	local suff = ".lua"
	
	if luci.util.copcall(require, "luci.fastindex") then
		createindex_fastindex(path, suff)
	else
		createindex_plain(path, suff)
	end
end

--- Generate the dispatching index using the fastindex C-indexer.
-- @param path		Controller base directory
-- @param suffix	Controller file suffix
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

--- Generate the dispatching index using the native file-cache based strategy.
-- @param path		Controller base directory
-- @param suffix	Controller file suffix
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
					luci.fs.writefile(cachefile, luci.util.get_bytecode(mod.index))
				end
			end
		else
			index[module] = loadfile(cachefile)
		end
	end
end

--- Create the dispatching tree from the index.
-- Build the index before if it does not exist yet.
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

--- Clone a node of the dispatching tree to another position.
-- @param	path	Virtual path destination
-- @param	clone	Virtual path source
-- @param	title	Destination node title (optional)
-- @param	order	Destination node order value (optional)
-- @return			Dispatching tree node
function assign(path, clone, title, order)
	local obj  = node(unpack(path))
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

--- Create a new dispatching node and define common parameters.
-- @param	path	Virtual path
-- @param	target	Target function to call when dispatched. 
-- @param	title	Destination node title
-- @param	order	Destination node order value (optional)
-- @return			Dispatching tree node
function entry(path, target, title, order)
	local c = node(unpack(path))
	
	c.target = target
	c.title  = title
	c.order  = order
	c.module = getfenv(2)._NAME

	return c
end

--- Fetch or create a new dispatching node.
-- @param	...		Virtual path
-- @return			Dispatching tree node
function node(...)
	local c = context.tree
	arg.n = nil

	for k,v in ipairs(arg) do
		if not c.nodes[v] then
			c.nodes[v] = {nodes={}, auto=true}
		end

		c = c.nodes[v]
	end

	c.module = getfenv(2)._NAME
	c.path = arg
	c.auto = nil

	return c
end

-- Subdispatchers --

--- Create a redirect to another dispatching node.
-- @param	...		Virtual path destination
function alias(...)
	local req = arg
	return function()
		dispatch(req)
	end
end

--- Rewrite the first x path values of the request.
-- @param	n		Number of path values to replace
-- @param	...		Virtual path to replace removed path values with
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

--- Create a function-call dispatching target.
-- @param	name	Target function of local controller 
-- @param	...		Additional parameters passed to the function
function call(name, ...)
	local argv = {...}
	return function() return getfenv()[name](unpack(argv)) end
end

--- Create a template render dispatching target.
-- @param	name	Template to be rendered
function template(name)
	require("luci.template")
	return function() luci.template.render(name) end
end

--- Create a CBI model dispatching target.
-- @param	model	CBI model tpo be rendered
function cbi(model)
	require("luci.cbi")
	require("luci.template")

	return function(...)
		local stat, maps = luci.util.copcall(luci.cbi.load, model, ...)
		if not stat then
			error500(maps)
			return true
		end

		for i, res in ipairs(maps) do
			local stat, err = luci.util.copcall(res.parse, res)
			if not stat then
				error500(err)
				return true
			end
		end

		luci.template.render("cbi/header")
		for i, res in ipairs(maps) do
			res:render()
		end
		luci.template.render("cbi/footer")
	end
end

--- Create a CBI form model dispatching target.
-- @param	model	CBI form model tpo be rendered
function form(model)
	require("luci.cbi")
	require("luci.template")

	return function(...)
		local stat, maps = luci.util.copcall(luci.cbi.load, model, ...)
		if not stat then
			error500(maps)
			return true
		end

		for i, res in ipairs(maps) do
			local stat, err = luci.util.copcall(res.parse, res)
			if not stat then
				error500(err)
				return true
			end
		end

		luci.template.render("header")
		for i, res in ipairs(maps) do
			res:render()
		end
		luci.template.render("footer")
	end
end
