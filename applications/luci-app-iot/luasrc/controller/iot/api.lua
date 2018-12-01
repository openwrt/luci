-- Copyright 2018 TJ Kolev (tjkolev@gmail.com)
-- This is free software, licensed under the Apache License, Version 2.0

module("luci.controller.iot.api", package.seeall)

function index()
	entry({"iot","api","config"}, call("action_config")).dependent=false
	entry({"iot","api","notify"}, call("action_notify")).dependent=false
end


local IOT_API_QRY_DEVICEID = "deviceid"
local IOT_API_QRY_EVENTID = "eventid"

local IOT_UCI_CONFIG = "iot"
local IOT_UCI_SECTION_DEVICE = "device"
local IOT_UCI_SECTION_EVENT = "event"
local IOT_UCI_SECTION_GENERAL = "general"
local IOT_UCI_SECTION_SMTP = "smtp"
local IOT_UCI_OPTION_CONFIG = "config"
local IOT_UCI_OPTION_DEF_DEVICE = "defaultdevice"
local IOT_UCI_OPTION_DEF_EVENT = "defaultevent"


local uci = require("luci.model.uci")
local http = require("luci.http")

function action_config()

	http_setup()
	
	local method = http.getenv("REQUEST_METHOD")
	if(method ~= "GET") then
		http.status(400, "Invalid method.")
		return
	end
	
	local deviceId = get_query_param_value(IOT_API_QRY_DEVICEID)
	local deviceSection = get_section(IOT_UCI_SECTION_DEVICE, deviceId)
	if(nil == deviceSection) then
		local defDevId = get_general_option(IOT_UCI_OPTION_DEF_DEVICE)
		deviceSection = get_section(IOT_UCI_SECTION_DEVICE, defDevId)
	end
		
	if(nil == deviceSection) then
		http.status(404, "Device config not found.")
		return
	end
	
	local config = deviceSection[IOT_UCI_OPTION_CONFIG]
	if(config ~= nil) then
		http.write(config)
	end
	
end


function action_notify()

	http_setup()
	
	local method = http.getenv("REQUEST_METHOD")
	if(method ~= "POST") then
		http.status(400, "Invalid method.")
		return
	end
	
	local postData = http.content()
	
	local qryEventId = get_query_param_value(IOT_API_QRY_EVENTID)
	local eventSection = get_section(IOT_UCI_SECTION_EVENT, qryEventId)
	if(nil == eventSection) then
		local defaultEventId = get_general_option(IOT_UCI_OPTION_DEF_EVENT)
		eventSection = get_section(IOT_UCI_SECTION_EVENT, defaultEventId)
	end
	
	if(nil == eventSection) then
		http.status(404, "Event config not found.")
		return
	end
	
	local smtpSection = get_section(IOT_UCI_SECTION_SMTP, IOT_UCI_SECTION_SMTP)
	
	sendMessage(smtpSection, eventSection, postData)

end


-- SSL smtp code by
-- Michal Kottman, 2011, public domain
-- https://stackoverflow.com/a/11070674

function sslCreate()

	local socket = require 'socket'
	local ssl = require 'ssl'
	
	local sock = socket.tcp()
	return setmetatable({
		connect = function(_, host, port)
			local r, e = sock:connect(host, port)
			if not r then return r, e end
			sock = ssl.wrap(sock, {mode='client', protocol='tlsv1'})
			return sock:dohandshake()
		end
	}, {
		__index = function(t,n)
			return function(_, ...)
				return sock[n](sock, ...)
			end
		end
	})
	
end


function sendMessage(smtpSection, eventSection, deviceMessage)

	local smtp = require 'socket.smtp'
	
	local emailBody = eventSection["msg"] .. "\n\n----------\n\n" .. deviceMessage .. "\n"
	
	local msg = {
		headers = {
			from = smtpSection["from"],
			to = eventSection["recipients"],
			subject = eventSection["subject"]
		},
		body = emailBody
	}
	
	local secureSmtp = smtpSection["secure"]
	local smtpCreateFunction = nil
	if secureSmtp then 
		smtpCreateFunction = sslCreate
	end
	
	local ok, err = smtp.send {
		from = smtpSection["from"],
		rcpt = eventSection["recipients"],
		source = smtp.message(msg),
		user = smtpSection["user"],
		password = smtpSection["password"],
		server = smtpSection["server"],
		port = smtpSection["port"],
		create = smtpCreateFunction
	}
	
	if not ok then
		http.status(500, "Failed to send notification for event. " .. err)
		return
	end
	
end


function get_query_param_value(qryParam)
	local paramValue = ""
	local qparams = http.formvalue()
	for k, v in pairs(qparams) do
		local qryKey = string.lower(k)
		local qryVal = string.lower(v)
		if(qryKey == qryParam) then
			paramValue = qryVal
			break
		end
	end
	return paramValue
end


function http_setup()
	http.prepare_content("text/plain")
	http.header("Date", os.date("!%a, %d %b %Y %H:%M:%S GMT"))
	-- non standard time header that's somewhat easier to parse
	http.header("X-IoT-UtcTime", os.date("!%Y%m%d%H%M%S"))
end


function get_section(typeName,  sectionId)

	local uciSection = nil
	local x = uci.cursor()
	x:foreach(IOT_UCI_CONFIG, typeName, 
		function(s)
			for key, value in pairs(s) do
				if(key == ".name" and string.lower(value) == sectionId) then
					uciSection = s
					return false -- outer foreach will stop iterating further
				end
			end
		end
	)
	return uciSection
	
end


function get_general_option(optionName)
	local genSection = get_section(IOT_UCI_SECTION_GENERAL, IOT_UCI_SECTION_GENERAL)
	return genSection[optionName]
end