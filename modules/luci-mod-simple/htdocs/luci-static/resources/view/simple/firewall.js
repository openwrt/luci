'use strict';
'require firewall';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';
'require fs';

var callTopologyGetTopology = rpc.declare({
	object: 'topology',
	method: 'getTopology',
	expect: { '': {} }
});

var callUciCommit = rpc.declare({
	object: 'uci',
	method: 'commit',
	params: [ 'config' ]
});

var cbiRichListValue = form.ListValue.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var choices = this.transformChoices();
		var widget = new ui.Dropdown((cfgvalue != null) ? cfgvalue : this.default, choices, {
			id: this.cbid(section_id),
			sort: this.keylist,
			optional: this.optional,
			select_placeholder: this.select_placeholder || this.placeholder,
			custom_placeholder: this.custom_placeholder || this.placeholder,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	}
});

var cbiPolicySelectorValue = form.ListValue.extend({
	__init__: function(/* ... */) {
		this.super('__init__', arguments);

		this.value('maximum', E('div', { 'style': 'display:inline-block;vertical-align:top;margin:0 0 1em .5em' }, [
			E('strong', [ _('Maximum Security (high)') ]), E('br'),
			_('Inbound Policy:'), ' ', E('strong', { 'style': 'color:#c11' }, [ _('Drop', 'Firewall policy') ]), E('br'),
			_('Remote Administration settings will override the security inbound policy.'), E('br'),
			_('Outbound Policy:'), ' ', E('strong', { 'style': 'color:#c11' }, [ _('Drop', 'Firewall policy') ]), E('br'),
			_('Outbound access is allowed to the following services:'), ' ', Object.keys(serviceWhitelist).sort().join(', ')
		]));

		this.value('typical', E('div', { 'style': 'display:inline-block;vertical-align:top;margin:0 0 1em .5em' }, [
			E('strong', [ _('Typical Security (medium)') ]), E('br'),
			_('Inbound Policy:'), ' ', E('strong', { 'style': 'color:#c11' }, [ _('Reject', 'Firewall policy') ]), E('br'),
			_('Remote Administration settings will override the security inbound policy.'), E('br'),
			_('Outbound Policy:'), ' ', E('strong', { 'style': 'color:#282' }, [ _('Accept', 'Firewall policy') ])
		]));

		this.value('minimum', E('div', { 'style': 'display:inline-block;vertical-align:top;margin:0 0 1em .5em' }, [
			E('strong', [ _('Minimum Security (low)') ]), E('br'),
			_('Inbound Policy:'), ' ', E('strong', { 'style': 'color:#282' }, [ _('Accept', 'Firewall policy') ]), E('br'),
			_('Outbound Policy:'), ' ', E('strong', { 'style': 'color:#282' }, [ _('Accept', 'Firewall policy') ])
		]));
	},

	renderWidget: function(section_id, option_index, cfgvalue) {
		var choices = this.transformChoices();
		var widget = new ui.Select((cfgvalue != null) ? cfgvalue : this.default, choices, {
			id: this.cbid(section_id),
			size: this.size,
			sort: this.keylist,
			optional: this.optional,
			placeholder: this.placeholder,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			widget: 'radio',
			orientation: 'vertical'
		});

		var nodes = widget.render();

		nodes.querySelectorAll('input[type="radio"]').forEach(L.bind(function(radio) {
			radio.addEventListener('change', ui.createHandlerFn(this, 'handlePolicyChange', section_id, radio.getAttribute('value')));
		}, this));

		return nodes;
	},

	cfgvalue: function(section_id) {
		var policy_input = this.fwzone.getInput(),
		    //policy_output = this.fwzone.getOutput(),
		    policy_forward = this.fwzone.getForward();

		if (policy_input.toUpperCase() == 'DROP' /*&& policy_output.toUpperCase() == 'DROP'*/ && policy_forward.toUpperCase() == 'DROP')
			return 'maximum';
		else if (policy_input.toUpperCase() == 'ACCEPT' /*&& policy_output.toUpperCase() == 'ACCEPT'*/ && policy_forward.toUpperCase() == 'ACCEPT')
			return 'minimum';
		else
			return 'typical';
	},

	handlePolicyChange: function(section_id, value) {
		switch (value) {
		case 'maximum':
			this.fwdefs.set('input', 'DROP');
			this.fwdefs.set('output', 'DROP');
			this.fwdefs.set('forward', 'DROP');

			this.fwzone.set('input', 'DROP');
			this.fwzone.set('output', 'ACCEPT');
			this.fwzone.set('forward', 'DROP');

			this.fwzone.deleteForwardingsBy('dest');

			uci.sections('firewall', 'rule', function(r) {
				if (r['.name'].indexOf('secpol_forward_') == 0)
					uci.remove('firewall', r['.name']);
			});

			var services = Object.keys(serviceWhitelist);

			services.sort();

			for (var i = 0; i < services.length; i++) {
				var svc = serviceWhitelist[services[i]],
				    sid = 'secpol_forward_%s'.format(services[i].toLowerCase());

				uci.add('firewall', 'rule', sid);
				uci.set('firewall', sid, 'name', 'Allow %s outbound'.format(services[i]));
				uci.set('firewall', sid, 'src', '*');
				uci.set('firewall', sid, 'dest', 'wan');
				uci.set('firewall', sid, 'target', 'ACCEPT');

				for (var opt in svc)
					uci.set('firewall', sid, opt, svc[opt]);
			}
			break;

		case 'typical':
			this.fwdefs.set('input', 'ACCEPT');
			this.fwdefs.set('output', 'ACCEPT');
			this.fwdefs.set('forward', 'REJECT');

			this.fwzone.set('input', 'REJECT');
			this.fwzone.set('output', 'ACCEPT');
			this.fwzone.set('forward', 'REJECT');

			this.fwzone.addForwardingFrom('lan');
			this.fwzone.addForwardingFrom('guest');

			uci.sections('firewall', 'rule', function(r) {
				if (r['.name'].indexOf('secpol_forward_') == 0)
					uci.remove('firewall', r['.name']);
			});
			break;

		case 'minimum':
			this.fwdefs.set('input', 'ACCEPT');
			this.fwdefs.set('output', 'ACCEPT');
			this.fwdefs.set('forward', 'ACCEPT');

			this.fwzone.set('input', 'ACCEPT');
			this.fwzone.set('output', 'ACCEPT');
			this.fwzone.set('forward', 'ACCEPT');

			this.fwzone.deleteForwardingsBy('dest');

			uci.sections('firewall', 'rule', function(r) {
				if (r['.name'].indexOf('secpol_forward_') == 0)
					uci.remove('firewall', r['.name']);
			});
			break;
		}

		return handleApply(this.map);
	}
});

