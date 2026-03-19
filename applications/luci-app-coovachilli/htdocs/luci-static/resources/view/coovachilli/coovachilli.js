'use strict';
'require form';
'require network';
'require rpc';
'require tools.widgets as widgets';

return L.view.extend({

	callNetworkDevices: rpc.declare({
		object: 'luci-rpc',
		method: 'getNetworkDevices',
		expect: { '': {} }
	}),

	addLocalDeviceIPs: function(o, devices) {
		L.sortedKeys(devices, 'name').forEach(function(dev) {
			var ip4addrs = devices[dev].ipaddrs;
			var ip6addrs = devices[dev].ip6addrs;

			// if (!L.isObject(devices[dev].flags) || devices[dev].flags.loopback)
			// 	return;

			if (Array.isArray(ip4addrs)) {
				ip4addrs.forEach(function(addr) {
					if (!L.isObject(addr) || !addr.address)
						return;

					o.value(addr.address, E([], [
						addr.address, ' (', E('strong', {}, [dev]), ')'
					]));
				});
			}

			if (Array.isArray(ip6addrs)) {
				ip6addrs.forEach(function(addr) {
					if (!L.isObject(addr) || !addr.address)
						return;

					o.value(addr.address, E([], [
						addr.address, ' (', E('strong', {}, [dev]), ')'
					]));
				});
			}
		});

		return o;
	},

	load: function() {
		return Promise.all([
			this.callNetworkDevices(),
		]);
	},

	render: function(returned_promises) {
		var m, s, o, to, so, ss;
		var net_devices = returned_promises[0];

		m = new form.Map('coovachilli', _('Coova Chilli'), 
			_('Coova Chilli') + ' ' + _('access controller for WLAN.'));

		s = m.section(form.TypedSection, 'chilli', _('Settings'));
		s.anonymous = true;

		s.tab('general', _('General'));
		s.tab('uam', _('UAM and MAC Authentication'));
		s.tab('network', _('Network Configuration'));
		s.tab('radius', _('RADIUS'));

		// General
		o = s.taboption('general', form.SectionValue, '__gen__', form.TypedSection, 'chilli', null);
		ss = o.subsection;
		ss.anonymous = true;

		so = ss.option(form.Flag, 'disabled', _('Enabled') );
		so.enabled = '0';
		so.disabled = '1';

		// analogue of dhcpif in init script:
		// so = ss.option(form.Value, 'network', _('Network') );
		// so.optional = true;

		ss.option(form.Flag, 'debug', _('Debug') );

		so = ss.option(form.Value, 'interval', _('Re-read interval'), _('Re-read configuration file at this interval') );
		so.placeholder = '3600';

		so = ss.option(form.Value, 'logfacility', _('Syslog facility') );
		so.value('KERN');
		so.value('USER');
		so.value('MAIL');
		so.value('DAEMON');
		so.value('AUTH');
		so.value('LPR');
		so.value('NEWS');
		so.value('UUCP');
		so.value('CRON');
		so.value('LOCAL0');
		so.value('LOCAL1');
		so.value('LOCAL2');
		so.value('LOCAL3');
		so.value('LOCAL4');
		so.value('LOCAL5');
		so.value('LOCAL6');
		so.value('LOCAL7');

		so = ss.option(form.Value, 'statedir', _('State directory') );
		so.optional = true;
		so.placeholder = './';

		// UAM
		o = s.taboption('uam', form.SectionValue, '__uam__', form.TypedSection, 'chilli', null, 
			_('Universal access method'));
		ss = o.subsection;
		ss.anonymous = true;

		so = ss.option(form.Value, 'uamserver', _('Server'), _('URL of web server to use for authenticating clients') );
		so.placeholder = 'https://radius.coova.org/hotspotlogin';

		so = ss.option(form.Value, 'uamsecret', _('Secret') );
		so.password = true;

		ss.option(form.Flag, 'uamanydns', _('Any DNS'), _('Allow unauthenticated users access to any DNS') );
		ss.option(form.Flag, 'nouamsuccess', _('Ignore Success'), _('Do not return to UAM server on login success, just redirect to original URL') );
		ss.option(form.Flag, 'nouamwispr', _('No WISPr'), _('Do not do any WISPr XML, assume the back-end is doing this instead') );
		ss.option(form.Flag, 'nowispr1', _('No WISPr 1 XML'), _('Do not offer WISPr 1.0 XML') );
		ss.option(form.Flag, 'nowispr2', _('No WISPr 2 XML'), _('Do not offer WISPr 2.0 XML') );
		ss.option(form.Flag, 'chillixml', _('Chilli XML'), _('Return the so-called Chilli XML along with WISPr XML.') );
		so = ss.option(form.Flag, 'uamanyip', _('Any IP'), _('Allow client to use any IP Address') );
		so.optional = true;
		so = ss.option(form.Flag, 'dnsparanoia', _('Strict DNS'), _('Inspect DNS packets and drop responses with any non- A, CNAME, SOA, or MX records') );
		so.optional = true;
		so = ss.option(form.Flag, 'usestatusfile', _('Use status file') );
		so.optional = true;

		so = ss.option(form.Value, 'uamhomepage', _('Homepage'), _('URL of homepage to redirect unauthenticated users to') );
		so.optional = true;
		so.placeholder = 'http://192.168.182.1/welcome.html';

		so = ss.option(form.Value, 'uamlisten', _('Listen') );
		so.optional = true;
		so.placeholder = '192.168.182.1';

		so = ss.option(form.Value, 'uamport', _('Port'), _('TCP port to bind to for authenticating clients') );
		so.optional = true;
		so.placeholder = '3990';

		so = ss.option(form.Value, 'uamiport', _('iport'), _('TCP port to bind to for only serving embedded content') );
		so.optional = true;
		so.placeholder = '3990';

		so = ss.option(form.DynamicList, 'uamdomain', _('Domain suffixes') );
		so.optional = true;
		so.placeholder = '.chillispot.org,.coova.org';

		so = ss.option(form.Value, 'uamlogoutip', _('Logout IP') );
		so.optional = true;
		so.placeholder = '192.168.0.1';
		so.datatype = 'ipaddr';

		so = ss.option(form.DynamicList, 'uamallowed', _('Allowed') );
		so.placeholder = 'www.coova.org,10.11.12.0/24,coova.org:80,icmp:coova.org';
		so.optional = true;

		so = ss.option(form.Value, 'wisprlogin', _('WISPr Login'), _('A specific URL to be given in WISPr XML LoginURL') );
		so.optional = true;

		so = ss.option(form.Value, 'defsessiontimeout', _('Default session timeout'), _('0 means unlimited') );
		so.optional = true;
		so.placeholder = '0';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'defidletimeout', _('Default idle timeout'), _('0 means unlimited') );
		so.optional = true;
		so.placeholder = '0';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'definteriminterval', _('Default interim interval'), _('0 means unlimited') );
		so.optional = true;
		so.placeholder = '0';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'defbandwidthmaxdown', _('Max download bandwidth'), _('Default bandwidth max down set in bps, same as WISPr-Bandwidth-Max-Down.') );
		so.optional = true;
		so.placeholder = '1000000000';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'defbandwidthmaxup', _('Max upload bandwidth'), _('Default bandwidth max up set in bps, same as WISPr-Bandwidth-Max-Up.') );
		so.optional = true;
		so.placeholder = '1000000000';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'ssid', _('SSID'), _('passed on to the UAM server in the initial redirect URL') );
		so.optional = true;
		so = ss.option(form.Value, 'vlan', _('VLAN'), _('passed on to the UAM server in the initial redirect URL') );
		so.optional = true;
		so = ss.option(form.Value, 'nasip', _('NAS IP'), _('Unique IP address of the NAS (nas-ip-address)') );
		so.optional = true;
		so.datatype = 'ipaddr';

		so = ss.option(form.Value, 'nasmac', _('NAS MAC'), _('Unique MAC address of the NAS (called-station-id)') );
		so.optional = true;
		so.datatype = 'macaddr';

		so = ss.option(form.Value, 'wwwdir', _('www directory'), _('Directory where embedded local web content is placed') );
		so.optional = true;
		so = ss.option(form.Value, 'wwwbin', _('www binary'), _('Executable to run as a CGI type program') );
		so.optional = true;

		so = ss.option(form.Value, 'uamui', _('UI'), _('Program in inetd style to handle all uam requests') );
		so.optional = true;

		so = ss.option(form.Value, 'localusers', _('Local users') );
		so.optional = true;
		so = ss.option(form.Value, 'postauthproxy', _('Post authentication proxy') );
		so.optional = true;
		so.datatype = 'ipaddr';

		so = ss.option(form.Value, 'postauthproxyport', _('Post authentication proxy') + ' ' + _('port') );
		so.optional = true;
		so.datatype = 'port';

		so = ss.option(form.Value, 'locationname', _('Location Name') );
		so.optional = true;

		/// MAC auth
		o = s.taboption('uam', form.SectionValue, '__macauth__', form.TypedSection, 'chilli', null, 
			_('Special options for MAC authentication'));
		ss = o.subsection;
		ss.anonymous = true;

		so = ss.option(form.Flag, 'macauth', _('MAC authentication'), _('ChilliSpot will try to authenticate all users based on their mac address alone') );
		so = ss.option(form.Flag, 'strictmacauth', _('Strict MAC authentication'), _('Be strict about MAC Auth (no DHCP reply until we get RADIUS reply)') );
		so = ss.option(form.Flag, 'macauthdeny', _('Deny MAC authentication'), _('Deny access (even UAM) to MAC addresses given Access-Reject') );
		so = ss.option(form.Flag, 'macreauth', _('MAC re-authentication'), _('Re-Authenticate based on MAC address for every initial URL redirection') );
		so = ss.option(form.Flag, 'macallowlocal', _('Allow Local MAC') );
		so = ss.option(form.DynamicList, 'macallowed', _('Allowed MACs') );
		so.placeholder = 'AB-CD-EF-AB-CD-EF';
		// TODO: split and join

		so = ss.option(form.Value, 'macpasswd', _('MAC password'), _('Password used when performing MAC authentication') );
		so.optional = true;
		so.password = true;

		so = ss.option(form.Value, 'macsuffix', _('MAC suffix') );
		so.optional = true;
		so.placeholder = 'AB-CD-EF';

		// Network

		/// TUN 
		o = s.taboption('network', form.SectionValue, '__tun__', form.TypedSection, 'chilli', null, 
			_('Options for TUN'));
		ss = o.subsection;
		ss.anonymous = true;

		// Linux only:
		// so = ss.option(form.Flag, 'usetap', _('Use TAP') );
		so = ss.option(form.Flag, 'ipv6', _('Use IPv6') );
		so = ss.option(form.Flag, 'ipv6only', _('Use IPv6') + ' ' + _('only') );
		so = ss.option(form.Value, 'ipv6mode', _('IPv6 mode') );
		so.value('6and4');
		so.value('6to4');
		so.value('4to6');

		so = ss.option(widgets.DeviceSelect, 'tundev', _('TUN device') );
		so.optional = true;

		so = ss.option(form.Value, 'tcpwin', _('TCP Window') );
		so.optional = true;
		so.placeholder = '0';
		so.datatype = 'max(9200)';

		so = ss.option(form.Value, 'tcpmss', _('TCP MSS') );
		so.optional = true;
		so.placeholder = '1280';
		so.datatype = 'max(9200)';

		so = ss.option(form.Value, 'maxclients', _('Max clients') );
		so.optional = true;
		so.placeholder = '512';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'txqlen', _('TX Q length') );
		so.optional = true;

		so = ss.option(form.Value, 'net', _('Net'), _('Network address of the uplink interface') );

		so.placeholder = '192.168.182.0/24';
		so.datatype = 'cidr';

		so = ss.option(form.Value, 'dynip', _('Dynamic IP'), _('Specifies a pool of dynamic IP addresses. If this option is omitted the network address specified by the Net option is used') );
		so.optional = true;
		so.placeholder = '192.168.182.0/24';
		so.datatype = 'cidr';

		so = ss.option(form.Value, 'statip', _('Static IP'), _('Specifies a pool of static IP addresses. With static address allocation the IP address of the client can be specified by the RADIUS server.') );
		so.optional = true;
		so.placeholder = '192.168.182.0/24';

		so = ss.option(form.Value, 'dns1', _('DNS Primary') );
		so.optional = true;
		so.placeholder = '172.16.0.5';
		so.datatype = 'ipaddr';

		so = ss.option(form.Value, 'dns2', _('DNS Auxiliary') );
		so.optional = true;
		so.placeholder = '172.16.0.6';
		so.datatype = 'ipaddr';

		so = ss.option(form.Value, 'domain', _('Domain') );
		so.optional = true;
		so.placeholder = 'key.chillispot.org';
		so.datatype = 'hostname';

		so = ss.option(form.Value, 'ipup', _('IP up script'), _('Executed after the TUN/TAP network interface has been brought up') );
		so.optional = true;
		so.placeholder = '/etc/chilli/up.sh';

		so = ss.option(form.Value, 'ipdown', _('IP down script'), _('Executed after the TUN/TAP network interface has been taken down') );
		so.optional = true;
		so.placeholder = '/etc/chilli/down.sh';

		so = ss.option(form.Value, 'conup', _('Connection up script'), _('Executed after a session is authorized') );
		so.optional = true;
		so.placeholder = '/etc/chilli/connup.sh';

		so = ss.option(form.Value, 'condown', _('Connection down script'), _('Executed after a session has moved from authorized state to unauthorized') );
		so.optional = true;
		so.placeholder = '/etc/chilli/conndown.sh';

		/// DHCP 
		o = s.taboption('network', form.SectionValue, '__tun__', form.TypedSection, 'chilli', null, 
			_('Special options for DHCP'));
		ss = o.subsection;
		ss.anonymous = true;

		so = ss.option(widgets.DeviceSelect, 'dhcpif', _('DHCP interface') );

		// so = ss.option(form.Value, 'dhcpmac', _('DHCP MAC') );
		// so.optional = true;
		// so.placeholder = '00:00:5E:00:02:00';
		// so.datatype = 'macaddr';

		so = ss.option(form.Value, 'lease', _('Lease time'), _('in seconds') );
		so.optional = true;
		so.placeholder = '600';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'dhcpstart', _('DHCP Start') );
		so.optional = true;
		so.placeholder = '10';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'dhcpend', _('DHCP End') );
		so.optional = true;
		so.placeholder = '254';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'dhcpgatewayip', _('DHCP Gateway IP') );
		so.optional = true;
		so.placeholder = '192.168.1.1';
		so.datatype = 'ipaddr';

		so = ss.option(form.Value, 'dhcpgatewayport', _('DHCP Gateway Port') );
		so.optional = true;
		so.placeholder = '67';
		so.datatype = 'port';

		so = ss.option(form.Flag, 'eapolenable', _('Enable EAPOL'), _('IEEE 802.1x authentication') );
		so = ss.option(form.Flag, 'dhcpbroadcast', _('Broadcast Answer'), _('Always respond to DHCP to the broadcast IP, when no relay.') );
		so = ss.option(form.Flag, 'ieee8021q', _('802.1Q'), _('Support for 802.1Q/VLAN network') );
		so = ss.option(form.Flag, 'only8021q', _('802.1Q only'), _('Support 802.1Q VLAN tagged traffic only') );

		// RADIUS

		o = s.taboption('radius', form.SectionValue, '__rad__', form.TypedSection, 'chilli', null, 
			_('RADIUS configuration'));
		ss = o.subsection;
		ss.anonymous = true;

		so = ss.option(form.Value, 'radiuslisten', _('Send IP') );
		so.optional = true;
		so.placeholder = '127.0.0.1';
		this.addLocalDeviceIPs(so, net_devices);

		so = ss.option(form.Value, 'radiusserver1', _('Primary server') );
		so.placeholder = 'rad01.coova.org';
		so.datatype = 'hostname';

		so = ss.option(form.Value, 'radiusserver2', _('Auxiliary server') );
		so.placeholder = 'rad02.coova.org';
		so.datatype = 'hostname';

		so = ss.option(form.Value, 'radiussecret', _('Secret') );
		so.password = true;

		so = ss.option(form.Value, 'radiusauthport', _('Authentication port') );
		so.optional = true;
		so.placeholder = '1812';
		so.datatype = 'port';

		so = ss.option(form.Value, 'radiusacctport', _('Accounting port') );
		so.optional = true;
		so.placeholder = '1813';
		so.datatype = 'port';

		so = ss.option(form.Value, 'radiustimeout', _('Timeout') );
		so.optional = true;
		so.placeholder = '10';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'radiusretry', _('Retries') );
		so.optional = true;
		so.placeholder = '4';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'radiusretrysec', _('Retry seconds') );
		so.optional = true;
		so.placeholder = '2';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'radiusnasid', _('NAS ID'), _('NAS-Identifier') );
		so.optional = true;
		so.placeholder = 'nas01';
		so.datatype = 'string';

		so = ss.option(form.Value, 'radiuslocationid', _('WISPr Location ID') );
		so.optional = true;
		so.placeholder = 'isocc=us,cc=1,ac=408,network=ACMEWISP_NewarkAirport';

		so = ss.option(form.Value, 'radiuslocationname', _('WISPr Location Name') );
		so.optional = true;
		so.placeholder = 'ACMEWISP,Gate_14_Terminal_C_of_Newark_Airport';

		so = ss.option(form.Value, 'radiusnasporttype', _('NAS-Port-Type') );
		so.optional = true;
		so.placeholder = '19';
		so.datatype = 'uinteger';

		so = ss.option(form.Value, 'adminuser', _('Admin user') );
		so.optional = true;
		so = ss.option(form.Value, 'adminpassword', _('Admin password') );
		so.optional = true;
		so.password = true;

		ss.option(form.Flag, 'radiusoriginalurl', _('Original URL'), _('Send CoovaChilli-OriginalURL in Access-Request') );
		ss.option(form.Flag, 'swapoctets', _('Swap Octets'), _('Swap the meaning of input and output octets') );
		ss.option(form.Flag, 'openidauth', _('Open ID Auth') );
		ss.option(form.Flag, 'wpaguests', _('WPA guests') );
		ss.option(form.Flag, 'acctupdate', _('Accounting update') );
		ss.option(form.Flag, 'noradallow', _('Allow all, absent RADIUS'), _('Allow all sessions when RADIUS is not available') );

		so = ss.option(form.Value, 'coaport', _('COA Port'), _('UDP port to listen to for accepting RADIUS disconnect requests') );
		so.optional = true;
		so.datatype = 'port';

		ss.option(form.Flag, 'coanoipcheck', _('COA no IP check'), _('Do not check the source IP address of RADIUS disconnect requests') );

		/// RADIUS Proxy
		o = s.taboption('radius', form.SectionValue, '__radprox__', form.TypedSection, 'chilli', null, 
			_('Options for RADIUS proxy'));
		ss = o.subsection;
		ss.anonymous = true;

		so = ss.option(form.Value, 'proxylisten', _('Proxy Listen') );
		so.optional = true;
		this.addLocalDeviceIPs(so, net_devices);
		so.placeholder = '10.0.0.1';
		so.datatype = 'ipaddr';

		so = ss.option(form.Value, 'proxyport', _('Proxy Port'), _('UDP Port to listen to for accepting RADIUS requests') );
		so.optional = true;
		so.placeholder = '1645';
		so.datatype = 'port';

		so = ss.option(form.Value, 'proxyclient', _('Proxy Client'), _('IP address from which RADIUS requests are accepted') );
		so.optional = true;
		so.placeholder = '10.0.0.1/24';
		so.datatype = 'cidr';

		so = ss.option(form.Value, 'proxysecret', _('Proxy Secret') );
		so.optional = true;
		so.password = true;

		///////

		return m.render();
	}
});
