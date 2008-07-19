uci_applied = "The following changes have been applied"
uci_reverted = "The following changes have been reverted"

a_i_ui = "User Interface"

c_lucidesc = [[LuCI is a collection of free Lua software including an MVC-Webframework and webinterface for embedded devices.
Luci is licensed under the Apache-License.]]
c_projecthome = "Project Homepage"
c_leaddev = "Lead Development"
c_contributors = "Contributing Developers"
c_thanksto = "Thanks To"

a_i_i_hello = "Hello!"
a_i_i_admin1 = "This is the administration area of LuCI."
a_i_i_admin2 = "LuCI is a free, flexible, and user friendly graphical interface for configuring OpenWRT Kamikaze."
a_i_i_admin3 = "On the following pages you can adjust all important settings of your router."
a_i_i_admin4 = [[Notice: In LuCI changes have to be confirmed by clicking Changes - Apply before being applied.]]
a_i_i_admin5 = [[As we are always want to improve this interface we are looking forward
to your feedback and suggestions.]]
a_i_i_admin6 = "And now have fun with your router!"
a_i_i_team   = "The LuCI Team"

a_i_luci1 = "Here you can customize the settings and the functionality of LuCI."
a_i_ucicommit = "Post-commit actions"
a_i_ucicommit1 = [[These commands will be executed automatically when a given UCI configuration is committed allowing
changes to be applied instantly.]]
a_i_keepflash = "Files to be kept when flashing a new firmware"
a_i_keepflash1 = "When flashing a new firmware with LuCI these files will be added to the new firmware installation."

a_st_i_status1 = [[Here you can find information about the current system status like CPU clock frequency, memory
usage or network interface data.]]
a_st_i_status2 = [[Also kernel or service logfiles can be viewed here to get an overview over their current state.]]

iwscan = "WLAN-Scan"
iwscan1 = "Wifi networks in your local environment"
iwscan_encr = "Encr."
iwscan_link = "Link"
iwscan_signal = "Signal"
iwscan_noise = "Noise"

routes = "Routes"
routes_netmask = "Netmask"
routes_gateway = "Gateway"
routes_metric = "Metric"

a_s_desc = "Here you can configure the basic aspects of your device like its hostname or the timezone."
a_s_packages = "Software"
a_s_changepw = "Admin Password"
a_s_p_ipkg = "IPKG-Configuration"
a_s_sshkeys = "SSH-Keys"
a_s_fstab = "Mount Points"
a_s_flash = "Flash Firmware"

a_s_i_system1 = [[Change settings related to the system itself, its identification,
installed hard- and software, authentication or mount points.]]
a_s_i_system2 = [[These settings define the base of your system.]]
a_s_i_system3 = [[Pay attention as any misconfiguration here may prevent your device from booting
or may lock yourself out of it.]]

a_s_packages_do = "Perform Actions"
a_s_packages_install = "Install"
a_s_packages_installurl = "Download and install package"
a_s_packages_ipkg = "Edit package lists and installation targets"
a_s_packages_name = "Paketname"
a_s_packages_remove = "Remove"
a_s_packages_search = "Find package"
a_s_packages_update = "Package lists updated"
a_s_packages_updatelist = "Update package lists"
a_s_packages_upgrade = "Upgrade installed packages"

a_s_p_ipkg_pkglists = "Package lists"
a_s_p_ipkg_targets = "Installation targets"

a_s_changepw1 = "Change the password of the system administrator (User \"root\")"
a_s_changepw_changed = "Password successfully changed"
a_s_changepw_nomatch = "Error: Passwords do not match"

a_s_sshkeys1 = "Here you can paste public SSH-Keys (one per line) for SSH public-key authentication."

a_s_fstab_mountpoints = "Mount Points"
a_s_fstab_mountpoints1 = "Mount Points define at which point a memory device will be attached to the filesystem"

a_s_fstab_mountpoint = "Mount Point"
a_s_fstab_device1 = "The device file of the memory or partition (e.g. /dev/sda1)"
a_s_fstab_fs1 = "The filesystem that was used to format the memory (e.g. ext3)"
a_s_fstab_swap1 = [[If your physical memory is insufficient unused data can be temporarily swapped
to a swap-device resulting in a higher amount of usable RAM. Be aware that swapping data is a very slow process
as the swap-device cannot be accessed with the high datarates of the RAM.]]

a_s_flash_flashed = "Firmware successfully flashed. Rebooting device..."
a_s_flash_flasherr = "Failed to flash"
a_s_flash_fwimage = "Firmwareimage"
a_s_flash_fwupgrade = "Flash Firmware"
a_s_flash_keepcfg = "Keep configuration files"
a_s_flash_notimplemented = "Sorry, this function is not (yet) available for your platform."
a_s_flash_upgrade1 = "Replaces the installed firmware with a new one. The firmware format is platform-dependent."