var cbiPortForwardSection = form.GridSection.extend({
	handleAdd: function(addForm, ev) {
		return addForm.save(null, true).then(L.bind(function() {
			var values = addForm.data.data.settings;

			if (!values.host)
				return m.findElement('id', 'cbid.json.settings.host').focus();
			else if (!values.service)
				return m.findElement('id', 'cbid.json.settings.service').focus();

			var proto, src_port, src_dport, dest_port;

			if (values.service != '_') {
				var svc = serviceWhitelist[values.service];

				proto = L.toArray(svc.proto);
				src_port = L.toArray(svc.src_port);
				src_dport = L.toArray(svc.dest_port);
				dest_port = [];
			}
			else {
				proto = L.toArray(values.proto);
				src_port = L.toArray(values.src_port);
				src_dport = L.toArray(values.src_dport);
				dest_port = L.toArray(values.dest_port);
			}

			if (proto.length <= 1)
				proto = proto[0];

			for (var i = 0; i < Math.max(src_port.length, 1); i++) {
				for (var j = 0; j < Math.max(src_dport.length, 1); j++) {
					var sp = src_port[i] || null,
					    dp = src_dport[j] || null;

					var sid = uci.add('firewall', 'redirect');

					uci.set('firewall', sid, 'src', 'wan');
					uci.set('firewall', sid, 'dest', 'lan');
					uci.set('firewall', sid, 'name', 'Forward %s to %s'.format(formatProtoPortPermutations(proto, dp), values.host));
					uci.set('firewall', sid, 'proto', proto);
					uci.set('firewall', sid, 'dest_ip', values.host);
					uci.set('firewall', sid, 'src_port', sp);
					uci.set('firewall', sid, 'src_dport', dp);
					uci.set('firewall', sid, 'dest_port', dest_port[0]);
					uci.set('firewall', sid, 'target', 'DNAT');
				}
			}

			return handleApply(this.map);
		}, this)).catch(function(err) {
			var input = addForm.findElement('input.cbi-input-invalid');
			if (input)
				input.focus();
		});
	},

	renderContents: function(/* ... */) {
		var nodes = form.GridSection.prototype.renderContents.apply(this, arguments);
		var parentmap = this.map;

		var m, s, o;
		var formdata = { settings: {} };

		m = new form.JSONMap(formdata);
		s = m.section(form.NamedSection, 'settings', 'settings', null, _('Create new port forwarding rule'));

		o = s.option(form.Value, 'host', _('Forward to Device'));
		o.placeholder = _('Select Device');
		o.datatype = 'ip4addr("nomask")';
		o.optional = true;

		for (var i = 0; i < this.hostlist.length; i++) {
			var ip = this.hostlist[i].active_ip || this.hostlist[i].config_ip;
			if (ip && this.hostlist[i].zone == 'lan') {
				o.value(ip, E([], [
					E('img', { 'style': 'width:1em', 'src': L.resource('svg/%s.svg'.format(this.hostlist[i].config_type || 'laptop')) }), ' ',
					E('strong', [ this.hostlist[i].config_name || this.hostlist[i].active_name || 'unknown_%s'.format(this.hostlist[i].mac) ]),
					'\xa0(%s)'.format(ip)
				]));
			}
		}


		o = s.option(cbiRichListValue, 'service', _('Forward Service'));
		o.placeholder = _('Select Service');
		o.optional = true;

		var services = Object.keys(serviceWhitelist).sort();
		for (var i = 0; i < services.length; i++) {
			o.value(services[i], E('div', [
				E('strong', [ services[i] ]),
				E('small', [ ' (%s)'.format(formatProtoPortPermutations(serviceWhitelist[services[i]].proto, serviceWhitelist[services[i]].dest_port)) ])
			]));
		}

		o.value('_', _('Custom Ports…'));


		o = s.option(cbiRichListValue, 'proto', _('Protocol'));
		o.depends('service', '_');
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.value('tcp udp', _('TCP and UDP', 'Firewall rule protocols'));

		o = s.option(form.Value, 'src_port', _('Source Ports'));
		o.depends('service', '_');
		o.placeholder = _('Any', 'Match any traffic port');
		o.datatype = 'list(portrange)';

		o = s.option(form.Value, 'src_dport', _('Destination Ports'));
		o.depends('service', '_');
		o.placeholder = _('Any', 'Match any traffic port');
		o.datatype = 'list(portrange)';

		o = s.option(form.Value, 'dest_port', _('Forward to Port'));
		o.depends('service', '_');
		o.placeholder = _('Same as Incoming Port');
		o.datatype = 'portrange';

		o = s.option(form.Button, 'add');
		o.inputtitle = _('Add Port Forward');
		o.onclick = ui.createHandlerFn(this, 'handleAdd', m);

		return m.render().then(function(subnodes) {
			var placeholder = nodes.querySelector('.tr.placeholder em');

			if (placeholder)
				placeholder.firstChild.data = _('There are no port forwards set up yet.');

			nodes.insertBefore(subnodes, nodes.lastElementChild);

			return nodes;
		});
	},

	renderSectionAdd: function() {
		return E([]);
	},

	renderRowActions: function(section_id) {
		var dd = new ui.Dropdown(null, {
			details: _('Display details'),
			enable: (uci.get('firewall', section_id, 'enabled') != '0') ? _('Disable port forward') : _('Enable port forward'),
			delete: _('Delete port forward')
		}, {
			sort: [ 'details', 'enable', 'delete' ],
			select_placeholder: _('Port forward action…')
		});

		dd.toggleItem = L.bind(function(sb, li) {
			this.handleForwardAction(section_id, li.getAttribute('data-value'));
			dd.closeDropdown(sb);
		}, this);

		var node = dd.render();

		node.style.maxWidth = '200px';
		node.style.textAlign = 'left';

		return E('div', { 'class': 'td nowrap cbi-section-actions' }, E('div', {}, node));
	},

	handleForwardEnable: function(section_id) {
		if (uci.get('firewall', section_id, 'enabled') != '0')
			uci.set('firewall', section_id, 'enabled', '0');
		else
			uci.set('firewall', section_id, 'enabled', '1');

		return handleApply(this.map);
	},

	handleForwardDelete: function(section_id) {
		return handleConfirm(_('Do you really want to delete this port forward?')).then(L.bind(function() {
			uci.remove('firewall', section_id);

			return handleApply(this.map);
		}, this), function() {});
	},

	handleForwardDetails: function(section_id) {
		ui.showModal(_('Details for port forward'), [
			E('em', { 'class': 'spinning' }, [ _('Retrieving traffic statistics…') ])
		]);

		return getRuleCounters(section_id).then(L.bind(function(counters) {
			var ip = uci.get('firewall', section_id, 'dest_ip'),
			    en = (uci.get('firewall', section_id, 'enabled') != '0'),
			    host = L.toArray(this.hostlist).filter(function(host) { return (host.active_ip || host.config_ip) == ip })[0] || {},
			    keys = Object.keys(counters);

			keys.sort(function(a, b) {
				var n = a.split(/,/),
				    m = b.split(/,/);

				if (n[0] != m[0])
					return n[0] > m[0];

				if (+n[1] != +m[1])
					return +n[1] - +m[1];

				return +n[2] - +m[2];
			});

			if (keys.length == 0)
				keys.push('-');

			ui.showModal(_('Details for port forward'), [
				ui.itemlist(E('div'), [
					_('Destination Device'), formatHost(host),
					_('Forward Status'), E('div', [
						en ? E('strong', { 'style': 'color:#282' }, _('Active', 'Firewall rule is enabled'))
						   : E('strong', { 'style': 'color:#c11' }, _('Disabled', 'Firewall rule is disabled'))
					]),
					_('Forwarded Ports'), E('table', { 'class': 'table' }, keys.map(function(tuple) {
						tuple = tuple.split(/,/);

						if (tuple[0] == '-')
							return E('div', { 'class': 'tr' }, [
								E('div', { 'class': 'td' }, [
									E('em', [ _('No port rules present.') ])
								])
							]);

						return E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td' }, [
								(tuple[3] ? '%s %s → %s : %s' : '%s %s → %s').format(
									tuple[0].toUpperCase(),
									tuple[1] || _('Any', 'Match any traffic port'),
									tuple[2] || _('Any', 'Match any traffic port'),
									tuple[3])
							]),
							E('div', { 'class': 'td' }, [ _('%d Pkts.', 'Amount of packets').format(counters[tuple][0]) ]),
							E('div', { 'class': 'td' }, [ _('%d Bytes', 'Amount of bytes').format(counters[tuple][1]) ])
						]);
					}))
				]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ])
				])
			]);
		}, this));
	},

	handleForwardAction: function(section_id, action) {
		switch (action) {
		case 'details':
			return this.handleForwardDetails(section_id);

		case 'enable':
			return this.handleForwardEnable(section_id);

		case 'delete':
			return this.handleForwardDelete(section_id);
		}
	}
});

