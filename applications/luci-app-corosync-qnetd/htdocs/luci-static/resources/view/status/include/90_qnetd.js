'use strict';
'require baseclass';
'require corosync.qnetd as qnetd';
/* global qnetd */

return baseclass.extend({
	title: _('Corosync QNetd'),
	load: () => qnetd.status(),
	render(status) {
		if (!status.installed) return null;
		return E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Service')), E('div', { 'class': 'td right' }, qnetd.badge(status.running, _('Running'), _('Stopped'))) ]),
			E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Clients')), E('div', { 'class': 'td right' }, String(status.health?.connected_clients || 0)) ]),
			E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Certificates')), E('div', { 'class': 'td right' }, qnetd.badge(status.health?.ca_valid && status.health?.server_valid, _('Valid'), _('Attention'))) ]),
			E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }), E('div', { 'class': 'td right' }, E('a', { 'href': L.url('admin/services/corosync-qnetd/overview') }, _('Open QNetd overview'))) ])
		]);
	}
});
