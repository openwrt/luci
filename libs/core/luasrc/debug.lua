local debug = require "debug"
local io = require "io"
local collectgarbage = collectgarbage

module "luci.debug"
__file__ = debug.getinfo(1, 'S').source:sub(2)

-- Enables the memory tracer with given flags and returns a function to disable the tracer again
function trap_memtrace(flags)
	flags = flags or "l"
	local tracefile = io.open("/tmp/memtrace", "w")

	local function trap(what, line)
		local info = debug.getinfo(2, "Sn")
		tracefile:write(info.source..":"..line.."\t"..(info.namewhat or "").."\t"..(info.name or "").."\t"..collectgarbage("count").."\n")
	end

	debug.sethook(trap, flags)

	return function()
		debug.sethook()
		tracefile:close()
	end
end

