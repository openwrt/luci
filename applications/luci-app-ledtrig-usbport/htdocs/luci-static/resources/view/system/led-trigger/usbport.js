'use strict';
'require baseclass';
'require rpc';
'require uci';
'require form';

const callUSB = rpc.declare({
	object: 'luci',
	method: 'getUSBDevices',
	expect: { 'ports': [] }
});

return baseclass.extend({
	trigger: _('USB (kernel: usbport)'),
	description: _('This LED trigger can be used for signalling to the user a presence of USB device in a given port.'),
	kernel: true,
	addFormOptions(s){
		var o;

		o = s.option(form.MultiValue, 'port', _('USB Ports'));
		o.depends('trigger', 'usbport');
		o.rmempty = true;
		o.modalonly = true;
		o.load = function(s) {
			return Promise.all([
				callUSB()
			]).then(L.bind(function(usbport){
				for (var i = 0; i < usbport[0].length; i++)
					o.value(usbport[0][i].port, _('Port %s').format(usbport[0][i].port));
			},this));
		};
		o.cfgvalue = function(section_id) {
			var ports = [],
				value = uci.get('system', section_id, 'port');

			if (!Array.isArray(value))
				value = String(value || '').split(/\s+/);

			for (var i = 0; i < value.length; i++)
				if (value[i].match(/^(\d+)-(\d+)$/))
					ports.push('usb%d-port%d'.format(Regexp.$1, Regexp.$2));
				else
					ports.push(value[i]);

			return ports;
		};
	}
});
