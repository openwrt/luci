'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require routelink.common as rl';

/* Push messages (P4): channels, what they get, a test message, the last error of each. */

var TYPES = [
	[ 'webhook', _('Webhook') ],
	[ 'bark', 'Bark' ],
	[ 'serverchan', _('ServerChan') ],
	[ 'pushplus', 'PushPlus' ],
	[ 'telegram', 'Telegram' ],
	[ 'wecom', _('WeCom group robot') ],
	[ 'dingtalk', _('DingTalk group robot') ],
	[ 'feishu', _('Feishu group robot') ]
];
var EVENTS = [
	[ 'device_new', _('New devices') ],
	[ 'device_watch', _('Watched devices come and go') ],
	[ 'quota', _('Quotas at 80 % and used up') ],
	[ 'outage', _('Internet outages (sent when it is back)') ]
];
var URL_TYPES = [ 'webhook', 'bark', 'wecom', 'dingtalk', 'feishu' ];
var TOKEN_TYPES = [ 'bark', 'serverchan', 'pushplus', 'telegram' ];
var URL_RE = /^https?:\/\/[^\s\/]+/i;

function typeLabel(type) {
	var t = TYPES.filter(function(x) { return x[0] === type; })[0];
	return t ? t[1] : type;
}

return view.extend({
	load: function() {
		return Promise.all([
			rl.info(),
			L.resolveDefault(rl.notifyStatus(), { channels: [] }),
			L.resolveDefault(rl.devices(), []),
			uci.load('routelink')
		]).then(function(r) {
			if (!uci.get('routelink', 'notify')) {
				uci.add('routelink', 'notify_settings', 'notify');
				uci.set('routelink', 'notify', 'lang', 'auto');
			}
			return r;
		});
	},

	test: function(section_id) {
		var self = this;
		ui.showModal(_('Test message'), [
			E('p', { 'class': 'spinning' }, _('Sending… (at most 15 seconds)')),
			E('p', { 'class': 'cbi-section-descr' }, _('The test uses the applied settings: save and apply changes first.'))
		]);
		return rl.notifyTest(section_id).then(function(r) {
			ui.showModal(_('Test message'), [
				E('p', {}, [ r.ok ? _('Sent. Check that it arrived.') : _('Sending failed: %s').format(r.error || '?') ]),
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn', click: ui.hideModal }, _('Close')))
			]);
			return self.refreshStatus();
		}).catch(function(e) {
			ui.showModal(_('Test message'), [
				E('p', {}, [ e.message === 'Not found' ? _('Save the channel first.') : _('Sending failed: %s').format(e.message) ]),
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn', click: ui.hideModal }, _('Close')))
			]);
		});
	},

	refreshStatus: function() {
		var self = this;
		return L.resolveDefault(rl.notifyStatus(), { channels: [] }).then(function(st) {
			self.status = {};
			(st.channels || []).forEach(function(c) { self.status[c.section] = c; });
			document.querySelectorAll('[data-rl-status]').forEach(function(el) {
				el.replaceChildren(self.statusOf(el.getAttribute('data-rl-status')));
			});
		});
	},

	statusOf: function(section_id) {
		var c = this.status[section_id];
		if (!c || (!c.last_ok && !c.last_error_ts))
			return E('span', {}, _('Nothing sent yet'));
		if (c.last_error_ts > c.last_ok)
			return E('span', { style: 'color:#d9534f', title: c.last_error },
				[ _('Failed %s: %s').format(rl.formatTime(c.last_error_ts), c.last_error) ]);
		return E('span', { style: 'color:#2e9e44' }, [ _('Sent %s').format(rl.formatTime(c.last_ok)) ]);
	},

	render: function(data) {
		var info = data[0], status = data[1] || { channels: [] }, devices = data[2] || [], self = this;
		this.status = {};
		(status.channels || []).forEach(function(c) { self.status[c.section] = c; });
		var byMac = {};
		devices.forEach(function(d) { byMac[d.mac] = d; });

		var m = new form.Map('routelink', _('Push messages'),
			_('The router sends these itself, also while no phone has the app open. Several events within a minute arrive as one message; a failed message is tried again three times.'));

		var s = m.section(form.NamedSection, 'notify', 'notify_settings', _('Language'));
		s.addremove = false;
		var o = s.option(form.ListValue, 'lang', _('Language of the messages'));
		o.value('auto', _('Automatic (as LuCI; Chinese in the time zones of China)'));
		o.value('zh_cn', '简体中文');
		o.value('en', 'English');
		o.default = 'auto';

		s = m.section(form.GridSection, 'notify', _('Channels'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add channel');
		s.renderRowActions = function(section_id) {
			var td = form.GridSection.prototype.renderRowActions.call(this, section_id);
			td.firstChild.insertBefore(E('button', { 'class': 'btn cbi-button', title: _('Send a test message'),
				click: ui.createHandlerFn(self, 'test', section_id) }, _('Test')), td.firstChild.firstChild);
			return td;
		};

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;
		o.rmempty = false;

		o = s.option(form.Value, 'name', _('Name'));
		o.placeholder = _('e.g. my phone');

		o = s.option(form.ListValue, 'type', _('Service'));
		TYPES.forEach(function(t) { o.value(t[0], t[1]); });
		o.default = 'bark';
		o.textvalue = function(section_id) {
			var v = this.cfgvalue(section_id);
			return v != null ? '%h'.format(typeLabel(v)) : null;
		};

		o = s.option(form.Value, 'url', _('Address'),
			_('Webhook URL; the Bark server (empty: api.day.app); the robot webhook of WeCom, DingTalk or Feishu.'));
		URL_TYPES.forEach(function(t) { o.depends('type', t); });
		o.modalonly = true;
		o.validate = function(section_id, value) {
			var type = this.section.formvalue(section_id, 'type');
			if (!value && type === 'bark')
				return true;
			return URL_RE.test(value || '') ? true : _('Enter an http:// or https:// address');
		};

		o = s.option(form.TextValue, 'template', _('JSON template'),
			_('Optional. {title} and {body} are replaced; empty sends {"title": …, "body": …}.'));
		o.depends('type', 'webhook');
		o.modalonly = true;
		o.rows = 4;

		o = s.option(form.Value, 'token', _('Key or token'),
			_('Bark device key, ServerChan SendKey, PushPlus token or Telegram bot token.'));
		TOKEN_TYPES.forEach(function(t) { o.depends('type', t); });
		o.modalonly = true;
		o.password = true;
		o.rmempty = false;

		o = s.option(form.Value, 'chat_id', _('Chat ID'), _('A number, or @channel'));
		o.depends('type', 'telegram');
		o.modalonly = true;
		o.rmempty = false;

		o = s.option(form.Value, 'secret', _('Signing secret'), _('Optional: the robot signature secret (SEC…)'));
		o.depends('type', 'dingtalk');
		o.depends('type', 'feishu');
		o.modalonly = true;
		o.password = true;

		o = s.option(form.MultiValue, 'events', _('Events'));
		EVENTS.forEach(function(e) { o.value(e[0], e[1]); });
		o.default = EVENTS.map(function(e) { return e[0]; }).join(' ');
		o.rmempty = false;
		o.textvalue = function(section_id) {
			var v = L.toArray(this.cfgvalue(section_id));
			return EVENTS.filter(function(e) { return v.indexOf(e[0]) >= 0; }).map(function(e) { return e[1]; }).join(', ') || '-';
		};

		o = s.option(form.DummyValue, '_status', _('Last message'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			return E('span', { 'data-rl-status': section_id }, self.statusOf(section_id));
		};

		s = m.section(form.GridSection, 'device', _('Watched devices'),
			_('Messages for "Watched devices come and go" are about these devices; trusted ones are not flagged as unknown in the app.'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;
		o = s.option(form.Value, 'mac', _('Device'));
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
		o = s.option(form.Flag, 'watch', _('Watch'));
		o.editable = true;
		o = s.option(form.Flag, 'trusted', _('Trusted'));
		o.editable = true;

		return m.render().then(function(node) {
			if (info.modules.indexOf('notify') < 0)
				node.insertBefore(E('div', { 'class': 'alert-message notice' },
					_('Push messages are sent by a gateway; this router is not one.')), node.querySelector('.cbi-section'));
			return node;
		});
	}
});
