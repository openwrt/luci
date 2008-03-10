-- This example demonstrates the action dispatcher which invokes
-- an appropriate action function named action_"action"

-- This example consists of:
-- ffluci/controller/index/example-action.lua (this file)

-- Try the following address(es) in your browser:
-- ffluci/index/example-action
-- ffluci/index/example-action/sp
-- ffluci/index/example-action/redir

module(..., package.seeall)

dispatcher = require("ffluci.dispatcher").action

menu  = {
	descr   = "Example Action",
	order   = 30,
	entries = {
		{action = "index", descr = "Action-Dispatcher Example"},
		{action = "sp", descr = "Simple View Template Stealing"},
		{action = "redir", descr = "Hello World Redirector"}
	}
}

function action_index()
	require("ffluci.template").render("header")
	local formvalue = require("ffluci.http").formvalue
	
	local x = formvalue("x", nil, true)
	
	print(x and "x*x: "..tostring(x*x) or "Set ?x= any number")
	require("ffluci.template").render("footer") 
end

function action_sp()
	require("ffluci.http")
	require("ffluci.i18n")
	require("ffluci.config")
	require("ffluci.template")
	
	-- Try uncommenting the next line
	-- ffluci.i18n.loadc("example-simpleview")
	ffluci.template.render("example-simpleview/index")
end

function action_redir()
	require("ffluci.http").request_redirect("public", "index", "foobar")
end