a_s_reboot1 = "Reboots the operating system of your device"
a_s_reboot_do = "Perform reboot"
a_s_reboot_running = "Please wait: Device rebooting..."
a_s_reboot_u = "Warning: There are unsaved changes that will be lost while rebooting!"

a_srv_http = "HTTP-Server"
a_srv_ssh = "SSH-Server"

a_srv_services1 = "Services and daemons perform certain tasks on your device."
a_srv_services2 = [[Most of them are network servers, that offer a certain service for your device or network like
shell access, serving webpages like LuCI, doing mesh routing, sending e-mails, ...]]

a_srv_http1 = "A small webserver which can be used to serve LuCI." 
a_srv_http_authrealm = "Authentication Realm"
a_srv_http_authrealm1 = "The realm which will be displayed at the authentication prompt for protected pages."
a_srv_http_config1 = "defaults to /etc/httpd.conf"
a_srv_http_root = "Document root"

a_srv_dropbear1 = "Dropbear offers SSH network shell access and an integrated SCP server"
a_srv_d_pwauth = "Password authentication"
a_srv_d_pwauth1 = "Allow SSH password authentication"

a_w_wifi1 = [[On this pages you find confiugration options for WLAN based wireless networks.]]
a_w_wifi2 = [[You can easily integrate your 802.11a/b/g/n-devices into your physical network and use
the virtual adapter support to build wireless repeaters or offer several networks with one device.]]
a_w_wifi3 = [[There is support for Managed, Client, Ad-Hoc and WDS operating modes as well as
WPA and WPA2 encryption for secure communnication.]] 

a_w_devices1 = "Here you can configure installed wifi devices."
a_w_channel  = "Channel"
a_w_txantenna = "Transmit Antenna"
a_w_rxantenna = "Receive Antenna"
a_w_distance1 = "Distance to furthest station (m)" 
a_w_diversity = "Diversity"
a_w_countrycode = "Country Code"
a_w_connlimit = "Connection Limit"

a_w_networks1 = [[You can run several wifi networks with one device. Be aware that there are certain
hardware and driverspecific restrictions. Normally you can operate 1 Ad-Hoc or up to 3 Master-Mode and 1 Client-Mode
network simultaneously.]]
a_w_netid = "Network Name (ESSID)"
a_w_network1 = "Add the Wifi network to physical network"
a_w_txpwr = "Transmit Power"
a_w_brcmburst = "Broadcom Frameburst"
a_w_athburst = "Atheros Frameburst"
a_w_radiussrv = "Radius-Server"
a_w_radiusport = "Radius-Port"
a_w_apisolation = "AP-Isolation"
a_w_apisolation1 = "Prevents Client to Client communication"
a_w_hideessid = "Hide ESSID"
a_w_ap = "Access Point"
a_w_adhoc = "Ad-Hoc"
a_w_client = "Client"
a_w_wds = "WDS"

dhcp_desc = "Dnsmasq is a combined DHCP-Server and DNS-Forwarder for NAT firewalls"
dhcp_dnsmasq_domainneeded = "Domain required"
dhcp_dnsmasq_domainneeded_desc = "Don't forward DNS-Requests without DNS-Name"
dhcp_dnsmasq_authoritative = "Authoritative"
dhcp_dnsmasq_authoritative_desc = "This is the only DHCP in the local network"
dhcp_dnsmasq_boguspriv = "Filter private"
dhcp_dnsmasq_boguspriv_desc = "Don't forward reverse lookups for local networks"
dhcp_dnsmasq_filterwin2k = "Filter useless"
dhcp_dnsmasq_filterwin2k_desc = "filter useless DNS-queries of Windows-systems"
dhcp_dnsmasq_localisequeries = "Localise queries"
dhcp_dnsmasq_localisequeries_desc = "localises the hostname depending on its subnet"
dhcp_dnsmasq_local = "Local Server"
dhcp_dnsmasq_domain = "Local Domain"
dhcp_dnsmasq_expandhosts = "Expand Hosts"
dhcp_dnsmasq_expandhosts_desc = "adds domain names to hostentries in the resolv file"
dhcp_dnsmasq_nonegcache = "don't cache unknown"
dhcp_dnsmasq_nonegcache_desc = "prevents caching of negative DNS-replies"
dhcp_dnsmasq_readethers = "Use /etc/ethers"
dhcp_dnsmasq_readethers_desc = "Read /etc/ethers to configure the DHCP-Server" 
dhcp_dnsmasq_leasefile = "Leasefile"
dhcp_dnsmasq_leasefile_desc = "file where given DHCP-leases will be stored"
dhcp_dnsmasq_resolvfile = "Resolvfile"
dhcp_dnsmasq_resolvfile_desc = "local DNS file"
dhcp_dnsmasq_nohosts = "Ignore /etc/hosts"
dhcp_dnsmasq_strictorder = "Strict order"
dhcp_dnsmasq_strictorder_desc = "DNS-Server will be queried in the order of the resolvfile"
dhcp_dnsmasq_logqueries = "Log queries"
dhcp_dnsmasq_noresolv = "Ignore resolve file"
dhcp_dnsmasq_dnsforwardmax = "concurrent queries"
dhcp_dnsmasq_port = "DNS-Port"
dhcp_dnsmasq_ednspacket_max = "max. EDNS.0 paket size"
dhcp_dnsmasq_dhcpleasemax = "max. DHCP-Leases"
dhcp_dnsmasq_addnhosts = "additional hostfile"
dhcp_dnsmasq_queryport = "query port"

