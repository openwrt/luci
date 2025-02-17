'use strict';
'require uci';
'require view';
'require form';

var CBI80211StatusCode = form.ListValue.extend(/** @lends LuCI.form.ListValue.prototype */ {
	__name__: 'CBI.80211StatusCode',

	__init__: function() {
		this.super('__init__', arguments);

		this.value('0', 'SUCCESS');
		this.value('1', 'UNSPECIFIED_FAILURE');
		this.value('2', 'TDLS_WAKEUP_ALTERNATE');
		this.value('3', 'TDLS_WAKEUP_REJECT');
		this.value('5', 'SECURITY_DISABLED');
		this.value('6', 'UNACCEPTABLE_LIFETIME');
		this.value('7', 'NOT_IN_SAME_BSS');
		this.value('10', 'CAPS_UNSUPPORTED');
		this.value('11', 'REASSOC_NO_ASSOC');
		this.value('12', 'ASSOC_DENIED_UNSPEC');
		this.value('13', 'NOT_SUPPORTED_AUTH_ALG');
		this.value('14', 'UNKNOWN_AUTH_TRANSACTION');
		this.value('15', 'CHALLENGE_FAIL');
		this.value('16', 'AUTH_TIMEOUT');
		this.value('17', 'AP_UNABLE_TO_HANDLE_NEW_STA');
		this.value('18', 'ASSOC_DENIED_RATES');
		this.value('19', 'ASSOC_DENIED_NOSHORT');
		this.value('22', 'SPEC_MGMT_REQUIRED');
		this.value('23', 'PWR_CAPABILITY_NOT_VALID');
		this.value('24', 'SUPPORTED_CHANNEL_NOT_VALID');
		this.value('25', 'ASSOC_DENIED_NO_SHORT_SLOT_TIME');
		this.value('27', 'ASSOC_DENIED_NO_HT');
		this.value('28', 'R0KH_UNREACHABLE');
		this.value('29', 'ASSOC_DENIED_NO_PCO');
		this.value('30', 'ASSOC_REJECTED_TEMPORARILY');
		this.value('31', 'ROBUST_MGMT_FRAME_POLICY_VIOLATION');
		this.value('32', 'UNSPECIFIED_QOS_FAILURE');
		this.value('33', 'DENIED_INSUFFICIENT_BANDWIDTH');
		this.value('34', 'DENIED_POOR_CHANNEL_CONDITIONS');
		this.value('35', 'DENIED_QOS_NOT_SUPPORTED');
		this.value('37', 'REQUEST_DECLINED');
		this.value('38', 'INVALID_PARAMETERS');
		this.value('39', 'REJECTED_WITH_SUGGESTED_CHANGES');
		this.value('40', 'INVALID_IE');
		this.value('41', 'GROUP_CIPHER_NOT_VALID');
		this.value('42', 'PAIRWISE_CIPHER_NOT_VALID');
		this.value('43', 'AKMP_NOT_VALID');
		this.value('44', 'UNSUPPORTED_RSN_IE_VERSION');
		this.value('45', 'INVALID_RSN_IE_CAPAB');
		this.value('46', 'CIPHER_REJECTED_PER_POLICY');
		this.value('47', 'TS_NOT_CREATED');
		this.value('48', 'DIRECT_LINK_NOT_ALLOWED');
		this.value('49', 'DEST_STA_NOT_PRESENT');
		this.value('50', 'DEST_STA_NOT_QOS_STA');
		this.value('51', 'ASSOC_DENIED_LISTEN_INT_TOO_LARGE');
		this.value('52', 'INVALID_FT_ACTION_FRAME_COUNT');
		this.value('53', 'INVALID_PMKID');
		this.value('54', 'INVALID_MDIE');
		this.value('55', 'INVALID_FTIE');
		this.value('56', 'REQUESTED_TCLAS_NOT_SUPPORTED');
		this.value('57', 'INSUFFICIENT_TCLAS_PROCESSING_RESOURCES');
		this.value('58', 'TRY_ANOTHER_BSS');
		this.value('59', 'GAS_ADV_PROTO_NOT_SUPPORTED');
		this.value('60', 'NO_OUTSTANDING_GAS_REQ');
		this.value('61', 'GAS_RESP_NOT_RECEIVED');
		this.value('62', 'STA_TIMED_OUT_WAITING_FOR_GAS_RESP');
		this.value('63', 'GAS_RESP_LARGER_THAN_LIMIT');
		this.value('64', 'REQ_REFUSED_HOME');
		this.value('65', 'ADV_SRV_UNREACHABLE');
		this.value('67', 'REQ_REFUSED_SSPN');
		this.value('68', 'REQ_REFUSED_UNAUTH_ACCESS');
		this.value('72', 'INVALID_RSNIE');
		this.value('73', 'U_APSD_COEX_NOT_SUPPORTED');
		this.value('74', 'U_APSD_COEX_MODE_NOT_SUPPORTED');
		this.value('75', 'BAD_INTERVAL_WITH_U_APSD_COEX');
		this.value('76', 'ANTI_CLOGGING_TOKEN_REQ');
		this.value('77', 'FINITE_CYCLIC_GROUP_NOT_SUPPORTED');
		this.value('78', 'CANNOT_FIND_ALT_TBTT');
		this.value('79', 'TRANSMISSION_FAILURE');
		this.value('80', 'REQ_TCLAS_NOT_SUPPORTED');
		this.value('81', 'TCLAS_RESOURCES_EXCHAUSTED');
		this.value('82', 'REJECTED_WITH_SUGGESTED_BSS_TRANSITION');
		this.value('83', 'REJECT_WITH_SCHEDULE');
		this.value('84', 'REJECT_NO_WAKEUP_SPECIFIED');
		this.value('85', 'SUCCESS_POWER_SAVE_MODE');
		this.value('86', 'PENDING_ADMITTING_FST_SESSION');
		this.value('87', 'PERFORMING_FST_NOW');
		this.value('88', 'PENDING_GAP_IN_BA_WINDOW');
		this.value('89', 'REJECT_U_PID_SETTING');
		this.value('92', 'REFUSED_EXTERNAL_REASON');
		this.value('93', 'REFUSED_AP_OUT_OF_MEMORY');
		this.value('94', 'REJECTED_EMERGENCY_SERVICE_NOT_SUPPORTED');
		this.value('95', 'QUERY_RESP_OUTSTANDING');
		this.value('96', 'REJECT_DSE_BAND');
		this.value('97', 'TCLAS_PROCESSING_TERMINATED');
		this.value('98', 'TS_SCHEDULE_CONFLICT');
		this.value('99', 'DENIED_WITH_SUGGESTED_BAND_AND_CHANNEL');
		this.value('100', 'MCCAOP_RESERVATION_CONFLICT');
		this.value('101', 'MAF_LIMIT_EXCEEDED');
		this.value('102', 'MCCA_TRACK_LIMIT_EXCEEDED');
		this.value('103', 'DENIED_DUE_TO_SPECTRUM_MANAGEMENT');
		this.value('104', 'ASSOC_DENIED_NO_VHT');
		this.value('105', 'ENABLEMENT_DENIED');
		this.value('106', 'RESTRICTION_FROM_AUTHORIZED_GDB');
		this.value('107', 'AUTHORIZATION_DEENABLED');
		this.value('112', 'FILS_AUTHENTICATION_FAILURE');
		this.value('113', 'UNKNOWN_AUTHENTICATION_SERVER');
	},
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('dawn')
		]);
	},

	render: function(data) {
		var m, s, o;
		uci.get_first('dawn', 'local') != null || uci.add('dawn', 'local');
		uci.get_first('dawn', 'hostapd') != null || uci.add('dawn', 'hostapd');
		uci.get_first('dawn', 'network') != null || uci.add('dawn', 'network');

		m = new form.Map('dawn',
			_('DAWN'),
			_('DAWN Form Configuration.'));

		s = m.section(form.NamedSection, '@local[0]', 'local',
			_('Local'),
		);

		o = s.option(form.ListValue, 'loglevel',
			_('Log Level'),
			_('Verbosity of messages in syslog'),
		);
		o.value('0', _('Deeper tracing to fix bugs - for debugging'));
		o.value('1', _('More info to help trace where algorithms may be going wrong - for debugging'));
		o.value('2', _('Reporting on standard behaviour'));
		o.value('3', _('Standard behaviour always worth reporting'));
		o.value('4', _('Something appears wrong, but recoverable'));
		o.value('5', _('Serious malfunction / unexpected behaviour'));


		s = m.section(form.NamedSection, '@hostapd[0]', 'hostapd',
			_('Hostapd'),
		);

		o = s.option(form.Value, 'hostapd_dir',
			_('Hostapd dir'),
			_('Path to hostapd runtime information'),
		);
		o.default = '/var/run/hostapd';

		s = m.section(form.NamedSection, '@network[0]', 'network',
			_('Network'),
		);

		// o = s.option(form.Value, 'bandwidth',
		// 	_('Bandwidth'),
		// );

		o = s.option(form.Value, 'broadcast_ip',
			_('Broadcast IP'),
			_('IP address for broadcast and multicast'),
		);

		o = s.option(form.Value, 'broadcast_port',
			_('Broadcast PORT'),
			_('IP port for broadcast and multicast'),
		);
		o.default = '1025';
		o.placeholder = '1025';

		// o = s.option(form.Value, 'collision_domain',
		// 	_('Collision domain'),
		// );

		// o = s.option(form.Value, 'iv',
		// 	_('Initialisation Vector (IV)'),
		// );

		o = s.option(form.ListValue, 'network_option',
			_('Network option'),
			_('Method of networking between DAWN instances'),
		);
		o.value('0', _('Broadcast'));
		o.value('1', _('Multicast'));
		o.value('2', _('TCP with UMDNS discovery'));
		o.value('3', _('TCP w/out UMDNS discovery'));
		o.default = '2';

		o = s.option(form.Value, 'server_ip',
			_('Server IP'),
			_('IP address when not using UMDNS'),
		);

		// o = s.option(form.Value, 'shared_key',
		// 	_('Shared key'),
		// );

		o = s.option(form.Value, 'tcp_port',
			_('TCP port'),
			_('Port for TCP networking'),
		);
		o.default = '1026';
		o.placeholder = '1026';

		// o = s.option(form.Flag, 'use_symm_enc',
		// 	_('Use symm enc'),
		// 	_('Enable encryption of network traffic'),
		// );
		// o.default = '0';

		s = m.section(form.NamedSection, '@times[0]', 'times',
			_('Times'),
			_('All timer values are in seconds. They are the main mechanism for DAWN collecting and managing much of the data that it relies on.'),
		);

		o = s.option(form.Value, 'con_timeout',
			_('Connection Timeout'),
			_('Timespan until a connection is seen as disconnected'),
		);
		o.placeholder = _('Default Value') + ': ' + '60';

		o = s.option(form.Value, 'remove_ap',
			_('Remove AP'),
			_('Timer to remove expired AP entries from core data set'),
		);
		o.placeholder = _('Default Value') + ': ' + '460';

		o = s.option(form.Value, 'remove_client',
			_('Remove Client'),
			_('Timer to remove expired client entries from core data set'),
		);
		o.placeholder = _('Default Value') + ': ' + '15';

		o = s.option(form.Value, 'remove_probe',
			_('Remove Probe'),
			_('Timer to remove expired PROBE and BEACON entries from core data set'),
		);
		o.placeholder = _('Default Value') + ': ' + '30';

		o = s.option(form.Value, 'update_beacon_reports',
			_('Update Beacon reports'),
			_('Timer to ask all connected clients for a new BEACON REPORT'),
		);
		o.placeholder = _('Default Value') + ': ' + '20';

		o = s.option(form.Value, 'update_chan_util',
			_('Update Channel utilization'),
			_('Timer to get recent channel utilization figure for each local BSSID'),
		);
		o.placeholder = _('Default Value') + ': ' + '5';

		o = s.option(form.Value, 'update_client',
			_('Update Client'),
			_('Timer to refresh local connection information and send revised NEIGHBOR REPORT to all clients'),
		);
		o.placeholder = _('Default Value') + ': ' + '10';

		o = s.option(form.Value, 'update_hostapd',
			_('Update Hostapd'),
			_('Timer to (re-)register for hostapd messages for each local BSSID'),
		);
		o.placeholder = _('Default Value') + ': ' + '10';

		o = s.option(form.Value, 'update_tcp_con',
			_('Update TCP connections'),
			_('Timer to refresh / remove the TCP connections to other DAWN instances found via uMDNS'),
		);
		o.placeholder = _('Default Value') + ': ' + '10';

		s = m.section(form.NamedSection, 'global', 'metric',
			_('Global Metric'),
		);

		o = s.option(form.Value, 'bandwidth_threshold',
			_('Bandwidth Threshold (Mbits/s)'),
			_('Maximum reported AP-client bandwidth permitted when kicking. Set to zero to disable the check.'),
		);
		o.placeholder = _('Default Value') + ': ' + '6';

		o = s.option(form.Value, 'chan_util_avg_period',
			_('Average channel utilization'),
			_('Number of sampling periods to average channel utilization values over'),
		);
		o.placeholder = _('Default Value') + ': ' + '3';

		o = s.option(CBI80211StatusCode, 'deny_assoc_reason',
			_('Deny Association reason'),
			_('802.11 code used when ASSOCIATION is denied'),
		);
		o.placeholder = _('Default Value') + ': ' + 'AP_UNABLE_TO_HANDLE_NEW_STA';

		o = s.option(CBI80211StatusCode, 'deny_auth_reason',
			_('Deny auth reason'),
			_('802.11 code used when AUTHENTICATION is denied'),
		);
		o.placeholder = _('Default Value') + ': ' + 'UNSPECIFIED_FAILURE';

		o = s.option(form.Value, 'disassoc_nr_length',
			_('Disassociate Neighbor Report length'),
			_('Number of entries to include in a 802.11v DISASSOCIATE Neighbor Report'),
		);
		o.placeholder = _('Default Value') + ': ' + '6';

		o = s.option(form.Value, 'duration',
			_('DURATION'),
			_('802.11k BEACON request DURATION parameter'),
		);
		o.placeholder = _('Default Value') + ': ' + '0';

		o = s.option(form.Flag, 'eval_assoc_req',
			_('Evaluated Association Req'),
			_('Control whether ASSOCIATION frames are evaluated for rejection'),
		);

		o = s.option(form.Flag, 'eval_auth_req',
			_('Evaluated Auth Req'),
			_('Control whether AUTHENTICATION frames are evaluated for rejection'),
		);

		o = s.option(form.Flag, 'eval_probe_req',
			_('Evaluated Probe Req'),
			_('Control whether PROBE frames are evaluated for rejection'),
		);

		o = s.option(form.ListValue, 'kicking',
			_('Kicking'),
			_('Method to select clients to move to better AP'),
		);
		o.value('0', 'Disabled');
		o.value('1', 'RSSI Comparison');
		o.value('2', 'Absolute RSSI');
		o.value('3', 'Both');
		o.placeholder = _('Default Value') + ': ' + 'Both';

		o = s.option(form.Value, 'kicking_threshold',
			_('Kicking Threshold'),
			_('Minimum score difference to consider kicking to alternate AP'),
		);
		o.placeholder = _('Default Value') + ': ' + '20';

		o = s.option(form.Value, 'max_station_diff',
			_('Max Station Diff'),
			_('Number of connected stations to consider "better" for use_station_count'),
		);
		o.placeholder = _('Default Value') + ': ' + '1';

		o = s.option(form.Value, 'min_number_to_kick',
			_('Min Number To Kick'),
			_('Number of consecutive times a client should be evaluated as ready to kick before actually doing it'),
		);
		o.placeholder = _('Default Value') + ': ' + '3';

		o = s.option(form.Value, 'min_probe_count',
			_('Min Probe Count'),
			_('Number of times a client should retry PROBE before acceptance'),
		);
		o.placeholder = _('Default Value') + ': ' + '3';

		o = s.option(form.Value, 'neighbors',
			_('Neighbors'),
			_('Space separated list of MACS to use in "static" AP Neighbor Report'),
		);

		o = s.option(form.Value, 'rrm_mode',
			_('RRM Mode'),
			_('Preferred order for using Passive, Active or Table 802.11k BEACON information'),
		);
		o.placeholder = _('Default Value') + ': ' + 'PAT';

		o = s.option(form.ListValue, 'set_hostapd_nr',
			_('Set Hostapd Neighbor Report'),
			_('Method used to set Neighbor Report on AP'),
		);
		o.value('0', 'Disabled');
		o.value('1', 'Static');
		o.value('2', 'Dynamic');
		o.placeholder = _('Default Value') + ': ' + 'Disabled';

		o = s.option(form.Flag, 'use_station_count',
			_('Use Station Count'),
			_('Compare connected station counts when considering kicking'),
		);

		const bands = {
			'802_11g': _('2.4G Band Metric'),
			'802_11a': _('5G Band Metric'),
		};

		for (const k in bands) {
			s = m.section(form.NamedSection, k, 'metric',
				bands[k],
			);

			o = s.option(form.Value, 'ap_weight',
				_('Ap Weight'),
				_('Per AP weighting'),
			);
			o.placeholder = _('Default Value') + ': ' + '0';

			o = s.option(form.Value, 'chan_util',
				_('Channel Utilization'),
				_('Score increment if channel utilization is below chan_util_val'),
			);
			o.placeholder = _('Default Value') + ': ' + '0';

			o = s.option(form.Value, 'chan_util_val',
				_('Channel Utilization Value'),
				_('Upper threshold for good channel utilization'),
			);
			o.placeholder = _('Default Value') + '140';

			o = s.option(form.Value, 'ht_support',
				_('HT Support'),
				_('Score increment if HT is supported'),
			);
			o.placeholder = _('Default Value') + ': ' + '5';

			o = s.option(form.Value, 'initial_score',
				_('Initial Score'),
				_('Base score for AP based on operating band'),
			);
			o.placeholder = _('Default Value') + ': ' + k == '802_11g' ? '80' : '100';

			o = s.option(form.Value, 'low_rssi',
				_('Low RSSI'),
				_('Score addition when signal is below threshold'),
			);
			o.placeholder = _('Default Value') + ': ' + '-15';

			o = s.option(form.Value, 'low_rssi_val',
				_('Low RSSI Value'),
				_('Threshold for bad RSSI'),
			);
			o.placeholder = _('Default Value') + ': ' + '-80';

			o = s.option(form.Value, 'max_chan_util',
				_('Max Channel Utilization'),
				_('Score increment if channel utilization is above max_chan_util_val'),
			);
			o.placeholder = _('Default Value') + ': ' + '-15';

			o = s.option(form.Value, 'max_chan_util_val',
				_('Max Channel Utilization Value'),
				_('Lower threshold for bad channel utilization')
			);
			o.placeholder = _('Default Value') + ':' + '170';
			o = s.option(form.Value, 'no_ht_support',
				_('No HT Support'),
				_('Score increment if HT is not supported'),
			);
			o.placeholder = _('Default Value') + ': ' + '0';

			o = s.option(form.Value, 'no_vht_support',
				_('No VHT Support'),
				_('Score increment if VHT is not supported'),
			);
			o.placeholder = _('Default Value') + ': ' + '0';

			o = s.option(form.Value, 'rssi_center',
				_('RSSI Center'),
				_('Midpoint for weighted RSSI evaluation'),
			);
			o.placeholder = _('Default Value') + ': ' + '-70';

			o = s.option(form.Value, 'rssi',
				_('RSSI'),
				_('Score addition when signal exceeds threshold'),
			);
			o.placeholder = _('Default Value') + ': ' + '-15';

			o = s.option(form.Value, 'rssi_val',
				_('RSSI Value'),
				_('Threshold for a good RSSI'),
			);
			o.placeholder = _('Default Value') + ': ' + '-60';

			o = s.option(form.Value, 'rssi_weight',
				_('RSSI Weight'),
				_('Per dB increment for weighted RSSI evaluation'),
			);
			o.placeholder = _('Default Value') + ': ' + '0';

			o = s.option(form.Value, 'vht_support',
				_('VHT Support'),
				_('Score increment if VHT is supported'),
			);
			o.placeholder = _('Default Value') + ': ' + '5';
		};

		return m.render();
	}
});
