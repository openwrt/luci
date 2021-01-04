'use strict';
'require view';
'require dom';
'require ui';
'require rpc';
'require form';

var callTorHSList = rpc.declare({
		object: 'tor-hs-rpc',
		method: 'list-hs',
		expect: {'':{}  }});

return view.extend({
	formdata: { torhs: {} },

	load: function() {
		return Promise.all([
			callTorHSList()
		]);
	},

	render: function(data) {
		var m, s, o;

		var uci_hs_list=data[0]["hs-list"];
		var tbl_lines=[];


		tbl_lines.push(
				E('tr',{'class':'tr'},[
				E('th',{'class':'th'} ,_("Name")),
				E('th',{'class':'th'} ,_("Description")),
				E('th',{'class':'th'} ,_("Enabled")),
				E('th',{'class':'th'} ,_("Hidden service address")),
				E('th',{'class':'th'} ,_("External port"))
		]));

		uci_hs_list.forEach(function(entry) {
			var extern_ports=[]
			entry.ports.forEach(function(port) {
				extern_ports.push(port.split(";")[0]);
			});

			tbl_lines.push(
				E('tr',{'class':'tr'},[
					E('td',{'class':'td'} ,entry.name),
					E('td',{'class':'td'} ,entry.description),
					E('td',{'class':'td'} ,entry.enabled),
					E('td',{'class':'td'} ,entry.hostname),
					E('td',{'class':'td'} ,extern_ports.join(", "))
			]));
		});

		var tbl=E('table',{'class': 'table'}, tbl_lines);

		m = new form.JSONMap(this.formdata, _('Hidden service list'));

		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function(view, section_id) {
			return tbl;
		}, o, this);

		return m.render();
	},

	addFooter: function() {
		return E('div', { 'class': 'cbi-page-actions' },'');
	}
});
