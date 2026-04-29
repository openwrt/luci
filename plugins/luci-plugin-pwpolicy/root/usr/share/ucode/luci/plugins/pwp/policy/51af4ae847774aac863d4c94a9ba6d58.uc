'use strict';

import { cursor } from 'uci';

const uci_cursor = cursor();
const plugin_uuid = '51af4ae847774aac863d4c94a9ba6d58';

return {
	policy: function () {
		const enabled = uci_cursor.get('luci_plugins', plugin_uuid, 'enabled');

		if (enabled != '1')
			return { required: false };

		const length = uci_cursor.get('luci_plugins', plugin_uuid,
			'pw_length') || null;
		const digits = uci_cursor.get('luci_plugins', plugin_uuid,
			'digits') || '0';
		const uc_lc = uci_cursor.get('luci_plugins', plugin_uuid,
			'uc_lc') || '0';
		const schars = uci_cursor.get('luci_plugins', plugin_uuid,
			'special_characters') || '0';

		return {
			required: true,
			length: length,
			digits: digits,
			uc_lc: uc_lc,
			schars: schars
		}
	}
};
