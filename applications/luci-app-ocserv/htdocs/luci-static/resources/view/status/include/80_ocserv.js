'use strict';
'require baseclass';
'require fs';

/* OpenConnect VPN Status Widget for LuCI 
   Converted from Lua to JavaScript by @systemcrash
   Copyright 2014 Nikos Mavrogiannopoulos <n.mavrogiannopoulos@gmail.com>
   Licensed to the public under the Apache License 2.0.
*/

return baseclass.extend({
	title: _('Active OpenConnect Users'),

	parseUsers: function(output) {
		const users = [];
		
		// Handle empty or invalid output
		if (!output || !output.trim()) {
			return users;
		}

		try {
			// Clean up the output - remove extra newlines and trim
			const cleaned = output.trim().replace(/\[\s*\n\s*\]/g, '[]');
			const json = JSON.parse(cleaned);
			
			// Handle different JSON structures
			if (Array.isArray(json)) {
				// Handle empty array like "[\n]"
				if (json.length === 0) {
					return users;
				}
				// If it's an array of users directly
				return json.map(entry => this.normalizeUser(entry));
			} else if (json && json.users && Array.isArray(json.users)) {
				// If it's wrapped in a "users" property
				return json.users.map(entry => this.normalizeUser(entry));
			}
			
			return users;
		} catch (e) {
			// Fall back to text parsing for non-JSON output
			console.warn('JSON parsing failed, falling back to text parsing:', e.message);
			return this.parseUsersText(output);
		}
	},

	normalizeUser: function(entry) {
		return {
			id: entry.id,
			user: entry?.username || entry?.user,
			group: entry?.group,
			vpn_ip: entry['vpn-ipv4'] || entry.vpn_ip,
			vpn_ip6: entry['vpn-ipv6'] || entry.vpn_ip6,
			ip: entry?.ip,
			device: entry?.device,
			time: entry?.time || entry['connected-at'],
			cipher: entry?.cipher,
			status: entry?.status
		};
	},

	parseUsersText: function(output) {
		const users = [];
		if (!output) return users;

		const lines = output.split('\n');
		for (let line of lines) {
			// Parse: id user group vpn_ip ip device time cipher status
			const match = line.match(/^\s*(\d+)\s+([-_\w]+)\s+([().*\-_\w]+)\s+([:.\-_\w]+)\s+([:.\-_\w]+)\s+([:.\-_\w]+)\s+([:.\-_\w]+)\s+([():.\-_\w]+)\s+([:.\-_\w]+)/);
			if (match) {
				users.push({
					id: match[1],
					user: match[2],
					group: match[3],
					vpn_ip: match[4],
					ip: match[5],
					device: match[6],
					time: match[7],
					cipher: match[8],
					status: match[9]
				});
			}
		}
		return users;
	},

	handleDisconnect: function(id) {
		return L.resolveDefault(
			fs.exec('/usr/bin/occtl', ['disconnect', 'id', id]),
			null
		).then(() => {
			L.ui.addNotification(null, E('p', _('User %s has been disconnected.').format(id)), 'info');
			// Trigger refresh
			this.load();
		}).catch(function(e) {
			L.ui.addNotification(null, E('p', _('Failed to disconnect user: %s').format(e.message)), 'error');
		});
	},

	load: function() {
		return L.resolveDefault(
			fs.exec('/usr/bin/occtl', ['show', 'users']).then(res => res.stdout),
			''
		);
	},

	render: function(data) {
		const users = this.parseUsers(data || '');

		const table = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('User')),
				E('div', { 'class': 'th' }, _('Group')),
				E('div', { 'class': 'th' }, _('VPN IP Address')),
				E('div', { 'class': 'th' }, _('IP Address')),
				E('div', { 'class': 'th' }, _('Device')),
				E('div', { 'class': 'th' }, _('Time')),
				E('div', { 'class': 'th' }, _('Cipher')),
				E('div', { 'class': 'th' }, _('Status')),
				E('div', { 'class': 'th' }, '\u00a0')
			])
		]);

		if (users.length === 0) {
			table.appendChild(
				E('div', { 'class': 'tr placeholder' }, [
					E('div', { 'class': 'td' }, 
						E('em', _('There are no active users.')))
				])
			);
		} else {
			for (let user of users) {
				table.appendChild(
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td' }, user.user),
						E('div', { 'class': 'td' }, user.group),
						E('div', { 'class': 'td' }, user.vpn_ip),
						E('div', { 'class': 'td' }, user.ip),
						E('div', { 'class': 'td' }, user.device),
						E('div', { 'class': 'td' }, user.time),
						E('div', { 'class': 'td' }, user.cipher),
						E('div', { 'class': 'td' }, user.status),
						E('div', { 'class': 'td' }, 
							E('button', {
								'class': 'cbi-button cbi-button-remove',
								'click': L.bind(this.handleDisconnect, this, user.id)
							}, _('Disconnect')))
					])
				);
			}
		}

		return E('div', { 'class': 'cbi-section' }, [
			E('legend', _('Active OpenConnect Users')),
			table
		]);
	}
});
