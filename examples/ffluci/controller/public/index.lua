-- This is a very simple example Hello World FFLuCI controller
-- See the other examples for more automated controllers

-- Initialise Lua module system
module(..., package.seeall)

-- This is the module dispatcher. It implements the last step of the
-- dispatching process.
function dispatcher(request)
	require("ffluci.template").render("header")
	print("<h2>Hello World!</h2>")
	for k,v in pairs(request) do
		print("<div>" .. k .. ": " .. v .. "</div>")
	end
	require("ffluci.template").render("footer")
end

-- The following part is optional it could be useful for menu generators
-- An example menu generator is implemented in the template "menu"

menu  = {	
	-- This is the menu item description
	descr = "Hello World",
	
	-- This is the order level of the menu entry (lowest goes first)
	order = 10,

	-- A list of menu entries in the form action => "description"
	entries      = {
		{action = "index", descr = "Hello World"},
	}
}