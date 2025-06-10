'use strict';
'require form';
'require fs';
'require rpc';
'require ui';
'require view';

var mapdata = { actions: {} };

var mibDownload = rpc.declare({
	object: 'file',
	method: 'read',
	params: [ 'path' ],
	expect: { data : '' },
});

return L.view.extend({
	handleMIB: function(name) {
		const base = '/usr/share/snmp/mibs/';
		const fileName = name;
		const a = document.createElement('a');

		document.body.appendChild(a);
		a.display = 'none';

		return mibDownload(base + fileName, false).then(function(res) {
			const data = res;
			const file = new Blob( [data] , { type: 'text/plain'});
			const fileUrl = window.URL.createObjectURL(file);

			a.href = fileUrl;
			a.download = fileName;
			a.click();
			document.body.removeChild(a);
		});
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.list('/usr/share/snmp/mibs/'), [])
			.then(function(entries) {
				const files = [];
				entries.forEach((elem) => {
					if (elem.type == 'file' &&
					elem.name.match(/MIB\.(mib|my|txt)$/i)) {
						files.push(elem.name);
					}
				});
				return files;
			})
		]);
	},

	render: function(data) {
		let m, s, o, ss;
		const files = data[0];

		m = new form.JSONMap(mapdata, _('SNMP - MIB Download'),
			'Here you can download SNMP-MIB files');

		s = m.section(form.NamedSection, 'actions', _('Actions'));

		o = s.option(form.SectionValue, 'actions',
			form.NamedSection, 'actions', 'actions',
			_('Download Area'));

		ss = o.subsection;

		files.forEach((elem) => {
			o = ss.option(form.Button, 'dl_mib', _(elem),
				_(''));
			o.inputstyle = 'action important';
			o.inputtitle = _('Download');
			o.onclick = ui.createHandlerFn(this, this.handleMIB, elem);
		});

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
	});
