// SPDX-License-Identifier: Apache-2.0

'use strict';
'require rpc';
'require baseclass';

const callGetVersion = rpc.declare({
	object: 'luci.lpac',
	method: 'get_version',
	expect: {}
});

const callGetDrivers = rpc.declare({
	object: 'luci.lpac',
	method: 'get_drivers',
	expect: {}
});

const callGetInfo = rpc.declare({
	object: 'luci.lpac',
	method: 'get_info',
	expect: {}
});

const callListProfiles = rpc.declare({
	object: 'luci.lpac',
	method: 'list_profiles',
	expect: {}
});

const callListNotifications = rpc.declare({
	object: 'luci.lpac',
	method: 'list_notifications',
	expect: {}
});

const callEnableProfile = rpc.declare({
	object: 'luci.lpac',
	method: 'enable_profile',
	params: [ 'iccid', 'refresh' ],
	expect: {}
});

const callDisableProfile = rpc.declare({
	object: 'luci.lpac',
	method: 'disable_profile',
	params: [ 'iccid', 'refresh' ],
	expect: {}
});

const callNicknameProfile = rpc.declare({
	object: 'luci.lpac',
	method: 'nickname_profile',
	params: [ 'iccid', 'nickname' ],
	expect: {}
});

const callDeleteProfile = rpc.declare({
	object: 'luci.lpac',
	method: 'delete_profile',
	params: [ 'iccid' ],
	expect: {}
});

const callRemoveNotification = rpc.declare({
	object: 'luci.lpac',
	method: 'remove_notification',
	params: [ 'seq' ],
	expect: {}
});

const callGetConfig = rpc.declare({
	object: 'luci.lpac',
	method: 'get_config',
	expect: {}
});

const callSetConfig = rpc.declare({
	object: 'luci.lpac',
	method: 'set_config',
	params: [ 'config' ],
	expect: {}
});

function safeCall(call) {
	return function() {
		return call.apply(null, arguments).catch(function() {
			return {
				success: false,
				error: 'transport_error'
			};
		});
	};
}

return baseclass.extend({
	getVersion: safeCall(callGetVersion),
	getDrivers: safeCall(callGetDrivers),
	getInfo: safeCall(callGetInfo),
	listProfiles: safeCall(callListProfiles),
	listNotifications: safeCall(callListNotifications),
	enableProfile: safeCall(callEnableProfile),
	disableProfile: safeCall(callDisableProfile),
	nicknameProfile: safeCall(callNicknameProfile),
	deleteProfile: safeCall(callDeleteProfile),
	removeNotification: safeCall(callRemoveNotification),
	getConfig: safeCall(callGetConfig),
	setConfig: safeCall(callSetConfig),

	errorMessage: function(result) {
		if (!result)
			return _('No response from the lpac service.');

		switch (result.error) {
		case 'busy':
			return _('Another lpac operation is already running.');
		case 'invalid_argument':
			return _('The request contains an invalid argument.');
		case 'invalid_config':
			return _('The lpac configuration is invalid.');
		case 'not_installed':
			return _('The lpac executable is not installed.');
		case 'timeout':
			return _('The lpac operation timed out.');
		case 'output_too_large':
			return _('The lpac output exceeded the RPC response limit.');
		case 'execution_failed':
			return _('The lpac process could not be executed.');
		case 'lock_failed':
			return _('The lpac operation lock could not be created.');
		case 'config_write_failed':
			return _('The lpac configuration could not be saved.');
		case 'transport_error':
			return _('The lpac RPC request failed or timed out.');
		case 'lpac_error':
			switch (result.reason) {
			case 'profile_not_found':
				return _('lpac could not find that profile identifier. Try the other identifier if available.');
			case 'profile_not_disabled':
				return _('The profile is not in the disabled state required for enabling.');
			case 'profile_not_enabled':
				return _('The profile is not in the enabled state required for disabling.');
			case 'policy_denied':
				return _('The eUICC profile policy rejected this operation.');
			case 'wrong_reenable':
				return _('The eUICC rejected re-enabling this profile.');
			case 'profile_internal_error':
				return _('lpac reported an internal profile error. Try the other identifier and refresh setting.');
			}

			return Number.isInteger(result.code)
				? _('lpac rejected the operation (code %d).').format(result.code)
				: _('lpac rejected the operation.');
		case 'invalid_response':
			return _('lpac returned an invalid or unexpected response.');
		case 'rpc_error':
			return result.message || _('The lpac RPC request failed.');
		default:
			return result.message || result.error || _('The lpac operation failed.');
		}
	},

	dataOr: function(result, fallback) {
		return result && result.success ? result.data : fallback;
	}
});
