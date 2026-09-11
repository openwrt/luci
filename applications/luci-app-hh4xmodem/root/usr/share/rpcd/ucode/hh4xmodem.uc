#!/usr/bin/ucode
'use strict';
import { popen } from 'fs';
import * as uci from 'uci';

function shellquote(value) {
	if (value == null) value = '';
	return "'" + replace(value, "'", "'\\''") + "'";
}

const PACK_HELPER = '/usr/bin/hh4xmodem-pack';

function get_modem_env() {
	let ctx = uci.cursor();
	let ip = ctx.get('hh4xmodem', 'settings', 'modem_ip') || '192.168.225.1';
	let port = ctx.get('hh4xmodem', 'settings', 'modem_port') || '2016';
	ctx.unload();
	return sprintf('MODEM_IP=%s MODEM_PORT=%s', shellquote(ip), shellquote(port));
}

function pack_call(method, params) {
	params = params || '{}';
	let env = get_modem_env();
	let cmd = sprintf('%s %s %s %s 2>/dev/null', env, PACK_HELPER, shellquote(method), shellquote(params));
	let fd = popen(cmd);
	if (!fd) return { error: 'Failed to execute pack helper', code: -1 };
	let output = '';
	let line;
	while ((line = fd.read('line')) != null) output += line;
	fd.close();
	output = trim(output);
	if (!length(output)) return { error: 'Empty response from modem', code: -1 };
	let start = index(output, '{');
	if (start < 0) return { error: 'No JSON object in response', raw: output, code: -1 };
	let depth = 0;
	let end = -1;
	for (let i = start; i < length(output); i++) {
		let c = substr(output, i, 1);
		if (c == '{') depth++;
		if (c == '}') {
			depth--;
			if (depth == 0) { end = i; break; }
		}
	}
	if (end < 0) return { error: 'Unclosed JSON object', raw: output, code: -1 };
	let clean = substr(output, start, end - start + 1);
	let result = json(clean);
	if (result == null) return { error: 'Failed to parse JSON', raw: clean, code: -1 };
	return result;
}

function get_system_info() { return pack_call('GetSystemInfo'); }
function get_status() { return pack_call('GetSystemStatus'); }
function get_signal() { return pack_call('GetNetworkInfo'); }
function get_network_settings() { return pack_call('GetNetworkSettings'); }
function get_usage() { return pack_call('GetUsageRecord'); }
function get_connection_state() { return pack_call('GetConnectionState'); }
function get_sim_status() { return pack_call('GetSimStatus'); }
function get_lan_settings() { return pack_call('GetLanSettings'); }
function get_sms_storage() { return pack_call('GetSMSStorageState'); }
function get_sms_settings() { return pack_call('GetSMSSettings'); }
function get_upnp() { return pack_call('GetUpnpSettings'); }
function get_language() { return pack_call('GetCurrentLanguage'); }
function get_connection_settings() { return pack_call('GetConnectionSettings'); }
function get_registration_state() { return pack_call('GetNetworkRegisterState'); }
function get_profile_list() { return pack_call('GetProfileList'); }
function get_current_profile() { return pack_call('getCurrentProfile'); }
function get_pin_state() { return pack_call('GetAutoValidatePinState'); }
function get_usage_settings() { return pack_call('GetUsageSettings'); }
function reboot_modem() {
	let r = pack_call('SetDeviceReboot');
	if (r != null && type(r) == 'object' && r.error == null) return { error: null, response: r };
	if (type(r) == 'object' && length(r) == 0) return { error: null };
	return r || { error: 'Reboot failed', code: -1 };
}

function send_connect() {
	let r = pack_call('Connect');
	if (r != null && type(r) == 'object' && r.error == null) return { error: null, response: r };
	if (type(r) == 'object' && length(r) == 0) return { error: null };
	return r || { error: 'Connect failed', code: -1 };
}

function disconnect_modem() {
	let r = pack_call('DisConnect');
	if (r != null && type(r) == 'object' && r.error == null) return { error: null, response: r };
	if (type(r) == 'object' && length(r) == 0) return { error: null };
	return r || { error: 'Disconnect failed', code: -1 };
}

