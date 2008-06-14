--[[

Luci i18n translation file for the statistics application - german
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--


--
-- general translations
--

stat_statistics	    = "Statistiken"
stat_systemplugins  = "Systemplugins"
stat_networkplugins = "Netzwerkplugins"
stat_outputplugins  = "Ausgabeplugins"
stat_showtimespan   = "Zeitspanne zeigen &raquo;"
stat_graphs         = "Diagramme"


--
-- collectd plugin translations
--

stat_collectd  = "Collectd"
stat_cpu       = "Prozessor"
stat_ping      = "Ping"
stat_iptables  = "Firewall"
stat_netlink   = "Netlink"
stat_processes = "Prozesse"
stat_wireless  = "Drahtlos"
stat_tcpconns  = "TCP-Verbindungen"
stat_interface = "Schnittstellen"
stat_df        = "Plattenspeicher"
stat_irq       = "Interrupts"
stat_disk      = "Plattenauslastung"
stat_exec      = "Exec"
stat_rrdtool   = "RRDTool"
stat_network   = "Netzwerk"
stat_csv       = "CSV Ausgabe"
stat_load      = "Systemlast"


--
-- diagram translations
-- Notice: diagram translations have to be in Latin1 encoding because
--         rrdtool can't handle UTF-8 !
--

stat_dg_title_wireless__signal_noise = "%H: Drahtlos - Signal-Noise-Verh�ltnis"
stat_dg_label_wireless__signal_noise = "dBm"
stat_ds_signal_noise = "Noise-Level"
stat_ds_signal_power = "Signalst�rke"

stat_dg_title_wireless__signal_quality = "%H: Drahtlos - Signalqualit�t"
stat_dg_label_wireless__signal_quality = "n"
stat_ds_signal_quality = "Signalqualit�t"

stat_dg_title_ping = "%H: ICMP Antwortzeiten"
stat_dg_label_ping = "ms"
stat_ds_ping = "%di"

stat_dg_title_iptables__ipt_packets = "%H: Firewall - Verarbeitete Pakete"
stat_dg_label_iptables__ipt_packets = "Pakete/s"
stat_ds_ipt_packets = 'Kette "%di"'

stat_dg_title_netlink__if_octets = "%H: Netlink - Transfer auf %pi"
stat_dg_label_netlink__if_octets = "Bytes/s"
stat_ds_if_octets = "Bytes (%ds)"

stat_dg_title_netlink__if_packets = "%H: Netlink - Pakete auf %pi"
stat_dg_label_netlink__if_packets = "Pakete/s"
stat_ds_if_packets = "Verarbeitet (%ds)"
stat_ds_if_dropped = "Verworfen   (%ds)"
stat_ds_if_errors  = "Fehler      (%ds)"

stat_dg_title_netlink__if_multicast = "%H: Netlink - Multicast auf %pi"
stat_dg_label_netlink__if_multicast = "Pakete/s"
stat_ds_if_multicast = "Pakete"

stat_dg_title_netlink__if_collisions = "%H: Netlink - Kollisionen auf %pi"
stat_dg_label_netlink__if_collisions = "Kollisionen/s"
stat_ds_if_collisions = "Kollisionen"

stat_dg_title_netlink__if_tx_errors = "%H: Netlink - Fehler auf %pi"
stat_dg_label_netlink__if_tx_errors = "Fehler/s"
stat_ds_if_tx_errors = "%di"
stat_ds_if_rx_errors = "%di"

stat_dg_title_processes = "%H: Prozesse"
stat_dg_label_processes = "Prozesse/s"
stat_ds_ps_state = "%di"

stat_dg_title_processes__ps_cputime = "%H: Prozess %pi - Verbrauchte CPU Zeit"
stat_dg_label_processes__ps_cputime = "Jiffies"
stat_ds_ps_cputime__syst = "System"
stat_ds_ps_cputime__user = "User"

stat_dg_title_processes__ps_count = "%H: Prozess %pi - Threads und Prozesse"
stat_dg_label_processes__ps_count = "Anzahl"
stat_ds_ps_count__threads   = "Threads"
stat_ds_ps_count__processes = "Prozesse"

stat_dg_title_processes__ps_pagefaults = "%H: Prozess %pi - Speicherzugriffsfehler"
stat_dg_label_processes__ps_pagefaults = "Zugriffsfehler"
stat_ds_ps_pagefaults = "Zugriffsfehler"

stat_dg_title_processes__ps_rss = "%H: Process %pi - Virtueller Speicher"
stat_dg_label_processes__ps_rss = "Bytes"
stat_ds_ps_rss = "virtueller Speicher"

stat_dg_title_cpu = "%H: Auslastung auf Prozessor #%pi"
stat_dg_label_cpu = "%"
stat_ds_cpu       = "%di"

stat_dg_title_interface__if_octets = "%H: Transfer auf %di"
stat_dg_label_interface__if_octets = "Bytes/s"

stat_dg_title_interface__if_packets = "%H: Pakete auf %di"
stat_dg_label_interface__if_packets = "Pakete/s"

stat_dg_title_tcpconns  = "%H: TCP-Verbindungen auf Port %pi"
stat_dg_label_tcpconns  = "Verbindungen/s"
stat_ds_tcp_connections = "%di"

stat_dg_title_df	= "%H: Speicherverbrauch auf %di"
stat_dg_label_df	= "Bytes"
stat_ds_df__free	= "verf�gbar"
stat_ds_df__used	= "belegt   "

stat_dg_title_irq	= "%H: Interrupts"
stat_dg_label_irq	= "Aufrufe/s"
stat_ds_irq		= "IRQ %di"

stat_dg_title_load      = "%H: Systemlast"
stat_dg_label_load      = "Last"
stat_ds_load__shortterm = "1 Minute"
stat_ds_load__midterm   = "5 Minuten"
stat_ds_load__longterm  = "15 Minuten"


--
-- CBI translations
--

lucistatistics			= "Statistiken"

-- general config
lucistatistics_collectd		= "Collectd Einstellungen"
lucistatistics_collectd_desc	= [[
	Collectd ist ein schlankes Dienstprogramm zum Sammeln von Systemdaten aus verschiedenen Quellen mittels diverser Plugins.
	Auf dieser Seite können generelle Einstellungen für den Collectd-Daemon vorgenommen werden.
]]

lucistatistics_collectd_hostname      = "Hostname"
lucistatistics_collectd_basedir       = "Basisverzeichnis"
lucistatistics_collectd_include       = "Verzeichnis für Unterkonfigurationen"
lucistatistics_collectd_plugindir     = "Verzeichnis für Collectd-Plugins"
lucistatistics_collectd_pidfile       = "Pfad zu PID-Datei"
lucistatistics_collectd_typesdb       = "Dataset-Definitionen"
lucistatistics_collectd_interval      = "Daten-Sammelintervall"
lucistatistics_collectd_interval_desc = "Sekunden"
lucistatistics_collectd_readthreads   = "Anzahl paralleler Sammelprozesse"
lucistatistics_collectd_fqdnlookup    = "automatisch vollen Hostnamen herausfinden"

-- cpu plugin
lucistatistics_collectdcpu            = "CPU Plugin Konfiguration"
lucistatistics_collectdcpu_desc       = "Das CPU-Plugin sammelt grundlegende Statistiken über die Prozessorauslastung."
lucistatistics_collectdcpu_enable     = "Plugin aktivieren"

-- csv plugin
lucistatistics_collectdcsv            = "CSV Plugin Konfiguration"
lucistatistics_collectdcsv_desc       = [[
	Das CSV-Plugin speichert die gesammelten Daten im CSV-Format,
	geeignet für die Weiterverarbeitung durch externe Programme.
]]

lucistatistics_collectdcsv_enable     = "Plugin aktivieren"
lucistatistics_collectdcsv_datadir    = "Speicherverzeichnis für die CSV-Dateien"
lucistatistics_collectdcsv_storerates = "Werte nicht absolut sondern als Raten speichern"

-- df plugin
lucistatistics_collectddf                  = "DF Plugin Konfiguration"
lucistatistics_collectddf_desc             = "Das DF-Plugin sammelt Statistiken über den Speicherverbrauch auf verschiedenen Geräten, Mount-Punkten oder Dateisystemtypen."
lucistatistics_collectddf_enable           = "Plugin aktivieren"
lucistatistics_collectddf_devices          = "Geräte überwachen"
lucistatistics_collectddf_devices_desc     = "mehrere mit Leerzeichen trennen"
lucistatistics_collectddf_mountpoints      = "Mount-Punkte überwachen"
lucistatistics_collectddf_mountpoints_desc = "mehrere mit Leerzeichen trennen"
lucistatistics_collectddf_fstypes          = "Datesystemtypen überwachen"
lucistatistics_collectddf_fstypes_desc     = "mehrere mit Leerzeichen trennen"
lucistatistics_collectddf_ignoreselected   = "Alle außer Ausgewählte überwachen"

-- disk plugin
lucistatistics_collectddisk                = "Disk Plugin Konfiguration"
lucistatistics_collectddisk_desc           = "Das Disk-Plugin sammelt detaillierte Statistiken über die Auslastung auf ausgewählten Festplatten und Partitionen."
lucistatistics_collectddisk_enable         = "Plugin aktivieren"
lucistatistics_collectddisk_disks          = "Geräte und Partitionen überwachen"
lucistatistics_collectddisk_disks_desc     = "mehrere mit Leerzeichen trennen"
lucistatistics_collectddisk_ignoreselected = "Alle außer Ausgewählte überwachen"

-- dns plugin
lucistatistics_collectddns                    = "DNS Plugin Konfiguration"
lucistatistics_collectddns_desc               = "Das DNS-Plugin sammelt detaillierte Statistiken über DNS-bezogenen Verkehr auf ausgewählten Schnittstellen."
lucistatistics_collectddns_enable             = "Plugin aktivieren"
lucistatistics_collectddns_interfaces         = "Schnittstellen überwachen"
lucistatistics_collectddns_interfaces_desc    = "mehrere mit Leerzeichen trennen"
lucistatistics_collectddns_ignoresources      = "Quelladressen ignorieren"
lucistatistics_collectddns_ignoresources_desc = "mehrere mit Leerzeichen trennen"

-- email plugin
lucistatistics_collectdemail                    = "E-Mail Plugin Konfiguration"
lucistatistics_collectdemail_desc               = [[
	Das E-Mail Plugin erstellt einen Unix-Socket welcher benutzt werden kann
	um E-Mail-Statistiken an den laufenden Collectd-Daemon zu übermitteln.
	Dieses Plugin ist primär für die Verwendung zusammen mit
	Mail::SpamAssasin::Plugin::Collectd gedacht, kann aber auch anderweitig
	verwendet werden.
]]

lucistatistics_collectdemail_enable           = "Plugin aktivieren"
lucistatistics_collectdemail_socketfile       = "Dateipfad des Unix-Sockets"
lucistatistics_collectdemail_socketgroup      = "Gruppenbesitzer festlegen"
lucistatistics_collectdemail_socketgroup_desc = "Gruppenname"
lucistatistics_collectdemail_socketperms      = "Dateiberechtigungen des Unix-Sockets"
lucistatistics_collectdemail_socketperms_desc = "oktal"
lucistatistics_collectdemail_maxconns         = "Maximale Anzahl erlaubter Verbindungen"

-- exec plugin
lucistatistics_collectdexec                = "Exec Plugin Konfiguration"
lucistatistics_collectdexec_desc           = [[
	Das Exec-Plugin startet externe Kommandos um Werte einzulesen oder um
	Benachrichtigungen auszulösen falls bestimmte Grenzwerte erreicht werden.
]]

lucistatistics_collectdexec_enable         = "Plugin aktivieren"
lucistatistics_collectdexecinput           = "Kommando zum Werte einlesen hinzufügen"
lucistatistics_collectdexecinput_desc      = [[
	Hier können externe Kommandos definiert werden, welche durch Collectd gestartet
	werden um Statistik-Werte einzulesen. Die Werte werden dabei vom STDOUT des 
	aufgerufenen Programmes gelesen.
]]

lucistatistics_collectdexecinput_cmdline   = "Kommandozeile"
lucistatistics_collectdexecinput_cmduser   = "Als Benutzer ausführen"
lucistatistics_collectdexecinput_cmdgroup  = "Als Gruppe ausführen"
lucistatistics_collectdexecnotify          = "Benachrichtigungskommando hinzufügen"
lucistatistics_collectdexecnotify_desc     = [[
	Hier können externe Kommandos definiert werden, welche durch Collectd gestartet
	werden sobald konfigurierte Grenzwerte erreicht werden. Die Werte welche die
	Benachrichtigung ausgelöst haben werden dabei an den STDIN des aufgerufenen
	Programmes übergeben.
]]

lucistatistics_collectdexecnotify_cmdline  = "Kommandozeile"
lucistatistics_collectdexecnotify_cmduser  = "Als Benutzer ausführen"
lucistatistics_collectdexecnotify_cmdgroup = "Als Gruppe ausführen"

-- interface plugin
lucistatistics_collectdinterface                 = "Interface Plugin Konfiguration"
lucistatistics_collectdinterface_desc            = "Das Interface-Plugin sammelt allgemeine Verkehrsstatistiken auf ausgewählten Schnittstellen."
lucistatistics_collectdinterface_enable          = "Plugin aktivieren"
lucistatistics_collectdinterface_interfaces      = "Schnittstellen überwachen"
lucistatistics_collectdinterface_interfaces_desc = "Strg gedrückt halten um mehrere Schnittstellen zu wählen"
lucistatistics_collectdinterface_ignoreselected  = "Alle außer Ausgewählte überwachen"

-- iptables plugin
lucistatistics_collectdiptables			      = "Iptables Plugin Konfiguration"
lucistatistics_collectdiptables_desc                  = [[
	Das Iptables-Plugin überwacht ausgewählte Firewall-Regeln und sammelt Werte über
	die Anzahl der verarbeiteten Pakete und Bytes.
]]

lucistatistics_collectdiptables_enable                = "Plugin aktivieren"

lucistatistics_collectdiptablesmatch                  = "Auswahlregel hinzufügen"
lucistatistics_collectdiptablesmatch_desc             = [[
	Hier werden die Kriterien festgelegt nach welchen die zu überwachenden
	Firewall-Regeln ausgewählt werden.
]]

lucistatistics_collectdiptablesmatch_name             = "Name der Regel"
lucistatistics_collectdiptablesmatch_name_desc        = "max. 16 Buchstaben"
lucistatistics_collectdiptablesmatch_table            = "Tabelle"
lucistatistics_collectdiptablesmatch_chain            = "Kette (Chain)"
lucistatistics_collectdiptablesmatch_target           = "Aktion (Target)"
lucistatistics_collectdiptablesmatch_protocol         = "Netzwerkprotokoll"
lucistatistics_collectdiptablesmatch_source           = "Quell-IP-Bereich"
lucistatistics_collectdiptablesmatch_source_desc      = "CIDR-Notation"
lucistatistics_collectdiptablesmatch_destination      = "Ziel-IP-Bereich"
lucistatistics_collectdiptablesmatch_destination_desc = "CIDR-Notation"
lucistatistics_collectdiptablesmatch_inputif          = "eingehende Schnittstelle"
lucistatistics_collectdiptablesmatch_inputif_desc     = "z.B. br-lan"
lucistatistics_collectdiptablesmatch_outputif         = "ausgehende Schnittstelle"
lucistatistics_collectdiptablesmatch_outputif_desc    = "z.B. br-ff"
lucistatistics_collectdiptablesmatch_options          = "Optionen"
lucistatistics_collectdiptablesmatch_options_desc     = "z.B. reject-with tcp-reset"

-- irq plugin
lucistatistics_collectdirq                = "IRQ Plugin Konfiguration"
lucistatistics_collectdirq_desc           = [[
	Das IRQ-Plugin überwacht die Anzahl der Aufrufe pro Sekunde für jeden ausgewählten Interrupt.
	Wird kein Interrupt ausgewählt überwacht das Plugin alle im System vorhandenen Interrupts.
]]

lucistatistics_collectdirq_enable         = "Plugin aktivieren"
lucistatistics_collectdirq_irqs           = "Interrups überwachen"
lucistatistics_collectdirq_irqs_desc      = "mehrere mit Leerzeichen trennen"
lucistatistics_collectdirq_ignoreselected = "Alle außer Ausgewählte überwachen"

-- load plugin
lucistatistics_collectdload        = "Load Plugin Konfiguration"
lucistatistics_collectdload_desc   = [[
        Das Load-Plugin sammelt Informationen über die allgemeine Systemlast. 
]]

lucistatistics_collectdload_enable = "Plugin aktivieren"

-- netlink plugin
lucistatistics_collectdnetlink            = "Netlink Plugin Konfiguration"
lucistatistics_collectdnetlink_desc       = [[
	Das Netlink-Plugin sammelt erweiterte QoS-Informationen wie QDisc-, Class- und
	Filter-Statistiken auf ausgewählten Schnittstellen.
]]

lucistatistics_collectdnetlink_enable                 = "Plugin aktivieren"
lucistatistics_collectdnetlink_interfaces             = "Schnittstellen einfach überwachen"
lucistatistics_collectdnetlink_interfaces_desc        = "Strg gedrückt halten um mehrere zu wählen"
lucistatistics_collectdnetlink_verboseinterfaces      = "Schnittstellen detailliert überwachen"
lucistatistics_collectdnetlink_verboseinterfaces_desc = "Strg gedrückt halten um mehrere zu wählen"
lucistatistics_collectdnetlink_qdiscs                 = "Queue Discipline überwachen"
lucistatistics_collectdnetlink_qdiscs_desc            = "Strg gedrückt halten um mehrere zu wählen"
lucistatistics_collectdnetlink_classes                = "Shapingklassen überwachen"
lucistatistics_collectdnetlink_classes_desc           = "Strg gedrückt halten um mehrere zu wählen"
lucistatistics_collectdnetlink_filters                = "Filterklassen überwachen"
lucistatistics_collectdnetlink_filters_desc           = "Strg gedrückt halten um mehrere zu wählen"

-- network plugin
lucistatistics_collectdnetwork            = "Network Plugin Konfiguration"
lucistatistics_collectdnetwork_desc       = [[
	Das Network-Plugin ermöglicht die netzwerkgestützte Kommunikation zwischen
	verschiedenen Collectd-Instanzen. Collectd kann gleichzeitig im Server- und
	Client-Modus betrieben werden.
	Im Client-Modus werden lokal gesammelte Daten an einen Collectd-Server 
	übermittelt, im Server-Modus empfängt die lokale Instanz Daten von anderen
	Installationen.
]]

lucistatistics_collectdnetwork_enable          = "Plugin aktivieren"
lucistatistics_collectdnetworklisten           = "Listen-Schnittstelle"
lucistatistics_collectdnetworklisten_desc      = "Diese Sektion legt fest auf welchen Schnittstellen Collectd auf eingehende Verbindungen wartet."
lucistatistics_collectdnetworklisten_host      = "Listen-Host"
lucistatistics_collectdnetworklisten_host_desc = "Host-, IP- oder IPv6-Adresse"
lucistatistics_collectdnetworklisten_port      = "Listen-Port"
lucistatistics_collectdnetworklisten_port_desc = "0 - 65535"
lucistatistics_collectdnetworkserver           = "Server-Schnittstellen"
lucistatistics_collectdnetworkserver_desc      = "Diese Sektion legt fest zu welchen Collectd-Servern die lokal gesammelten Daten gesendet werden."
lucistatistics_collectdnetworkserver_host      = "Server-Host"
lucistatistics_collectdnetworkserver_host_desc = "Host-, IP- oder IPv6-Adresse"
lucistatistics_collectdnetworkserver_port      = "Server-Port"
lucistatistics_collectdnetworkserver_port_desc = "0 - 65535"
lucistatistics_collectdnetwork_timetolive      = "TTL für Netzwerkpakete"
lucistatistics_collectdnetwork_timetolive_desc = "0 - 255"
lucistatistics_collectdnetwork_forward         = "Weiterleitung zwischen Listen- und Server-Adressen"
lucistatistics_collectdnetwork_cacheflush      = "Cache-Leerungsintervall"
lucistatistics_collectdnetwork_cacheflush_desc = "Sekunden"

-- ping plugin
lucistatistics_collectdping            = "Ping Plugin Konfiguration"
lucistatistics_collectdping_desc       = [[
	Das Ping-Plugin sendet ICMP-Echo-Requests an ausgewählte Hosts und misst die
	Antwortzeiten für jede Adresse.
]]

lucistatistics_collectdping_enable     = "Plugin aktivieren"
lucistatistics_collectdping_hosts      = "Hosts überwachen"
lucistatistics_collectdping_hosts_desc = "mehrere mit Leerzeichen trennen"
lucistatistics_collectdping_ttl        = "TTL für Ping Pakete"
lucistatistics_collectdping_ttl_desc   = "0 - 255"

-- Prozesse plugin
lucistatistics_collectdProzesse                = "Prozesse Plugin Konfiguration"
lucistatistics_collectdProzesse_desc           = [[
	Das Prozess-Plugin sammelt Informationen wie CPU-Zeit, Speicherzugriffsfehler und
	Speicherverbrauch ausgewählter Prozesse.
]]

lucistatistics_collectdProzesse_enable         = "Plugin aktivieren"
lucistatistics_collectdProzesse_processes      = "Prozesse überwachen"
lucistatistics_collectdProzesse_processes_desc = "mehrere mit Leerzeichen trennen"

-- rrdtool plugin
lucistatistics_collectdrrdtool                   = "RRDTool Plugin Konfiguration"
lucistatistics_collectdrrdtool_desc              = [[
	Das RRDTool-Plugin speichert die gesammelten Daten in sogenannten RRD-Datenbanken,
	der Grundlage für die Diagramm-Bilder.<br /><br />
	<strong>Warnung: Falsche Werte resultieren in einem sehr hohen Speicherverbrauch
	im temporären Verzeichnis. Das kann das Gerät unbrauchbar machen, da Systemspeicher
	für den regulären Betrieb fehlt!</strong>
]]

lucistatistics_collectdrrdtool_enable            = "Plugin aktivieren"
lucistatistics_collectdrrdtool_datadir           = "Speicherverzeichnis"
lucistatistics_collectdrrdtool_stepsize          = "RRD Schrittintervall"
lucistatistics_collectdrrdtool_stepsize_desc     = "Sekunden"
lucistatistics_collectdrrdtool_heartbeat         = "RRD Heartbeatintervall"
lucistatistics_collectdrrdtool_heartbeat_desc    = "Sekunden"
lucistatistics_collectdrrdtool_rrasingle         = "Nur 'average' RRAs erzeugen"
lucistatistics_collectdrrdtool_rrasingle_desc    = "reduziert die RRD Größe"
lucistatistics_collectdrrdtool_rratimespans      = "gespeicherte Zeitspannen"
lucistatistics_collectdrrdtool_rratimespans_desc = "mehrere mit Leerzeichen trennen"
lucistatistics_collectdrrdtool_rrarows           = "Spalten pro RRA"
lucistatistics_collectdrrdtool_xff               = "RRD XFiles Faktor"
lucistatistics_collectdrrdtool_cachetimeout      = "Zwischenspeicherzeit für gesammelte Daten"
lucistatistics_collectdrrdtool_cachetimeout_desc = "Sekunden"
lucistatistics_collectdrrdtool_cacheflush        = "Leerungsintervall für Zwischenspeicher"
lucistatistics_collectdrrdtool_cacheflush_desc   = "Sekunden"

-- tcpconns plugin
lucistatistics_collectdtcpconns                  = "TCPConns Plugin Konfiguration"
lucistatistics_collectdtcpconns_desc             = [[
	Das TCPConns-Plugin sammelt Informationen über offene TCP-Verbindungen
	auf ausgewählten Ports.
]]

lucistatistics_collectdtcpconns_enable           = "Plugin aktivieren"
lucistatistics_collectdtcpconns_listeningports   = "Alle durch lokale Dienste genutzten Ports überwachen"
lucistatistics_collectdtcpconns_localports       = "lokale Ports überwachen"
lucistatistics_collectdtcpconns_localports_desc  = "0 - 65535; mehrere mit Leerzeichen trennen"
lucistatistics_collectdtcpconns_remoteports      = "entfernte Ports überwachen"
lucistatistics_collectdtcpconns_remoteports_desc = "0 - 65535; mehrere mit Leerzeichen trennen"

-- unixsock plugin
lucistatistics_collectdunixsock                    = "Unixsock Plugin Konfiguration"
lucistatistics_collectdunixsock_desc               = [[
	Das Unixsock-Plugin erstellt einen Unix-Socket über welchen gesammelte Werte
	aus der laufenden Collectd-Instanz ausgelesen werden können.
]]

lucistatistics_collectdunixsock_enable           = "Plugin aktivieren"
lucistatistics_collectdunixsock_socketfile       = "Dateipfad des Unix-Sockets"
lucistatistics_collectdunixsock_socketgroup      = "Gruppenbesitzer festlegen"
lucistatistics_collectdunixsock_socketgroup_desc = "Gruppenname"
lucistatistics_collectdunixsock_socketperms      = "Dateiberechtigungen des Unix-Sockets"
lucistatistics_collectdunixsock_socketperms_desc = "oktal"

-- wireless plugin
lucistatistics_collectdwireless                    = "Wireless Plugin Konfiguration"
lucistatistics_collectdwireless_desc               = [[
	Das Wireless-Plugin sammelt Statistiken über die drahtlose Signalstärke,
	den Störpegel und die Signalqualität.
]]

lucistatistics_collectdwireless_enable           = "Plugin aktivieren"

