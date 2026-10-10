// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';
'require rpc';

const MAX_AGE = 5 * 60 * 1000;

// Keep device data within this tab and the current LuCI session and access level.
function key() {
	return 'luci-device-manager-snapshot-v1:' + rpc.getSessionID() + ':' + (L.hasViewPermission() === true ? 'write' : 'read');
}

return baseclass.extend({
	load: function() {
		return Promise.resolve().then(() => window.sessionStorage.getItem(key())).then(raw => {
			const entry = raw ? JSON.parse(raw) : null;
			if (!entry || !Number.isFinite(entry.time) || Date.now() < entry.time || Date.now() - entry.time >= MAX_AGE)
				return null;
			const data = entry.snapshot;
			if (!data || !Array.isArray(data.devices) || !Array.isArray(data.groups) || !Array.isArray(data.errors)
				|| typeof data.discoveryComplete !== 'boolean') return null;
			return entry;
		}).catch(() => null);
	},
	save: function(snapshot) {
		return Promise.resolve().then(() => window.sessionStorage.setItem(key(), JSON.stringify({ time: Date.now(), snapshot: snapshot })))
			.catch(() => {});
	},
	clear: function() {
		return Promise.resolve().then(() => window.sessionStorage.removeItem(key())).catch(() => {});
	}
});
