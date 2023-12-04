'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

var allSshKeys = {};

return view.extend({
	load: function () {
		return L.resolveDefault(fs.list('/root/.ssh/'), []).then(function (entries) {
			var tasks = [];
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].type === 'file' && entries[i].name.match(/\.pub$/)) {
					tasks.push(Promise.resolve(entries[i].name));
				}
			}
			return Promise.all(tasks);
		});
	},

	render: function (data) {
		var sshKeys = _splitSshKeys(data);
		if (sshKeys.length === 0) {
			ui.addNotification(null, E('p', _('No SSH keys found, <a %s>generate a new one</a>').format('href="./ssh_keys"')), 'warning');
		}

		var m, s, o;

		m = new form.Map('sshtunnel', _('SSH Tunnels'),
			_('This configures <a %s>SSH Tunnels</a>')
				.format('href="https://openwrt.org/docs/guide-user/services/ssh/sshtunnel"')
		);

		s = m.section(form.GridSection, 'server', _('Servers'));
		s.anonymous = false;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.tab('general', _('General Settings'));
		o = s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('general', form.Value, 'hostname', _('Hostname'));
		o.placeholder = 'example.com';
		o.datatype = 'host';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'port', _('Port'));
		o.placeholder = '22';
		o.datatype = 'port';

		o = s.taboption('general', form.Value, 'user', _('User'));
		o.default = 'root';

		o = s.taboption('general', form.ListValue, 'IdentityFile', _('Key file'),
			_('Private key file with authentication identity. ' +
				'See <em>ssh_config IdentityFile</em>')
		);
		o.value('');
		Object.keys(sshKeys).forEach(function (keyName) {
			o.value('/root/.ssh/' + keyName, keyName);
		});
		o.optional = true;


		o = s.taboption('advanced', form.ListValue, 'LogLevel', _('Log level'), 'See <em>ssh_config LogLevel</em>');
		o.value('QUIET', 'QUIET');
		o.value('FATAL', 'FATAL');
		o.value('ERROR', 'ERROR');
		o.value('INFO', 'INFO');
		o.value('VERBOSE', 'VERBOSE');
		o.value('DEBUG', 'DEBUG');
		o.value('DEBUG2', 'DEBUG2');
		o.value('DEBUG3', 'DEBUG3');
		o.default = 'INFO';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'Compression', _('Use compression'),
			_('Compression may be useful on slow connections. ' +
				'See <em>ssh_config Compression</em>')
		);
		o.value('yes', _('Yes'));
		o.value('no', _('No'));
		o.default = 'no';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'retrydelay', _('Retry delay'),
			_('Delay after a connection failure before trying to reconnect.')
		);
		o.placeholder = '10';
		o.default = '10';
		o.datatype = 'uinteger';
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'ServerAliveCountMax', _('Server alive count max'),
			_('The number of server alive messages which may be sent before SSH disconnects from the server. ' +
				'See <em>ssh_config ServerAliveCountMax</em>')
		);
		o.placeholder = '3';
		o.datatype = 'uinteger';
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'ServerAliveInterval', _('Server alive interval'),
			_('Keep-alive interval (seconds). ' +
				'See <em>ssh_config ServerAliveInterval</em>')
		);
		o.optional = true;
		o.default = '60';
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'CheckHostIP', _('Check host IP'),
			_('Check the host IP address in the <code>known_hosts</code> file. ' +
				'This allows ssh to detect whether a host key changed due to DNS spoofing. ' +
				'See <em>ssh_config CheckHostIP</em>')
		);
		o.value('yes', _('Yes'));
		o.value('no', _('No'));
		o.default = 'no';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'StrictHostKeyChecking', _('Strict host key checking'),
			_('Refuse to connect to hosts whose host key has changed. ' +
				'See <em>ssh_config StrictHostKeyChecking</em>'));
		o.value('accept-new', _('Accept new and check if not changed'));
		o.value('yes', _('Yes'));
		o.value('no', _('No'));
		o.default = 'accept-new';
		o.modalonly = true;

		return m.render();
	},
});

function _splitSshKeys(sshFiles) {
	var sshKeys = {};
	for (var i = 0; i < sshFiles.length; i++) {
		var sshPubKeyName = sshFiles[i];
		var sshKeyName = sshPubKeyName.substring(0, sshPubKeyName.length - 4);
		sshKeys[sshKeyName] = '';
	}
	allSshKeys = sshKeys;
	return sshKeys;
}
