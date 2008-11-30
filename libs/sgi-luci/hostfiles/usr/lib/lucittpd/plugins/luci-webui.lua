function initialize()
	pcall(function()
	    local SYSROOT = os.getenv("LUCI_SYSROOT")
	    require "uci"
	    require "luci.model.uci".cursor = function(config, save)
	            return uci.cursor(config or SYSROOT .. "/etc/config", save or SYSROOT .. "/tmp/.uci")
	    end
	
	    local x = require "luci.uvl".UVL.__init__
	    require "luci.uvl".UVL.__init__ = function(self, schemedir)
	            x(self, schemedir or SYSROOT .. "/lib/uci/schema")
	    end
	
	    require("luci.sys")
	    luci.sys.user.checkpasswd = function() return true end
	    
	   	require "luci.dispatcher"
		require "luci.uvl"
		require "luci.cbi"
		require "luci.template"
		require "luci.json"
	end)
end

-- Initialize LuCI
function register()
	local lucihnd = require "luci.ttpd.handler.luci"
	httpd.server:get_default_vhost():set_handler("/luci", lucihnd.Luci())
end