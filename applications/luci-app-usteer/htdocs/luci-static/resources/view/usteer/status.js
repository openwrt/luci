'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';

return view.extend({
	
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),
	callGetRemotehosts: rpc.declare({
		object: 'usteer',
		method: 'remote_hosts',
		expect: {  '': {}}
	}),
	callGetRemoteinfo: rpc.declare({
		object: 'usteer',
		method: 'remote_info',
		expect: { '': {} }
	}),
	callGetLocalinfo: rpc.declare({
		object: 'usteer',
		method: 'local_info',
		expect: { '': {} }
	}),
	callGetClients: rpc.declare({
		object: 'usteer',
		method: 'get_clients',
		expect: { '': {} }
	}),


	load: function() {
		return Promise.all([
			this.callHostHints(),
			this.callGetRemotehosts(),
			this.callGetRemoteinfo(),
			this.callGetLocalinfo(),
			this.callGetClients()
			
		]);
	},
	handleReset: null,
	handleSaveApply: null,
	handleSave: null,
	
	render: function(data) {
	
		var hosts = data[0];
		var Remotehosts=data[1];
		var Remoteinfo=data[2];
		var Localinfo=data[3];
		var Clients=data[4];



		var body = E([
			E('h2', _('Usteer status'))
		]);


/////////////////////////
		body.appendChild(
			E('h3', 'Remotehosts')
		);
		var remotehost_table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('IP address')),
				E('th', { 'class': 'th' }, _('identifier'))
			])
		]);
		
		var remotehosttableentries =[];
		for(var IPaddr in Remotehosts) {
			remotehosttableentries.push([
							IPaddr, Remotehosts[IPaddr]['id']
						]);
				}	

		cbi_update_table(remotehost_table, remotehosttableentries, E('em', _('No data')));
		body.appendChild(remotehost_table);
		
/////////////////////////
		body.appendChild(
			E('h3', 'Client list')
		);
		var connectioninfo_table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('wlan')),
				E('th', { 'class': 'th' }, _('bssid')),
				E('th', { 'class': 'th' }, _('ssid')),
				E('th', { 'class': 'th' }, _('freq')),
				E('th', { 'class': 'th' }, _('n assoc')),
				E('th', { 'class': 'th' }, _('noise')),
				E('th', { 'class': 'th' }, _('load')),
				E('th', { 'class': 'th' }, _('max assoc')),
				E('th', { 'class': 'th' }, _('roam src')),
				E('th', { 'class': 'th' }, _('roam tgt')),
				E('th', { 'class': 'th' }, _('rrm_nr mac')),
				E('th', { 'class': 'th' }, _('rrm_nr hex'))
				
			])
		]);
	
		var connectioninfo_table_entries =[];
		for(var wlan in Localinfo) {
			connectioninfo_table_entries.push([
							'<nobr>'+wlan+'</nobr>', 
							Localinfo[wlan]['bssid'],
							Localinfo[wlan]['ssid'],
							Localinfo[wlan]['freq'],
							Localinfo[wlan]['n_assoc'],														
							Localinfo[wlan]['noise'],														
							Localinfo[wlan]['load'],														
							Localinfo[wlan]['max_assoc'],														
							Localinfo[wlan]['roam_events']['source'],														
							Localinfo[wlan]['roam_events']['target'],														
							Localinfo[wlan]['rrm_nr'][0],																					
							Localinfo[wlan]['rrm_nr'][2]		
						]);
				}	
		for(var wlan in Remoteinfo) {
			connectioninfo_table_entries.push([
							'<nobr>'+wlan+'</nobr>', 
							Remoteinfo[wlan]['bssid'],
							Remoteinfo[wlan]['ssid'],
							Remoteinfo[wlan]['freq'],
							Remoteinfo[wlan]['n_assoc'],														
							Remoteinfo[wlan]['noise'],														
							Remoteinfo[wlan]['load'],														
							Remoteinfo[wlan]['max_assoc'],														
							Remoteinfo[wlan]['roam_events']['source'],														
							Remoteinfo[wlan]['roam_events']['target'],														
							Remoteinfo[wlan]['rrm_nr'][0],																					
							Remoteinfo[wlan]['rrm_nr'][2]		

						]);
				}	
		cbi_update_table(connectioninfo_table, connectioninfo_table_entries, E('em', _('No data')));
		body.appendChild(connectioninfo_table);
