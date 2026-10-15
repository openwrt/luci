'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require uapi.helpers as h';

const callStatus = rpc.declare({
	object: 'luci.uapi',
	method: 'get_status'
});

const callSetInsecure = rpc.declare({
	object: 'luci.uapi',
	method: 'set_insecure',
	params: [ 'enable' ]
});

return view.extend({
	load: function () {
		return callStatus();
	},

	renderService: function (st) {
		const rows = [
			h.row(_('Handler installed'), h.badge(!!st.installed)),
			h.row(_('API version'), st.version ? E('strong', {}, [ st.version ]) : _('Unknown')),
			h.row(_('Wired into uhttpd'), st.wired
				? h.badge(true, _('Yes, at /api/%s').format(st.api_major))
				: h.warnBadge(_('No: run the package install hook'))),
			h.row(_('Active tokens'), E('span', {
				'style': 'display:inline-flex;align-items:center;gap:.75em'
			}, [
				E('strong', {}, [ '' + (st.token_count || 0) ]),
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': function () { location.href = L.url('admin/services/uapi/tokens'); }
				}, [ _('Manage tokens') ])
			]))
		];

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ _('Service') ]),
			E('table', { 'class': 'table' }, rows)
		]);
	},

	renderSecurity: function (st) {
		const self = this;
		const httpsOn = (st.https_listen && st.https_listen.length > 0);

		const insecureBtn = E('button', {
			'class': 'btn ' + (st.insecure ? 'cbi-button-negative' : 'cbi-button-action'),
			'click': ui.createHandlerFn(this, function () {
				const enable = !st.insecure;
				if (enable && !confirm(_('This disables TLS enforcement: uapi will accept plain HTTP from any client, not just the loopback. Only do this on a trusted closed network. Continue?')))
					return;
				return callSetInsecure(enable).then(function (res) {
					if (res && res.error)
						ui.addNotification(null, E('p', {}, [ res.error ]), 'error');
					return self.refresh();
				});
			})
		}, [ st.insecure ? _('Remove insecure marker') : _('Create insecure marker') ]);

		const rows = [
			h.row(_('HTTPS listener'), httpsOn
				? h.badge(true, _('Enabled'))
				: h.warnBadge(_('Not configured'))),
			h.row(_('Insecure HTTP bypass'), st.insecure
				? h.warnBadge(_('ACTIVE: /etc/uapi.insecure present'))
				: h.badge(false, '', _('Off'))),
			h.row('', insecureBtn)
		];

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ _('Security') ]),
			st.insecure ? E('div', { 'class': 'alert-message warning' }, [
				_('Plain HTTP is currently accepted from any client. Bearer tokens still apply, but they travel in cleartext. Remove the marker for production use.')
			]) : '',
			E('table', { 'class': 'table' }, rows),
			E('p', { 'class': 'cbi-value-description' }, [
				_('uapi requires TLS for non-loopback clients. The default uhttpd self-signed certificate is not adequate for production; use luci-app-acme for a real certificate.')
			])
		]);
	},

	refresh: function () {
		const self = this;
		return callStatus().then(function (st) {
			const container = document.getElementById('uapi-status');
			if (!container) return;
			dom.content(container, [
				self.renderService(st),
				self.renderSecurity(st)
			]);
		}).catch(function (e) {
			ui.addNotification(null, E('p', {}, [ _('Failed to load status: %s').format(e) ]), 'error');
		});
	},

	render: function (st) {
		st = st || {};

		const container = E('div', { 'id': 'uapi-status' }, [
			this.renderService(st),
			this.renderSecurity(st)
		]);

		return E('div', {}, [
			E('h2', {}, [ _('uAPI Status') ]),
			container
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
