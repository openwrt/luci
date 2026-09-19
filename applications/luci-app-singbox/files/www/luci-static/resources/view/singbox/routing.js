'use strict';
// routing.js — routing rules CRUD + preset catalogue + final-outbound selector.
// Rule types: geosite (auto .srs), ip_cidr, domain. Actions: auto / direct /
// block. The Presets button opens a modal with a curated GeoSite list and
// bulk-adds the selected ones (skipping duplicates by match value).

'require view';
'require form';
'require fs';
'require ui';
'require uci';

var PRESETS = [
	{ tag: 'geosite-youtube', name: 'YouTube' },
	{ tag: 'geosite-google', name: 'Google (Search, Gmail, Drive, Play Store)' },
	{ tag: 'geosite-instagram', name: 'Instagram' },
	{ tag: 'geosite-twitter', name: 'Twitter/X' },
	{ tag: 'geosite-facebook', name: 'Facebook' },
	{ tag: 'geosite-telegram', name: 'Telegram (domains)' },
	{ tag: 'geosite-openai', name: 'OpenAI / ChatGPT' },
	{ tag: 'geosite-soundcloud', name: 'SoundCloud' },
	{ tag: 'geosite-spotify', name: 'Spotify' },
	{ tag: 'geosite-discord', name: 'Discord' },
	{ tag: 'geosite-twitch', name: 'Twitch' },
	{ tag: 'geosite-netflix', name: 'Netflix' },
	{ tag: 'geosite-github', name: 'GitHub' },
	{ tag: 'geosite-microsoft', name: 'Microsoft' },
	{ tag: 'geosite-apple', name: 'Apple' },
	{ tag: 'geosite-amazon', name: 'Amazon' },
	{ tag: 'geosite-whatsapp', name: 'WhatsApp' },
	{ tag: 'geosite-category-ads-all', name: 'Ad Block (block all ads)', action: 'block' }
];

