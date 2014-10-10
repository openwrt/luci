--[[

Luci configuration model for statistics - collectd splash_leases plugin configuration
(c) 2013 Freifunk Augsburg / Michael Wendland <michael@michiwend.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

m = Map("luci_statistics",
	translate("Splash Leases Plugin Configuration"),
	translate("The splash leases plugin uses libuci to collect statistics about splash leases."))

s = m:section( NamedSection, "collectd_splash_leases", "luci_statistics" )

enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 1

return m

