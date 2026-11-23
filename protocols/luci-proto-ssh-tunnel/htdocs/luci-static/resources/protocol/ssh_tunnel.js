// SPDX-License-Identifier: Apache-2.0
'use strict';
'require form';
'require network';
'require uci';

return network.registerProtocol('ssh_tunnel', {
	getI18n: function() { return _('SSH Tunnel'); },
	getIfname: function() { return this._ubus('l3_device') || this.sid; },
	getPackageName: function() { return 'network'; },
	isFloating: function() { return false; },
	isVirtual: function() { return true; },
	getDevices: function() { return [ this.getIfname() ]; },
	renderFormOptions: function(s) {
		var o;
		o = s.taboption('general', form.DummyValue, '_project_links', _('Project information'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<a href="https://github.com/SSHVPN-Connect/SshVPN-openwrt" target="_blank" rel="noopener noreferrer">OpenWrt package</a>' +
				'<br /><a href="https://github.com/SSHVPN-Connect/sshvpn-client" target="_blank" rel="noopener noreferrer">SSH VPN client</a>';
		};
		o = s.taboption('general', form.ListValue, 'connection_mode', _('Connection method'));
		o.value('invite', _('Use an invitation code'));
		o.value('manual', _('Enter SSH credentials manually'));
		o.rmempty = false;
		o.forcewrite = true;
		o.cfgvalue = function(section) {
			return uci.get('network', section, 'connection_mode') ||
				(uci.get('network', section, 'invited') === '1' ||
				 uci.get('network', section, 'invitation') ? 'invite' : 'manual');
		};
		o.write = function(section, value) {
			uci.set('network', section, 'connection_mode', value);
			uci.unset('network', section, 'invitation_key');
			if (value === 'manual') {
				uci.unset('network', section, 'invited');
				uci.unset('network', section, 'host_key_file');
			}
		};
		o = s.taboption('general', form.Value, 'invitation', _('Share invitation code'));
		o.depends('connection_mode', 'invite');
		o.password = true;
		o.maxlength = 8192;
		o.placeholder = 'ssh-tunnel-invite-1:…';
		o.description = _('Paste the full line copied from Share. Leave this empty if the invitation is already activated.');
		o.validate = function(section, value) {
			return !value || /^ssh-tunnel-invite-1:[A-Za-z0-9_-]{1,4096}:[A-Za-z0-9_-]{43}$/.test(value.trim()) ||
				_('Paste the complete invitation on one line.');
		};
		o.write = function(section, value) {
			uci.set('network', section, 'invitation', value.trim());
		};
		o = s.taboption('general', form.Value, 'server', _('SSH server'));
		o.depends('connection_mode', 'manual');
		o.retain = true;
		o.rmempty = false;
		o.placeholder = 'vpn.example.com';
		o = s.taboption('general', form.Value, 'port', _('SSH port'));
		o.datatype = 'port';
		o.default = '22';
		o.description = _('Leave port 22 unless your server uses a different SSH port.');
		o = s.taboption('general', form.Value, 'username', _('SSH user'));
		o.depends('connection_mode', 'manual');
		o.retain = true;
		o.rmempty = false;
		o.forcewrite = true;
		o.cfgvalue = function(section) {
			var user = uci.get('network', section, 'username');
			return !user || /^stv_[0-9a-f]{16}$/.test(user) ? 'root' : user;
		};
		o.description = _('Root SSH login is required for automatic server setup.');
		o = s.taboption('general', form.Value, 'identity_file', _('Private key file'));
		o.depends('connection_mode', 'manual');
		o.retain = true;
		o.forcewrite = true;
		o.cfgvalue = function(section) {
			var path = uci.get('network', section, 'identity_file');
			return path === '/etc/ssh-tunnel/keys/' + section + '-ed25519' ? null : path;
		};
		o.placeholder = '/etc/dropbear/id_ed25519';
		o.description = _('The private key must already exist on the router and be readable by root.');
		o = s.taboption('general', form.Value, 'password', _('SSH password'));
		o.depends('connection_mode', 'manual');
		o.password = true;
		o.rmempty = true;
	}
});
