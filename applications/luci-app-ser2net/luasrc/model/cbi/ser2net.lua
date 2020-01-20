-- Copyright (C) 2020 Michele Primavera
-- Licensed to the public under the Apache License 2.0.

m = Map("ser2net", translate("ser2net"),
        translate("The ser2net service allows telnet and tcp sessions to be established with a unit's serial ports.<br/>"))

function m.on_after_commit(self)
        luci.sys.init.enable("ser2net")
        luci.sys.call("/etc/init.d/ser2net restart >/dev/null 2>&1")
end

s = m:section(TypedSection, "ser2net", translate("Global switch"))
s.anonymous = true

enabled = s:option(Flag, "enabled", translate("Enabled"))
enabled.rmempty = false

s = m:section(TypedSection, "controlport", translate("Control port"))
s.anonymous = true

enabled = s:option(Flag, "enabled", translate("Enabled"))
enabled.rmempty = false

host = s:option(Value, "host", translate("Binding address"), translate("The network to listen from."))
host.rmempty = false
host.default = "localhost"

port = s:option(Value, "port", translate("Control port"), translate("The TCP port to listen on."))
port.rmempty = false
port.default = "2000"

s = m:section(TypedSection, "default", translate("Default settings"))
s.anonymous = true

baudrate = s:option(ListValue, "speed", translate("Baud rate"), translate("The speed the device port should operate at."))
baudrate.rmempty = false
baudrate:value(300)
baudrate:value(1200)
baudrate:value(2400)
baudrate:value(4800)
baudrate:value(9600)
baudrate:value(19200)
baudrate:value(38400)
baudrate:value(57600)
baudrate:value(115200)
baudrate.default = 9600

databits = s:option(ListValue, "databits", translate("Data bits"))
databits.rmempty = false
databits:value(8)
databits:value(7)
databits.default = 8

parity = s:option(ListValue, "parity", translate("Parity"))
parity.rmempty = false
parity:value("none", translate("None"))
parity:value("even", translate("Even"))
parity:value("odd", translate("Odd"))

stopbits = s:option(ListValue, "stopbits", translate("Stop bits"))
stopbits.rmempty = false
stopbits:value(1)
stopbits:value(2)

rtscts = s:option(Flag, "rtscts", translate("Use RTS and CTS lines"))
local_ = s:option(Flag, "local", translate("Ignore modem control signals"))
remctl = s:option(Flag, "remctl", translate("Allow the RFC 2217 protocol"))

s = m:section(TypedSection, "proxy", translate("Proxies"))

s.anonymous = true
s.addremove = true

enabled = s:option(Flag, "enabled", translate("Enabled"))
enabled.rmempty = false

port = s:option(Value, "port", translate("Server port"), translate("The TCP port to listen on."))
port.rmempty = false
port.default = "5000"

protocol = s:option(ListValue, "protocol", translate("Protocol"), translate("The protocol to listen to."))
protocol.rmempty = false
protocol:value("raw", translate("Raw"))
protocol:value("rawlp", translate("Rawlp"))
protocol:value("telnet", translate("Telnet"))
protocol:value("off", translate("Off"))
protocol.default = "raw"

timeout = s:option(Value, "timeout", translate("Timeout"), translate("The amount of seconds of inactivity before a disconnect occurs.<br/>A value of zero means wait indefinitely."))
timeout.rmempty = false
timeout.default = "0"

device = s:option(Value, "device", translate("Device"), translate("The name of the device to connect to.<br/>This must be in the form of /dev/<device>."))
device.rmempty = false
device.default = "/dev/ttyUSB0"

baudrate = s:option(ListValue, "baudrate", translate("Baud rate"), translate("The speed the device port should operate at."))
baudrate.rmempty = false
baudrate:value(300)
baudrate:value(1200)
baudrate:value(2400)
baudrate:value(4800)
baudrate:value(9600)
baudrate:value(19200)
baudrate:value(38400)
baudrate:value(57600)
baudrate:value(115200)
baudrate.default = 9600

databits = s:option(ListValue, "databits", translate("Data bits"))
databits.rmempty = false
databits:value(8)
databits:value(7)
databits.default = 8

parity = s:option(ListValue, "parity", translate("Parity"))
parity.rmempty = false
parity:value("none", translate("None"))
parity:value("even", translate("Even"))
parity:value("odd", translate("Odd"))

stopbits = s:option(ListValue, "stopbits", translate("Stop bits"))
stopbits.rmempty = false
stopbits:value(1)
stopbits:value(2)

rtscts = s:option(Flag, "rtscts", translate("Use RTS and CTS lines"))
local_ = s:option(Flag, "local", translate("Ignore modem control signals"))
xonoff = s:option(Flag, "xonxoff", translate("Turn on XON and XOFF support."))

options = s:option(DynamicList, "options", translate("Extra options"))

led_tx = s:option(Value, "led_tx", translate("TX LED configuration"))
led_tx.default = ""
led_rx = s:option(Value, "led_rx", translate("RX LED configuration"))
led_rx.default = ""

s = m:section(TypedSection, "led", translate("LED redirect"))

s.anonymous = false
s.addremove = true

driver = s:option(Value, "driver", translate("Driver"), translate("The driver required for the device."))
driver.default = "sysfs"
driver.rmempty = false

device = s:option(Value, "device", translate("Device"), translate("The device itself."))
device.default = "duckbill:red:rs485"
device.rmempty = false

duration = s:option(Value, "duration", translate("Duration"), translate("Blink duration."))
device.default = 20
device.rmempty = false

state = s:option(Flag, "state", translate("State"))
state.rmempty = false

return m
