'use strict';
'require baseclass';
'require rpc';

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

var callMountPoints = rpc.declare({
	object: 'luci',
	method: 'getMountPoints',
	expect: { result: [] }
});

var MountSkipList = [
	"/rom",
	"/tmp",
	"/dev",
	"/overlay",
	"/",
]

function progressbar(value, max, byte) {
	var vn = parseInt(value) || 0,
	    mn = parseInt(max) || 100,
	    fv = byte ? String.format('%1024.2mB', value) : value,
	    fm = byte ? String.format('%1024.2mB', max) : max,
	    pc = Math.floor((100 / mn) * vn);

	return E('div', {
		'class': 'cbi-progressbar',
		'title': '%s / %s (%d%%)'.format(fv, fm, pc)
	}, E('div', { 'style': 'width:%.2f%%'.format(pc) }));
}

return baseclass.extend({
	title: _('Storage'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(callMountPoints(), {}),
		]);
	},

	render: function(data) {
		var systeminfo = data[0],
		    mounts = data[1],
		    root = L.isObject(systeminfo.root) ? systeminfo.root : {},
		    tmp = L.isObject(systeminfo.tmp) ? systeminfo.tmp : {};

		const existenceChk = function(fields, name, values) {
			if (!fields.hasOwnProperty(name))
				fields[name] = values;
		};

		var fields = {};
		existenceChk(fields, _('Disk space'), { used: root.used * 1024, size: root.total * 1024 });
		existenceChk(fields, _('Temp space'), { used: tmp.used * 1024, size: tmp.total * 1024 });

		for (var i = 0; i < mounts.length; i++) {
			var entry = mounts[i];

			if (MountSkipList.includes(entry.mount))
				continue;

			var name = entry.device + ' (' + entry.mount +')',
			    used = entry.size - entry.free;

			existenceChk(fields, name, { used: used, size: entry.size });
		}

		var table = E('table', { 'class': 'table' });

		Object.keys(fields).forEach(function(key) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ key ]),
				E('td', { 'class': 'td left' }, [
					(fields[key].used != null) ? progressbar(fields[key].used, fields[key].size, true) : '?'
				])
			]));
		});

		return table;
	}
});
