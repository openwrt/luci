// luci-proto-openvpn: OpenVPN protocol handler for LuCI
'use strict';
'require form';
'require fs';
'require network';
'require rpc';
'require uci';
'require ui';

const callGenKey = rpc.declare({
	object: 'luci.openvpn',
	method: 'generateKey',
	params: { keytype: 'keytype', ifname: 'ifname', server_key: 'server_key', cl_meta: '' },
});


const callGetSKeys = rpc.declare({
	object: 'luci.openvpn',
	method: 'getSKeys',
	params: [ 'ifname' ],
});


const openvpnOptions = [
	// Basic options (unchanged)
	{ tab: 'general', type: form.Value, name: 'port', placeholder: '1194', label: _('TCP/UDP port # for both local and remote') },
	{ tab: 'general', type: form.Flag, name: 'nobind', label: _('Do not bind to local address and port'), default: 0 },
	// --client Options error: specify only one of --tls-server, --tls-client, or --secret
	// --client also needs DCO(?)
	{ tab: 'general', type: form.Flag, name: 'client', label: _('Configure client mode') + '<br/>' + _('Requires --tls-server, --tls-client, or --secret'), default: 0 },
	{ tab: 'general', type: form.DynamicList, name: 'remote', label: _('Remote host name or IP address'), placeholder: '1.2.3.4', datatype: 'or(hostname,ipaddr)' },
	{ tab: 'general', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'ca', label: _('Certificate authority'), placeholder: '/etc/easy-rsa/keys/ca.crt' },
	{ tab: 'general', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'cert', label: _('Local certificate'), placeholder: '/etc/easy-rsa/keys/some-client.crt' },
	{ tab: 'general', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'key', label: _('Local private key'), placeholder: '/etc/easy-rsa/keys/some-client.key' },
	{ tab: 'general', type: form.Value, name: 'ifconfig', datatype: 'tuple(ipaddr,ipaddr)', placeholder: '10.200.200.3 10.200.200.1', label: _('Set tun/tap adapter parameters') },
	{ tab: 'general', type: form.Value, name: 'ifconfig_ipv6', datatype: 'or(ip6addr,tuple(ip6addr,ip6addr))', placeholder: 'fd15:53b6:dead::2/64 [fd15:53b6:dead::1]', label: _('Set tun/tap adapter parameters') },
	{ tab: 'general', type: form.Value, name: 'server', datatype: 'tuple(ipaddr,ipaddr)', placeholder: '10.200.200.0 255.255.255.0', label: _('Configure server mode') },
	{ tab: 'general', type: form.Value, name: 'server_bridge', datatype: 'tuple(ipaddr,ipaddr,ipaddr,ipaddr)', placeholder: '192.168.1.1 255.255.255.0 192.168.1.128 192.168.1.254', label: _('Configure server bridge') },
	// { tab: 'general', type: form.ListValue, name: 'comp_lzo', values: ['yes','no','adaptive'], label: _('Security recommendation: It is recommended to not enable compression and set this parameter to `no`'), default: 'no' },
	{ tab: 'general', type: form.Value, name: 'keepalive', placeholder: '10 60', label: _('Helper directive to simplify the expression of --ping and --ping-restart in server mode configurations') },
	{ tab: 'general', type: form.Flag, name: 'client_to_client', label: _('Allow client-to-client traffic'), default: 0 },
	// secret requires --cipher *-CBC 
	{ tab: 'basic', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'secret', label: _('Enable Static Key encryption mode (non-TLS)') + '¹' + '<br />' + _('Used with auth and cipher params'), placeholder: '/etc/openvpn/secret.key' },
	{ tab: 'basic', type: form.ListValue, name: 'key_direction', values: [0,1], label: _('The key direction for \'tls-auth\' and \'secret\' options'), default: 0 },
	{ tab: 'basic', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'pkcs12', label: _('PKCS#12 file containing keys') + '²', placeholder: '/etc/easy-rsa/keys/some-client.pk12' },
	{ tab: 'basic', type: form.Value, name: 'peer_fingerprint', label: _('The peer key fingerprint'), placeholder: 'AD:B0:95:D8:09:...'},

	// Devices
	{ tab: 'devices', type: form.Value, name: 'dev', placeholder: 'tun0', label: _('tun/tap device') },
	// tun == L3 IPv4/6 tap == L2 Ethernet 802.3
	{ tab: 'devices', type: form.Value, name: 'dev_type', values: ['tun','tap'], label: _('Type of used device'), default: 'tun' },
	{ tab: 'devices', type: form.Value, name: 'dev_node', label: _('Use tun/tap device node'), placeholder: '/dev/net/tun' },
	{ tab: 'devices', type: form.Flag, name: 'vlan_tagging', label: _('Use VLAN tagging'), default: 0 },
	{ tab: 'devices', type: form.ListValue, values: ['all', 'tagged', 'untagged'], name: 'vlan_accept', label: _('Accept VLANs') },
	{ tab: 'devices', type: form.Value, datatype: 'and(uinteger,min(1),max(4094))', name: 'vlan_pvid', label: _('Use these PVIDs') },

	// Service (init/daemon)
	{ tab: 'service', type: form.Flag, name: 'mlock', label: _('Disable Paging'), default: 0 },
	{ tab: 'service', type: form.Flag, name: 'disable_occ', label: _('Disable options consistency check'), default: 0 },
	{ tab: 'service', type: form.DirectoryPicker, name: 'cd', root_directory: '/etc/openvpn', label: _('Change to directory before initialization'), placeholder: '/etc/openvpn' },
	{ tab: 'service', type: form.DirectoryPicker, name: 'chroot', root_directory: '/var/run', label: _('Chroot to directory after initialization'), placeholder: '/var/run' },
	{ tab: 'service', type: form.Flag, name: 'passtos', label: _('TOS passthrough (applies to IPv4 only)'), default: 0 },
	{ tab: 'service', type: form.Value, name: 'nice', datatype: 'and(integer,min(-20),max(19))', label: _('Change process priority'), placeholder: 0 },
	{ tab: 'service', type: form.Flag, name: 'fast_io', label: _('Optimize TUN/TAP/UDP writes'), default: 0 },
	{ tab: 'service', type: form.ListValue, name: 'remap_usr1', lvalues: ['SIGHUP','SIGTERM'], label: _('Remap SIGUSR1 signals') },
	// { tab: 'service', type: form.Value, name: 'status', placeholder: '/var/run/openvpn.status 5', label: _('Write status to file every n seconds'), placeholder: '/var/run/openvpn.status 5' },
	{ tab: 'service', type: form.ListValue, name: 'status_version', values: [1,2], label: _('Status file format version'), default: 2 },
	// { tab: 'service', type: form.ListValue, name: 'compress', values: ['frames_only','lzo','lz4','stub-v2'], label: _('Security recommendation: It is recommended to not enable compression and set this parameter to `stub-v2`'), default: 'stub-v2' },

	// Scripts
	{ tab: 'scripts', type: form.ListValue, name: 'script_security', values: [_('0: Deny'), _('1: OS utils'), _('2: User scripts'), _('3: Allow passwords in env')], label: _('Policy level over usage of external programs and scripts'), default: 1 },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'up', placeholder: '/usr/bin/ovpn-up', label: _('Shell cmd to execute after tun device open') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'up_delay', placeholder: '5', label: _('Delay tun/tap open and up script execution') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'down', placeholder: '/usr/bin/ovpn-down', label: _('Shell cmd to run after tun device close') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Flag, name: 'down_pre', label: _('Call down cmd/script before TUN/TAP close'), default: 0 },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Flag, name: 'up_restart', label: _('Run up/down scripts for all restarts'), default: 0 },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'route_pre_up', placeholder: '/usr/bin/ovpn-routepreup', label: _('Execute shell cmd before routes are added') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'route_up', placeholder: '/usr/bin/ovpn-routeup', label: _('Execute shell cmd after routes are added') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'ipchange', placeholder: '/usr/bin/ovpn-ipchange', label: _('Execute shell command on remote IP change') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.DynamicList, name: 'setenv', label: _('Pass environment variables to script'), placeholder: _('name value') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.DynamicList, name: 'setenv_safe', label: _('Pass environment variables to script prepended with OPENVPN_'), placeholder: _('name value') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'tls_verify', placeholder: '/usr/bin/ovpn-tlsverify', label: _('Shell command to verify X509 name') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'client_connect', placeholder: '/usr/bin/ovpn-clientconnect', label: _('Run script cmd on client connection') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'client_crresponse', placeholder: '/usr/bin/ovpn-clientcrresponse', label: _('Run script cmd to validate client certificates') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'client_disconnect', placeholder: '/usr/bin/ovpn-clientdisconnect', label: _('Run script cmd on client disconnection') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'tls_crypt_v2_verify', placeholder: '/usr/bin/ovpn-tlscryp2v2verify', label: _('Run script cmd for client TLS verification') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'learn_address', placeholder: '/usr/bin/ovpn-learnaddress', label: _('Executed in server mode whenever an IPv4 address/route or MAC address is added to OpenVPN\'s internal routing table') },
	{ tab: 'scripts', depends: { script_security: /[1-3]/ }, type: form.Value, name: 'auth_user_pass_verify', placeholder: '/usr/bin/ovpn-userpass via-env', label: _('Executed in server mode on new client connections, when the client is still untrusted') },

	// Logging
	{ tab: 'logging', type: form.Value, name: 'echo', label: _('Echo parameters to log'), placeholder: _('some params echoed to log'),  },
	{ tab: 'logging', type: form.Value, name: 'log', label: _('Write log to file'), placeholder: '/var/log/openvpn.log' },
	{ tab: 'logging', type: form.Value, name: 'log_append', label: _('Append log to file'), placeholder: '/var/log/openvpn.log' },
	// { tab: 'logging', type: form.Value, name: 'syslog', placeholder: 'openvpn', label: _('Syslog tag') },
	{ tab: 'logging', type: form.Value, name: 'mute', label: _('Limit repeated log messages'), placeholder: 5 },
	{ tab: 'logging', type: form.Flag, name: 'suppress_timestamps', label: _('Don\'t log timestamps'), default: 0 },
	{ tab: 'logging', type: form.Value, name: 'verb', datatype: 'and(uinteger,min(0),max(11))', label: _('Set output verbosity'), placeholder: '0-11' },

	// Networking (socket, device, routing)
	{ tab: 'networking', type: form.ListValue, name: 'mode', lvalues: ['p2p','server'], label: _('Major mode') },
	{ tab: 'networking', type: form.Value, name: 'local', datatype: 'or(hostname,ipaddr)', label: _('Local host name or IP address'), placeholder: '0.0.0.0' },
	{ tab: 'networking', type: form.Value, name: 'port', datatype: 'port', label: _('TCP/UDP port # for both local and remote'), placeholder: 1194 },
	{ tab: 'networking', type: form.Value, name: 'lport', datatype: 'port', label: _('TCP/UDP port # for local'), placeholder: 1194 },
	{ tab: 'networking', type: form.Value, name: 'rport', datatype: 'port', label: _('TCP/UDP port # for remote'), placeholder: 1194 },
	// name: 'proto' collides with netifd 'proto' -> map to ovpnproto
	{ tab: 'networking', type: form.Value, name: 'ovpnproto', lvalues: ['udp','tcp-client','tcp-server'], label: _('Use protocol'), placeholder: 'udp' },
	{ tab: 'networking', type: form.Flag, name: 'float', label: _('Allow remote to change its IP or port'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'nobind', label: _('Do not bind to local address and port'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'multihome', label: _('When you have more than one IP address (e.g. multiple interfaces, or secondary IP addresses), and do not use --local to force binding to one specific address only'), default: 0 },
	// { tab: 'networking', type: form.Value, name: 'ifconfig', label: _('Set tun/tap adapter parameters'), placeholder: '10.200.200.3 10.200.200.1' },
	{ tab: 'networking', type: form.Flag, name: 'ifconfig_noexec', label: _('Don\'t actually execute ifconfig'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'ifconfig_nowarn', label: _('Don\'t warn on ifconfig inconsistencies'), default: 0 },
	{ tab: 'networking', type: form.DynamicList, name: 'route', label: _('Add route after establishing connection'), placeholder: '10.123.0.0 255.255.0.0' },
	{ tab: 'networking', type: form.Value, name: 'route_gateway', datatype: 'ipaddr', label: _('Specify a placeholder gateway for routes'), placeholder: '10.234.1.1' },
	{ tab: 'networking', type: form.Value, name: 'route_delay', datatype: 'uinteger', label: _('Delay n seconds after connection'), placeholder: 0 },
	{ tab: 'networking', type: form.Flag, name: 'route_noexec', label: _('Don\'t add routes automatically'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'route_nopull', label: _('Don\'t pull routes automatically'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'allow_recursive_routing', label: _('Don\'t drop incoming tun packets with same destination as host'), placeholder: 0 },
	{ tab: 'networking', type: form.ListValue, name: 'mtu_disc', lvalues: ['yes','maybe','no'], label: _('Enable Path MTU discovery'), default: 'no' },
	{ tab: 'networking', type: form.Flag, name: 'mtu_test', label: _('Empirically measure MTU'), default: 0 },
	// { tab: 'networking', type: form.ListValue, name: 'comp_lzo', values: ['yes','no','adaptive'], label: _('Security recommendation: It is recommended to not enable compression and set this parameter to `no`') + '¹', default: 'no' },
	// { tab: 'networking', type: form.Flag, name: 'comp_noadapt', label: _('Don\'t use adaptive lzo compression') + '¹', placeholder: 0 },
	// { tab: 'networking', type: form.Value, name: 'link_mtu', datatype: 'uinteger', label: _('Set TCP/UDP MTU') + '¹', placeholder: 1500 },
	{ tab: 'networking', type: form.Value, name: 'tun_mtu', datatype: 'uinteger', label: _('Set tun/tap device MTU'), placeholder: 1500 },
	{ tab: 'networking', type: form.Value, name: 'tun_mtu_extra', datatype: 'uinteger', label: _('Set tun/tap device overhead'), placeholder: 1500 },
	{ tab: 'networking', type: form.Value, name: 'fragment', datatype: 'uinteger', label: _('Enable internal datagram fragmentation'), placeholder: 1500 },
	{ tab: 'networking', type: form.Value, name: 'mssfix', datatype: 'uinteger', label: _('Set upper bound on TCP MSS'), placeholder: 1450 },
	{ tab: 'networking', type: form.Value, name: 'sndbuf', datatype: 'uinteger', label: _('Set the TCP/UDP send buffer size'), placeholder: 65536 },
	{ tab: 'networking', type: form.Value, name: 'rcvbuf', datatype: 'uinteger', label: _('Set the TCP/UDP receive buffer size'), placeholder: 65536 },
	{ tab: 'networking', type: form.Value, name: 'txqueuelen', datatype: 'uinteger', label: _('Set tun/tap TX queue length'), placeholder: 100 },
	{ tab: 'networking', type: form.Value, name: 'shaper', datatype: 'uinteger', label: _('Shaping for peer bandwidth'), placeholder: 10240 },
	{ tab: 'networking', type: form.Value, name: 'inactive', datatype: 'uinteger', label: _('tun/tap inactivity timeout'), placeholder: 240 },
	{ tab: 'networking', type: form.Value, name: 'keepalive', label: _('Helper directive to simplify the expression of --ping and --ping-restart in server mode configurations'), placeholder: '10 60' },
	{ tab: 'networking', type: form.Value, name: 'ping', datatype: 'uinteger', label: _('Ping remote every n seconds over TCP/UDP port'), placeholder: 30 },
	{ tab: 'networking', type: form.Value, name: 'ping_exit', datatype: 'uinteger', label: _('Remote ping timeout'), placeholder: 120 },
	{ tab: 'networking', type: form.Value, name: 'ping_restart', datatype: 'uinteger', label: _('Restart after remote ping timeout'), placeholder: 60 },
	{ tab: 'networking', type: form.Flag, name: 'ping_timer_rem', label: _('Only process ping timeouts if routes exist'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'persist_tun', label: _('Keep tun/tap device open on restart'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'persist_key', label: _('Don\'t re-read key on restart'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'persist_local_ip', label: _('Keep local IP address on restart'), default: 0 },
	{ tab: 'networking', type: form.Flag, name: 'persist_remote_ip', label: _('Keep remote IP address on restart'), default: 0 },

	// Management
	{ tab: 'management', type: form.Value, name: 'management', label: _('Enable management interface on <em>IP</em> <em>port</em>'), placeholder: '127.0.0.1 31194 /etc/openvpn/mngmt-pwds' },
	{ tab: 'management', type: form.Flag, name: 'management_query_passwords', label: _('Query management channel for private key'), default: 0 },
	{ tab: 'management', type: form.Flag, name: 'management_hold', label: _('Start OpenVPN in a hibernating state'), default: 0 },
	{ tab: 'management', type: form.Value, name: 'management_log_cache', datatype: 'uinteger', label: _('Number of lines for log file history'), placeholder: 100 },
	{ tab: 'management', type: form.Value, name: 'management_external_cert', datatype: 'path', label: _('Management cert'), placeholder: 'certificate-hint' },
	{ tab: 'management', type: form.Value, name: 'management_external_key', datatype: 'path', label: _('Management key'), placeholder: 'nopadding pkcs1' },

	// Topology
	{ tab: 'topology', type: form.ListValue, name: 'topology', values: ['net30','p2p','subnet'], label: _('\'net30\', \'p2p\', or \'subnet\''), default: '' },
	{ tab: 'topology', type: form.Flag, name: 'disable_dco', label: _('Disable Data Channel Offloading (DCO) support'), default: 0 },

	// Crypto
	{ tab: 'cryptography', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'dh', label: _('Diffie-Hellman parameters'), placeholder: '/etc/easy-rsa/keys/dh1024.pem' },
	{ tab: 'cryptography', type: form.DirectoryPicker, root_directory: '/etc', name: 'capath', label: _('CA path') + '²'},
	{ tab: 'cryptography', type: form.FileUpload, root_directory: '/etc', name: 'askpass_file', label: _('Get certificate password from file before we daemonize') },
	{ tab: 'cryptography', type: form.Value, name: 'auth', label: _('HMAC authentication for packets'),
		values: ['SHA1', 'SHA224', 'SHA256', 'SHA384', 'SHA512', 'SHA3-224', 'SHA3-256', 'SHA3-384', 'SHA3-512', 'none'] },
	// --data-ciphers-fallback with cipher 'AES-256-CBC' disables data channel offload.
	// for --secret pre-shared-key mode. Ignored in >= 2.6 (TLS mode).
	{ tab: 'cryptography', type: form.Value, name: 'cipher', label: _('Encryption cipher for packets') + '¹',
		values: ['AES-128-CBC','AES-128-GCM','AES-192-CBC','AES-192-GCM','AES-256-CBC','AES-256-GCM','CHACHA20-POLY1305'] },
	// { tab: 'cryptography', type: form.Value, name: 'keysize', label: _('Size of cipher key'), placeholder: 1024 },
	{ tab: 'cryptography', type: form.Value, name: 'engine', label: _('Enable OpenSSL hardware crypto engines') + '²', values: ['dynamic'] },
	{ tab: 'cryptography', type: form.Value, name: 'ecdh_curve', label: _('Specify the curve to use for ECDH') + '²', values: ['x25519', 'secp521r1', 'secp384r1', 'secp256r1', 'secp256k1'] },
	{ tab: 'cryptography', type: form.Value, name: 'replay_window', label: _('Replay protection sliding window size'), placeholder: '64 15' },
	{ tab: 'cryptography', type: form.Value, name: 'replay_window', label: _('Replay protection sliding window size'), placeholder: '64 15' },
	{ tab: 'cryptography', type: form.Flag, name: 'mute_replay_warnings', label: _('Silence the output of replay warnings'), default: 0 },
	{ tab: 'cryptography', type: form.FileUpload, root_directory: '/var/run/', name: 'replay_persist', label: _('Persist replay-protection state'), placeholder: '/var/run/openvpn-replay-state' },
	{ tab: 'cryptography', type: form.Flag, name: 'tls_server', label: _('Enable TLS and assume server role'), default: 0,  }, // depends: { tls_client: 0}
	{ tab: 'cryptography', type: form.Flag, name: 'tls_client', label: _('Enable TLS and assume client role'), default: 0,  }, // depends: { tls_server: 0}
	// { tab: 'cryptography', type: form.Value, name: 'key_method', label: _('Enable TLS and assume client role') },
	{ tab: 'cryptography', type: form.DynamicList, name: 'tls_cipher', label: _('TLS cipher'), 
		values: [
			'TLS1-3-CHACHA20-POLY1305-SHA256',
			'TLS1-3-AES-256-GCM-SHA384',
			'TLS1-3-AES-128-GCM-SHA256',
			'TLS-ECDHE-ECDSA-WITH-AES-256-GCM-SHA384',
			'TLS-ECDHE-RSA-WITH-AES-256-GCM-SHA384',
			'TLS-DHE-RSA-WITH-AES-256-GCM-SHA384',
			'TLS-ECDHE-ECDSA-WITH-CHACHA20-POLY1305-SHA256',
			'TLS-ECDHE-RSA-WITH-CHACHA20-POLY1305-SHA256',
			'TLS-DHE-RSA-WITH-CHACHA20-POLY1305-SHA256',
			'TLS-ECDHE-ECDSA-WITH-AES-128-GCM-SHA256',
			'TLS-ECDHE-RSA-WITH-AES-128-GCM-SHA256',
			'TLS-DHE-RSA-WITH-AES-128-GCM-SHA256',
			'TLS-ECDHE-ECDSA-WITH-AES-256-CBC-SHA384',
			'TLS-ECDHE-RSA-WITH-AES-256-CBC-SHA384',
			'TLS-DHE-RSA-WITH-AES-256-CBC-SHA256',
			'TLS-ECDHE-ECDSA-WITH-AES-128-CBC-SHA256',
			'TLS-ECDHE-RSA-WITH-AES-128-CBC-SHA256',
			'TLS-DHE-RSA-WITH-AES-128-CBC-SHA256',
			'TLS-ECDHE-ECDSA-WITH-AES-256-CBC-SHA',
			'TLS-ECDHE-RSA-WITH-AES-256-CBC-SHA',
			'TLS-DHE-RSA-WITH-AES-256-CBC-SHA',
			'TLS-ECDHE-ECDSA-WITH-AES-128-CBC-SHA',
			'TLS-ECDHE-RSA-WITH-AES-128-CBC-SHA',
			'TLS-DHE-RSA-WITH-AES-128-CBC-SHA',
			'TLS-ECDHE-PSK-WITH-CHACHA20-POLY1305-SHA256',
			'TLS-ECDHE-PSK-WITH-AES-256-CBC-SHA384',
			'TLS-ECDHE-PSK-WITH-AES-256-CBC-SHA',
			'TLS-ECDHE-PSK-WITH-AES-128-CBC-SHA256',
			'TLS-ECDHE-PSK-WITH-AES-128-CBC-SHA',
			'TLS-PSK-WITH-CHACHA20-POLY1305-SHA256',
			'TLS-PSK-WITH-AES-256-GCM-SHA384',
			'TLS-PSK-WITH-AES-256-CBC-SHA384',
			'TLS-PSK-WITH-AES-256-CBC-SHA',
			'TLS-PSK-WITH-AES-128-GCM-SHA256',
			'TLS-PSK-WITH-AES-128-CBC-SHA256',
			'TLS-PSK-WITH-AES-128-CBC-SHA',
		]},
	{ tab: 'cryptography', type: form.DynamicList, name: 'tls_ciphersuites', label: _('TLS 1.3 or newer cipher'),
		values: ['TLS_AES_256_GCM_SHA384','TLS_AES_128_GCM_SHA256','TLS_CHACHA20_POLY1305_SHA256'] },
	{ tab: 'cryptography', type: form.Value, name: 'tls_timeout', datatype: 'uinteger', label: _('Retransmit timeout on TLS control channel'), placeholder: 2 },
	{ tab: 'cryptography', type: form.Value, name: 'reneg_bytes', datatype: 'uinteger', label: _('Renegotiate data chan. key after bytes'), placeholder: 1024 },
	{ tab: 'cryptography', type: form.Value, name: 'reneg_pkts', datatype: 'uinteger', label: _('Renegotiate data chan. key after packets'), placeholder: 100 },
	{ tab: 'cryptography', type: form.Value, name: 'reneg_sec', datatype: 'uinteger', label: _('Renegotiate data chan. key after seconds'), placeholder: 3600 },
	{ tab: 'cryptography', type: form.Value, name: 'hand_window', datatype: 'uinteger', label: _('Timeframe for key exchange'), placeholder: 60 },
	{ tab: 'cryptography', type: form.Value, name: 'tran_window', datatype: 'uinteger', label: _('Key transition window'), placeholder: 3600 },
	{ tab: 'cryptography', type: form.Flag, name: 'single_session', datatype: 'uinteger', label: _('Allow only one session'), default: 0 },
	{ tab: 'cryptography', type: form.Flag, name: 'tls_exit', datatype: 'uinteger', label: _('Exit on TLS negotiation failure'), default: 0 },
	{ tab: 'cryptography', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'tls_auth', label: _('Additional authentication over TLS'), placeholder: '/etc/openvpn/tlsauth.key' },
	{ tab: 'cryptography', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'tls_crypt', label: _('Encrypt and authenticate all control channel packets with the key'), placeholder: '/etc/openvpn/tlscrypt.key' },
	{ tab: 'cryptography', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'tls_crypt_v2', label: _('Encrypt and authenticate all control channel packets with the key, version 2.'), placeholder: '/etc/openvpn/servertlscryptv2.key' },
	{ tab: 'cryptography', type: form.Flag, name: 'auth_nocache', label: _('Don\'t cache --askpass or --auth-user-pass passwords'), default: 0 },
	// { tab: 'cryptography', type: form.Value, name: 'tls_remote', label: _('Only accept connections from given X509 name'), placeholder: 'remote_x509_name' },
	{ tab: 'cryptography', type: form.ListValue, name: 'ns_cert_type', values: ['client','server'], label: _('Require explicit designation on certificate') },
	{ tab: 'cryptography', type: form.Value, name: 'remote_cert_eku', label: _('Require remote cert extended key usage on certificate'), placeholder: 'oid' },
	{ tab: 'cryptography', type: form.Value, name: 'remote_cert_ku', label: _('Require explicit key usage on certificate'), placeholder: 'a0' },
	{ tab: 'cryptography', type: form.ListValue, name: 'remote_cert_tls', values: ['client','server'], label: _('Require explicit key usage on certificate') },
	{ tab: 'cryptography', type: form.FileUpload, root_directory: '/etc/openvpn', name: 'crl_verify', label: _('Check peer certificate against a CRL'), placeholder: '/etc/easy-rsa/keys/crl.pem' },
	{ tab: 'cryptography', type: form.Value, name: 'tls_version_min', label: _('The lowest supported TLS version'), values: ['1.2', '1.3'] },
	{ tab: 'cryptography', type: form.Value, name: 'tls_version_max', label: _('The highest supported TLS version'), values: ['1.2', '1.3'] },
	{ tab: 'cryptography', type: form.Value, name: 'tls_cert_profile', label: _('TLS cet profile'), values: ['insecure', 'legacy', 'preferred', 'suiteb'] },
	// { tab: 'cryptography', type: form.Flag, name: 'ncp_disable', label: _('This completely disables cipher negotiation'), default: 0 },
	// { tab: 'cryptography', type: form.DynamicList, name: 'ncp_ciphers', label: _('Restrict the allowed ciphers to be negotiated'), values: ['AES-256-GCM','AES-128-GCM'] },
	{ tab: 'cryptography', type: form.DynamicList, name: 'data_ciphers', label: _('Restrict the allowed ciphers to be negotiated'),
		values: ['CHACHA20-POLY1305','AES-256-GCM','AES-128-GCM','AES-256-CBC'] },

	// Push/Client
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.DynamicList, name: 'push', label: _('Push options to peer'), values: ['redirect-gateway'] }, // values: ['comp-lzo']
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'push_reset', label: _('Don\'t inherit global push options'), default: 0 },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'disable', label: _('Client is disabled'), default: 0 },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'ifconfig_pool', label: _('Set aside a pool of subnets') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'ifconfig_pool_persist', label: _('Persist/unpersist ifconfig-pool') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'ifconfig_push', label: _('Push an ifconfig option to remote') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'iroute', label: _('Route subnet to client') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'iroute_ipv6', label: _('Route v6 subnet to client') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'duplicate_cn', label: _('Allow multiple clients with same certificate'), default: 0 },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.DirectoryPicker, root_directory: '/etc/openvpn', directory_create: true, name: 'client_config_dir', label: _('Directory for custom client config files') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'ccd_exclusive', label: _('Refuse connection if no custom client config'), default: 0 },
	// { tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.DirectoryPicker, root_directory: '/var/run', directory_create: true, name: 'tmp_dir', label: _('Temporary directory for client-connect return file') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'hash_size', label: _('Set size of real and virtual address hash tables') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'bcast_buffers', label: _('Number of allocated broadcast buffers') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'tcp_queue_limit', label: _('Maximum number of queued TCP output packets') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'max_clients', label: _('Allowed maximum of connected clients') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'max_routes_per_client', label: _('Allowed maximum of internal') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'connect_freq', label: _('Allowed maximum of new connections') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'username_as_common_name', label: _('Use username as common name'), default: 0 },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'pull', label: _('Accept options pushed from server'), default: 0 },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'auth_user_pass', label: _('Authenticate using username/password') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'auth_retry', label: _('Handling of authentication failures') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'explicit_exit_notify', label: _('Send notification to peer on disconnect') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'remote_random', label: _('Randomly choose remote server'), default: 0 },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'connect_retry', label: _('Connection retry interval') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'http_proxy', label: _('Connect to remote host through an HTTP proxy') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Flag, name: 'http_proxy_retry', label: _('Retry indefinitely on HTTP proxy errors'), default: 0 },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'http_proxy_timeout', label: _('Proxy timeout in seconds') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.DynamicList, name: 'http_proxy_option', label: _('Set extended HTTP proxy options') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'socks_proxy', label: _('Connect through Socks5 proxy') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'socks_proxy_retry', label: _('Retry indefinitely on Socks proxy errors') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'resolv_retry', label: _('If hostname resolve fails, retry') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'redirect_gateway', label: _('Automatically redirect default route') },
	{ tab: 'push_opt', depends: { server: "", "!reverse": true }, type: form.Value, name: 'verify_client_cert', label: _('Specify whether the client is required to supply a valid certificate') },

];

// Tabs for UI
var tabs = [
	{ id: 'basic', label: _('Basic Settings') },
	{ id: 'file', label: _('Config File') },
	{ id: 'general' },
	{ id: 'cryptography', label: _('Cryptography') },
	{ id: 'devices', label: _('Devices') },
	{ id: 'expert', label: _('Expert Settings') },
	{ id: 'keygen', label: _('Keygen') },
	{ id: 'logging', label: _('Logging') },
	{ id: 'management', label: _('Management') },
	{ id: 'networking', label: _('Networking') },
	{ id: 'push_opt', label: _('Push') },
	{ id: 'scripts', label: _('Scripting') },
	{ id: 'service', label: _('Service') },
	{ id: 'topology', label: _('Topology') },
];

function renderOpenVPNOptions(s, tabId) {

	openvpnOptions.filter(function(opt) { return opt.tab === tabId; }).forEach(function(opt) {
		let o = s.taboption(tabId, opt.type, opt.name, opt.name, opt.label);
		if (opt.values) {
			// index based values (o.value(i, string))
			opt.values.forEach((v, i) => o.value(i, v));
		} else if (opt.lvalues) {
			// literal values: the text string is the value
			opt.lvalues.forEach((v) => o.value(v));
		}
		// Copy any extra properties to the widget
		Object.keys(opt).forEach(function(key) {
			if (!['tab', 'type', 'name', 'label', 'values', 'lvalues'].includes(key)) {
				if (key === 'depends')
					o.depends(opt[key])
				else
					o[key] = opt[key];
			}
		});
		o.optional = true;
	});
}

network.registerPatternVirtual(/^openvpn-.+$/);

return network.registerProtocol('openvpn', {
	getI18n: function() {
		return _('OpenVPN');
	},

	getIfname: function() {
		return this._ubus('l3_device') || this.sid;
	},

	getPackageName: function() {
		return 'openvpn-openssl';
	},

	isFloating: function() {
		return true;
	},

	isVirtual: function() {
		return true;
	},

	getDevices: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {

		let o, kt, sk, krp, krc, clm, ovconf;
		// Add main tabs
		tabs.forEach(function(tab) {
			if (!s.tabs[tab.id])
				s.tab(tab.id, tab.label);
		});

		o = s.taboption('general', form.DummyValue, '_dummy');
		o.rawhtml = true;
		o.default = _('Almost nothing here prevents you from selecting invalid configuration options which prevent openvpn from starting. Read the manual.') + '<br/>' + 
			_('Options marked with ¹ are deprecated and will be removed.') /* + '<br/>' +
			_('Options marked with * are server only.') */ + '<br/>' +
			_('Options marked with ² are OpenSSL only.');

		// Render options for each tab
		tabs.forEach(function(tab) {
			renderOpenVPNOptions(s, tab.id);
		});

		kt = s.taboption('keygen', form.ListValue, '_keytype', _('Type'));
		kt.default = 'secret';
		kt.value('secret');
		kt.value('tls-crypt');
		kt.value('tls-auth');
		kt.value('auth-token');
		kt.value('tls-crypt-v2-server');
		kt.value('tls-crypt-v2-client');
		kt.write = function(section_id, value) {};

		sk = s.taboption('keygen', form.Value, '_skey', _('Server key'));
		callGetSKeys(s.map.section).then(keys => {
			if (keys.skeys) {
				for (let key of keys.skeys)
					sk.value(key);
			}
		});

		clm = s.taboption('keygen', form.TextValue, '_cmeta', _('Client metadata'),
			_('Freeform metadata to embed into the client key'));
		clm.depends('_keytype', 'tls-crypt-v2-client');
		clm.default = '';
		clm.placeholder = '{"cn":"alice","exp":1735689600}';
		clm.monospace = true;
		clm.rows = 10;
		clm.wrap = 90;

		o = s.taboption('keygen', form.Button, '_keygen', _('Generate'));
		o.onclick = L.bind(function(ev, sid) {
			const ktype = kt.formvalue(sid);
			const svk = sk.formvalue(sid);
			const clmeta = clm.formvalue(sid);

			callGenKey({ ifname: sid, keytype: ktype, server_key: svk ?? '', cl_meta: btoa(clmeta) }).then(result => {
				const path_output = krp.getUIElement(sid);
				const cont_output = krc.getUIElement(sid);
				path_output.setValue(result.path);
				cont_output.setValue(result.content);
				if (ktype === 'tls-crypt-v2-server') {
					const skv = sk.getUIElement(sid);
					skv.setValue(result.filename);
				}
			});
		}, this);

		krp = s.taboption('keygen', form.TextValue, '_pathresult', _('Path'));
		krp.default = '';
		krp.monospace = true;
		krp.readonly = true;
		krp.readonly = true;
		krp.rows = 2;
		krp.wrap = 90;
		krp.write = function(sid, value) { return; };

		krc = s.taboption('keygen', form.TextValue, '_contentresult');
		krc.default = '';
		krc.monospace = true;
		krc.readonly = true;
		krc.rows = 10;
		krc.wrap = 90;
		krc.write = function(sid, value) { return; };

		o = s.taboption('file', form.Button, '_clear', _('Clear'));
		o.onclick = L.bind(function(ev, sid) {
			const config_name = `/etc/openvpn/${sid}/${sid}_config.cfg`;
			let v = ovconf.getUIElement(sid);
			// remove file, clear field, mark it changed and save
			fs.remove(config_name).catch(() => {}).then(() => {
				try {
					v.setValue('');
					if (v && v.node)
						v.node.dispatchEvent(new Event('change', { bubbles: true }));
				} catch (e) {}
				uci.unset(this.config, sid, 'config');
				if (s && s.map)
					s.map.save(null, true);
			});
		}, this);

		ovconf = s.taboption('file', form.TextValue, 'ovpn_config', _('Raw OVPN config'));
		ovconf.rows = 20;
		ovconf.optional = true;
		ovconf.placeholder = _('Drag and drop an ovpn config file here');

		// Attach drag-and-drop handler for file import
		function attachDragDrop(sid) {

			try {
				// If the map root is not yet available, retry a few times with back-off
				ovconf._attach_attempts = ovconf._attach_attempts || {};
				ovconf._attach_attempts[sid] = (ovconf._attach_attempts[sid] || 0) + 1;
				if (!s || !s.map || !s.map.root) {
					if (ovconf._attach_attempts[sid] < 10) {
						setTimeout(() => attachDragDrop(sid), 1000);
					}
					return;
				}

				const w = ovconf.getUIElement(sid);
				if (!w || !w.node || w._ovpn_drop_attached) {
					if (ovconf._attach_attempts[sid] < 10)
						setTimeout(() => attachDragDrop(sid), 1000);
					return;
				}
				const ta = w.node.firstElementChild;
				if (!ta) {
					return;
				}

				ta.addEventListener('dragover', ev => {
					ev.preventDefault();
					ev.dataTransfer.dropEffect = 'copy';
					ta.classList.add('cbi-dragover');
				});

				ta.addEventListener('dragleave', ev => {
					ev.preventDefault();
					ta.classList.remove('cbi-dragover');
				});

				ta.addEventListener('drop', ev => {
					ev.preventDefault();
					ev.stopPropagation();
					ta.classList.remove('cbi-dragover');

					const files = ev.dataTransfer && (ev.dataTransfer.files || ev.dataTransfer.items);

					let file = files && files[0];
					if (files && files[0] && files[0].kind === 'file' && files[0].getAsFile)
						file = files[0].getAsFile();
					if (!file) {
						// fallback: try plain text data
						const text = ev.dataTransfer && (ev.dataTransfer.getData && (ev.dataTransfer.getData('text') || ev.dataTransfer.getData('text/plain')));

						if (text) {
							w.setValue(text);
							w.node.dispatchEvent(new Event('change', { bubbles: true }));
						}
						return;
					}

					const reader = new FileReader();
					reader.onload = function() {
						const content = reader.result;

						w.setValue(content);
						w.node.dispatchEvent(new Event('change', { bubbles: true }));
					};
					reader.onerror = function(err) {
						console.error('ovpn file read error', err);
					};
					reader.readAsText(file);
				});

				w._ovpn_drop_attached = true;

			} catch (e) { }
		}

		ovconf.cfgvalue = function(sid) {
			attachDragDrop(sid);
			const config_name = `/etc/openvpn/${sid}/${sid}_config.cfg`;
			return fs.read(config_name).then(readresult => {
				attachDragDrop(sid);
				if (readresult == null || readresult === '') {
					uci.unset(this.config, sid, 'config');
					return '';
				}
				uci.set(this.config, sid, 'config', config_name);
				return readresult;
			}).catch(() => {
				attachDragDrop(sid);
				uci.unset(this.config, sid, 'config');
				return '';
			});
		};
		ovconf.write = function(sid, value) {
			const config_name = `/etc/openvpn/${sid}/${sid}_config.cfg`;

			fs.write(config_name, value).catch(() => {});
			uci.set(this.config, sid, 'config', config_name);
			return 
		};
		ovconf.rmempty = true;
	},

	deleteConfiguration: function() {
		uci.sections('network', 'openvpn_%s'.format(this.sid), function(s) {
			uci.remove('network', s['.name']);
		});
	}
});
