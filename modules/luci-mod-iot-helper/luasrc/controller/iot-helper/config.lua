-- Copyright 2018 TJ Kolev (tjkolev@gmail.com)
-- This is free software, licensed under the Apache License, Version 2.0

module("luci.controller.iot-helper.config", package.seeall)

function index()
	entry({"admin","system","iot-helper"}, cbi("iot-helper/config", {autoapply=true}), "IoT Helper", 85).dependent=false
end

