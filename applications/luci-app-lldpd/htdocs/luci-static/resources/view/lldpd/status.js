/*
 * Copyright (c) 2020 Tano Systems. All Rights Reserved.
 * Author: Anton Kikin <a.kikin@tano-systems.com>
 * Copyright (c) 2023-2024. All Rights Reserved.
 * Paul Donald <newtwen+github@gmail.com>
 */

'use strict';
'require rpc';
'require form';
'require lldpd';
'require dom';
'require poll';

var callLLDPStatus = rpc.declare({
	object: 'luci.lldpd',
	method: 'getStatus',
	expect: {}
});

var dataMap = {
	local: {
		localChassis: null,
	},
	remote: {
		neighbors: null,
		statistics: null,
	},
};

return L.view.extend({
	__init__: function() {
		this.super('__init__', arguments);

		this.rowsUnfolded = {};

		this.tableNeighbors = E('div', { 'class': 'table lldpd-table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th left top' }, _('Local interface')),
				E('div', { 'class': 'th left top' }, _('Protocol')),
				E('div', { 'class': 'th left top' }, _('Discovered chassis')),
				E('div', { 'class': 'th left top' }, _('Discovered port')),
			]),
			E('div', { 'class': 'tr center placeholder' }, [
				E('div', { 'class': 'td' }, E('em', { 'class': 'spinning' },
					_('Collecting data...'))),
			])
		]);

		this.tableStatistics = E('div', { 'class': 'table lldpd-table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th left top' }, _('Local interface')),
				E('div', { 'class': 'th left top' }, _('Protocol')),
				E('div', { 'class': 'th left top' }, _('Administrative Status')),
				E('div', { 'class': 'th right top' }, _('Tx')),
				E('div', { 'class': 'th right top' }, _('Rx')),
				E('div', { 'class': 'th right top' }, _('Tx discarded')),
				E('div', { 'class': 'th right top' }, _('Rx unrecognized')),
				E('div', { 'class': 'th right top' }, _('Ageout count')),
				E('div', { 'class': 'th right top' }, _('Insert count')),
				E('div', { 'class': 'th right top' }, _('Delete count')),
			]),
			E('div', { 'class': 'tr center placeholder' }, [
				E('div', { 'class': 'td' }, E('em', { 'class': 'spinning' },
					_('Collecting data...'))),
			])
		]);

		// Inject CSS
		var head = document.getElementsByTagName('head')[0];
		var css = E('link', { 'href':
			L.resource('lldpd/lldpd.css')
				+ '?v=#PKG_VERSION', 'rel': 'stylesheet' });

		head.appendChild(css);
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(callLLDPStatus(), {}),
			lldpd.init(),
		]);
	},

	/** @private */
	renderParam: function(param, value) {
		if (typeof value === 'undefined')
			return '';

		return E('div', {}, [
			E('span', { 'class': 'lldpd-param' }, param),
			E('span', { 'class': 'lldpd-param-value' }, value)
		]);
	},

	/** @private */
	renderAge: function(v) {
		if (typeof v === 'undefined')
			return "&#8211;";

		return E('nobr', {}, v);
	},

	/** @private */
	renderIdType: function(v) {
		if (typeof v === 'undefined')
			return "&#8211;";

		if (v == 'mac')
			return _('MAC address');
		else if (v == 'ifname')
			return _('Interface name');
		else if (v == 'local')
			return _('Local ID');
		else if (v == 'ip')
			return _('IP address');

		return v;
	},

	/** @private */
	renderProtocol: function(v) {
		if (typeof v === 'undefined' || v == 'unknown')
			return "&#8211;";

		if (v == 'LLDP')
			return E('span', { 'class': 'lldpd-protocol-badge lldpd-protocol-lldp' }, v);
		else if ((v == 'CDPv1') || (v == 'CDPv2'))
			return E('span', { 'class': 'lldpd-protocol-badge lldpd-protocol-cdp' }, v);
		else if (v == 'FDP')
			return E('span', { 'class': 'lldpd-protocol-badge lldpd-protocol-fdp' }, v);
		else if (v == 'EDP')
			return E('span', { 'class': 'lldpd-protocol-badge lldpd-protocol-edp' }, v);
		else if (v == 'SONMP')
			return E('span', { 'class': 'lldpd-protocol-badge lldpd-protocol-sonmp' }, v);
		else
			return E('span', { 'class': 'lldpd-protocol-badge' }, v);
	},

	/** @private */
	renderAdminStatus: function(status) {
		if ((typeof status === 'undefined') || !Array.isArray(status))
			return '&#8211;';

		if (status[0].value === 'RX and TX')
			return _('Rx and Tx');
		else if (status[0].value === 'RX only')
			return _('Rx only');
		else if (status[0].value === 'TX only')
			return _('Tx only');
		else if (status[0].value === 'disabled')
			return _('Disabled');
		else
			return _('Unknown');
	},

	/** @private */
	renderNumber: function(v) {
		if (parseInt(v))
			return v;

		return '&#8211;';
	},

	/** @private */
	renderPort: function(port) {
		if (typeof port.port !== 'undefined')
		{
			if (typeof port.port[0].descr !== 'undefined' &&
			    typeof port.port[0].id[0].value !== 'undefined' &&
			    port.port[0].descr[0].value !== port.port[0].id[0].value)
			{
				return [
					E('strong', {}, port.port[0].descr[0].value),
					E('br', {}),
					port.port[0].id[0].value
				];
			}
			else
			{
				if (typeof port.port[0].descr !== 'undefined')
					return port.port[0].descr[0].value;
				else
					return port.port[0].id[0].value;
			}
		}
		else
		{
			return '%s'.format(port.name);
		}
	},

	/** @private */
	renderPortParamTableShort: function(port) {
		var items = [];

		items.push(this.renderParam(_('Name'), port.name));
		items.push(this.renderParam(_('Age'), this.renderAge(port.age)));

		return E('div', { 'class': 'lldpd-params' }, items);
	},

	/** @private */
	renderPortParamTable: function(port, only_id_and_ttl) {
		var items = [];

		if (!only_id_and_ttl) {
			items.push(this.renderParam(_('Name'), port.name));
			items.push(this.renderParam(_('Age'), this.renderAge(port.age)));
		}

		if (typeof port.port !== 'undefined')
		{
			if (typeof port.port[0].id !== 'undefined')
			{
				items.push(this.renderParam(_('Port ID'),
					port.port[0].id[0].value));

				items.push(this.renderParam(_('Port ID type'),
					this.renderIdType(port.port[0].id[0].type)));
			}

			if (typeof port.port[0].descr !== 'undefined')
				items.push(this.renderParam(_('Port description'),
					port.port[0].descr[0].value));

			if (typeof port.ttl !== 'undefined')
				items.push(this.renderParam(_('TTL'), port.ttl[0].ttl));
			else if (port.port[0].ttl !== 'undefined')
				items.push(this.renderParam(_('TTL'), port.port[0].ttl[0].value));

			if (typeof port.port[0].mfs !== 'undefined')
				items.push(this.renderParam(_('MFS'), port.port[0].mfs[0].value));
		}

		return E('div', { 'class': 'lldpd-params' }, items);
	},

	/** @private */
	renderChassis: function(ch) {
		if (typeof ch.name !== 'undefined' &&
		    typeof ch.descr !== 'undefined' &&
		    typeof ch.name[0].value !== 'undefined' &&
		    typeof ch.descr[0].value !== 'undefined')
		{
			return [
				E('strong', {}, ch.name[0].value),
				E('br', {}),
				ch.descr[0].value
			];
		}
		else if (typeof ch.name !== 'undefined' &&
		         typeof ch.name[0].value !== 'undefined')
			return E('strong', {}, ch.name[0].value);
		else if (typeof ch.descr !== 'undefined' &&
		         typeof ch.descr[0].value !== 'undefined')
			return ch.descr[0].value;
		else if (typeof ch.id !== 'undefined' &&
		         typeof ch.id[0].value !== 'undefined')
			return ch.id[0].value;
		else
			return _('Unknown');
	},

	/** @private */
	renderChassisParamTable: function(ch) {
		var items = [];

		if (typeof ch.name !== 'undefined')
			items.push(this.renderParam(_('Name'), ch.name[0].value));

		if (typeof ch.descr !== 'undefined')
			items.push(this.renderParam(_('Description'), ch.descr[0].value));

		if (typeof ch.id !== 'undefined') {
			items.push(this.renderParam(_('ID'), ch.id[0].value));
			items.push(this.renderParam(_('ID type'),
				this.renderIdType(ch.id[0].type)));
		}

		// Management addresses
		if (typeof ch['mgmt-ip'] !== 'undefined') {
			var ips = '';

			if (ch['mgmt-ip'].length > 0) {
				// Array of addresses
				for (var ip = 0; ip < ch["mgmt-ip"].length; ip++)
					ips += ch['mgmt-ip'][ip].value + '<br />';
			}
			else {
				// One address
				ips += ch['mgmt-ip'][0].value;
			}

			items.push(this.renderParam(_('Management IP(s)'), ips));
		}

		if (typeof ch.capability !== 'undefined') {
			var caps = '';

			if (ch.capability.length > 0)
			{
				// Array of capabilities
				for (var cap = 0; cap < ch.capability.length; cap++) {
					caps += ch.capability[cap].type;
					caps += ' (' + (ch.capability[cap].enabled
						? _('enabled') : _('disabled')) + ')';
					caps += '<br />';
				}
			}
			else
			{
				// One capability
				caps += ch.capability[0].type;
				caps += ' (' + (ch.capability[0].enabled
					? _('enabled') : _('disabled')) + ')';
			}

			items.push(this.renderParam(_('Capabilities'), caps));
		}

		return E('div', { 'class': 'lldpd-params' }, items);
	},

	/** @private */
	getFoldingImage: function(unfolded) {
		return L.resource('lldpd/details_' +
			(unfolded ? 'hide' : 'show') + '.svg');
	},

	/** @private */
	generateRowId: function(str) {
		return str.replace(/[^a-z0-9]/gi, '-');
	},

	/** @private */
	handleToggleFoldingRow: function(row, row_id) {
		var e_img      = row.querySelector('img');
		var e_folded   = row.querySelectorAll('.lldpd-folded');
		var e_unfolded = row.querySelectorAll('.lldpd-unfolded');

		if (e_folded.length != e_unfolded.length)
			return;

		var do_unfold = (e_folded[0].style.display !== 'none');
		this.rowsUnfolded[row_id] = do_unfold;

		for (var i = 0; i < e_folded.length; i++)
		{
			if (do_unfold)
			{
				e_folded[i].style.display = 'none';
				e_unfolded[i].style.display = 'block';
			}
			else
			{
				e_folded[i].style.display = 'block';
				e_unfolded[i].style.display = 'none';
			}
		}

		e_img.src = this.getFoldingImage(do_unfold);
	},

	/** @private */
	makeFoldingTableRow: function(row, unfolded) {
		//
		// row[0] - row id
		// row[1] - contents for first cell in row
		// row[2] - contents for second cell in row
		//   ...
		// row[N] - contents for N-th cell in row
		//
		if (row.length < 2)
			return row;

		for (let i = 1; i < row.length; i++) {
			if (i == 1) {
				// Fold/unfold image appears only in first column
				var dImg = E('div', { 'style': 'padding: 0 8px 0 0;' }, [
					E('img', { 'width': '16px', 'src': this.getFoldingImage(unfolded) }),
				]);
			}

			if (Array.isArray(row[i])) {
				// row[i][0] = folded contents
				// row[i][1] = unfolded contents

				// Folded cell data
				let dFolded   = E('div', {
					'class': 'lldpd-folded',
					'style': unfolded ? 'display: none;' : 'display: block;'
				}, row[i][0]);

				// Unfolded cell data
				let dUnfolded = E('div', {
					'class': 'lldpd-unfolded',
					'style': unfolded ? 'display: block;' : 'display: none;'
				}, row[i][1]);

				if (i == 1) {
					row[i] = E('div', {
						'style': 'display: flex; flex-wrap: nowrap;'
					}, [ dImg, dFolded, dUnfolded ]);
				}
				else {
					row[i] = E('div', {}, [ dFolded, dUnfolded ]);
				}
			}
			else {
				// row[i] = same content for folded and unfolded states

				if (i == 1) {
					row[i] = E('div', {
						'style': 'display: flex; flex-wrap: nowrap;'
					}, [ dImg, E('div', row[i]) ]);
				}
			}
		}

		return row;
	},

	/** @private */
	makeNeighborsTableRow: function(obj) {
		if (typeof obj === 'undefined')
			obj.name = 'Unknown';

		var new_id = obj.name + '-' + obj.rid;

		if (typeof obj.port !== 'undefined') {
			if (typeof obj.port[0].id !== 'undefined')
				new_id += "-" + obj.port[0].id[0].value;

			if (typeof obj.port[0].descr !== 'undefined')
				new_id += "-" + obj.port[0].descr[0].value;
		}

		var row_id = this.generateRowId(new_id);

		return this.makeFoldingTableRow([
			row_id,
			[
				'%s'.format(obj.name),
				this.renderPortParamTableShort(obj)
			],
			this.renderProtocol(obj.via),
			[
				this.renderChassis(obj.chassis[0]),
				this.renderChassisParamTable(obj.chassis[0])
			],
			[
				this.renderPort(obj),
				this.renderPortParamTable(obj, true)
			]
		], this.rowsUnfolded[row_id] || false);
	},

	/** @private */
	renderInterfaceProtocols: function(iface, neighbors) {
		if ((typeof iface === 'undefined') ||
		    (typeof neighbors == 'undefined') ||
		    (typeof neighbors.lldp[0] === 'undefined') ||
		    (typeof neighbors.lldp[0].interface === 'undefined'))
			return "&#8211;";

		var name = iface.name;
		var protocols = [];

		/* Search protocols for interface <name> */
		neighbors.lldp[0].interface.forEach(function(n) {
			if (n.name !== name)
				return;

			protocols.push(this.renderProtocol(n.via));
		}.bind(this));

		if (protocols.length > 0)
			return E('span', {}, protocols);
		else
			return "&#8211;";
	},

	/** @private */
	makeStatisticsTableRow: function(sobj, iobj, neighbors) {
		var row_id = this.generateRowId(iobj.name);

		return this.makeFoldingTableRow([
			row_id,
			[
				this.renderPort(iobj),                  // folded
				this.renderPortParamTable(iobj, false)  // unfolded
			],
			this.renderInterfaceProtocols(iobj, neighbors),
			this.renderAdminStatus(iobj.status),
			this.renderNumber(sobj.tx[0].tx),
			this.renderNumber(sobj.rx[0].rx),
			this.renderNumber(sobj.rx_discarded_cnt[0].rx_discarded_cnt),
			this.renderNumber(sobj.rx_unrecognized_cnt[0].rx_unrecognized_cnt),
			this.renderNumber(sobj.ageout_cnt[0].ageout_cnt),
			this.renderNumber(sobj.insert_cnt[0].insert_cnt),
			this.renderNumber(sobj.delete_cnt[0].delete_cnt)
		], this.rowsUnfolded[row_id] || false);
	},

	/** @private */
	updateTable: function(table, data, placeholder) {
		var target = isElem(table) ? table : document.querySelector(table);

		if (!isElem(target))
			return;

		target.querySelectorAll(
			'.tr.table-titles, .cbi-section-table-titles').forEach(L.bind(function(thead) {
			var titles = [];

			thead.querySelectorAll('.th').forEach(function(th) {
				titles.push(th);
			});

			if (Array.isArray(data)) {
				var n = 0, rows = target.querySelectorAll('.tr');

				data.forEach(L.bind(function(row) {
					var id = row[0];
					var trow = E('div', { 'class': 'tr', 'click': L.bind(function(ev) {
						this.handleToggleFoldingRow(ev.currentTarget, id);
						// lldpd_folding_toggle(ev.currentTarget, id);
					}, this) });

					for (var i = 0; i < titles.length; i++) {
						var text = (titles[i].innerText || '').trim();
						var td = trow.appendChild(E('div', {
							'class': titles[i].className,
							'data-title': (text !== '') ? text : null
						}, row[i + 1] || ''));

						td.classList.remove('th');
						td.classList.add('td');
					}

					trow.classList.add('cbi-rowstyle-%d'.format((n++ % 2) ? 2 : 1));

					if (rows[n])
						target.replaceChild(trow, rows[n]);
					else
						target.appendChild(trow);
				}, this));

				while (rows[++n])
					target.removeChild(rows[n]);

				if (placeholder && target.firstElementChild === target.lastElementChild) {
					var trow = target.appendChild(
						E('div', { 'class': 'tr placeholder' }));

					var td = trow.appendChild(
						E('div', { 'class': 'center ' + titles[0].className }, placeholder));

					td.classList.remove('th');
					td.classList.add('td');
				}
			} else {
				thead.parentNode.style.display = 'none';

				thead.parentNode.querySelectorAll('.tr, .cbi-section-table-row').forEach(function(trow) {
					if (trow !== thead) {
						var n = 0;
						trow.querySelectorAll('.th, .td').forEach(function(td) {
							if (n < titles.length) {
								var text = (titles[n++].innerText || '').trim();
								if (text !== '')
									td.setAttribute('data-title', text);
							}
						});
					}
				});

				thead.parentNode.style.display = '';
			}
		}, this));
	},

	/** @private */
	startPolling: function() {
		poll.add(L.bind(function() {
			return callLLDPStatus().then(L.bind(function(data) {
				this.renderData(data);
			}, this));
		}, this));
	},

	/** @private */
	renderDataLocalChassis: function(data) {
		if (data &&
		    typeof data !== 'undefined' &&
		    typeof data['local-chassis'] !== 'undefined' &&
		    typeof data['local-chassis'][0].chassis[0].name !== 'undefined') {
			return this.renderChassisParamTable(data['local-chassis'][0].chassis[0]);
		}
		else {
			return E('div', { 'class': 'alert-message warning' },
				_('No data to display'));
		}
	},

	/** @private */
	renderDataNeighbors: function(neighbors) {
		var rows = [];

		if (neighbors &&
		    typeof neighbors !== 'undefined' &&
		    typeof neighbors.lldp !== 'undefined')
		{
			var ifaces = neighbors.lldp[0].interface;

			// Fill table rows
			if (typeof ifaces !== 'undefined') {
				for (i = 0; i < ifaces.length; i++)
					rows.push(this.makeNeighborsTableRow(ifaces[i]));
			}
		}

		return rows;
	},

	/** @private */
	renderDataStatistics: function(statistics, interfaces, neighbors) {
		var rows = [];

		if (statistics &&
		    interfaces &&
		    typeof statistics !== 'undefined' &&
		    typeof interfaces !== 'undefined' &&
		    typeof statistics.lldp !== 'undefined' &&
		    typeof interfaces.lldp !== 'undefined')
		{
			var sifaces = statistics.lldp[0].interface;
			var ifaces  = interfaces.lldp[0].interface;

			if ((typeof sifaces !== 'undefined') &&
			    (typeof  ifaces !== 'undefined')) {
				for (var i = 0; i < sifaces.length; i++)
					rows.push(this.makeStatisticsTableRow(sifaces[i], ifaces[i], neighbors));
			}
		}

		return rows;
	},

	/** @private */
	renderData: function(data) {
		var r;

		r = this.renderDataLocalChassis(data.chassis);
		dom.content(document.getElementById('lldpd-local-chassis'), r);

		r = this.renderDataNeighbors(data.neighbors);
		this.updateTable(this.tableNeighbors, r,
			_('No data to display'));

		r = this.renderDataStatistics(data.statistics, data.interfaces, data.neighbors);
		this.updateTable(this.tableStatistics, r,
			_('No data to display'));
	},

	render: function(data) {
		var m, s, ss, o;

		m = new form.JSONMap(dataMap,
			_('LLDP Status'),
			_('This page allows you to see discovered LLDP neighbors, ' +
			  'local interfaces statistics and local chassis information.'));

		s = m.section(form.NamedSection, 'local', 'local',
			_('Local Chassis'));

		o = s.option(form.DummyValue, 'localChassis');
		o.render = function() {
			return E('div', { 'id': 'lldpd-local-chassis' }, [
				E('em', { 'class': 'spinning' }, _('Collecting data...'))
			]);
		};

		s = m.section(form.NamedSection, 'remote', 'remote');

		s.tab('neighbors', _('Discovered Neighbors'));
		s.tab('statistics', _('Interface Statistics'));

		o = s.taboption('neighbors', form.DummyValue, 'neighbors');
		o.render = L.bind(function() {
			return E('div', { 'class': 'table-wrapper' }, [
				this.tableNeighbors
			]);
		}, this);

		o = s.taboption('statistics', form.DummyValue, 'statistics');
		o.render = L.bind(function() {
			return E('div', { 'class': 'table-wrapper' }, [
				this.tableStatistics
			]);
		}, this);

		return m.render().then(L.bind(function(rendered) {
			this.startPolling();
			return rendered;
		}, this));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
