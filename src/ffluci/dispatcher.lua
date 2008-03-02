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


-- Dispatches the "request"
function dispatch(req)
	request = req
	local m = "ffluci.controller." .. request.category .. "." .. request.module
	local stat, module = pcall(require, m)
	if not stat then
		return error404()
	else
		module.request = request
		setfenv(module.dispatcher, module)
		return module.dispatcher(request)
	end	
end


-- Sends a 404 error code and renders the "error404" template if available
function error404(message)
	message = message or "Not Found"
	
	ffluci.http.status(404, "Not Found")
	
	if not pcall(ffluci.template.render, "error404") then
		ffluci.http.textheader()
		print(message)		
	end
	return false	
end

-- Sends a 500 error code and renders the "error500" template if available
function error500(message)
	ffluci.http.status(500, "Internal Server Error")
	
	if not pcall(ffluci.template.render, "error500") then
		ffluci.http.textheader()
		print(message)
	end
	return false	
end


-- Dispatches a request depending on the PATH_INFO variable
function httpdispatch()
	local pathinfo = os.getenv("PATH_INFO") or ""
	local parts = pathinfo:gmatch("/[%w-]+")
	
	local sanitize = function(s, default)
		return s and s:sub(2) or default
	end
	
	local cat = sanitize(parts(), "public")
	local mod = sanitize(parts(), "index")
	local act = sanitize(parts(), "index")
	
	dispatch({category=cat, module=mod, action=act})
end

-- The Simple View Dispatcher directly renders the template
-- which is placed in ffluci/views/"request.module"/"request.action" 
function simpleview(request)
	local i18n = require("ffluci.i18n")
	local tmpl = require("ffluci.template")
	local conf = require("ffluci.config")
	local disp = require("ffluci.dispatcher")
	
	pcall(i18n.load, request.module .. "." .. conf.lang)
	if not pcall(tmpl.get, request.module .. "/" .. request.action) then
		disp.error404()
	else
		tmpl.render(request.module .. "/" .. request.action)
	end
end

-- The Action Dispatcher searches the module for any function called
-- action_"request.action" and calls it
function action(request)
	local i18n = require("ffluci.i18n")
	local conf = require("ffluci.config")
	local disp = require("ffluci.dispatcher")
	
	pcall(i18n.load, request.module .. "." .. conf.lang)
	local action = getfenv()["action_" .. request.action:gsub("-", "_")]
	if action then
		action()
	else
		disp.error404()
	end
end