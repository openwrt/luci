--[[
LuCI - Lua Configuration Interface
Copyright 2019 lisaac <https://github.com/lisaac/luci-app-dockerman>
]]--

local http = require "luci.http"
local docker = require "luci.model.docker"

local m, s, o
local images, networks, containers, res

local dk = docker.new()
res = dk.images:list()
if res.code <300 then
	images = res.body
else
	return
end

res = dk.networks:list()
if res.code <300 then
	networks = res.body
else
	return
end

res = dk.containers:list({
	query = {
		all=true
	}
})
if res.code <300 then
	containers = res.body
else
	return
end

local urlencode = luci.http.protocol and luci.http.protocol.urlencode or luci.util.urlencode

function get_containers()
	local data = {}

	if type(containers) ~= "table" then
		return nil
	end

	for i, v in ipairs(containers) do
		local index = v.Id

		data[index]={}
		data[index]["_selected"] = 0
		data[index]["_id"] = v.Id:sub(1,12)
		data[index]["_name"] = v.Names[1]:sub(2)
		data[index]["_status"] = v.Status

		if v.Status:find("^Up") then
			data[index]["_status"] = '<font color="green">'.. data[index]["_status"] .. "</font>"
		else
			data[index]["_status"] = '<font color="red">'.. data[index]["_status"] .. "</font>"
		end

		if (type(v.NetworkSettings) == "table" and type(v.NetworkSettings.Networks) == "table") then
			for networkname, netconfig in pairs(v.NetworkSettings.Networks) do
				data[index]["_network"] = (data[index]["_network"] ~= nil and (data[index]["_network"] .." | ") or "").. networkname .. (netconfig.IPAddress ~= "" and (": " .. netconfig.IPAddress) or "")
			end
		end

		if v.Ports and next(v.Ports) ~= nil then
			data[index]["_ports"] = nil
			for _,v2 in ipairs(v.Ports) do
				data[index]["_ports"] = (data[index]["_ports"] and (data[index]["_ports"] .. ", ") or "")
					.. ((v2.PublicPort and v2.Type and v2.Type == "tcp") and ('<a href="javascript:void(0);" onclick="window.open((window.location.origin.match(/^(.+):\\d+$/) && window.location.origin.match(/^(.+):\\d+$/)[1] || window.location.origin) + \':\' + '.. v2.PublicPort ..', \'_blank\');">') or "")
					.. (v2.PublicPort and (v2.PublicPort .. ":") or "")  .. (v2.PrivatePort and (v2.PrivatePort .."/") or "") .. (v2.Type and v2.Type or "")
					.. ((v2.PublicPort and v2.Type and v2.Type == "tcp")and "</a>" or "")
			end
		end

		for ii,iv in ipairs(images) do
			if iv.Id == v.ImageID then
				data[index]["_image"] = iv.RepoTags and iv.RepoTags[1] or (iv.RepoDigests[1]:gsub("(.-)@.+", "%1") .. ":<none>")
			end
		end

		data[index]["_image_id"] = v.ImageID:sub(8,20)
		data[index]["_command"] = v.Command
	end

	return data
end

local container_list = get_containers()

m = SimpleForm("docker",
	translate("Docker - Containers"),
	translate("This page displays all containers that have been created on the connected docker host."))
m.submit=false
m.reset=false

s = m:section(SimpleSection)
s.template = "dockerman/apply_widget"
s.err=docker:read_status()
s.err=s.err and s.err:gsub("\n","<br>"):gsub(" ","&nbsp;")
if s.err then
	docker:clear_status()
end

s = m:section(Table, container_list, translate("Containers overview"))
s.addremove = false
s.sectionhead = translate("Containers")
s.sortable = false
s.template = "cbi/tblsection"
s.extedit = luci.dispatcher.build_url("admin", "docker", "container","%s")

o = s:option(Flag, "_selected","")
o.disabled = 0
o.enabled = 1
o.default = 0
o.write=function(self, section, value)
	container_list[section]._selected = value
end

o = s:option(DummyValue, "_id", translate("ID"))
o.width="10%"

o = s:option(DummyValue, "_name", translate("Container Name"))
o.rawhtml = true

o = s:option(DummyValue, "_status", translate("Status"))
o.width="15%"
o.rawhtml=true

o = s:option(DummyValue, "_network", translate("Network"))
o.width="15%"

o = s:option(DummyValue, "_ports", translate("Ports"))
o.width="10%"
o.rawhtml = true

o = s:option(DummyValue, "_image", translate("Image"))
o.width="10%"

o = s:option(DummyValue, "_command", translate("Command"))
o.width="20%"

local start_stop_remove = function(m,cmd)
	local container_selected = {}

	for k in pairs(container_list) do
		if container_list[k]._selected == 1 then
			container_selected[#container_selected + 1] = container_list[k]._name
		end
	end

	if #container_selected  > 0 then
		local success = true

		docker:clear_status()
		for _, cont in ipairs(container_selected) do
			docker:append_status("Containers: " .. cmd .. " " .. cont .. "...")
			local res = dk.containers[cmd](dk, {id = cont})
			if res and res.code >= 300 then
				success = false
				docker:append_status("code:" .. res.code.." ".. (res.body.message and res.body.message or res.message).. "\n")
			else
				docker:append_status("done\n")
			end
		end

		if success then
			docker:clear_status()
		end

		luci.http.redirect(luci.dispatcher.build_url("admin/docker/containers"))
	end
end

s = m:section(Table,{{}})
s.notitle=true
s.rowcolors=false
s.template="cbi/nullsection"

o = s:option(Button, "_new")
o.inputtitle= translate("Add")
o.template = "dockerman/cbi/inlinebutton"
o.inputstyle = "add"
o.forcewrite = true
o.write = function(self, section)
	luci.http.redirect(luci.dispatcher.build_url("admin/docker/newcontainer"))
end

o = s:option(Button, "_start")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle=translate("Start")
o.inputstyle = "apply"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m,"start")
end

o = s:option(Button, "_restart")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle=translate("Restart")
o.inputstyle = "reload"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m,"restart")
end

o = s:option(Button, "_stop")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle=translate("Stop")
o.inputstyle = "reset"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m,"stop")
end

o = s:option(Button, "_kill")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle=translate("Kill")
o.inputstyle = "reset"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m,"kill")
end

o = s:option(Button, "_remove")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle=translate("Remove")
o.inputstyle = "remove"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m,"remove")
end

return m
