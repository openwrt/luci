// SPDX-License-Identifier: Apache-2.0

'use strict';

function default_config() {
	return {
		global: {
			apdu_backend: 'uqmi',
			http_backend: 'curl',
			apdu_debug: '0',
			http_debug: '0',
			custom_isd_r_aid: 'A0000005591010FFFFFFFF8900000100'
		},
		at: {
			device: '/dev/ttyUSB2',
			debug: '0'
		},
		uqmi: {
			device: '/dev/cdc-wdm0',
			debug: '0'
		},
		mbim: {
			device: '/dev/cdc-wdm0',
			proxy: '1'
		}
	};
}

function reset() {
	global.TEST_UCI = default_config();
	global.TEST_UCI_LOAD_FAIL = false;
	global.TEST_COMMIT_OK = true;
	global.TEST_LOCK_EXISTS = false;
	global.TEST_LOCK_TYPE = 'file';
	global.TEST_LOCK_UID = 0;
	global.TEST_LOCK_NLINK = 1;
	global.TEST_LOCK_MODE = 0o600;
	global.TEST_LOCK_OPEN_FAIL = false;
	global.TEST_LOCK_CHMOD_FAIL = false;
	global.TEST_LOCK_BUSY = false;
	global.TEST_LOCK_CLOSED = false;
	global.TEST_DEFER_THROW = false;
	global.TEST_DEFER_NULL = false;
	global.TEST_EXEC_STATUS = 0;
	global.TEST_EXEC_REPLY = null;
	global.TEST_LAST_CALL = null;
}

let checks = 0;

function check(condition, message) {
	checks++;

	if (!condition)
		die(`not ok ${checks} - ${message}\n`);

	printf(`ok ${checks} - ${message}\n`);
}

function same(actual, expected, message) {
	check(sprintf('%J', actual) == sprintf('%J', expected), message);
}

reset();

const plugin = loadfile('./root/usr/share/rpcd/ucode/luci.lpac', {
	module_search_path: [ '../../../../../tests/lib/*.uc' ]
})();
const methods = plugin['luci.lpac'];

function invoke(name, args) {
	let replied = false;
	let response = null;
	const request = {
		args: args || {},
		reply: function(result) {
			replied = true;
			response = result;
		}
	};
	const returned = methods[name].call(request);

	return replied ? response : returned;
}

function terminal(data, code) {
	if (type(code) != 'int')
		code = 0;

	return sprintf('%J\n', {
		type: 'lpa',
		payload: {
			code,
			message: code == 0 ? 'success' : 'failure',
			data
		}
	});
}

global.TEST_EXEC_REPLY = { code: 0, stdout: terminal('v2.3.0') };
let result = invoke('get_version');
check(result.success && result.data == 'v2.3.0', 'version response is normalized');
check(global.TEST_LAST_CALL.request.command == '/usr/bin/lpac',
	'packaged lpac entrypoint is executed directly for non-eUICC commands');
same(global.TEST_LAST_CALL.request.params, [ 'version' ], 'version argv is fixed');

reset();
global.TEST_EXEC_REPLY = {
	code: 0,
	stdout: sprintf('%J\n', {
		type: 'driver',
		payload: {
			LPAC_APDU: [ 'uqmi', 'stdio', 'mbim', 'uqmi' ],
			LPAC_HTTP: [ 'curl', 'stdio' ]
		}
	})
};
result = invoke('get_drivers');
same(result.data, { apdu: [ 'uqmi', 'mbim' ], http: [ 'curl' ] },
	'driver response is allowlisted and deduplicated');

reset();
global.TEST_EXEC_REPLY = {
	code: 0,
	stdout: sprintf('%J\n', { type: 'driver', payload: { LPAC_APDU: [] } })
};
result = invoke('get_drivers');
check(!result.success && result.error == 'invalid_response',
	'incomplete driver schemas are rejected');

reset();
global.TEST_EXEC_REPLY = {
	code: 0,
	stdout: terminal({
		eidValue: '89012345678901234567890123456789',
		EuiccConfiguredAddresses: {},
		EUICCInfo2: {}
	})
};
result = invoke('get_info');
check(result.success && result.data.eidValue == '89012345678901234567890123456789',
	'chip information requires and preserves a valid EID');

reset();
global.TEST_EXEC_REPLY = { code: 0, stdout: terminal({ EUICCInfo2: {} }) };
result = invoke('get_info');
check(!result.success && result.error == 'invalid_response',
	'chip information without a valid EID is rejected');

