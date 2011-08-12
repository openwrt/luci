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


--- Starts a new LuCId superprocess.
function start()
	state:revert(UCINAME, "main")

	prepare()

	local detach = cursor:get(UCINAME, "main", "daemonize")
	if detach == "1" then
		local stat, code, msg = daemonize()
		if not stat then
			nixio.syslog("crit", "Unable to detach process: " .. msg .. "\n")
			ox.exit(2)
		end
	end

	state:set(UCINAME, "main", "pid", nixio.getpid())
	state:save(UCINAME)

	run()
end

--- Returns the PID of the currently active LuCId process.
function running()
	local pid = tonumber(state:get(UCINAME, "main", "pid"))
	return pid and nixio.kill(pid, 0) and pid
end

--- Stops any running LuCId superprocess. 
function stop()
	local pid = tonumber(state:get(UCINAME, "main", "pid"))
	if pid then
		return nixio.kill(pid, nixio.const.SIGTERM)
	end
	return false
end

--- Prepares the slaves, daemons and publishers, allocate resources.
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
	
--- Run the superprocess if prepared before. 
-- This main function of LuCId will wait for events on given file descriptors.
function run()
	local pollint = tonumber((cursor:get(UCINAME, "main", "pollinterval")))
	local threadlimit = tonumber((cursor:get(UCINAME, "main", "threadlimit")))

	while true do
		local stat, code = nixio.poll(pollt, pollint)
		
		if stat and stat > 0 then
			local ok = false
			for _, polle in ipairs(pollt) do
				if polle.revents ~= 0 and polle.handler then
					ok = ok or polle.handler(polle)
				end
			end
			if not ok then
				-- Avoid high CPU usage if thread limit is reached
				nixio.nanosleep(0, 100000000)
			end
		elseif stat == 0 then
			ifaddrs = nixio.getifaddrs()
		end
		
		for _, cb in ipairs(tickt) do
			cb()
		end
		
		local pid, stat, code = nixio.wait(-1, "nohang")
		while pid and pid > 0 do
			nixio.syslog("info", "Buried thread: " .. pid)
			if tpids[pid] then
				tcount = tcount - 1
				if tpids[pid] ~= true then
					tpids[pid](pid, stat, code)
				end
				tpids[pid] = nil
			end
			pid, stat, code = nixio.wait(-1, "nohang")
		end
	end
end

--- Add a file descriptor for the main loop and associate handler functions.
-- @param polle Table containing: {fd = FILE DESCRIPTOR, events = POLL EVENTS,
-- handler = EVENT HANDLER CALLBACK}
-- @see unregister_pollfd
-- @return boolean status
function register_pollfd(polle)
	pollt[#pollt+1] = polle
	return true 
end

--- Unregister a file desciptor and associate handler from the main loop.
-- @param polle Poll descriptor
-- @see register_pollfd
-- @return boolean status
function unregister_pollfd(polle)
	for k, v in ipairs(pollt) do
		if v == polle then
			table.remove(pollt, k)
			return true
		end
	end
	return false
end

--- Close all registered file descriptors from main loop.
-- This is useful for forked child processes. 
function close_pollfds()
	for k, v in ipairs(pollt) do
		if v.fd and v.fd.close then
			v.fd:close()
		end
	end
end

--- Register a tick function that will be called at each cycle of the main loop.
-- @param cb Callback
-- @see unregister_tick
-- @return boolean status
function register_tick(cb)
	tickt[#tickt+1] = cb
	return true
end

--- Unregister a tick function from the main loop.
-- @param cb Callback
-- @see register_tick
-- @return boolean status
function unregister_tick(cb)
	for k, v in ipairs(tickt) do
		if v == cb then
			table.remove(tickt, k)
			return true
		end
	end
	return false
end

--- Tests whether a given number of processes can be created.
-- @oaram num Processes to be created
-- @return boolean status
function try_process(num)
	local threadlimit = tonumber((cursor:get(UCINAME, "main", "threadlimit")))
	return not threadlimit or (threadlimit - tcount) >= (num or 1)
end

--- Create a new child process from a Lua function and assign a destructor.
-- @param threadcb main function of the new process
-- @param waitcb destructor callback
-- @return process identifier or nil, error code, error message
function create_process(threadcb, waitcb)
	local threadlimit = tonumber(cursor:get(UCINAME, "main", "threadlimit"))
	if threadlimit and tcount >= threadlimit then
		nixio.syslog("warning", "Cannot create thread: process limit reached")
		return nil
	else
		collectgarbage("collect")
	end
	local pid, code, err = nixio.fork()
	if pid and pid ~= 0 then
		nixio.syslog("info", "Created thread: " .. pid)
		tpids[pid] = waitcb or true
		tcount = tcount + 1
	elseif pid == 0 then
		local code = threadcb()
		os.exit(code)
	else
		nixio.syslog("err", "Unable to fork(): " .. err)
	end
	return pid, code, err
end

--- Prepare a daemon from a given configuration table.
-- @param config Configuration data.
-- @return boolean status or nil, error code, error message
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

--- Prepare a slave.
-- @param name slave name
-- @return table containing slave module and configuration or nil, error message
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

--- Return a list of available network interfaces on the host.
-- @return table returned by nixio.getifaddrs()
function get_interfaces()
	return ifaddrs
end

--- Revoke process privileges.
-- @param user new user name or uid
-- @param group new group name or gid
-- @return boolean status or nil, error code, error message
function revoke_privileges(user, group)
	if nixio.getuid() == 0 then
		return nixio.setgid(group) and nixio.setuid(user)
	end
end

--- Return a secure UCI cursor.
-- @return UCI cursor
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

--- Daemonize the process.
-- @return boolean status or nil, error code, error message
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
