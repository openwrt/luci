'use strict';
'require view';
'require form';
'require	uci';
'require ui';

return view.extend({
	load: function () {
		return Promise.all([uci.load('olsrd6')]);
	},
	render: function () {
		var mh = new form.Map('olsrd6', _('OLSR - HNA6-Announcements'), _('Hosts in an OLSR routed network can announce connectivity ' + 'to external networks using HNA6 messages.'));

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

		return mh.render();
	},
});
