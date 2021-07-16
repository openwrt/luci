'use strict';
'require fs';
'require ui';
'require dom';
'require rpc';
'require session';
'require baseclass';

var callReboot = rpc.declare({
	object: 'system',
	method: 'reboot',
	expect: { result: 0 }
});

callReboot = function() {
	return Promise.resolve(0);
}

function handleReboot(ev) {
	return callReboot().then(function(res) {
		if (res != 0) {
			showError(_('The reboot command failed with code %d').format(res));
			L.raise('Error', 'Reboot failed');
		}

		showProgress(_('The system is rebooting in order to attempt applying the remote configuration profile now. If not successful, the device will revert back into the initial provisioning state.'));

		ui.awaitReconnect();
	}).catch(function(e) { showError(e.message) });
}

function setDirty(isDirty) {
	if (isDirty) {
		session.setLocalData('ucentral-dirty', true);
		ui.showIndicator('ucentral-dirty', _('Reboot required'), showApplySettings);
	}
	else {
		session.setLocalData('ucentral-dirty', null);
		ui.hideIndicator('ucentral-dirty');
	}
}

function handleContinue(ev) {
	setDirty(true);
	ui.hideModal();
}

function showApplySettings() {
	ui.showModal(_('Apply Settings'), [
		E('p', _('The device must be rebooted in order to apply the changed settings. Once the uCentral agent successfully connects to the controller, the remote configuration profile will be applied and the initial provisioning web interface is disabled.')),
		E('div', { 'class': 'right' }, [
			E('button', { 'click': handleReboot, 'class': 'btn primary' }, [ _('Apply settings and reboot device now') ]),
			'\xa0',
			E('button', { 'click': handleContinue, 'class': 'btn' }, [ _('Continue configuration') ])
		])
	]);
}

function showProgress(text, timeout) {
	var dlg = ui.showModal(null, [
		E('p', { 'class': (timeout > 0) ? null : 'spinning' }, text)
	]);

	dlg.removeChild(dlg.firstElementChild);

	if (timeout > 0)
		window.setTimeout(ui.hideModal, timeout);

	return dlg;
}

function showError(text) {
	ui.showModal(_('Error'), [
		E('p', [ text ]),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, _('OK'))
		])
	]);
}

if (session.getLocalData('ucentral-dirty'))
	setDirty(true);

return baseclass.extend({
	save: function(serializeFn, ev) {
		var m = dom.findClassInstance(document.querySelector('.cbi-map'));

		return m.save().then(function() {
			return fs.write('/etc/ucentral/profile.json', serializeFn(m.data.data));
		}).then(function() {
			return fs.exec('/sbin/profileupdate');
		}).then(function() {
			showApplySettings();
		}).catch(function(err) {
			showError(_('Unable to save settings: %s').format(err));
		});
	},

	setDirty: setDirty,
	showError: showError,
	showProgress: showProgress,
});
