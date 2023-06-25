'use	strict';
'require	view';
'require	form';
'require	fs';
'require	uci';
'require ui';
'require rpc';

return view.extend({
	callHasIpIp: rpc.declare({
		object: 'olsrinfo',
		method: 'hasipip',
	}),
	load: function () {
		return Promise.all([uci.load('olsrd6').then(() => {
			var hasDefaults = false;

			uci.sections('olsrd6', 'InterfaceDefaults', function (s) {
				hasDefaults = true;
				return false;
			});

			if (!hasDefaults) {
				uci.add('olsrd6', 'InterfaceDefaults');
			}
		})]);
	},
	render: function () {
		var m, s, o;

		var has_ipip;

		m = new form.Map(
			'olsrd6',
			_('OLSR Daemon'),
			_(
				'The OLSR daemon is an implementation of the Optimized Link State Routing protocol. ' +
					'As such it allows mesh routing for any network equipment. ' +
					'It runs on any wifi card that supports ad-hoc mode and of course on any ethernet device. ' +
					'Visit <a href="http://www.olsr.org">olsrd.org</a> for help and documentation.'
			)
		);


		s = m.section(form.TypedSection, 'olsrd6', _('General settings'));
		s.anonymous = true;

		s.tab('general', _('General Settings'));
		s.tab('lquality', _('Link Quality Settings'));
		this.callHasIpIp()
		.then(function (res) {
			var output = res.result;
			has_ipip = output.trim().length > 0;
		})
		.catch(function (err) {
			console.error(err);
		})
		.finally(function () {
			s.tab('smartgw', _('SmartGW'), !has_ipip && _('Warning: kmod-ipip is not installed. Without kmod-ipip SmartGateway will not work, please install it.'));
			var sgw = s.taboption('smartgw', form.Flag, 'SmartGateway', _('Enable'), _('Enable SmartGateway. If it is disabled, then ' + 'all other SmartGateway parameters are ignored. Default is "no".'));
			sgw.default = 'no';
			sgw.enabled = 'yes';
			sgw.disabled = 'no';
			sgw.rmempty = true;
			sgw.cfgvalue = function (section_id) {
				return uci.get('olsrd6', section_id, 'SmartGateway') || 'no';
			};

			var sgwnat = s.taboption('smartgw', form.Flag, 'SmartGatewayAllowNAT', _('Allow gateways with NAT'), _('Allow the selection of an outgoing IPv4 gateway with NAT'));
			sgwnat.depends('SmartGateway', 'yes');
			sgwnat.default = 'yes';
			sgwnat.enabled = 'yes';
			sgwnat.disabled = 'no';
			sgwnat.optional = true;
			sgwnat.rmempty = true;
	
			var sgwuplink = s.taboption(
				'smartgw',
				form.ListValue,
				'SmartGatewayUplink',
				_('Announce uplink'),
				_('Which kind of uplink is exported to the other mesh nodes. ' + 'An uplink is detected by looking for a local HNA6 ::ffff:0:0/96 or 2000::/3. Default setting is "both".')
			);
			sgwuplink.value('none');
			sgwuplink.value('ipv4');
			sgwuplink.value('ipv6');
			sgwuplink.value('both');
			sgwuplink.depends('SmartGateway', 'yes');
			sgwuplink.default = 'both';
			sgwuplink.optional = true;
			sgwuplink.rmempty = true;
	
			var sgwulnat = s.taboption('smartgw', form.Flag, 'SmartGatewayUplinkNAT', _('Uplink uses NAT'), _('If this Node uses NAT for connections to the internet. ' + 'Default is "yes".'));
			sgwulnat.depends('SmartGatewayUplink', 'ipv4');
			sgwulnat.depends('SmartGatewayUplink', 'both');
			sgwulnat.default = 'yes';
			sgwulnat.enabled = 'yes';
			sgwulnat.disabled = 'no';
			sgwnat.optional = true;
			sgwnat.rmempty = true;
	
			var sgwspeed = s.taboption('smartgw', form.Value, 'SmartGatewaySpeed', _('Speed of the uplink'), _('Specifies the speed of ' + 'the uplink in kilobits/s. First parameter is upstream, second parameter is downstream. Default is "128 1024".'));
			sgwspeed.depends('SmartGatewayUplink', 'ipv4');
			sgwspeed.depends('SmartGatewayUplink', 'ipv6');
			sgwspeed.depends('SmartGatewayUplink', 'both');
			sgwspeed.optional = true;
			sgwspeed.rmempty = true;
	
			var sgwprefix = s.taboption(
				'smartgw',
				form.Value,
				'SmartGatewayPrefix',
				_('IPv6-Prefix of the uplink'),
				_(
					'This can be used ' +
						"to signal the external IPv6 prefix of the uplink to the clients. This might allow a client to change it's local IPv6 address to " +
						'use the IPv6 gateway without any kind of address translation. The maximum prefix length is 64 bits. ' +
						'Default is "::/0" (no prefix).'
				)
			);
			sgwprefix.depends('SmartGatewayUplink', 'ipv6');
			sgwprefix.depends('SmartGatewayUplink', 'both');
			sgwprefix.optional = true;
			sgwprefix.rmempty = true;
		});
		s.tab('advanced', _('Advanced Settings'));

		var poll = s.taboption('advanced', form.Value, 'Pollrate', _('Pollrate'), _('Polling rate for OLSR sockets in seconds. Default is 0.05.'));
		poll.optional = true;
		poll.datatype = 'ufloat';
		poll.placeholder = '0.05';

		var nicc = s.taboption('advanced', form.Value, 'NicChgsPollInt', _('Nic changes poll interval'), _('Interval to poll network interfaces for configuration changes (in seconds). Default is "2.5".'));
		nicc.optional = true;
		nicc.datatype = 'ufloat';
		nicc.placeholder = '2.5';

		var tos = s.taboption('advanced', form.Value, 'TosValue', _('TOS value'), _('Type of service value for the IP header of control traffic. Default is "16".'));
		tos.optional = true;
		tos.datatype = 'uinteger';
		tos.placeholder = '16';

		var fib = s.taboption(
			'general',
			form.ListValue,
			'FIBMetric',
			_('FIB metric'),
			_(
				'FIBMetric controls the metric value of the host-routes OLSRd sets. ' +
					'"flat" means that the metric value is always 2. This is the preferred value ' +
					'because it helps the Linux kernel routing to clean up older routes. ' +
					'"correct" uses the hopcount as the metric value. ' +
					'"approx" uses the hopcount as the metric value too, but does only update the hopcount if the nexthop changes too. ' +
					'Default is "flat".'
			)
		);
		fib.value('flat');
		fib.value('correct');
		fib.value('approx');

		var lql = s.taboption(
			'lquality',
			form.ListValue,
			'LinkQualityLevel',
			_('LQ level'),
			_('Link quality level switch between hopcount and cost-based (mostly ETX) routing.<br />' + '<b>0</b> = do not use link quality<br />' + '<b>2</b> = use link quality for MPR selection and routing<br />' + 'Default is "2"')
		);
		lql.value('2');
		lql.value('0');

		var lqage = s.taboption(
			'lquality',
			form.Value,
			'LinkQualityAging',
			_('LQ aging'),
			_('Link quality aging factor (only for lq level 2). Tuning parameter for etx_float and etx_fpm, smaller values ' + 'mean slower changes of ETX value. (allowed values are between 0.01 and 1.0)')
		);
		lqage.optional = true;
		lqage.depends('LinkQualityLevel', '2');

		var lqa = s.taboption(
			'lquality',
			form.ListValue,
			'LinkQualityAlgorithm',
			_('LQ algorithm'),
			_(
				'Link quality algorithm (only for lq level 2).<br />' +
					'<b>etx_float</b>: floating point ETX with exponential aging<br />' +
					'<b>etx_fpm</b>  : same as etx_float, but with integer arithmetic<br />' +
					'<b>etx_ff</b>   : ETX freifunk, an etx variant which use all OLSR traffic (instead of only hellos) for ETX calculation<br />' +
					'<b>etx_ffeth</b>: incompatible variant of etx_ff that allows ethernet links with ETX 0.1.<br />' +
					'Defaults to "etx_ff"'
			)
		);
		lqa.optional = true;
		lqa.value('etx_ff');
		lqa.value('etx_fpm');
		lqa.value('etx_float');
		lqa.value('etx_ffeth');
		lqa.depends('LinkQualityLevel', '2');
		lqa.optional = true;

		var lqfish = s.taboption('lquality', form.Flag, 'LinkQualityFishEye', _('LQ fisheye'), _('Fisheye mechanism for TCs (checked means on). Default is "on"'));
		lqfish.default = '1';
		lqfish.optional = true;

		var hyst = s.taboption(
			'lquality',
			form.Flag,
			'UseHysteresis',
			_('Use hysteresis'),
			_('Hysteresis for link sensing (only for hopcount metric). Hysteresis adds more robustness to the link sensing ' + 'but delays neighbor registration. Defaults is "yes"')
		);
		hyst.default = 'yes';
		hyst.enabled = 'yes';
		hyst.disabled = 'no';
		hyst.depends('LinkQualityLevel', '0');
		hyst.optional = true;
		hyst.rmempty = true;

		var port = s.taboption('general', form.Value, 'OlsrPort', _('Port'), _('The port OLSR uses. This should usually stay at the IANA assigned port 698. It can have a value between 1 and 65535.'));
		port.optional = true;
		port.default = '698';
		port.rmempty = true;

		var mainip = s.taboption(
			'general',
			form.Value,
			'MainIp',
			_('Main IP'),
			_('Sets the main IP (originator ip) of the router. This IP will NEVER change during the uptime of olsrd. ' + 'Default is ::, which triggers usage of the IP of the first interface.')
		);
		mainip.optional = true;
		mainip.rmempty = true;
		mainip.datatype = 'ipaddr';
		mainip.placeholder = '::';

		var willingness = s.taboption('advanced', form.ListValue, 'Willingness', _('Willingness'), _('The fixed willingness to use. If not set willingness will be calculated dynamically based on battery/power status. Default is "3".'));
		for (let i = 0; i < 8; i++) {
			willingness.value(i);
		}
		willingness.optional = true;
		willingness.default = '3';

		var natthr = s.taboption(
			'advanced',
			form.Value,
			'NatThreshold',
			_('NAT threshold'),
			_(
				'If the route to the current gateway is to be changed, the ETX value of this gateway is ' +
					'multiplied with this value before it is compared to the new one. ' +
					'The parameter can be a value between 0.1 and 1.0, but should be close to 1.0 if changed.<br />' +
					'<b>WARNING:</b> This parameter should not be used together with the etx_ffeth metric!<br />' +
					'Defaults to "1.0".'
			)
		);
		for (let i = 1; i >= 0.1; i -= 0.1) {
			natthr.value(i);
		}

		natthr.depends('LinkQualityAlgorithm', 'etx_ff');
		natthr.depends('LinkQualityAlgorithm', 'etx_float');
		natthr.depends('LinkQualityAlgorithm', 'etx_fpm');
		natthr.default = '1.0';
		natthr.optional = true;
		natthr.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'NatThreshold', n);
			}
		};

		var i = m.section(form.TypedSection, 'InterfaceDefaults', _('Interfaces Defaults'));
		i.anonymous = true;
		i.addremove = false;

		i.tab('general', _('General Settings'));
		i.tab('addrs', _('IP Addresses'));
		i.tab('timing', _('Timing and Validity'));

		var mode = i.taboption('general', form.ListValue, 'Mode', _('Mode'), _('Interface mode is used to prevent unnecessary packet forwarding on switched ethernet interfaces. ' + 'Valid modes are "mesh" and "ether". Default is "mesh".'));
		mode.value('mesh');
		mode.value('ether');
		mode.optional = true;
		mode.rmempty = true;

		var weight = i.taboption(
			'general',
			form.Value,
			'Weight',
			_('Weight'),
			_(
				'When multiple links exist between hosts the weight of interface is used to determine the link to use. ' +
					'Normally the weight is automatically calculated by olsrd based on the characteristics of the interface, ' +
					'but here you can specify a fixed value. Olsrd will choose links with the lowest value.<br />' +
					'<b>Note:</b> Interface weight is used only when LinkQualityLevel is set to 0. ' +
					'For any other value of LinkQualityLevel, the interface ETX value is used instead.'
			)
		);
		weight.optional = true;
		weight.datatype = 'uinteger';
		weight.placeholder = '0';

		var lqmult = i.taboption(
			'general',
			form.DynamicList,
			'LinkQualityMult',
			_('LinkQuality Multiplicator'),
			_(
				'Multiply routes with the factor given here. Allowed values are between 0.01 and 1.0. ' +
					'It is only used when LQ-Level is greater than 0. Examples:<br />' +
					'reduce LQ to fd91:662e:3c58::1 by half: fd91:662e:3c58::1 0.5<br />' +
					'reduce LQ to all nodes on this interface by 20%: default 0.8'
			)
		);
		lqmult.optional = true;
		lqmult.rmempty = true;
		lqmult.cast = 'table';
		lqmult.placeholder = 'default 1.0';

		lqmult.validate = function (section_id) {
			for (var i = 0; i < lqmult.formvalue(section_id).length; i++) {
				var v = lqmult.formvalue(section_id)[i];
				if (v !== '') {
					var val = v.split(' ');
					var host = val[0];
					var mult = val[1];
					if (!host || !mult) {
						return [null, "LQMult requires two values (IP address or 'default' and multiplicator) separated by space."];
					}
					if (!/^([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/.test(host) && host !== 'default') {
						return [null, "Can only be a valid IPv6 address or 'default'"];
					}
					if (isNaN(mult) || mult > 1 || mult < 0.01) {
						return [null, 'Invalid Value for LQMult-Value. Must be between 0.01 and 1.0.'];
					}
					if (!/^[0-1]\.\d+$/.test(mult)) {
						return [null, 'Invalid Value for LQMult-Value. You must use a decimal number between 0.01 and 1.0 here.'];
					}
				}
			}
			return true;
		};

		var ip6m = i.taboption('addrs', form.Value, 'IPv6Multicast', _('IPv6 multicast'), _('IPv6 multicast address. Default is "FF02::6D", the manet-router linklocal multicast.'));
		ip6m.optional = true;
		ip6m.datatype = 'ip6addr';
		ip6m.placeholder = 'FF02::6D';

		var ip6s = i.taboption(
			'addrs',
			form.Value,
			'IPv6Src',
			_('IPv6 source'),
			_('IPv6 src prefix. OLSRd will choose one of the interface IPs which matches the prefix of this parameter. ' + 'Default is "0::/0", which triggers the usage of a not-linklocal interface IP.')
		);
		ip6s.optional = true;
		ip6s.datatype = 'ip6addr';
		ip6s.placeholder = '0::/0';

		var hi = i.taboption('timing', form.Value, 'HelloInterval', _('Hello interval'));
		hi.optional = true;
		hi.datatype = 'ufloat';
		hi.placeholder = '5.0';
		hi.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'HelloInterval', n);
			}
		};

		var hv = i.taboption('timing', form.Value, 'HelloValidityTime', _('Hello validity time'));
		hv.optional = true;
		hv.datatype = 'ufloat';
		hv.placeholder = '40.0';
		hv.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'HelloValidityTime', n);
			}
		};

		var ti = i.taboption('timing', form.Value, 'TcInterval', _('TC interval'));
		ti.optional = true;
		ti.datatype = 'ufloat';
		ti.placeholder = '2.0';
		ti.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'TcInterval', n);
			}
		};

		var tv = i.taboption('timing', form.Value, 'TcValidityTime', _('TC validity time'));
		tv.optional = true;
		tv.datatype = 'ufloat';
		tv.placeholder = '256.0';
		tv.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'TcValidityTime', n);
			}
		};

		var mi = i.taboption('timing', form.Value, 'MidInterval', _('MID interval'));
		mi.optional = true;
		mi.datatype = 'ufloat';
		mi.placeholder = '18.0';
		mi.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'MidInterval', n);
			}
		};

		var mv = i.taboption('timing', form.Value, 'MidValidityTime', _('MID validity time'));
		mv.optional = true;
		mv.datatype = 'ufloat';
		mv.placeholder = '324.0';
		mv.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'MidValidityTime', n);
			}
		};

		var ai = i.taboption('timing', form.Value, 'HnaInterval', _('HNA interval'));
		ai.optional = true;
		ai.datatype = 'ufloat';
		ai.placeholder = '18.0';
		ai.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'HnaInterval', n);
			}
		};

		var av = i.taboption('timing', form.Value, 'HnaValidityTime', _('HNA validity time'));
		av.optional = true;
		av.datatype = 'ufloat';
		av.placeholder = '108.0';
		av.write = function (section_id, value) {
			let n = parseFloat(value).toFixed(1);
			if (!isNaN(n)) {
				uci.set('olsrd6', section_id, 'HnaValidityTime', n);
			}
		};

		var ifs = m.section(form.TableSection, 'Interface', _('Interfaces'));
		ifs.addremove = true;
		ifs.anonymous = true;
		ifs.extedit = function (eve) {
			var editButton = eve.target;
			var sid;
			var row = editButton.closest('.cbi-section-table-row');

			if (row) {
				sid = row.getAttribute('data-sid');
				console.log(sid);
			}
			window.location.href = `olsrd6/iface/${sid}`;
		};
		ifs.template = 'cbi/tblsection';

		ifs.handleAdd = function (ev) {
			var sid = uci.add('olsrd6', 'Interface');
			uci
				.save()
				.then(function () {
					return uci.changes();
				})
				.then(function (res) {
					console.log(res);
					var sid = null;
					if (res.olsrd6 && Array.isArray(res.olsrd6)) {
						res.olsrd6.forEach(function (item) {
							if (item.length >= 3 && item[0] === 'add' && item[2] === 'Interface') {
								sid = item[1];
							}
						});
					}
					if (sid) {
						console.log(sid);
					}
					window.location.href = `olsrd6/iface/${sid}`;
				});
		};
		var ign = ifs.option(form.Flag, 'ignore', _('Enable'));
		ign.enabled = '0';
		ign.disabled = '1';
		ign.rmempty = false;
		ign.cfgvalue = function (section_id) {
			return uci.get('olsrd6', section_id, 'ignore') || '0';
		};

		var network = ifs.option(form.DummyValue, 'interface', _('Network'));
		network.template = 'cbi/network_netinfo';

		var mode = ifs.option(form.DummyValue, 'Mode', _('Mode'));
		mode.cfgvalue = function (section_id) {
			return uci.get('olsrd6', section_id, 'Mode') || uci.get_first('olsrd6', 'InterfaceDefaults', 'Mode');
		};

		var hello = ifs.option(form.DummyValue, '_hello', _('Hello'));
		hello.cfgvalue = function (section_id) {
			var i = uci.get('olsrd6', section_id, 'HelloInterval') || uci.get_first('olsrd6', 'InterfaceDefaults', 'HelloInterval');
			var v = uci.get('olsrd6', section_id, 'HelloValidityTime') || uci.get_first('olsrd6', 'InterfaceDefaults', 'HelloValidityTime');
			return `${i}s / ${v}s`;
		};

		var tc = ifs.option(form.DummyValue, '_tc', _('TC'));
		tc.cfgvalue = function (section_id) {
			var i = uci.get('olsrd6', section_id, 'TcInterval') || uci.get_first('olsrd6', 'InterfaceDefaults', 'TcInterval');
			var v = uci.get('olsrd6', section_id, 'TcValidityTime') || uci.get_first('olsrd6', 'InterfaceDefaults', 'TcValidityTime');
			return `${i}s / ${v}s`;
		};

		var mid = ifs.option(form.DummyValue, '_mid', _('MID'));
		mid.cfgvalue = function (section_id) {
			var i = uci.get('olsrd6', section_id, 'MidInterval') || uci.get_first('olsrd6', 'InterfaceDefaults', 'MidInterval');
			var v = uci.get('olsrd6', section_id, 'MidValidityTime') || uci.get_first('olsrd6', 'InterfaceDefaults', 'MidValidityTime');
			return `${i}s / ${v}s`;
		};

		var hna = ifs.option(form.DummyValue, '_hna', _('HNA'));
		hna.cfgvalue = function (section_id) {
			var i = uci.get('olsrd6', section_id, 'HnaInterval') || uci.get_first('olsrd6', 'InterfaceDefaults', 'HnaInterval');
			var v = uci.get('olsrd6', section_id, 'HnaValidityTime') || uci.get_first('olsrd6', 'InterfaceDefaults', 'HnaValidityTime');
			return `${i}s / ${v}s`;
		};

		return m.render();
	},
});
