'use strict';
'require view';
'require dom';
'require poll';
'require ui';
'require corosync.qnetd as qnetd';
/* global qnetd */

function warnings(s) {
	const list = [];
	if (s.config?.enabled === '1' && !s.running)
		list.push(_('QNetd is enabled but not running.'));
	if (!([ 'req', 'required' ].includes(s.config?.tls)) || s.config?.client_cert_required !== 'on')
		list.push(_('TLS or client-certificate enforcement is not set to the recommended value.'));
	if (!s.health?.ca_valid || !s.health?.server_valid)
		list.push(_('The CA or server certificate is missing, invalid, or expired.'));
	for (const cluster of (s.clients?.clusters || [])) {
		if (/^(2 Node )?LMS\b/i.test(cluster.algorithm || ''))
			list.push(_('Cluster %s uses Last Man Standing. The QNetd host is part of its availability assumptions.').format(cluster.name));
		for (const node of (cluster.nodes || []))
			if (!(node.tls || '').toLowerCase().includes('client certificate verified'))
				list.push(_('A client in cluster %s is not reported with a verified TLS client certificate.').format(cluster.name));
	}
	return list;
}

function clusterTable(s) {
	const rows = [];
	for (const cluster of (s.clients?.clusters || []))
		for (const node of (cluster.nodes || []))
			rows.push([ cluster.name, cluster.algorithm || '-', node.node_id, node.client_address || '-', node.tls || '-', node.vote || '-' ]);
	const table = E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr table-titles' }, [ _('Cluster'), _('Algorithm'), _('Node ID'), _('Client'), _('TLS'), _('Vote') ].map(v => E('th', { 'class': 'th' }, v)))
	]);
	cbi_update_table(table, rows, E('em', _('No Corosync clients are connected.')));
	return table;
}

function content(s, logs) {
	const notices = warnings(s);
	return E('div', [
		E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Service status')),
			E('div', { 'class': 'table' }, [
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Service')), E('div', { 'class': 'td left' }, qnetd.badge(s.running, _('Running'), _('Stopped'))) ]),
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Start on boot')), E('div', { 'class': 'td left' }, qnetd.badge(s.boot_enabled, _('Enabled'), _('Disabled'))) ]),
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Connected clients / clusters')), E('div', { 'class': 'td left' }, '%d / %d'.format(s.server?.connected_clients || 0, s.server?.connected_clusters || 0)) ]),
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Listen address')), E('div', { 'class': 'td left' }, s.server?.address || s.config?.listen_address || '-') ]),
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('TLS')), E('div', { 'class': 'td left' }, s.server?.tls || s.config?.tls || '-') ])
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-action', 'disabled': s.running ? '' : null, 'click': ui.createHandlerFn(this, () => qnetd.run(qnetd.service('start', s)).then(() => location.reload())) }, _('Start')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'disabled': !s.running ? '' : null, 'click': ui.createHandlerFn(this, () => {
					if (qnetd.clients(s) && !confirm(_('Connected clients will briefly lose their quorum device. Continue?'))) return;
					return qnetd.run(qnetd.service('restart', s)).then(() => location.reload());
				}) }, _('Restart')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-negative', 'disabled': !s.running ? '' : null, 'click': ui.createHandlerFn(this, () => {
					if (!confirm(_('Stop QNetd? Connected clusters may lose quorum availability.'))) return;
					return qnetd.run(qnetd.service('stop', s)).then(() => location.reload());
				}) }, _('Stop'))
			])
		]),
		notices.length ? E('div', { 'class': 'alert-message warning' }, [ E('strong', _('Attention')), E('ul', notices.map(v => E('li', v))) ]) : '',
		E('div', { 'class': 'cbi-section' }, [ E('h3', _('Connected clusters')), clusterTable(s) ]),
		E('div', { 'class': 'cbi-section' }, [ E('h3', _('Recent log messages')), E('pre', { 'style': 'max-height:18em;overflow:auto;white-space:pre-wrap' }, (logs.lines || []).join('\n') || _('No matching log messages.')) ])
	]);
}

return view.extend({
	load: () => Promise.all([ qnetd.status(), qnetd.logs() ]),
	render(data) {
		if (!data[0]?.health?.initialized) {
			location.replace(L.url('admin/services/corosync-qnetd/setup'));
			return E('p', { 'class': 'spinning' }, _('Opening first-time setup…'));
		}
		const box = E('div', content(data[0], data[1]));
		poll.add(() => Promise.all([ qnetd.status(), qnetd.logs() ]).then(v => dom.content(box, content(v[0], v[1]))), 5);
		return E('div', { 'class': 'cbi-map' }, [ E('h2', _('Corosync QNetd')), E('div', { 'class': 'cbi-map-descr' }, _('Live quorum-server health and connected Corosync clients.')), box ]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