a_n_switch = "Switch"
a_n_routes = "Routes"

a_network1 = "In this area you find all network-related settings."
a_network2 = "On most routers the network switch can be freely configured and splitted up into several VLANs."
a_network3 = "Interfaces and PPPoE / PPTP-Settings allow a custom organisation of the network and connections to other networks like the internet."
a_network4 = "With DHCP devices in your local network can be automatically configured for network communication."
a_network5 = "Firewall and portforwarding can be used to secure your network while providing services to external networks."

a_n_switch1 = [[The network ports on your router can be combined to several VLANs
in which computers can communicate directly with each other.
VLANs are often used to separate different network segments.
Often there is by default one Uplink port for a connection to the next greater network like the internet
and other ports for a local network.]]
network_switch_desc = [[Ports belonging to a VLAN are separated with spaces.
The port with the highest number (usually 5) is oftern the connection to the internal network interface of the router.
On devices with 5 ports often the one with the lowest number (0) is the predefined Uplink port.]]

a_n_ifaces1 = [[On this page you can configure the network interfaces.
You can bridge several interfaces by ticking the "bridge interfaces" field and enter the names
of several network interfaces separated by spaces.
You can also use VLAN notation INTERFACE.VLANNR (e.g.: eth0.1).]]
a_n_i_bridge = "Bridge interfaces"
a_n_i_bridge1 = "creates a bridge over specified interface(s)"

dhcp_desc = [[With DHCP network members can automatically receive
their network settings (IP-address, netmaske, DNS-server, ...).]]
dhcp_dhcp_leasetime = "Leasetime"
dhcp_dhcp_dynamicdhcp = "Dynamic DHCP"
dhcp_dhcp_ignore = "Ignore interface"
dhcp_dhcp_ignore_desc = "disable DHCP for this interface"
dhcp_dhcp_force = "Force"
dhcp_dhcp_start_desc = "first address (last octet)"
dhcp_dhcp_limit_desc = "number of leased addresses -1"

luci_ethers = "Static Leases"

a_n_ptp = "Point-to-Point Connections"
a_n_ptp1 = [[Point-to-Point connections with PPPoE or PPTP are often used to connect a device
over DSL or similar technologies to an internet access point.]]
network_interface_server = "PPTP-Server"
network_interface_demand = "Automatic Disconnect"
network_interface_demand_desc = "Time after which an unused connection will be closed"
network_interface_keepalive = "Keep-Alive"
network_interface_keepalive_desc = "Reconnect lost connections"

a_n_routes = "Static Routes"
a_n_routes1 = [[With Static Routes you can specify through which
interface and gateway a certain host or network can be reached.]]
a_n_r_target1 = "host-IP or network"
a_n_r_netmask1 = "if target is a network"

m_n_local = "Local Network"
m_n_inet  = "Internet Connection"
m_n_route = "Route"
m_n_brdige = "Bridge"

m_w_ap = "Provide (Access Point)"
m_w_adhoc = "Independent (Ad-Hoc)"
m_w_client = "Join (Client)"
m_w_wds = "Distributed (WDS)"
m_w_clientmode = "Clientmode"

system_system_logsize = "System log buffer size"
system_system_logip = "External system log server"
system_system_conloglevel = "Log output level"
system_system_conloglevel_desc = "Level of log messages on the console"

m_i_processor = "Processor"
m_i_memory = "Memory"
m_i_systemtime = "Local Time"
m_i_uptime = "Uptime"

m_n_d_firstaddress = "First leased address"
m_n_d_numleases = "Number of leased addresses"

routingtable = "Routing table"
wlanscan = "Wifi scan"
