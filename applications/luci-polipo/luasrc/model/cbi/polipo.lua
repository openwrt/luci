--[[
LuCI - Lua Configuration Interface

Copyright 2008 Aleksandar Krsteski <alekrsteski@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("polipo")

-- General section
s = m:section(NamedSection, "general", "polipo")

-- General settings
s:option(Flag, "enabled", translate("enable"))
s:option(Value, "proxyAddress")
s:option(Value, "proxyPort").optional = true
s:option(DynamicList, "allowedClients")
s:option(Flag, "logSyslog")
s:option(Value, "logFacility"):depends("logSyslog", "1")
v = s:option(Value, "logFile")
v:depends("logSyslog", "")
v.rmempty = true
s:option(Value, "chunkHighMark")

-- DNS and proxy settings
s:option(Value, "dnsNameServer").optional = true
s:option(Value, "parentProxy").optional = true
s:option(Value, "parentAuthCredentials").optional = true
l = s:option(ListValue, "dnsQueryIPv6")
l.optional = true
l.default = "happily"
l:value("")
l:value("true")
l:value("reluctantly")
l:value("happily")
l:value("false")
l = s:option(ListValue, "dnsUseGethostbyname")
l.optional = true
l.default = "reluctantly"
l:value("")
l:value("true")
l:value("reluctantly")
l:value("happily")
l:value("false")

-- Dsik cache section
s = m:section(NamedSection, "cache", "polipo")

-- Dsik cache settings
s:option(Value, "diskCacheRoot").rmempty = true
s:option(Flag, "cacheIsShared")
s:option(Value, "diskCacheTruncateSize").optional = true
s:option(Value, "diskCacheTruncateTime").optional = true
s:option(Value, "diskCacheUnlinkTime").optional = true

-- Poor man's multiplexing section
s = m:section(NamedSection, "pmm", "polipo")
s:option(Value, "pmmSize").rmempty = true
s:option(Value, "pmmFirstSize").optional = true

return m
