// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';

const MAX_DEVICES = 16;
const MAX_DURATION = 12000;

return baseclass.extend({
	run: function(devices, ping, isCurrent) {
		// ping_device has a shared router lock, so check one device at a time.
		const task = (this.pending || Promise.resolve()).then(() => {
			const targets = devices.filter(device => device.status === 'unknown' && (device.ipv4 || device.ipv6));
			const started = Date.now(), limit = Math.min(targets.length, MAX_DEVICES);
			let count = 0;
			const next = () => {
				if (!isCurrent() || count >= limit || Date.now() - started >= MAX_DURATION) return;
				const index = (this.cursor || 0) % targets.length;
				this.cursor = index + 1;
				count++;
				const device = targets[index];
				return Promise.resolve().then(() => {
					if (isCurrent() && device.status === 'unknown') return ping(device);
				}).then(next, next);
			};
			return next();
		});
		this.pending = task.then(() => {}, () => {});
		return task;
	}
});
