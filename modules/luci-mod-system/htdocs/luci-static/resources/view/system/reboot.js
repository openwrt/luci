'use strict';
'require fs';
'require ui';
'require uci';
'require rpc';

var callReboot = rpc.declare({
	object: 'luci',
	method: 'setReboot',
	expect: { result: false }
});

return L.view.extend({
	load: function() {
		return uci.changes();
	},

	render: function(changes) {
		var body = E([
			E('h2', _('Reboot')),
			E('p', {}, _('Reboots the operating system of your device'))
		]);

		for (var config in (changes || {})) {
			body.appendChild(E('p', { 'class': 'alert-message warning' },
				_('Warning: There are unsaved changes that will get lost on reboot!')));
			break;
		}

		body.appendChild(E('hr'));
		body.appendChild(E('button', {
			'class': 'cbi-button cbi-button-action important',
			'click': ui.createHandlerFn(this, 'handleReboot')
		}, _('Perform reboot')));

		return body;
	},

	handleReboot: function(ev) {
		return callReboot().then(function() {
			L.ui.showModal(_('Rebooting…'), [
				E('p', { 'class': 'spinning' }, _('Waiting for device...'))
			]);

			window.setTimeout(function() {
				L.ui.showModal(_('Rebooting…'), [
					E('p', { 'class': 'spinning alert-message warning' },
						_('Device unreachable! Still waiting for device...'))
				]);
			}, 150000);

			L.ui.awaitReconnect();
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
