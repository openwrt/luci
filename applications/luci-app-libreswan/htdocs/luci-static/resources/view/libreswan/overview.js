'use strict';
'require view';
'require rpc';
'require form';
'require poll';

var callLibreswanStatus = rpc.declare({
	object: 'libreswan',
	method: 'status',
	expect: {  },
});

function secondsToString(seconds) {
	var str = '';
	var numdays = Math.floor(seconds / 86400);
	var numhours = Math.floor((seconds % 86400) / 3600);
	var numminutes = Math.floor(((seconds % 86400) % 3600) / 60);
	var numseconds = ((seconds % 86400) % 3600) % 60;

	str = (numdays ? numdays + 'd ' : '') + (numhours ? numhours + 'h ' : '') + (numminutes ? numminutes + 'm ' : '') +  numseconds + 's';
	return str;
}

return view.extend({
	render: function() {
		var table =
			E('table', { 'class': 'table lases' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Name')),
					E('th', { 'class': 'th' }, _('Remote')),
					E('th', { 'class': 'th' }, _('Local Subnet')),
					E('th', { 'class': 'th' }, _('Remote Subnet')),
					E('th', { 'class': 'th' }, _('Tx')),
					E('th', { 'class': 'th' }, _('Rx')),
					E('th', { 'class': 'th' }, _('Phase1')),
					E('th', { 'class': 'th' }, _('Phase2')),
					E('th', { 'class': 'th' }, _('Status')),
					E('th', { 'class': 'th' }, _('Uptime')),
					E([])
				])
			]);

		poll.add(function() {
			return callLibreswanStatus().then(function(tunnelsInfo) {
				var tunnels = Array.isArray(tunnelsInfo.tunnels) ? tunnelsInfo.tunnels : [];

				cbi_update_table(table,
					tunnels.map(function(tunnel) {
						return  [
							tunnel.name,
							tunnel.right,
							tunnel.leftsubnet,
							tunnel.rightsubnet,
							tunnel.tx,
							tunnel.rx,
							tunnel.phase1 ? _('Up') : _('Down'),
							tunnel.phase2 ? _('Up') : _('Down'),
							tunnel.connected ? _('Up') : _('Down'),
							secondsToString(tunnel.uptime),
						];
					}),
					E('em', _('There are no active Tunnels'))
				);
			});
		});

		return E([
			E('h3', _('IPSec Tunnels Summary')),
			E('br'),
			table
		]);
	},

	handleSave: null,
	handleSaveApply:null,
	handleReset: null
});
