package.path  = "/usr/lib/lua/?.lua;/usr/lib/lua/?/init.lua;" .. package.path
package.cpath = "/usr/lib/lua/?.so;" .. package.cpath
module("webuci", package.seeall)

function prepare_req(uri)
	REQUEST_URI = uri
	require("ffluci.menu").get()
end

function init_req(context)
	SERVER_PROTOCOL = context.server_proto
	REMOTE_ADDR     = context.remote_addr
	REQUEST_METHOD  = context.request_method
	PATH_INFO       = "/" .. context.uri
	REMOTE_PORT     = context.remote_port
	SERVER_ADDR     = context.server_addr
	SCRIPT_NAME     = REQUEST_URI:sub(1, #REQUEST_URI - #PATH_INFO)
end

function handle_req(context)
	require("ffluci.dispatcher").httpdispatch()
end