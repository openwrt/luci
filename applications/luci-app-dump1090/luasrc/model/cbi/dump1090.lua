-- Copyright 2014 Álvaro Fernández Rojas <noltari@gmail.com>
-- Licensed to the public under the Apache License 2.0.

m = Map("dump1090", "dump1090", translate("dump1090 is a Mode S decoder specifically designed for RTLSDR devices, here you can configure the settings."))

s = m:section(TypedSection, "dump1090", "")
s.addremove = true
s.anonymous = false

enable=s:option(Flag, "disabled", translate("Enabled"))
enable.enabled="0"
enable.disabled="1"
enable.default = "1"
enable.rmempty = false
respawn=s:option(Flag, "respawn", translate("Respawn"))
respawn.default = false

device_index=s:option(Value, "device_index", translate("RTL device index"))
device_index.rmempty = true
device_index.datatype = "uinteger"

gain=s:option(Value, "gain", translate("Gain (-10 for auto-gain)"))
gain.rmempty = true
gain.datatype = "integer"

enable_agc=s:option(Flag, "enable_agc", translate("Enable automatic gain control"))
enable_agc.default = false

freq=s:option(Value, "freq", translate("Frequency"))
freq.rmempty = true
freq.datatype = "uinteger"

ifile=s:option(Value, "ifile", translate("Data file"))
ifile.rmempty = true
ifile.datatype = "file"

raw=s:option(Flag, "raw", translate("Show only messages hex values"))
raw.default = false

net=s:option(Flag, "net", translate("Enable networking"))

modeac=s:option(Flag, "modeac", translate("Enable decoding of SSR Modes 3/A & 3/C"))
modeac.default = false

net_beast=s:option(Flag, "net_beast", translate("TCP raw output in Beast binary format"))
net_beast.default = false

net_only=s:option(Flag, "net_only", translate("Enable just networking, no RTL device or file used"))
net_only.default = false

net_bind_address=s:option(Value, "net_bind_address", translate("IP address to bind to"))
net_bind_address.rmempty = true
net_bind_address.datatype = "ipaddr"

net_http_port=s:option(Value, "net_http_port", translate("HTTP server port"))
net_http_port.rmempty = true
net_http_port.datatype = "port"

net_ri_port=s:option(Value, "net_ri_port", translate("TCP raw input listen port"))
net_ri_port.rmempty = true
net_ri_port.datatype = "port"

net_ro_port=s:option(Value, "net_ro_port", translate("TCP raw output listen port"))
net_ro_port.rmempty = true
net_ro_port.datatype = "port"

net_sbs_port=s:option(Value, "net_sbs_port", translate("TCP BaseStation output listen port"))
net_sbs_port.rmempty = true
net_sbs_port.datatype = "port"

net_bi_port=s:option(Value, "net_bi_port", translate("TCP Beast input listen port"))
net_bi_port.rmempty = true
net_bi_port.datatype = "port"

net_bo_port=s:option(Value, "net_bo_port", translate("TCP Beast output listen port"))
net_bo_port.rmempty = true
net_bo_port.datatype = "port"

net_ro_size=s:option(Value, "net_ro_size", translate("TCP raw output minimum size"))
net_ro_size.rmempty = true
net_ro_size.datatype = "uinteger"

net_ro_rate=s:option(Value, "net_ro_rate", translate("TCP raw output memory flush rate"))
net_ro_rate.rmempty = true
net_ro_rate.datatype = "uinteger"

net_heartbeat=s:option(Value, "net_heartbeat", translate("TCP heartbeat rate in seconds"))
net_heartbeat.rmempty = true
net_heartbeat.datatype = "uinteger"

net_buffer=s:option(Value, "net_buffer", translate("TCP buffer size 64Kb * (2^n)"))
net_buffer.rmempty = true
net_buffer.datatype = "uinteger"

lat=s:option(Value, "lat", translate("Reference/receiver latitude for surface posn"))
lat.rmempty = true
lat.datatype = "integer"

lon=s:option(Value, "lon", translate("Reference/receiver longitude for surface posn"))
lon.rmempty = true
lon.datatype = "integer"

fix=s:option(Flag, "fix", translate("Enable single-bits error correction using CRC"))
fix.default = false

no_fix=s:option(Flag, "no_fix", translate("Disable single-bits error correction using CRC"))
no_fix.default = false

no_crc_check=s:option(Flag, "no_crc_check", translate("Disable messages with broken CRC"))
no_crc_check.default = false

phase_enhance=s:option(Flag, "phase_enhance", translate("Enable phase enhancement"))
phase_enhance.default = false

agressive=s:option(Flag, "agressive", translate("More CPU for more messages"))
agressive.default = false

mlat=s:option(Flag, "mlat", translate("Display raw messages in Beast ascii mode"))
mlat.default = false

stats=s:option(Flag, "stats", translate("Print stats at exit"))
stats.default = false

stats_every=s:option(Value, "stats_every", translate("Show and reset stats every seconds"))
stats_every.rmempty = true
stats_every.datatype = "uinteger"

onlyaddr=s:option(Flag, "onlyaddr", translate("Show only ICAO addresses"))
onlyaddr.default = false

metric=s:option(Flag, "metric", translate("Use metric units"))
metric.default = false

snip=s:option(Flag, "snip", translate("Strip IQ file removing samples"))
snip.rmempty = true
snip.datatype = "uinteger"

debug_mode=s:option(Flag, "debug", translate("Debug mode flags"))
debug_mode.rmempty = true

ppm=s:option(Flag, "ppm", translate("Set receiver error in parts per million"))
ppm.rmempty = true
ppm.datatype = "uinteger"

return m
