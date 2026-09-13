'use strict';
'require form';
'require fs';
'require view';
'require uci';

function disk(devs, options, section_id) {
	var v = uci.get('hd-idle', section_id, 'disk') || '';
	var disk = devs.find(function(itm){ return itm.name == v; });
	var out = '';
	if(disk != undefined){
		out = options.map(function(opt){ return disk[opt]?.trim() || null; });
		out = out.filter(function(o){ return o != ''; });
		out = out.join(' ');
	}
	return E('span', out);
}

function prettytime(section_id) {
	return E('span', (uci.get('hd-idle', section_id, 'idle_time_interval') || '')
			 + ' '
			 + (uci.get('hd-idle', section_id, 'idle_time_unit') || ''));
}

return view.extend({
	load: function() {
		return fs.exec("/usr/bin/lsblk", ["-n", "-J", "-do", "NAME,TRAN,ROTA,RM,VENDOR,MODEL"]).then(function(res) {
			if( res.code )
				return [];
			var json = JSON.parse(res.stdout);
			return ( 'blockdevices' in json ) ? json['blockdevices'] : [];
		});
	},

	render: function(devs) {
		let m, s, o;
		m = new form.Map('hd-idle', _('HDD Idle'), _('HDD Idle is a utility program for spinning-down disks after a period of idle time.'));

		s = m.section(form.GridSection, 'hd-idle', _('Settings'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable  = true;
		s.addbtntitle = _('Add new hdd setting...');


		s.tab('general', _('Disk Settings'));


		o = s.taboption('general', form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;
		o.editable = true;

		o = s.taboption('general', form.ListValue, 'disk', _('Disk'));
		devs.forEach(function(dev) {
			if( dev.rota ) {
				o.value(dev.name, `/dev/${dev.name} [${dev.tran}:${dev.vendor} ${dev.model}]`);
			}
		});


		o = s.taboption('general', form.Value, '_bus', _('Bus'));
		o.rawhtml = true;
		o.write = function() {};
		o.remove = function() {};
		o.modalonly = false;
		o.textvalue = disk.bind(o, devs, ['tran']);

		o = s.taboption('general', form.Value, '_vendorModel', _('Vendor / Model'));
		o.rawhtml = true;
		o.write = function() {};
		o.remove = function() {};
		o.modalonly = false;
		o.textvalue = disk.bind(o, devs, ['vendor', 'model'] );

		o = s.taboption('general', form.Value, 'idle_time_interval', _('Idle time'));
		o.modalonly = true;
		o.default = 10;

		o = s.taboption('general', form.ListValue, 'idle_time_unit', _('Idle time unit'));
		o.modalonly = true;
		o.value('seconds', _('seconds', 'Abbreviation for seconds'));
		o.value('minutes', _('minutes', 'Abbreviation for minutes'));
		o.value('hours', _('hours', 'Abbreviation for hours'));
		o.value('days', _('days', 'Abbreviation for days'));
		o.default = 'minutes';

		o = s.taboption('general', form.Value, '_prettytime', _('Idle time'));
		o.rawhtml = true;
		o.write = function() {};
		o.remove = function() {};
		o.modalonly = false;
		o.textvalue = prettytime.bind(o);

		return m.render();
	}
});
