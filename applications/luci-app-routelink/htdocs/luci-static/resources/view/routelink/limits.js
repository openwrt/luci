'use strict';
'require view';
'require form';
'require poll';
'require uci';
'require ui';
'require routelink.common as rl';

/* Speed limits and data quotas (P4): the rules in UCI, the quotas' current use, letting a device through. */

var WEEKDAYS = [
	[ 'mon', _('Mon') ], [ 'tue', _('Tue') ], [ 'wed', _('Wed') ], [ 'thu', _('Thu') ],
	[ 'fri', _('Fri') ], [ 'sat', _('Sat') ], [ 'sun', _('Sun') ]
];
var PERIODS = { day: _('Daily'), week: _('Weekly'), month: _('Monthly') };
var STATES = { ok: _('OK'), warned: _('Over 80 %'), exceeded: _('Used up'), allowed: _('Let through') };
var STATE_COLORS = { ok: '#2e9e44', warned: '#f39c12', exceeded: '#d9534f', allowed: '#2f7ef6' };
var TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function validTime(value) {
	var ok = !value || TIME.test(value);
	return ok;
}

/* A MAC field with the known devices as choices; stored in capitals like the app does. */
function macOption(s, devices, byMac) {
	var o = s.option(form.Value, 'mac', _('Device'));
	o.datatype = 'macaddr';
	o.rmempty = false;
	rl.deviceChoices(o, devices);
	o.textvalue = function(section_id) {
		var mac = (this.cfgvalue(section_id) || '').toUpperCase();
		/* a table cell takes the text value as HTML */
		return mac ? '%h'.format(rl.deviceLabel(byMac[mac] || { mac: mac })) : '-';
	};
	o.write = function(section_id, value) {
		return form.Value.prototype.write.call(this, section_id, String(value).toUpperCase());
	};
	return o;
}

/* A choice's label instead of its value in the table. */
function listText(section_id) {
	var v = this.cfgvalue(section_id) || this.default, i = this.keylist.indexOf(v);
	return '%h'.format(i >= 0 ? this.vallist[i] : v);
}

function rateOption(s, name, title) {
	var o = s.option(form.Value, name, title);
	o.datatype = 'uinteger';
	o.placeholder = '0';
	o.textvalue = function(section_id) {
		return rl.formatKbps(this.cfgvalue(section_id));
	};
	return o;
}

