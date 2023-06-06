'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

const monthAbbrevs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",	"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

function todatetime(timestamp) {
	var date = new Date(timestamp * 1000);

	return '%04d-%s-%02d %02d:%02d:%02d.%03d'.format(
		date.getUTCFullYear(),
		monthAbbrevs[date.getUTCMonth()],
		date.getUTCDate(),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds()
	);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/bin/dmesg', [ '-r' ]), {}),
			L.resolveDefault(L.resolveDefault(callSystemInfo(), {}))
		]).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
			return '';
		});
	},

	render: function(data) {
		var logdata     = data[0],
			systeminfo  = data[1];

		var loglines = null;

		if (systeminfo.localtime) {
			var startTime = systeminfo.localtime - systeminfo.uptime;

			loglines = logdata.trim().split(/\n/).map(function(line) {
				return line.replace(/^<\d+>\[\ *(?<offset>\d+\.\d+)\](?<rest>.*)/, (...match) => {
					let groups = match.pop();
					return `${todatetime(startTime + Number.parseFloat(groups.offset))} ${groups.rest}`;
				  });
			});
		}
		else {
			loglines = logdata.trim().split(/\n/).map(function(line) {
				return line.replace(/^<\d+>/, '');
			});
		}

		return E([], [
			E('h2', {}, [ _('Kernel Log') ]),
			E('div', { 'id': 'content_syslog' }, [
				E('textarea', {
					'id': 'syslog',
					'style': 'font-size:12px',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': loglines.length + 1
				}, [ loglines.join('\n') ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
