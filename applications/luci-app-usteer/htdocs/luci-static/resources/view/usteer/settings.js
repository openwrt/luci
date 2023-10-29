//'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
	var m, s, o;

	m = new form.Map('usteer', _('usteer'), _('usteer Configuration.'));

	s = m.section(form.TypedSection, 'usteer', _('options'), _('First four options are mandatory. Also be sure to enable rrm reports, 80211kvr, etc see: https://openwrt.org/docs/guide-user/network/wifi/usteer'));
	s.anonymous = true;

	s.option(form.Value, 'network', _('network'), _('The network interface for inter-AP communication)'));

	o = s.option(form.Flag, 'syslog', _('Syslog'), _('Log messages to syslog (0/1)'));
	o.default = '1';
	o.rmempty = false;

	o = s.option(form.Flag, 'ipv6', _('ipv6 mode'), _('Use IPv6 for remote exchange'));
	o.rmempty = false;

	o = s.option(form.ListValue, 'debug_level', _('debug level'), _('Debug level'));
	o.placeholder = 'lan';
	o.value('0','0 Fatal');
	o.value('1','1 info');
	o.value('2','2 Verbose');
	o.value('3','3 Some debug');
	o.value('4','4 network packet info');
	o.value('5','5 all debug messages');
	o.rmempty = false;
	o.editable = true;

	o = s.option(form.Value, 'max_neighbour_reports', _('max neighbour reports'), _('Maximum number of neighbor reports set for a node'));
	o.optional    = true;
	o.placeholder = 8;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'sta_block_timeout', _('sta block timeout reports'), _('Maximum amount of time (ms) a station may be blocked due to policy decisions'));
	o.optional    = true;
	o.placeholder = 30000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'local_sta_timeout', _('local sta timeout'), _('Maximum amount of time (ms) a local unconnected station is tracked'));
	o.optional    = true;
	o.placeholder = 12000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'measurement_report_timeout', _('measurement report timeout'), _('Maximum amount of time (ms) a measurement report is stored'));
	o.optional    = true;
	o.placeholder = 120000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'local_sta_update', _('local_sta_update'), _('Local station information update interval (ms)'));
	o.optional    = true;
	o.placeholder = 1000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'max_retry_band', _('max retry band'), _('Maximum number of consecutive times a station may be blocked by policy'));
	o.optional    = true;
	o.placeholder = 5;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'seen_policy_timeout', _('seen policy timeout'), _('Maximum idle time of a station entry (ms) to be considered for policy decisions'));
	o.optional    = true;
	o.placeholder = 30000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'load_balancing_threshold', _('load_balancing_threshold'), _('Minimum number of stations delta between APs before load balancing policy is active'));
	o.optional    = true;
	o.placeholder = 5;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'band_steering_threshold', _('band_steering_threshold'), _('Minimum number of stations delta between bands before band steering policy is active'));
	o.optional    = true;
	o.placeholder = 5;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'band_steering_threshold', _('band_steering_threshold'), _('Minimum number of stations delta between bands before band steering policy is active'));
	o.optional    = true;
	o.placeholder = 5;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'remote_update_interval', _('remote_update_interval'), _('Interval (ms) between sending state updates to other APs'));
	o.optional    = true;
	o.placeholder = 1000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'remote_node_timeout', _('remote_node_timeout'), _('Number of remote update intervals after which a remote-node is deleted'));
	o.optional    = true;
	o.placeholder = 10;
	o.datatype    = 'uinteger';

	o = s.option(form.Flag, 'assoc_steering', _('assoc_steering'), _('Allow rejecting assoc requests for steering purposes (0/1)'));
	o.optional    = true;

	o = s.option(form.Value, 'min_connect_snr', _('min_connect_snr'), _('Minimum signal-to-noise ratio or signal level (dBm) to allow connections'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'min_snr', _('min_snr'), _('Minimum signal-to-noise ratio or signal level (dBm) to remain connected'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'min_snr_kick_delay', _('min_snr_kick_delay'), _('Timeout after which a station with snr < min_snr will be kicked'));
	o.optional    = true;
	o.placeholder = 5000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_process_timeout', _('roam_process_timeout'), _('Timeout (in ms) after which a association following a disassociation is not seen as a roam'));
	o.optional    = true;
	o.placeholder = 5000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_scan_snr', _('roam_scan_snr'), _('Minimum signal-to-noise ratio or signal level (dBm) before attempting to trigger client scans for roam'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_scan_tries', _('roam_scan_tries'), _('Maximum number of client roaming scan trigger attempts'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_scan_timeout', _('roam_scan_timeout'), _('Retry scanning when roam_scan_tries is exceeded after this timeout (in ms). In case this option is set to 0, the client is kicked instead'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_scan_interval', _('roam_scan_interval'), _('Minimum time (ms) between client roaming scan trigger attempts'));
	o.optional    = true;
	o.placeholder = 10000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_trigger_snr', _('roam_trigger_snr'), _('Minimum signal-to-noise ratio or signal level (dBm) before attempting to trigger forced client roaming'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_trigger_interval', _('roam_trigger_interval'), _('Minimum time (ms) between client roaming trigger attempts'));
	o.optional    = true;
	o.placeholder = 60000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'roam_kick_delay', _('roam_kick_delay'), _('Timeout (in 100ms beacon intervals) for client roam requests'));
	o.optional    = true;
	o.placeholder = 100;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'signal_diff_threshold', _('signal_diff_threshold'), _('Minimum signal strength difference until AP steering policy is active'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'initial_connect_delay', _('initial_connect_delay'), _('Initial delay (ms) before responding to probe requests (to allow other APs to see packets as well)'));
	o.optional    = true;
	o.placeholder = 0;
	o.datatype    = 'uinteger';

	o = s.option(form.Flag, 'load_kick_enabled', _('load_kick_enabled'), _('Enable kicking client on excessive channel load (0/1)'));
	o.optional    = true;

	o = s.option(form.Value, 'load_kick_threshold', _('load_kick_threshold'), _('Minimum channel load (%) before kicking clients'));
	o.optional    = true;
	o.placeholder = 75;
	o.datatype    = 'uinteger';
	
	o = s.option(form.Value, 'load_kick_delay', _('load_kick_delay'), _('Minimum amount of time (ms) that channel load is above threshold before starting to kick clients'));
	o.optional    = true;
	o.placeholder = 10000;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'load_kick_min_clients', _('load_kick_min_clients'), _('Minimum number of connected clients before kicking based on channel load'));
	o.optional    = true;
	o.placeholder = 10;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'load_kick_reason_code', _('load_kick_reason_code'), _('Reason code on client kick based on channel load (default: WLAN_REASON_DISASSOC_AP_BUSY)'));
	o.optional    = true;
	o.placeholder = 5;
	o.datatype    = 'uinteger';

	o = s.option(form.Value, 'node_up_script', _('node_up_script'), _('Script to run after bringing up a node'));
	o.optional    = true;
	o.datatype    = 'string';

	o = s.option(form.Value, 'event_log_types', _('event_log_types'), _('Message types to include in log. Available types: probe_req_accept probe_req_deny, auth_req_accept, auth_req_deny, assoc_req_accept, assoc_req_deny, load_kick_trigger, load_kick_reset, load_kick_min_clients, load_kick_no_client, load_kick_client, signal_kick'));
	o.optional    = true;
	o.datatype    = 'list(string)';

	o = s.option(form.Value, 'ssid_list', _('ssid_list'), _('List of SSIDs to enable steering on'));
	o.optional    = true;
	o.datatype    = 'list(string)';

	return m.render();
	},
});
