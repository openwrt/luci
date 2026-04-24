'use strict';
'require view';
'require dom';
'require ui';
'require fs';
'require uci';
'require form';
'require rpc';

var formData = {
	data: {
		rpc_user: null,
		user: null,
		rpcd: null,
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

		return true;
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/sbin/uhttpd'), null),
			fs.lines('/etc/passwd'),
			uci.load('rpcd')
		]);
	},

	render: function([has_uhttpd, passwd]) {
		var m, s, o, rpcd;

		const known_unix_users = {};

		for (let p of passwd) {
			const parts = p.split(/:/);

			if (parts.length >= 7)
				known_unix_users[parts[0]] = true;
		}

		m = new form.JSONMap(formData, _('Password'), _('Changes the password for accessing the device as (rpcd) user'));
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'data', 'data');

		if (has_uhttpd) {
			let logins = [];

			uci.sections('rpcd', 'login', s => logins.push(s.username));

			rpcd = s.option(form.Flag, 'rpcd', _('Change password for rpcd user'));
			rpcd.default = false;

			o = s.option(form.Value, 'rpc_user', _('rpcd username'));
			for (let user of logins) {
				if (user == 'root')
					continue;

				o.value(user, _('%s').format(user));
			}
			o.rmempty = false;
			o.depends({ 'rpcd': '1' });

			o = s.option(form.Value, 'user', _('Router username'));
			for (let user in known_unix_users)
				o.value(user, _('%s').format(user));
			o.rmempty = false;
			o.depends({ 'rpcd': '0' });

			o = s.option(form.Value, 'oldpw', _('Old Password'));
			o.password = true;
			o.depends({ 'rpcd': '1' });
		}

		if (!has_uhttpd) {
			o = s.option(form.Value, 'user', _('Router username'));
			for (let user in known_unix_users)
				o.value(user);
			o.rmempty = false;
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

		return dom.callClassMethod(map, 'save').then(function() {
			let rpc_user = formData.data.rpc_user;
			let user = formData.data.user;
			let rpcd = formData.data.rpcd;
			let oldpw = formData.data.oldpw;

			if (rpc_user && (oldpw == null || oldpw.length == 0))
				return;

			if (formData.data.pw1 == null || formData.data.pw1.length == 0)
				return;

			if (formData.data.pw1 != formData.data.pw2) {
				ui.addNotification(null, E('p', _('Given password confirmation did not match, password not changed!')), 'danger');
				return;
			}

			return callSetPassword(
				rpc_user ? rpc_user : user,
				formData.data.pw1,
				oldpw ? oldpw : '',
				rpcd ? true : false,
			).then(function(success) {
				if (success)
					ui.addNotification(null, E('p', _('The system password has been successfully changed.')), 'info');
				else
					ui.addNotification(null, E('p', _('Failed to change the system password.')), 'danger');

				formData.data.rpc_user = null;
				formData.data.user = null;
				formData.data.rpcd = null;
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
