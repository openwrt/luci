'use strict';
'require view';
'require form';
'require ui';
'require uci';
'require network';
'require validation';
'require tools.widgets as widgets';

function calculateNetwork(addr, mask) {
	addr = validation.parseIPv4(String(addr));

	if (!isNaN(mask))
		mask = validation.parseIPv4(network.prefixToMask(+mask));
	else
		mask = validation.parseIPv4(String(mask));

	if (addr == null || mask == null)
		return null;

	return  [
			addr[0] & (mask[0] >>> 0 & 255),
			addr[1] & (mask[1] >>> 0 & 255),
			addr[2] & (mask[2] >>> 0 & 255),
			addr[3] & (mask[3] >>> 0 & 255)
		].join('.') + '/' +
		network.maskToPrefix(mask.join('.'));
}

return view.extend({
	load: function() {
		return Promise.all([
			network.getDevices(),
			uci.load('libreswan'),
		]);
	},

	render: function(data) {
		var netDevs = data[0];
		var m, s, o;
		var proposals;

		proposals = uci.sections('libreswan', 'crypto_proposal');
		if (proposals == '') {
			ui.addNotification(null, E('p', _('Proposals must be configured for Tunnels')));
			return;
		}

		m = new form.Map('libreswan', 'IPSec Tunnels');

		s = m.section(form.GridSection, 'tunnel');
		s.anonymous = false;
		s.addremove = true;
		s.nodedescription = false;
		s.addbtntitle = _('Add Tunnel');

		o = s.tab('general', _('General'));
		o = s.tab('authentication', _('Authentication'));
		o = s.tab('interface', _('Interface'));
		o = s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.ListValue, 'auto', _('Mode'));
		o.default = 'start';
		o.value('add', _('Listen'));
		o.value('start', _('Initiate'));

		o = s.taboption('general', widgets.NetworkSelect, 'left_interface', _('Left Interface'));
		o.datatype = 'string';
		o.multiple = false;
		o.optional = true;

		o = s.taboption('general', form.Value, 'left', _('Left IP/Device'));
		o.datatype = 'or(string, ipaddr)';
		for (var i = 0; i < netDevs.length; i++) {
			var addrs = netDevs[i].getIPAddrs();
			for (var j = 0; j < addrs.length; j++) {
				o.value(addrs[j].split('/')[0]);
			}
		}
		for (var i = 0; i < netDevs.length; i++) {
			o.value('%' + netDevs[i].device);
		}
		o.value('%defaultroute');
		o.optional = false;
		o.depends({ 'left_interface' : '' });

		o = s.taboption('general', form.Value, 'leftid', _('Left ID'));
		o.datatype = 'string';
		o.value('%any');
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'right', _('Remote IP'));
		o.datatype = 'or(string, ipaddr)';
		o.value('0.0.0.0');
		o.value('%any');
		o.optional = false;

		o = s.taboption('general', form.Value, 'rightid', _('Right ID'));
		o.datatype = 'string';
		o.value('%any');
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'leftsourceip', _('Local Source IP'));
		o.datatype = 'ipaddr';
		for (var i = 0; i < netDevs.length; i++) {
			var addrs = netDevs[i].getIPAddrs();
			for (var j = 0; j < addrs.length; j++) {
				o.value(addrs[j].split('/')[0]);
			}
		}
		o.optional = false;
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'rightsourceip', _('Remote Source IP'));
		o.datatype = 'ipaddr';
		o.optional = false;
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, 'leftsubnets', _('Local Subnets'));
		o.datatype = 'ipaddr';
		for (var i = 0; i < netDevs.length; i++) {
			var addrs = netDevs[i].getIPAddrs();
			for (var j = 0; j < addrs.length; j++) {
				var subnet = calculateNetwork(addrs[j].split('/')[0], addrs[j].split('/')[1]);
				if (subnet) {
					o.value(subnet);
				}
			}
		}
		o.value('0.0.0.0/0');

		o = s.taboption('general', form.DynamicList, 'rightsubnets', _('Remote Subnets'));
		o.datatype = 'ipaddr';
		o.value('0.0.0.0/0');

		o = s.taboption('authentication', form.ListValue, 'authby', _('Auth Method'));
		o.default = 'secret'
		o.value('secret', _('Shared Secret'));
		o.value('never', 'Never');
		o.value('null', 'Null');
		o.modalonly = true;
		o.optional = false;

		o = s.taboption('authentication', form.Value, 'psk', _('Preshared Key'));
		o.datatype = 'and(string, minlength(8))'
		o.depends({ 'authby' : 'secret' });
		o.password = true;
		o.modalonly = true;
		o.optional = false;

		o = s.taboption('advanced', form.ListValue, 'ikev2', _('IKE V2'));
		o.default = 'yes';
		o.value('yes', _('IKE Version 2'));
		o.value('no', _('IKE Version 1'));
		o.modalonly = true;

		o = s.taboption('advanced', form.MultiValue, 'ike', _('Phase1 Proposals'));
		for (var i = 0; i < proposals.length; i++) {
			o.value(proposals[i]['.name']);
		}
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'ikelifetime', _('IKE Life Time'), _('Acceptable values are an integer followed by m, h, d'));
		o.default = '8h';
		o.value('1h', '1h');
		o.value('2h', '2h');
		o.value('4h', '4h');
		o.value('8h', '8h');
		o.value('12h', '12h');
		o.value('16h', '16h');
		o.value('24h', '24h');
		o.modalonly = false;
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (!/^[0-9]{1,3}[smhd]$/.test(value)) {
				return _('Acceptable values are an integer followed by m, h, d');
			}
			return true;
		}

		o = s.taboption('advanced', form.Flag, 'rekey', _('Rekey'));
		o.default = false;
		o.modalonly = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rekeymargin', _('Rekey Margin Time'), _('Acceptable values are an integer followed by m, h, d'));
		o.default = '9m';
		o.value('5m', '5m');
		o.value('9m', '9m');
		o.value('15m', '15m');
		o.value('20m', '20m');
		o.value('30m', '30m');
		o.value('60m', '60m');
		o.modalonly = false;
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (!/^[0-9]{1,3}[smhd]$/.test(value)) {
				return _('Acceptable values are an integer followed by m, h, d');
			}
			return true;
		}

		o = s.taboption('advanced', form.ListValue, 'dpdaction', _('DPD Action'));
		o.default = 'restart';
		o.value('none', _('None'));
		o.value('clear', _('Clear'));
		o.value('hold', _('Hold'));
		o.value('restart', _('Restart'));
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'dpddelay', _('DPD Delay'));
		o.datatype = 'uinteger';
		o.default = 30;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'dpdtimeout', _('DPD Timeout'));
		o.datatype = 'uinteger';
		o.default = 150;
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'phase2', _('Phase2 Protocol'));
		o.default = 'esp';
		o.value('esp', 'ESP');
		o.modalonly = true;
		o.optional = false;

		o = s.taboption('advanced', form.MultiValue, 'phase2alg', _('Phase2 Proposals'));
		for (var i = 0; i < proposals.length; i++) {
			o.value(proposals[i]['.name']);
		}
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'nflog', _('Enable nflog on nfgroup'));
		o.default = 0;
		o.datatype = 'uinteger';
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;

		var interfaces = uci.sections('network', 'interface');
		o = s.taboption('advanced', form.ListValue, 'interface', _('Tunnel Interface'),
			_('Lists XFRM interfaces in format "ipsecN", N denotes ifid of xfrm interface') + '<br>' +
			_('Lists VTI interfaces configured with ikey and okey'));
		o.datatype = 'string';
		o.rmempty = true;
		o.modalonly = true;
		o.value('');
		for (var i = 0; i < interfaces.length; i++) {
			if ((interfaces[i]['proto'] == "vti") && interfaces[i]['ikey'] && interfaces[i]['okey']) {
				o.value(interfaces[i]['.name'], 'VTI - ' + interfaces[i]['.name']);
			}

			if ((interfaces[i]['proto'] == "xfrm")
				&& interfaces[i]['ifid']
				&& interfaces[i]['.name'].match('ipsec' + interfaces[i]['ifid'])) {
				o.value(interfaces[i]['.name'], 'XFRM - ' + interfaces[i]['.name']);
			}
		}

		o = s.taboption('advanced', form.Flag, 'update_peeraddr', _('Update Peer Address'),
			_('Auto Update Peer Address of VTI interface'));
		o.rmempty = true;
		o.modalonly = true;

		return m.render();
	}
});
