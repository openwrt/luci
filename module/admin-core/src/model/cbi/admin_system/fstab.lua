m = Map("fstab", "Einhängepunkte")

mount = m:section(TypedSection, "mount", "Einhängepunkte", [[Einhängepunkte bestimmen, an welcher Stelle des Dateisystems
bestimmte Laufwerke und Speicher zur Verwendung eingebunden werden.]])
mount.anonymous = true
mount.addremove = true

mount:option(Flag, "enabled", "aktivieren")
mount:option(Value, "device", "Gerät", "Die Gerätedatei des Speichers oder der Partition (z.B.: /dev/sda)")
mount:option(Value, "target", "Einhängepunkt", "Die Stelle an der der Speicher in das Dateisystem eingehängt wird.")
mount:option(Value, "fstype", "Dateisystem", "Das Dateisystem mit dem der Speicher formatiert ist (z.B.: ext3)")
mount:option(Value, "options", "Optionen", "Weitere Optionen (siehe das Handbuch des Befehls 'mount')")


swap = m:section(TypedSection, "swap", "SWAP", [[Falls der Arbeitsspeicher des Routers nicht ausreicht,
kann dieser nicht benutzte Daten zeitweise auf einem SWAP-Laufwerk auslagern um so die
effektive Größe des Arbeitsspeichers zu erhöhen. Die Auslagerung der Daten ist natürlich bedeutend langsamer
als direkte Arbeitsspeicherzugriffe.]])
swap.anonymous = true
swap.addremove = true

swap:option(Flag, "enabled", "aktivieren")
swap:option(Value, "device", "Gerät", "Die Gerätedatei des Speichers oder der Partition (z.B.: /dev/sda)")

return m
