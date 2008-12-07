-- Initialize LuCI
function initialize()
	pcall(function()
		require "luci.dispatcher"
		require "luci.uvl"
		require "luci.cbi"
		require "luci.template"
		require "luci.json"
	end)
end

-- Register luci
function register()
	local lucihnd = require "luci.ttpd.handler.luci".Luci()
	httpd.server:get_default_vhost():set_handler("/luci", lucihnd)
	httpd.server:get_default_vhost():set_handler("/cgi-bin/luci", lucihnd)
end
