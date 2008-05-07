--[[
FFLuCI - Dispatcher

Description:
The request dispatcher and module dispatcher generators


The dispatching process:
    For a detailed explanation of the dispatching process we assume:
    You have installed the FFLuCI CGI-Dispatcher in /cgi-bin/ffluci
	
	To enforce a higher level of security only the CGI-Dispatcher
	resides inside the web server's document root, everything else
	stays inside an external directory, we assume this is /lua/ffluci
	for this explanation.

    All controllers and action are reachable as sub-objects of /cgi-bin/ffluci
    as if they were virtual folders and files
	e.g.: /cgi-bin/ffluci/public/info/about
	      /cgi-bin/ffluci/admin/network/interfaces
	and so on.

    The PATH_INFO variable holds the dispatch path and
	will be split into three parts: /category/module/action
   
    Category:	This is the category in which modules are stored in
   				By default there are two categories:
				"public" - which is the default public category
				"admin"  - which is the default protected category
				
				As FFLuCI itself does not implement authentication
				you should make sure that "admin" and other sensitive
				categories are protected by the webserver.
				
				E.g. for busybox add a line like:
				/cgi-bin/ffluci/admin:root:$p$root
				to /etc/httpd.conf to protect the "admin" category
				
	
	Module:		This is the controller which will handle the request further
				It is always a submodule of ffluci.controller, so a module
				called "helloworld" will be stored in
				/lua/ffluci/controller/helloworld.lua
				You are free to submodule your controllers any further.
				
	Action:		This is action that will be invoked after loading the module.
	            The kind of how the action will be dispatched depends on
				the module dispatcher that is defined in the controller.
				See the description of the default module dispatcher down
				on this page for some examples.


    The main dispatcher at first searches for the module by trying to
	include ffluci.controller.category.module
	(where "category" is the category name and "module" is the module name)
	If this fails a 404 status code will be send to the client and FFLuCI exits
	
	Then the main dispatcher calls the module dispatcher
	ffluci.controller.category.module.dispatcher with the request object
	as the only argument. The module dispatcher is then responsible
	for the further dispatching process.


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
require("ffluci.template")
require("ffluci.config")
require("ffluci.sys")

-- Sets privilege for given category
function assign_privileges(category)
	local cp = ffluci.config.category_privileges
	if cp and cp[category] then
		local u, g = cp[category]:match("([^:]+):([^:]+)")
		ffluci.sys.process.setuser(u)
		ffluci.sys.process.setgroup(g)
	end
end


-- Builds a URL from a triple of category, module and action
function build_url(category, module, action)
	category = category or "public"
	module   = module   or "index"
	action   = action   or "index"
	
	local pattern = ffluci.http.env.SCRIPT_NAME .. "/%s/%s/%s"
	return pattern:format(category, module, action)
end


-- Dispatches the "request"
function dispatch(req)
	request = req
	local m = "ffluci.controller." .. request.category .. "." .. request.module
	local stat, module = pcall(require, m)
	if not stat then
		return error404()
	else
		module.request = request
		module.dispatcher = module.dispatcher or dynamic
		setfenv(module.dispatcher, module)
		return module.dispatcher(request)
	end	
end

-- Sends a 404 error code and renders the "error404" template if available
function error404(message)
	ffluci.http.status(404, "Not Found")
	message = message or "Not Found"
	
	if not pcall(ffluci.template.render, "error404") then
		ffluci.http.prepare_content("text/plain")
		print(message)
	end
	return false	
end

-- Sends a 500 error code and renders the "error500" template if available
function error500(message)
	ffluci.http.status(500, "Internal Server Error")
	
	if not pcall(ffluci.template.render, "error500", {message=message}) then
		ffluci.http.prepare_content("text/plain")
		print(message)
	end
	return false	
end


-- Dispatches a request depending on the PATH_INFO variable
function httpdispatch()
	local pathinfo = ffluci.http.env.PATH_INFO or ""
	local parts = pathinfo:gmatch("/[%w-]+")
	
	local sanitize = function(s, default)
		return s and s:sub(2) or default
	end
	
	local cat = sanitize(parts(), "public")
	local mod = sanitize(parts(), "index")
	local act = sanitize(parts(), "index")
	
	assign_privileges(cat)
	dispatch({category=cat, module=mod, action=act})
end


-- Dispatchers --


-- The Action Dispatcher searches the module for any function called
-- action_"request.action" and calls it
function action(...)
	local disp = require("ffluci.dispatcher")
	if not disp._action(...) then
		disp.error404()
	end	
end

-- The CBI dispatcher directly parses and renders the CBI map which is
-- placed in ffluci/modles/cbi/"request.module"/"request.action" 
function cbi(...)
	local disp = require("ffluci.dispatcher")
	if not disp._cbi(...) then
		disp.error404()
	end
end

-- The dynamic dispatcher chains the action, submodule, simpleview and CBI dispatcher
-- in this particular order. It is the default dispatcher.
function dynamic(...)
	local disp = require("ffluci.dispatcher")
	if  not disp._action(...)
	and not disp._submodule(...)
	and not disp._simpleview(...)
	and not disp._cbi(...) then
		disp.error404()
	end
end

-- The Simple View Dispatcher directly renders the template
-- which is placed in ffluci/views/"request.module"/"request.action" 
function simpleview(...)
	local disp = require("ffluci.dispatcher")
	if not disp._simpleview(...) then
		disp.error404()
	end
end


-- The submodule dispatcher tries to load a submodule of the controller
-- and calls its "action"-function
function submodule(...)
	local disp = require("ffluci.dispatcher")
	if not disp._submodule(...) then
		disp.error404()
	end
end


-- Internal Dispatcher Functions --

function _action(request)
	local action = getfenv(2)["action_" .. request.action:gsub("-", "_")]
	local i18n = require("ffluci.i18n")
	
	if action then
		i18n.loadc(request.category .. "_" .. request.module)
		i18n.loadc(request.category .. "_" .. request.module .. "_" .. request.action)
		action()
		return true
	else
		return false
	end
end


function _cbi(request)
	local disp = require("ffluci.dispatcher")
	local tmpl = require("ffluci.template")
	local cbi  = require("ffluci.cbi")
	local i18n = require("ffluci.i18n")
	
	local path = request.category.."_"..request.module.."/"..request.action
	
	local stat, map = pcall(cbi.load, path)
	if stat and map then
		local stat, err = pcall(map.parse, map)
		if not stat then
			disp.error500(err)
			return true
		end
		i18n.loadc(request.category .. "_" .. request.module)
		i18n.loadc(request.category .. "_" .. request.module .. "_" .. request.action)
		tmpl.render("cbi/header")
		map:render()
		tmpl.render("cbi/footer")
		return true
	elseif not stat then
		disp.error500(map)
		return true
	else
		return false
	end
end


function _simpleview(request)
	local i18n = require("ffluci.i18n")
	local tmpl = require("ffluci.template")
	
	local path = request.category.."_"..request.module.."/"..request.action
	
	local stat, t = pcall(tmpl.Template, path)
	if stat then
		i18n.loadc(request.category .. "_" .. request.module)
		i18n.loadc(request.category .. "_" .. request.module .. "_" .. request.action)
		t:render()
		return true
	else
		return false
	end
end


function _submodule(request)
	local i18n = require("ffluci.i18n")
	local m = "ffluci.controller." .. request.category .. "." ..
	 request.module .. "." .. request.action
	local stat, module = pcall(require, m)
	
	if stat and module.action then 
		i18n.loadc(request.category .. "_" .. request.module)
		i18n.loadc(request.category .. "_" .. request.module .. "_" .. request.action)
		return pcall(module.action)
	end
	
	return false
end