function submitPassword(ev) {
	var pw1 = document.body.querySelector('[name="pw1"]'),
	    pw2 = document.body.querySelector('[name="pw2"]');

	if (!pw1.value.length || !pw2.value.length)
		return;

	if (pw1.value === pw2.value) {
		L.showModal(_('Change login password'),
			E('p', { class: 'spinning' }, _('Changing password…')));

		L.post('admin/system/admin/password/json', { password: pw1.value },
			function() {
				showModal(_('Change login password'), [
					E('div', _('The system password has been successfully changed.')),
					E('div', { 'class': 'right' },
						E('div', { class: 'btn', click: L.hideModal }, _('Dismiss')))
				]);

				pw1.value = pw2.value = '';
			});
	}
	else {
		L.showModal(_('Change login password'), [
			E('div', { class: 'alert-message warning' },
				_('Given password confirmation did not match, password not changed!')),
			E('div', { 'class': 'right' },
				E('div', { class: 'btn', click: L.hideModal }, _('Dismiss')))
		]);
	}
}
