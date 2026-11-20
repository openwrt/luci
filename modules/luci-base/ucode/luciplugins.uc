// SPDX-License-Identifier: Apache-2.0

import {
	lsdir
} from 'fs';

import {
	syslog, LOG_NOTICE, LOG_LOCAL0
} from 'log';

import { cursor } from 'uci';


/* generic plugin handler */
export function run_plugins(plugin_class_path, plugin_class_enable) {
	let uci = cursor();
	const require_path = replace(plugin_class_path, '/', '.');

	if (uci.get('luci_plugins', 'global', 'enabled') == 1 &&
		uci.get('luci_plugins', 'global', plugin_class_enable) == 1) {
		const PLUGINS_PATH = '/usr/share/ucode' + plugin_class_path;
		const results = {};

		for (let fn in lsdir(PLUGINS_PATH)) {
			const plugin_id = replace(fn, /.uc$/, '');
			/* plugins shall have a <32_char_UUID_no_hyphens>.uc filename */
			if (!match(plugin_id, /^[a-f0-9]+$/) || length(plugin_id) !== 32) {
				syslog(LOG_NOTICE|LOG_LOCAL0,
					sprintf("Invalid plugin name: %s", plugin_id));
				continue;
			}

			if (uci.get('luci_plugins', plugin_id, 'enabled')) {
				const mod = require(require_path + `.${plugin_id}`);
				if (type(mod) === 'function') {
					try {
						results[plugin_id] = mod(plugin_id);
					} catch (e) {
						syslog(LOG_NOTICE|LOG_LOCAL0,
							sprintf("Could not execute plugin %s: %s",
							join('/', [PLUGINS_PATH, plugin_id]), e));
					};
				}
			}
		}

		return results;
	}
};
