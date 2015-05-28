require("luci.tools.webadmin")

--------------------------------------------------------------------------------------

local function FlagIfFileExists(tab, section, chkcmd, varname, title, text, noexist_text)
    local x = luci.util.exec(chkcmd)
    local opt
    if x == "" then
    opt = DummyValue
    else
    opt = Flag
    end
    x = section:taboption(tab, opt, varname, title, text)
    if opt == Flag then
    return x
    else
    x.value = noexist_text
    return nil
    end
end

--------------------------------------------------------------------------------------

local m = Map(
    "squeezelite", 
    "Squeezelite", 
    "Squeezelite is a small headless squeezebox emulator for linux using alsa audio output. " ..
    "It is aimed at supporting high quality audio including usb dac based output at multiple sample rates. " ..
    "Native support of dsd playback to dop capable dac or via conversion to pcm.")

m.on_after_commit = function()
    luci.sys.call("/etc/init.d/squeezelite restart")
end

--------------------------------------------------------------------------------------

local s = m:section(NamedSection, "options", "options", "Base options")
s.addremove = false
s.anonymous = true

local n = s:option(Value, "name", "Name", "Name to identify this player on server")
n.datatype = "hostname"
n.default = "SqueezeWRT"
n.optional = false

local o = s:option(ListValue, "device", "Output device", "Audio device to play music");
o.optional = false
o.default = "hw:0,0"
o:value("hw:0,0","hw:0,0")
for devstring in luci.util.execi("/usr/bin/squeezelite -l") do
    local pair = luci.util.split(devstring, "-", 1)
    if pair[2] == nil then
    else
        local dev = luci.util.trim(pair[1])
        local txt = luci.util.trim(pair[2])
        o:value(dev, txt)
    end
end

--------------------------------------------------------------------------------------

s = m:section(NamedSection, "options", "options", "Advanced options")
s.addremove = false
s.anonymous = true

--------------------------------------------------------------------------------------

s:tab("device", "Audio device")

local sr = s:taboption("device", ListValue, "max_sr", "Max. sampling rate", "Max. sampling rate supported by the output device");
sr.optional = false
sr.default = 0
sr:value(0,"Default")
sr:value(44100,"44.1 KHz")
sr:value(48000, "48 KHz")
sr:value(88200,"88.2 KHz")
sr:value(96000,"96 KHz")
sr:value(176400,"176.4 KHz")
sr:value(192000,"192 KHz")
sr:value(352800,"352.8 KHz")
sr:value(384000,"384 KHz")

local srd = s:taboption("device", Value, "sr_delay", "SR delay", "Optional delay switching sampling ratess in ms, 0 (default) is no delay")
srd:depends("max_sr", 44100);
srd:depends("max_sr", 48000);
srd:depends("max_sr", 88200);
srd:depends("max_sr", 96000);
srd:depends("max_sr", 176400);
srd:depends("max_sr", 192000);
srd:depends("max_sr", 352800);
srd:depends("max_sr", 384000);
srd.datatype = "range(0,30)"
srd.default = 0
srd.optional = false

local cld = s:taboption("device", Value, "close_delay", "Close delay", "Close output device when idle after timeout seconds, 0 (default) is to keep it open while player is 'on'")
cld.datatype = "range(0,3600)"
cld.default = 0
cld.optional = false

--------------------------------------------------------------------------------------

s:tab("player", "Player")

local mdn = s:taboption("player", Value, "model_name", "Model name", "Set the squeezelite player model name sent to the server (default: SqueezeLite)")
mdn.datatype = "hostname"
mdn.default = "SqueezeLite"
mdn.optional = false

local lse = s:taboption("player", Flag, "specific_server", "Specific server", "Connect to server with specific IP and port. Uses autodiscovery when not checked")
lse.default = 0
lse.optional = false

local lsa = s:taboption("player", Value, "server_addr", "Server IP", "When 'Specific server' checked, connect to server with this IP")
lsa:depends("specific_server", 1);
lsa.datatype = "ip4addr"
lsa.default = "127.0.0.1"
lsa.optional = false

local lsp = s:taboption("player", Value, "server_port", "Server port", "When 'Specific server' checked, connect to server with this port")
lsp:depends("specific_server", 1);
lsp.datatype = "port"
lsp.default = 3483
lsp.optional = false

local ppr = s:taboption("player", Value, "priority", "Thread priority", "Set real time priority of output thread (1-99). When 0, use default priority")
ppr.datatype = "range(0,99)"
ppr.default = 0
ppr.optional = false

local sbe = s:taboption("player", Flag, "specific_bufsiz", "Set Buffer sizes", "Specify internal Stream and Output buffer sizes in Kbytes. When not checked use default")
sbe.default = 0
sbe.optional = false

local sbs = s:taboption("player", Value, "stream_bufsiz", "Stream buffer", "When 'Set Buffer sizes' checked, specify internal Stream buffer size in Kbytes")
sbs:depends("specific_bufsiz", 1);
sbs.datatype = "range(128,16384)"
sbs.default = 2048
sbs.optional = false

