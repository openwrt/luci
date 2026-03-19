'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

var callLuciProcessList = rpc.declare({
	object: 'luci',
	method: 'getProcessList',
	expect: { result: [] }
});

return view.extend({
	load: function() {
		return callLuciProcessList();
	},

	handleSignal: function(signum, pid, ev) {
		return fs.exec('/bin/kill', ['-%d'.format(signum), '%s'.format(pid)]).then(L.bind(function() {
			return callLuciProcessList().then(L.bind(function(processes) {
				this.updateTable('.table', processes);
			}, this));
		}, this)).catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	updateTable: function(table, processes) {
		var rows = [];

		processes.sort(function(a, b) {
			return (a.PID - b.PID);
		});

		for (var i = 0; i < processes.length; i++) {
			var proc = processes[i];

			rows.push([
				proc.PID,
				proc.USER,
				E('span', {'style': 'word-break: break-word'}, proc.COMMAND),
				proc['%CPU'],
				proc['%MEM'],
				E('div', {}, [
					E('button', {
						'class': 'btn cbi-button-action',
						'click': ui.createHandlerFn(this, 'handleSignal', 1, proc.PID)
					}, _('Hang Up')), ' ',
					E('button', {
						'class': 'btn cbi-button-negative',
						'click': ui.createHandlerFn(this, 'handleSignal', 15, proc.PID)
					}, _('Terminate')), ' ',
					E('button', {
						'class': 'btn cbi-button-negative',
						'click': ui.createHandlerFn(this, 'handleSignal', 9, proc.PID)
					}, _('Kill'))
				])
			]);
		}

		cbi_update_table(table, rows, E('em', _('No information available')));
	},

	render: function(processes) {
		var v = E([], [
			E('h2', _('Processes')),
			E('div', { 'class': 'cbi-map-descr' }, _('This list gives an overview over currently running system processes and their status.')),

			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('PID')),
					E('th', { 'class': 'th' }, _('Owner')),
					E('th', { 'class': 'th' }, _('Command')),
					E('th', { 'class': 'th' }, _('CPU usage (%)')),
					E('th', { 'class': 'th' }, _('Memory usage (%)')),
					E('th', { 'class': 'th center nowrap cbi-section-actions' })
				])
			])
		]);

		this.updateTable(v.lastElementChild, processes);

		return v;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
