'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';

const callKeepalivedStatus = rpc.declare({
	object: 'keepalived',
	method: 'dump',
	expect: {  },
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('keepalived'),
		]);
	},

	render: function() {
		var table =
			E('table', { 'class': 'table lases' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Name')),
					E('th', { 'class': 'th' }, _('Interface')),
					E('th', { 'class': 'th' }, _('Active State/State')),
					E('th', { 'class': 'th' }, _('Probes Sent')),
					E('th', { 'class': 'th' }, _('Probes Received')),
					E('th', { 'class': 'th' }, _('Last Transition')),
					E([])
				])
			]);

		poll.add(function() {
			return callKeepalivedStatus().then(function(instancesInfo) {
				var targets = Array.isArray(instancesInfo.status) ? instancesInfo.status : [];
				var instances = uci.sections('keepalived', 'vrrp_instance');

				cbi_update_table(table,
					targets.map(function(target) {
						var state = (target.stats.become_master - target.stats.release_master) ? 'MASTER' : 'BACKUP';
						if (instances != '') {
							for (var i = 0; i < instances.length; i++) {
								if (instances[i]['name'] == target.data.iname) {
									state = state + '/' + instances[i]['state'];
									break;
								}
							}
						}
						return  [
							target.data.iname,
							target.data.ifp_ifname,
							state,
							target.stats.advert_sent,
							target.stats.advert_rcvd,
							new Date(target.data.last_transition * 1000)
						];
					}),
					E('em', _('There are no active instances'))
				);
			});
		});

		return E('div', {'class': 'cbi-map'}, [
			E('h2', _('VRRP')),
			E('div', {'class': 'cbi-map-descr'}, _('This overview shows the current status of the VRRP instances on this device.')),
			E('div', { 'class': 'cbi-section' }, table)
		]);
	},

	handleSave: null,
	handleSaveApply:null,
	handleReset: null
});
