'use strict';
'require view';
'require dom';
'require ui';
'require form';
'require rpc';
'require uci';

var formData = {
	password: {
		pw1: null,
		pw2: null,
		external_auth: null
	}
};

var callSetPassword = rpc.declare({
	object: 'luci',
	method: 'setPassword',
	params: [ 'username', 'password' ],
	expect: { result: false }
});

return view.extend({
	load: function() {
		return uci.load('luci');
	},

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

	render: function() {
		var m, s, o;

		formData.password.external_auth = uci.get('luci', 'main', 'external_auth') || '0';

		m = new form.JSONMap(formData, _('Router Password'), _('Changes the administrator password for accessing the device and configures secondary authentication.'));
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'password', 'password');

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

		o = s.option(form.Flag, 'external_auth', _('Enable external auth plugins'),
			_('Allow third-party plugins (like 2FA) to provide additional authentication challenges.'));
		o.enabled = '1';
		o.disabled = '0';
		o.default = o.disabled;

		return m.render();
	},

	handleSave: function() {
		var map = document.querySelector('.cbi-map');
		var self = this;

		return dom.callClassMethod(map, 'save').then(function() {

			uci.set('luci', 'main', 'external_auth', formData.password.external_auth);

			return uci.save().then(function() {
				return uci.commit('luci');
			}).then(function() {
				if (formData.password.pw1 != null && formData.password.pw1.length > 0) {
					if (formData.password.pw1 != formData.password.pw2) {
						ui.addNotification(null, E('p', _('Given password confirmation did not match, password not changed!')), 'danger');
						return;
					}

					return callSetPassword('root', formData.password.pw1).then(function(success) {
						if (success) {
							ui.addNotification(null, E('p', _('Password and authentication settings have been successfully changed.')), 'info');
						} else {
							ui.addNotification(null, E('p', _('Failed to change the system password.')), 'danger');
						}

						formData.password.pw1 = null;
						formData.password.pw2 = null;
						dom.callClassMethod(map, 'render');
					});
				} else {
					ui.addNotification(null, E('p', _('Authentication settings have been successfully saved.')), 'info');
					dom.callClassMethod(map, 'render');
				}
			});
		});
	},

	handleSaveApply: null,
	handleReset: null
});
