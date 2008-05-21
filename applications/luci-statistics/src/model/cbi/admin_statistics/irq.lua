--[[

Luci configuration model for statistics - collectd irq plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "IRQ Plugin",
[[Das IRQ-Plugin sammelt Informationen zur Auslastung einzelner Interrupts.
Werden keine Interrupts angegeben, überwacht das Plugin alle vorhanden IRQs im System.
]])

-- collectd_irq config section
s = m:section( NamedSection, "collectd_irq", "luci_statistics", "Pluginkonfiguration" )

-- collectd_irq.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_irq.irqs (Irq)
irqs = s:option( Value, "Irqs", "Überwachte Interrupts", "mehrere mit Leerzeichen trennen" )
irqs.optional = true
irqs:depends( "enable", 1 )

-- collectd_irq.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected", "Alle Interrupts außer ausgewählte überwachen" )
ignoreselected.default  = 0
ignoreselected.optional = "true"
ignoreselected:depends( "enable", 1 )

return m
