'use strict';
'require form';
'require fs';
'require view';
'require uci';
'require ui';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/bin/httping'), {}),
			L.resolveDefault(fs.stat('/usr/bin/nping'), {}),
			L.resolveDefault(fs.stat('/usr/bin/arping'), {}),
			uci.load('network')
		]);
	},

	render: function (stats) {
		let m, s, o;

		m = new form.Map('mwan3', _('MultiWAN Manager - Interfaces'),
			_('Mwan3 requires that all interfaces have a unique metric configured in /etc/config/network.') + '<br />' +
			_('Names must match the interface name found in /etc/config/network.') + '<br />' +
			_('Names may contain characters A-Z, a-z, 0-9, _ and no spaces-') + '<br />' +
			_('Interfaces may not share the same name as configured members, policies or rules.'));

		s = m.section(form.GridSection, 'interface');
		s.addremove = true;
		s.anonymous = false;
		s.nodescriptions = true;

		/* This name length error check can likely be removed when mwan3 migrates to nftables */
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
				nameEl = el.querySelector('.cbi-section-create-name');
			ui.addValidator(nameEl, 'uciname', true, function(v) {
				let sections = [
					...uci.sections('mwan3', 'interface'),
					...uci.sections('mwan3', 'member'),
					...uci.sections('mwan3', 'policy'),
					...uci.sections('mwan3', 'rule')
				];

				for (let j = 0; j < sections.length; j++) {
					if (sections[j]['.name'] == v) {
						return _('Interfaces may not share the same name as configured members, policies or rules.');
					}
				}
				if (v.length > 15) return _('Name length shall not exceed 15 characters');
				return true;
			}, 'blur', 'keyup');
			return el;
		};

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = false;

		o = s.option(form.ListValue, 'initial_state', _('Initial state'),
			_('Expect interface state on up event'));
		o.default = 'online';
		o.value('online', _('Online'));
		o.value('offline', _('Offline'));
		o.modalonly = true;

		o = s.option(form.ListValue, 'family', _('Internet Protocol'));
		o.default = 'ipv4';
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.modalonly = true;

		o = s.option(form.DynamicList, 'track_ip', _('Tracking hostname or IP address'),
			_('This hostname or IP address will be pinged to determine if the link is up or down. Leave blank to assume interface is always online'));
		o.datatype = 'host';
		o.modalonly = true;

		o = s.option(form.ListValue, 'track_method', _('Tracking method'));
		o.default = 'ping';
		o.value('ping');
		if (stats[0].type === 'file') {
			o.value('httping');
		}
		if (stats[1].type === 'file') {
			o.value('nping-tcp');
			o.value('nping-udp');
			o.value('nping-icmp');
			o.value('nping-arp');
		}
		if (stats[2].type === 'file') {
			o.value('arping');
		}

		o = s.option(form.Flag, 'httping_ssl', _('Enable ssl tracking'),
			_('Enables https tracking on ssl port 443'));
		o.depends('track_method', 'httping');
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.Value, 'reliability', _('Tracking reliability'),
			_('Acceptable values: 1-100. This many Tracking IP addresses must respond for the link to be deemed up'));
		o.datatype = 'range(1, 100)';
		o.default = '1';

		o = s.option(form.ListValue, 'count', _('Ping count'));
		o.default = '1';
		o.value('1');
		o.value('2');
		o.value('3');
		o.value('4');
		o.value('5');
		o.modalonly = true;

		o = s.option(form.Value, 'size', _('Ping size'));
		o.default = '56';
		o.depends('track_method', 'ping');
		o.value('8');
		o.value('24');
		o.value('56');
		o.value('120');
		o.value('248');
		o.value('504');
		o.value('1016');
		o.value('1472');
		o.value('2040');
		o.datatype = 'range(1, 65507)';
		o.modalonly = true;

		o =s.option(form.Value, 'max_ttl', _('Max TTL'));
		o.default = '60';
		o.depends('track_method', 'ping');
		o.value('10');
		o.value('20');
		o.value('30');
		o.value('40');
		o.value('50');
		o.value('60');
		o.value('70');
		o.datatype = 'range(1, 255)';
		o.modalonly = true;

		o = s.option(form.Flag, 'check_quality', _('Check link quality'));
		o.depends('track_method', 'ping');
		o.default = false;
		o.modalonly = true;

		o = s.option(form.Value, 'failure_latency', _('Failure latency [ms]'));
		o.depends('check_quality', '1');
		o.default = '1000';
		o.value('25');
		o.value('50');
		o.value('75');
		o.value('100');
		o.value('150');
		o.value('200');
		o.value('250');
		o.value('300');
		o.modalonly = true;

		o = s.option(form.Value, 'failure_loss', _('Failure packet loss [%]'));
		o.depends('check_quality', '1');
		o.default = '40';
		o.value('2');
		o.value('5');
		o.value('10');
		o.value('20');
		o.value('25');
		o.modalonly = true;

		o = s.option(form.Value, 'recovery_latency', _('Recovery latency [ms]'));
		o.depends('check_quality', '1');
		o.default = '500';
		o.value('25');
		o.value('50');
		o.value('75');
		o.value('100');
		o.value('150');
		o.value('200');
		o.value('250');
		o.value('300');
		o.modalonly = true;

		o = s.option(form.Value, 'recovery_loss', _('Recovery packet loss [%]'));
		o.depends('check_quality', '1');
		o.default = '10';
		o.value('2');
		o.value('5');
		o.value('10');
		o.value('20');
		o.value('25');
		o.modalonly = true;

		o = s.option(form.ListValue, "timeout", _("Ping timeout"));
		o.default = '4';
		o.value('1', _('%d second').format('1'));
		for (var i = 2; i <= 10; i++)
			o.value(String(i), _('%d seconds').format(i));
		o.modalonly = true;

		o = s.option(form.ListValue, 'interval', _('Ping interval'));
		o.default = '10';
		o.value('1', _('%d second').format('1'));
		o.value('3', _('%d seconds').format('3'));
		o.value('5', _('%d seconds').format('5'));
		o.value('10', _('%d seconds').format('10'));
		o.value('20', _('%d seconds').format('20'));
		o.value('30', _('%d seconds').format('30'));
		o.value('60', _('%d minute').format('1'));
		o.value('300', _('%d minutes').format('5'));
		o.value('600', _('%d minutes').format('10'));
		o.value('900', _('%d minutes').format('15'));
		o.value('1800', _('%d minutes').format('30'));
		o.value('3600', _('%d hour').format('1'));

		o = s.option(form.Value, 'failure_interval', _('Failure interval'),
			_('Ping interval during failure detection'));
		o.default = '5';
		o.value('1', _('%d second').format('1'));
		o.value('3', _('%d seconds').format('3'));
		o.value('5', _('%d seconds').format('5'));
		o.value('10', _('%d seconds').format('10'));
		o.value('20', _('%d seconds').format('20'));
		o.value('30', _('%d seconds').format('30'));
		o.value('60', _('%d minute').format('1'));
		o.value('300', _('%d minutes').format('5'));
		o.value('600', _('%d minutes').format('10'));
		o.value('900', _('%d minutes').format('15'));
		o.value('1800', _('%d minutes').format('30'));
		o.value('3600', _('%d hour').format('1'));
		o.modalonly = true;

		o = s.option(form.Flag, 'keep_failure_interval', _('Keep failure interval'),
			_('Keep ping failure interval during failure state'));
		o.default = false;
		o.modalonly = true;

		o = s.option(form.Value, 'recovery_interval', _('Recovery interval'),
			_('Ping interval during failure recovering'));
		o.default = '5';
		o.value('1', _('%d second').format('1'));
		o.value('3', _('%d seconds').format('3'));
		o.value('5', _('%d seconds').format('5'));
		o.value('10', _('%d seconds').format('10'));
		o.value('20', _('%d seconds').format('20'));
		o.value('30', _('%d seconds').format('30'));
		o.value('60', _('%d minute').format('1'));
		o.value('300', _('%d minutes').format('5'));
		o.value('600', _('%d minutes').format('10'));
		o.value('900', _('%d minutes').format('15'));
		o.value('1800', _('%d minutes').format('30'));
		o.value('3600', _('%d hour').format('1'));
		o.modalonly = true;

		o = s.option(form.ListValue, 'down', _('Interface down'),
			_('Interface will be deemed down after this many failed ping tests'));
		o.default = '5';
		o.value('1');
		o.value('2');
		o.value('3');
		o.value('4');
		o.value('5');
		o.value('6');
		o.value('7');
		o.value('8');
		o.value('9');
		o.value('10');

		o = s.option(form.ListValue, 'up', _('Interface up'),
			_('Downed interface will be deemed up after this many successful ping tests'));
		o.default = "5";
		o.value('1');
		o.value('2');
		o.value('3');
		o.value('4');
		o.value('5');
		o.value('6');
		o.value('7');
		o.value('8');
		o.value('9');
		o.value('10');

		o = s.option(form.DynamicList, 'flush_conntrack', _('Flush conntrack table'),
			_('Flush global firewall conntrack table on interface events'));
		o.value('ifup', _('ifup (netifd)'));
		o.value('ifdown', _('ifdown (netifd)'));
		o.value('connected', _('connected (mwan3)'));
		o.value('disconnected', _('disconnected (mwan3)'));
		o.modalonly = true;

		o = s.option(form.DummyValue, 'metric', _('Metric'),
			_('This displays the metric assigned to this interface in /etc/config/network'));
		o.rawhtml = true;
		o.cfgvalue = function(s) {
			var metric = uci.get('network', s, 'metric')
			if (metric)
				return metric;
			else
				return _('No interface metric set!');
		}

		return m.render();
	}
})
