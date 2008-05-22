--[[
FFLuCI - Dispatcher

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
module("ffluci.dispatcher", package.seeall)
require("ffluci.http")
require("ffluci.sys")
require("ffluci.fs")

-- Local dispatch database
local tree = {nodes={}}

-- Global request object
request = {}

-- Active dispatched node
dispatched = nil


-- Builds a URL
function build_url(...)
	return ffluci.http.dispatcher() .. "/" .. table.concat(arg, "/") 
end

-- Sends a 404 error code and renders the "error404" template if available
function error404(message)
	ffluci.http.status(404, "Not Found")
	message = message or "Not Found"
	
	require("ffluci.template")
	if not pcall(ffluci.template.render, "error404") then
		ffluci.http.prepare_content("text/plain")
		print(message)
	end
	return false	
end

-- Sends a 500 error code and renders the "error500" template if available
function error500(message)
	ffluci.http.status(500, "Internal Server Error")
	
	require("ffluci.template")
	if not pcall(ffluci.template.render, "error500", {message=message}) then
		ffluci.http.prepare_content("text/plain")
		print(message)
	end
	return false	
end

-- Dispatches a request depending on the PATH_INFO variable
function httpdispatch()
	local pathinfo = ffluci.http.env.PATH_INFO or ""
	local c = tree
	
	for s in pathinfo:gmatch("/([%w-]+)") do
		table.insert(request, s)
	end
	
	dispatch()
end

function dispatch()
	local c = tree
	local track = {}
	
	for i, s in ipairs(request) do
		c = c.nodes[s]
		if not c then
			break
		end	
				
		for k, v in pairs(c) do
			track[k] = v
		end
	end
	
	
	if track.i18n then
		require("ffluci.i18n").loadc(track.i18n)
	end
	
	if track.setuser then
		ffluci.sys.process.setuser(track.setuser)
	end
	
	if track.setgroup then
		ffluci.sys.process.setgroup(track.setgroup)
	end
	
	
	if c and type(c.target) == "function" then
		dispatched = c
		
		stat, err = pcall(c.target)
		if not stat then
			error500(err)
		end
	else
		error404()
	end
end


-- Calls the index function of all available controllers
function createindex()
	local root = ffluci.sys.libpath() .. "/controller/"
	local suff = ".lua"
	for i,c in ipairs(ffluci.fs.glob(root .. "*/*" .. suff)) do
		c = "ffluci.controller." .. c:sub(#root+1, #c-#suff):gsub("/", ".", 1)
		stat, mod = pcall(require, c)
	
		if stat and mod and type(mod.index) == "function" then
			ffluci.util.updfenv(mod.index, ffluci.dispatcher)
			pcall(mod.index)
		end
	end
end

-- Shortcut for creating a dispatching node
function entry(path, target, title, order, add)
	add = add or {}

	local c = node(path)
	c.target = target
	c.title  = title
	c.order  = order
	
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
			c.nodes[v] = {nodes={}}
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

function template(name)
	require("ffluci.template")
	return function() ffluci.template.render(name) end
end

function cbi(model)
	require("ffluci.cbi")
	require("ffluci.template")
	
	return function()
		local stat, res = pcall(ffluci.cbi.load, model)
		if not stat then
			error500(res)
			return true
		end
		
		local stat, err = pcall(res.parse, res)
		if not stat then
			error500(err)
			return true
		end
		
		ffluci.template.render("cbi/header")
		res:render()
		ffluci.template.render("cbi/footer")
	end
end