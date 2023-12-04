'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';
'require form';
'require uci';


var Hosts,Remotehosts,Remoteinfo,Localinfo,Clients;
var HearingMap = form.DummyValue.extend({
	renderWidget: function() {
		var body = E([
			E('h3', _('Hearing map'))
		]);
		for(var mac in Clients) {
			var maciphost='';
			maciphost=mac;
			var macUp=String(mac).toUpperCase()
			if (typeof Hosts[macUp] !== 'undefined') {
				if ((String(Hosts[macUp]['ipaddrs'][0]).length>0) && (typeof Hosts[macUp]['ipaddrs'][0] !== 'undefined'))
					maciphost+='\u2003'+Hosts[macUp]['ipaddrs'];
				if ((String(Hosts[macUp]['name']).length>0) && (typeof Hosts[macUp]['name'] !== 'undefined')) 
					maciphost+='\u2003%h'.format(Hosts[macUp]['name']);
				}
			body.appendChild(
				E('h4', maciphost)
			);
			var client_table = E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th', 'style': 'width:35%' }, _('IP & Interface','Combination of IP and interface name in usteer overview')),
					E('th', { 'class': 'th', 'style': 'width:25%' }, _('SSID')),
					E('th', { 'class': 'th', 'style': 'width:15%' }, _('Frequency', 'BSS operating frequency in usteer overview')),
					E('th', { 'class': 'th', 'style': 'width:15%' }, _('Connected', 'Connection state in usteer overview')),
					E('th', { 'class': 'th', 'style': 'width:15%' }, _('Signal','Signal strength reported by wireless station in usteer overview'))
				])
			]);
			var client_table_entries =[];
			for(var wlanc in Clients[mac]) {
				var SSID='';
				var freq=0;
				if (typeof Localinfo[wlanc] !== 'undefined') { 
					SSID=Localinfo[wlanc]['ssid'];
					freq=Localinfo[wlanc]['freq'];
				} 
				if (typeof Remoteinfo[wlanc] !== 'undefined') { 
					SSID=Remoteinfo[wlanc]['ssid'];
					freq=Remoteinfo[wlanc]['freq'];
				}
				client_table_entries.push([
					'<nobr>'+wlanc+'</nobr>', 
					SSID,
					freq,
					Clients[mac][wlanc]['connected'] === true ? 'Yes' : 'No',
					Clients[mac][wlanc]['signal']
				]);
			}
			cbi_update_table(client_table, client_table_entries, E('em', _('No data')));
			body.appendChild(client_table);
		}
		return E('div', { 'class': 'cbi-section cbi-tblsection' }, [body]);
	}
});
var Clientinfooverview = form.DummyValue.extend({
	renderWidget: function() {
		var body = E([
			E('h3', 'Remotehosts')
		]);
		var remotehost_table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('IP address')),
				E('th', { 'class': 'th' }, _('Identifier'))
			])
		]);
		var remotehosttableentries =[];
		for(var IPaddr in Remotehosts) {
			remotehosttableentries.push([IPaddr, Remotehosts[IPaddr]['id']]);
		}
		cbi_update_table(remotehost_table, remotehosttableentries, E('em', _('No data')));
		body.appendChild(remotehost_table);
		body.appendChild(
			E('h3', 'Client list')
		);
		var connectioninfo_table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('IP & Interface name','Combination of IP and interface name in usteer overview')),
				E('th', { 'class': 'th' }, _('BSSID')),
				E('th', { 'class': 'th' }, _('SSID')),
				E('th', { 'class': 'th' }, _('Frequency', 'BSS operating frequency in usteer overview')),
				E('th', { 'class': 'th' }, _('N', 'Number of associated clients in usteer overview')),
				E('th', { 'class': 'th' }, _('Noise', 'Channel noise in usteer overview')),
				E('th', { 'class': 'th' }, _('Load', 'Channel load in usteer overview')),
				E('th', { 'class': 'th' }, _('Max assoc','Max associated clients in usteer overview')),
				E('th', { 'class': 'th' }, _('Roam src','Roam source in usteer overview')),
				E('th', { 'class': 'th' }, _('Roam tgt','Roam target in usteer overview'))
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
							typeof Localinfo[wlan]['roam_events']['source'] !== 'undefined' ?  Localinfo[wlan]['roam_events']['source'] : '',
							typeof Localinfo[wlan]['roam_events']['target'] !== 'undefined' ?  Localinfo[wlan]['roam_events']['target'] : ''
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
							typeof Remoteinfo[wlan]['roam_events']['source'] !== 'undefined' ?  Remoteinfo[wlan]['roam_events']['source'] : '',
							typeof Remoteinfo[wlan]['roam_events']['target'] !== 'undefined' ?  Remoteinfo[wlan]['roam_events']['target'] : ''
			]);
		}
		cbi_update_table(connectioninfo_table, connectioninfo_table_entries, E('em', _('No data')));
		body.appendChild(connectioninfo_table);
		var compactconnectioninfo_table = E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('IP & Interface name','Combination of IP and interface name in usteer overview')),
					E('th', { 'class': 'th' }, _('SSID')),
					E('th', { 'class': 'th' }, _('Frequency', 'BSS operating frequency in usteer overview')),
					E('th', { 'class': 'th' }, _('Load', 'Channel load in usteer overview')),
					E('th', { 'class': 'th' }, _('N', 'Number of associated clients in usteer overview')),
					E('th', { 'class': 'th' }, _('Host','host hint in usteer overview'))

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
							if (typeof Hosts[macUp] !== 'undefined') {
								if ((String(Hosts[macUp]['ipaddrs'][0]).length>0) && (typeof Hosts[macUp]['ipaddrs'][0] !== 'undefined')) {
									foundname=Hosts[macUp]['ipaddrs'][0];
								}
								if ((String(Hosts[macUp]['name']).length>0) && (typeof Hosts[macUp]['name'] !== 'undefined')) {
									foundname=Hosts[macUp]['name'];
								}
							}
							hostl += '%h\u2003'.format(foundname);
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
							if (typeof Hosts[macUp] !== 'undefined') {
								if ((String(Hosts[macUp]['ipaddrs'][0]).length>0) && (typeof Hosts[macUp]['ipaddrs'][0] !== 'undefined')) {
									foundname=Hosts[macUp]['ipaddrs'][0];
								}
								if ((String(Hosts[macUp]['name']).length>0) &&	(typeof Hosts[macUp]['name'] !== 'undefined')) {
									foundname=Hosts[macUp]['name'];
								}
							}
							hostl += '%h\u2003'.format(foundname);
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
		return E('div', { 'class': 'cbi-section cbi-tblsection' }, [body]);
	}
});

