// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';

const STORAGE_KEY = 'luci-device-manager-view';
const DEFAULT_STATE = { tab: 'online', group: 'all' };

// Storage access and JSON parsing can throw synchronously; isolate them in promises.
return baseclass.extend({
	load: function() {
		return Promise.resolve().then(() => window.localStorage.getItem(STORAGE_KEY)).then(raw => {
			const state = raw ? JSON.parse(raw) : null;
			if (!state || typeof state !== 'object') return Object.assign({}, DEFAULT_STATE);
			const result = {
				tab: typeof state.tab === 'string' ? state.tab : 'online',
				group: typeof state.group === 'string' ? state.group : 'all'
			};
			if (typeof state.maskInfo === 'boolean') result.maskInfo = state.maskInfo;
			return result;
		}).catch(() => Object.assign({}, DEFAULT_STATE));
	},
	save: function(tab, group, maskInfo) {
		const payload = { tab: tab || 'online', group: group || 'all' };
		if (typeof maskInfo === 'boolean') payload.maskInfo = maskInfo;
		return Promise.resolve().then(() => window.localStorage.setItem(STORAGE_KEY,
			JSON.stringify(payload))).catch(() => {});
	}
});
