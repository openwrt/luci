m = Map("ser2net", translate("ser2net"),
        translate("The ser2net allows telnet and tcp sessions to be established with a unit's serial ports.<br/>"))

function m.on_after_commit(self)
        luci.sys.call("/etc/init.d/ser2net enable 1\>/dev/null 2\>/dev/null")
        luci.sys.call("/etc/init.d/ser2net restart 1\>/dev/null 2\>/dev/null")
end

s = m:section(TypedSection, "proxy", translate("Proxies"),
        translate("The program comes up normally as a service, opens the TCP ports specified in the configuration file, and waits for connections.<br/>Once a connection occurs, the program attempts to set up the connection and open the serial port.<br/>If another user is already using the connection or serial port, the connection is refused with an error message."))

s.anonymous = true
s.addremove = true

tcpport = s:option(Value, "tcpport", translate("TCP Port"),
        translate("Name or number of the TCP/IP port to accept connections from for this device.<br/>A port number may be of the form [host,]port, such as 127.0.0.1,2000 or localhost,2000.<br/>If this is specified, it will only bind to the IP address specified for the port.<br/>Otherwise, it will bind to all the ports on the machine."))

tcpport.rmempty = false
tcpport.default = "127.0.0.1,8000"

state = s:option(Value, "state", translate("State"),
        translate("Either raw or rawlp or telnet or off. off disables the port from accepting connections.<br/>It can be turned on later from the control port.<br/>raw enables the port and transfers all data as-is between the port and the long.<br/>rawlp enables the port and transfers all input data to device, device is open without any termios setting.<br/>It allow to use /dev/lpX devices and printers connected to them.<br/>telnet enables the port and runs the telnet protocol on the port to set up telnet parameters. This is most useful for using telnet."))
state.rmempty = false
state:value("raw", translate("Raw"))
state:value("rawlp", translate("Rawlp"))
state:value("telnet", translate("Telnet"))
state:value("off", translate("Off"))
state.default = "raw"


timeout = s:option(Value, "timeout", translate("Timeout"),
        translate("The time (in seconds) before the port will be disconnected if there is no activity on it.<br/>A zero value disables this funciton."))
timeout.rmempty = false
timeout.default = "30"

device = s:option(Value, "device", translate("Device"),
        translate("The name of the device to connect to.<br/>This must be in the form of /dev/<device>."))
device.rmempty = false
device.default = "/dev/ttyUSB0"

options = s:option(Value, "options", translate("Options"),
        translate("Sets operational parameters for the serial port.<br/>Values may be separated by spaces or commas.<br/>Options 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200 set the various baud rates. EVEN, ODD, NONE set the parity.<br/>1STOPBIT, 2STOPBITS set the number of stop bits.<br/>7DATABITS, 8DATABITS set the number of data bits. [-]XONXOFF turns on (- off) XON/XOFF support.<br/>[-]RTSCTS turns on (- off) hardware flow control.<br/>[-]LOCAL ignores (- checks) the modem control lines (DCD, DTR, etc.) [-]HANGUP_WHEN_DONE lowers (- does not lower) the modem control lines (DCD, DTR, etc.) when the connection closes.<br/>NOBREAK Disables automatic clearing of the break setting of the port.<br/>remctl allows remote control of the serial port parameters via RFC 2217.<br/><br/> the README for more info. <banner name> displays the given banner when a user connects to the port.<br/><br/>" .. 
"tr=<filename> When the port is opened, open the given tracefile and store all data read from the physical device (and thus written to the user's TCP port) in the file. The actual filename is specified in the TRACEFILE directive. If the file already exists, it is appended.<br/> The file is closed when the port is closed.<br/><br/>" .. 
"tw=<filename> Like tr, but traces data written to the device.<br/><br/>" ..
"tb=<filename> trace both read and written data to the same file.<br/>Note that this is independent of tr and tw, so you may be tracing read, write, and both to different files.<br/><br/>" .. 
"banner name<br/>" .. 
"A name for the banner; this may be used in the options of a port.<br/><br/>" .. 
"banner text<br/>" .. 
"The text to display as the banner. It takes escape sequences for substituting strings, see 'FILENAME AND BANNER FORMATTING' for details.<br/><br/>" .. 
"tracefile name<br/>" .. 
"A name for the tracefile, this is used in the tw, tr, and tb options of a port.<br/><br/>" .. 
"tracefile<br/>" .. 
"The file to send the trace into. Note that this takes escape sequences for substituting strings, see 'FILENAME AND BANNER FORMATTING' for details.<br/>Note that when using the time escape sequences, the time is read once at port startup, so if you use both tw and tr they will have the same date and time."))

options.rmempty = true
options.default = ""

return m