// The modem reports success as {} or {error:0}; only a real (truthy,
// non-zero) error is an actual failure.
function pack_ok(r) {
	return r != null && (r.error == null || r.error == 0 || r.error == '0' || length(r) == 0);
}

function unlock_pin(pin) {
	if (pin == null) return { error: 'Missing PIN', code: -1 };
	pin = trim(pin);
	if (!length(pin)) return { error: 'Empty PIN', code: -1 };
	let r = pack_call('UnlockPin', sprintf('{"PIN":%J}', pin));
	if (pack_ok(r)) return { error: null };
	return r || { error: 'Unlock failed', code: -1 };
}

function unlock_puk(puk, new_pin) {
	if (puk == null || new_pin == null) return { error: 'Missing PUK or new PIN', code: -1 };
	puk = trim(puk);
	new_pin = trim(new_pin);
	if (!length(puk) || !length(new_pin)) return { error: 'Empty PUK or PIN', code: -1 };
	// Per the stock WebUI (build.js): UnlockPuk takes {"Pin":<new PIN>,"Puk":<PUK>}
	// (CamelCase: Pin/Puk — NOT "PUK"/"NewPin"). A wrong PIN new value or a
	// rejected PUK makes the modem return {} or an error; an empty/ignored
	// response must NOT be reported as success.
	let r = pack_call('UnlockPuk', sprintf('{"Pin":%J,"Puk":%J}', new_pin, puk));
	if (!pack_ok(r)) return r || { error: 'Unlock failed', code: -1 };
	// Verify the lock actually cleared: the modem may echo {} on a bad PUK
	// (pack_ok would accept it). Re-query the SIM state to confirm.
	let s = get_sim_status();
	let st = (s && s.SIMState != null) ? s.SIMState : null;
	// Success only if the SIM actually left the locked states. A wrong/exhausted
	// PUK leaves it at 3 (PUK required), 4 (SIM lock) or 5 (PUK blocked); all must
	// fail, since pack_ok() accepts the empty {} the modem echoes on a bad PUK.
	// State 2 (PIN required) is expected right after a successful PUK unlock
	// (the new PIN is prompted on next boot), and 7 means Ready.
	if (st == 7 || st == 2) return { error: null };
	return { error: 'PUK rejected, still locked, or blocked', code: -1 };
}

function change_pin(old_pin, new_pin) {
	if (old_pin == null || new_pin == null) return { error: 'Missing old or new PIN', code: -1 };
	old_pin = trim(old_pin);
	new_pin = trim(new_pin);
	if (!length(old_pin) || !length(new_pin)) return { error: 'Empty old or new PIN', code: -1 };
	let r = pack_call('ChangePinCode', sprintf('{"CurrentPin":%J,"NewPin":%J}', old_pin, new_pin));
	if (pack_ok(r)) return { error: null };
	return r || { error: 'Change PIN failed', code: -1 };
}

function change_pin_state(pin, enable) {
	if (pin == null) return { error: 'Missing PIN', code: -1 };
	pin = trim(pin);
	if (!length(pin)) return { error: 'Empty PIN', code: -1 };
	// Per the stock WebUI: enabling PIN protection sends State:1 and
	// disabling it sends State:0. The Pin must be the SIM's current PIN;
	// a wrong PIN decrements PinRemainingTimes.
	let state = enable ? 1 : 0;
	let r = pack_call('ChangePinState', sprintf('{"Pin":%J,"State":%d}', pin, state));
	if (pack_ok(r)) return { error: null };
	return r || { error: enable ? 'Set PIN failed' : 'Disable PIN failed', code: -1 };
}

function clear_usage() {
	let r = pack_call('SetUsageRecordClear');
	if (r != null && r.error == null) return { error: null };
	return r || { error: 'Clear failed', code: -1 };
}

