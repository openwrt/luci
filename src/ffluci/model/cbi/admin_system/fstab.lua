m = Map("fstab", "Einhängepunkte")

mount = m:section(TypedSection, "mount", "Einhängepunkte")
mount.anonymous = true
mount.addremove = true

mount:option(Flag, "enabled", "aktivieren")
mount:option(Value, "device", "Gerät")
mount:option(Value, "target", "Einhängepunkt")
mount:option(Value, "fstype", "Dateisystem")
mount:option(Value, "options", "Optionen")


swap = m:section(TypedSection, "swap", "SWAP")
swap.anonymous = true
swap.addremove = true

swap:option(Flag, "enabled", "aktivieren")
swap:option(Value, "device", "Gerät")

return m
