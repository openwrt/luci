module("luci.controller.acme", package.seeall)

function index()
	entry({"admin", "services", "acme"},
		cbi("acme"),
		_("ACME certs"), 50).dependent = false
end
