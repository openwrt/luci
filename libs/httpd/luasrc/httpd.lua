--[[
LuCI - HTTPD
]]--
module("luci.httpd", package.seeall)
require("luci.copas")
require("luci.http.protocol")
require("luci.sys")



function run(config)
	-- TODO: process config
	local server = socket.bind("0.0.0.0", 8080)
	copas.addserver(server, spawnworker)
	
	while true do
		copas.step()
	end
end


function spawnworker(socket)
	socket = copas.wrap(socket)
	local request = luci.http.protocol.parse_message_header(socket)
	request.input = socket -- TODO: replace with streamreader
	request.error = io.stderr
	
	
	local output = socket -- TODO: replace with streamwriter
	
	-- TODO: detect matching handler
	local h = luci.httpd.FileHandler.SimpleHandler(luci.sys.libpath() .. "/httpd/httest")
	h:process(request, output)
end


Response = luci.util.class()
function Response.__init__(self, sourceout, headers, status)
	self.sourceout = sourceout or function() end
	self.headers   = headers or {}
	self.status    = status or 200
end

function Response.addheader(self, key, value)
	self.headers[key] = value
end

function Response.setstatus(self, status)
	self.status = status
end

function Response.setsource(self, source)
	self.sourceout = source
end


Handler = luci.util.class()
function Handler.__init__(self)
	self.filter = {}
end

function Handler.addfilter(self, filter)
	table.insert(self.filter, filter)
end

function Handler.process(self, request, output)
	-- TODO: Process input filters

	local response = self:handle(request)
	
	-- TODO: Process output filters
	
	output:send("HTTP/1.0 " .. response.status .. " BLA\r\n")
	for k, v in pairs(response.headers) do
		output:send(k .. ": " .. v .. "\r\n")
	end
	
	output:send("\r\n")

	for chunk in response.sourceout do
		output:send(chunk)
	end
end

