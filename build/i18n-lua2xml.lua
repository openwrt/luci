#!/usr/bin/lua
local util = require "luci.util"

assert(arg[1])

local x = {}
local f = loadfile(arg[1])
setfenv(f, x)
f()

print '<?xml version="1.0" encoding="utf-8"?>'
print ''
print '<i18n:msgs xmlns:i18n="http://luci.freifunk-halle.net/2008/i18n#" xmlns="http://www.w3.org/1999/xhtml">'
print ''

for k, v in util.kspairs(x) do
	print ('<i18n:msg xml:id="%s">%s</i18n:msg>' % {k, v})
end

print ''
print '</i18n:msgs>'

