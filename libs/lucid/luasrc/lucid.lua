--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]

local nixio = require "nixio"
local table = require "table"
local uci = require "luci.model.uci"
local os = require "os"
local io = require "io"

local pairs, require, pcall, assert, type = pairs, require, pcall, assert, type
local ipairs, tonumber, collectgarbage = ipairs, tonumber, collectgarbage


module "luci.lucid"

local slaves = {}
local pollt  = {}
local tickt  = {}
local tpids  = {}
local tcount = 0
local ifaddrs = nixio.getifaddrs()

cursor = uci.cursor()
state  = uci.cursor_state()
UCINAME = "lucid"

local cursor = cursor
local state = state
local UCINAME = UCINAME
local SSTATE = "/tmp/.lucid_store"



function start()
	prepare()

	local detach = cursor:get(UCINAME, "main", "daemonize")
	if detach == "1" then
		local stat, code, msg = daemonize()
		if not stat then
			nixio.syslog("crit", "Unable to detach process: " .. msg .. "\n")
			ox.exit(2)
		end
	end

	run()
end

function prepare()
	local debug = tonumber((cursor:get(UCINAME, "main", "debug")))
	
	nixio.openlog("lucid", "pid", "perror")
	if debug ~= 1 then
		nixio.setlogmask("warning")
	end
	
	cursor:foreach(UCINAME, "daemon", function(config)
		if config.enabled ~= "1" then
			return
		end
	
		local key = config[".name"]
		if not config.slave then
			nixio.syslog("crit", "Daemon "..key.." is missing a slave\n")
			os.exit(1)
		else
			nixio.syslog("info", "Initializing daemon " .. key)
		end
		
		state:revert(UCINAME, key)
		
		local daemon, code, err = prepare_daemon(config)
		if daemon then
			state:set(UCINAME, key, "status", "started")
			nixio.syslog("info", "Prepared daemon " .. key)
		else
			state:set(UCINAME, key, "status", "error")
			state:set(UCINAME, key, "error", err)
			nixio.syslog("err", "Failed to initialize daemon "..key..": "..
			err .. "\n")
		end
	end)
end
	
function run()
	local pollint = tonumber((cursor:get(UCINAME, "main", "pollinterval")))

	while true do
		local stat, code = nixio.poll(pollt, pollint)
		
		if stat and stat > 0 then
			for _, polle in ipairs(pollt) do
				if polle.revents ~= 0 and polle.handler then
					polle.handler(polle)
				end
			end
		elseif stat == 0 then
			ifaddrs = nixio.getifaddrs()
			collectgarbage("collect")
		end
		
		for _, cb in ipairs(tickt) do
			cb()
		end
		
		local pid, stat, code = nixio.wait(-1, "nohang")
		while pid and pid > 0 do
			tcount = tcount - 1
			if tpids[pid] and tpids[pid] ~= true then
				tpids[pid](pid, stat, code)
			end
			pid, stat, code = nixio.wait(-1, "nohang")
		end
	end
end

function register_pollfd(polle)
	pollt[#pollt+1] = polle
	return true 
end

function unregister_pollfd(polle)
	for k, v in ipairs(pollt) do
		if v == polle then
			table.remove(pollt, k)
			return true
		end
	end
	return false
end

function close_pollfds()
	for k, v in ipairs(pollt) do
		if v.fd and v.fd.close then
			v.fd:close()
		end
	end
end

function register_tick(cb)
	tickt[#tickt+1] = cb
	return true
end

function unregister_tick(cb)
	for k, v in ipairs(tickt) do
		if v == cb then
			table.remove(tickt, k)
			return true
		end
	end
	return false
end

function create_process(threadcb, waitcb)
	local threadlimit = tonumber(cursor:get(UCINAME, "main", "threadlimit"))
	if threadlimit and #tpids >= tcount then
		nixio.syslog("warning", "Unable to create thread: process limit reached")
		return nil
	end
	local pid, code, err = nixio.fork()
	if pid and pid ~= 0 then
		tpids[pid] = waitcb
		tcount = tcount + 1
	elseif pid == 0 then
		local code = threadcb()
		os.exit(code)
	else
		nixio.syslog("err", "Unable to fork(): " .. err)
	end
	return pid, code, err
end

function prepare_daemon(config)
	nixio.syslog("info", "Preparing daemon " .. config[".name"])
	local modname = cursor:get(UCINAME, config.slave)
	if not modname then
		return nil, -1, "invalid slave"
	end

	local stat, module = pcall(require, _NAME .. "." .. modname)
	if not stat or not module.prepare_daemon then
		return nil, -2, "slave type not supported"
	end
	
	config.slave = prepare_slave(config.slave)

	return module.prepare_daemon(config, _M)
end

function prepare_slave(name)
	local slave = slaves[name]
	if not slave then
		local config = cursor:get_all(UCINAME, name)
		
		local stat, module = pcall(require, config and config.entrypoint)
		if stat then
			slave = {module = module, config = config}
		end
	end
	
	if slave then
		return slave
	else
		return nil, module
	end
end

function get_interfaces()
	return ifaddrs
end

function revoke_privileges(user, group)
	if nixio.getuid() == 0 then
		return nixio.setgid(group) and nixio.setuid(user)
	end
end

function securestate()
	local stat = nixio.fs.stat(SSTATE) or {}
	local uid = nixio.getuid()
	if stat.type ~= "dir" or (stat.modedec % 100) ~= 0 or stat.uid ~= uid then
		nixio.fs.remover(SSTATE)
		if not nixio.fs.mkdir(SSTATE, 700) then
			local errno = nixio.errno()
			nixio.syslog("err", "Integrity check on secure state failed!")
			return nil, errno, nixio.perror(errno)
		end
	end
	
	return uci.cursor(nil, SSTATE)
end

function daemonize()
	if nixio.getppid() == 1 then
		return
	end
	
	local pid, code, msg = nixio.fork()
	if not pid then
		return nil, code, msg
	elseif pid > 0 then
		os.exit(0)
	end
	
	nixio.setsid()
	nixio.chdir("/")
	
	local devnull = nixio.open("/dev/null", nixio.open_flags("rdwr"))
	nixio.dup(devnull, nixio.stdin)
	nixio.dup(devnull, nixio.stdout)
	nixio.dup(devnull, nixio.stderr)
	
	return true
end