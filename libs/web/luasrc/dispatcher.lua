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
local fs = require "luci.fs"
local sys = require "luci.sys"
local init = require "luci.init"
local util = require "luci.util"
local http = require "luci.http"

module("luci.dispatcher", package.seeall)
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

function authenticator.htmlauth(validator, accs, default)
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

	local stat, err = util.copcall(dispatch, context.request)
	if not stat then
		error500(err)
	end

	luci.http.close()

	--context._disable_memtrace()
end

--- Dispatches a LuCI virtual path.
-- @param request	Virtual path
function dispatch(request)
	--context._disable_memtrace = require "luci.debug".trap_memtrace()
	local ctx = context
	ctx.path = request

	require "luci.i18n".setlanguage(require "luci.config".main.lang)

	local c = ctx.tree
	local stat
	if not c then
		c = createtree()
	end

	local track = {}
	local args = {}
	context.args = args
	local n

	for i, s in ipairs(request) do
		c = c.nodes[s]
		n = i
		if not c then
			break
		end

		util.update(track, c)

		if c.leaf then
			break
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
	if (c and c.index) or not track.notemplate then
		local tpl = require("luci.template")
		local media = track.mediaurlbase or luci.config.main.mediaurlbase
		if not pcall(tpl.Template, "themes/%s/header" % fs.basename(media)) then
			media = nil
			for name, theme in pairs(luci.config.themes) do
				if name:sub(1,1) ~= "." and pcall(tpl.Template,
				 "themes/%s/header" % fs.basename(theme)) then
					media = theme
				end
			end
			assert(media, "No valid theme found")
		end

		local viewns = setmetatable({}, {__index=_G})
		tpl.context.viewns = viewns
		viewns.write       = luci.http.write
		viewns.include     = function(name) tpl.Template(name):render(getfenv(2)) end
		viewns.translate   = function(...) return require("luci.i18n").translate(...) end
		viewns.striptags   = util.striptags
		viewns.controller  = luci.http.getenv("SCRIPT_NAME")
		viewns.media       = media
		viewns.theme       = fs.basename(media)
		viewns.resource    = luci.config.main.resourcebase
		viewns.REQUEST_URI = (luci.http.getenv("SCRIPT_NAME") or "") .. (luci.http.getenv("PATH_INFO") or "")
	end

	track.dependent = (track.dependent ~= false)
	assert(not track.dependent or not track.auto, "Access Violation")

	if track.sysauth then
		local sauth = require "luci.sauth"

		local authen = type(track.sysauth_authenticator) == "function"
		 and track.sysauth_authenticator
		 or authenticator[track.sysauth_authenticator]

		local def  = (type(track.sysauth) == "string") and track.sysauth
		local accs = def and {track.sysauth} or track.sysauth
		local sess = ctx.authsession or luci.http.getcookie("sysauth")
		sess = sess and sess:match("^[A-F0-9]+$")
		local user = sauth.read(sess)

		if not util.contains(accs, user) then
			if authen then
				local user, sess = authen(luci.sys.user.checkpasswd, accs, def)
				if not user or not util.contains(accs, user) then
					return
				else
					local sid = sess or luci.sys.uniqueid(16)
					luci.http.header("Set-Cookie", "sysauth=" .. sid.."; path=/")
					if not sess then
						sauth.write(sid, user)
					end
					ctx.authsession = sid
				end
			else
				luci.http.status(403, "Forbidden")
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

	if c and (c.index or type(c.target) == "function") then
		ctx.dispatched = c
		ctx.requested = ctx.requested or ctx.dispatched
	end

	if c and c.index then
		local tpl = require "luci.template"

		if util.copcall(tpl.render, "indexer", {}) then
			return true
		end
	end

	if c and type(c.target) == "function" then
		util.copcall(function()
			local oldenv = getfenv(c.target)
			local module = require(c.module)
			local env = setmetatable({}, {__index=

			function(tbl, key)
				return rawget(tbl, key) or module[key] or oldenv[key]
			end})

			setfenv(c.target, env)
		end)

		c.target(unpack(args))
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
	if indexcache then
		local cachedate = fs.mtime(indexcache)
		if cachedate and cachedate > fs.mtime(path) then

			assert(
				sys.process.info("uid") == fs.stat(indexcache, "uid")
				and fs.stat(indexcache, "mode") == "rw-------",
				"Fatal: Indexcache is not sane!"
			)

			index = loadfile(indexcache)()
			return index
		end
	end

	index = {}

	local controllers = util.combine(
		luci.fs.glob(path .. "*" .. suffix) or {},
		luci.fs.glob(path .. "*/*" .. suffix) or {}
	)

	for i,c in ipairs(controllers) do
		local module = "luci.controller." .. c:sub(#path+1, #c-#suffix):gsub("/", ".")
		local mod = require(module)
		local idx = mod.index

		if type(idx) == "function" then
			index[module] = idx
		end
	end

	if indexcache then
		fs.writefile(indexcache, util.get_bytecode(index))
		fs.chmod(indexcache, "a-rwx,u+rw")
	end
end

--- Create the dispatching tree from the index.
-- Build the index before if it does not exist yet.
function createtree()
	if not index then
		createindex()
	end

	local ctx  = context
	local tree = {nodes={}}

	ctx.treecache = setmetatable({}, {__mode="v"})
	ctx.tree = tree

	-- Load default translation
	require "luci.i18n".loadc("default")

	local scope = setmetatable({}, {__index = luci.dispatcher})

	for k, v in pairs(index) do
		scope._NAME = k
		setfenv(v, scope)
		v()
	end

	return tree
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

	setmetatable(obj, {__index = _create_node(clone)})

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
	local c = _create_node({...})

	c.module = getfenv(2)._NAME
	c.path = arg
	c.auto = nil

	return c
end

function _create_node(path, cache)
	if #path == 0 then
		return context.tree
	end

	cache = cache or context.treecache
	local name = table.concat(path, ".")
	local c = cache[name]

	if not c then
		local last = table.remove(path)
		c = _create_node(path, cache)

		local new = {nodes={}, auto=true}
		c.nodes[last] = new
		cache[name] = new

		return new
	else
		return c
	end
end

-- Subdispatchers --

--- Create a redirect to another dispatching node.
-- @param	...		Virtual path destination
function alias(...)
	local req = {...}
	return function(...)
		for _, r in ipairs({...}) do
			req[#req+1] = r
		end

		dispatch(req)
	end
end

--- Rewrite the first x path values of the request.
-- @param	n		Number of path values to replace
-- @param	...		Virtual path to replace removed path values with
function rewrite(n, ...)
	local req = {...}
	return function(...)
		local dispatched = util.clone(context.dispatched)

		for i=1,n do
			table.remove(dispatched, 1)
		end

		for i, r in ipairs(req) do
			table.insert(dispatched, i, r)
		end

		for _, r in ipairs({...}) do
			dispatched[#dispatched+1] = r
		end

		dispatch(dispatched)
	end
end

--- Create a function-call dispatching target.
-- @param	name	Target function of local controller
-- @param	...		Additional parameters passed to the function
function call(name, ...)
	local argv = {...}
	return function(...)
		if #argv > 0 then 
			return getfenv()[name](unpack(argv), ...)
		else
			return getfenv()[name](...)
		end
	end
end

--- Create a template render dispatching target.
-- @param	name	Template to be rendered
function template(name)
	return function()
		require("luci.template")
		luci.template.render(name)
	end
end

--- Create a CBI model dispatching target.
-- @param	model	CBI model tpo be rendered
function cbi(model)
	return function(...)
		require("luci.cbi")
		require("luci.template")
		local http = require "luci.http"

		maps = luci.cbi.load(model, ...)

		local state = nil

		for i, res in ipairs(maps) do
			local cstate = res:parse()
			if not state or cstate < state then
				state = cstate
			end
		end

		http.header("X-CBI-State", state or 0)
		luci.template.render("cbi/header", {state = state})
		for i, res in ipairs(maps) do
			res:render()
		end
		luci.template.render("cbi/footer", {state = state})
	end
end

--- Create a CBI form model dispatching target.
-- @param	model	CBI form model tpo be rendered
function form(model)
	return function(...)
		require("luci.cbi")
		require("luci.template")
		local http = require "luci.http"

		maps = luci.cbi.load(model, ...)

		local state = nil

		for i, res in ipairs(maps) do
			local cstate = res:parse()
			if not state or cstate < state then
				state = cstate
			end
		end

		http.header("X-CBI-State", state or 0)
		luci.template.render("header")
		for i, res in ipairs(maps) do
			res:render()
		end
		luci.template.render("footer")
	end
end