function clear_call_log() {
	let ids = '';
	let page = 1, total_pages = 1;
	while (page <= total_pages) {
		let r = pack_call('GetCallLogList', sprintf('{"Page":%d,"ListType":0}', page));
		if (r == null || r.error != null) break;
		let list = r.CallLogList || [];
		for (let c in list) {
			if (c.Id != null) {
				if (length(ids) > 0) ids += ',';
				ids += int(c.Id);
			}
		}
		total_pages = int(r.TotalPageCount || 1);
		page++;
	}

	if (length(ids) == 0) return { error: null };

	let r = pack_call('DeleteCallLog', sprintf('{"Id":[%s],"ListType":0}', ids));
	if (r != null && r.error == null) return { error: null };
	return r || { error: 'Clear failed', code: -1 };
}


function send_ussd(code) {
	if (code == null) return { error: 'Missing USSD code', code: -1 };
	code = trim(code);
	if (!length(code)) return { error: 'Empty USSD code', code: -1 };
	// end any lingering session so we start a fresh request
	pack_call('SetUSSDEnd', '{}');
	sleep(2000);
	let r = pack_call('SendUSSD', sprintf('{"UssdType":0,"UssdContent":%J}', code));
	if (r == null || r.error != null) return r || { error: 'Send failed', code: -1 };
	let res;
	let end_session = function() { pack_call('SetUSSDEnd', '{}'); };
	// The modem caches the last USSD reply in g_ussd_data and only updates it
	// when a *new* indication arrives. Right after SendUSSD, the first polls
	// still return that stale cache with UssdType:0. A genuine result arrives
	// only with UssdType 1 (DONE) or 2 (MORE), so we must skip UssdType:0.
	let is_real = function(r) {
		return r && r.error == null && (r.UssdType == 1 || r.UssdType == 2) && r.UssdContent;
	};
	for (let i = 0; i < 20; i++) {
		if (i > 0) sleep(1000);
		res = pack_call('GetUSSDSendResult');
		if (is_real(res)) {
			end_session();
			return { error: null, text: res.UssdContent, more: res.UssdType == 2 };
		}
	}
	if (is_real(res)) { end_session(); return { error: null, text: res.UssdContent, more: res.UssdType == 2 }; }
	return { error: 'No USSD response from network', code: -1 };
}

function ussd_end_session() {
	pack_call('SetUSSDEnd', '{}');
	return { error: null };
}

function set_usage_settings(settings) {
	if (settings == null) return { error: 'Missing settings', code: -1 };
	let r = pack_call('SetUsageSettings', json(settings));
	if (r != null && r.error == null) return { error: null };
	return r || { error: 'Set failed', code: -1 };
}

function unlock_sim(code, lock_state) {
	if (code == null) return { error: 'Missing unlock code', code: -1 };
	code = trim(code);
	if (!length(code)) return { error: 'Empty unlock code', code: -1 };
	let r = pack_call('UnlockSimlock', sprintf('{"SIMLockCode":%J,"SIMLockState":%d}', code, int(lock_state || 0)));
	if (pack_ok(r)) return { error: null };
	// A structured error (has "message", e.g. a wrong NCK code) is a real
	// failure — normalize it to { error: ... } so the JS caller's
	// r.error == null test actually catches it.
	if (type(r) == 'object' && r.message != null)
		return { error: sprintf('SIM unlock failed: %s', r.message), code: r.code ?? -1 };
	// pack_call-level error (connection dropped after sending the unlock).
	// The modem reboots after accepting a valid unlock code, so a dropped
	// connection here is expected on success — but we must not mask genuine
	// connectivity failures (e.g. modem was never reachable). Return the
	// actual error so the caller can show it; the UI reloads and re-checks
	// SIM state to confirm whether the unlock took effect.
	return r;
}

function set_network_mode(mode) {
	if (mode == null) return { error: 'Missing mode', code: -1 };
	mode = int(mode);
	if (mode < 0 || mode > 6) return { error: 'Invalid mode', code: -1 };
	let cur = pack_call('GetNetworkSettings') || {};
	let params = sprintf('{"NetworkMode":%d,"NetselectionMode":%d,"NetworkBand":%d,"DomesticRoam":%d,"DomesticRoamGuard":%d}',
		mode, cur.NetselectionMode ?? 0, cur.NetworkBand ?? 255, cur.DomesticRoam ?? 0, cur.DomesticRoamGuard ?? 0);
	let r = pack_call('SetNetworkSettings', params);
	if (r != null && type(r) == 'object' && r.error == null) return { error: null, mode: mode, response: r };
	if (type(r) == 'object' && length(r) == 0) return { error: null, mode: mode };
	return r || { error: 'Set failed', code: -1 };
}

