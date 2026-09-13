'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';

var VERSION = '2.2.0';
var fmt = function(s) {
	var args = Array.prototype.slice.call(arguments, 1);
	var i = 0;
	return String(s).replace(/%s/g, function() { return (i < args.length) ? args[i++] : ''; });
};
var CONTINENTS = [
	['asia', [
		['af', _('AFGHANISTAN')], ['am', _('ARMENIA')], ['az', _('AZERBAIJAN')],
		['bd', _('BANGLADESH')], ['bh', _('BAHRAIN')], ['bn', _('BRUNEI')],
		['bt', _('BHUTAN')], ['cn', _('CHINA')], ['cy', _('CYPRUS')],
		['ge', _('GEORGIA')], ['hk', _('HONG KONG')], ['id', _('INDONESIA')],
		['il', _('ISRAEL')], ['in', _('INDIA')], ['iq', _('IRAQ')],
		['ir', _('IRAN')], ['jo', _('JORDAN')], ['jp', _('JAPAN')],
		['kg', _('KYRGYZSTAN')], ['kh', _('CAMBODIA')], ['kp', _('NORTH KOREA')],
		['kr', _('SOUTH KOREA')], ['kw', _('KUWAIT')], ['kz', _('KAZAKHSTAN')],
		['la', _('LAOS')], ['lb', _('LEBANON')], ['lk', _('SRI LANKA')],
		['mm', _('MYANMAR')], ['mn', _('MONGOLIA')], ['mo', _('MACAO')],
		['my', _('MALAYSIA')], ['np', _('NEPAL')], ['om', _('OMAN')],
		['ph', _('PHILIPPINES')], ['pk', _('PAKISTAN')], ['ps', _('PALESTINE')],
		['qa', _('QATAR')], ['sa', _('SAUDI ARABIA')], ['sg', _('SINGAPORE')],
		['sy', _('SYRIA')], ['th', _('THAILAND')], ['tj', _('TAJIKISTAN')],
		['tl', _('TIMOR-LESTE')], ['tm', _('TURKMENISTAN')], ['tr', _('TURKEY')],
		['tw', _('TAIWAN')], ['uz', _('UZBEKISTAN')], ['vn', _('VIETNAM')],
		['ye', _('YEMEN')]
	]],
	['europe', [
		['ad', _('ANDORRA')], ['al', _('ALBANIA')], ['at', _('AUSTRIA')],
		['ax', _('ALAND ISLANDS')], ['ba', _('BOSNIA AND HERZEGOVINA')], ['be', _('BELGIUM')],
		['bg', _('BULGARIA')], ['by', _('BELARUS')], ['ch', _('SWITZERLAND')],
		['cz', _('CZECHIA')], ['de', _('GERMANY')], ['dk', _('DENMARK')],
		['ee', _('ESTONIA')], ['es', _('SPAIN')], ['fi', _('FINLAND')],
		['fo', _('FAROE ISLANDS')], ['fr', _('FRANCE')], ['gb', _('UNITED KINGDOM')],
		['gg', _('GUERNSEY')], ['gi', _('GIBRALTAR')], ['gr', _('GREECE')],
		['hr', _('CROATIA')], ['hu', _('HUNGARY')], ['ie', _('IRELAND')],
		['im', _('ISLE OF MAN')], ['is', _('ICELAND')], ['it', _('ITALY')],
		['je', _('JERSEY')], ['li', _('LIECHTENSTEIN')], ['lt', _('LITHUANIA')],
		['lu', _('LUXEMBOURG')], ['lv', _('LATVIA')], ['mc', _('MONACO')],
		['md', _('MOLDOVA')], ['me', _('MONTENEGRO')], ['mk', _('NORTH MACEDONIA')],
		['mt', _('MALTA')], ['nl', _('NETHERLANDS')], ['no', _('NORWAY')],
		['pl', _('POLAND')], ['pt', _('PORTUGAL')], ['ro', _('ROMANIA')],
		['rs', _('SERBIA')], ['ru', _('RUSSIA')], ['se', _('SWEDEN')],
		['si', _('SLOVENIA')], ['sk', _('SLOVAKIA')], ['sm', _('SAN MARINO')],
		['ua', _('UKRAINE')], ['va', _('VATICAN CITY')]
	]],
	['africa', [
		['dz', _('ALGERIA')], ['ao', _('ANGOLA')], ['bj', _('BENIN')],
		['bw', _('BOTSWANA')], ['bf', _('BURKINA FASO')], ['bi', _('BURUNDI')],
		['cm', _('CAMEROON')], ['cv', _('CABO VERDE')], ['cf', _('CENTRAL AFRICAN REPUBLIC')],
		['td', _('CHAD')], ['km', _('COMOROS')], ['cg', _('CONGO')],
		['cd', _('DEMOCRATIC REPUBLIC OF THE CONGO')], ['dj', _('DJIBOUTI')], ['eg', _('EGYPT')],
		['gq', _('EQUATORIAL GUINEA')], ['er', _('ERITREA')], ['et', _('ETHIOPIA')],
		['ga', _('GABON')], ['gm', _('GAMBIA')], ['gh', _('GHANA')],
		['gn', _('GUINEA')], ['gw', _('GUINEA-BISSAU')], ['ke', _('KENYA')],
		['lr', _('LIBERIA')], ['ls', _('LESOTHO')], ['ly', _('LIBYA')],
		['ma', _('MOROCCO')], ['mg', _('MADAGASCAR')], ['ml', _('MALI')],
		['mr', _('MAURITANIA')], ['mu', _('MAURITIUS')], ['mw', _('MALAWI')],
		['mz', _('MOZAMBIQUE')], ['na', _('NAMIBIA')], ['ne', _('NIGER')],
		['ng', _('NIGERIA')], ['rw', _('RWANDA')], ['sc', _('SEYCHELLES')],
		['sd', _('SUDAN')], ['sh', _('SAINT HELENA')], ['sl', _('SIERRA LEONE')],
		['sn', _('SENEGAL')], ['so', _('SOMALIA')], ['ss', _('SOUTH SUDAN')],
		['st', _('SAO TOME AND PRINCIPE')], ['sz', _('ESWATINI')], ['tg', _('TOGO')],
		['tn', _('TUNISIA')], ['tz', _('TANZANIA')], ['ug', _('UGANDA')],
		['za', _('SOUTH AFRICA')], ['zm', _('ZAMBIA')], ['zw', _('ZIMBABWE')]
	]],
	['northamerica', [
		['ag', _('ANTIGUA AND BARBUDA')], ['ai', _('ANGUILLA')], ['bs', _('BAHAMAS')],
		['bb', _('BARBADOS')], ['bz', _('BELIZE')], ['bm', _('BERMUDA')],
		['ca', _('CANADA')], ['cr', _('COSTA RICA')], ['cu', _('CUBA')],
		['dm', _('DOMINICA')], ['do', _('DOMINICAN REPUBLIC')], ['sv', _('EL SALVADOR')],
		['gd', _('GRENADA')], ['gl', _('GREENLAND')], ['gt', _('GUATEMALA')],
		['ht', _('HAITI')], ['hn', _('HONDURAS')], ['jm', _('JAMAICA')],
		['ky', _('CAYMAN ISLANDS')], ['mx', _('MEXICO')], ['ms', _('MONTSERRAT')],
		['ni', _('NICARAGUA')], ['pa', _('PANAMA')], ['pm', _('SAINT PIERRE AND MIQUELON')],
		['pr', _('PUERTO RICO')], ['tt', _('TRINIDAD AND TOBAGO')], ['us', _('UNITED STATES')],
		['vg', _('VIRGIN ISLANDS (BRITISH)')], ['vi', _('VIRGIN ISLANDS (US)')]
	]],
	['southamerica', [
		['ar', _('ARGENTINA')], ['bo', _('BOLIVIA')], ['br', _('BRAZIL')],
		['cl', _('CHILE')], ['co', _('COLOMBIA')], ['ec', _('ECUADOR')],
		['fk', _('FALKLAND ISLANDS')], ['gy', _('GUYANA')], ['py', _('PARAGUAY')],
		['pe', _('PERU')], ['sr', _('SURINAME')], ['uy', _('URUGUAY')],
		['ve', _('VENEZUELA')]
	]],
	['oceania', [
		['as', _('AMERICAN SAMOA')], ['au', _('AUSTRALIA')], ['ck', _('COOK ISLANDS')],
		['fj', _('FIJI')], ['fm', _('MICRONESIA')], ['gu', _('GUAM')],
		['ki', _('KIRIBATI')], ['mh', _('MARSHALL ISLANDS')], ['nc', _('NEW CALEDONIA')],
		['nr', _('NAURU')], ['nu', _('NIUE')], ['nz', _('NEW ZEALAND')],
		['pf', _('FRENCH POLYNESIA')], ['pg', _('PAPUA NEW GUINEA')], ['pw', _('PALAU')],
		['sb', _('SOLOMON ISLANDS')], ['tk', _('TOKELAU')], ['to', _('TONGA')],
		['tv', _('TUVALU')], ['vu', _('VANUATU')], ['wf', _('WALLIS AND FUTUNA')],
		['ws', _('SAMOA')]
	]]
];

