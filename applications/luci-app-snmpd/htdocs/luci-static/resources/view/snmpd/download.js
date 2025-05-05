"use strict";
"require form";
"require fs";
"require rpc";
"require ui";
"require view";

var mapdata = { actions: {} };

var mibDownload = rpc.declare({
	object: 'file',
	method: 'read',
	params: [ "path" ],
	expect: { data : '' },
});

return L.view.extend({
	handleMIB: function(name) {
		var base = "/usr/share/snmp/mibs/";
		var fileName = name;
		var a = document.createElement("a");

		document.body.appendChild(a);
		a.display = "none";

		return mibDownload(base + fileName, false).then(function(res) {
			var data = res;
			var file = new Blob( [data] , { type: 'text/plain'});
			var fileUrl = window.URL.createObjectURL(file);

			a.href = fileUrl;
			a.download = fileName;
			a.click();
			document.body.removeChild(a);
		});
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.list("/usr/share/snmp/mibs/"), [])
			.then(function(entries) {
				var files = [];
				for (var i = 0; i < entries.length; i++) {
					if (entries[i].type == "file" &&
						entries[i].name.match(
							/MIB\.(mib|my|txt)$/i)) {
						files.push(entries[i].name);
					}
				}
				return files;
			})
		]);
	},

	render: function(data) {
		var m, s, o, ss;
		var files = data[0];

		m = new form.JSONMap(mapdata, _('SNMP - MIB Download'),
			'Here you can download SNMP-MIB files');

		s = m.section(form.NamedSection, 'actions', _('Actions'));

		o = s.option(form.SectionValue, 'actions',
			form.NamedSection, 'actions', 'actions',
			_('Download Area'));

		ss = o.subsection;

		for( var i = 0; i < files.length; i++) {
			o = ss.option(form.Button, 'dl_mib', _(files[i]),
				_(''));
			o.inputstyle = 'action important';
			o.inputtitle = _("Download");
			o.onclick = ui.createHandlerFn(this, this.handleMIB, files[i]);
		}

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
	});
