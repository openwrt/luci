module("luci.controller.redis", package.seeall)

local http = require "luci.http"
local sys = require "luci.sys"
local util = require "luci.util"

local function get_db()
	local db = http.formvalue("db") or "0"
	if not db:match("^%d+$") then
		return nil
	end
	return db
end

local function parse_command(command)
	local args = {}
	local current = {}
	local quote
	local escape = false

	for i = 1, #command do
		local c = command:sub(i, i)
		if escape then
			current[#current + 1] = c
			escape = false
		elseif c == "\\" then
			escape = true
		elseif quote then
			if c == quote then
				quote = nil
			else
				current[#current + 1] = c
			end
		elseif c == "'" or c == '"' then
			quote = c
		elseif c:match("%s") then
			if #current > 0 then
				args[#args + 1] = table.concat(current)
				current = {}
			end
		else
			current[#current + 1] = c
		end
	end

	if escape or quote then
		return nil
	end
	if #current > 0 then
		args[#args + 1] = table.concat(current)
	end
	return args
end

local function redis_command()
	local db = get_db()
	local command = http.formvalue("cmd") or "PING"
	http.prepare_content("application/json")

	if not db then
		http.status(400, "Bad Request")
		http.write_json({error = "Invalid database number"})
		return
	end

	local args = parse_command(command)
	if not args or #args == 0 then
		http.status(400, "Bad Request")
		http.write_json({error = "Invalid command syntax"})
		return
	end

	local cmdline = {"redis-cli", "-n", db}
	for _, arg in ipairs(args) do
		cmdline[#cmdline + 1] = util.shellquote(arg)
	end

	local result = sys.exec(table.concat(cmdline, " ") .. " 2>&1") or ""
	http.write_json({result = result:gsub("%s+$", "")})
end

function index()
	entry({"admin", "services", "redis"}, firstchild(), _("Redis"), 45).dependent = false
	entry({"admin", "services", "redis", "overview"}, call("redis_overview"), _("Overview"), 1).leaf = true
	entry({"admin", "services", "redis", "status"}, call("redis_status")).leaf = true
	entry({"admin", "services", "redis", "command"}, post("redis_command")).leaf = true
	entry({"admin", "services", "redis", "keys"}, call("redis_keys")).leaf = true
	entry({"admin", "services", "redis", "setkey"}, post("redis_setkey")).leaf = true
	entry({"admin", "services", "redis", "delkey"}, post("redis_delkey")).leaf = true
	entry({"admin", "services", "redis", "action"}, post("redis_action")).leaf = true
end

function redis_overview()
	luci.template.render("redis/overview")
end

function redis_status()
	http.prepare_content("application/json")

	local ping = sys.exec("redis-cli -n 0 ping 2>/dev/null") or ""
	local running = (ping:gsub("%s+", "") == "PONG")

	if not running then
		http.write_json({
			running = false,
			pid = 0,
			memory_kb = 0,
			uptime_seconds = 0,
			version = "unknown",
			mode = "unknown",
			port = "6379",
			clients = 0,
			keyspace = {}
		})
		return
	end

	local info = sys.exec("redis-cli -n 0 INFO server 2>/dev/null") or ""
	local clients_info = sys.exec("redis-cli -n 0 INFO clients 2>/dev/null") or ""
	local keyspace_info = sys.exec("redis-cli -n 0 INFO keyspace 2>/dev/null") or ""

	local function info_value(data, key)
		local value = data:match("\n" .. key .. ":([^\r\n]+)")
		return value and value:gsub("%s+", "") or nil
	end

	local keyspace = {}
	for line in keyspace_info:gmatch("[^\r\n]+") do
		local dbnum, keys_count = line:match("^db(%d+):keys=(%d+)")
		if dbnum and keys_count then
			keyspace[dbnum] = tonumber(keys_count) or 0
		end
	end

	http.write_json({
		running = true,
		pid = tonumber(info_value(info, "process_id") or "0") or 0,
		memory_kb = math.floor((tonumber(info_value(info, "used_memory_rss") or "0") or 0) / 1024),
		uptime_seconds = tonumber(info_value(info, "uptime_in_seconds") or "0") or 0,
		version = info_value(info, "redis_version") or "unknown",
		mode = info_value(info, "redis_mode") or "standalone",
		port = info_value(info, "tcp_port") or "6379",
		clients = tonumber(info_value(clients_info, "connected_clients") or "0") or 0,
		keyspace = keyspace
	})
end

function redis_keys()
	local db = get_db()
	http.prepare_content("application/json")

	if not db then
		http.status(400, "Bad Request")
		http.write_json({error = "Invalid database number"})
		return
	end

	local keys = {}
	local raw = sys.exec("redis-cli -n " .. db .. " --scan 2>&1") or ""
	for line in raw:gmatch("[^\r\n]+") do
		if line ~= "" and not line:match("^ERR") then
			keys[#keys + 1] = line
		end
	end

	http.write_json({keys = keys, count = #keys})
end

function redis_setkey()
	local db = get_db()
	local key = http.formvalue("key") or ""
	local value = http.formvalue("value") or ""
	http.prepare_content("application/json")

	if not db then
		http.status(400, "Bad Request")
		http.write_json({error = "Invalid database number"})
		return
	end
	if key == "" then
		http.status(400, "Bad Request")
		http.write_json({error = "Key is required"})
		return
	end

	local command = "SET " .. util.shellquote(key) .. " " .. util.shellquote(value)
	local result = sys.exec("redis-cli -n " .. db .. " " .. command .. " 2>&1") or ""
	http.write_json({result = result:gsub("%s+$", "")})
end

function redis_delkey()
	local db = get_db()
	local key = http.formvalue("key") or ""
	http.prepare_content("application/json")

	if not db then
		http.status(400, "Bad Request")
		http.write_json({error = "Invalid database number"})
		return
	end
	if key == "" then
		http.status(400, "Bad Request")
		http.write_json({error = "Key is required"})
		return
	end

	local result = sys.exec("redis-cli -n " .. db .. " DEL " .. util.shellquote(key) .. " 2>&1") or ""
	http.write_json({result = result:gsub("%s+$", "")})
end

function redis_action()
	local action = http.formvalue("action") or ""
	http.prepare_content("application/json")

	if action ~= "start" and action ~= "stop" and action ~= "restart" then
		http.status(400, "Bad Request")
		http.write_json({error = "Invalid service action"})
		return
	end

	local result = sys.call("/etc/init.d/redis " .. action .. " >/dev/null 2>&1")
	http.write_json({result = result == 0 and "ok" or "failed", action = action})
end