var countryState = {};
var wlState = [];
/* dirty guards: render rebuilds state from uci (clean); only real UI
   interaction marks dirty. pushCountries never deletes selected/whitelist
   unless the user actually touched them (unrendered-save data-loss class). */
var countryDirty = false;
var wlDirty = false;
var banDirty = false;
var schedDirty = false;
var nameDirty = false;
var countsDiv = null;
var schedState = { freq: 'weekly', hour: '6', min: '0', auto: '1' };
var nameState = { set: 'allowed-IPList', white: 'CustomAllow' };
var OLD_GROUPS = ['asia', 'europe', 'africa', 'northamerica', 'southamerica', 'oceania'];

function wlCheck(v) {
	v = (v || '').trim();
	var oct = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
	var ip = '(' + oct + '\\.){3}' + oct;
	var re = new RegExp('^' + ip + '(/([1-9]|[12][0-9]|3[0-2]))?$|^' + ip + '-' + ip + '$');
	if (!re.test(v))
		return _('Invalid format: enter a single IP (e.g. 203.0.113.10), CIDR (e.g. 203.0.113.0/24) or range (e.g. 203.0.113.10-203.0.113.50)');
	return true;
}

function pushCountries() {
	var sel = Object.keys(countryState);
	if (countryDirty) {
		if (sel.length > 0)
			uci.set('geoguard', 'main', 'selected', sel);
		else
			uci.unset('geoguard', 'main', 'selected');
	}
	var i;
	for (i = 0; i < OLD_GROUPS.length; i++)
		uci.unset('geoguard', 'main', 'sel_' + OLD_GROUPS[i]);
	if (schedDirty) {
		uci.set('geoguard', 'main', 'update_freq', schedState.freq);
		uci.set('geoguard', 'main', 'update_hour', schedState.hour);
		uci.set('geoguard', 'main', 'update_min', schedState.min);
		uci.set('geoguard', 'main', 'auto_update', schedState.auto);
	}
	if (nameDirty) {
		uci.set('geoguard', 'main', 'setname', nameState.set || 'allowed-IPList');
		uci.set('geoguard', 'main', 'white_name', nameState.white || 'CustomAllow');
	}
	if (wlDirty) {
		if (wlState.length > 0)
			uci.set('geoguard', 'main', 'whitelist', wlState.slice());
		else
			uci.unset('geoguard', 'main', 'whitelist');
	}
	return uci.save();
}

