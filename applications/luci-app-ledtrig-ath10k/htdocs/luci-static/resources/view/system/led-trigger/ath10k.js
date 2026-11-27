'use strict';
'require baseclass';
'require form';
'require fs';
'require uci';

return baseclass.extend({
	trigger: _('Wireless trigger (ath10k)'),
	description: _('This LED trigger can be used for signalling the wireless state.'),
	kernel: false,
	addFormOptions(s){
		var o;
		var device;

		device = s.option(form.ListValue, 'ath10k_device', _('Device'));
		device.modalonly = true;
		device.ucioption = "device";
		device.depends('trigger', 'ath10k');
		device.load = function(s) {
			return Promise.all([
				L.resolveDefault(fs.list('/sys/class/ieee80211/'), '')
			]).then(L.bind(function(devices){
				var phys = devices[0];
				for (var i = 0; i < phys.length; i++)
					device.value(phys[i].name);
			}, this));
		};
		device.cfgvalue = function (section_id) {
			return uci.get('system', section_id, 'device');
		}

		o = s.option(form.ListValue, 'ath10k_function', _('Trigger'));
		o.modalonly = true;
		o.ucioption = "function";
		o.depends('trigger', 'ath10k');
		o.value('assoc', _('Client connected (assoc)'));
		o.value('radio', _('Interface enabled (radio)'));
		o.value('rx', _('Activity (rx)'));
		o.value('tx', _('Activity (tx)'));
		o.value('tpt', _('Throughput activity (tpt)'));
		o.cfgvalue = function (section_id) {
			return uci.get('system', section_id, 'function');
		}
	}
});