return view.extend({
	load: function() {
		return Promise.all([
			rl.info(),
			L.resolveDefault(rl.devices(), []),
			L.resolveDefault(rl.quotas(), []),
			uci.load('routelink')
		]);
	},

	renderQuotas: function(quotas) {
		var self = this;
		if (!quotas.length)
			return E('p', { 'class': 'cbi-section-descr' }, _('No quota is set up.'));
		return E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Device')),
				E('th', { 'class': 'th' }, _('Period')),
				E('th', { 'class': 'th' }, _('Used')),
				E('th', { 'class': 'th' }, _('State')),
				E('th', { 'class': 'th' }, '')
			])
		].concat(quotas.map(function(q) {
			var state = E('span', { style: 'color:' + (STATE_COLORS[q.state] || 'inherit') }, [ STATES[q.state] || q.state ]);
			var actions = [];
			if (q.state === 'exceeded' || q.state === 'warned')
				actions.push(
					E('button', { 'class': 'btn cbi-button', click: ui.createHandlerFn(self, 'allow', q.section, 'hour') },
						_('Let through for an hour')), ' ',
					E('button', { 'class': 'btn cbi-button', click: ui.createHandlerFn(self, 'allow', q.section, 'period') },
						_('Until the period ends')));
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, [ rl.deviceLabel(self.byMac[q.mac] || { mac: q.mac }) ]),
				E('td', { 'class': 'td left' }, [ '%s · %s – %s'.format(PERIODS[q.period] || q.period,
					rl.formatTime(q.period_start), rl.formatTime(q.period_end)) ]),
				E('td', { 'class': 'td left', style: 'min-width:160px' }, [
					'%s / %s (%s%%)'.format(rl.formatBytes(q.used), rl.formatBytes(q.limit), q.pct), rl.bar(Math.min(q.used, q.limit), q.limit,
						STATE_COLORS[q.state])
				]),
				E('td', { 'class': 'td left' }, q.state === 'allowed' ?
					[ state, E('br'), E('small', {}, _('until %s').format(rl.formatTime(q.allow_until))) ] :
					[ state, E('br'), E('small', {}, q.action === 'limit' ? _('then slowed down') : _('then cut off')) ]),
				E('td', { 'class': 'td right' }, actions)
			]);
		})));
	},

	allow: function(section, until) {
		var self = this;
		return rl.quotaAllow(section, until).then(function() {
			return self.refreshQuotas();
		}).catch(function(e) {
			ui.addNotification(null, E('p', {}, [ _('Failed: %s').format(e.message) ]), 'error');
		});
	},

	refreshQuotas: function() {
		var self = this;
		return L.resolveDefault(rl.quotas(), []).then(function(q) {
			self.quotaBox.replaceChildren(self.renderQuotas(q));
		});
	},

	render: function(data) {
		var info = data[0], devices = data[1] || [], self = this;
		this.byMac = {};
		devices.forEach(function(d) { self.byMac[d.mac] = d; });

		var m = new form.Map('routelink', _('Limits & quotas'),
			_('Speed limits and data quotas per device. Limits work on the LAN ports of the router, also with software offloading; traffic in hardware offloading passes by them.'));

		var s = m.section(form.GridSection, 'limit', _('Speed limits'),
			_('Rates in kbit/s (8000 = 8 Mbit/s), 0 or empty = not limited. Without days the rule applies every day; without times the whole day. A time window that ends before it starts runs past midnight.'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add speed limit');

		var o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;
		o.rmempty = false;

		macOption(s, devices, this.byMac);
		o = rateOption(s, 'download', _('Download (kbit/s)'));
		o.validate = function(section_id, value) {
			var up = +(this.section.formvalue(section_id, 'upload') || 0);
			return +(value || 0) > 0 || up > 0 ? true : _('Set a download or an upload limit');
		};
		rateOption(s, 'upload', _('Upload (kbit/s)'));

		o = s.option(form.MultiValue, 'weekdays', _('Days'));
		WEEKDAYS.forEach(function(d) { o.value(d[0], d[1]); });
		o.placeholder = _('Every day');
		o.textvalue = function(section_id) {
			var v = L.toArray(this.cfgvalue(section_id));
			if (!v.length || v.length >= 7)
				return _('Every day');
			return WEEKDAYS.filter(function(d) { return v.indexOf(d[0]) >= 0; }).map(function(d) { return d[1]; }).join(' ');
		};

		o = s.option(form.Value, 'start_time', _('From'), _('HH:MM'));
		o.placeholder = '20:00';
		o.validate = function(section_id, value) {
			return validTime(value) ? true : _('Enter a time such as 20:00');
		};
		o.textvalue = function(section_id) {
			return '%h'.format(this.cfgvalue(section_id) || _('all day'));
		};
		o = s.option(form.Value, 'stop_time', _('Until'), _('HH:MM'));
		o.placeholder = '23:00';
		o.validate = function(section_id, value) {
			var start = this.section.formvalue(section_id, 'start_time') || '';
			if (!validTime(value))
				return _('Enter a time such as 23:00');
			if (!start !== !value)
				return _('Set both times or neither');
			return start && start === value ? _('The window cannot end when it starts') : true;
		};
		o.textvalue = function(section_id) {
			return '%h'.format(this.cfgvalue(section_id) || '');
		};

		s = m.section(form.GridSection, 'quota', _('Data quotas'),
			_('Internet traffic per day, week or month in the router time zone. At 80 % a push message goes out (if set up); at 100 % the device is cut off from the internet (the local network keeps working) or slowed down, until the next period or until you let it through.'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add quota');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;
		o.rmempty = false;

		macOption(s, devices, this.byMac);

		o = s.option(form.ListValue, 'period', _('Period'));
		o.value('day', PERIODS.day);
		o.value('week', PERIODS.week);
		o.value('month', PERIODS.month);
		o.default = 'month';
		o.textvalue = listText;

		o = s.option(form.ListValue, '_reset_week', _('Week starts on'));
		o.ucioption = 'reset_day';
		WEEKDAYS.forEach(function(d, i) { o.value(String(i + 1), d[1]); });
		o.default = '1';
		o.depends('period', 'week');
		o.modalonly = true;
		o.retain = true; /* shares reset_day with the month choice: an inactive one must not delete it */

		o = s.option(form.ListValue, '_reset_month', _('Month starts on day'));
		o.ucioption = 'reset_day';
		for (var day = 1; day <= 28; day++)
			o.value(String(day), String(day));
		o.default = '1';
		o.depends('period', 'month');
		o.modalonly = true;
		o.retain = true;

		o = s.option(form.Value, 'limit_mb', _('Quota (MB)'), _('1 GB = 1024 MB'));
		o.datatype = 'and(uinteger,range(1,2147483647))'; /* the daemon reads whole MB into an int */
		o.rmempty = false;
		o.textvalue = function(section_id) {
			var mb = +this.cfgvalue(section_id) || 0;
			return rl.formatBytes(mb * 1048576);
		};

		o = s.option(form.ListValue, 'direction', _('Counts'));
		o.value('total', _('Download and upload'));
		o.value('download', _('Download only'));
		o.default = 'total';
		o.textvalue = listText;

		o = s.option(form.ListValue, 'action', _('When used up'));
		o.value('block', _('Cut off the internet'));
		o.value('limit', _('Slow down'));
		o.default = 'block';
		o.textvalue = listText;

		o = rateOption(s, 'limit_download', _('Slowed download (kbit/s)'));
		o.depends('action', 'limit');
		o.modalonly = true;
		o = rateOption(s, 'limit_upload', _('Slowed upload (kbit/s)'));
		o.depends('action', 'limit');
		o.modalonly = true;

		this.quotaBox = E('div', {}, this.renderQuotas(data[2] || []));
		poll.add(function() { return self.refreshQuotas(); }, 30);

		return m.render().then(function(node) {
			var notes = [];
			if (info.limits_error)
				notes.push(E('div', { 'class': 'alert-message warning' }, [
					E('p', {}, [ _('Limits or blocking could not be set up: %s').format(info.limits_error) ]),
					E('p', {}, _('Speed limits need the kernel modules of kmod-ifb, kmod-sched-core and kmod-sched-flower, and tc (tc-tiny).'))
				]));
			if (info.offload === 'hardware')
				notes.push(E('div', { 'class': 'alert-message notice' },
					_('Hardware offloading is on: offloaded connections are neither limited nor counted for quotas. Turn it off (software offloading is fine) for limits to apply.')));
			if (info.modules.indexOf('quotas') < 0)
				notes.push(E('div', { 'class': 'alert-message notice' },
					_('Quotas need traffic accounting, which only runs on a gateway.')));
			/* the quotas' use and the notes go above the rules */
			var first = node.querySelector('.cbi-section');
			notes.forEach(function(n) { first.parentNode.insertBefore(n, first); });
			first.parentNode.insertBefore(E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Quota use')),
				self.quotaBox
			]), first);
			return node;
		});
	}
});