return view.extend({
	load: function() {
		return uci.load('singbox');
	},

	render: function() {
		var m = new form.Map('singbox', _('Routing Rules'), _('Configure which traffic goes through VPN, which is blocked, and which goes direct.'));
		this.map = m;

		var s = m.section(form.GridSection, 'rule', _('Routing Rules'));
		s.addremove = true;
		s.sortable = true;
		s.anonymous = true;
		s.addbtntitle = _('Add Rule (manual)');
		s.actionstitle = ' ';
		// Override the default "add" handler with a chooser modal that asks the
		// user what kind of rule to create — GeoSite preset, GeoSite by tag,
		// IP CIDR or custom domain — before dropping them into the grid.
		s.handleAdd = function(ev) {
			ui.showModal(_('Add Routing Rule'), [
				E('div', { class: 'cbi-section' }, [
					E('h4', {}, _('Quick add — GeoSite presets')),
					E('div', { id: 'preset-list', style: 'max-height:240px;overflow-y:auto;margin:8px 0;' },
						PRESETS.map(function(preset, i) {
							return E('div', { style: 'padding:4px 0;' }, [
								E('label', {}, [
									E('input', {
										type: 'checkbox',
										value: preset.tag,
										class: 'preset-cb',
										id: 'preset-' + i,
										style: 'margin-right:8px;vertical-align:middle;'
									}),
									E('span', { style: 'font-weight:bold;vertical-align:middle;' }, preset.name),
									E('span', { style: 'color:#888;font-size:11px;margin-left:8px;' }, preset.tag),
									preset.action ? E('span', { style: 'color:#f44336;font-size:11px;margin-left:6px;' }, '(block)') : null
								])
							]);
						})
					),
					E('hr', { style: 'margin:12px 0;' }),
					E('h4', {}, _('Custom rule')),
					E('div', { style: 'display:grid;grid-template-columns:max-content 1fr;gap:6px 10px;margin:8px 0;' }, [
						E('label', { style: 'line-height:30px;' }, _('Name')),
						E('input', { type: 'text', id: 'custom-name', placeholder: 'My rule', style: 'width:100%;' }),
						E('label', { style: 'line-height:30px;' }, _('Type')),
						E('select', { id: 'custom-type', style: 'width:100%;' }, [
							E('option', { value: 'geosite' }, _('GeoSite (e.g. geosite-netflix)')),
							E('option', { value: 'ip_cidr' }, _('IP CIDR (e.g. 91.108.0.0/16 149.154.160.0/20)')),
						E('option', { value: 'domain' }, _('Domain (e.g. example.com .blocked.org)'))
						]),
						E('label', { style: 'line-height:30px;' }, _('Match')),
						E('input', { type: 'text', id: 'custom-match', placeholder: 'geosite-netflix / 91.108.0.0/16 / example.com', style: 'width:100%;' }),
						E('label', { style: 'line-height:30px;' }, _('Action')),
						E('select', { id: 'custom-outbound', style: 'width:100%;' }, [
							E('option', { value: 'auto' }, _('VPN')),
							E('option', { value: 'direct' }, _('Direct')),
							E('option', { value: 'block' }, _('Block'))
						])
					])
				]),
				E('div', { class: 'right' }, [
					E('button', { class: 'btn', click: function() { ui.hideModal(); } }, _('Cancel')),
					E('button', {
						class: 'btn cbi-button-positive',
						click: function() {
							var added = 0;
							// Presets
							PRESETS.forEach(function(preset, i) {
								var cb = document.getElementById('preset-' + i);
								if (cb && cb.checked) {
									var exists = uci.sections('singbox', 'rule').some(function(r) {
										return r.match === preset.tag;
									});
									if (!exists) {
										var sid = uci.add('singbox', 'rule');
										uci.set('singbox', sid, 'name', preset.name);
										uci.set('singbox', sid, 'enabled', '1');
										uci.set('singbox', sid, 'type', 'geosite');
										uci.set('singbox', sid, 'match', preset.tag);
										uci.set('singbox', sid, 'outbound', preset.action || 'auto');
										added++;
									}
								}
							});
							// Custom rule
							var cname = document.getElementById('custom-name').value.trim();
							var ctype = document.getElementById('custom-type').value;
							var cmatch = document.getElementById('custom-match').value.trim();
							var coutbound = document.getElementById('custom-outbound').value;
							if (cmatch) {
								if (!cname) cname = cmatch;
								var sid = uci.add('singbox', 'rule');
								uci.set('singbox', sid, 'name', cname);
								uci.set('singbox', sid, 'enabled', '1');
								uci.set('singbox', sid, 'type', ctype);
								uci.set('singbox', sid, 'match', cmatch);
								uci.set('singbox', sid, 'outbound', coutbound);
								added++;
							}
							ui.hideModal();
							if (added > 0) {
								uci.save();
								uci.apply().then(function() { location.reload(); });
							}
						}
					}, _('Add Selected / Custom'))
				])
			]);
		};

		var o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.editable = true;
		o.modalonly = false;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.modalonly = false;

		o = s.option(form.ListValue, 'type', _('Type'));
		o.value('geosite', _('GeoSite (auto-updated domain list)'));
		o.value('ip_cidr', _('IP CIDR (manual IP ranges)'));
		o.value('domain', _('Domain (custom domains)'));
		o.default = 'geosite';
		o.rmempty = false;
		o.modalonly = false;
		o.editable = true;

		o = s.option(form.Value, 'match', _('Match'));
		o.placeholder = _('geosite-youtube / 91.108.0.0/16 / .youtube.com');
		o.rmempty = false;
		o.modalonly = false;

		o = s.option(form.ListValue, 'outbound', _('Action'));
		o.value('auto', _('VPN'));
		o.value('direct', _('Direct'));
		o.value('block', _('Block'));
		o.default = 'auto';
		o.rmempty = false;
		o.modalonly = false;
		o.editable = true;

		s = m.section(form.NamedSection, 'general', 'general', _('Default Action'));
		o = s.option(form.ListValue, 'final_outbound', _('Default (final)'));
		o.value('direct', _('Direct — recommended'));
		o.value('auto', _('VPN — all traffic through VPN'));
		o.value('block', _('Block — drop all unmatched'));
		o.default = 'direct';

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
			ui.addNotification(null, E('p', _('Routing rules applied')));
		}).catch(function(err) {
			ui.addNotification(null, E('p', { style: 'color:#f44336;' }, _('Error: %s').format(err.message || err)));
		});
	}
});
