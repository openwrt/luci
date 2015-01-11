local fs = require "nixio.fs"
local file = "/www/luci-static/index_user.html"

m = Map("freifunk", translate("Edit index page"), translate("You can display additional content on the public index page by inserting valid XHTML in the form below.<br />Headlines should be enclosed between &lt;h2&gt; and &lt;/h2&gt;."))

s = m:section(NamedSection, "community", "public", "")
s.anonymous = true

di = s:option(Flag, "DefaultText", translate("Disable default content"), translate("If selected then the default content element is not shown."))
di.enabled = "disabled"
di.disabled = "enabled"
di.rmempty = false

t = s:option(TextValue, "_text")
t.rmempty = true
t.rows = 20

function t.cfgvalue()
        return fs.readfile(file) or ""
end

function t.write(self, section, value)
        return fs.writefile(file, value)
end

function t.remove(self, section)
        return fs.unlink(file)
end

return m
