'use strict';
'require view';
'require dom';
'require ui';
'require fs';
'require uci';
'require form';
'require rpc';
'require tools.password as pwtool';

var formData = {
	data: {
		account: null,
		oldpw: null,
		pw1: null,
		pw2: null
	}
};

var callSetPassword = rpc.declare({
	object: 'luci',
	method: 'setPassword',
	params: [ 'username', 'password', 'oldpassword', 'rpcd' ],
	expect: { result: 1 }
});

return view.extend({
	checkPassword: function(section_id, value) {
		var strength = document.querySelector('.cbi-value-description'),
		    strongRegex = new RegExp("^(?=.{8,})(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*\\W).*$", "g"),
		    mediumRegex = new RegExp("^(?=.{7,})(((?=.*[A-Z])(?=.*[a-z]))|((?=.*[A-Z])(?=.*[0-9]))|((?=.*[a-z])(?=.*[0-9]))).*$", "g"),
		    enoughRegex = new RegExp("(?=.{6,}).*", "g");

		const pw_enabled = uci.get('rpcd', 'policy', 'enabled');
		const pw_length = uci.get('rpcd', 'policy', 'pw_length');
		const pw_digits = uci.get('rpcd', 'policy', 'digits');
		const pw_ul = uci.get('rpcd', 'policy', 'uc_lc');
		const special = uci.get('rpcd', 'policy', 'special_characters');

		if (strength && value.length) {
			if (false == enoughRegex.test(value))
				strength.innerHTML = '%s: <span style="color:red">%s</span>'.format(_('Password strength'), _('More Characters'));
			else if (strongRegex.test(value))
				strength.innerHTML = '%s: <span style="color:green">%s</span>'.format(_('Password strength'), _('Strong'));
			else if (mediumRegex.test(value))
				strength.innerHTML = '%s: <span style="color:orange">%s</span>'.format(_('Password strength'), _('Medium'));
			else
				strength.innerHTML = '%s: <span style="color:red">%s</span>'.format(_('Password strength'), _('Weak'));
		}

		if (!pw_enabled)
			return true;

		if (pw_length && !pwtool.checkLength(value, pw_length))
			return _('Policy: min. length of %s characters').format(pw_length);

		if (pw_digits && !pwtool.checkDigits(value))
			return _('Policy: contain digits');

		if (pw_ul && !pwtool.checkUpperLower(value))
			return _('Policy: contain uppercase/lowercase');

		if (special && !pwtool.checkSpecialChars(value))
			return _('Policy: contain special characters');

		return true;
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/sbin/uhttpd'), null),
			uci.load('rpcd'),
			uci.load('luci')
		]);
	},

	// The LuCI logins whose password this page can change, from the login
	// sections in /etc/config/rpcd. A login either uses a Unix account's
	// password ('$p$<user>') or keeps its own hash, which uhttpd creates.
	accounts: function(has_uhttpd) {
		const accounts = { root: { unix: 'root' } };

		for (let login of uci.sections('rpcd', 'login')) {
			const name = login.username;
			const pw = login.password ?? '';

			if (!name || name == 'root')
				continue;

			if (pw.startsWith('$p$'))
				accounts[name] = { unix: pw.substring(3) };
			else if (has_uhttpd)
				accounts[name] = { rpcd: name };
		}

		return accounts;
	},

	render: function([has_uhttpd]) {
		var m, s, o;

		this.accountMap = this.accounts(has_uhttpd);
		const names = Object.keys(this.accountMap);

		m = new form.JSONMap(formData, _('Router Password'), names.length > 1
			? _('Changes the password of a login for this device.')
			: _('Changes the administrator password for accessing the device'));
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'data', 'data');

		if (names.length > 1) {
			o = s.option(form.ListValue, 'account', _('Account'));
			for (let name of names)
				o.value(name, this.accountMap[name].unix && this.accountMap[name].unix != name
					? _('%s (password of system user %s)').format(name, this.accountMap[name].unix)
					: name);
			o.default = 'root';

			// A login with its own password hash needs its old password.
			// Without any depends() the field would show for every login.
			if (names.some(name => this.accountMap[name].rpcd)) {
				o = s.option(form.Value, 'oldpw', _('Old Password'));
				o.password = true;
				for (let name of names)
					if (this.accountMap[name].rpcd)
						o.depends({ 'account': name });
			}
		}

		o = s.option(form.Value, 'pw1', _('Password'));
		o.password = true;
		o.validate = this.checkPassword;

		o = s.option(form.Value, 'pw2', _('Confirmation'), ' ');
		o.password = true;
		o.renderWidget = function(/* ... */) {
			var node = form.Value.prototype.renderWidget.apply(this, arguments);

			node.querySelector('input').addEventListener('keydown', function(ev) {
				if (ev.keyCode == 13 && !ev.currentTarget.classList.contains('cbi-input-invalid'))
					document.querySelector('.cbi-button-save').click();
			});

			return node;
		};

		return m.render();
	},

	handleSave: function() {
		var map = document.querySelector('.cbi-map');
		var accountMap = this.accountMap;

		return dom.callClassMethod(map, 'save').then(function() {
			const account = accountMap[formData.data.account || 'root'];
			const oldpw = formData.data.oldpw || '';

			if (!account)
				return;

			if (formData.data.pw1 == null || formData.data.pw1.length == 0)
				return;

			if (formData.data.pw1 != formData.data.pw2) {
				ui.addNotification(null, E('p', _('Given password confirmation did not match, password not changed!')), 'danger');
				return;
			}

			if (account.rpcd && !oldpw) {
				ui.addNotification(null, E('p', _('Enter the old password to change this login\'s password.')), 'danger');
				return;
			}

			return callSetPassword(
				account.rpcd ?? account.unix,
				formData.data.pw1,
				oldpw,
				!!account.rpcd,
			).then(function(success) {
				if (success)
					ui.addNotification(null, E('p', _('The system password has been successfully changed.')), 'info');
				else
					ui.addNotification(null, E('p', _('Failed to change the system password.')), 'danger');

				formData.data.account = null;
				formData.data.pw1 = null;
				formData.data.pw2 = null;
				formData.data.oldpw = null;

				dom.callClassMethod(map, 'render');
			});
		});
	},

	handleSaveApply: null,
	handleReset: null
});