/////////////////////////////////////////


		var compactconnectioninfo_table = E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('wlan')),
					E('th', { 'class': 'th' }, _('ssid')),
					E('th', { 'class': 'th' }, _('freq')),
					E('th', { 'class': 'th' }, _('load')),
					E('th', { 'class': 'th' }, _('n')),
					E('th', { 'class': 'th' }, _('host'))
					
				])
			]);
		var compactconnectioninfo_table_entries =[];
		for(var wlan in Localinfo) {
			var hostl=''
			for(var mac in Clients) {
				if (typeof Clients[mac] !== 'undefined') 
					if (typeof Clients[mac][wlan] !== 'undefined') 
					if (String(Clients[mac][wlan]['connected']).valueOf()==String("true").valueOf()) {
							var foundname=mac;
							var macUp=String(mac).toUpperCase()
							if (typeof hosts[macUp] !== 'undefined') {
								if ((String(hosts[macUp]['ipaddrs'][0]).length>0) && (typeof hosts[macUp]['ipaddrs'][0] !== 'undefined')) {
									foundname=hosts[macUp]['ipaddrs'][0];
								}
								if ((String(hosts[macUp]['name']).length>0) && (typeof hosts[macUp]['name'] !== 'undefined')) {
									foundname=hosts[macUp]['name'];
								}
							}
							hostl=hostl+ foundname+'&emsp;';
				}
			}		
			compactconnectioninfo_table_entries.push([
								'<nobr>'+wlan+'</nobr>', 
								Localinfo[wlan]['ssid'],
								Localinfo[wlan]['freq'],
								Localinfo[wlan]['load'],
								Localinfo[wlan]['n_assoc'],
								hostl
							]);			
		}
		for(var wlan in Remoteinfo) {
			var hostl=''
			for(var mac in Clients) {
				if (typeof Clients[mac] !== 'undefined') 
					if (typeof Clients[mac][wlan] !== 'undefined') 
					if (String(Clients[mac][wlan]['connected']).valueOf()==String("true").valueOf()) {
							var foundname=mac;
							var macUp=String(mac).toUpperCase()
							if (typeof hosts[macUp] !== 'undefined') {
								if ((String(hosts[macUp]['ipaddrs'][0]).length>0) && (typeof hosts[macUp]['ipaddrs'][0] !== 'undefined')) {
									foundname=hosts[macUp]['ipaddrs'][0]; 
								}
								if ((String(hosts[macUp]['name']).length>0) &&	(typeof hosts[macUp]['name'] !== 'undefined')) {
									foundname=hosts[macUp]['name'];
								}
							}
							hostl=hostl+ foundname+'&emsp;';
				}
			}	
			compactconnectioninfo_table_entries.push([
								'<nobr>'+wlan+'</nobr>', 
								Remoteinfo[wlan]['ssid'],
								Remoteinfo[wlan]['freq'],
								Remoteinfo[wlan]['load'],
								Remoteinfo[wlan]['n_assoc'],
								hostl
							]);			
		}		
		
		cbi_update_table(compactconnectioninfo_table, compactconnectioninfo_table_entries, E('em', _('No data')));
		body.appendChild(compactconnectioninfo_table);


/////////////////////////
		body.appendChild(
			E('h3', 'Hearing map')
		);
		for(var mac in Clients) {
			var maciphost='';
			maciphost='Mac: '+mac;
			var macUp=String(mac).toUpperCase()
				if (typeof hosts[macUp] !== 'undefined') {
					if (typeof hosts[macUp]['ipaddrs'] !== 'undefined') 
						maciphost=maciphost+'&emsp;IP: '+hosts[macUp]['ipaddrs'];
					if (typeof hosts[macUp]['name'] !== 'undefined') 
						maciphost=maciphost+'&emsp;Host: '+hosts[macUp]['name'];
				}
			body.appendChild(
				E('h4', maciphost)
			);
			var client_table = E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('wlan')),
					E('th', { 'class': 'th' }, _('connected')),
					E('th', { 'class': 'th' }, _('signal'))					
				])
			]);
		
			var client_table_entries =[];
			for(var wlanc in Clients[mac]) {				
				client_table_entries.push([
					'<nobr>'+wlanc+'</nobr>', 
					(String(Clients[mac][wlanc]['connected']).valueOf()==String("true").valueOf()) ? "True" : "",
					Clients[mac][wlanc]['signal']
				]);
			}	
			cbi_update_table(client_table, client_table_entries, E('em', _('No data')));
			body.appendChild(client_table);
		}
	
		return body;

	}


});

