--[[

LuCI LXC module

Copyright (C) 2014, Cisco Systems, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Author: Petar Koretic <petar.koretic@sartura.hr>

]]--

module("luci.controller.lxc", package.seeall)

local uci  = require "luci.model.uci".cursor()
local util = require "luci.util"
local nx   = require "nixio"
local url  = util.shellquote(uci:get("lxc", "lxc", "url"))

function index()
	if not nixio.fs.access("/etc/config/lxc") then
		return
	end

	page = node("admin", "services", "lxc")
	page.target = cbi("lxc")
	page.title = _("LXC Containers")
	page.order = 70
	page.acl_depends = { "luci-app-lxc" }

	page = entry({"admin", "services", "lxc_create"}, call("lxc_create"), nil)
	page.acl_depends = { "luci-app-lxc" }
	page.leaf = true

	page = entry({"admin", "services", "lxc_action"}, call("lxc_action"), nil)
	page.acl_depends = { "luci-app-lxc" }
	page.leaf = true

	page = entry({"admin", "services", "lxc_get_downloadable"}, call("lxc_get_downloadable"), nil)
	page.acl_depends = { "luci-app-lxc" }
	page.leaf = true

	page = entry({"admin", "services", "lxc_configuration_get"}, call("lxc_configuration_get"), nil)
	page.acl_depends = { "luci-app-lxc" }
	page.leaf = true

	page = entry({"admin", "services", "lxc_configuration_set"}, call("lxc_configuration_set"), nil)
	page.acl_depends = { "luci-app-lxc" }
	page.leaf = true
end

function lxc_get_downloadable()
	local target = lxc_get_arch_target(url)
	local templates = {}

	local f = io.popen('sh /usr/share/lxc/templates/lxc-download --list --server %s 2>/dev/null'
		%{ url }, 'r')
	local line
	for line in f:lines() do
		local dist, version, dist_target = line:match("^(%S+)%s+(%S+)%s+(%S+)%s+default%s+%S+$")
		if dist and version and dist_target and dist_target == target then
			templates[#templates+1] = "%s:%s" %{ dist, version }
		end
	end
	f:close()

	luci.http.prepare_content("application/json")
	luci.http.write_json(templates)
end

function lxc_create(lxc_name, lxc_template)
	luci.http.prepare_content("text/plain")
	local path = lxc_get_config_path()
	if not path then
		return
	end

	local lxc_dist, lxc_release = lxc_template:match("^(.+):(.+)$")
	luci.sys.call('/usr/bin/lxc-create --quiet --name %s --bdev best --template download -- --dist %s --release %s --arch %s --server %s'
		%{ lxc_name, lxc_dist, lxc_release, lxc_get_arch_target(url), url })

	while (nx.fs.access(path .. lxc_name .. "/partial")) do
		nx.nanosleep(1)
	end

	luci.http.write("0")
end

function lxc_action(lxc_action, lxc_name)
	local data, ec = util.ubus("lxc", lxc_action, lxc_name and { name = lxc_name } or {})

	luci.http.prepare_content("application/json")
	luci.http.write_json(ec and {} or data)
end

function lxc_get_config_path()
	local f = io.open("/etc/lxc/lxc.conf", "r")
	local content = f:read("*all")
	f:close()

	local ret = content:match('^%s*lxc.lxcpath%s*=%s*([^%s]*)')
	if ret then
		if nx.fs.access(ret) then
			local min_space = tonumber(uci:get("lxc", "lxc", "min_space")) or 100000
			local free_space = tonumber(util.exec("df " ..ret.. " | awk '{if(NR==2)print $4}'"))
			if free_space and free_space >= min_space then
				local min_temp = tonumber(uci:get("lxc", "lxc", "min_temp")) or 100000
				local free_temp = tonumber(util.exec("df /tmp | awk '{if(NR==2)print $4}'"))
				if free_temp and free_temp >= min_temp then
					return ret .. "/"
				else
					util.perror("lxc error: not enough temporary space (< " ..min_temp.. " KB)")
				end
			else
				util.perror("lxc error: not enough space (< " ..min_space.. " KB)")
			end
		else
			util.perror("lxc error: directory not found")
		end
	else
		util.perror("lxc error: config path is empty")
	end
end

function lxc_configuration_get(lxc_name)
	luci.http.prepare_content("text/plain")

	local f = io.open(lxc_get_config_path() .. lxc_name .. "/config", "r")
	local content = f:read("*all")
	f:close()

	luci.http.write(content)
end

function lxc_configuration_set(lxc_name)
	luci.http.prepare_content("text/plain")

	local lxc_configuration = luci.http.formvalue("lxc_conf")
	if lxc_configuration == nil then
		util.perror("lxc error: config formvalue is empty")
		return
	end

	local f, err = io.open(lxc_get_config_path() .. lxc_name .. "/config","w+")
	if not f then
		util.perror("lxc error: config file not found")
		return
	end

	f:write(lxc_configuration)
	f:close()

	luci.http.write("0")
end

function lxc_get_arch_target(url)
	local target = nx.uname().machine
	if url and url:match("images.linuxcontainers.org") then
		local target_map = {
			armv5  = "armel",
			armv6  = "armel",
			armv7  = "armhf",
			armv8  = "arm64",
			aarch64  = "arm64",
			i686   = "i386",
			x86_64 = "amd64"
		}
		local k, v
		for k, v in pairs(target_map) do
			if target:find(k) then
				return v
			end
		end
	end
	return target
end
