// SPDX-License-Identifier: Apache-2.0
/* global lpac */

'use strict';
'require view';
'require ui';
'require lpac';

function resultError(title, result) {
	return E('div', { 'class': 'alert-message warning' }, [
		E('strong', {}, [ title ]),
		E('br'),
		lpac.errorMessage(result)
	]);
}

function valueOrUnknown(value) {
	return value != null && value !== '' ? value : _('Unknown');
}

function formatBytes(value) {
	return value != null && value !== '' && Number.isFinite(+value)
		? '%1024.2mB'.format(+value)
		: _('Unknown');
}

function detailsTable(fields) {
	const table = E('table', { 'class': 'table' });

	for (let i = 0; i < fields.length; i += 2) {
		table.appendChild(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '35%' }, [ fields[i] ]),
			E('td', { 'class': 'td left' }, [ valueOrUnknown(fields[i + 1]) ])
		]));
	}

	return table;
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(lpac.getVersion(), null),
			L.resolveDefault(lpac.getDrivers(), null),
			L.resolveDefault(lpac.getInfo(), null),
			L.resolveDefault(lpac.getConfig(), null)
		]);
	},

	render: function(results) {
		const versionResult = results[0];
		const driversResult = results[1];
		const infoResult = results[2];
		const configResult = results[3];
		const version = lpac.dataOr(versionResult, _('Unavailable'));
		const drivers = lpac.dataOr(driversResult, {});
		const config = lpac.dataOr(configResult, {});
		const apduDrivers = drivers.apdu || drivers.LPAC_APDU || [];
		const httpDrivers = drivers.http || drivers.LPAC_HTTP || [];
		const backend = config.global && config.global.apdu_backend;
		const nodes = [
			E('h2', {}, [ _('eSIM Manager') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Manage the eUICC through the packaged lpac backend. Modem and network lifecycle operations remain outside this application.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Backend status') ]),
				detailsTable([
					_('lpac version'), version,
					_('Selected APDU backend'), backend,
					_('Available APDU backends'), apduDrivers.length ? apduDrivers.join(', ') : null,
					_('Available HTTP backends'), httpDrivers.length ? httpDrivers.join(', ') : null
				])
			])
		];

		if (!versionResult || !versionResult.success)
			nodes.push(resultError(_('Unable to read lpac version'), versionResult));

		if (!driversResult || !driversResult.success)
			nodes.push(resultError(_('Unable to read lpac drivers'), driversResult));

		if (!configResult || !configResult.success)
			nodes.push(resultError(_('Unable to read lpac settings'), configResult));

		if (!infoResult || !infoResult.success) {
			nodes.push(resultError(_('Unable to read eUICC information'), infoResult));
		}
		else {
			const info = infoResult.data || {};
			const addresses = info.EuiccConfiguredAddresses || {};
			const info2 = info.EUICCInfo2 || {};
			const resources = info2.extCardResource || {};

			nodes.push(E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('eUICC information') ]),
				detailsTable([
					_('EID'), info.eidValue,
					_('Firmware version'), info2.euiccFirmwareVer,
					_('Profile specification'), info2.profileVersion,
					_('SVN version'), info2.svn,
					_('Default SM-DP+ address'), addresses.defaultDpAddress,
					_('Root SM-DS address'), addresses.rootDsAddress,
					_('Free non-volatile memory'), formatBytes(resources.freeNonVolatileMemory),
					_('Free volatile memory'), formatBytes(resources.freeVolatileMemory)
			])
		]));
		}

		nodes.push(E('div', { 'class': 'cbi-page-actions' }, [
			E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, function() {
					window.location.reload();
				})
			}, [ _('Refresh') ])
		]));

		return E(nodes);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
