module("luci.httpd.handler.luci", package.seeall)
require("luci.dispatcher")
require("luci.http")
require("ltn12")

Luci = luci.util.class(luci.httpd.module.Handler)
Response = luci.httpd.module.Response

function Luci.__init__(self)
	luci.httpd.module.Handler.__init__(self)
end

function Luci.handle_head(self, ...)
	local response, sourceout = self:handle_get(...)
	return response
end

function Luci.handle_post(self, ...)
	return self:handle_get(...)
end

function Luci.handle_get(self, request, sourcein, sinkerr)	
	local r = luci.http.Request(
		request.env,
		sourcein,
		sinkerr
	)
		
	local res, id, data1, data2 = true, 0, nil, nil
	local headers = {}
	local status = 200
	
	local x = coroutine.create(luci.dispatcher.httpdispatch)
	while not id or id < 3 do
		coroutine.yield()
		
		res, id, data1, data2 = coroutine.resume(x, r)
		
		if not res then
			status = 500
			headers["Content-Type"] = "text/plain"
			local err = {id}
			return status, headers, function() local x = table.remove(err) return x end
		end
		
		if id == 1 then
			status = data1
		elseif id == 2 then
			headers[data1] = data2
		end
	end
	
	local function iter()
		local res, id, data = coroutine.resume(x)
		if not res then
			return nil, id
		elseif not id then
			return true
		elseif id == 5 then
			return nil
		else
			return data
		end
	end
	
	return Response(status, headers), iter
end