function get_sms_data(key, page) {
	key = key || 'inbox';
	page = page || 1;
	let sms = pack_call('GetSMSListByContactNum', sprintf('{"Page":%d,"key":%J}', page, key)) || { SMSList: [] };
	let storage = pack_call('GetSMSStorageState') || {};
	return { GetSMSListByContactNum: sms, GetSMSStorageState: storage };
}

function get_sms_list(key, page) {
	key = key || 'inbox';
	page = page || 1;
	return pack_call('GetSMSListByContactNum', sprintf('{"Page":%d,"key":%J}', page, key)) || { error: 'No result', SMSList: [] };
}

function get_single_sms(id) {
	id = int(id || 0);
	if (id < 1) return { error: 'Invalid SMS ID', code: -1 };
	return pack_call('GetSingleSMS', sprintf('{"SMSId":%d}', id)) || { error: 'No result' };
}

function send_sms(phone, content) {
	if (phone == null || content == null) return { error: 'Missing phone or content', code: -1 };
	phone = trim(phone);
	content = trim(content);
	if (!length(phone) || !length(content)) return { error: 'Empty phone or content', code: -1 };
	let r = pack_call('SendSMS', sprintf('{"PhoneNumber":%J,"SMSContent":%J,"SMSId":-1}',
		phone, content));
	if (r == null) return { error: 'Send SMS failed: no response', code: -1 };
	if (type(r) == 'object' && r.message != null && r.code != null)
		return { error: sprintf('Send SMS failed: %s (%s)', r.message, r.code), code: -1 };
	return { error: null, response: r };
}

function delete_sms(id) {
	id = int(id || 0);
	if (id < 1) return { error: 'Invalid SMS ID', code: -1 };
	let r = pack_call('DeleteSMS', sprintf('{"DelFlag":3,"SMSArray":[%d]}', id));
	if (r != null && r.error == null) return { error: null };
	return r || { error: "Delete failed", code: -1 };
}

function delete_sms_bulk(ids) {
	if (type(ids) != 'array' || length(ids) == 0) return { error: 'No SMS IDs provided', code: -1 };
	let arr = '';
	for (let i = 0; i < length(ids); i++) {
		let n = int(ids[i]);
		if (n < 1) return { error: 'Invalid SMS ID', code: -1 };
		if (length(arr) > 0) arr += ',';
		arr += n;
	}
	let params = sprintf('{"DelFlag":3,"SMSArray":[%s]}', arr);
	let r = pack_call('DeleteSMS', params);
	if (r != null && r.error == null) return { error: null, count: length(ids) };
	return r || { error: "Delete failed", code: -1 };
}

function get_send_sms_result() { return pack_call('GetSendSMSResult') || { error: 'No result' }; }

function get_calllog_data(list_type, page) {
	list_type = int(list_type || 0);
	page = page || 1;
	let logs = pack_call('GetCallLogList', sprintf('{"Page":%d,"ListType":%d}', page, list_type)) || { CallLogList: [] };
	let counts = pack_call('GetCallLogCountInfo') || {};
	return { GetCallLogList: logs, GetCallLogCountInfo: counts };
}

function get_call_log_list(list_type, page) {
	list_type = int(list_type || 0);
	page = page || 1;
	return pack_call('GetCallLogList', sprintf('{"Page":%d,"ListType":%d}', page, list_type)) || { error: 'No result', CallLogList: [] };
}

function get_call_log_count() { return pack_call('GetCallLogCountInfo') || { error: 'No result' }; }

function run_script(script) {
	let env = get_modem_env();
	let cmd = sprintf('%s %s 2>/dev/null', env, script);
	let fd = popen(cmd);
	if (!fd) return { error: 'Failed to execute helper', code: -1 };
	let output = '';
	let line;
	while ((line = fd.read('line')) != null) output += line;
	fd.close();
	output = trim(output);
	if (!length(output)) return { error: 'Empty response', code: -1 };
	let data = json(output);
	if (data == null) return { error: 'Failed to parse JSON', code: -1 };
	let result = {};
	for (let k, v in data) {
		if (type(v) == 'object' && v.result != null)
			result[k] = v.result;
		else
			result[k] = v;
	}
	return result;
}