var Settingstitle = form.DummyValue.extend({
	renderWidget: function() {
		var body = E([
			E('h3', 'Settings'),
			E('body','First four options are mandatory. Also be sure to enable rrm reports, 80211kv, etc see: https://openwrt.org/docs/guide-user/network/wifi/usteer')
		]);
		return E('div', [body]);
	}
});

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
	render: function(data) {
		var m, s, o;
		Hosts = data[0];
		Remotehosts=data[1];
		Remoteinfo=data[2];
		Localinfo=data[3];
		Clients=data[4];

		m = new form.Map('usteer', _('Usteer'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.tab('status', _("Status"));
		s.tab('hearingmap', _("Hearing map"));
		s.tab('settings', _("Settings"));

		o = s.taboption('status',Clientinfooverview);

		o = s.taboption('hearingmap',HearingMap);

		o = s.taboption('settings',Settingstitle);
		o = s.taboption('settings',form.Value, 'network', _('Network'), _('The network interface for inter-AP communication'));

		o = s.taboption('settings',form.Flag, 'syslog', _('Syslog'), _('Log messages to syslog (0/1)'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('settings',form.Flag, 'ipv6', _('IPv6 mode'), _('Use IPv6 for remote exchange'));
		o.rmempty = false;

		o = s.taboption('settings',form.ListValue, 'debug_level', _('Debug level'), _('Debug level'));
		o.placeholder = 'lan';
		o.value('0','0 Fatal');
		o.value('1','1 Info');
		o.value('2','2 Verbose');
		o.value('3','3 Some debug');
		o.value('4','4 Network packet info');
		o.value('5','5 All debug messages');
		o.rmempty = false;
		o.editable = true;

		o = s.taboption('settings',form.Value, 'max_neighbour_reports', _('Max neighbour reports'), _('Maximum number of neighbor reports set for a node'));
		o.optional    = true;
		o.placeholder = 8;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'sta_block_timeout', _('Sta block timeout'), _('Maximum amount of time (ms) a station may be blocked due to policy decisions'));
		o.optional    = true;
		o.placeholder = 30000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'local_sta_timeout', _('Local sta timeout'), _('Maximum amount of time (ms) a local unconnected station is tracked'));
		o.optional    = true;
		o.placeholder = 12000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'measurement_report_timeout', _('Measurement report timeout'), _('Maximum amount of time (ms) a measurement report is stored'));
		o.optional    = true;
		o.placeholder = 120000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'local_sta_update', _('Local sta update'), _('Local station information update interval (ms)'));
		o.optional    = true;
		o.placeholder = 1000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'max_retry_band', _('Max retry band'), _('Maximum number of consecutive times a station may be blocked by policy'));
		o.optional    = true;
		o.placeholder = 5;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'seen_policy_timeout', _('Seen policy timeout'), _('Maximum idle time of a station entry (ms) to be considered for policy decisions'));
		o.optional    = true;
		o.placeholder = 30000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'load_balancing_threshold', _('Load balancing threshold'), _('Minimum number of stations delta between APs before load balancing policy is active'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'band_steering_threshold', _('Band steering threshold'), _('Minimum number of stations delta between bands before band steering policy is active'));
		o.optional    = true;
		o.placeholder = 5;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'remote_update_interval', _('Remote update interval'), _('Interval (ms) between sending state updates to other APs'));
		o.optional    = true;
		o.placeholder = 1000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'remote_node_timeout', _('Remote node timeout'), _('Number of remote update intervals after which a remote-node is deleted'));
		o.optional    = true;
		o.placeholder = 10;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Flag, 'assoc_steering', _('Assoc steering'), _('Allow rejecting assoc requests for steering purposes (0/1)'));
		o.optional    = true;

		o = s.taboption('settings',form.Flag, 'probe_steering', _('Probe steering'), _('Allow ignoring probe requests for steering purposes (0/1)'));
		o.optional    = true;

		o = s.taboption('settings',form.Value, 'min_connect_snr', _('Min connect snr'), _('Minimum signal-to-noise ratio or signal level (dBm) to allow connections'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'integer';

		o = s.taboption('settings',form.Value, 'min_snr', _('Min snr'), _('Minimum signal-to-noise ratio or signal level (dBm) to remain connected'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'integer';

		o = s.taboption('settings',form.Value, 'min_snr_kick_delay', _('Min snr kick delay'), _('Timeout after which a station with snr < min_snr will be kicked'));
		o.optional    = true;
		o.placeholder = 5000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'roam_process_timeout', _('Roam process timeout'), _('Timeout (in ms) after which a association following a disassociation is not seen as a roam'));
		o.optional    = true;
		o.placeholder = 5000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'roam_scan_snr', _('Roam scan snr'), _('Minimum signal-to-noise ratio or signal level (dBm) before attempting to trigger client scans for roam'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'integer';

		o = s.taboption('settings',form.Value, 'roam_scan_tries', _('Roam scan tries'), _('Maximum number of client roaming scan trigger attempts'));
		o.optional    = true;
		o.placeholder = 3;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'roam_scan_timeout', _('Roam scan timeout'), _('Retry scanning when roam_scan_tries is exceeded after this timeout (in ms). In case this option is set to 0, the client is kicked instead'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'roam_scan_interval', _('Roam scan interval'), _('Minimum time (ms) between client roaming scan trigger attempts'));
		o.optional    = true;
		o.placeholder = 10000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'roam_trigger_snr', _('Roam trigger snr'), _('Minimum signal-to-noise ratio or signal level (dBm) before attempting to trigger forced client roaming'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'integer';

		o = s.taboption('settings',form.Value, 'roam_trigger_interval', _('Roam trigger interval'), _('Minimum time (ms) between client roaming trigger attempts'));
		o.optional    = true;
		o.placeholder = 60000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'roam_kick_delay', _('Roam kick delay'), _('Timeout (in 100ms beacon intervals) for client roam requests'));
		o.optional    = true;
		o.placeholder = 100;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'signal_diff_threshold', _('Signal diff threshold'), _('Minimum signal strength difference until AP steering policy is active'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'initial_connect_delay', _('Initial connect delay'), _('Initial delay (ms) before responding to probe requests (to allow other APs to see packets as well)'));
		o.optional    = true;
		o.placeholder = 0;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Flag, 'load_kick_enabled', _('Load kick enabled'), _('Enable kicking client on excessive channel load (0/1)'));
		o.optional    = true;

		o = s.taboption('settings',form.Value, 'load_kick_threshold', _('Load kick threshold'), _('Minimum channel load (%) before kicking clients'));
		o.optional    = true;
		o.placeholder = 75;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'load_kick_delay', _('Load kick delay'), _('Minimum amount of time (ms) that channel load is above threshold before starting to kick clients'));
		o.optional    = true;
		o.placeholder = 10000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'load_kick_min_clients', _('Load kick min clients'), _('Minimum number of connected clients before kicking based on channel load'));
		o.optional    = true;
		o.placeholder = 10;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'load_kick_reason_code', _('Load kick reason code'), _('Reason code on client kick based on channel load (default: WLAN_REASON_DISASSOC_AP_BUSY)'));
		o.optional    = true;
		o.placeholder = 5;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'band_steering_interval', _('Band steering interval'), _('Attempting to steer clients to a higher frequency-band every n ms. A value of 0 disables band-steering.'));
		o.optional    = true;
		o.placeholder = 120000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'band_steering_min_snr', _('Band steering min snr'), _('Minimal SNR or absolute signal a device has to maintain over band_steering_interval to be steered to a higher frequency band.'));
		o.optional    = true;
		o.placeholder = -60;
		o.datatype    = 'integer';

		o = s.taboption('settings',form.Value, 'link_measurement_interval', _('Link measurement interval'), _('Interval (ms) the device is sent a link-measurement request to help assess the bi-directional link quality. Setting the interval to 0 disables link-measurements.'));
		o.optional    = true;
		o.placeholder = 30000;
		o.datatype    = 'uinteger';

		o = s.taboption('settings',form.Value, 'node_up_script', _('Node up script'), _('Script to run after bringing up a node'));
		o.optional    = true;
		o.datatype    = 'string';

		o = s.taboption('settings',form.MultiValue, 'event_log_types', _('Event log types'), _('Message types to include in log. Available types: probe_req_accept probe_req_deny, auth_req_accept, auth_req_deny, assoc_req_accept, assoc_req_deny, load_kick_trigger, load_kick_reset, load_kick_min_clients, load_kick_no_client, load_kick_client, signal_kick'));
		o.value('probe_req_accept');
		o.value('probe_req_deny');
		o.value('auth_req_accept');
		o.value('auth_req_deny');
		o.value('assoc_req_accept');
		o.value('assoc_req_deny');
		o.value('load_kick_trigger');
		o.value('load_kick_reset');
		o.value('load_kick_min_clients');
		o.value('load_kick_no_client');
		o.value('load_kick_client');
		o.value('signal_kick');
		o.optional    = true;
		o.datatype    = 'list(string)';

		o = s.taboption('settings',form.DynamicList, 'ssid_list', _('SSID list'), _('List of SSIDs to enable steering on'));
		o.optional    = true;
		o.datatype    = 'list(string)';

		return m.render();
	},
});
