// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';
'require rpc';
'require uci';
'require fs';
'require device-manager.model as model';

const CONFIG = 'device_manager';
const callHints = rpc.declare({ object: 'luci-rpc', method: 'getHostHints', reject: true });
const callLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases', reject: true });
const callNeighbors = rpc.declare({ object: 'luci.device-manager', method: 'get_online_status', reject: true });
const callScan = rpc.declare({ object: 'luci.device-manager', method: 'scan_devices', reject: true });
const callPing = rpc.declare({ object: 'luci.device-manager', method: 'ping_device', params: [ 'mac' ], reject: true });
const callWireless = rpc.declare({ object: 'luci-rpc', method: 'getWirelessDevices', reject: true });
const callAssoc = rpc.declare({ object: 'iwinfo', method: 'assoclist', params: [ 'device' ], reject: true });
const callCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ], reject: true });
const callRevert = rpc.declare({ object: 'uci', method: 'revert', params: [ 'config' ], reject: true });

function requireObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(_('Invalid discovery response'));
	return value;
}

function readSource(name, read) {
	return Promise.resolve().then(read).then(value => ({ name: name, ok: true, value: value }),
		error => ({ name: name, ok: false, error: error.message || String(error) }));
}

function wifiStations() {
	return callWireless().then(requireObject).then(radios => {
		const interfaces = new Set();
		for (const radio of Object.values(radios)) {
			for (const iface of radio.interfaces || []) {
				const mode = (iface.config || {}).mode;
				if (mode && mode !== 'ap' && mode !== 'ap-wds') continue;
				if (iface.ifname) interfaces.add(iface.ifname);
				for (const vlan of iface.vlans || []) if (vlan.ifname) interfaces.add(vlan.ifname);
			}
		}
		return Promise.all(Array.from(interfaces).map(device => readSource(device, () => callAssoc(device).then(reply => {
			if (!Array.isArray(requireObject(reply).results)) throw new Error(_('Invalid discovery response'));
			return reply.results.map(station => ({ mac: station.mac, dev: device }));
		})))).then(results => ({
			stations: results.filter(result => result.ok).flatMap(result => result.value),
			complete: results.every(result => result.ok),
			errors: results.filter(result => !result.ok).map(result => result.name + ': ' + result.error)
		}));
	});
}

function reloadConfig() {
	uci.unload(CONFIG);
	return uci.load(CONFIG);
}

function validateText(value, limit) {
	const text = model.sanitizeInput(value);
	if (text.length > limit) throw new Error(_('Input is too long'));
	return text;
}

function validateGroupName(name, exceptId) {
	const text = validateText(name, 32);
	if (!text) throw new Error(_('Enter a valid group name'));
	if (uci.sections(CONFIG, 'group').some(group => group['.name'] !== exceptId && model.sanitizeInput(group.name) === text))
		throw new Error(_('A group with this name already exists'));
	return text;
}

function requireGroup(id) {
	if (!uci.sections(CONFIG, 'group').some(group => group['.name'] === id)) throw new Error(_('This group no longer exists'));
}

