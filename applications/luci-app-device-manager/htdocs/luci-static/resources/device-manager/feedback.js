// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';
'require ui';

const TIMEOUT = 12000;

return baseclass.extend({
	createWarning: function() {
		let previous = '', timer = null;
		const message = E('span', { 'class': 'dm-warning-message' });
		const dismiss = () => {
			clearTimeout(timer);
			timer = null;
			node.style.display = 'none';
		};
		const node = E('div', {
			'id': 'dm-source-warning', 'class': 'alert-message warning dm-source-warning',
			'role': 'status', 'style': 'display:none;'
		}, [ message, E('button', {
			'type': 'button', 'class': 'btn cbi-button dm-warning-close',
			'click': dismiss
		}, [ _('Close') ]) ]);
		return {
			node: node,
			destroy: dismiss,
			update: errors => {
				const text = errors.length
					? _('Some device data could not be read. Unconfirmed devices are shown as unknown: %s').format(errors.join('; ')) : '';
				if (text === previous) return;
				previous = text;
				dismiss();
				message.textContent = text;
				if (text) {
					node.style.display = 'flex';
					timer = setTimeout(dismiss, TIMEOUT);
				}
			}
		};
	},
	notify: function(message, level) {
		const node = ui.addNotification(null, E('p', {}, [ message ]), level);
		if (node) setTimeout(() => node.remove(), TIMEOUT);
	}
});
