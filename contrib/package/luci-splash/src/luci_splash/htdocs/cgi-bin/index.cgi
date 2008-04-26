#!/usr/bin/haserl --shell=luac
dofile("/usr/lib/luci_splash")

require("ffluci.template")

function dispatch()
	local mac = get_usermac()
	if not mac then
		return action_nodata()
	end
	
	if isblacklisted(mac) then
		return action_blocked()
	end
	
	if iswhitelisted(mac) or haslease(mac) then
		return action_allowed()
	end

	return action_splash(mac)
end

function action_splash(mac)
	if ffluci.http.formvalue("activate") then
		add_lease(mac)
		ffluci.http.textheader()
		print("Got splashed!")
	else
		ffluci.http.textheader()
		print("Get splashed!")
	end
end

function action_allowed()
	ffluci.http.textheader()
	print("Already allowed!")
end

function action_blocked()
	ffluci.http.textheader()
	print("Blocked!")
end

function action_nodata()
	ffluci.http.textheader()
	print("No data!")
end

dispatch()