function handleApply(map) {
	var dlg = ui.showModal(null, [ E('em', { 'class': 'spinning' }, [ _('Saving configuration…') ]) ]);
	dlg.removeChild(dlg.firstElementChild);

	return map.save(null, true).then(function() {
		return callUciCommit('firewall');
	}).then(function() {
		uci.unload('firewall');
		return uci.load('firewall');
	}).catch(function(err) {
		ui.addNotification(null, [ E('p', [ _('Failed to save configuration: %s').format(err) ]) ])
	}).finally(function() {
		map.reset();
		ui.hideIndicator('uci-changes');
		ui.hideModal();
	});
}

function formatHost(host) {
	return E('div', { 'style': 'display:flex' }, [
		E('img', { 'style': 'width:2em', 'src': L.resource('svg/%s.svg'.format(host.config_type || 'laptop')) }),
		E('div', { 'style': 'margin:0 0 0 .5em' }, [
			E('strong', [ host.config_name || host.active_name || E('em', [ _('Unnabled device') ]) ]), E('br'),
			E('small', [ host.active_ip || host.config_ip ])
		])
	]);
}

var cbiHostDescriptionValue = form.DummyValue.extend({
	textvalue: function(section_id) {
		var ip = this.cfgvalue(section_id),
		    host = L.toArray(this.section.hostlist).filter(function(host) { return (host.active_ip || host.config_ip) == ip })[0] || {};

		return formatHost(host);
	}
});

