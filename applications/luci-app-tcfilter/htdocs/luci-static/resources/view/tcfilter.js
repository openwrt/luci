'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require poll';
'require dom';
'require tools.widgets as widgets';

function tcExec(args) {
	return fs.exec('/sbin/tc', args).then(function(res) {
		return (res && res.stdout) ? res.stdout : '';
	}).catch(function() {
		return '';
	});
}

function prettyProto(p) {
	var m = String(p == null ? '' : p).match(/^\[(\d+)\]$/);
	if (m)
		return '0x' + Number(m[1]).toString(16);
	return p || 'all';
}

function parseFilters(txt) {
	var arr;
	try { arr = JSON.parse(txt); } catch (e) { return null; }
	if (!Array.isArray(arr)) return [];

	return arr.filter(function(f) {
		return f && f.options && f.options.handle != null;
	}).map(function(f) {
		var o = f.options || {};
		var keys = o.keys || {};
		var match = Object.keys(keys).map(function(k) {
			return k + '=' + keys[k];
		}).join(' ');
		var act = (o.actions && o.actions[0]) || {};
		var st = act.stats || {};
		/* st.packets is the honest total; for a fully offloaded rule it
		 * equals hw_packets. Whether it is HW-accelerated is shown separately. */
		var pkts = st.packets;

		return {
			pref: f.pref,
			proto: prettyProto(f.protocol),
			kind: f.kind,
			match: match || '—',
			offload: o.skip_sw ? 'skip_sw' : (o.skip_hw ? 'skip_hw' : ''),
			in_hw: !!o.in_hw,
			action: (act.control_action && act.control_action.type) || act.kind || '—',
			packets: (pkts != null) ? pkts : null
		};
	});
}

return view.extend({
	load: function() {
		return uci.load('tcfilter');
	},

	pollStatus: function(node) {
		var devs = [], labels = {};
		(uci.sections('tcfilter', 'rule') || []).forEach(function(s) {
			if (s.device && devs.indexOf(s.device) < 0)
				devs.push(s.device);
			if (s.device && s.pref)
				labels[s.device + '|' + s.pref] = s.label || '';
		});

		if (!devs.length) {
			dom.content(node, E('em', {}, _('No rules configured yet.')));
			return Promise.resolve();
		}

		return Promise.all(devs.map(function(dev) {
			return tcExec([ '-s', '-j', 'filter', 'show', 'dev', dev, 'ingress' ]).then(function(txt) {
				return { dev: dev, rows: parseFilters(txt) };
			});
		})).then(function(results) {
			var tbl = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Device')),
					E('th', { 'class': 'th' }, _('Pref')),
					E('th', { 'class': 'th' }, _('Protocol')),
					E('th', { 'class': 'th' }, _('Match')),
					E('th', { 'class': 'th' }, _('Offload')),
					E('th', { 'class': 'th' }, _('In HW')),
					E('th', { 'class': 'th' }, _('Action')),
					E('th', { 'class': 'th' }, _('Packets')),
					E('th', { 'class': 'th' }, _('Label'))
				])
			]);

			var any = false;
			results.forEach(function(r) {
				if (r.rows == null) {
					tbl.appendChild(E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'colspan': '9' },
							E('em', {}, [ _('%s: could not read tc output').format(r.dev) ]))
					]));
					return;
				}
				if (!r.rows.length) {
					tbl.appendChild(E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, [ r.dev ]),
						E('td', { 'class': 'td', 'colspan': '8' },
							E('em', {}, [ _('no ingress filters') ]))
					]));
					return;
				}
				r.rows.forEach(function(row) {
					any = true;
					tbl.appendChild(E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, [ r.dev ]),
						E('td', { 'class': 'td' }, [ String(row.pref) ]),
						E('td', { 'class': 'td' }, [ row.proto ]),
						E('td', { 'class': 'td' }, [ row.match ]),
						E('td', { 'class': 'td' }, [ row.offload || '—' ]),
						E('td', { 'class': 'td' }, E('span', {
							'class': row.in_hw ? 'tcf-in-hw' : 'tcf-not-hw'
						}, [ row.in_hw ? '✔' : '✗' ])),
						E('td', { 'class': 'td' }, [ row.action ]),
						E('td', { 'class': 'td' }, [ (row.packets != null) ? String(row.packets) : '—' ]),
						E('td', { 'class': 'td' }, [ labels[r.dev + '|' + row.pref] || '—' ])
					]));
				});
			});

			dom.content(node, tbl);
			return any;
		});
	},

	render: function() {
		var m, s, o;

		m = new form.Map('tcfilter', _('TC Filters'),
			_('Persistent <code>tc filter … ingress</code> rules. The match and action part is entered ' +
			  'verbatim as <code>tc</code> syntax; this page only manages the device, the preference number, ' +
			  'the enable state and persistence across reboots. Meant for the hardware tc-flower (PIE) offload.'));

		s = m.section(form.NamedSection, 'global', 'tcfilter', _('Global'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Master switch. While off, a reload removes every managed filter.'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.GridSection, 'rule', _('Rules'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = false;   // section order is irrelevant - tc orders by pref
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('On'));
		o.default = '1';
		o.editable = true;

		o = s.option(widgets.DeviceSelect, 'device', _('Device'));
		o.rmempty = false;

		o = s.option(form.Value, 'pref', _('Pref'),
			_('Preference number, 1–65535. Required. Lower is matched first; it is also how the ' +
			  'rule is removed again. (The Realtek PIE offload does not use it as a hardware priority.)'));
		o.datatype = 'range(1, 65535)';
		o.rmempty = false;
		o.placeholder = '49152';

		o = s.option(form.Value, 'spec', _('Spec'),
			_('Everything after <code>ingress pref N</code>. Use <code>skip_sw</code> so a match the ' +
			  'hardware cannot offload fails visibly instead of installing in software.'));
		o.rmempty = false;
		o.width = '40%';
		o.placeholder = 'protocol 0x88e1 flower skip_sw action drop';
		o.validate = function(section_id, value) {
			if (value && !/\bflower\b|\bmatchall\b|\bu32\b|\bbasic\b/.test(value))
				return _('Should contain a filter kind such as "flower".');
			return true;
		};

		o = s.option(form.Value, 'label', _('Label'),
			_('Optional, for your reference only. Shown in the status table and the log.'));
		o.rmempty = true;
		o.placeholder = 'Drop-HomePlug-AV (FRITZ!Box)';
		o.width = '20%';

		var statusNode = E('div', {}, E('p', { 'class': 'spinning' }, _('Collecting data…')));
		poll.add(L.bind(this.pollStatus, this, statusNode), 5);

		return Promise.all([ m.render(), this.pollStatus(statusNode) ]).then(function(rendered) {
			return E([], [
				E('style', {}, '.tcf-in-hw{color:#2e7d32;font-weight:bold}.tcf-not-hw{color:#c62828}'),
				E('div', { 'class': 'cbi-section', 'id': 'tcf-status' }, [
					E('h3', {}, _('Hardware status')),
					E('div', { 'class': 'cbi-section-descr' },
						_('Live view of the ingress filters on every device that has a rule. Refreshes every 5 s.')),
					statusNode
				]),
				rendered[0]
			]);
		});
	}
});

