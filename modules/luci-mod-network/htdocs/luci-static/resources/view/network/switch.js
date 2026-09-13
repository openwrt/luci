'use strict';
'require view';
'require dom';
'require poll';
'require ui';
'require rpc';
'require uci';
'require form';
'require network';

function parse_portvalue(section_id) {
	const ports = L.toArray(uci.get('network', section_id, 'ports'));

	for (let p of ports) {
		const m = p.match(/^(\d+)([tu]?)/);

		if (m && m[1] == this.option)
			return m[2] || 'u';
	}

	return '';
}

function validate_portvalue(section_id, value) {
	if (value != 'u')
		return true;

	const sections = this.section.cfgsections();

	for (let s of sections) {
		if (s == section_id)
			continue;

		if (this.formvalue(s) == 'u')
			return _('%s is untagged in multiple VLANs!').format(this.title);
	}

	return true;
}

function update_interfaces(old_ifname, new_ifname) {
	const interfaces = uci.sections('network', 'interface');

	for (let intf of interfaces) {
		const old_ifnames = L.toArray(intf.ifname);
		const new_ifnames = [];
		let changed = false;

		for (let oif of old_ifnames) {
			if (oif == old_ifname) {
				new_ifnames.push(new_ifname);
				changed = true;
			}
			else {
				new_ifnames.push(oif);
			}
		}

		if (changed) {
			uci.set('network', intf['.name'], 'ifname', new_ifnames.join(' '));

			ui.addNotification(null, E('p', _('Interface %q device auto-migrated from %q to %q.')
				.replace(/%q/g, '"%s"').format(intf['.name'], old_ifname, new_ifname)));
		}
	}
}

function render_port_status(node, portstate) {
	if (!node)
		return null;

	if (!portstate || !portstate.link)
		dom.content(node, [
			E('img', { src: L.resource('icons/port_down.svg') }),
			E('br'),
			_('no link')
		]);
	else
		dom.content(node, [
			E('img', { src: L.resource('icons/port_up.svg') }),
			E('br'),
			'%d'.format(portstate.speed) + _('baseT'),
			E('br'),
			portstate.duplex ? _('full-duplex') : _('half-duplex')
		]);

	return node;
}

function update_port_status(topologies) {
	const tasks = [];

	for (let switch_name in topologies)
		tasks.push(callSwconfigPortState(switch_name).then(L.bind(function(switch_name, ports) {
			for (let p of ports) {
				const node = document.querySelector('[data-switch="%s"][data-port="%d"]'.format(switch_name, p.port));
				render_port_status(node, p);
			}
		}, topologies[switch_name], switch_name)));

	return Promise.all(tasks);
}

const callSwconfigFeatures = rpc.declare({
	object: 'luci',
	method: 'getSwconfigFeatures',
	params: [ 'switch' ],
	expect: { '': {} }
});

const callSwconfigPortState = rpc.declare({
	object: 'luci',
	method: 'getSwconfigPortState',
	params: [ 'switch' ],
	expect: { result: [] }
});

