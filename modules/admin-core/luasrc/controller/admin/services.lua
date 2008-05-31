module("luci.controller.admin.services", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate

	local page  = node("admin", "services")
	page.target = template("admin_services/index")
	page.title  = i18n("services", "Dienste")  
	page.order  = 40
	
	local page  = node("admin", "services", "httpd")
	page.target = cbi("admin_services/httpd")
	page.title  = "Busybox HTTPd"
	page.order  = 10
	
	local page  = node("admin", "services", "dropbear")
	page.target = cbi("admin_services/dropbear")
	page.title  = "Dropbear SSHd"
	page.order  = 20
	
	local page  = node("admin", "services", "dnsmasq")
	page.target = cbi("admin_services/dnsmasq")
	page.title  = "Dnsmasq"
	page.order  = 30
	
	if luci.fs.isfile("/etc/config/olsr") then
		local page  = node("admin", "services", "olsr")
		page.target = cbi("admin_services/olsrd")
		page.title  = "OLSR"
	end
end