--[[
LuCI - Lua Configuration Interface - miniDLNA support

Copyright 2012 Gabor Juhos <juhosg@openwrt.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("minidlna", translate("miniDLNA"),
	translate("MiniDLNA is server software with the aim of being fully compliant with DLNA/UPnP-AV clients."))

s = m:section(TypedSection, "minidlna", "miniDLNA Settings")
s.addremove = false
s.anonymous = true

o = s:option(Flag, "enabled", translate("Enable:"))
o.rmempty = false

function o.cfgvalue(self, section)
	return luci.sys.init.enabled("minidlna") and self.enabled or self.disabled
end

function o.write(self, section, value)
	if value == "1" then
		luci.sys.init.enable("minidlna")
		luci.sys.call("/etc/init.d/minidlna start >/dev/null")
	else
		luci.sys.call("/etc/init.d/minidlna stop >/dev/null")
		luci.sys.init.disable("minidlna")
	end

	return Flag.write(self, section, value)
end

port = s:option(Value, "port", translate("Port:"),
	translate("Port for HTTP (descriptions, SOAP, media transfer) traffic."))
port.datatype = "port"
port.default = 8200

s:option(Value, "interface", translate("Interfaces:"),
	translate("Network interfaces to serve, comma delimited list."))

o = s:option(Value, "friendly_name", translate("Friendly name:"),
	translate("Set this if you want to customize the name that shows up on your clients."))
o.optional = true
o.placeholder = "OpenWrt DLNA Server"

o = s:option(Value, "db_dir", translate("Database directory:"),
	translate("Set this if you would like to specify the directory where you want MiniDLNA to store its database and album art cache."))
o.optional = true
o.placeholder = "/var/cache/minidlna"

o = s:option(Value, "log_dir", translate("Log directory:"),
	translate("Set this if you would like to specify the directory where you want MiniDLNA to store its log file."))
o.optional = true
o.placeholder = "/var/log"

s:option(Flag, "inotify", translate("Enable inotify:"),
	translate("Set this to enable inotify monitoring to automatically discover new files."))

s:option(Flag, "enable_tivo", translate("Enable TIVO:"),
	translate("Set this to enable support for streaming .jpg and .mp3 files to a TiVo supporting HMO."))
o.optional = true

o = s:option(Flag, "strict_dlna", translate("Strict to DLNA standard:"),
	translate("Set this to strictly adhere to DLNA standards. This will allow server-side downscaling of very large JPEG images, which may hurt JPEG serving performance on (at least) Sony DLNA products."))
o.optional = true

o = s:option(Value, "presentation_url", translate("Presentation URL:"))
o.optional = true
o.placeholder = "http://192.168.1.1/"

o = s:option(Value, "notify_interval", translate("Notify interval:"),
	translate("Notify interval in seconds."))
o.datatype = "uinteger"
o.placeholder = 900

o = s:option(Value, "serial", translate("Announced serial number:"),
	translate("Serial number the miniDLNA daemon will report to clients in its XML description."))
o.placeholder = "12345678"

s:option(Value, "model_number", translate("Announced model number:"),
	translate("Model number the miniDLNA daemon will report to clients in its XML description."))
o.placholder = "1"

o = s:option(Value, "minissdpsocket", translate("miniSSDP socket:"),
	translate("Specify the path to the MiniSSDPd socket."))
o.optional = true
o.placeholder = "/var/run/minissdpd.sock"

o = s:option(ListValue, "root_container", translate("Root container:"))
o:value(".", translate("Standard container"))
o:value("B", translate("Browse directory"))
o:value("M", translate("Music"))
o:value("V", translate("Video"))
o:value("P", translate("Pictures"))

o = s:option(Value, "album_art_names", translate("Album art names:"),
	translate("This is a list of file names to check for when searching for album art. Note: names must be delimited with a forward slash '/'"))
o.optional = true
o.placeholder = "Cover.jpg/cover.jpg/AlbumArtSmall.jpg/albumartsmall.jpg"

s:option(DynamicList, "media_dir", translate("Media directories:"),
	translate("Set this to the directory you want scanned. If you want to restrict the directory to a specific content type, you can prepend the type ('A' for audio, 'V' for video, 'P' for images), followed by a comma, to the directory (eg. media_dir=A,/mnt/media/Music). Multiple directories can be specified."))

return m
