// Copyright (c) 2016, prpl Foundation
//
// Permission to use, copy, modify, and/or distribute this software for any purpose with or without
// fee is hereby granted, provided that the above copyright notice and this permission notice appear
// in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE
// INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
// FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
// LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
// ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
//
// Author: Nils Koenig <openwrt@newk.it>
// JS version: Ramon van Gorkom 


'use strict';
'require view';
'require form';
'require fs';
'require uci';

function timeValidator(value, desc) {
	if (value !== null) {
		const matches = value.match(/^(\d\d?):(\d\d?)$/);
		if (matches) {
			const h = parseInt(matches[1], 10);
			const m = parseInt(matches[2], 10);
			if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
				return true;
			}
		}
	}
	return _('The value %s is invalid'.format(desc));
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/sbin/wifi'), null),
			L.resolveDefault(fs.stat('/usr/bin/wifi_schedule.sh'), null),
			L.resolveDefault(fs.exec_direct('/usr/bin/wifi_schedule.sh', [ 'getmodules' ]), null),
			L.resolveDefault(fs.stat('/usr/bin/iwinfo'), null)
		]);
	},


	render: function (data) {
		var m, s, o, oUnloadmodules, oModules;

		m = new form.Map('wifi_schedule', _('Wifi Schedule'),_('Defines a schedule when to turn on and off wifi.'));

		s = m.section(form.TypedSection, 'global', _('Manual control'));
		s.optional = false;
		s.rmempty = false;
		s.anonymous = true;

		o = s.option(form.Button, '', _('Activate wifi'));
		o.onclick = function (section, value) {
			fs.exec('/usr/bin/wifi_schedule.sh', ['start', 'manual']);
		}

		o = s.option(form.Button, '', _('Disable wifi gracefully'));
		o.onclick = function (section, value) {
			fs.exec('/usr/bin/wifi_schedule.sh', ['stop', 'manual']);
		}

		o = s.option(form.Button, '', _('Disable wifi forced'));
		o.onclick = function (section, value) {
			fs.exec('/usr/bin/wifi_schedule.sh', ['forcestop', 'manual']);
		}

		s = m.section(form.TypedSection, 'global', _('Global Settings'));
		s.optional = false;
		s.rmempty = false;
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable Wifi Schedule'));
		o.optional = false;
		o.rmempty = false;
		o.validate = function(section_id, value) {
			return value !== '1' || (data[0] && data[1]) ? true : _('Could not find required /usr/bin/wifi_schedule.sh or /sbin/wifi');
		};


		o = s.option(form.Flag, 'logging', _('Enable logging'));
		o.optional = false;
		o.rmempty = false;
		o.default = 0;

		o = s.option(form.Flag, 'unload_modules', _('Unload Modules (experimental; saves more power)'));
		o.optional = false;
		o.rmempty = false;
		o.default = 0;

		o = s.option(form.TextValue, 'modules', 'Modules to unload')
		o.depends('unload_modules', '1');
		o.wrap = 'off';
		o.rows = 10;
		o.cfgvalue = function (section) {
			let mod = uci.get('wifi_schedule', section, 'modules');
			if (!mod) mod = "";
			return mod.replace(/ /g, "\r\n");
		}
		o.write = function (section, value) {
			var valueList = value.replace(/[\r\n]+/g, " ").replace(/\s+$/, '');
			return uci.set('wifi_schedule', section, 'modules', valueList);
		}

		o = s.option(form.DummyValue, 'detectedmodules', _('Modules detected'));
		o.depends('unload_modules', '1');
		o.default = data[2];

		s = m.section(form.TypedSection, 'entry', _('Schedule events'));
		s.addremove = true;

		o = s.option(form.Flag, 'enabled', _('Enable mode'));
		o.rmempty = false;
		o.optional = false;

		o = s.option(form.MultiValue, 'daysofweek', _('Day(s) of Week'));
		o.rmempty = false;
		o.optional = false;
		o.modalonly = true;
		o.multiple = true;
		o.size = 7;
		o.value('Monday',_('Monday'));
		o.value('Tuesday',_('Tuesday'));
		o.value('Wednesday',_('Wednesday'));
		o.value('Thursday',_('Thursday'));
		o.value('Friday',_('Friday'));
		o.value('Saturday',_('Saturday'));
		o.value('Sunday',_('Sunday'));
		o.write = function(section_id, value) {
			return this.super('write', [ section_id, L.toArray(value).join(' ') ]);
		};

		o = s.option (form.Value, 'starttime', _('Start WiFi'));
		o.rmempty = false;
		o.optional = false;
		for (let hour = 0; hour <= 23; hour++) {
			o.value(`${hour.toString().padStart(2, '0')}:00`);
		}
		o.validate = function(section_id, value) {
			return timeValidator(value, _('Start Time'))
		};

		o = s.option (form.Value, 'stoptime', _('Stop WiFi'));
		o.rmempty = false;
		o.optional = false;
		for (let hour = 0; hour <= 23; hour++) {
			o.value(`${hour.toString().padStart(2, '0')}:00`);
		}
		o.validate = function(section_id, value) {
			return timeValidator(value, _('Stop Time'))
		};

		o = s.option(form.Flag, 'forcewifidown', _('Force disabling wifi even if stations associated'));
		o.default = false;
		o.rmempty = false;
		o.validate = function(section_id, value) {
			return value !== '0' || data[3] ? true : _("Could not find required program /usr/bin/iwinfo");
		};

		return m.render()
	},
	handleSaveApply: function (ev, mode) {
		var Fn = L.bind(function() {
			fs.exec('/usr/bin/wifi_schedule.sh', ['cron']);
			document.removeEventListener('uci-applied',Fn);
		});
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	},
});
