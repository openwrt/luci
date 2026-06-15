'use strict';
// servers.js — CRUD for VLESS+REALITY servers plus subscription import.
// Grid section shows name / address / port / live status; Test button
// probes latency via status.sh "test <name>". Import button calls
// update-subscription.sh with the URL field, then reloads on success.

'require view';
'require form';
'require fs';
'require ui';
'require uci';
'require dom';

return view.extend({
	load: function() {
		return uci.load('singbox');
	},

	render: function() {
		var sections = uci.sections('singbox', 'server');
		var m, s, o;

		m = new form.Map('singbox', _('VPN Servers'), _('Manage VLESS+REALITY proxy servers'));
		this.map = m;

		s = m.section(form.GridSection, 'server', _('Servers'));
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add Server');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.modalonly = false;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.placeholder = 'my-server';
		o.rmempty = false;
		o.datatype = 'and(uciname,maxlength(32))';

		o = s.option(form.Value, 'server', _('Address'));
		o.placeholder = '0.0.0.0';
		o.datatype = 'host';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Port'));
		o.placeholder = '443';
		o.datatype = 'port';
		o.default = '443';
		o.rmempty = false;

		o = s.option(form.Value, 'uuid', _('UUID'));
		o.rmempty = false;
		o.password = true;

		o = s.option(form.ListValue, 'flow', _('Flow'));
		o.value('xtls-rprx-vision', 'xtls-rprx-vision');
		o.value('', _('None'));
		o.default = 'xtls-rprx-vision';
		o.modalonly = true;

		o = s.option(form.Value, 'sni', _('SNI'));
		o.placeholder = 'example.com';
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.ListValue, 'utls_fingerprint', _('uTLS Fingerprint'));
		o.value('chrome', 'Chrome');
		o.value('firefox', 'Firefox');
		o.value('safari', 'Safari');
		o.value('edge', 'Edge');
		o.default = 'chrome';
		o.modalonly = true;

		o = s.option(form.Value, 'reality_public_key', _('REALITY Public Key'));
		o.rmempty = false;
		o.password = true;
		o.modalonly = true;

		o = s.option(form.Value, 'reality_short_id', _('REALITY Short ID'));
		o.rmempty = false;
		o.modalonly = true;

		// Live status column. textvalue() is the GridSection hook for inline
		// cell content; it may return a DOM node. The actual latency probe
		// happens on Test-button click and rewrites this cell in place.
		o = s.option(form.DummyValue, '_status', _('Status'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var name = uci.get('singbox', section_id, 'name') || section_id;
			return E('span', {
				id: 'srv-status-' + section_id,
				class: 'srv-status-cell',
				'data-server-name': name
			}, '—');
		};

		// Per-row latency probe. editable=true makes GridSection render the
		// actual button instead of falling back to the option default value.
		o = s.option(form.Button, '_test', _('Test'));
		o.modalonly = false;
		o.editable = true;
		o.inputstyle = 'action';
		o.inputtitle = _('Test');
		o.onclick = function(ev, section_id) {
			var name = uci.get('singbox', section_id, 'name') || section_id;
			var cell = document.getElementById('srv-status-' + section_id);
			if (cell) cell.textContent = '...';
			fs.exec('/usr/share/singbox/status.sh', ['127.0.0.1:9090', 'test', name]).then(function(res) {
				var data = {};
				try { data = JSON.parse(res.stdout || res.output || '{}'); } catch(e) {}
				if (cell) {
					if (data.status === 'online') {
						cell.innerHTML = '✅ ' + data.latency + 'ms';
						cell.style.color = '#4caf50';
					} else {
						cell.innerHTML = '❌ Offline';
						cell.style.color = '#f44336';
					}
				}
			});
			return false;
		};

		// Subscription section. The shipped config has an anonymous
		// `config subscription` block — NamedSection can't address it by name,
		// so use TypedSection which matches any section of this type.
		s = m.section(form.TypedSection, 'subscription', _('Import Subscription'));
		s.anonymous = true;

		o = s.option(form.Value, 'url', _('Subscription URL'));
		o.placeholder = 'http://example.com/sub';
		o.datatype = 'url';

		o = s.option(form.Button, '_import', ' ');
		o.inputtitle = _('Import Servers');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var url = document.querySelector('input[id$="\\.url"]')?.value || uci.get('singbox', 'subscription', 'url') || '';
			if (!url) {
				ui.addNotification(null, E('p', _('Please enter subscription URL first')));
				return false;
			}
			ui.showModal(_('Importing'), [ E('p', { class: 'spinning' }, _('Fetching subscription...')) ]);
			fs.exec('/usr/share/singbox/update-subscription.sh', [url]).then(function(res) {
				ui.hideModal();
				var data = {};
				try { data = JSON.parse(res.stdout || res.output || '{}'); } catch(e) {}
				if (data.success && data.imported > 0) {
					ui.addNotification(null, E('p', _('Imported %d server(s): %s').format(data.imported, data.servers || '')));
					setTimeout(function() { location.reload(); }, 2000);
				} else if (data.success) {
					ui.addNotification(null, E('p', _('No new servers to import')));
				} else {
					ui.addNotification(null, E('p', _('Import failed: %s').format(data.error || res.stderr || 'Unknown error')));
				}
			});
			return false;
		};

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		var map = this.map;
		return map.save.apply(map, mode ? [false, true] : []).then(function() {
			return fs.exec('/usr/share/singbox/generate-config.sh');
		}).then(function(res) {
			if (res.code !== 0) {
				throw new Error(res.stdout || res.stderr || 'Config validation failed');
			}
			return fs.exec('/etc/init.d/sing-box', ['restart']);
		}).then(function() {
			ui.addNotification(null, E('p', _('Configuration applied and sing-box restarted')));
		}).catch(function(err) {
			ui.addNotification(null, E('p', { style: 'color:#f44336;' }, _('Error: %s').format(err.message || err)));
		});
	}
});
