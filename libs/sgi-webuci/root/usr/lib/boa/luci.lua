module("luci-plugin", package.seeall)

function normalize(path)
    local newpath
	while newpath ~= path do
		if (newpath) then
			path = newpath
		end
		newpath = string.gsub(path, "/[^/]+/../", "/")
	end
	return newpath
end

function init(path)
	-- NB: path points to ROOT/usr/lib/boa, change it to /usr/lib/lua
	root = normalize(path .. '/../../../')
	path = normalize(path .. '/../lua/')
	package.cpath = path..'?.so;'..package.cpath
	package.path = path..'?.lua;'..package.path

	require("luci.dispatcher")
	require("luci.sgi.webuci")
	require("uci")

	if (root ~= '/') then
		-- Entering dummy mode
		uci.set_savedir(root..'/tmp/.uci')
		uci.set_confdir(root..'/etc/config')
		
		luci.sys.hostname = function() return "" end
		luci.sys.loadavg  = function() return 0,0,0,0,0 end
		luci.sys.reboot   = function() return end
		luci.sys.sysinfo  = function() return "","","" end
		luci.sys.syslog   = function() return "" end
		
		luci.sys.net.arptable		= function() return {} end
		luci.sys.net.devices		= function() return {} end
		luci.sys.net.routes			= function() return {} end
		luci.sys.wifi.getiwconfig	= function() return {} end
		luci.sys.wifi.iwscan		= function() return {} end
	end
end

function prepare_req(uri)
	luci.dispatcher.createindex()
	env = {}
	env.REQUEST_URI = uri
end

function handle_req(context)
	env.SERVER_PROTOCOL = context.server_proto
	env.REMOTE_ADDR     = context.remote_addr
	env.REQUEST_METHOD  = context.request_method
	env.PATH_INFO       = context.uri
	env.REMOTE_PORT     = context.remote_port
	env.SERVER_ADDR     = context.server_addr
	env.SCRIPT_NAME     = env.REQUEST_URI:sub(1, #env.REQUEST_URI - #env.PATH_INFO)

	luci.sgi.webuci.initenv(env, vars)
	luci.dispatcher.httpdispatch()
end
