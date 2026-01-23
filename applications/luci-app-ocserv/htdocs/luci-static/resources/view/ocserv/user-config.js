'use strict';
'require form';
'require fs';
'require tools.widgets as widgets';
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
			L.resolveDefault(fs.read('/proc/net/ipv6_route'), false),
			L.resolveDefault(fs.read('/etc/ocserv/ca.pem'), ''),
			L.uci.load('ocserv')
		]);
	},

	render: function([has_ipv6, ca_content]) {

		const m = new form.Map('ocserv', _('OpenConnect VPN'));


		let s, o;
		s = m.section(form.TypedSection, 'ocserv', 'OpenConnect');
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Settings'));
		s.tab('ca', _('CA certificate'));
		s.tab('template', _('Edit Template'));


		// Enable flag
		o = s.taboption('general', form.Flag, 'enable', _('Enable server'));
		o.rmempty = false;
		o.default = '1';

		// Authentication
		o = s.taboption('general', form.ListValue, 'auth', _('User Authentication'),
			_('The authentication method for the users. The simplest is plain with a single username-password pair. Use PAM modules to authenticate using another server (e.g., LDAP, Radius).'));
		o.rmempty = false;
		o.default = 'plain';
		o.value('plain', 'plain');
		o.value('PAM', 'PAM');

		// Firewall Zone
		o = s.taboption('general', widgets.ZoneSelect, 'zone', _('Firewall Zone'),
			_('The firewall zone that the VPN clients will be set to'));
		o.default = 'lan';
		o.nocreate = true;

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

		// UDP
		o = s.taboption('general', form.Flag, 'udp', _('Enable UDP'),
			_('Enable UDP channel support; this must be enabled unless you know what you are doing'));
		o.default = '1';

		// Cisco compatibility
		o = s.taboption('general', form.Flag, 'cisco_compat', _('AnyConnect client compatibility'),
			_('Enable support for CISCO AnyConnect clients'));
		o.default = '1';

		// IPv4 Address
		o = s.taboption('general', form.Value, 'ipaddr', _('VPN <abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Network-Address'));
		o.datatype = 'ip4addr';
		o.default = '192.168.100.1';

		// IPv4 Netmask
		o = s.taboption('general', form.Value, 'netmask', _('VPN <abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask'));
		o.datatype = 'ip4addr';
		o.default = '255.255.255.0';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');

		// IPv6 Address (if available)
		if (has_ipv6) {
			o = s.taboption('general', form.Value, 'ip6addr', _('VPN <abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Network-Address'),
				_('<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix'));
		}

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

		// DNS servers section
		const dns = m.section(form.TableSection, 'dns', _('DNS servers'),
			_('The DNS servers to be provided to clients; can be either IPv6 or IPv4'));
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

		return m.render();
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
