-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008-2015 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.dispatcher", package.seeall)

local http = _G.L.http

context = setmetatable({}, {
	__index = function(t, k)
		if k == "request" or k == "requestpath" then
			return _G.L.ctx.request_path
		elseif k == "requestargs" then
			return _G.L.ctx.request_args
		else
			return _G.L.ctx[k]
		end
	end
})

uci = require "luci.model.uci"
uci:set_session_id(_G.L.ctx.authsession)

i18n = require "luci.i18n"
i18n.setlanguage(_G.L.dispatcher.lang)

build_url = _G.L.dispatcher.build_url
menu_json = _G.L.dispatcher.menu_json
error404 = _G.L.dispatcher.error404
error500 = _G.L.dispatcher.error500

function is_authenticated(auth)
	local session = _G.L.dispatcher.is_authenticated(auth)
	if session then
		return session.sid, session.data, session.acls
	end
end

function assign(path, clone, title, order)
	local obj  = node(unpack(path))

	obj.title = title
	obj.order = order

	setmetatable(obj, {__index = node(unpack(clone))})

	return obj
end

function entry(path, target, title, order)
	local c = node(unpack(path))

	c.title  = title
	c.order  = order
	c.action = target

	return c
end

-- enabling the node.
function get(...)
	return node(...)
end

function node(...)
	local p = table.concat({ ... }, "/")

	if not __entries[p] then
		__entries[p] = {}
	end

	return __entries[p]
end

