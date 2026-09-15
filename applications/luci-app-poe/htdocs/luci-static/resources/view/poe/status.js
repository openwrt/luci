// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require rpc';
'require ui';
'require poll';
'require dom';

var callPoeInfo = rpc.declare({
	object: 'poe',
	method: 'info'
});

var callPoeManage = rpc.declare({
	object: 'poe',
	method: 'manage',
	params: [ 'port', 'enable' ]
});

function portNum(name) {
	var m = String(name).match(/(\d+)/);
	return m ? +m[1] : 0;
}

/* realtek-poe reports a per-port status string such as
   "Disabled", "Searching", "Delivering", "Fault". Anything other than
   "Disabled" means power delivery is enabled on the port. */
function portIsOn(port) {
	return String((port && port.status) || '').toLowerCase() != 'disabled';
}

/* realtek-poe reports priority 0 when no explicit priority has been set on a
   port; values 1-3 map to the Low/Medium/High choices in the config form. */
function priorityLabel(prio) {
	if (prio == null)
		return '-';
	switch (+prio) {
	case 0: return _('Unset (0)');
	case 1: return _('Low (1)');
	case 2: return _('Medium (2)');
	case 3: return _('High (3)');
	default: return String(prio);
	}
}

/* The daemon includes a per-port "consumption" field while the port is
   actually delivering power; the field is absent when idle. */
function consumptionLabel(port) {
	return (port && port.consumption != null) ? '%.1f W'.format(port.consumption) : '-';
}

return view.extend({
	/* No cbi form on this page, so suppress the Save/Save&Apply/Reset footer
	   the base view would otherwise render (cf. status/processes.js). */
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	handleToggle: function(port, enable) {
		/* Mark the port as transitioning and repaint at once, so the row shows a
		   pending state with no RPC/MCU latency. The pending entry is cleared in
		   renderStatus once the daemon reports a status matching the intent. */
		this.pending[port] = enable;
		this.repaint();

		return callPoeManage(port, enable).then(L.bind(function() {
			/* The MCU takes ~1-2s to settle; poll faster than the steady 5s cadence
			   so the pending label clears promptly. */
			this.reconcile();
		}, this)).catch(L.bind(function(err) {
			delete this.pending[port];
			this.repaint();
			ui.addNotification(null, E('p', {},
				_('Failed to switch PoE on %s: %s').format(port, err.message || err)), 'error');
		}, this));
	},

	/* Re-render the status table from the last fetched info without a new RPC. */
	repaint: function() {
		if (this.statusNode)
			dom.content(this.statusNode, this.renderStatus(this.lastInfo));
	},

	refreshStatus: function() {
		return L.resolveDefault(callPoeInfo(), {}).then(L.bind(function(info) {
			this.lastInfo = info;
			if (this.statusNode)
				dom.content(this.statusNode, this.renderStatus(info));
		}, this));
	},

	/* Short burst of refreshes after a toggle to reconcile the pending state
	   quickly, rather than waiting for the next 5s poll. */
	reconcile: function() {
		[ 500, 1000, 2000, 3500 ].forEach(L.bind(function(delay) {
			window.setTimeout(L.bind(function() {
				if (this.statusNode)
					this.refreshStatus();
			}, this), delay);
		}, this));
	},

	renderStatus: function(info) {
		info = info || {};
		this.lastInfo = info;
		var ports = info.ports || {};
		var names = Object.keys(ports).sort(function(a, b) { return portNum(a) - portNum(b); });

		var rows = names.map(L.bind(function(name) {
			var p = ports[name] || {};
			var actualOn = portIsOn(p);

			/* A port is "pending" between a toggle click and the daemon reporting
			   the intended state. Clear the pending flag once they agree. */
			var pending = (name in this.pending);
			if (pending && this.pending[name] === actualOn) {
				delete this.pending[name];
				pending = false;
			}

			var statusText, actionCell;
			if (pending) {
				var want = this.pending[name];
				statusText = want ? _('Enabling…') : _('Disabling…');
				actionCell = E('button', {
					'class': 'btn cbi-button ' + (want ? 'cbi-button-apply' : 'cbi-button-remove'),
					'disabled': 'disabled'
				}, [ E('span', { 'class': 'spinning' }, want ? _('Turning on…') : _('Turning off…')) ]);
			}
			else {
				statusText = p.status || '-';
				actionCell = E('button', {
					'class': 'btn cbi-button ' + (actualOn ? 'cbi-button-remove' : 'cbi-button-apply'),
					'click': ui.createHandlerFn(this, 'handleToggle', name, !actualOn)
				}, actualOn ? _('Turn off') : _('Turn on'));
			}

			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Port') }, name),
				E('td', { 'class': 'td', 'data-title': _('Mode') }, p.mode || '-'),
				E('td', { 'class': 'td', 'data-title': _('Status') }, statusText),
				E('td', { 'class': 'td', 'data-title': _('Priority') }, priorityLabel(p.priority)),
				E('td', { 'class': 'td', 'data-title': _('Consumption') }, consumptionLabel(p)),
				E('td', { 'class': 'td cbi-section-actions' }, [ actionCell ])
			]);
		}, this));

		if (!rows.length)
			rows = [ E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td' }, _('No PoE ports reported. Is the realtek-poe daemon running?'))
			]) ];

		var header = E('p', {}, [
			E('strong', {}, _('Power budget: ')), '%.1f W'.format(info.budget || 0),
			' — ', E('strong', {}, _('Consumption: ')), '%.1f W'.format(info.consumption || 0),
			info.firmware ? (' — ' + _('MCU firmware: ') + info.firmware) : ''
		]);

		var table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Port')),
				E('th', { 'class': 'th' }, _('Mode')),
				E('th', { 'class': 'th' }, _('Status')),
				E('th', { 'class': 'th' }, _('Priority')),
				E('th', { 'class': 'th' }, _('Consumption')),
				E('th', { 'class': 'th cbi-section-actions' }, _('Control'))
			])
		].concat(rows));

		return [ header, table ];
	},

	load: function() {
		return L.resolveDefault(callPoeInfo(), {});
	},

	render: function(info) {
		/* pending: ports mid-toggle (name -> intended on/off); lastInfo: most
		   recent `poe info` snapshot, used to repaint without a fresh RPC. */
		this.pending = {};
		this.lastInfo = info || {};

		this.statusNode = E('div', {}, this.renderStatus(info));

		/* keep the live status table fresh (interval follows luci.main.pollinterval) */
		poll.add(L.bind(this.refreshStatus, this));

		return E('div', {}, [
			E('h2', {}, _('Power over Ethernet')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Live status')),
				E('p', {}, _('This table refreshes automatically.')),
				E('p', {}, _('The <em>Turn on</em> / <em>Turn off</em> buttons toggle a port\'s power ' +
					'immediately. These changes are temporary and revert on the next reboot or ' +
					'<em>Save &amp; Apply</em>. To make a setting permanent, edit it under ' +
					'<a href="%s">Network → PoE</a>.').format(L.url('admin/network/poe'))),
				this.statusNode
			])
		]);
	}
});
