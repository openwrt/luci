'use strict';
'require view';
'require poll';
'require dom';
'require view.apmond.common as common';

/*
 * ApmonD status: "ubus call apmond status", refreshed every 10 seconds, in groups.
 * Fields not known to this page are listed at the end of the last group, so a newer apmond
 * still shows everything.
 */

var DEBUGLEVEL = {
	'0': _('errors'),
	'1': _('notices'),
	'2': _('info'),
	'3': _('debug')
};

var GROUPS = [
	[ _('Daemon'), [
		[ 'package_version', _('Package version') ],
		[ 'version', _('Version') ],
		[ 'build_commit', _('Build commit') ],
		[ 'protocol', _('Protocol') ],
		[ 'running_sha256', _('Running binary sha256') ],
		[ 'installed_sha256', _('Installed binary sha256') ],
		[ 'restart_needed', _('Restart needed') ],
		[ 'debuglevel', _('Debug level') ]
	] ],
	[ _('Role and addresses'), [
		[ 'role', _('Role') ],
		[ 'role_reason', _('Role reason') ],
		[ 'id', _('Node ID') ],
		[ 'node_ula', _('Node address') ],
		[ 'collector_ula', _('Collector address') ],
		[ 'collector', _('Collector in use') ],
		[ 'collector_via', _('Collector found via') ],
		[ 'port', _('Port') ],
		[ 'key_epoch', _('Key epoch') ],
		[ 'default_passphrase', _('Default passphrase in use') ]
	] ],
	[ _('Reports'), [
		[ 'clock_synced', _('Clock synced with the collector') ],
		[ 'reports_sent', _('Reports sent') ],
		[ 'reports_failed', _('Reports failed') ],
		[ 'last_status', _('Last report HTTP status') ],
		[ 'blocks', _('Extension blocks') ]
	] ],
	[ _('Collector'), [
		[ 'nodes', _('Nodes') ],
		[ 'clients', _('Clients') ],
		[ 'collector_counters', _('Counters') ]
	] ]
];

/* shown as notes or warnings above the tables, not as rows */
var SKIP = {
	'passphrase_warning': true
};

return view.extend({
	/* notes: the default passphrase */
	statusNotes: function(st) {
		var n = [];

		/* not apmond's passphrase_warning, which says to edit /etc/config/apmond: here it is set in Settings */
		if (st.default_passphrase === true) {
			n.push(_('The built-in default passphrase is in use. Set your own passphrase in Settings, the same on every node.'));
		}

		return n;
	},

	/* warnings: restart needed, clock, failing reports */
	statusWarnings: function(st) {
		var w = [];

		if (st.restart_needed === true) {
			w.push(_('The apmond binary has been replaced since the daemon started. Restart apmond to run the installed version.'));
		}

		if (st.role != 'collector' && st.clock_synced === false) {
			w.push(_('The clock is not synced with the collector yet, so reports cannot be sent.'));
		}

		if (st.role != 'collector' && st.last_status === 0) {
			w.push(_('No report has been sent yet.'));
		} else if (st.last_status != null && st.last_status != 0 && st.last_status != 200) {
			w.push(_('The last report was not accepted by the collector (HTTP status %s). Check that every node has the same passphrase, port and key epoch.').format(st.last_status));
		}

		return w;
	},

	/* is this row a problem that should be highlighted? */
	isWarning: function(st, key) {
		if (key == 'restart_needed') {
			return st.restart_needed === true;
		}
		if (key == 'default_passphrase') {
			return st.default_passphrase === true;
		}
		if (key == 'last_status') {
			return st.last_status != null && st.last_status != 200;
		}
		if (key == 'clock_synced') {
			return st.clock_synced === false;
		}
		return false;
	},

	/* one value as display text */
	formatValue: function(key, v) {
		var parts;

		if (v == null) {
			return '-';
		}

		if (key == 'debuglevel' && DEBUGLEVEL[String(v)]) {
			return '%s (%s)'.format(v, DEBUGLEVEL[String(v)]);
		}

		if (key == 'blocks' && Array.isArray(v)) {
			if (!v.length) {
				return _('none');
			}
			parts = v.map(function(b) {
				if (b && typeof(b) == 'object' && b.name) {
					return b.name;
				}
				return JSON.stringify(b);
			});
			return parts.join(', ');
		}

		if (v === true) {
			return _('yes');
		}
		if (v === false) {
			return _('no');
		}

		if (Array.isArray(v)) {
			if (!v.length) {
				return _('none');
			}
			return v.join(', ');
		}

		if (typeof(v) == 'object') {
			parts = Object.keys(v).map(function(k) {
				return '%s: %s'.format(k, JSON.stringify(v[k]));
			});
			return parts.join(', ');
		}

		return String(v);
	},

	/* [ [ title, [ [ key, label, text, warn ], ... ] ], ... ], groups without rows left out */
	statusGroups: function(st) {
		var self = this;
		var seen = {};
		var out = [];
		var extra = [];

		GROUPS.forEach(function(g) {
			var rows = [];

			g[1].forEach(function(l) {
				seen[l[0]] = true;
				if (st[l[0]] !== undefined) {
					rows.push([ l[0], l[1], self.formatValue(l[0], st[l[0]]), self.isWarning(st, l[0]) ]);
				}
			});

			if (rows.length) {
				out.push([ g[0], rows ]);
			}
		});

		Object.keys(st).forEach(function(k) {
			if (!seen[k] && !SKIP[k]) {
				extra.push([ k, k, self.formatValue(k, st[k]), false ]);
			}
		});

		if (extra.length) {
			out.push([ _('Other'), extra ]);
		}

		return out;
	},

	renderTable: function(rows) {
		return E('table', { 'class': 'table' }, rows.map(function(r) {
			var style = 'overflow-wrap:anywhere';

			if (r[3]) {
				style = style + ';color:#c00;font-weight:bold';
			}

			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ r[1] ]),
				E('td', { 'class': 'td left', 'style': style }, [ r[2] ])
			]);
		}));
	},

	renderStatus: function(st) {
		var self = this;
		var notes;
		var warnings;
		var out = [];

		if (st == null) {
			return E('div', { 'class': 'alert-message error' },
				_('Could not read the ApmonD status. Is apmond installed, enabled and running?'));
		}

		notes = this.statusNotes(st);
		warnings = this.statusWarnings(st);

		if (notes.length) {
			out.push(E('div', { 'class': 'alert-message notice' }, notes.map(function(n) {
				return E('p', {}, [ n ]);
			})));
		}

		if (warnings.length) {
			out.push(E('div', { 'class': 'alert-message warning' }, warnings.map(function(w) {
				return E('p', {}, [ w ]);
			})));
		}

		this.statusGroups(st).forEach(function(g) {
			out.push(E('h3', {}, [ g[0] ]));
			out.push(self.renderTable(g[1]));
		});

		return E('div', {}, out);
	},

	load: function() {
		return common.getStatus();
	},

	render: function(st) {
		var self = this;
		var banner = E('div', { 'id': 'apmond-banner' }, [ common.collectorBanner(st) ]);
		var box = E('div', { 'id': 'apmond-status' }, [ this.renderStatus(st) ]);

		poll.add(function() {
			return common.getStatus().then(function(s) {
				dom.content(banner, common.collectorBanner(s));
				dom.content(box, self.renderStatus(s));
			});
		}, 10);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('ApmonD Status') ]),
			E('div', { 'class': 'cbi-map-descr' }, [ _('The status of apmond on this node, refreshed every 10 seconds.') ]),
			banner,
			box,
			common.footer()
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
