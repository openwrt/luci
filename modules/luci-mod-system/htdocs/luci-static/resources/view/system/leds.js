'use strict';
'require uci';
'require rpc';
'require form';

var callInitAction, callLeds, callUSB, callNetdevs;

callInitAction = rpc.declare({
	object: 'luci',
	method: 'initCall',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

callLeds = rpc.declare({
	object: 'luci',
	method: 'leds'
});

callUSB = rpc.declare({
	object: 'luci',
	method: 'usb'
});

callNetdevs = rpc.declare({
	object: 'luci',
	method: 'ifaddrs',
	expect: { result: [] },
	filter: function(res) {
		var devs = {};
		for (var i = 0; i < res.length; i++)
			devs[res[i].name] = true;
		return Object.keys(devs).sort();
	}
});

return L.view.extend({
	load: function() {
		return Promise.all([
			callLeds(),
			callUSB(),
			callNetdevs()
		]);
	},

	render: function(results) {
		var leds = results[0],
		    usb = results[1],
		    netdevs = results[2],
		    triggers = {},
		    trigger, m, s, o;

		for (var k in leds)
			for (var i = 0; i < leds[k].triggers.length; i++)
				triggers[leds[k].triggers[i]] = true;

		m = new form.Map('system',
			_('<abbr title="Light Emitting Diode">LED</abbr> Configuration'),
			_('Customizes the behaviour of the device <abbr title="Light Emitting Diode">LED</abbr>s if possible.'));

		s = m.section(form.TypedSection, 'led', '');
		s.anonymous = true;
		s.addremove = true;

		s.option(form.Value, 'name', _('Name'));

		o = s.option(form.ListValue, 'sysfs', _('<abbr title="Light Emitting Diode">LED</abbr> Name'));
		Object.keys(leds).sort().forEach(function(name) { o.value(name) });

		o = s.option(form.Flag, 'default', _('Default state'));
		o.rmempty = false;

		trigger = s.option(form.ListValue, 'trigger', _('Trigger'));
		Object.keys(triggers).sort().forEach(function(t) { trigger.value(t, t.replace(/-/g, '')) });
		if (usb.devices && usb.devices.length)
			trigger.value('usbdev');
		if (usb.ports && usb.ports.length)
			trigger.value('usbport');

		o = s.option(form.Value, 'delayon', _('On-State Delay'));
		o.depends('trigger', 'timer');

		o = s.option(form.Value, 'delayoff', _('Off-State Delay'));
		o.depends('trigger', 'timer');

		o = s.option(form.ListValue, '_net_dev', _('Device'));
		o.rmempty = true;
		o.ucioption = 'dev';
		o.depends('trigger', 'netdev');
		o.remove = function(section_id) {
			var t = trigger.formvalue(section_id);
			if (t != 'netdev' && t != 'usbdev')
				uci.unset('system', section_id, 'dev');
		};
		o.value('');
		netdevs.sort().forEach(function(dev) { o.value(dev) });

		o = s.option(form.MultiValue, 'mode', _('Trigger Mode'));
		o.rmempty = true;
		o.depends('trigger', 'netdev');
		o.value('link', _('Link On'));
		o.value('tx', _('Transmit'));
		o.value('rx', _('Receive'));

		if (usb.devices && usb.devices.length) {
			o = s.option(form.ListValue, '_usb_dev', _('USB Device'));
			o.depends('trigger', 'usbdev');
			o.rmempty = true;
			o.ucioption = 'dev';
			o.remove = function(section_id) {
				var t = trigger.formvalue(section_id);
				if (t != 'netdev' && t != 'usbdev')
					uci.unset('system', section_id, 'dev');
			}
			o.value('');
			usb.devices.forEach(function(usbdev) {
				o.value(usbdev.id, '%s (%s - %s)'.format(usbdev.id, usbdev.vendor || '?', usbdev.product || '?'));
			});
		}

		if (usb.ports && usb.ports.length) {
			o = s.option(form.MultiValue, 'port', _('USB Ports'));
			o.depends('trigger', 'usbport');
			o.rmempty = true;
			o.cfgvalue = function(section_id) {
				var ports = [],
				    value = uci.get('system', section_id, 'port');

				if (!Array.isArray(value))
					value = String(value || '').split(/\s+/);

				for (var i = 0; i < value.length; i++)
					if (value[i].match(/^usb(\d+)-port(\d+)$/))
						ports.push(value[i]);
					else if (value[i].match(/^(\d+)-(\d+)$/))
						ports.push('usb%d-port%d'.format(Regexp.$1, Regexp.$2));

				return ports;
			};
			usb.ports.forEach(function(usbport) {
				o.value('usb%d-port%d'.format(usbport.hub, usbport.port),
				        'Hub %d, Port %d'.format(usbport.hub, usbport.port));
			});
		}

		o = s.option(form.Value, 'port_mask', _('Switch Port Mask'));
		o.depends('trigger', 'switch0');
		o.depends('trigger', 'switch1');

		return m.render();
	}
});