reset();
global.TEST_EXEC_REPLY = { code: 0, stdout: terminal([]) };
result = invoke('list_profiles');
check(result.success && global.TEST_LOCK_EXISTS &&
	global.TEST_LOCK_MODE == 0o600 && global.TEST_CHMOD?.mode == 0o600,
	'eUICC operations create and enforce a mode-0600 lock file');

reset();
global.TEST_LOCK_EXISTS = true;
global.TEST_LOCK_MODE = 0o644;
global.TEST_EXEC_REPLY = { code: 0, stdout: terminal([]) };
result = invoke('list_profiles');
check(result.success && global.TEST_LOCK_MODE == 0o600,
	'a pre-existing permissive lock file is repaired before execution');

reset();
global.TEST_LOCK_EXISTS = true;
global.TEST_LOCK_TYPE = 'symlink';
result = invoke('list_profiles');
check(!result.success && result.error == 'lock_failed' &&
	global.TEST_LAST_CALL === null,
	'non-regular lock paths are rejected before process execution');

reset();
global.TEST_EXEC_REPLY = {
	code: 0,
	stdout: terminal([
		{
			iccid: '8912345678901234567',
			isdpAid: 'A0000005591010FFFFFFFF8900001000',
			profileState: 'disabled',
			profileNickname: 'Test',
			serviceProviderName: 'Carrier',
			profileName: 'Plan',
			iconType: 'png',
			icon: 'sensitive-base64-icon',
			profileClass: 'operational'
		},
		{ iccid: '../../invalid', isdpAid: null }
	])
};
result = invoke('list_profiles');
check(result.success && length(result.data) == 1, 'invalid profile records are discarded');
check(!('icon' in result.data[0]), 'profile icons are never returned to LuCI');

reset();
global.TEST_EXEC_REPLY = {
	code: 0,
	stdout: terminal([
		{ seqNumber: 0, profileManagementOperation: 'install' },
		{ seqNumber: 4294967295, profileManagementOperation: 'delete' }
	])
};
result = invoke('list_notifications');
check(result.success && length(result.data) == 2 &&
	result.data[0].seqNumber == 0 && result.data[1].seqNumber == 4294967295,
	'notification list preserves the full uint32 sequence range');

reset();
global.TEST_EXEC_REPLY = { code: 0, stdout: terminal(null) };
result = invoke('remove_notification', { seq: '4294967295' });
check(result.success, 'UINT32_MAX notification can be removed');
	same(global.TEST_LAST_CALL.request.params,
		[ '-n', '/var/run/luci-lpac.lock', '/usr/bin/lpac',
		'notification', 'remove', '4294967295' ],
	'flock and notification arguments remain separate argv elements');
check(!invoke('remove_notification', { seq: '0' }).success &&
	!invoke('remove_notification', { seq: '01' }).success &&
	!invoke('remove_notification', { seq: '4294967296' }).success,
	'invalid notification sequences are rejected');

reset();
result = invoke('enable_profile', {
	iccid: 'A0000005591010FFFFFFFF8900001000',
	refresh: true
});
check(!result.success && result.error == 'execution_failed',
	'missing lpac output is handled without exposing process data');
same(global.TEST_LAST_CALL.request.params, [
	'-n', '/var/run/luci-lpac.lock', '/usr/bin/lpac', 'profile', 'enable',
	'A0000005591010FFFFFFFF8900001000', '1'
], 'flock, profile AID, and refresh flag remain separate argv elements');
check(!invoke('enable_profile', {
	iccid: '891234567890123456789',
	refresh: false
}).success, 'ICCID longer than the lpac 20-digit buffer is rejected');
check(!invoke('nickname_profile', {
	iccid: 'A0000005591010FFFFFFFF8900001000',
	nickname: 'Alias'
}).success, 'nickname operation requires an ICCID');

reset();
global.TEST_EXEC_REPLY = { code: 1, stdout: '' };
result = invoke('list_profiles');
check(!result.success && result.error == 'busy', 'concurrent eUICC access is rejected');
check(global.TEST_LAST_CALL.request.command == '/usr/bin/flock',
	'eUICC operations are serialized by inherited flock');

reset();
global.TEST_LOCK_BUSY = true;
result = invoke('set_config', { config: default_config() });
check(!result.success && result.error == 'busy',
	'configuration writes share the eUICC operation lock');