return baseclass.extend({
	scanDevices: function() {
		if (L.hasViewPermission() !== true) return Promise.reject(new Error(_('Read-only access')));
		return this.queue(() => callScan().then(reply => {
			if (requireObject(reply).ok !== true)
				throw new Error(_('LAN scanning is unavailable. Check the selected interfaces and probe dependencies.'));
		}));
	},
	pingDevice: function(mac) {
		const normalized = model.normalizeMac(mac);
		if (!normalized) return Promise.reject(new Error(_('Enter a valid MAC address')));
		return callPing(normalized).then(reply => {
			const errors = {
				'No known IP address for this device': _('No known IP address for this device'),
				'Another device is being probed. Please retry.': _('Another device is being probed. Please retry.'),
				'Ping is unavailable': _('Ping is unavailable'),
				'Enter a valid MAC address': _('Enter a valid MAC address'),
				'Unable to read the kernel neighbor table': _('Unable to read the kernel neighbor table')
			};
			if (requireObject(reply).ok !== true) {
				const error = new Error(errors[reply.error] || _('Ping could not be completed'));
				error.output = typeof reply.output === 'string' ? reply.output : '';
				throw error;
			}
			if (typeof reply.reachable !== 'boolean' || typeof reply.ip !== 'string' || typeof reply.output !== 'string')
				throw new Error(_('Invalid discovery response'));
			return reply;
		});
	},
	// Reads and writes share the queue so a refresh cannot discard an in-flight edit.
	queue: function(task) {
		const result = (this.pending || Promise.resolve()).then(task);
		this.pending = result.catch(() => {});
		return result;
	},
	load: function() {
		return this.queue(() => this.recoverPending().then(() => {
			const config = reloadConfig().then(() => ({
				groups: uci.sections(CONFIG, 'group'), devices: uci.sections(CONFIG, 'device')
			}));
			const sources = Promise.all([
				readSource('hints', () => callHints().then(requireObject)),
				readSource('leases', () => callLeases().then(requireObject)),
				readSource('neighbors', () => callNeighbors().then(reply => {
					if (requireObject(reply).ok !== true || !Array.isArray(reply.neighbors)) throw new Error(reply.error || _('Invalid discovery response'));
					return reply;
				})),
				readSource('wifi', wifiStations),
				readSource('arp', () => fs.read('/proc/net/arp').then(model.parseArp))
			]);
			return Promise.all([ config, sources ]).then(results => {
				const data = Object.assign({ errors: [], discoveryComplete: true }, results[0]);
				for (const result of results[1]) {
					if (!result.ok) {
						data.errors.push(result.name + ': ' + result.error);
						data.discoveryComplete = false;
						continue;
					}
					if (result.name === 'wifi') {
						data.wifi = result.value.stations;
						data.discoveryComplete = data.discoveryComplete && result.value.complete;
						data.errors.push(...result.value.errors);
					} else data[result.name] = result.value;
				}
				return data;
			});
		}));
	},
	recoverPending: function() {
		if (!this.rollbackPending) return Promise.resolve();
		return callRevert(CONFIG).then(() => { this.rollbackPending = false; });
	},
	mutate: function(change) {
		return this.queue(() => {
			if (L.hasViewPermission() !== true) throw new Error(_('Read-only access'));
			let staged = false;
			return this.recoverPending().then(reloadConfig).then(change).then(() => {
				staged = true;
				return uci.save();
			}).then(() => callCommit(CONFIG)).catch(error => {
				if (!staged) throw error;
				this.rollbackPending = true;
				return this.recoverPending().then(() => { throw error; }, rollbackError => {
					throw new Error(_('%s; failed to discard pending changes: %s').format(error.message, rollbackError.message));
				});
			}).finally(() => uci.unload(CONFIG));
		});
	},
	saveDevice: function(mac, name, remark, group, type) {
		return this.mutate(() => {
			const normalized = model.normalizeMac(mac);
			if (!normalized) throw new Error(_('Enter a valid MAC address'));
			const deviceName = validateText(name, 64), deviceRemark = validateText(remark, 256);
			if (group && group !== 'ungrouped') requireGroup(group);
			const matches = uci.sections(CONFIG, 'device').filter(section => model.sectionMac(section) === normalized);
			const sid = matches.length ? matches[matches.length - 1]['.name'] : model.getSectionId(normalized);
			if (!matches.length) {
				if (uci.get(CONFIG, sid)) throw new Error(_('A conflicting configuration record exists'));
				uci.add(CONFIG, 'device', sid);
			}
			for (const section of matches) if (section['.name'] !== sid) uci.remove(CONFIG, section['.name']);
			uci.set(CONFIG, sid, 'mac', normalized);
			for (const [ key, value ] of Object.entries({ name: deviceName, remark: deviceRemark,
				group: group && group !== 'ungrouped' ? group : '',
				type: type && type !== 'auto' ? type : '' })) {
				if (value) uci.set(CONFIG, sid, key, value);
				else uci.unset(CONFIG, sid, key);
			}
		});
	},
	deleteDevice: function(device) {
		return this.mutate(() => {
			for (const section of uci.sections(CONFIG, 'device')) {
				if (model.sectionMac(section) === device.mac) uci.remove(CONFIG, section['.name']);
			}
		});
	},
	addGroup: function(name) {
		return this.mutate(() => {
			const text = validateGroupName(name);
			let id;
			do { id = 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); } while (uci.get(CONFIG, id));
			uci.add(CONFIG, 'group', id);
			uci.set(CONFIG, id, 'name', text);
		});
	},
	renameGroup: function(id, name) {
		return this.mutate(() => {
			requireGroup(id);
			uci.set(CONFIG, id, 'name', validateGroupName(name, id));
		});
	},
	deleteGroup: function(id) {
		return this.mutate(() => {
			requireGroup(id);
			uci.remove(CONFIG, id);
			for (const section of uci.sections(CONFIG, 'device')) {
				if (section.group === id) uci.unset(CONFIG, section['.name'], 'group');
			}
		});
	}
});