function get_all() { return run_script('/usr/bin/hh4xmodem-get-all'); }
function get_all_full() { return run_script('/usr/bin/hh4xmodem-get-all full'); }

function get_dashboard() {
	return {
		device: get_system_info(),
		status: get_status(),
		signal: get_signal(),
		connection: get_connection_state(),
		network: get_network_settings(),
		sim: get_sim_status(),
		usage: get_usage(),
		timestamp: time()
	};
}

function reset_modem() {
	let r = pack_call('SetDeviceReset');
	if (r != null && type(r) == 'object' && r.error == null) return { error: null, response: r };
	if (type(r) == 'object' && length(r) == 0) return { error: null };
	return r || { error: 'Reset failed', code: -1 };
}

function set_connection_settings(settings) {
	if (settings == null) return { error: 'Missing settings', code: -1 };
	if (type(settings) != 'object') return { error: 'Settings must be an object', code: -1 };
	// Read current settings so we echo back ALL fields the modem expects.
	// Bail out on failure: pack_call always returns an object, so a failed read
	// would otherwise be overwritten with hardcoded defaults.
	let cur = pack_call('GetConnectionSettings');
	if (type(cur) != 'object' || cur.error != null)
		return { error: 'Failed to read current connection settings', code: -1 };
	for (let k, v in settings) cur[k] = v;
	// Fallbacks match the UI preselects (0 = Manual / IPv4, 600 s idle).
	let connectMode = int(cur.ConnectMode ?? 0);
	let pdpType = int(cur.PdpType ?? 0);
	let roamingConnect = int(cur.RoamingConnect ?? 1);
	let idleTime = int(cur.IdleTime ?? 600);
	let params = sprintf('{"ConnectMode":%d,"PdpType":%d,"RoamingConnect":%d,"IdleTime":%d}',
		connectMode, pdpType, roamingConnect, idleTime);
	let r = pack_call('SetConnectionSettings', params);
	if (r != null && type(r) == 'object' && r.error == null) return { error: null, response: r };
	if (type(r) == 'object' && length(r) == 0) return { error: null };
	return r || { error: 'Set failed', code: -1 };
}

function edit_profile(profile) {
	if (profile == null) return { error: 'Missing profile', code: -1 };
	if (type(profile) != 'object') return { error: 'Profile must be an object', code: -1 };
	let method = profile.ProfileID ? 'EditProfile' : 'AddNewProfile';
	let profileId = profile.ProfileID ? sprintf(',"ProfileID":%d', int(profile.ProfileID)) : '';
	let params = sprintf('{"ProfileName":%J,"APN":%J,"UserName":%J,"Password":%J,"AuthType":%d,"DailNumber":%J%s}',
		profile.ProfileName, profile.APN, profile.UserName, profile.Password,
		int(profile.AuthType ?? 0), profile.DailNumber, profileId);
	let r = pack_call(method, params);
	if (r != null && type(r) == 'object' && r.error == null) return { error: null };
	if (type(r) == 'object' && length(r) == 0) return { error: null };
	return r || { error: 'Set failed', code: -1 };
}

function delete_profile(profile_id) {
	profile_id = int(profile_id || 0);
	if (profile_id < 1) return { error: 'Invalid ProfileID', code: -1 };
	let r = pack_call('DeleteProfile', sprintf('{"ProfileID":%d}', profile_id));
	if (pack_ok(r)) return { error: null };
	return r || { error: 'Delete failed', code: -1 };
}

function set_default_profile(profile_id) {
	profile_id = int(profile_id || 0);
	if (profile_id < 1) return { error: 'Invalid ProfileID', code: -1 };
	let r = pack_call('SetDefaultProfile', sprintf('{"ProfileID":%d}', profile_id));
	if (pack_ok(r)) return { error: null };
	return r || { error: 'Set failed', code: -1 };
}

