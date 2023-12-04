'use strict';
'require form';
'require fs';
'require ui';
'require view';

var allSshKeys = {};
var hasSshKeygen = false;

return view.extend({
	load: function () {
		return L.resolveDefault(fs.list('/root/.ssh/'), []).then(function (entries) {
			var tasks = [
				L.resolveDefault(fs.stat('/usr/bin/ssh-keygen'), {}),
			];
			// read pub keys
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].type === 'file' && entries[i].name.match(/\.pub$/)) {
					tasks.push(Promise.resolve(entries[i].name));
					tasks.push(fs.lines('/root/.ssh/' + entries[i].name));
				}
			}
			return Promise.all(tasks);
		});
	},

	render: function (data) {
		hasSshKeygen = data[0].type === 'file';
		var sshKeys = _splitSshKeys(data.splice(1));

		var m, s, o;

		m = new form.Map('sshtunnel', _('SSH Tunnels'),
			_('This configures <a %s>SSH Tunnels</a>')
				.format('href="https://openwrt.org/docs/guide-user/services/ssh/sshtunnel"')
		);

		s = m.section(form.GridSection, '_keys');
		s.render = L.bind(_renderSshKeys, this, sshKeys);

		return m.render();
	},
});

function _splitSshKeys(sshFiles) {
	var sshKeys = {};
	for (var i = 0; i < sshFiles.length; i++) {
		var sshPubKeyName = sshFiles[i];
		var sshKeyName = sshPubKeyName.substring(0, sshPubKeyName.length - 4);
		i++;
		var sshPub = sshFiles[i];
		sshKeys[sshKeyName] = '<small><code>' + sshPub + '</code></small>';
	}
	allSshKeys = sshKeys;
	return sshKeys;
}

function _renderSshKeys(sshKeys) {
	var table = E('table', {'class': 'table cbi-section-table', 'id': 'keys_table'}, [
		E('tr', {'class': 'tr table-titles'}, [
			E('th', {'class': 'th'}, _('Name')),
			E('th', {'class': 'th'}, _('Public Key')),
		])
	]);

	var rows = Object.entries(sshKeys);
	cbi_update_table(table, rows, null);

	var keyGenBtn = E('div', {}, [
		E('form', {
			'submit': _handleKeyGenSubmit,
		}, [
			E('label', {}, _('Generate a new key') + ': '),
			E('span', {'class': 'control-group'}, [
				E('input', {
					'type': 'text',
					'name': 'keyName',
					'value': 'id_ed25519',
					'pattern': '^[a-zA-Z][a-zA-Z0-9_\.]+',
					'required': 'required',
					'maxsize': '35',
					'autocomplete': 'off',
				}),
				E('button', {
					'id': 'btnGenerateKey',
					'type': 'submit',
					'class': 'btn cbi-button cbi-button-action',
				}, [_('Generate')])
			])
		])
	]);
	return E('div', {'class': 'cbi-section cbi-tblsection'}, [
		E('h3', _('SSH Keys')),
		E('div', {'class': 'cbi-section-descr'},
			_('Add the pub key to %s or %s.')
				.format('<code>/root/.ssh/authorized_keys</code>', '<code>/etc/dropbear/authorized_keys</code>') + ' ' +
			_('In LuCI you can do that with <a %s>System / Administration / SSH-Keys</a>')
				.format('href="/cgi-bin/luci/admin/system/admin/sshkeys"')
		),
		keyGenBtn, table
	]);
}

function _handleKeyGenSubmit(event) {
	event.preventDefault();
	var keyName = document.querySelector('input[name="keyName"]').value;
	if (allSshKeys[keyName]) {
		document.body.scrollTop = document.documentElement.scrollTop = 0;
		ui.addNotification(null, E('p', _('A key with that name already exists.'), 'error'));
		return false;
	}

	let command = '/usr/bin/ssh-keygen';
	let commandArgs = ['-t', 'ed25519', '-q', '-N', '', '-f', '/root/.ssh/' + keyName];
	if (!hasSshKeygen) {
		command = '/usr/bin/dropbearkey';
		commandArgs = ['-t', 'ed25519', '-f', '/root/.ssh/' + keyName];
	}
	fs.exec(command, commandArgs).then(function (res) {
		if (res.code === 0) {
			// refresh the page to see the new key
			location.reload();
		} else {
			throw new Error(res.stdout + ' ' + res.stderr);
		}
	}).catch(function (e) {
		document.body.scrollTop = document.documentElement.scrollTop = 0;
		ui.addNotification(null, E('p', _('Unable to generate a key: %s').format(e.message)), 'error');
	});
	return false;
}
