--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("fstab", translate("a_s_fstab", "Einhängepunkte"))

mount = m:section(TypedSection, "mount", translate("a_s_fstab_mountpoints", "Einhängepunkte"), translate("a_s_fstab_mountpoints1", [[Einhängepunkte bestimmen, an welcher Stelle des Dateisystems
bestimmte Laufwerke und Speicher zur Verwendung eingebunden werden.]]))
mount.anonymous = true
mount.addremove = true

mount:option(Flag, "enabled", translate("enable", "aktivieren"))
mount:option(Value, "device", translate("device", "Gerät"), translate("a_s_fstab_device1", "Die Gerätedatei des Speichers oder der Partition (z.B.: /dev/sda)"))
mount:option(Value, "target", translate("a_s_fstab_mountpoint", "Einhängepunkt"))
mount:option(Value, "fstype", translate("filesystem", "Dateisystem"), translate("a_s_fstab_fs1", "Das Dateisystem mit dem der Speicher formatiert ist (z.B.: ext3)"))
mount:option(Value, "options", translate("options", "Optionen"), translatef("manpage", "siehe '%s' manpage", "mount"))


swap = m:section(TypedSection, "swap", "SWAP", translate("a_s_fstab_swap1", [[Falls der Arbeitsspeicher des Routers nicht ausreicht,
kann dieser nicht benutzte Daten zeitweise auf einem SWAP-Laufwerk auslagern um so die
effektive Größe des Arbeitsspeichers zu erhöhen. Die Auslagerung der Daten ist natürlich bedeutend langsamer
als direkte Arbeitsspeicherzugriffe.]]))
swap.anonymous = true
swap.addremove = true

swap:option(Flag, "enabled", translate("enable", "aktivieren"))
swap:option(Value, "device", translate("device", "Gerät"), translate("a_s_fstab_device1", "Die Gerätedatei des Speichers oder der Partition (z.B.: /dev/sda)"))

return m
