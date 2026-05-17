'use strict';
'require view';
'require rpc';
'require form';
'require poll';

const callApingerStatus = rpc.declare({
	object: 'apinger',
	method: 'status',
	expect: {  },
});

return view.extend({
	render: function() {
		var table =
			E('table', { 'class': 'table lases' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Interface')),
					E('th', { 'class': 'th' }, _('Target')),
					E('th', { 'class': 'th' }, _('Source IP')),
					E('th', { 'class': 'th' }, _('Address')),
					E('th', { 'class': 'th' }, _('Sent')),
					E('th', { 'class': 'th' }, _('Received')),
					E('th', { 'class': 'th' }, _('Latency')),
					E('th', { 'class': 'th' }, _('Loss')),
					E('th', { 'class': 'th' }, _('Active Alarms')),
					E('th', { 'class': 'th' }, _('Time')),
					E([])
				])
			]);

		poll.add(function() {
			return callApingerStatus().then(function(targetInfo) {
				var targets = Array.isArray(targetInfo.targets) ? targetInfo.targets : [];

				cbi_update_table(table,
					targets.map(function(target) {
						return  [ 
							target.interface,
							target.target,
							target.srcip,
							target.address,
							target.sent,
							target.received,
							target.latency,
							target.loss,
							target.alarm,
							new Date(target.timestamp * 1000),
						];	
					}),
					E('em', _('There are no active targets'))
				);
			});
		});

		return E([
			E('h3', _('Apinger Targets')),
			E('br'),
			table
		]);
	},

	handleSave: null,
	handleSaveApply:null,
	handleReset: null
});
