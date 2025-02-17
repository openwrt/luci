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
					E('th', { 'class': 'th' }, _('Active State')),
					E('th', { 'class': 'th' }, _('Initial State')),
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
						var state;
						var state_initial;
						var instance_state = target.data.state;

						if (instance_state === 2) {
							state = 'MASTER';
						} else if (instance_state === 1) {
							state = 'BACKUP';
						} else if (instance_state === 0) {
							state = 'INIT';
						} else if (instance_state === 3) {
							state = 'FAULT';
						} else {
							state = 'UNKNOWN';
						}

						if (instances != '') {
							for (var i = 0; i < instances.length; i++) {
								if (instances[i]['name'] == target.data.iname) {
									state = state;
									state_initial = instances[i]['state'];
									break;
								}
							}
						}
						return  [
							target.data.iname,
							target.data.ifp_ifname,
							state,
							state_initial,
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
