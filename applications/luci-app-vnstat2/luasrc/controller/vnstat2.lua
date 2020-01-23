module("luci.controller.vnstat2", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/vnstat") then
		return
	end

	entry({"admin", "status", "vnstat2"}, alias("admin", "status", "vnstat2", "graphs"), _("vnStat Traffic Monitor"), 90)
	entry({"admin", "status", "vnstat2", "graphs"}, template("vnstat2/graphs"), _("Graphs"), 1)
	entry({"admin", "status", "vnstat2", "config"}, view("vnstat2/config"), _("Configuration"), 2)
	entry({"admin", "status", "vnstat2", "graph"}, call("action_graph"), nil, 3)
end

function action_graph()
	local util = require "luci.util"

	local param = luci.http.formvalue

	local iface = param("iface")
	local style = param("style")

	if not iface or not style then
		luci.http.status(404, "Not Found")
		return
	end

	local style_valid = false
	for _, v in ipairs({"s", "t", "5", "h", "d", "m", "y"}) do
		if v == style then
			style_valid = true
			break
		end
	end

	if not style_valid then
		luci.http.status(404, "Not Found")
		return
	end

	luci.http.prepare_content("image/png")

	local cmd = "vnstati -i %s -%s -o -" % {
		util.shellquote(iface),
		util.shellquote(style)
	}

	local image = io.popen(cmd)
	luci.http.write(image:read("*a"))
	image:close()
end
