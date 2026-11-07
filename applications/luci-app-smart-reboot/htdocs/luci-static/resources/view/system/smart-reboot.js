'use strict';
'require view';
'require form';
'require network';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			network.getNetworks(),
			network.getDevices(),
			fs.read_direct('/etc/smart-reboot.date').catch(function() { return null; })
		]);
	},

	render: function(data) {
		var m, s, o;
		var networks = data[0] || [];
		var devices = data[1] || [];
		var lastReboot = (data[2] || '').trim();
		var seen = {};

		m = new form.Map('smart-reboot', _('Smart Reboot'),
			_('Automatically reboot the router during the configured dawn time window when network traffic is idle.'));

		s = m.section(form.TypedSection, 'settings', _('Settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.DummyValue, '_last_reboot', _('Last automatic reboot'));
		o.rawhtml = false;
		o.cfgvalue = function() {
			return lastReboot || _('Never');
		};

		o = s.option(form.Value, 'window_start', _('Dawn window start (HH:MM)'));
		o.placeholder = '03:00';
		o.default = '03:00';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (!value || !value.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/))
				return _('Time format must be HH:MM (24-hour). Example: 03:00');
			return true;
		};

		o = s.option(form.Value, 'window_end', _('Dawn window end (HH:MM)'));
		o.placeholder = '06:00';
		o.default = '06:00';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (!value || !value.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/))
				return _('Time format must be HH:MM (24-hour). Example: 06:00');
			return true;
		};

		o = s.option(form.Value, 'threshold_kb', _('Idle threshold (KB)'));
		o.datatype = 'uinteger';
		o.placeholder = '256';
		o.default = '256';
		o.rmempty = false;
		o.description = _('Maximum total traffic in KB allowed during the sampling period to be considered idle.');

		o = s.option(form.Value, 'sample_seconds', _('Sampling duration (seconds)'));
		o.datatype = 'min(10)';
		o.placeholder = '60';
		o.default = '60';
		o.rmempty = false;
		o.description = _('Duration in seconds to monitor traffic before making a reboot decision.');

		o = s.option(form.Value, 'check_interval', _('Retry interval (seconds)'));
		o.datatype = 'min(10)';
		o.placeholder = '300';
		o.default = '300';
		o.rmempty = false;
		o.description = _('Wait time before retrying if traffic is active within the dawn window.');

		o = s.option(form.MultiValue, 'ifaces', _('Monitored interfaces'));
		o.widget = 'select';
		o.size = 8;
		o.description = _('Leave unselected to automatically monitor active WAN interfaces.');
		o.value('all', _('[All] All network interfaces except loopback'));

		networks.forEach(function(netif) {
			var logical = netif.getName();
			if (!logical || logical === 'loopback')
				return;

			var dev = netif.getL3Device() || netif.getL2Device() || netif.getDevice();
			var ifname = dev && dev.getName ? dev.getName() : null;
			var label = (ifname && ifname !== logical)
				? '%s (%s)'.format(logical, ifname)
				: logical;

			o.value(logical, label);
			seen[logical] = true;
		});

		(devices || []).forEach(function(dev) {
			var name = dev.getName();
			if (!name || name === 'lo' || seen[name])
				return;

			o.value(name, name);
			seen[name] = true;
		});

		return m.render();
	}
});
