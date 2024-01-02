'use strict';
'require view';
'require form';
'require uci';
'require ui';

return view.extend({
	load: function () {
		return Promise.all([uci.load('olsrd')]);
	},
	render: function () {
		var ipv = uci.get_first('olsrd', 'olsrd', 'IpVersion') || '4';

		var mh = new form.Map('olsrd', _('OLSR - HNA-Announcements'), _('Hosts in an OLSR routed network can announce connectivity ' + 'to external networks using HNA messages.'));

		if (ipv === '6and4' || ipv === '4') {
			var hna4 = mh.section(form.TypedSection, 'Hna4', _('Hna4'), _('Both values must use the dotted decimal notation.'));
			hna4.addremove = true;
			hna4.anonymous = true;
			hna4.template = 'cbi/tblsection';

			var net4 = hna4.option(form.Value, 'netaddr', _('Network address'));
			net4.datatype = 'ip4addr';
			net4.placeholder = '10.11.12.13';
			net4.default = '10.11.12.13';
			var msk4 = hna4.option(form.Value, 'netmask', _('Netmask'));
			msk4.datatype = 'ip4addr';
			msk4.placeholder = '255.255.255.255';
			msk4.default = '255.255.255.255';
		}

		if (ipv === '6and4' || ipv === '6') {
			var hna6 = mh.section(form.TypedSection, 'Hna6', _('Hna6'), _('IPv6 network must be given in full notation, ' + 'prefix must be in CIDR notation.'));
			hna6.addremove = true;
			hna6.anonymous = true;
			hna6.template = 'cbi/tblsection';

			var net6 = hna6.option(form.Value, 'netaddr', _('Network address'));
			net6.datatype = 'ip6addr';
			net6.placeholder = 'fec0:2200:106:0:0:0:0:0';
			net6.default = 'fec0:2200:106:0:0:0:0:0';
			var msk6 = hna6.option(form.Value, 'prefix', _('Prefix'));
			msk6.datatype = 'range(0,128)';
			msk6.placeholder = '128';
			msk6.default = '128';
		}
		return mh.render();
	},
});
