-- Copyright 2014 Álvaro Fernández Rojas <noltari@gmail.com>
-- Licensed to the public under the Apache License 2.0.

m = Map("shairport", "Shairport", translate("Shairport is a simple AirPlay server implementation, here you can configure the settings."))

s = m:section(TypedSection, "shairport", "")
s.addremove = true
s.anonymous = false

enable=s:option(Flag, "disabled", translate("Enabled"))
enable.enabled="0"
enable.disabled="1"
enable.default = "1"
enable.rmempty = false
respawn=s:option(Flag, "respawn", translate("Respawn"))
respawn.default = false

bname = s:option(Value, "bname", translate("Airport Name"))
bname.rmempty = true

pw = s:option(Value, "password", translate("Password"))
pw.rmempty = true
pw.password = true

port=s:option(Value, "port", translate("Port"))
port.rmempty = true
port.datatype = "port"

buffer=s:option(Value, "buffer", translate("Buffer fill"))
buffer.rmempty = true
buffer.datatype = "uinteger"

log_file=s:option(Value, "log_file", translate("Log file"))
log_file.rmempty = true
--log_file.datatype = "file"

err_file=s:option(Value, "err_file", translate("Error file"))
err_file.rmempty = true
--err_file.datatype = "file"

meta_dir=s:option(Value, "meta_dir", translate("Metadata directory"))
meta_dir.rmempty = true
meta_dir.datatype = "directory"

cmd_start=s:option(Value, "cmd_start", translate("Command when playback begins"))
cmd_start.rmempty = true

cmd_stop=s:option(Value, "cmd_stop", translate("Command when playback ends"))
cmd_stop.rmempty = true

cmd_wait=s:option(Flag, "cmd_wait", translate("Block while the commands run"))
cmd_wait.default = false

mdns=s:option(ListValue, "mdns", translate("mDNS"))
mdns.rmempty = true
mdns:value("", translate("Default"))
mdns:value("avahi")
mdns:value("dns_sd")
mdns:value("external_avahi")
mdns:value("external_dns_sd")
mdns:value("tinysvcmdns")

audio_output=s:option(ListValue, "audio_output", translate("Audio output"))
audio_output.rmempty = true
audio_output:value("", translate("Default"))
audio_output:value("alsa")
audio_output:value("ao")
audio_output:value("dummy")
audio_output:value("pulse")
audio_output:value("pipe")

-- alsa output --
output_dev=s:option(Value, "output_dev", translate("Output device"))
output_dev.rmempty = true
output_dev:depends("audio_output", "alsa")

mixer_dev=s:option(Value, "mixer_dev", translate("Mixer device"))
mixer_dev.rmempty = true
mixer_dev:depends("audio_output", "alsa")

mixer_type=s:option(ListValue, "mixer_type", translate("Mixer type"))
mixer_type.rmempty = true
mixer_type:value("", translate("Default"))
mixer_type:value("software")
mixer_type:value("hardware")
mixer_type:depends("audio_output", "alsa")

mixer_control=s:option(Value, "mixer_control", translate("Mixer control"))
mixer_control.rmempty = true
mixer_control:depends("audio_output", "alsa")

mixer_index = s:option(ListValue, "mixer_index", translate("Mixer index"))
mixer_index.rmempty = true
mixer_index:depends("audio_output", "alsa")
mixer_index:value("", translate("Default"))
local pats = io.popen("find /proc/asound/ -type d -name 'card*' | sort")
if pats then
	local l
	while true do
		l = pats:read("*l")
		if not l then break end

		l = string.gsub(l, "/proc/asound/card", "")
		if l then
			mixer_index:value(l)
		end
	end
	pats:close()
end

-- ao output --
ao_driver=s:option(Value, "ao_driver", translate("AO driver"))
ao_driver.rmempty = true
ao_driver:depends("audio_output", "ao")

ao_name=s:option(Value, "ao_name", translate("AO name"))
ao_name.rmempty = true
ao_name:depends("audio_output", "ao")

ao_id = s:option(ListValue, "ao_id", translate("AO id"))
ao_id.rmempty = true
ao_id:depends("audio_output", "ao")
ao_id:value("", translate("Default"))
local pats = io.popen("find /proc/asound/ -type d -name 'card*' | sort")
if pats then
	local l
	while true do
		l = pats:read("*l")
		if not l then break end

		l = string.gsub(l, "/proc/asound/card", "")
		if l then
			ao_id:value(l)
		end
	end
	pats:close()
end

ao_options=s:option(Value, "ao_options", translate("AO options"))
ao_options.rmempty = true
ao_options:depends("audio_output", "ao")

-- pipe output --
output_fifo=s:option(Value, "output_fifo", translate("Output FIFO"))
output_fifo.rmempty = true
output_fifo:depends("audio_output", "pipe")

-- pulse output --
pulse_server=s:option(Value, "pulse_server", translate("Pulse server"))
pulse_server.rmempty = true
pulse_server:depends("audio_output", "pulse")

pulse_sink=s:option(Value, "pulse_sink", translate("Pulse sink"))
pulse_sink.rmempty = true
pulse_sink:depends("audio_output", "pulse")

pulse_appname=s:option(Value, "pulse_appname", translate("Pulse application name"))
pulse_appname.rmempty = true
pulse_appname:depends("audio_output", "pulse")

return m
