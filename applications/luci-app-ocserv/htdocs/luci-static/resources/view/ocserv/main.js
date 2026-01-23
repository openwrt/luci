'use strict';
'require form';
'require fs';
'require rpc';

/* OpenConnect VPN JavaScript for LuCI 
   Converted from Lua to JavaScript by @systemcrash
   Copyright 2014 Nikos Mavrogiannopoulos <n.mavrogiannopoulos@gmail.com>
   Licensed to the public under the Apache License 2.0.
*/

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
});

return L.view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read('/proc/net/ipv6_route'), null),
			L.resolveDefault(fs.exec('/usr/bin/certtool', ['--hash', 'sha256', '--key-id', '--infile', '/etc/ocserv/server-cert.pem']).then(res => res.stdout), null),
			L.resolveDefault(fs.read('/etc/ocserv/ca.pem'), ''),
		]);
	},

	render: function([has_ipv6, pki_hash, ca_content]) {
		pki_hash = pki_hash ? 'sha256:' + pki_hash.trim() : '';

		const m = new form.Map('ocserv', _('OpenConnect VPN'));

		const s = m.section(form.TypedSection, 'ocserv', 'OpenConnect');
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Settings'));
		s.tab('ca', _('CA certificate'));
		s.tab('template', _('Edit Template'));

		// Enable flag
		let o = s.taboption('general', form.Flag, 'enable', _('Enable server'));
		o.rmempty = false;
		o.default = '1';

		// Server's Public Key ID (read-only display)
		o = s.taboption('general', form.DummyValue, '_pkid', _("Server's Public Key ID"),
			_("The value to be communicated to the client to verify the server's certificate; this value only depends on the public key"));
		o.cfgvalue = function(section_id) {
			return pki_hash || _('Not available');
		};

		// Authentication
		o = s.taboption('general', form.ListValue, 'auth', _('User Authentication'),
			_('The authentication method for the users. The simplest is plain with a single username-password pair. Use PAM modules to authenticate using another server (e.g., LDAP, Radius).'));
		o.rmempty = false;
		o.default = 'plain';
		o.value('plain', 'plain');
		o.value('PAM', 'PAM');

		// Port
		o = s.taboption('general', form.Value, 'port', _('Port'),
			_('The same UDP and TCP ports will be used'));
		o.datatype = 'port';

		// Max clients
		o = s.taboption('general', form.Value, 'max_clients', _('Max clients'));
		o.datatype = 'uinteger';

		// Max same clients
		o = s.taboption('general', form.Value, 'max_same', _('Max same clients'));
		o.datatype = 'uinteger';

		// DPD
		o = s.taboption('general', form.Value, 'dpd', _('Dead peer detection time (secs)'));
		o.datatype = 'uinteger';

		// Predictable IPs
		o = s.taboption('general', form.Flag, 'predictable_ips', _('Predictable IPs'),
			_('The assigned IPs will be selected deterministically'));
		o.default = '1';

		// Compression
		o = s.taboption('general', form.Flag, 'compression', _('Enable compression'),
			_('Enable compression'));
		o.default = '0';

		// UDP
		o = s.taboption('general', form.Flag, 'udp', _('Enable UDP'),
			_('Enable UDP channel support; this must be enabled unless you know what you are doing'));
		o.default = '1';

		// Cisco compatibility
		o = s.taboption('general', form.Flag, 'cisco_compat', _('AnyConnect client compatibility'),
			_('Enable support for CISCO AnyConnect clients'));
		o.default = '1';

		// Proxy ARP
		o = s.taboption('general', form.Flag, 'proxy_arp', _('Enable proxy arp'),
			_('Provide addresses to clients from a subnet of LAN; if enabled the network below must be a subnet of LAN. Note that the first address of the specified subnet will be reserved by ocserv, so it should not be in use. If you have a network in LAN covering 192.168.1.0/24 use 192.168.1.192/26 to reserve the upper 62 addresses.'));
		o.default = '0';

		// IPv4 Address
		o = s.taboption('general', form.Value, 'ipaddr', _('VPN <abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Network-Address'),
			_('The IPv4 subnet address to provide to clients; this should be some private network different than the LAN addresses unless proxy ARP is enabled. Leave empty to attempt auto-configuration.'));
		o.datatype = 'ip4addr';
		o.default = '192.168.100.1';

		// IPv4 Netmask
		o = s.taboption('general', form.Value, 'netmask', _('VPN <abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask'),
			_('The mask of the subnet above.'));
		o.datatype = 'ip4addr';
		o.default = '255.255.255.0';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');

		// IPv6 Address (if available)
		if (has_ipv6) {
			o = s.taboption('general', form.Value, 'ip6addr', _('VPN <abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Network-Address'),
				_('The IPv6 subnet address to provide to clients; leave empty to attempt auto-configuration.') + '<br />' +
				_('<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix'));
			o.datatype = 'ip6addr';
		}

		// DNS servers section
		const dns = m.section(form.TableSection, 'dns', _('DNS servers'),
			_('The DNS servers to be provided to clients; can be either IPv6 or IPv4. Typically you should include the address of this device'));
		dns.anonymous = true;
		dns.addremove = true;

		o = dns.option(form.Value, 'ip', _('IP Address'));
		o.datatype = 'ipaddr';
		o.rmempty = false;

		// Routes section
		const routes = m.section(form.TableSection, 'routes', _('Routing table'),
			_('The routing table to be provided to clients; you can mix IPv4 and IPv6 routes, the server will send only the appropriate. Leave empty to set a default route'));
		routes.anonymous = true;
		routes.addremove = true;

		o = routes.option(form.Value, 'ip', _('IP Address'));
		o.datatype = 'ipaddr';
		o.rmempty = false;

		o = routes.option(form.Value, 'netmask', _('Netmask (or IPv6-prefix)'));
		o.default = '255.255.255.0';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');

		// Template editor
		o = s.taboption('template', form.TextValue, '_tmpl',
			_('Edit the template that is used for generating the ocserv configuration.'));
		o.rows = 20;
		o.monospace = true;
		o.cfgvalue = function(section_id) {
			return L.resolveDefault(fs.read('/etc/ocserv/ocserv.conf.template'), '');
		};
		o.write = function(section_id, formvalue) {
			return fs.write('/etc/ocserv/ocserv.conf.template', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
		};

		// CA certificate viewer
		o = s.taboption('ca', form.TextValue, '_ca',
			_('View the CA certificate used by this server. You will need to save it as \'ca.pem\' and import it into the clients.'));
		o.rows = 20;
		o.monospace = true;
		o.readonly = true;
		o.cfgvalue = function(section_id) {
			return ca_content;
		};
		o.remove = function() { return false; };
		o.write = function() { return false; };

		return m.render();
	},

	addFooter: function() {
		// Override to add custom behavior after form render
	},

	handleSave: function(ev) {
		return this.super('handleSave', [ev]).then(() => {
			// Reload occtl after save
			return L.resolveDefault(fs.exec('/usr/bin/occtl', ['reload']), null);
		});
	},

	handleSaveApply: function(ev) {
		return this.handleSave(ev).then(() => {
			// Get the enable flag value
			const mapNode = document.querySelector('[data-name="ocserv"]');
			if (!mapNode) return;

			const uci = L.uci;
			return uci.load('ocserv').then(() => {
				const enable = uci.get('ocserv', 'config', 'enable');
				
				if (enable === '0') {
					return Promise.all([
						callRcInit('ocserv', 'stop'),
						callRcInit('ocserv', 'disable')
					]);
				} else {
					return Promise.all([
						callRcInit('ocserv', 'enable'),
						callRcInit('ocserv', 'restart')
					]);
				}
			});
		}).then(() => {
			L.ui.addNotification(null, E('p', _('Configuration has been applied.')), 'info');
		}).catch(function(e) {
			L.ui.addNotification(null, E('p', _('Failed to apply configuration: %s').format(e.message)), 'error');
		});
	}
});
