--[[

Luci configuration model for statistics - collectd csv plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "CSV Plugin",
[[Das CSV-Plugin schreibt in regelmäßigen Abständen die gesammelten Daten als
CSV-Dateien in das angegebene Verzeichnis. Der Speicherbedarf wächst dabei
kontinuierlich!]])

-- collectd_csv config section
s = m:section( NamedSection, "collectd_csv", "luci_statistics", "Pluginkonfiguration" )

-- collectd_csv.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_csv.datadir (DataDir)
datadir = s:option( Value, "DataDir", "Ablageverzeichnis für die CSV-Dateien" )
datadir.default = "127.0.0.1"
datadir:depends( "enable", 1 )

-- collectd_csv.storerates (StoreRates)
storerates = s:option( Flag, "StoreRates", "Werte nicht absolut, sondern als Raten speichern" )
storerates.default = 0
storerates:depends( "enable", 1 )

return m

