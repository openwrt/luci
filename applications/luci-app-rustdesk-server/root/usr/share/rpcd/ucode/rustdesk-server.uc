#!/usr/bin/env ucode
'use strict';

import { popen, access, readfile, unlink } from 'fs';
import { process_list, init_enabled, init_action } from 'luci.sys';

const BIN_DIR = '/usr/bin';
const KEY_DIR = '/etc/rustdesk';

/*
 * Helper functions to reduce code duplication
 */

// Shell escape a string to prevent command injection
function shellquote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
}

// Get PID of a process by name using luci.sys.process_list()
function getProcessPid(process_name) {
	for (let proc in process_list()) {
		if (index(proc.COMMAND, process_name) >= 0) {
			return proc.PID;
		}
	}
	return null;
}

// Execute a command and return trimmed output (for version queries only)
function execCommand(bin, args) {
	let result = null;
	let cmd = shellquote(bin) + ' ' + args;
	let pp = popen(cmd, 'r');
	if (pp) {
		let output = pp.read('all');
		pp.close();
		if (output) {
			result = trim(output);
		}
	}
	return result;
}

// Check if a file exists
function fileExists(path) {
	return !!access(path);
}

// Read file content and trim
function readFileContent(path) {
	let content = readfile(path);
	return content ? trim(content) : null;
}

// Safe file deletion
function safeUnlink(path) {
	return unlink(path) || false;
}

const methods = {
	get_status: {
		call: function() {
			// Check if service is enabled for boot using luci.sys.init_enabled()
			let boot_enabled = init_enabled('rustdesk-server');

			return {
				hbbs_pid: getProcessPid('hbbs'),
				hbbr_pid: getProcessPid('hbbr'),
				hbbs_exists: fileExists(BIN_DIR + '/hbbs'),
				hbbr_exists: fileExists(BIN_DIR + '/hbbr'),
				boot_enabled: boot_enabled
			};
		}
	},

	get_public_key: {
		call: function() {
			let key_path = KEY_DIR + '/id_ed25519.pub';
			let key_exists = fileExists(key_path);
			let public_key = null;

			if (key_exists) {
				public_key = readFileContent(key_path);
			}

			return {
				key_exists: key_exists,
				public_key: public_key,
				key_path: key_path
			};
		}
	},

	service_action: {
		args: { action: 'action' },
		call: function(req) {
			let action = '';

			if (req && req.args && req.args.action) {
				action = req.args.action;
			}

			// Validate action - whitelist approach
			const valid_actions = ['start', 'stop', 'restart', 'reload', 'enable', 'disable'];
			if (index(valid_actions, action) < 0) {
				return {
					success: false,
					error: 'Invalid action. Allowed: ' + join(', ', valid_actions)
				};
			}

			// Use luci.sys.init_action() for service control
			let result = init_action('rustdesk-server', action);

			return {
				success: (result === 0),
				action: action,
				exit_code: result
			};
		}
	},

	get_version: {
		call: function() {
			return {
				hbbs_version: fileExists(BIN_DIR + '/hbbs') ? execCommand(BIN_DIR + '/hbbs', '--version 2>&1') : null,
				hbbr_version: fileExists(BIN_DIR + '/hbbr') ? execCommand(BIN_DIR + '/hbbr', '--version 2>&1') : null
			};
		}
	},

	regenerate_key: {
		call: function() {
			let key_priv = KEY_DIR + '/id_ed25519';
			let key_pub = KEY_DIR + '/id_ed25519.pub';

			// Step 1: Stop the service first so keys are not in use
			// init_action is synchronous - waits for service to fully stop
			init_action('rustdesk-server', 'stop');

			// Step 2: Remove existing keys
			let priv_deleted = safeUnlink(key_priv);
			let pub_deleted = safeUnlink(key_pub);

			// Verify keys are deleted
			let keys_deleted = !fileExists(key_priv) && !fileExists(key_pub);

			// The UI will call restart to regenerate the keys
			// hbbs automatically generates new keys on startup if they don't exist

			return {
				success: keys_deleted,
				keys_deleted: keys_deleted,
				priv_deleted: priv_deleted,
				pub_deleted: pub_deleted,
				key_path: key_pub,
				message: keys_deleted ? 'Keys deleted. Restart service to generate new keys.' : 'Failed to delete keys'
			};
		}
	}
};

return { 'luci.rustdesk-server': methods };
