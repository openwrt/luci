// SPDX-License-Identifier: Apache-2.0

'use strict';

import { cursor } from 'uci';

function default_action(plugin_id) {
	const uci = cursor();
	const mode = uci.get('luci_plugins', plugin_id, 'mode') || 'strict';

	const presets = {
		'strict': "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'trusted-types-eval'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://sysupgrade.openwrt.org;",
		'permissive': "default-src 'self' https://*; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'trusted-types-eval'; img-src 'self' data: blob: https://*; style-src 'self' 'unsafe-inline' https://*;",
	};

	let policy;

	if (mode === 'custom')
		policy = uci.get('luci_plugins', plugin_id, 'policy');
	else
		policy = presets[mode];

	if (!policy)
		return null;

	return ['Content-Security-Policy', policy];
}

return default_action;