local sbo = s:taboption("player", Value, "out_bufsiz", "Output buffer", "When 'Set Buffer sizes' checked, specify internal Output buffer size in Kbytes")
sbo:depends("specific_bufsiz", 1);
sbo.datatype = "range(128,16384)"
sbo.default = 3763
sbo.optional = false

--------------------------------------------------------------------------------------

s:tab("alsa", "ALSA")

local ape = s:taboption("alsa", Flag, "specific_devopen", "Device open params", "Specify ALSA parameters to open output device. When not checked use default")
ape.default = 0
ape.optional = false

local apb = s:taboption("alsa", Value, "alsa_buffer", "ALSA buffer", "When 'Device open params' checked, ALSA buffer time in ms or size in bytes, 0 to default value");
apb:depends("specific_devopen", 1);
apb.datatype = "uinteger"
apb.default = 200
apb.optional = false

local app = s:taboption("alsa", Value, "alsa_period", "ALSA period", "When 'Device open params' checked, ALSA period count or size in bytes, 0 to default value");
app:depends("specific_devopen", 1);
app.datatype = "uinteger"
app.default = 0
app.optional = false

local apf = s:taboption("alsa", ListValue, "alsa_format", "ALSA sample format", "When 'Device open params' checked, ALSA audio sample format");
apf:depends("specific_devopen", 1);
apf.default = "0"
apf.optional = false
apf:value("0","Default")
apf:value("16","16 bit")
apf:value("24","24 bit")
apf:value("24_3","24/3 bit")
apf:value("32","32 bit")

local apm = s:taboption("alsa", Flag, "alsa_mmap", "ALSA use mmap", "When 'Device open params' checked, ALSA use mmap");
apm:depends("specific_devopen", 1);
apm.default = 1
apm.optional = false

--------------------------------------------------------------------------------------

s:tab("codec", "Codecs")

local flc = FlagIfFileExists("codec", s, "ls /usr/lib/libFLAC.*", "decode_flac", "FLAC in player", "FLAC decoding takes place in player, not in server", "No libFLAC found");
if flc ~= nil then
    flc.optional = false
    flc.default = 0
end

local mad = FlagIfFileExists("codec", s, "ls /usr/lib/libmad.*", "decode_mp3", "MP3 in player", "MP3 decoding takes place in player, not in server", "No libmad found");
if mad ~= nil then
    mad.optional = false
    mad.default = 0
end

local ogg = FlagIfFileExists("codec", s, "ls /usr/lib/libogg.*", "decode_ogg", "OGG in player", "OGG decoding takes place in player, not in server", "No libogg found");
if ogg ~= nil then
    ogg.optional = false
    ogg.default = 0
end

local faad = FlagIfFileExists("codec", s, "ls /usr/lib/libfaad.*", "decode_aac", "AAC in player", "AAC decoding takes place in player, not in server", "No libfaad found");
if faad ~= nil then
    faad.optional = false
    faad.default = 0
end

local wma = FlagIfFileExists("codec", s, "ls /usr/lib/libavformat.*", "decode_wma_alac", "WMA and ALAC in player", "WMA and ALAC decoding takes place in player, not in server", "No libavformat found");
if wma ~= nil then
    wma.optional = false
    wma.default = 0
end

local dop = s:taboption("codec", Flag, "dsd_over_pcm", "DSD over PCM", "Output device supports DSD over PCM (DoP)");
dop.optional = false
dop.default = 0

--------------------------------------------------------------------------------------

s:tab("remote", "Remote control")

local ir = FlagIfFileExists("remote", s, "ls /etc/init.d/lircd", "ircontrol", "Use LIRC", "Enable LIRC remote control support", "No LIRC daemon found")
if ir ~= nil then
    ir.optional = false
    ir.default = 1
end

local irc = s:taboption("remote", Value, "lirc_voldown", "Vol -", "Volume down command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_VOLUMEDOWN"

local irc = s:taboption("remote", Value, "lirc_volup", "Vol +", "Volume up command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_VOLUMEUP"

local irc = s:taboption("remote", Value, "lirc_rew", "Prev", "Previous track command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_PREVIOUSSONG"

local irc = s:taboption("remote", Value, "lirc_fwd", "Next", "Next track command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_NEXTSONG"

local irc = s:taboption("remote", Value, "lirc_pause", "Pause", "Pause playback command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_PLAYPAUSE"

local irc = s:taboption("remote", Value, "lirc_play", "Play", "Start playback command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_PLAYPAUSE"

local irc = s:taboption("remote", Value, "lirc_power", "Power", "Power toggle command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_POWER"

local irc = s:taboption("remote", Value, "lirc_muting", "Mute", "Mute / unmute playback command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_MUTE"

local irc = s:taboption("remote", Value, "lirc_power_on", "Power On", "Power on command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_POWER"

local irc = s:taboption("remote", Value, "lirc_power_off", "Power Off", "Power off command")
irc:depends("ircontrol", 1)
irc.optional = false
irc.default = "KEY_POWER"

--------------------------------------------------------------------------------------

return m
