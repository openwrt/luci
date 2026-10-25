'use strict';
'require view';
'require form';
'require network';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			network.getNetworks(),
			network.getDevices()
		]);
	},

	render: function(data) {
		var m, s, o;
		var networks = data[0] || [];
		var devices = data[1] || [];
		var ifaceMap = {};

		m = new form.Map('smart-reboot', _('Smart Reboot'),
			_('Reboot only when the network is idle at the configured dawn time.'));

		s = m.section(form.TypedSection, 'settings', _('Settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.DummyValue, 'last_auto_reboot', _('Last automatic reboot'));
		o.cfgvalue = function(section_id) {
			return uci.get('smart-reboot', section_id, 'last_auto_reboot') || _('Never');
		};

		o = s.option(form.Value, 'time', _('Reboot time (HH:MM)'));
		o.placeholder = '04:00';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (!value || !value.match(/^([01][0-9]|2[0-3]):[0-5][0-9]$/))
				return _('Time format must be HH:MM (24-hour). Example: 04:00');

			return true;
		};

		o = s.option(form.Flag, 'all_ifaces', _('Select all interfaces'));
		o.rmempty = false;

		o = s.option(form.MultiValue, 'ifaces', _('Monitored interfaces'));
		o.widget = 'select';
		o.size = 8;
		o.depends('all_ifaces', '0');
		o.depends('all_ifaces', '');

		networks.forEach(function(netif) {
			var logical = netif.getName();
			var dev = netif.getL3Device() || netif.getL2Device() || netif.getDevice();
			var ifname = dev && dev.getName ? dev.getName() : null;

			if (!ifname || ifname === 'lo')
				return;

			ifaceMap[ifname] = ifaceMap[ifname] || { labels: [] };
			if (logical && ifaceMap[ifname].labels.indexOf(logical) < 0)
				ifaceMap[ifname].labels.push(logical);
		});

		(devices || []).forEach(function(dev) {
			var name = dev.getName();
			if (!name || name === 'lo')
				return;

			ifaceMap[name] = ifaceMap[name] || { labels: [] };
		});

		Object.keys(ifaceMap).sort().forEach(function(ifname) {
			var labels = ifaceMap[ifname].labels;
			var text = labels.length ? '%s (%s)'.format(labels.join(', '), ifname) : ifname;
			o.value(ifname, text);
		});

		o = s.option(form.Value, 'sample_seconds', _('Idle sampling duration (seconds)'));
		o.datatype = 'uinteger';
		o.placeholder = '120';
		o.rmempty = false;

		o = s.option(form.Value, 'byte_threshold', _('Idle threshold (bytes)'));
		o.datatype = 'uinteger';
		o.placeholder = '262144';
		o.rmempty = false;

		return m.render();
	}
});
