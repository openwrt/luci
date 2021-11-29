'use strict';
'require baseclass';
'require rpc';

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

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
		return L.resolveDefault(callSystemInfo(), {});
	},

	render: function(systeminfo) {
		var root = L.isObject(systeminfo.root) ? systeminfo.root : {},
		    tmp = L.isObject(systeminfo.tmp) ? systeminfo.tmp : {};

		var fields = [];
		fields.push(_('Disk space'), root.used*1024, root.total*1024);
		fields.push(_('Temp space'), tmp.used*1024, tmp.total*1024);

		var table = E('table', { 'class': 'table' });

		for (var i = 0; i < fields.length; i += 3) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ fields[i] ]),
				E('td', { 'class': 'td left' }, [
					(fields[i + 1] != null) ? progressbar(fields[i + 1], fields[i + 2], true) : '?'
				])
			]));
		}

		return table;
	}
});