function lookup(...)
	local i, path = nil, {}
	for i = 1, select('#', ...) do
		local name, arg = nil, tostring(select(i, ...))
		for name in arg:gmatch("[^/]+") do
			path[#path+1] = name
		end
	end

	local node = menu_json()
	for i = 1, #path do
		node = node.children[path[i]]

		if not node then
			return nil
		elseif node.leaf then
			break
		end
	end

	return node, build_url(unpack(path))
end


function process_lua_controller(path)
	local base = "/usr/lib/lua/luci/controller/"
	local modname = "luci.controller." .. path:sub(#base+1, #path-4):gsub("/", ".")
	local mod = require(modname)
	assert(mod ~= true,
	       "Invalid controller file found\n" ..
	       "The file '" .. path .. "' contains an invalid module line.\n" ..
	       "Please verify whether the module name is set to '" .. modname ..
	       "' - It must correspond to the file path!")

	local idx = mod.index
	if type(idx) ~= "function" then
		return nil
	end

	local entries = {}

	__entries = entries
	__controller = modname

	setfenv(idx,  setmetatable({}, { __index = luci.dispatcher }))()

	__entries = nil
	__controller = nil

	-- fixup gathered node specs
	for path, entry in pairs(entries) do
		if entry.leaf then
			entry.wildcard = true
		end

		if type(entry.file_depends) == "table" then
			for _, v in ipairs(entry.file_depends) do
				entry.depends = entry.depends or {}
				entry.depends.fs = entry.depends.fs or {}

				local ft = fs.stat(v, "type")
				if ft == "dir" then
					entry.depends.fs[v] = "directory"
				elseif v:match("/s?bin/") then
					entry.depends.fs[v] = "executable"
				else
					entry.depends.fs[v] = "file"
				end
			end
		end

		if type(entry.uci_depends) == "table" then
			for k, v in pairs(entry.uci_depends) do
				entry.depends = entry.depends or {}
				entry.depends.uci = entry.depends.uci or {}
				entry.depends.uci[k] = v
			end
		end

		if type(entry.acl_depends) == "table" then
			for _, acl in ipairs(entry.acl_depends) do
				entry.depends = entry.depends or {}
				entry.depends.acl = entry.depends.acl or {}
				entry.depends.acl[#entry.depends.acl + 1] = acl
			end
		end

		if (entry.sysauth_authenticator ~= nil) or
		   (entry.sysauth ~= nil and entry.sysauth ~= false)
		then
			if entry.sysauth_authenticator == "htmlauth" then
				entry.auth = {
					login = true,
					methods = { "cookie:sysauth_https", "cookie:sysauth_http" }
				}
			elseif path == "rpc" and modname == "luci.controller.rpc" then
				entry.auth = {
					login = false,
					methods = { "query:auth", "cookie:sysauth_https", "cookie:sysauth_http", "cookie:sysauth" }
				}
			elseif modname == "luci.controller.admin.uci" then
				entry.auth = {
					login = false,
					methods = { "param:sid" }
				}
			end
		elseif entry.sysauth == false then
			entry.auth = {}
		end

		if entry.action == nil and type(entry.target) == "table" then
			entry.action = entry.target
			entry.target = nil
		end

		entry.leaf = nil

		entry.file_depends = nil
		entry.uci_depends = nil
		entry.acl_depends = nil

		entry.sysauth = nil
		entry.sysauth_authenticator = nil
	end

	return entries
end

function invoke_cbi_action(model, config, ...)
	local cbi = require "luci.cbi"
	local tpl = require "luci.template"
	local util = require "luci.util"

	if not config then
		config = {}
	end

	local maps = cbi.load(model, ...)

	local state = nil

	local function has_uci_access(config, level)
		local rv = util.ubus("session", "access", {
			ubus_rpc_session = context.authsession,
			scope = "uci", object = config,
			["function"] = level
		})

		return (type(rv) == "table" and rv.access == true) or false
	end

	local i, res
	for i, res in ipairs(maps) do
		if util.instanceof(res, cbi.SimpleForm) then
			io.stderr:write("Model %s returns SimpleForm but is dispatched via cbi(),\n"
				% model)

			io.stderr:write("please change %s to use the form() action instead.\n"
				% table.concat(context.request, "/"))
		end

		res.flow = config
		local cstate = res:parse()
		if cstate and (not state or cstate < state) then
			state = cstate
		end
	end

	local function _resolve_path(path)
		return type(path) == "table" and build_url(unpack(path)) or path
	end

	if config.on_valid_to and state and state > 0 and state < 2 then
		http:redirect(_resolve_path(config.on_valid_to))
		return
	end

	if config.on_changed_to and state and state > 1 then
		http:redirect(_resolve_path(config.on_changed_to))
		return
	end

	if config.on_success_to and state and state > 0 then
		http:redirect(_resolve_path(config.on_success_to))
		return
	end

	if config.state_handler then
		if not config.state_handler(state, maps) then
			return
		end
	end

	http:header("X-CBI-State", state or 0)

	if not config.noheader then
		_G.L.include("cbi/header", {state = state})
	end

	local redirect
	local messages
	local applymap   = false
	local pageaction = true
	local parsechain = { }
	local writable   = false

	for i, res in ipairs(maps) do
		if res.apply_needed and res.parsechain then
			local c
			for _, c in ipairs(res.parsechain) do
				parsechain[#parsechain+1] = c
			end
			applymap = true
		end

		if res.redirect then
			redirect = redirect or res.redirect
		end

		if res.pageaction == false then
			pageaction = false
		end

		if res.message then
			messages = messages or { }
			messages[#messages+1] = res.message
		end
	end

	for i, res in ipairs(maps) do
		local is_readable_map = has_uci_access(res.config, "read")
		local is_writable_map = has_uci_access(res.config, "write")

		writable = writable or is_writable_map

		res:render({
			firstmap   = (i == 1),
			redirect   = redirect,
			messages   = messages,
			pageaction = pageaction,
			parsechain = parsechain,
			readable   = is_readable_map,
			writable   = is_writable_map
		})
	end

	if not config.nofooter then
		_G.L.include("cbi/footer", {
			flow          = config,
			pageaction    = pageaction,
			redirect      = redirect,
			state         = state,
			autoapply     = config.autoapply,
			trigger_apply = applymap,
			writable      = writable
		})
	end
end

function invoke_form_action(model, ...)
	local cbi = require "luci.cbi"
	local tpl = require "luci.template"

	local maps = luci.cbi.load(model, ...)
	local state = nil

	local i, res
	for i, res in ipairs(maps) do
		local cstate = res:parse()
		if cstate and (not state or cstate < state) then
			state = cstate
		end
	end

	http:header("X-CBI-State", state or 0)
	_G.L.include("header")
	for i, res in ipairs(maps) do
		res:render()
	end
	_G.L.include("footer")
end

function render_lua_template(path)
	local tpl = require "luci.template"

	tpl.render(path, getfenv(1))
end


function call(name, ...)
	return {
		["type"] = "call",
		["module"] = __controller,
		["function"] = name,
		["parameters"] = select('#', ...) > 0 and {...} or nil
	}
end

function post(name, ...)
	return {
		["type"] = "call",
		["module"] = __controller,
		["function"] = name,
		["parameters"] = select('#', ...) > 0 and {...} or nil,
		["post"] = true
	}
end

function view(name)
	return {
		["type"] = "view",
		["path"] = name
	}
end

function template(name)
	return {
		["type"] = "template",
		["path"] = name
	}
end

function cbi(model, config)
	return {
		["type"] = "call",
		["module"] = "luci.dispatcher",
		["function"] = "invoke_cbi_action",
		["parameters"] = { model, config or {} },
		["post"] = {
			["cbi.submit"] = true
		}
	}
end

function form(model)
	return {
		["type"] = "call",
		["module"] = "luci.dispatcher",
		["function"] = "invoke_form_action",
		["parameters"] = { model },
		["post"] = {
			["cbi.submit"] = true
		}
	}
end

function firstchild()
	return {
		["type"] = "firstchild"
	}
end

function firstnode()
	return {
		["type"] = "firstchild",
		["recurse"] = true
	}
end

function arcombine(trg1, trg2)
	return {
		["type"] = "arcombine",
		["targets"] = { trg1, trg2 } --,
		--env = getfenv(),
	}
end

function alias(...)
	return {
		["type"] = "alias",
		["path"] = table.concat({ ... }, "/")
	}
end

function rewrite(n, ...)
	return {
		["type"] = "rewrite",
		["path"] = table.concat({ ... }, "/"),
		["remove"] = n
	}
end


translate = i18n.translate

-- This function does not actually translate the given argument but
-- is used by build/i18n-scan.pl to find translatable entries.
function _(text)
	return text
end
