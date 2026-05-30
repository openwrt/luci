'use strict';
'require form';
'require view';
'require network';
'require ui';
'require tools.widgets as widgets';

const CBIBindSelect = form.ListValue.extend({
	__name__: 'CBI.CBIBindSelect',

	load(section_id) {
		return Promise.all([
			network.getDevices(),
			this.noaliases ? null : network.getNetworks()
		]).then(L.bind(function(data) {
			this.devices = data[0];
			this.networks = data[1];

			return this.super('load', section_id);
		}, this));
	},

	filter(section_id, value) {
		return true;
	},

	renderWidget(section_id, option_index, cfgvalue) {
		let values = L.toArray((cfgvalue != null) ? cfgvalue : this.default);
		const choices = {};
		const checked = {};
		const order = [];

		for (let v of values)
			checked[v] = true;

		values = [];

		if (!this.multiple && (this.rmempty || this.optional))
			choices[''] = E('em', _('unspecified'));

		for (let device of this.devices) {
			const name = device.getName();
			const type = device.getType();

			if (name == 'lo' || name == this.exclude || !this.filter(section_id, name))
				continue;

			if (this.noaliases && type == 'alias')
				continue;

			if (this.nobridges && type == 'bridge')
				continue;

			if (this.noinactive && device.isUp() == false)
				continue;

			const item = E([
				E('img', {
					'title': device.getI18n(),
					'src': L.resource('icons/%s%s.svg'.format(type, device.isUp() ? '' : '_disabled'))
				}),
				E('span', { 'class': 'hide-open' }, [ name ]),
				E('span', { 'class': 'hide-close'}, [ device.getI18n() ])
			]);

			const networks = device.getNetworks();

			if (networks.length > 0)
				L.dom.append(item.lastChild, [ ' (', networks.map(function(n) { return n.getName() }).join(', '), ')' ]);

			if (checked[name])
				values.push(name);

			choices[name] = item;
			order.push(name);
		}

		if (this.networks != null) {
			for (let net of this.networks) {
				const device = network.instantiateDevice('@%s'.format(net.getName()), net);
				const name = device.getName();

				if (name == '@loopback' || name == this.exclude || !this.filter(section_id, name))
					continue;

				if (this.noinactive && net.isUp() == false)
					continue;

				const item = E([
					E('img', {
						'title': device.getI18n(),
						'src': L.resource('icons/alias%s.svg'.format(net.isUp() ? '' : '_disabled'))
					}),
					E('span', { 'class': 'hide-open' }, [ name ]),
					E('span', { 'class': 'hide-close'}, [ device.getI18n() ])
				]);

				if (checked[name])
					values.push(name);

				choices[name] = item;
				order.push(name);
			}
		}

		if (!this.nocreate) {
			const keys = Object.keys(checked).sort(L.naturalCompare);

			for (let key of keys) {
				if (choices.hasOwnProperty(key))
					continue;

				choices[key] = E([
					E('img', {
						'title': _('Absent Interface'),
						'src': L.resource('icons/ethernet_disabled.svg')
					}),
					E('span', { 'class': 'hide-open' }, [ key ]),
					E('span', { 'class': 'hide-close'}, [ '%s: "%h"'.format(_('Absent Interface'), key) ])
				]);

				values.push(key);
				order.push(key);
			}
		}

		const widget = new ui.Dropdown(this.multiple ? values : values[0], choices, {
			id: this.cbid(section_id),
			sort: order,
			multiple: this.multiple,
			optional: this.optional || this.rmempty,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			select_placeholder: E('em', _('unspecified')),
			custom_placeholder: this.placeholder || _('custom'),
			display_items: this.display_size || this.size || 3,
			dropdown_items: this.dropdown_size || this.size || 5,
			validate: L.bind(this.validate, this, section_id),
			create: !this.nocreate,
			create_markup: '' +
				'<li data-value="{{value}}">' +
					'<span class="hide-open">{{value}}</span>' +
					'<span class="hide-close">'+_('Custom Value')+': "{{value}}"</span>' +
				'</li>'
		});

		return widget.render();
	},
});

return view.extend({
	render () {
		let m, s, o;

		m = new form.Map('udpxy', _('udpxy'),
			_('udpxy is an IPTV stream relay, a UDP-to-HTTP multicast traffic relay daemon which forwards multicast UDP streams to HTTP clients.'));

		s = m.section(form.TypedSection, 'udpxy');
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, 'disabled', _('Enabled'));
		o.enabled = '0';
		o.disabled = '1';
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Flag, 'respawn', _('Respawn'));
		o.default = o.disabled;

		o = s.option(form.Flag, 'verbose', _('Verbose logging'));
		o.default = o.disabled;

		o = s.option(form.Flag, 'status', _('Client statistics'));

		o = s.option(CBIBindSelect, 'bind', _('HTTP Listen interface'));
		o.datatype = 'or(ip4addr, device)';
		o.placeholder = '0.0.0.0 || br-lan';

		o = s.option(form.Value, 'port', _('Port'), _('Default') + ' : ' + '%s'.format('4022'));
		o.datatype = 'port';
		o.placeholder = '4022';

		o = s.option(widgets.NetworkSelect, 'source_network',
			_('Multicast subscribe Source Network'),
			_('When the network is reloaded, the udpxy is reloaded'),
		);
		o.datatype = 'network';

		o = s.option(CBIBindSelect, 'source',
			_('Multicast subscribe source interface'),
			_('Default') + ' : ' + '%s'.format('0.0.0.0'),
		);
		o.datatype = 'or(ip4addr, device)';
		o.placeholder = '0.0.0.0 || lan1';

		o = s.option(form.Value, 'max_clients', _('Client amount upper limit'));
		o.datatype = 'range(1, 5000)';

		o = s.option(form.Value, 'log_file', _('Log file'), _('Default') + ' : <code>/var/log/udpxy</code>');
		o.placeholder = '/var/log/udpxy';

		o = s.option(form.Value, 'buffer_size', _('Ingress buffer size'), _('Unit: bytes, Kb, Mb; Max 2097152 bytes'));
		o.placeholder = '4Kb';

		o = s.option(form.Value, 'buffer_messages', _('Buffer message amount'), _('-1 is all.'));
		o.datatype = 'or(-1, and(min(1),uinteger))';
		o.placeholder = '1';

		o = s.option(form.Value, 'buffer_time', _('Buffer time limit'), _('-1 is unlimited.'));
		o.datatype = 'or(-1, and(min(1),uinteger))';
		o.placeholder = '1';

		o = s.option(form.Value, 'nice_increment', _('Nice increment'));
		o.datatype = 'or(and(max(-1),uinteger), and(min(1),uinteger))';
		o.placeholder = '0';

		o = s.option(form.Value, 'mcsub_renew', _('Renew multicast subscription periodicity'), _('Unit: seconds; 0 is skip.'));
		o.datatype = 'or(0, range(30, 64000))';
		o.placeholder = '0';

		return m.render();
	}
});
