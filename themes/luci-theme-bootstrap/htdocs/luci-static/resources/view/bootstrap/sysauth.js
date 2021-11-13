'use strict';
'require ui';
'require dom';
'require form';
'require view';
'require request';

var data = { login: {} };

return view.extend({
	load: function() {
		var m, s, o;

		m = new form.JSONMap(data);
		s = m.section(form.NamedSection, 'login');

		o = s.option(form.Value, 'username', _('Username'));
		o.default = L.env.default_login_user;

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;
		o.validate = function(section_id, value) {
			var msg = document.querySelector('alert-message');

			if (msg && value.length)
				msg.parentNode.removeChild(msg);

			return true;
		};

		return m.render();
	},

	render: function(form) {
		ui.showModal(_('Authorization Required'), [
			form,
			E('hr'),
			E('div', { 'class': 'alert-message error hidden' }, [
				_('Invalid username and/or password! Please try again.')
			]),
			E('button', {
				'class': 'btn cbi-button-positive important',
				'click': ui.createHandlerFn(this, 'handleLogin', form)
			}, [ _('Login') ])
		], 'login');

		document.querySelector('[id="widget.cbid.json.login.password"]').focus();

		form.addEventListener('keyup', L.bind(function(form, ev) {
			if (ev.key === 'Enter' || ev.keyCode === 13)
				document.querySelector('.cbi-button-positive.important').click();
		}, this, form));

		return E('div', { 'class': 'spinning' }, _('Loading view…'));
	},

	handleLoginError: function(err) {
		document.querySelectorAll('.alert-message.error').forEach(function(msg) {
			msg.firstChild.data = _('The login request failed with error: %h').format(err.message);
			msg.classList.remove('hidden');
			msg.classList.add('flash');
		});
	},

	handleLoginReply: function(res) {
		if (res.status != 403) {
			ui.hideModal();
			location.reload();

			return;
		}

		document.querySelectorAll('.alert-message.error').forEach(function(msg) {
			msg.firstChild.data = _('Invalid username and/or password! Please try again.');
			msg.classList.remove('hidden');
			msg.classList.add('flash');
		});
	},

	handleLogin: function(form, ev) {
		var fd = new FormData();

		document.querySelectorAll('.alert-message.error').forEach(function(msg) {
			msg.classList.add('hidden');
			msg.classList.remove('flash');
		});

		dom.callClassMethod(form, 'save');

		fd.append('luci_username', data.login.username != null ? data.login.username : '');
		fd.append('luci_password', data.login.password != null ? data.login.password : '');

		Object.getPrototypeOf(L).notifySessionExpiry = function() {};

		return request.post(location.href, fd).then(this.handleLoginReply, this.handleLoginError);
	},

	addFooter: function() {}
});