var cbiPortDescriptionValue = form.DummyValue.extend({
	textvalue: function(section_id) {
		var protos = L.toArray(uci.get('firewall', section_id, 'proto')),
		    src_ports = L.toArray(uci.get('firewall', section_id, 'src_port')),
		    src_dports = L.toArray(uci.get('firewall', section_id, 'src_dport')),
		    dest_port = uci.get('firewall', section_id, 'dest_port'),
		    list = [];

		for (var i = 0; i < protos.length; i++) {
			for (var j = 0; j < Math.max(src_ports.length, 1); j++) {
				for (var k = 0; k < Math.max(src_dports.length, 1); k++) {
					if (dest_port)
						list.push('%s %s → %s : %s'.format(
							protos[i].toUpperCase(),
							src_ports[j] || _('Any', 'Match any traffic port'),
							src_dports[k] || _('Any', 'Match any traffic port'),
							dest_port), E('br'));
					else
						list.push('%s %s → %s'.format(
							protos[i].toUpperCase(),
							src_ports[j] || _('Any', 'Match any traffic port'),
							src_dports[k] || _('Any', 'Match any traffic port')), E('br'));
				}
			}
		}

		return E([], list);
	}
});

var serviceWhitelist = {
	'DHCP': {
		'proto': 'udp',
		'source_port': 68,
		'dest_port': 67
	},
	'DNS': {
		'proto': [ 'tcp', 'udp' ],
		'dest_port': 53
	},
	'IMAP': {
		'proto': 'tcp',
		'dest_port': [ 143, 993 ]
	},
	'SMTP': {
		'proto': 'tcp',
		'dest_port': [ 25, 465, 587, 2525 ]
	},
	'POP3': {
		'proto': 'tcp',
		'dest_port': [ 110, 995 ]
	},
	'HTTP': {
		'proto': 'tcp',
		'dest_port': 80
	},
	'HTTPS': {
		'proto': 'tcp',
		'dest_port': 443
	},
	'FTP': {
		'proto': 'tcp',
		'dest_port': 21
	},
	'Telnet': {
		'proto': 'tcp',
		'dest_port': 23
	},
	'SSH': {
		'proto': 'tcp',
		'dest_port': 22
	}
};

