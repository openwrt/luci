-- Copyright 2018 TJ Kolev (tjkolev@gmail.com)
-- This is free software, licensed under the Apache License, Version 2.0

module("luci.controller.iot.config", package.seeall)

function index()
	entry({"admin","system","iotconfig"}, cbi("iot/config", {autoapply=true}), "IoT Configuration", 85).dependent=false
end