function checkSetname() {
	var sn = uci.get('geoguard', 'main', 'setname') || '';
	var wn = uci.get('geoguard', 'main', 'white_name') || 'CustomAllow';
	var ok = function(v) { return /^[A-Za-z][A-Za-z0-9_-]*$/.test(v); };
	return ok(sn) && ok(wn);
}


return view.extend({
	handleSaveApply: null,
	handleReset: null,

	load: function() {
		return Promise.all([
			uci.load('geoguard'),
			fs.exec('/usr/bin/geoguard-status').then(function(res) {
				return (res.code === 0 && res.stdout) ? res.stdout : _('Status script failed');
			}).catch(function(e) {
				return fmt(_('Status script failed: %s'), e.message);
			}),
			fs.exec('/usr/bin/geoguard-counts').then(function(res) {
				return (res.code === 0 && res.stdout) ? res.stdout.trim() : '';
			}).catch(function() {
				return '';
			}),
			fs.exec('/usr/bin/geoguard-ban-status').then(function(res) {
				return (res.code === 0 && res.stdout) ? res.stdout : '';
			}).catch(function() {
				return '';
			})
		]);
	},

	render: function(data) {
		var m, s, o;
		var logText = data[1] || '';
		var countsText = data[2] || '';
		var banText = data[3] || '';
		var banPre = null;

		var countsLine = function() {
			var p = (countsText || '').split(/\s+/);
			if (p.length < 4 || !p[0])
				return _('Latest merged IP set file: no data yet');
			var fdate = (p[3] || '').replace('_', ' ');
			var cdate = (p[4] || '').replace('_', ' ');
			if (cdate && cdate !== fdate)
				return fmt(_('Latest merged IP set file: /etc/geoguard/%s.cidr (%s lines / live %s entries / updated %s, checked %s — no changes)'), p[0], p[1], p[2], fdate, cdate);
			return fmt(_('Latest merged IP set file: /etc/geoguard/%s.cidr (%s lines / live %s entries / updated %s)'), p[0], p[1], p[2], fdate);
		};

		var refreshCounts = function() {
			return fs.exec('/usr/bin/geoguard-counts').then(function(res) {
				if (res.code !== 0 || !res.stdout)
					return;
				countsText = res.stdout.trim();
				if (countsDiv) {
					while (countsDiv.firstChild)
						countsDiv.removeChild(countsDiv.firstChild);
					countsDiv.appendChild(E('span', {}, [countsLine()]));
				}
			}).catch(function() {});
		};

		m = new form.Map('geoguard', _('GeoGuard Ver:') + VERSION,
			_('Select countries + whitelist IPs into merged IP set files. This page only builds IP sets; apply them yourself under Firewall - Port Forwards by picking the set in a rule.'));

		/* counts line lives in its own top section so it renders
		   between the subtitle and the tab menu (mockup layout) */
		var sTop = m.section(form.NamedSection, 'main');
		sTop.option(form.DummyValue, '_topcounts').render = function(section_id) {
			countsDiv = E('div', { 'class': 'country-counts', 'style': 'margin:0.5em 0;font-weight:bold;color:#0a7b1e' }, [countsLine()]);
			return countsDiv;
		};

		s = m.section(form.TypedSection, 'geoguard', _('Settings'));
		s.anonymous = true;
		s.tab('ban', _('Login Guard'));
		s.tab('settings', _('IP Sets'));
		s.tab('log', _('Log'));

		o = s.taboption('settings', form.DummyValue, '_countries');
		o.render = function(section_id) {
			var cur = uci.get('geoguard', 'main', 'selected') || [];
			var i, j;
			countryState = {};
			countryDirty = false;
			(function() {
				var old = ['sel_asia', 'sel_europe', 'sel_africa', 'sel_northamerica', 'sel_southamerica', 'sel_oceania'];
				for (var k = 0; k < old.length; k++) {
					var v = uci.get('geoguard', 'main', old[k]) || [];
					for (var n = 0; n < v.length; n++)
						if (cur.indexOf(v[n]) < 0)
							cur.push(v[n]);
				}
			})();
			cur.forEach(function(v) { countryState[v] = true; });

			var rows = [];
			var tbody = E('tbody', {});
			var selLine = E('div', { 'class': 'country-selected', 'style': 'flex:1;word-break:break-all' }, []);
			var refreshSel = function() {
				var arr = Object.keys(countryState).sort();
				while (selLine.firstChild)
					selLine.removeChild(selLine.firstChild);
				selLine.appendChild(E('strong', {}, [_('Selected:')]));
				selLine.appendChild(E('span', {}, [' ' + (arr.length > 0 ? arr.join(',').toUpperCase() : _('(none selected)'))]));
			};
			for (i = 0; i < CONTINENTS.length; i++) {
				for (j = 0; j < CONTINENTS[i][1].length; j++) {
					(function(cc) {
						var cb = E('input', { 'type': 'checkbox', 'value': cc[0] });
						if (countryState[cc[0]])
							cb.checked = true;
					cb.addEventListener('change', function() {
						countryDirty = true;
						if (cb.checked)
							countryState[cc[0]] = true;
						else
							delete countryState[cc[0]];
						refreshSel();
					});
						var tr = E('tr', {}, [
							E('td', {}, [cb]),
							E('td', {}, [cc[0].toUpperCase()]),
							E('td', {}, [cc[1]])
						]);
						rows.push({ cc: cc[0], text: (cc[0] + ' ' + cc[1]).toUpperCase(), el: tr, cb: cb });
						tbody.appendChild(tr);
					})(CONTINENTS[i][1][j]);
				}
			}
			rows.sort(function(a, b) { return a.cc < b.cc ? -1 : (a.cc > b.cc ? 1 : 0); });
			rows.forEach(function(r) { tbody.appendChild(r.el); });

			var allCb = E('input', { 'type': 'checkbox' });
			allCb.addEventListener('change', function() {
				countryDirty = true;
				rows.forEach(function(r) {
					if (r.el.style.display === 'none')
						return;
					r.cb.checked = allCb.checked ? true : false;
					if (allCb.checked)
						countryState[r.cc] = true;
					else
						delete countryState[r.cc];
				});
				refreshSel();
			});

			var input = E('input', { 'type': 'text', 'placeholder': _('Search, e.g. TW or TAIWAN'), 'class': 'country-search' });
			input.addEventListener('input', function() {
				var q = (input.value || '').toUpperCase();
				rows.forEach(function(r) {
					r.el.style.display = (q === '' || r.text.indexOf(q) >= 0) ? '' : 'none';
				});
			});
			var clearBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral' }, [_('Clear')]);
			clearBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				input.value = '';
				rows.forEach(function(r) { r.el.style.display = ''; });
			});

			var selAllBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'style': 'margin-right:0.5em' }, [_('Select all')]);
			selAllBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				rows.forEach(function(r) {
					if (r.el.style.display === 'none')
						return;
					r.cb.checked = true;
					countryState[r.cc] = true;
				});
				refreshSel();
			});
			var selNoneBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral' }, [_('Clear selected')]);
			selNoneBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				rows.forEach(function(r) {
					r.cb.checked = false;
					delete countryState[r.cc];
				});
				refreshSel();
			});

			var table = E('table', { 'class': 'table cbi-section-table', 'style': 'width:100%' }, [
				E('thead', { 'style': 'position:sticky;top:0;background-color:#f0f0f0' }, [
					E('tr', {}, [
						E('th', { 'style': 'width:40px' }, [allCb]),
						E('th', { 'style': 'width:90px' }, [_('Code')]),
						E('th', {}, [_('Location')])
					])
				]),
				tbody
			]);
			var wrap = E('div', { 'style': 'max-height:420px;overflow:auto;border:1px solid #ccc' }, [table]);
			var headRow = E('div', { 'style': 'display:flex;align-items:center;gap:0.5em;margin-bottom:0.5em;flex-wrap:wrap' }, [
				E('strong', {}, [_('Select countries')]),
				input, clearBtn,
				E('span', { 'style': 'color:#999' }, [':']),
				selAllBtn, selNoneBtn, selLine
			]);
			input.style.flex = '1';
			refreshSel();
			return E('div', {}, [
				headRow,
				wrap
			]);
		};

		o = s.taboption('settings', form.DummyValue, '_whitelist');
		o.render = function(section_id) {
			var cur = uci.get('geoguard', 'main', 'whitelist') || [];
			if (!Array.isArray(cur))
				cur = [cur];
			wlState = cur.slice();
			wlDirty = false;
			var listBox = E('div', { 'class': 'wl-list' });
			var errLine = E('div', { 'class': 'wl-error', 'style': 'color:#c00;margin-top:0.3em' }, []);
			var drawList = function() {
				while (listBox.firstChild)
					listBox.removeChild(listBox.firstChild);
				wlState.forEach(function(v, idx) {
					var del = E('button', { 'class': 'btn cbi-button cbi-button-neutral' }, [_('Delete')]);
				del.addEventListener('click', function(ev) {
					if (ev && ev.preventDefault)
						ev.preventDefault();
					wlDirty = true;
					wlState.splice(idx, 1);
					drawList();
				});
					listBox.appendChild(E('div', { 'style': 'margin-bottom:0.3em' }, [
						E('span', {}, [v]), E('span', {}, ['  ']), del
					]));
				});
			};
			var setErr = function(msg) {
				while (errLine.firstChild)
					errLine.removeChild(errLine.firstChild);
				if (msg)
					errLine.appendChild(E('span', {}, [msg]));
			};
			var inp = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': _('e.g. 203.0.113.10, 203.0.113.0/24, 203.0.113.10-203.0.113.50'), 'style': 'flex:1;margin-right:0.5em' });
			var addBtn = E('button', { 'class': 'btn cbi-button cbi-button-action' }, [_('Add')]);
			addBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				var v = (inp.value || '').trim();
				var msg = wlCheck(v);
				if (msg !== true) {
					setErr(msg);
					return;
				}
				if (wlState.indexOf(v) < 0)
					wlState.push(v);
				wlDirty = true;
				inp.value = '';
				setErr(null);
				drawList();
			});
			drawList();
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [_('Whitelist beyond countries: IP / CIDR / Range')]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('div', { 'style': 'display:flex;margin-bottom:0.5em' }, [inp, addBtn]),
					listBox, errLine,
					E('div', { 'class': 'cbi-value-description' }, [_('Formats: single IP, CIDR, A-B range. No country + IPs = pure whitelist.')])
				])
			]);
		};

		o = s.taboption('settings', form.Value, 'src_primary', _('IP Geolocation - Primary Feed'));
		o.default = 'https://www.ipdeny.com/ipblocks/data/aggregated/{cc}-aggregated.zone';
		o.rmempty = false;
		o.description = _('{cc} becomes the lowercase code, {CC} uppercase.');
		o = s.taboption('settings', form.Value, 'src_backup', _('IP Geolocation - Backup Feed'));
		o.default = 'https://raw.githubusercontent.com/ipverse/country-ip-blocks/master/country/{cc}/ipv4-aggregated.txt';
		o.rmempty = false;
		o.description = _('Falls back on failure; keeps the old file if both fail.');

		/* set names as custom rows so the file path prefix/suffix can flank
		   the inputs (framework Value cannot); saved via pushCountries,
		   gated by checkSetname (same message as the retired validate) */
		o = s.taboption('settings', form.DummyValue, '_setnames');
		o.render = function(section_id) {
			nameState.set = uci.get('geoguard', 'main', 'setname') || 'allowed-IPList';
			nameState.white = uci.get('geoguard', 'main', 'white_name') || 'CustomAllow';
			nameDirty = false;
			var mkName = function(dataName, val, cb) {
				var inp = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'data-name': dataName, 'style': 'width:15em;max-width:100%', 'value': val });
				inp.addEventListener('change', function() { cb((inp.value || '').trim()); });
				return inp;
			};
			var setInp = mkName('setname', nameState.set, function(v) { nameDirty = true; nameState.set = v; });
			var whiteInp = mkName('white_name', nameState.white, function(v) { nameDirty = true; nameState.white = v; });
			var nameRow = function(title, desc, inp) {
				return E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, [title]),
					E('div', { 'class': 'cbi-value-field' }, [
						E('div', {}, [
							E('span', {}, ['/etc/geoguard/']), E('span', {}, [' ']),
							inp,
							E('span', {}, [' ']), E('span', {}, ['.cidr'])
						]),
						E('div', { 'class': 'cbi-value-description' }, [desc])
					])
				]);
			};
			return E('div', {}, [
				nameRow(_('Merged set name (countries + custom whitelist)'), _('Rule: start with a letter; letters/digits/_/- only. File shares the set name; old file kept after rename.'), setInp),
				nameRow(_('Whitelist set name'), _('Whitelist lives in its own set, visible under Firewall IP Sets. Same rules as above.'), whiteInp)
			]);
		};

		o = s.taboption('settings', form.DummyValue, '_sched');
		o.render = function(section_id) {
			var freq = uci.get('geoguard', 'main', 'update_freq') || 'weekly';
			var hour = uci.get('geoguard', 'main', 'update_hour') || '6';
			var min = uci.get('geoguard', 'main', 'update_min') || '0';
			schedState.freq = freq;
			schedState.hour = hour;
			schedState.min = min;
			schedDirty = false;
			var freqSel = E('select', {}, [
				E('option', { 'value': 'daily' }, [_('Daily')]),
				E('option', { 'value': 'weekly' }, [_('Weekly (Sun)')]),
				E('option', { 'value': 'monthly' }, [_('Monthly (1st)')])
			]);
			freqSel.value = freq;
			freqSel.addEventListener('change', function() { schedDirty = true; schedState.freq = freqSel.value; });
			var hourSel = E('select', {}, []);
			var minSel = E('select', {}, []);
			var i;
			for (i = 0; i < 24; i++) {
				var hv = String(i);
				var ho = E('option', { 'value': hv }, [hv]);
				if (hv === String(Number(hour)))
					ho.selected = true;
				hourSel.appendChild(ho);
			}
			for (i = 0; i < 60; i++) {
				var mv = String(i);
				var mo = E('option', { 'value': mv }, [mv]);
				if (mv === String(Number(min)))
					mo.selected = true;
				minSel.appendChild(mo);
			}
			hourSel.value = String(Number(hour));
			minSel.value = String(Number(min));
			hourSel.addEventListener('change', function() { schedDirty = true; schedState.hour = hourSel.value; });
			minSel.addEventListener('change', function() { schedDirty = true; schedState.min = minSel.value; });
			var autoCb = E('input', { 'type': 'checkbox' });
			if ((uci.get('geoguard', 'main', 'auto_update') || '1') === '1')
				autoCb.checked = true;
			schedState.auto = autoCb.checked ? '1' : '0';
			autoCb.addEventListener('change', function() { schedDirty = true; schedState.auto = autoCb.checked ? '1' : '0'; });
			return E('div', {}, [
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-field' }, [
						autoCb, E('span', {}, [' ']), E('span', {}, [_('Enable auto-update of feed sets')])
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, [_('Auto-update schedule')]),
					E('div', { 'class': 'cbi-value-field' }, [
						freqSel, E('span', {}, [' ']),
						E('span', {}, [_('Hour')]), E('span', {}, [' ']), hourSel,
						E('span', {}, [' ']), E('span', {}, [_('Minute')]), E('span', {}, [' ']), minSel
					])
				])
			]);
		};
		o = s.taboption('settings', form.DummyValue, '_note');
		o.render = function(section_id) {
			return E('div', { 'class': 'cbi-section' }, [
				E('style', {}, ['#cbi-geoguard input.cbi-input-text{width:15em;max-width:100%}#cbi-geoguard .cbi-value-title{white-space:nowrap;text-align:left!important}#cbi-geoguard .cbi-value-field .btn{width:auto}#cbi-geoguard table.cbi-section-table td,#cbi-geoguard table.cbi-section-table th{padding:3px 6px;text-align:left!important}#cbi-geoguard p{margin:0.3em 0;text-align:left}#cbi-geoguard .cbi-dynlist{width:100%;max-width:none}#cbi-geoguard .cbi-dynlist .add-item{display:flex}#cbi-geoguard .cbi-dynlist .add-item input{flex:1;margin-right:0.5em}#cbi-geoguard .cbi-value label.cbi-value-title{width:auto!important;flex:none!important;margin-right:.6em;min-width:12em}#cbi-geoguard div.cbi-value{text-align:left}#cbi-geoguard-main-src_primary input.cbi-input-text,#cbi-geoguard-main-src_backup input.cbi-input-text{width:100%;max-width:640px}#cbi-geoguard pre{overflow-x:auto;max-width:100%;overflow-wrap:anywhere;word-break:break-all}#cbi-geoguard .country-counts{word-break:break-all}']),
				E('p', {}, [_('This page only builds IP set files and never changes firewall rules.')]),
				E('p', {}, [_('Apply: Network → Firewall → Port Forwards → Add → Advanced → pick the set in IPSet, then Save & Apply.')]),
				E('p', {}, [_('Fallback (SSH): uci set firewall.@redirect[N].ipset=set name, commit, then fw4 reload.')])
			]);
		};

		o = s.taboption('settings', form.DummyValue, '_actions');
		o.render = function(section_id) {
			var opt = this;
			var runone = function(cmd, okmsg, noexec) {
				var map = opt.map;
				return pushCountries().then(function() {
					return map.save(null, true);
				}).then(function() {
					return robustApply();
				}).then(function() {
					if (!checkSetname()) {
						ui.addNotification(null, E('p', _('Bad set name (must start with a letter: letters/digits/_/- only). Settings saved, update skipped.')), 'error');
						throw { handled: true };
					}
					if (noexec) {
						return fs.exec('/usr/bin/geoguard-cron').then(function() {
							return { code: 0, skip: true };
						});
					}
					return fs.exec(cmd);
				}).then(function(res) {
					if (res.skip)
						return res;
					return fs.exec('/usr/bin/geoguard-cron').then(function() {
						return res;
					});
				}).then(function(res) {
					if (res.skip) {
						ui.addNotification(null, E('p', okmsg), 'info');
					} else if (res.code === 0) {
						ui.addNotification(null, E('p', okmsg), 'info');
						return refreshCounts();
					} else {
						ui.addNotification(null, E('p', fmt(_('Update failed: %s'), res.stderr || res.stdout || _('unknown error'))), 'error');
					}
				}).catch(function(e) {
					if (e && e.handled)
						return;
					ui.addNotification(null, E('p', fmt(_('Failed: %s'), e.message)), 'error');
				});
			};
			var mkbtn = function(cmd, title, okmsg, noexec) {
				var b = E('button', { 'class': 'btn cbi-button cbi-button-action', 'style': 'margin-right:0.5em' }, [title]);
				b.addEventListener('click', guardedClick(function() { return runone(cmd, okmsg, noexec); }));
				return trackBtn(b);
			};
			return E('div', { 'style': 'display:flex;align-items:center;gap:0.5em;flex-wrap:wrap' }, [
				mkbtn('/usr/bin/geoguard-fetch', _('Update IP Sets Now'), _('IP sets updated (fetch only, not merged)'), false),
				mkbtn('/usr/bin/geoguard-update', _('Update and Merge Now'), _('Updated and merged successfully (incl. whitelist)'), false),
				mkbtn(null, _('Save Settings'), _('Settings saved (schedule synced)'), true)
			]);
		};

		o = s.taboption('log', form.DummyValue, '_log');
		o.render = function(section_id) {
			var pre = E('pre', { 'style': 'white-space:pre-wrap' }, [logText]);
			var swapPre = function(text) {
				while (pre.firstChild)
					pre.removeChild(pre.firstChild);
				pre.appendChild(document.createTextNode(text || ''));
			};
			var clr = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'style': 'margin-bottom:0.5em;margin-right:0.5em' }, [_('Clear Update History')]);
			clr.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				return fs.exec('/usr/bin/geoguard-clear-history').then(function() {
					return fs.exec('/usr/bin/geoguard-status');
				}).then(function(res) {
					swapPre(res.stdout);
					ui.addNotification(null, E('p', _('Update history cleared')), 'info');
				}).catch(function(e) {
					ui.addNotification(null, E('p', fmt(_('Failed: %s'), e.message)), 'error');
				});
			});
			/* read-only refresh: exempt from the action-button busy lock
			   so progress can be watched while an update runs */
			var rld = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'style': 'margin-bottom:0.5em' }, [_('Reload Log')]);
			rld.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				return fs.exec('/usr/bin/geoguard-status').then(function(res) {
					swapPre(res.stdout);
				}).catch(function(e) {
					ui.addNotification(null, E('p', fmt(_('Failed: %s'), e.message)), 'error');
				});
			});
			return E('div', {}, [clr, rld, pre]);
		};

		/* ---- Login guard tab (compact 7-row layout) ---- */
		o = s.taboption('ban', form.Flag, 'ban_enabled', _('Enable this option to block IP addresses with too many failed logins'));
		o.default = '1';
		o.rmempty = false;
		o.description = _('Disabling stops the guard service; active bans stay until expiry.');

		var banState = { maxretry: '8', findtime: '5', bantime: '2', web: '1', ssh: '1', ddnsint: '3', banint: '60' };
		var banClamp = function(v, lo, hi, def) {
			v = parseInt(v, 10);
			if (isNaN(v))
				return def;
			if (v < lo)
				return String(lo);
			if (v > hi)
				return String(hi);
			return String(v);
		};
		/* Serialize backend actions: rapid clicks otherwise overlap uci
		   transactions (ubus code 6), leave staged changes behind, and run
		   heavy updates in parallel. While busy, action buttons lock. */
		var actionBusy = false;
		var actionBtns = [];
		var trackBtn = function(b) { actionBtns.push(b); return b; };
		var setActionBusy = function(on) {
			actionBusy = on;
			actionBtns.forEach(function(b) { try { b.disabled = on; } catch (ignore) {} });
		};
		var guardedClick = function(fn) {
			return function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				if (actionBusy)
					return false;
				setActionBusy(true);
				return Promise.resolve().then(fn).then(
					function() { setActionBusy(false); },
					function(e) { setActionBusy(false); throw e; });
			};
		};
		/* Empty changeset -> rpcd NO_DATA (code 5): not an error.
		   Contended apply (code 6): retry once after 1s. */
		var robustApply = function(retried) {
			return uci.apply().catch(function(e) {
				var msg = (e && e.message) || '';
				if (/code 5|NO_DATA|No data/i.test(msg))
					return null;
				if (!retried && /code 6|permission denied/i.test(msg))
					return new Promise(function(resolve) { setTimeout(resolve, 1000); }).then(function() { return robustApply(true); });
				throw e;
			});
		};
		var pushBan = function() {
			if (!banDirty)
				return;
			uci.set('geoguard', 'main', 'ban_maxretry', banClamp(banState.maxretry, 1, 100, '8'));
			uci.set('geoguard', 'main', 'ban_findtime', banClamp(banState.findtime, 1, 60, '5'));
			uci.set('geoguard', 'main', 'ban_bantime', banClamp(banState.bantime, 1, 72, '2'));
			uci.set('geoguard', 'main', 'ban_web', banState.web === '1' ? '1' : '0');
			uci.set('geoguard', 'main', 'ban_ssh', banState.ssh === '1' ? '1' : '0');
			uci.set('geoguard', 'main', 'ddns_interval', banClamp(banState.ddnsint, 1, 60, '30'));
			uci.set('geoguard', 'main', 'ban_interval', banClamp(banState.banint, 5, 300, '60'));
		};
		var numIn = function(val, min, max, cb) {
			var inp = E('input', { 'type': 'number', 'min': String(min), 'max': String(max), 'value': val, 'style': 'width:5em;margin-right:0.3em' });
			inp.addEventListener('change', function() { banDirty = true; cb(inp.value); });
			return inp;
		};
		var flagIn = function(checked, cb) {
			var cbx = E('input', { 'type': 'checkbox', 'style': 'margin-right:0.3em' });
			if (checked === '1')
				cbx.checked = true;
			cbx.addEventListener('change', function() { banDirty = true; cb(cbx.checked ? '1' : '0'); });
			return cbx;
		};
		var banRow = function(cells) {
			var div = E('div', { 'class': 'cbi-value' }, []);
			cells.forEach(function(c, i) {
				if (i > 0)
					div.appendChild(E('span', { 'style': 'margin:0 1em' }, [' ']));
				div.appendChild(E('label', { 'class': 'cbi-value-title', 'style': 'width:auto;flex:none;margin-right:0.4em' }, [c[0]]));
				div.appendChild(E('div', { 'class': 'cbi-value-field', 'style': 'display:inline-block' }, [c[1]]));
			});
			return div;
		};

		o = s.taboption('ban', form.DummyValue, '_banthresh');
		o.render = function(section_id) {
			banState.maxretry = uci.get('geoguard', 'main', 'ban_maxretry') || '8';
			banState.findtime = uci.get('geoguard', 'main', 'ban_findtime') || '5';
			banState.bantime = uci.get('geoguard', 'main', 'ban_bantime') || '2';
			banDirty = false;
			return banRow([
				[_('Within (minutes)'), numIn(banState.findtime, 1, 60, function(v) { banState.findtime = v; })],
				[_('Fails to ban'), numIn(banState.maxretry, 1, 100, function(v) { banState.maxretry = v; })],
				[_('Ban time (hours)'), numIn(banState.bantime, 1, 72, function(v) { banState.bantime = v; })]
			]);
		};
		o = s.taboption('ban', form.DummyValue, '_banscope');
		o.render = function(section_id) {
			banState.web = uci.get('geoguard', 'main', 'ban_web') || '1';
			banState.ssh = uci.get('geoguard', 'main', 'ban_ssh') || '1';
			banDirty = false;
			return banRow([
				[_('Guard LuCI web login'), flagIn(banState.web, function(v) { banState.web = v; })],
				[_('Guard SSH login'), flagIn(banState.ssh, function(v) { banState.ssh = v; })]
			]);
		};
		o = s.taboption('ban', form.DynamicList, 'ban_exempt', _('Never-block whitelist'));
		o.validate = function(section_id, value) {
			if (!value || !value.trim())
				return true;
			var oct = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
			var ip = '(' + oct + '\\.){3}' + oct;
			if (!new RegExp('^' + ip + '(/([1-9]|[12][0-9]|3[0-2]))?$').test(value.trim()))
				return _('Enter an IP or CIDR (e.g. 192.168.0.0/16)');
			return true;
		};
		o.rmempty = true;
		o.description = _('IPs/subnets here are never banned. Defaults already cover reserved and private ranges. Two more auto-exempt sources need no entry here: IP whitelist (IP Sets tab) and DDNS whitelist (below), whose IPs follow automatically.');
		o = s.taboption('ban', form.DynamicList, 'ddns_allowlist', _('DDNS allowlist'));
		o.validate = function(section_id, value) {
			if (!value || !value.trim())
				return true;
			if (!/^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value.trim()))
				return _('Enter a valid domain (e.g. home.example.org)');
			return true;
		};
		o.rmempty = true;
		o.description = _('Add multiple entries; each tracked separately. For guard exemption only; never touches IP sets.');
		o = s.taboption('ban', form.DummyValue, '_banperiod');
		o.render = function(section_id) {
			banState.ddnsint = uci.get('geoguard', 'main', 'ddns_interval') || '30';
			banState.banint = uci.get('geoguard', 'main', 'ban_interval') || '60';
			banDirty = false;
			return banRow([
				[_('DDNS check interval (min)'), numIn(banState.ddnsint, 1, 60, function(v) { banState.ddnsint = v; })],
				[_('Log review and ban interval (sec)'), numIn(banState.banint, 5, 300, function(v) { banState.banint = v; })]
			]);
		};
		o = s.taboption('ban', form.Value, 'ban_wan_if', _('WAN interface (auto-detect)'));
		o.validate = function(section_id, value) {
			if (!value || !value.trim())
				return true;
			if (!/^[A-Za-z0-9._-]+$/.test(value.trim()))
				return _('Bad interface name');
			return true;
		};
		o.rmempty = true;
		o.description = _('Leave empty to auto-detect (firewall wan zone → system → default route). Fill in manually only if detection fails (e.g. pppoe-wan).');
		o = s.taboption('ban', form.DummyValue, '_bannote');
		o.render = function(section_id) {
			var bh = uci.get('geoguard', 'main', 'ban_bantime') || '2';
			return E('div', { 'class': 'cbi-section' }, [
				E('p', {}, [fmt(_('Banned = invisible: every packet from the WAN (all ports, TCP/UDP/ICMP) is dropped at ingress, auto-released after %s hours.'), bh)])
			]);
		};

		o = s.taboption('ban', form.DummyValue, '_banstatus');
		o.render = function(section_id) {
			banPre = E('pre', { 'style': 'white-space:pre-wrap' }, [banText || _('Loading status…')]);
			return E('div', {}, [banPre]);
		};

		o = s.taboption('ban', form.DummyValue, '_banactions');
		o.render = function(section_id) {
			var map = this.map;
			var refreshBan = function() {
				return fs.exec('/usr/bin/geoguard-ban-status').then(function(res) {
					banText = res.stdout || '';
					if (banPre) {
						while (banPre.firstChild)
							banPre.removeChild(banPre.firstChild);
						banPre.appendChild(document.createTextNode(banText));
					}
				}).catch(function() {});
			};
			var saveBan = function() {
				pushBan();
				return map.save(null, true).then(function() {
					return robustApply();
				}).then(function() {
					/* keep cron in sync: ddns_interval may have changed above */
					return fs.exec('/usr/bin/geoguard-cron');
				}).then(function() {
					return fs.exec('/usr/bin/geoguard-ban-guard');
				}).then(function() {
					return fs.exec('/etc/init.d/geoguard-ban', ['reload']);
				}).then(function(res) {
					if (res.code === 0)
						ui.addNotification(null, E('p', _('Guard settings saved and restarted')), 'info');
					else
						ui.addNotification(null, E('p', fmt(_('Guard restart failed: %s'), res.stderr || res.stdout || _('unknown error'))), 'error');
					return refreshBan();
				}).catch(function(e) {
					ui.addNotification(null, E('p', fmt(_('Failed: %s'), e.message)), 'error');
				});
			};
			var unbanAll = function() {
				return fs.exec('/usr/bin/geoguard-ban-unban', ['all']).then(function() {
					ui.addNotification(null, E('p', _('All unbanned')), 'info');
					return refreshBan();
				}).catch(function(e) {
					ui.addNotification(null, E('p', fmt(_('Failed: %s'), e.message)), 'error');
				});
			};
			var mkb = function(title, fn, cls) {
				var b = E('button', { 'class': 'btn cbi-button ' + cls, 'style': 'margin-right:0.5em' }, [title]);
				b.addEventListener('click', guardedClick(fn));
				return trackBtn(b);
			};
			return E('div', { 'style': 'display:flex;align-items:center;gap:0.5em;flex-wrap:wrap' }, [
				mkb(_('Save & Restart Guard'), saveBan, 'cbi-button-action'),
				mkb(_('Unban all IPs'), unbanAll, 'cbi-button-neutral')
			]);
		};

		return m.render();
	}
});