return view.extend({
	load() {
		return network.getSwitchTopologies().then(function(topologies) {
			const tasks = [];

			for (let switch_name in topologies) {
				tasks.push(callSwconfigFeatures(switch_name).then(L.bind(function(features) {
					this.features = features;
				}, topologies[switch_name])));
				tasks.push(callSwconfigPortState(switch_name).then(L.bind(function(ports) {
					this.portstate = ports;
				}, topologies[switch_name])));
			}

			return Promise.all(tasks).then(function() { return topologies });
		});
	},

	render(topologies) {
		let m, s, o;

		m = new form.Map('network', _('Switch'), _("The network ports on this device can be combined to several <abbr title='Virtual Local Area Network'>VLAN</abbr>s in which computers can communicate directly with each other. <abbr title='Virtual Local Area Network'>VLAN</abbr>s are often used to separate different network segments. Often there is by default one Uplink port for a connection to the next greater network like the internet and other ports for a local network."));

		const switchSections = uci.sections('network', 'switch');

		for (let switchSection of switchSections) {
			const sid           = switchSection['.name'];
			const switch_name   = switchSection.name || sid;
			let   topology      = topologies[switch_name];

			if (!topology) {
				ui.addNotification(null, _('Switch %q has an unknown topology - the VLAN settings might not be accurate.').replace(/%q/, switch_name));

				topologies[switch_name] = topology = {
					features: {},
					netdevs: {
						5: 'eth0'
					},
					ports: [
						{ num: 0, label: 'Port 1' },
						{ num: 1, label: 'Port 2' },
						{ num: 2, label: 'Port 3' },
						{ num: 3, label: 'Port 4' },
						{ num: 4, label: 'Port 5' },
						{ num: 5, label: 'CPU (eth0)', device: 'eth0', need_tag: false }
					]
				};
			}

			const feat = topology.features;
			const min_vid = feat.min_vid || 0;
			const num_vlans = feat.num_vlans || 16;
			let   switch_title = _('Switch %q').replace(/%q/, '"%s"'.format(switch_name));
			let   vlan_title = _('VLANs on %q').replace(/%q/, '"%s"'.format(switch_name));

			if (feat.switch_title) {
				switch_title += ' (%s)'.format(feat.switch_title);
				vlan_title += ' (%s)'.format(feat.switch_title);
			}

			s = m.section(form.NamedSection, sid, 'switch', switch_title);
			s.addremove = false;

			if (feat.vlan_option) {
				o = s.option(form.Flag, feat.vlan_option, _('Enable VLAN functionality'));
				o.rmempty = false;
			}

			if (feat.learning_option) {
				o = s.option(form.Flag, feat.learning_option, _('Enable learning and aging'));
				o.default = o.enabled;
			}

			if (feat.jumbo_option) {
				o = s.option(form.Flag, feat.jumbo_option, _('Enable Jumbo Frame passthrough'));
				o.enabled = '3';
				o.rmempty = true;
			}

			if (feat.mirror_option) {
				s.option(form.Flag, 'enable_mirror_rx', _('Enable mirroring of incoming packets'));
				s.option(form.Flag, 'enable_mirror_tx', _('Enable mirroring of outgoing packets'));

				const sp = s.option(form.ListValue, 'mirror_source_port', _('Mirror source port'));
				const mp = s.option(form.ListValue, 'mirror_monitor_port', _('Mirror monitor port'));

				sp.depends('enable_mirror_rx', '1');
				sp.depends('enable_mirror_tx', '1');

				mp.depends('enable_mirror_rx', '1');
				mp.depends('enable_mirror_tx', '1');

				for (let tp of topology.ports) {
					sp.value(tp.num, tp.label);
					mp.value(tp.num, tp.label);
				}
			}

			s = m.section(form.TableSection, 'switch_vlan', vlan_title);
			s.anonymous = true;
			s.addremove = true;
			s.addbtntitle = _('Add VLAN');
			s.topology = topology;
			s.device = switch_name;

			s.filter = function(section_id) {
				const device = uci.get('network', section_id, 'device');
				return (device == this.device);
			};

			s.cfgsections = function() {
				const sections = form.TableSection.prototype.cfgsections.apply(this);

				return sections.sort(function(a, b) {
					let vidA = feat.vid_option ? uci.get('network', a, feat.vid_option) : null;
					let vidB = feat.vid_option ? uci.get('network', b, feat.vid_option) : null;

					vidA = +(vidA != null ? vidA : uci.get('network', a, 'vlan') || 9999);
					vidB = +(vidB != null ? vidB : uci.get('network', b, 'vlan') || 9999);

					return (vidA - vidB);
				});
			};

			s.handleAdd = function(ev) {
				const sections = uci.sections('network', 'switch_vlan');
				const section_id = uci.add('network', 'switch_vlan');
				let max_vlan = 0;
				let max_vid = 0;

				for (let s of sections) {
					if (s.device != this.device)
						continue;

					const vlan = +s.vlan;
					const vid = feat.vid_option ? +s[feat.vid_option] : null;

					if (vlan > max_vlan)
						max_vlan = vlan;

					if (vid > max_vid)
						max_vid = vid;
				}

				uci.set('network', section_id, 'device', this.device);
				uci.set('network', section_id, 'vlan', max_vlan + 1);

				if (feat.vid_option)
					uci.set('network', section_id, feat.vid_option, max_vid + 1);

				return this.map.save(null, true);
			};

			o = s.option(form.Value, feat.vid_option || 'vlan', 'VLAN ID');
			o.rmempty = false;
			o.forcewrite = true;
			o.vlan_used = {};
			o.datatype = 'range(%u,%u)'.format(min_vid, feat.vid_option ? 4094 : num_vlans - 1);
			o.description = _('Port status:');

			o.validate = function(section_id, value) {
				const v = +value;
				const m = feat.vid_option ? 4094 : num_vlans - 1;

				if (isNaN(v) || v < min_vid || v > m)
					return _('Invalid VLAN ID given! Only IDs between %d and %d are allowed.').format(min_vid, m);

				const sections = this.section.cfgsections();

				for (let s of sections) {
					if (s == section_id)
						continue;

					if (this.formvalue(s) == v)
						return _('Invalid VLAN ID given! Only unique IDs are allowed');
				}

				return true;
			};

			const port_opts = o.port_opts = [];

			o.write = function(section_id, value) {
				const topology = this.section.topology;
				const values = [];

				for (let i = 0; i < this.port_opts.length; i++) {
					const tagging = this.port_opts[i].formvalue(section_id);
					const portspec = Array.isArray(topology.ports) ? topology.ports[i] : null;

					if (tagging == 't')
						values.push(this.port_opts[i].option + tagging);
					else if (tagging == 'u')
						values.push(this.port_opts[i].option);

					if (portspec && portspec.device) {
						const old_tag = this.port_opts[i].cfgvalue(section_id);
						const old_vid = this.cfgvalue(section_id);

						if (old_tag != tagging || old_vid != value) {
							const old_ifname = portspec.device + (old_tag != 'u' ? '.' + old_vid : '');
							const new_ifname = portspec.device + (tagging != 'u' ? '.' + value : '');

							if (old_ifname != new_ifname)
								update_interfaces(old_ifname, new_ifname);
						}
					}
				}

				if (feat.vlan4k_option)
					uci.set('network', sid, feat.vlan4k_option, '1');

				uci.set('network', section_id, 'ports', values.join(' '));

				return form.Value.prototype.write.apply(this, [section_id, value]);
			};

			o.cfgvalue = function(section_id) {
				const value = feat.vid_option ? uci.get('network', section_id, feat.vid_option) : null;
				return (value || uci.get('network', section_id, 'vlan'));
			};

			s.option(form.Value, 'description', _('Description'));

			for (let j = 0; Array.isArray(topology.ports) && j < topology.ports.length; j++) {
				const portspec = topology.ports[j];
				const portstate = Array.isArray(topology.portstate) ? topology.portstate[portspec.num] : null;

				o = s.option(form.ListValue, String(portspec.num), portspec.label);
				o.value('', _('off'));

				if (!portspec.need_tag)
					o.value('u', _('untagged'));

				o.value('t', _('tagged'));

				o.cfgvalue = parse_portvalue;
				o.validate = validate_portvalue;
				o.write    = function() {};

				o.description = render_port_status(E('small', {
					'data-switch': switch_name,
					'data-port': portspec.num
				}), portstate);

				port_opts.push(o);
			}

			port_opts.sort(function(a, b) {
				return a.option > b.option;
			});
		}

		poll.add(L.bind(update_port_status, m, topologies));

		return m.render();
	}
});