const methods = {
	get_system_info:        { call: function() { return get_system_info(); } },
	get_status:             { call: function() { return get_status(); } },
	get_signal:             { call: function() { return get_signal(); } },
	get_network_settings:   { call: function() { return get_network_settings(); } },
	set_network_mode:       { args: { mode: 0 }, call: function(request) { return set_network_mode(request.args.mode); } },
	get_usage:              { call: get_usage },
	get_usage_settings:     { call: get_usage_settings },
	get_connection_state:   { call: get_connection_state },
	get_sim_status:         { call: get_sim_status },
	get_sms_storage:        { call: get_sms_storage },
	get_sms_settings:       { call: get_sms_settings },
	get_lan_settings:       { call: get_lan_settings },
	get_upnp:               { call: get_upnp },
	get_language:           { call: get_language },
	get_connection_settings:{ call: get_connection_settings },
	get_registration_state: { call: get_registration_state },
	get_profile_list:       { call: get_profile_list },
	get_current_profile:    { call: get_current_profile },
	get_pin_state:          { call: get_pin_state },
	reboot_modem:           { call: reboot_modem },
	send_connect:           { call: send_connect },
	disconnect_modem:       { call: disconnect_modem },
	unlock_pin:             { args: { pin: '' }, call: function(request) { return unlock_pin(request.args.pin); } },
	unlock_puk:             { args: { puk: '', new_pin: '' }, call: function(request) { return unlock_puk(request.args.puk, request.args.new_pin); } },
	change_pin:             { args: { old_pin: '', new_pin: '' }, call: function(request) { return change_pin(request.args.old_pin, request.args.new_pin); } },
	change_pin_state:       { args: { pin: '', enable: true }, call: function(request) { return change_pin_state(request.args.pin, request.args.enable); } },
	clear_usage:            { call: clear_usage },
	clear_call_log:         { call: clear_call_log },
	send_ussd:              { args: { code: '' }, call: function(request) { return send_ussd(request.args.code); } },
	ussd_end_session:       { call: ussd_end_session },
	set_usage_settings:     { args: { settings: {} }, call: function(request) { return set_usage_settings(request.args.settings); } },
	unlock_sim:             { args: { code: '', lock_state: 0 }, call: function(request) { return unlock_sim(request.args.code, request.args.lock_state); } },
	get_sms_data:           { args: { key: 'inbox', page: 1 }, call: function(request) { return get_sms_data(request.args.key, request.args.page); } },
	get_sms_list:           { args: { key: 'inbox', page: 1 }, call: function(request) { return get_sms_list(request.args.key, request.args.page); } },
	get_single_sms:         { args: { id: 0 }, call: function(request) { return get_single_sms(request.args.id); } },
	send_sms:               { args: { phone: '', content: '' }, call: function(request) { return send_sms(request.args.phone, request.args.content); } },
	delete_sms:             { args: { id: 0 }, call: function(request) { return delete_sms(request.args.id); } },
	delete_sms_bulk:        { args: { ids: [] }, call: function(request) { return delete_sms_bulk(request.args.ids); } },
	get_send_sms_result:    { call: get_send_sms_result },
	get_calllog_data:       { args: { list_type: 0, page: 1 }, call: function(request) { return get_calllog_data(request.args.list_type, request.args.page); } },
	get_call_log_list:      { args: { list_type: 0, page: 1 }, call: function(request) { return get_call_log_list(request.args.list_type, request.args.page); } },
	get_call_log_count:     { call: get_call_log_count },
	get_dashboard:          { call: get_dashboard },
	get_all:                { call: get_all },
	get_all_full:           { call: get_all_full },
	set_connection_settings: { args: { settings: {} }, call: function(request) { return set_connection_settings(request.args.settings); } },
	edit_profile:            { args: { profile: {} }, call: function(request) { return edit_profile(request.args.profile); } },
	delete_profile:          { args: { profile_id: 0 }, call: function(request) { return delete_profile(request.args.profile_id); } },
	set_default_profile:     { args: { profile_id: 0 }, call: function(request) { return set_default_profile(request.args.profile_id); } },
	reset_modem:            { call: reset_modem },
};

return { 'hh4xmodem': methods };
