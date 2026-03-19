'use strict';
'require form';
'require fs';
'require ui';
'require rpc';

/* OpenConnect VPN JavaScript for LuCI 
   Converted from Lua to JavaScript by @systemcrash
   Copyright 2014 Nikos Mavrogiannopoulos <n.mavrogiannopoulos@gmail.com>
   Licensed to the public under the Apache License 2.0.
*/

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
});

return L.view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.exec('/usr/bin/occtl', ['--json', 'show', 'users']).then(res => res.stdout), ''),
			L.uci.load('ocserv'),
		]);
	},

	parseUsers(output) {
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
			console.error('Failed to parse JSON:', e.message);
			return users;
		}
	},

	normalizeUser(entry) {
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

	handleDisconnect(id, ev) {
		return L.resolveDefault(
			fs.exec('/usr/bin/occtl', ['disconnect', 'id', id]),
			null
		).then(() => {
			L.ui.addNotification(null, E('p', _('User %s has been disconnected.').format(id)), 'info');
			// Reload the page to refresh the user list
			window.location.reload();
		}).catch(function(e) {
			L.ui.addNotification(null, E('p', _('Failed to disconnect user: %s').format(e.message)), 'error');
		});
	},

	render([occtl_output]) {
		const users = this.parseUsers(occtl_output);
		const auth_method = L.uci.get('ocserv', 'config', 'auth');

		const m = new form.Map('ocserv', _('OpenConnect VPN'));

		// If using plain authentication, show user management section
		if (auth_method === 'plain') {
			const s = m.section(form.TableSection, 'ocservusers', _('Available users'));
			s.anonymous = true;
			s.addremove = true;

			let o;

			o = s.option(form.Value, 'name', _('Name'));
			o.rmempty = false;
			o.datatype = 'uciname';

			o = s.option(form.DummyValue, 'group', _('Group'));
			o.rmempty = true;

			o = s.option(form.Value, 'password', _('Password'));
			o.password = true;
			o.rmempty = false;
			
			// Custom write to handle password encryption
			o.write = function(section_id, formvalue) {
				// Check if password is already hashed (starts with $)
				if (formvalue.match(/^\$\d+\$/)) {
					return form.Value.prototype.write.call(this, section_id, formvalue);
				} else {
					// For new passwords, we'll store them as-is and let ocserv handle hashing
					// In production, you might want to hash client-side or via RPC
					return form.Value.prototype.write.call(this, section_id, formvalue);
				}
			};
		}

		// Active Users section
		const activeSection = m.section(form.TypedSection, '__active_users__', _('Active users'));
		activeSection.anonymous = true;
		activeSection.cfgsections = function() { return ['_active']; };

		// Use a custom render to display active users table
		activeSection.render = L.bind(function() {
			const table = E('div', { 'class': 'table cbi-section-table' }, [
				E('div', { 'class': 'tr table-titles' }, [
					E('div', { 'class': 'th' }, _('ID')),
					E('div', { 'class': 'th' }, _('Username')),
					E('div', { 'class': 'th' }, _('Group')),
					E('div', { 'class': 'th' }, _('VPN IPv4')),
					E('div', { 'class': 'th' }, _('VPN IPv6')),
					E('div', { 'class': 'th' }, _('Remote IP')),
					E('div', { 'class': 'th' }, _('Device')),
					E('div', { 'class': 'th' }, _('Time')),
					E('div', { 'class': 'th' }, _('Cipher')),
					E('div', { 'class': 'th' }, _('Status')),
					E('div', { 'class': 'th' }, _('Tx')),
					E('div', { 'class': 'th' }, _('Rx')),
					E('div', { 'class': 'th cbi-section-actions' }, _('Actions'))
				])
			]);

			if (users.length === 0) {
				table.appendChild(
					E('div', { 'class': 'tr placeholder' }, [
						E('div', { 'class': 'td', 'colspan': 10 }, 
							E('em', _('Collecting data...')))
					])
				);
			} else {
				for (let user of users) {
					table.appendChild(
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td', 'data-title': _('ID') }, user.id),
							E('div', { 'class': 'td', 'data-title': _('Username') }, user.user),
							E('div', { 'class': 'td', 'data-title': _('Group') }, user.group),
							E('div', { 'class': 'td', 'data-title': _('VPN IPv4') }, user.vpn_ip),
							E('div', { 'class': 'td', 'data-title': _('VPN IPv6') }, user.vpn_ip6),
							E('div', { 'class': 'td', 'data-title': _('Remote IP') }, user.ip),
							E('div', { 'class': 'td', 'data-title': _('Device') }, user.device),
							E('div', { 'class': 'td', 'data-title': _('Time') }, user.time),
							E('div', { 'class': 'td', 'data-title': _('Cipher') }, user.cipher),
							E('div', { 'class': 'td', 'data-title': _('Status') }, user.status),
							E('div', { 'class': 'td', 'data-title': _('Tx') }, user.tx),
							E('div', { 'class': 'td', 'data-title': _('Rx') }, user.rx),
							E('div', { 'class': 'td cbi-section-actions' }, 
								E('button', {
									'class': 'cbi-button cbi-button-remove',
									'click': L.bind(this.handleDisconnect, this, user.id)
								}, _('Disconnect')))
						])
					);
				}
			}

			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Active users')),
				table
			]);
		}, this);

		return m.render();
	},

	// handleSave(ev) {
	// 	return this.super('handleSave', [ev]).then(() => {
	// 		// Restart ocserv after user changes
	// 		return callRcInit('ocserv', 'restart');
	// 	}).then(() => {
	// 		L.ui.addNotification(null, E('p', _('Configuration saved and ocserv restarted.')), 'info');
	// 	}).catch(function(e) {
	// 		L.ui.addNotification(null, E('p', _('Failed to restart ocserv: %s').format(e.message)), 'error');
	// 	});
	// }
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

});
