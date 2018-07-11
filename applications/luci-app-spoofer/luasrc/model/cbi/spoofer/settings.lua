map = Map("spoofer", "Spoofer - " .. translate("Settings"),
    "<p>The spoofer client is part of a system to measure the Internet's " ..
    "resistance to packets with a spoofed (forged) source IP address." ..
    "<p>Scheduled spoofer runs can be disabled/enabled/stopped/started in " ..
    "the <a href='../../system/startup'>system/startup</a> menu.")
s = map:section(NamedSection, "general", "settings", "General settings")
s.anonymous = true

s:option(Flag, "enableIPv4", "Enable IPv4").rmempty = false
s:option(Flag, "enableIPv6", "Enable IPv6").rmempty = false

s:option(Flag, "sharePublic", "Share results publicly", "Allow anonymized test results to be shared publicly").rmempty = false
s:option(Flag, "shareRemedy", "Share results for remediation", "Allow unanonymized test results to be shared for remediation").rmempty = false
s:option(Value, "keepLogs", "Number of log files to keep").datatype = "and(uinteger,min(1))"
s:option(Value, "keepResults", "Number of results to keep").datatype = "and(uinteger,min(1))"
s:option(Flag, "enableTLS", "Enable TLS",
    "Use SSL/TLS to connect to server (recommended unless blocked by your provider)").rmempty = false

-- Show the debug settings only if the section exists in UCI
if map:get("debug") then
    s = map:section(NamedSection, "debug", "settings", "Debug settings")
    s.anonymous = true
    s:option(Flag, "useDevServer", "test mode", "use development test server").rmempty = false
    s:option(Flag, "pretendMode", "pretend mode", "don't send any probe packets").rmempty = false
    s:option(Flag, "standaloneMode", "standalone mode", "run a test without a server").rmempty = false
end

return map

