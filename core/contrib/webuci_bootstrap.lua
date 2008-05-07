package.path  = "/usr/lib/lua/?.lua;/usr/lib/lua/?/init.lua;" .. package.path
package.cpath = "/usr/lib/lua/?.so;" .. package.cpath
module("webuci", package.seeall)

function prepare_req(uri)
	env = {}
	env.REQUEST_URI = uri
	require("ffluci.menu").get()
end

function init_req(context)
	env.SERVER_PROTOCOL = context.server_proto
	env.REMOTE_ADDR     = context.remote_addr
	env.REQUEST_METHOD  = context.request_method
	env.PATH_INFO       = "/" .. context.uri
	env.REMOTE_PORT     = context.remote_port
	env.SERVER_ADDR     = context.server_addr
	env.SCRIPT_NAME     = REQUEST_URI:sub(1, #REQUEST_URI - #PATH_INFO)
end

function handle_req(context)
	require("ffluci.dispatcher").httpdispatch()
end