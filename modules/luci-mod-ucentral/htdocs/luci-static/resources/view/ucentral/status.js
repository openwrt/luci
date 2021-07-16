'use strict';
'require rpc';
'require view';
'require tools.ucentral as uctool';

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

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

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {})
		]);
	},

	render: function(data) {
		var boardinfo  = data[0],
		    systeminfo = data[1],
		    mem        = L.isObject(systeminfo.memory) ? systeminfo.memory : {},
		    swap       = L.isObject(systeminfo.swap) ? systeminfo.swap : {},
		    datestr    = null;

		if (systeminfo.localtime) {
			var date = new Date(systeminfo.localtime * 1000);

			datestr = '%04d-%02d-%02d %02d:%02d:%02d'.format(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1,
				date.getUTCDate(),
				date.getUTCHours(),
				date.getUTCMinutes(),
				date.getUTCSeconds()
			);
		}

		var sysfields = [
			_('Hostname'),         boardinfo.hostname,
			_('Model'),            boardinfo.model,
			_('Architecture'),     boardinfo.system,
			_('Firmware Version'), (L.isObject(boardinfo.release) ? boardinfo.release.description : '?'),
			_('Kernel Version'),   boardinfo.kernel,
			_('Local Time'),       datestr,
			_('Uptime'),           systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null,
			_('Load Average'),     Array.isArray(systeminfo.load) ? '%.2f, %.2f, %.2f'.format(
				systeminfo.load[0] / 65535.0,
				systeminfo.load[1] / 65535.0,
				systeminfo.load[2] / 65535.0
			) : null
		];

		var systable = E('table', { 'class': 'table' });

		for (var i = 0; i < sysfields.length; i += 2) {
			systable.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ sysfields[i] ]),
				E('td', { 'class': 'td left' }, [ (sysfields[i + 1] != null) ? sysfields[i + 1] : '?' ])
			]));
		}


		var memfields = [
			_('Total Available'), (mem.available) ? mem.available : (mem.total && mem.free && mem.buffered) ? mem.free + mem.buffered : null, mem.total,
			_('Used'),            (mem.total && mem.free) ? (mem.total - mem.free) : null, mem.total,
			_('Buffered'),        (mem.total && mem.buffered) ? mem.buffered : null, mem.total
		];

		if (mem.cached)
			memfields.push(_('Cached'), mem.cached, mem.total);

		if (swap.total > 0)
			memfields.push(_('Swap free'), swap.free, swap.total);

		var memtable = E('table', { 'class': 'table' });

		for (var i = 0; i < memfields.length; i += 3) {
			memtable.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ memfields[i] ]),
				E('td', { 'class': 'td left' }, [
					(memfields[i + 1] != null) ? progressbar(memfields[i + 1], memfields[i + 2], true) : '?'
				])
			]));
		}


		return E([], [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('System')),
				systable
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Memory')),
				memtable
			]),
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