function formatProtoPortPermutations(protos, ports) {
	protos = L.toArray(protos);
	protos.sort();

	ports = L.toArray(ports);
	ports.sort(function(a, b) { return +a - +b });

	return protos.map(function(p) {
		return ports.map(function(pt) {
			return '%s/%d'.format(p.toUpperCase(), +pt);
		}).join(', ')
	}).join(', ');
}

function handleConfirm(question, confirm, cancel, dangerous) {
	return new Promise(function(resolveFn, rejectFn) {
		var dlg = ui.showModal(null, [
			E('p', [ question || _('Please confirm') ]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': function() {
						ui.hideModal();
						dlg.style.maxWidth = '';
						rejectFn();
					}
				}, [ cancel || _('Cancel') ]),
				E('button', {
					'class': dangerous ? 'btn cbi-button-negative' : 'btn important',
					'click': function() {
						ui.hideModal();
						dlg.style.maxWidth = '';
						resolveFn();
					}
				}, [ confirm || _('Continue') ])
			])
		]);

		dlg.removeChild(dlg.firstElementChild);
		dlg.style.maxWidth = '400px';
	});
}

function getRuleCounters(section_id) {
	return Promise.all([
		L.resolveDefault(fs.exec_direct('/usr/sbin/nft', [ '-j', 'list', 'chain', 'inet', 'fw4', 'dstnat_wan' ], 'json'), {}),
		L.resolveDefault(fs.exec_direct('/usr/sbin/iptables', [ '-t', 'nat', '-n', '-x', '-v', '-L', 'zone_wan_prerouting' ]), '')
	]).then(function(data) {
		var nft = (L.isObject(data[0]) && Array.isArray(data[0].nftables)) ? data[0].nftables : [],
		    lines = data[1].split(/\n/);

		var cfg = {
			host: uci.get('firewall', section_id, 'dest_ip'),
			protos: L.toArray(uci.get('firewall', section_id, 'proto')),
			sports: L.toArray(uci.get('firewall', section_id, 'src_port')),
			dports: L.toArray(uci.get('firewall', section_id, 'src_dport')),
			rport: uci.get('firewall', section_id, 'dest_port')
		};

		var ipts = [], counters = {};

		for (var i = 0; i < lines.length; i++) {
			var m = lines[i].match(/^\s*(\d+)\s+(\d+)\s+DNAT\s+(\w+)(?:\s+\S+){6}(?: spt:(\d+))? dpt:(\S+)(?: \/\*.+?\*\/)?\s+to:([^:]+)(?::(\d+))?\b/);

			if (!m)
				continue;

			ipts.push({
				pkts:  +m[1],
				bytes: +m[2],
				proto: m[3],
				sport: m[4] || null,
				dport: m[5] || null,
				host:  m[6],
				rport: m[7]
			});
		}

		for (var i = 0; i < nft.length; i++) {
			if (!L.isObject(nft[i]) || !L.isObject(nft[i].rule) || !Array.isArray(nft[i].rule.expr))
				continue;

			let r = nft[i].rule.expr,
			    s = {};

			for (var j = 0; j < r.length; j++) {
				if (L.isObject(r[j].match) && L.isObject(r[j].match.left) && r[j].match.right != null) {
					if (L.isObject(r[j].match.left.payload)) {
						switch (r[j].match.left.payload.field) {
						case 'dport':
						case 'sport':
							s.proto = s.proto ? s.proto : r[j].match.left.payload.protocol;
							s[r[j].match.left.payload.field] = (L.isObject(r[j].match.right) && Array.isArray(r[j].match.right.range)) ? r[j].match.right.range.join('-') : r[j].match.right;
							break;
						}
					}
				}
				else if (L.isObject(r[j].dnat)) {
					s.host = r[j].dnat.addr;
					s.rport = (L.isObject(r[j].dnat.port) && Array.isArray(r[j].dnat.port.range)) ? r[j].dnat.port.range.join('-') : r[j].dnat.port;
				}
				else if (L.isObject(r[j].counter)) {
					s.pkts = +r[j].counter.packets;
					s.bytes = +r[j].counter.bytes;
				}
			}

			if (s.hasOwnProperty('host') || s.hasOwnProperty('rport'))
				ipts.push(s);
		}

		for (var i = 0; i < cfg.protos.length; i++) {
			for (var j = 0; j < Math.max(cfg.sports.length, 1); j++) {
				for (var k = 0; k < Math.max(cfg.dports.length, 1); k++) {
					for (var l = 0; l < ipts.length; l++) {
						var ipt = ipts[l],
						    pr = cfg.protos[i],
						    sp = cfg.sports[j] || null,
						    dp = cfg.dports[k] || null;

						if (ipt.proto != pr || ipt.sport != sp || ipt.dport != dp ||
						    ipt.host != cfg.host || (cfg.rport && ipt.rport != cfg.rport))
							continue;

						var k = '%s,%s,%s,%s'.format(pr, sp || '', dp || '', cfg.rport || ''),
						    n = counters[k] || (counters[k] = [ 0, 0 ]);

						n[0] += ipt.pkts;
						n[1] += ipt.bytes;
					}
				}
			}
		}

		return counters;
	});
}

