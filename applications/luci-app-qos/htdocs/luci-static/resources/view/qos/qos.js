'use strict';
'require form';
'require network';
'require rpc';
'require tools.widgets as widgets';
'require view';

const callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			network.getNetworks(),
			callHostHints(),
		]);
	},

	render: function (loaded_promises) {
		let m, s, o;
		const networks = loaded_promises[0];
		const hosts = loaded_promises[1];

		m = new form.Map('qos', _('Quality of Service'),
			_('With %s you can prioritize network traffic selected by addresses, ports or services.'.format('<abbr title=\"Quality of Service\">QoS</abbr>')));

		s = m.section(form.TypedSection, 'interface', _('Interfaces'));
		s.anonymous = false;
		s.addremove = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));

		o = s.option(form.ListValue, 'classgroup', _('Classification group'));
		o.placeholder = 'Default';
		o.value('Default', _('default'));
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Flag, 'overhead', _('Calculate overhead'));
		o.depends({ enabled: '1' });

		o = s.option(form.Flag, 'halfduplex', _('Half-duplex'));
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'download', _('Download speed (kbit/s)'));
		o.rmempty = true;
		o.placeholder = 1024;
		o.datatype = 'and(uinteger,min(1))';
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'upload', _('Upload speed (kbit/s)'));
		o.rmempty = true;
		o.placeholder = 128;
		o.datatype = 'and(uinteger,min(1))';
		o.depends({ enabled: '1' });

		s = m.section(form.TableSection, 'classify', _('Classification Rules'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable  = true;
		s.rowcolors = true;
		s.nodescriptions = true;

		o = s.option(form.ListValue, 'target', _('Target'));
		o.value('Priority', _('priority'));
		o.value('Express', _('express'));
		o.value('Normal', _('normal'));
		o.value('Low', _('low'));

		Object.values(L.uci.sections('qos', 'class')).forEach(function(val, index) {
			const n = val['.name'];
			if (!n.endsWith('_down'))
				o.value(n);
		});

		var ipaddrs = {};
		Object.keys(hosts).forEach(function(mac) {
			L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4).forEach(function(ip) {
				ipaddrs[ip] = mac;
			});

			L.toArray(hosts[mac].ip6addrs || hosts[mac].ipv6).forEach(function(ip) {
				ipaddrs[ip] = mac;
			});
		});

		o = s.option(form.Value, 'srchost', _('Source host'));
		o.rmempty = true;
		o.width = '15%';
		o.datatype = 'ipaddr';
		o.value('', _('all'));
		L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ipv4) {
			o.value(ipv4, '%s (%s)'.format(ipv4, ipaddrs[ipv4]));
		});

		o = s.option(form.Value, 'dsthost', _('Destination host'));
		o.rmempty = true;
		o.width = '15%';
		o.datatype = 'ipaddr';
		o.value('', _('all'));
		L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ipv4) {
			o.value(ipv4, '%s (%s)'.format(ipv4, ipaddrs[ipv4]));
		});

		o = s.option(form.Value, 'proto', _('Protocol'));
		o.rmempty = true;
		o.width = '15%';
		o.value('', _('all'));
		o.value('tcp');
		o.value('udp');
		o.value('icmp');

		o = s.option(form.Value, 'ports', _('Ports'));
		o.rmempty = true;
		o.width = '15%';
		o.value('', _('all'));
		o.validate = function(section, value) {
			if (!value) return true

			const valuesArray = value.split(',').map(v => v.trim());

			return valuesArray.every(v => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 65536);
		};

		o = s.option(form.Value, 'connbytes', _('Number of bytes'));
		o.datatype = 'uinteger';
		o.width = '5%';

		o = s.option(form.Value, 'comment', _('Comment'));
		o.rmempty = true;

		return m.render();
	}
});
