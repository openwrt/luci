'use strict';

import { glob, basename } from 'fs';
import { cursor } from 'uci';
import { syslog, LOG_INFO, LOG_WARNING, LOG_USER } from 'log';

//Plugin cache
let pwp_plugins = null;


const PLUGIN_PATH = '/usr/share/ucode/luci/plugins/pwp/policy';

/*
 * Load all enabled password policy plugins.
 * Plugins are loaded from PLUGIN_PATH and must:
 * - Have a 32-character hex UUID filename (e.g., 51af4ae847774aac863d4c94a9ba6d58.uc)
 * - Export a plugin object
 *
 * Configuration hierarchy:
 * - luci_plugins.global.enabled = '1'
 * - luci_plugins.global.auth_login_enabled = '1'
 * - luci_plugins.<uuid>.enabled = '1'
 *
 * Returns array of loaded plugin objects
 */

 export function load() {
 	let uci = cursor();

 	if (uci.get('luci_plugins', 'global', 'enabled') != '1')
 		return [];

 	if (uci.get('luci_plugins', 'global', 'password_policy_enabled') != '1')
 		return [];

 	if (pwp_plugins != null)
 		return pwp_plugins;

 	pwp_plugins = [];

 	for (let path in glob(PLUGIN_PATH + '/*.uc')) {
		try {
			let code = loadfile(path);
			if (!code)
				continue;

			let plugin = call(code);
			if (type(plugin) != 'object')
				continue;

			/*
			 * Get UUID from filename
			 */
			let filename = basename(path);
			let uuid = replace(filename, /\.uc$/, '');

			/*
			 * Validate UUID format
			 */
			if (!match(uuid, /^[a-f0-9]{32}$/))
				continue;

			if (uci.get('luci_plugins', uuid, 'enabled') != '1')
				continue;

			if (type(plugin) == 'object' &&
				type(plugin.policy) == 'function') {
				plugin.uuid = uuid;
				plugin.name = uci.get('luci_plugins', uuid, 'name') || uuid;
				push(pwp_plugins, plugin);
			}
		}
		catch (e) {
			syslog(LOG_WARNING,
				sprintf('luci: failed to load pwp plugin from %s: %s', path, e));
		}

		return pwp_plugins;
	}
};

export function get_policy() {
	let plugins = load();
	let policies = [];

	for (let plugin in plugins) {
		try {
			let result = plugin.policy();
			if (result && result.required) {
				push(policies, {
					uuid: plugin.uuid,
					name: plugin.name,
					length: result.length,
					digits: result.digits,
					uc_lc: result.uc_lc,
					schars: result.schars
				});
			}
		}
		catch (e) {
			syslog(LOG_WARNING,
				sprintf('luci: pw plugin "%s" policy error: %s', plugin.name, e);
		}
	}

	return {
		policies: policies
	};
};

/* Clear plugin cache.
 *
 * Call this if plugin configuration changes and you need
 * to reload plugins without restarting uhttpd.
 */
export function reset() {
	pwp_plugins = null;
};