return view.extend({
	connectionToZone: function(lookup, topo, cache) {
		if (L.isObject(cache) && cache.hasOwnProperty(lookup))
			return cache[lookup];

		for (var zone in topo.zones) {
			for (var device in topo.zones[zone]) {
				if (device == lookup) {
					if (L.isObject(cache))
						cache[device] = zone;

					return zone;
				}
			}
		}

		return null;
	},

	buildHostList: function(topo) {
		var blocked = {},
		    zones = {},
		    ports = {},
		    hosts = {};

		L.toArray(uci.get('firewall', 'hostblock', 'src_mac')).forEach(function(mac) {
			blocked[mac.toUpperCase()] = true;
		});

		uci.sections('dhcp', 'host', function(host) {
			L.toArray(host.mac).forEach(function(mac) {
				hosts[mac.toUpperCase()] = Object.assign({}, {
					mac: mac.toUpperCase(),
					config_ip: host.ip,
					config_name: host.name,
					config_type: host.type || 'laptop'
				});
			});
		});

		for (var mac in (topo.hosts || {})) {
			var host = topo.hosts[mac],
			    neigh = (host.neigh4 || []).concat(host.neigh6 || []),
			    ip6ll = null,
			    ip6s = [];

			for (var i = 0; i < (host.neigh6 || []).length; i++) {
				var a = host.neigh6[i].addr;

				if (a.match(/^fe[89ab][0-9a-f]:/i))
					ip6ll = a;
				else
					ip6s.push(a);
			}

			(host.neigh4 || []).sort(function(a, b) {
				var usedA = (a.used || '-1').split(/\//)[0],
				    usedB = (b.used || '-1').split(/\//)[0];

				return (usedA - usedB);
			});

			hosts[mac] = Object.assign(hosts[mac] || {}, {
				mac: mac,
				active_ip: (host.neigh4 && host.neigh4.length) ? host.neigh4[0].addr : null,
				active_ipmode: host.dhcp ? 'dhcp' : 'static',
				active_name: host.dhcp ? host.dhcp.hostname : host.name,
				active_ip6ll: ip6ll,
				active_ip6addrs: ip6s,
				active_ip6mode: host.dhcp6 ? 'stateful' : 'stateless',
				connected: neigh.filter(function(n) { return n.state.match(/REACHABLE|STALE/) != null }).length > 0,
				connection: host.dev,
				blocked: !!blocked[mac],
				zone: this.connectionToZone(host.dev, topo, zones)
			});
		}

		var zoneweight = { lan: 100, guest: 50, wan: 10 },
		    list = [];

		for (var mac in hosts)
			list.push(hosts[mac]);

		list.sort(function(a, b) {
			var wA = zoneweight[a.zone] || 0,
			    wB = zoneweight[b.zone] || 0,
			    nA = a.config_name || a.active_name || '~' + a.mac,
			    nB = b.config_name || b.active_name || '~' + b.mac;

			if (wA != wB)
				return wA < wB;

			return nA > nB;
		});

		return list;
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(callTopologyGetTopology(), {}),
			L.resolveDefault(firewall.getDefaults()),
			L.resolveDefault(firewall.getZone('wan')),
			L.resolveDefault(uci.load('dhcp')),
			L.resolveDefault(uci.load('firewall'))
		]);
	},

	render: function(data) {
		var hosts = this.buildHostList(data[0]),
		    fwdefs = data[1],
		    fwzone = data[2],
		    m, s, o;

		m = new form.Map('firewall');
		m.tabbed = true;

		s = m.section(form.TypedSection, 'defaults', _('General'), _('The security level of the firewall controls how incoming and outgoing traffic is handled. For most use cases it is recommended to use the "Typical Security" level which provides the best trade-off between security and compatibility.'));
		s.addremove = false;
		s.anonymous = true;

		o = s.option(cbiPolicySelectorValue, 'level');
		o.fwdefs = fwdefs;
		o.fwzone = fwzone;

		s = m.section(cbiPortForwardSection, 'redirect', _('Port Forwarding'));
		s.addremove = true;
		s.anonymous = true;
		s.hostlist = hosts;

		s.option(cbiHostDescriptionValue, 'dest_ip', _('Destination Device'));
		s.option(cbiPortDescriptionValue, 'src_dport', _('Ports Forwarded'));

		o = s.option(form.DummyValue, 'enabled', _('Status'));
		o.textvalue = function(section_id) {
			var en = (this.cfgvalue(section_id) != '0');
			return en
				? E('strong', { 'style': 'color:#282' }, _('Active', 'Firewall rule is enabled'))
				: E('strong', { 'style': 'color:#c11' }, _('Disabled', 'Firewall rule is disabled'))
			;
		};

		return m.render();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
