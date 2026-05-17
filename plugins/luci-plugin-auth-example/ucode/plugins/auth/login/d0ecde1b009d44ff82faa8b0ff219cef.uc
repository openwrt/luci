/*
Example authentication plugin for LuCI
This plugin demonstrates the auth plugin interface.

The plugin filename must be a 32-character UUID matching its JS config frontend.
This allows the plugin system to link backend behavior with user configuration.
*/

'use strict';

import { cursor } from 'uci';

/*
Auth plugins must return an object with:
- check(http, user): determines if authentication challenge is required
- verify(http, user): validates the user's authentication response
- priority (optional): execution order (lower = first, default 50)

Authentication dispatcher behavior:
- Stores required plugin UUIDs in `pending_auth_plugins` before verification
- Clears `pending_auth_plugins` by setting it to `null` after success
*/

const uci_cursor = cursor();
const plugin_uuid = 'd0ecde1b009d44ff82faa8b0ff219cef';
const configured_priority = +(uci_cursor.get('luci_plugins', plugin_uuid, 'priority') ?? 10);
const plugin_priority = (configured_priority >= 0 && configured_priority <= 1000) ? configured_priority : 10;

return {
	// Optional priority for execution order (lower executes first)
	priority: plugin_priority,
	
	// check() is called after successful password authentication
	// to determine if additional verification is needed
	check: function(http, user) {
		// Get plugin config from luci_plugins
		const enabled = uci_cursor.get('luci_plugins', plugin_uuid, 'enabled');
		
		if (enabled != '1')
			return { required: false };
		
		// Check if user needs auth challenge
		// This example always requires it when enabled
		const challenge_field = uci_cursor.get('luci_plugins', plugin_uuid, 'challenge_field') || 'verification_code';
		const help_text = uci_cursor.get('luci_plugins', plugin_uuid, 'help_text') || 'Enter your verification code';
		
		return {
			required: true,
			fields: [
				{
					name: challenge_field,
					label: 'Verification Code',
					type: 'text',
					placeholder: help_text
				}
			],
			message: 'Additional verification required',
			html: '<div class="cbi-value-description">Example plugin challenge UI</div>',
			assets: [
				`/luci-static/plugins/${plugin_uuid}/challenge.js`
			]
		};
	},
	
	// verify() is called to validate the user's authentication response
	verify: function(http, user) {
		const challenge_field = uci_cursor.get('luci_plugins', plugin_uuid, 'challenge_field') || 'verification_code';
		const expected_code = uci_cursor.get('luci_plugins', plugin_uuid, 'test_code') || '123456';
		
		// Get the submitted verification code
		const submitted_code = http.formvalue(challenge_field);
		
		if (!submitted_code) {
			return {
				success: false,
				message: 'Verification code is required'
			};
		}
		
		// Simple example: check against configured test code
		// Real implementations would check TOTP, SMS, WebAuthn, etc.
		if (submitted_code == expected_code) {
			return {
				success: true,
				message: 'Verification successful'
			};
		}
		
		return {
			success: false,
			message: 'Invalid verification code'
		};
	}
};
