'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';

const CONFIG = 'uci_git_backup';
const SECTION = 'config';
const SSH_KEY_FILE = '/etc/uci-git-backup/id_rsa';

function getLocalFqdn() {
	const host = (window.location && window.location.hostname) || 'openwrt';
	return host.trim() || 'openwrt';
}

function getDefaultAuthorName() {
	return _('OpenWrt (%s)').format(getLocalFqdn());
}

function renderOutput(title, res) {
	const output = [res.stdout, res.stderr].filter(Boolean).join('\n').trim() || _('No output.');
	const success = (res.code === 0);

	ui.showModal(title, [
		E('p', { 'class': success ? 'spinning' : null }, [
			success ? _('Command completed successfully.') : _('Command failed with exit code %d.').format(res.code)
		]),
		E('pre', { 'style': 'white-space: pre-wrap' }, [output]),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Dismiss') ])
		])
	]);
}

function readRecentBackupLog() {
	return L.resolveDefault(fs.exec('/sbin/logread', [ '-e', 'uci-git-backup' ]), { code: 1, stdout: '', stderr: '' })
		.then(function(res) {
			return (res.stdout || '').trim();
		});
}

return view.extend({
	getCurrentSettingsValues: function() {
		if (!this.settingsSection)
			return {};

		return this.settingsSection.formvalue(SECTION);
	},

	saveCurrentSettings: function() {
		if (!this.map)
			return Promise.resolve();

		return this.map.parse().then(L.bind(function() {
			return this.save(null, true);
		}, this.map));
	},

	handleRunBackup: function() {
		ui.showModal(_('Saving settings...'), [
			E('p', { 'class': 'spinning' }, [ _('Saving the current form values before running the backup.') ])
		]);

		return this.saveCurrentSettings().then(function() {
			ui.showModal(_('Running backup...'), [
				E('p', { 'class': 'spinning' }, [ _('The backup script is running now.') ])
			]);

			return fs.exec('/usr/bin/uci-git-backup', []).then(function(res) {
				return readRecentBackupLog().then(function(logText) {
					if (![res.stdout, res.stderr].filter(Boolean).join('\n').trim() && logText)
						res.stdout = logText;

					renderOutput(_('Backup Output'), res);
				});
			});
		}).catch(function(err) {
			renderOutput(_('Backup Output'), {
				code: 1,
				stdout: '',
				stderr: err?.message || String(err)
			});
		});
	},

	handleTestConnection: function() {
		const values = this.getCurrentSettingsValues();
		const args = [
			'--remote-url', values.remote_url || '',
			'--branch', values.branch || 'main',
			'--auth-type', values.auth_type || 'password',
			'--username', values.username || '',
			'--password', values.password || ''
		];

		ui.showModal(_('Saving settings...'), [
			E('p', { 'class': 'spinning' }, [ _('Saving the current form values before testing the connection.') ])
		]);

		return this.saveCurrentSettings().then(function() {
			ui.showModal(_('Testing connection...'), [
				E('p', { 'class': 'spinning' }, [ _('Checking remote reachability and authentication with the current form values.') ])
			]);

			return fs.exec('/usr/bin/uci-git-test', args).then(function(res) {
				renderOutput(_('Connection Test Output'), res);
			});
		}).catch(function(err) {
			renderOutput(_('Connection Test Output'), {
				code: 1,
				stdout: '',
				stderr: err?.message || String(err)
			});
		});
	},

	load: function() {
		return Promise.all([
			uci.load(CONFIG),
			L.resolveDefault(fs.read(SSH_KEY_FILE), ''),
			readRecentBackupLog()
		]);
	},

	render: function(data) {
		const sshKey = data[1] || '';
		const logText = data[2] || '';
		const defaultAuthorName = getDefaultAuthorName();
		let m, s, o;

		m = new form.Map(CONFIG, _('UCI Git Backup'),
			_('Automatically commits and pushes watched UCI configuration to a remote Git repository whenever a watched config is committed.'));
		this.map = m;

		s = m.section(form.NamedSection, SECTION, 'uci_git_backup', _('Settings'));
		this.settingsSection = s;
		s.anonymous = false;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable automatic backup'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'remote_url', _('Remote Repository URL'),
			_('HTTPS or SSH URL, e.g. <code>https://github.com/user/repo.git</code> or <code>git@github.com:user/repo.git</code>'));
		o.placeholder = 'https://github.com/user/router-backup.git';
		o.rmempty = false;

		o = s.option(form.Value, 'branch', _('Branch'),
			_('Remote branch to push to. It will be created if it does not exist yet.'));
		o.placeholder = 'main';
		o.default = 'main';
		o.rmempty = false;

		o = s.option(form.ListValue, 'auth_type', _('Authentication'));
		o.value('password', _('Username / Password or Token (HTTPS)'));
		o.value('ssh', _('SSH Private Key'));
		o.default = 'password';

		o = s.option(form.Value, 'username', _('Username'),
			_('Required for HTTPS auth. For personal access tokens, use your normal Git username here and paste the token below.'));
		o.depends('auth_type', 'password');
		o.rmempty = true;

		o = s.option(form.Value, 'password', _('Password / Token'),
			_('For hosted Git services, use a personal access token instead of your account password.'));
		o.depends('auth_type', 'password');
		o.password = true;
		o.rmempty = true;

		o = s.option(form.TextValue, 'ssh_private_key', _('SSH Private Key'),
			_('Stored in <code>/etc/uci-git-backup/id_rsa</code>, not in UCI. Paste an unencrypted key. Leaving this field empty keeps the existing key file.'));
		o.depends('auth_type', 'ssh');
		o.rows = 10;
		o.wrap = 'off';
		o.rmempty = true;
		o.load = function() {
			return sshKey;
		};
		o.write = function(section_id, value) {
			value = (value || '').replace(/\r\n/g, '\n');

			if (value.trim().length < 20)
				return;

			if (!value.endsWith('\n'))
				value += '\n';

			return fs.write(SSH_KEY_FILE, value).then(function() {
				return fs.exec('/bin/chmod', [ '0600', SSH_KEY_FILE ]);
			});
		};
		o.remove = function() {};

		o = s.option(form.Value, 'repo_path', _('Local Repository Path'),
			_('Use <code>/etc/...</code> for persistent storage or <code>/tmp/...</code> for temporary RAM-only storage.'));
		o.placeholder = '/etc/uci-git-backup/repo';
		o.default = '/etc/uci-git-backup/repo';

		o = s.option(form.Value, 'author_name', _('Commit Author Name'));
		o.placeholder = defaultAuthorName;
		o.default = defaultAuthorName;
		o.cfgvalue = function(section_id) {
			const value = uci.get(CONFIG, section_id, 'author_name');
			return (!value || value === 'OpenWRT' || value === 'OpenWrt') ? defaultAuthorName : value;
		};

		o = s.option(form.Value, 'author_email', _('Commit Author Email'));
		o.placeholder = 'openwrt@localhost';
		o.default = 'openwrt@localhost';

		o = s.option(form.DynamicList, 'extra_triggers', _('Additional UCI Configs to Watch'),
			_('Extra config names beyond the built-in set. Restart the service after saving to apply trigger changes.'));
		o.placeholder = 'custom_package';
		o.rmempty = true;

		s = m.section(form.NamedSection, SECTION, 'uci_git_backup', _('Actions'));
		s.anonymous = false;
		s.addremove = false;

		o = s.option(form.Button, '_run_backup', _('Run Backup Now'),
			_('Saves the current form values, then runs the backup script and shows its output.'));
		o.inputstyle = 'action';
		o.inputtitle = _('Run Backup Now');
		o.onclick = ui.createHandlerFn(this, 'handleRunBackup');

		o = s.option(form.Button, '_test_connection', _('Test Connection'),
			_('Saves the current form values, then tests the remote settings without creating a commit or push.'));
		o.inputstyle = 'action';
		o.inputtitle = _('Test Connection');
		o.onclick = ui.createHandlerFn(this, 'handleTestConnection');

		s = m.section(form.NamedSection, SECTION, 'uci_git_backup', _('Recent Log'));
		s.anonymous = false;
		s.addremove = false;

		o = s.option(form.DummyValue, '_recent_log', _('Recent Log Output'));
		o.renderWidget = function() {
			return E('pre', { 'style': 'white-space: pre-wrap' }, [ logText || _('No recent log output.') ]);
		};

		return m.render();
	}
});
