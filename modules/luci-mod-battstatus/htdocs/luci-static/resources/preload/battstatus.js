'use strict';
'require ui';
'require rpc';
'require poll';
'require baseclass';

const callBatteryStatus = rpc.declare({
	object: 'luci.battstatus',
	method: 'getBatteryStatus',
	expect: { '': {} }
});

const devices = {};

return baseclass.extend({
	__init__() {
		this.updateIndicator();
		poll.add(L.bind(this.updateIndicator, this), 5);
	},

	updateIndicator() {
		return callBatteryStatus().then(L.bind(function(devs) {
			for (let dev in devs) {
				let info = devs[dev];
				if (info.valid) {
					info.status = (info.charging ? _('Charging') : _('Not Charging')) + ": " + info.percentage + "%";
					info.state = "active";
					if (info.percentage <= 20)
						info.color = "Red";
					else if (info.percentage <= 30)
						info.color = "GoldenRod";
				} else {
					info.status = info.message;
					info.state = "inactive";
				}

				info.name = "battery-" + dev.replace(" ", "-");
				ui.showIndicator(info.name, info.status, null, info.state);
				if (typeof info.color != 'undefined') {
					info.element = document.querySelector('[data-indicator="${info.name}"]');
					info.element.innerHTML = '<span style="color:${info.color}">${info.status}</span>';
				}

				devices[dev] = info;
			}

			for (let dev in devices) {
				if (!devs.hasOwnProperty(dev)) {
					ui.hideIndicator('battery-%s'.format(dev));
					delete devices[dev];
				}
			}
		}, this));
	}
});