check(global.TEST_LOCK_CLOSED, 'busy configuration lock handle is closed');

reset();
global.TEST_EXEC_STATUS = 7;
result = invoke('list_profiles');
check(!result.success && result.error == 'timeout', 'file.exec timeout is normalized');

reset();
global.TEST_EXEC_REPLY = { code: 1, stdout: terminal('private detail', -1) };
result = invoke('delete_profile', { iccid: '8912345678901234567' });
check(!result.success && result.error == 'lpac_error' &&
	!('data' in result) && !('reason' in result),
	'unknown lpac error payload is not returned');

reset();
global.TEST_EXEC_REPLY = {
	code: 255,
	stdout: terminal('profile not in disabled state', -1)
};
result = invoke('enable_profile', {
	iccid: '8912345678901234567',
	refresh: false
});
check(!result.success && result.error == 'lpac_error' &&
	result.reason == 'profile_not_disabled' && !('data' in result),
	'known profile errors are mapped to safe reason codes');

reset();
global.TEST_EXEC_REPLY = {
	code: 255,
	stdout: terminal('iccid or aid not found', -1)
};
result = invoke('delete_profile', { iccid: '8912345678901234567' });
check(!result.success && result.error == 'lpac_error' &&
	!('reason' in result) && !('data' in result),
	'identifier hints are limited to operations that offer both identifiers');

reset();
let config = default_config();
config.at.device = '/dev/ttyUSB2;reboot';
result = invoke('set_config', { config });
check(!result.success && result.error == 'invalid_config',
	'shell-like device paths are rejected');

reset();
config = default_config();
config.global.custom_isd_r_aid = 'A000000559';
result = invoke('set_config', { config });
check(!result.success && result.error == 'invalid_config',
	'short custom ISD-R AIDs are rejected');

reset();
config = default_config();
config.global.apdu_backend = 'mbim';
config.global.custom_isd_r_aid = 'a0000005591010ffffffff8900000100';
result = invoke('set_config', { config });
check(result.success && global.TEST_UCI.global.apdu_backend == 'mbim' &&
	global.TEST_UCI.global.custom_isd_r_aid == 'A0000005591010FFFFFFFF8900000100',
	'validated settings are committed and canonicalized');

reset();
config = default_config();
config.global.apdu_backend = 'at';
config.at.device = '/dev/serial/by-id/usb-Test_Modem-if00';
config.uqmi.device = '/dev/wwan0qmi0';
result = invoke('set_config', { config });
check(result.success && global.TEST_UCI.at.device == config.at.device,
	'safe serial symlinks and inactive backend device paths are accepted');

reset();
config = default_config();
config.global.apdu_backend = 'uqmi';
config.uqmi.device = '/dev/wwan0qmi0';
result = invoke('set_config', { config });
check(!result.success && result.error == 'invalid_config',
	'active uqmi backend retains its strict control-device allowlist');

reset();
config = default_config();
config.global.apdu_backend = 'at';
config.at.device = '/dev/serial/../ttyUSB0';
result = invoke('set_config', { config });
check(!result.success && result.error == 'invalid_config',
	'device paths containing traversal components are rejected');

reset();
global.TEST_UCI.mbim.skip_slot_mapping = '1';
result = invoke('set_config', { config: default_config() });
check(result.success && global.TEST_UCI.mbim.skip_slot_mapping == '1',
	'unmanaged vendor options are preserved by settings writes');

reset();
global.TEST_UCI_LOAD_FAIL = true;
result = invoke('list_profiles');
check(!result.success && result.error == 'invalid_config' &&
	global.TEST_LAST_CALL === null,
	'invalid UCI prevents eUICC process execution');

reset();
global.TEST_UCI_LOAD_FAIL = true;
global.TEST_EXEC_REPLY = { code: 0, stdout: terminal('v2.3.0') };
result = invoke('get_version');
check(result.success && result.data == 'v2.3.0',
	'backend does not pre-block version queries when UCI cannot load');

reset();
global.TEST_UCI.uqmi.device = [ '/dev/cdc-wdm0', '/dev/cdc-wdm0;reboot' ];
result = invoke('list_profiles');
check(!result.success && result.error == 'invalid_config' &&
	global.TEST_LAST_CALL === null,
	'UCI list values cannot bypass scalar path validation');

printf(`1..${checks}\n`);
