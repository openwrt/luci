m = Map("spoofer", "Spoofer - " .. translate("Result History"),
    "The spoofer client is part of a " ..
    "<a href='https://spoofer.caida.org/'>system</a> to measure the " ..
    "Internet's resistance to packets with a spoofed (forged) source IP address.")
m.pageaction = false

s = m:section(TypedSection, "result")
s.template = "cbi/tblsection"
s.anonymous = true

SpooferMultiValue = luci.util.class(DummyValue)

function SpooferMultiValue.__init__(self, ...)
    DummyValue.__init__(self, ...)
    self.format = nil
    self.rawhtml = true
    self.template = "spoofer/dvalue"
end

-- Display multiple values on separate lines within a single table cell.
-- (Values must not wrap; if they do, they may not align properly with
-- corresponding MultiValues in other columns.)
function SpooferMultiValue.value(self, section)
    local suffix = {"4", "6"}
    local ipv = {}
    local value = {}
    for i,v in ipairs(suffix) do
	ipv[i] = self.map:get(section, "ipv" .. suffix[i])
	if ipv[i] then
	    value[i] = luci.util.pcdata(
		self.map:get(section, self.option .. suffix[i]) or "")
	    if self.format then value[i] = self:format(value[i]) end
	end
    end
    local rows = ""
    for i,v in ipairs(suffix) do
	if ipv[i] then rows = rows .. value[i] .. "<br />\n" end
    end
    return rows
end

SpooferResultValue = luci.util.class(SpooferMultiValue)

function SpooferResultValue.__init__(self, ...)
    SpooferMultiValue.__init__(self, ...)
end

SpooferResultValue.styles = {
    BLOCKED   = "<span style='color:#008800'>&#x2714;&nbsp;",
    RECEIVED  = "<span style='color:#880000'>&#x2718;&nbsp;",
    REWRITTEN = "<span style='color:#888800'>&#x2718;&nbsp;"
}
function SpooferResultValue.format(self, value)
    if not value or value == "" then return "" end
    value = luci.util.pcdata(value)
    local style = self.styles[string.upper(value)]
    return style and (style .. value .. "</span>") or ("?&nbsp;" .. value)
end

function header(label, desc)
    return "<span title='" .. luci.util.pcdata(desc) .. "'>" .. label .. "</span>"
end

o = s:option(DummyValue, "start", header(os.date("date (%Z)", 0),
    "date and time of prober run"))
o.template = "spoofer/dvalue"
o.rawhtml = true
o.value = function(self, section)
    local text = luci.util.pcdata(os.date("%F %T", self.map:get(section, "start")))
    local vals = self.map:get(section, "message")
    if vals and #vals > 0 then
	local messages = string.gsub(luci.util.pcdata(table.concat(vals, "\n")), " ", "&nbsp;")
	return "<abbr title='" .. messages .. "'>" .. text .. "</abbr>"
    else
	return text
    end
end

o = s:option(SpooferMultiValue, "ipv", header("IPv",
    "Internet Protocol version"))

o = s:option(SpooferMultiValue, "clientip", header("client address",
    "IP address of spoofer client"))

o = s:option(SpooferMultiValue, "ASN", header("ASN",
    "Autonomous System Number"))

o = s:option(SpooferResultValue, "privaddr", header("outbound<br />private",
    "result of client sending packets to server with spoofed private addresses"))

o = s:option(SpooferResultValue, "routable", header("outbound<br />routable",
    "result of client sending packets to server with spoofed routable addresses"))

o = s:option(SpooferResultValue, "inprivaddr", header("inbound<br />private",
    "result of server sending packets to client with spoofed private addresses"))

o = s:option(SpooferResultValue, "ininternal", header("inbound<br />internal",
    "result of server sending packets to client with spoofed internal (same subnet as client) addresses"))

o = s:option(DummyValue, "report", header("report",
    "summary report at website"))
o.template = "spoofer/dvalue"
o.value = function(self, section)
    local url = self.map:get(section, self.option)
    if not url then return nil end
    self.rawhtml = true
    return '<a href="' .. self.map:get(section, "report") .. '">report</a>'
end

o = s:option(DummyValue, "log", header("log",
    "prober log file (technical)"))
o.template = "spoofer/dvalue"
o.value = function(self, section)
    local log = self.map:get(section, self.option)
    if not log or not nixio.fs.access(log, "r") then return nil end
    self.rawhtml = true
    return '<a href="' .. luci.dispatcher.build_url("admin", "services", "spoofer", "log", section) .. '">log</a>'
end

return m
