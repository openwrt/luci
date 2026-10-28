'use strict';
/* global hmUi */
'require view';
'require fs';
'require ui';
'require haproxy-manager.ui as hmUi';

return view.extend({
	load: function() {
		return Promise.all([
			fs.read('/etc/haproxy.cfg').catch(function() {
				return '';
			})
		]);
	},

	applyRaw: function(textarea) {
		ui.showModal(_('Apply raw configuration?'), [
			E('p', _('The file will be validated and backed up before HAProxy restarts.')),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'type': 'button',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() {
						return fs.write('/tmp/haproxy-manager-raw.cfg', textarea.value).then(function() {
							return hmUi.exec('/usr/libexec/haproxy-manager/apply-raw-file', [ '/tmp/haproxy-manager-raw.cfg' ]);
						}).then(function(r) {
							ui.hideModal();
							hmUi.notify(r.stdout || _('Applied'), 'info');
						}).catch(function(err) {
							ui.hideModal();
							hmUi.notifyError(err);
						});
					})
				}, _('Apply'))
			])
		]);
	},

	render: function(data) {
		var cfg = data[0];
		var textarea = E('textarea', {
			'id': 'haproxy-raw-config',
			'class': 'cbi-input-textarea hm-raw-editor',
			'spellcheck': 'false',
			'aria-label': _('Raw HAProxy configuration')
		}, cfg || '');

		hmUi.ensureStyles();

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', _('Raw HAProxy Config')),
			E('div', { 'class': 'cbi-map-descr' }, _('Expert editor for /etc/haproxy.cfg.')),
			E('div', { 'class': 'alert-message warning' }, _('Generated routes can overwrite manual changes to this file.')),
			textarea,
			E('div', { 'class': 'cbi-page-actions hm-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() {
						return fs.write('/tmp/haproxy-manager-raw.cfg', textarea.value).then(function() {
							return hmUi.exec('/usr/libexec/haproxy-manager/validate', [ '/tmp/haproxy-manager-raw.cfg' ]);
						}).then(function(r) {
							hmUi.notify(r.stdout || _('Config is valid'), 'info');
						}).catch(function(err) {
							hmUi.notifyError(err);
						});
					})
				}, _('Validate')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() { this.applyRaw(textarea); })
				}, _('Apply raw config'))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
