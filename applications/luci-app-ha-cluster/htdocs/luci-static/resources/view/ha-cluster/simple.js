/*
 * Copyright (c) 2025-2026 Pierre Gaufillet <pierre.gaufillet@bergamote.eu>
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
'require network';
'require fs';
'require validation';

var callGetInterfaces = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { 'interface': [] }
});

var callGenerateKey = rpc.declare({
	object: 'ha-cluster',
	method: 'generate_key'
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('ha-cluster'),
			callGetInterfaces(),
			network.getDevices(),
			L.resolveDefault(fs.stat('/usr/sbin/lease-sync'), null),
			L.resolveDefault(fs.stat('/usr/bin/owsync'), null),
			L.resolveDefault(uci.load('dhcp'), null),
			L.resolveDefault(ui.menu.load(), null)
		]);
	},

	render: function(data) {
		var interfaces = data[1] || [];
		var netDevs = data[2] || [];
		var leaseSyncInstalled = data[3] != null;
		var owsyncInstalled = data[4] != null;
		// The Software page comes with luci-app-package-manager
		var softwarePage = [ 'admin', 'system', 'package-manager' ].reduce(function(node, name) {
			return (node && node.children) ? node.children[name] : null;
		}, data[6]);
		var transport = uci.get('ha-cluster', 'config', 'vrrp_transport') || 'multicast';
		var m, s, o;

		// Canonical form: no prefix length, IPv6 as its 16-bit words
		var addressKey = function(addr) {
			var ip = String(addr).split('/')[0];
			var words = validation.parseIPv6(ip);
			return words ? words.join(':') : ip;
		};

		var vipAddresses = {};
		uci.sections('ha-cluster', 'vip').forEach(function(vip) {
			if (vip.address)
				vipAddresses[addressKey(vip.address)] = true;
			if (vip.address6)
				vipAddresses[addressKey(vip.address6)] = true;
		});

		var isValidSourceAddress = function(addr) {
			if (addr.startsWith('127.') || addr === '::1')
				return false;
			if (addr.startsWith('fe80:'))
				return false;
			if (vipAddresses[addressKey(addr)])
				return false;
			return true;
		};

		var isIPv6 = function(addr) {
			return addr && addr.indexOf(':') !== -1;
		};

		// Deterministic VRID from instance name (DJB2 hash, range 1-127)
		var computeVrid = function(ifname) {
			var hash = 5381;
			for (var i = 0; i < ifname.length; i++)
				hash = ((hash << 5) + hash + ifname.charCodeAt(i)) & 0xffffffff;
			return ((hash >>> 0) % 127) + 1;
		};

		// UCI boolean as read by config_get_bool
		var getBool = function(value, dflt) {
			if (['1', 'on', 'true', 'yes', 'enabled'].indexOf(value) !== -1)
				return true;
			if (['0', 'off', 'false', 'no', 'disabled'].indexOf(value) !== -1)
				return false;
			return dflt;
		};

		var groupEnabled = function(group) {
			return getBool(group.enabled, true);
		};

		// Flag read as config_get_bool reads it, written when its meaning changes
		var boolFlag = function(o, dflt) {
			o.rmempty = false;
			o.cfgvalue = function(section_id) {
				return getBool(uci.get('ha-cluster', section_id, this.option), dflt) ? '1' : '0';
			};
			o.write = function(section_id, value) {
				if (this.cfgvalue(section_id) !== value)
					uci.set('ha-cluster', section_id, this.option, value);
			};
			return o;
		};

		// Full width in the flex option row, like the DHCP hint
		var installHint = function(text) {
			var hint = E('div', { 'class': 'alert-message warning', 'style': 'flex: 1' }, E('p', {}, text));
			if (softwarePage && softwarePage.satisfied)
				hint.appendChild(E('div', { 'class': 'right' }, E('a', { 'class': 'btn', 'href': L.url('admin/system/package-manager') }, _('Go to Software…'))));
			return hint;
		};

		var ifaceIconUrl = function(ifname) {
			var dev = null;
			for (var i = 0; i < netDevs.length; i++) {
				if (netDevs[i].getName && netDevs[i].getName() === ifname) {
					dev = netDevs[i];
					break;
				}
			}
			var type = dev ? dev.getType() : 'ethernet';
			return L.resource('icons/%s.svg').format(type);
		};

		m = new form.Map('ha-cluster', _('High Availability - General'),
			_('Configure a high availability cluster with 2 or more routers. Advanced options are available in the Advanced pages.'));

		s = m.section(form.NamedSection, 'config', 'global', _('Cluster Configuration'));
		s.anonymous = false;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable HA Cluster'),
			_('Enable high availability clustering on this router'));
		boolFlag(o, false);

		o = s.option(form.Value, 'node_priority', _('Priority'),
			_('VRRP priority (1-255). Higher priority becomes MASTER.'));
		o.datatype = 'range(1,255)';
		o.placeholder = '100';

		o = s.option(form.ListValue, 'vrrp_transport', _('VRRP Transport'),
			_('Multicast is the default. Use unicast when multicast is unavailable on the network. Unicast adverts go to the peers below, from the first Source Address set: this fits only failover groups on the peers\' network; another group sets its own unicast addresses in Advanced VRRP.'));
		o.value('multicast', _('Multicast'));
		o.value('unicast', _('Unicast'));
		o.default = 'multicast';

		var vrrpOnlyHelp = _('Tick for a router that does not run ha-cluster, for example a non-OpenWrt VRRP router. It is excluded from configuration and lease sync.') + ' ' +
			(transport === 'unicast'
				? _('In unicast mode keepalived still sends it VRRP adverts.')
				: _('In multicast mode VRRP does not use peer entries, so this entry only feeds the Status page.'));

		s = m.section(form.GridSection, 'peer', _('Peer Routers'),
			_('Other routers of the cluster. Configuration and lease sync run with every peer not marked VRRP only.') + ' ' +
			(transport === 'unicast'
				? _('In unicast mode, VRRP adverts are sent to every peer listed here, except for failover groups with their own unicast peers.')
				: _('In multicast mode, VRRP does not use this list.')));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;

		// Modal with its own Map (DDNS pattern); Add saves the main form first
		// so its pending changes survive the refresh
		s.handleAdd = function(ev) {
			var _this = this;
			var mainMap = this.map;

			var m2 = new form.Map('ha-cluster');
			var s2 = m2.section(form.NamedSection, '_new_');

			s2.render = function() {
				return Promise.all([
					{},
					this.renderUCISection('_new_')
				]).then(this.renderContents.bind(this));
			};

			var peerName = s2.option(form.Value, 'name', _('Peer Name'));
			peerName.rmempty = false;
			peerName.datatype = 'hostname';
			peerName.placeholder = 'router2';

			var peerAddress = s2.option(form.Value, 'address', _('Peer IP Address'));
			peerAddress.rmempty = false;
			peerAddress.datatype = 'ipaddr';
			peerAddress.placeholder = '192.168.1.2';

			var peerSource = s2.option(form.ListValue, 'source_address', _('Source Address'),
				_('Local IP to use when contacting this peer. Must match address family (IPv4/IPv6) of peer.'));
			peerSource.optional = true;
			peerSource.placeholder = _('unspecified');
			interfaces.forEach(function(iface) {
				(iface['ipv4-address'] || []).forEach(function(addr) {
					if (isValidSourceAddress(addr.address))
						peerSource.value(addr.address, addr.address + ' (' + iface.interface + ')');
				});
				(iface['ipv6-address'] || []).forEach(function(addr) {
					if (isValidSourceAddress(addr.address))
						peerSource.value(addr.address, addr.address + ' (' + iface.interface + ')');
				});
			});

			var peerVrrpOnly = s2.option(form.Flag, 'vrrp_only', _('VRRP only'), vrrpOnlyHelp);

			m2.render().then(function(nodes) {
				ui.showModal(_('Add Peer Router'), [
					nodes,
					E('div', { 'class': 'right' }, [
						E('button', {
							'type': 'button',
							'class': 'btn',
							'click': ui.hideModal
						}, _('Cancel')), ' ',
						E('button', {
							'type': 'button',
							'class': 'cbi-button cbi-button-positive',
							'click': function() {
								var nameVal = peerName.formvalue('_new_');
								var addrVal = peerAddress.formvalue('_new_');
								var sourceVal = peerSource.formvalue('_new_');
								var vrrpOnlyVal = peerVrrpOnly.formvalue('_new_');

								if (!nameVal || !addrVal) {
									ui.addNotification(null, E('p', _('Please fill in all fields')), 'warning');
									return;
								}

								if (sourceVal && isIPv6(addrVal) !== isIPv6(sourceVal)) {
									ui.addNotification(null, E('p', _('Address family mismatch: peer and source must both be IPv4 or both be IPv6')), 'warning');
									return;
								}

								mainMap.save(function() {
									uci.add('ha-cluster', 'peer');
									var sections = uci.sections('ha-cluster', 'peer');
									var newSection = sections[sections.length - 1]['.name'];
									uci.set('ha-cluster', newSection, 'name', nameVal);
									uci.set('ha-cluster', newSection, 'address', addrVal);
									if (sourceVal)
										uci.set('ha-cluster', newSection, 'source_address', sourceVal);
									if (vrrpOnlyVal === '1')
										uci.set('ha-cluster', newSection, 'vrrp_only', '1');
								}).then(function() {
									ui.hideModal();
									return mainMap.load();
								}).then(function() {
									return mainMap.reset();
								}).catch(function(err) {
									ui.hideModal();
									ui.addNotification(null,
										E('p', {}, _('Failed to add peer: ') + err.message),
										'danger');
								});
							}
						}, _('Add'))
					])
				], 'cbi-modal');
			});
		};

		o = s.option(form.DummyValue, '_display', _('Peer'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var name = uci.get('ha-cluster', section_id, 'name') || '-';
			var addr = uci.get('ha-cluster', section_id, 'address') || '';
			return name + (addr ? ' (' + addr + ')' : '');
		};

		o = s.option(form.DummyValue, '_role', _('Role'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			return getBool(uci.get('ha-cluster', section_id, 'vrrp_only'), false)
				? _('VRRP only') : _('Cluster node');
		};

		o = s.option(form.Value, 'name', _('Peer Name'));
		o.placeholder = 'router2';
		o.datatype = 'hostname';
		o.rmempty = false;
		o.modalonly = true;

		var addrOpt = s.option(form.Value, 'address', _('Peer IP Address'));
		addrOpt.datatype = 'ipaddr';
		addrOpt.placeholder = '192.168.1.2';
		addrOpt.rmempty = false;
		addrOpt.modalonly = true;
		var srcOpt = s.option(form.ListValue, 'source_address', _('Source Address'),
			_('Local IP to use when contacting this peer. Must match address family (IPv4/IPv6) of peer.'));
		interfaces.forEach(function(iface) {
			(iface['ipv4-address'] || []).forEach(function(addr) {
				if (isValidSourceAddress(addr.address))
					srcOpt.value(addr.address, addr.address + ' (' + iface.interface + ')');
			});
			(iface['ipv6-address'] || []).forEach(function(addr) {
				if (isValidSourceAddress(addr.address))
					srcOpt.value(addr.address, addr.address + ' (' + iface.interface + ')');
			});
		});
		srcOpt.optional = true;
		srcOpt.placeholder = _('unspecified');
		srcOpt.modalonly = true;

		addrOpt.validate = function(section_id, value) {
			var src = this.map.lookupOption('source_address', section_id);
			var srcval = src ? src[0].formvalue(section_id) : '';
			if (value && srcval) {
				var peerIsV6 = value.indexOf(':') !== -1;
				var sourceIsV6 = srcval.indexOf(':') !== -1;
				if (peerIsV6 !== sourceIsV6)
					return _('Family mismatch: both must be IPv4 or both IPv6');
			}
			return true;
		};

		srcOpt.validate = function(section_id, value) {
			var addr = this.map.lookupOption('address', section_id);
			var addrval = addr ? addr[0].formvalue(section_id) : '';
			if (value && addrval) {
				var peerIsV6 = addrval.indexOf(':') !== -1;
				var sourceIsV6 = value.indexOf(':') !== -1;
				if (peerIsV6 !== sourceIsV6)
					return _('Family mismatch: both must be IPv4 or both IPv6');
			}
			return true;
		};

		o = s.option(form.Flag, 'vrrp_only', _('VRRP only'), vrrpOnlyHelp);
		boolFlag(o, false);
		o.modalonly = true;

		s = m.section(form.GridSection, 'vip', _('Virtual IP Addresses'),
			_('All VIPs share a single failover group and switch together. Use the Advanced page to create independent failover groups.') + ' ' +
			_('Multicast VRRP adds a second instance with VRID+128 for the IPv6 addresses. Unicast VRRP runs one instance in the family of the unicast addresses, and the other family fails over with it.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.addbtntitle = _('Add VIP...');

		// Drop the vrrp_instance once its last VIP is removed
		s.handleRemove = function(section_id, ev) {
			var instName = uci.get('ha-cluster', section_id, 'vrrp_instance') || '';

			uci.remove('ha-cluster', section_id);

			if (instName) {
				var hasVips = uci.sections('ha-cluster', 'vip').some(function(vip) {
					return vip.vrrp_instance === instName;
				});
				if (!hasVips)
					uci.remove('ha-cluster', instName);
			}

			return this.map.save(null, true).catch(function(err) {
				ui.addNotification(null,
					E('p', {}, _('Failed to save: ') + err.message),
					'danger');
			});
		};

		o = s.option(form.DummyValue, '_interface_display', _('Interface'));
		o.textvalue = function(section_id) {
			var ifname = uci.get('ha-cluster', section_id, 'interface') || '';
			return E('span', {}, [
				E('img', { 'src': ifaceIconUrl(ifname), 'style': 'width:16px;height:16px;vertical-align:middle;margin-right:4px' }),
				E('span', {}, ifname || '-')
			]);
		};
		o.modalonly = false;

		o = s.option(form.DummyValue, '_vrid_display', _('VRID'));
		o.textvalue = function(section_id) {
			var inst = uci.get('ha-cluster', section_id, 'vrrp_instance') || '';
			if (!inst) return '-';
			return uci.get('ha-cluster', inst, 'vrid') || '-';
		};
		o.modalonly = false;

		o = s.option(form.DummyValue, '_ipv4_display', _('IPv4 Address'));
		o.textvalue = function(section_id) {
			var addr = uci.get('ha-cluster', section_id, 'address');
			if (addr) return addr;
			return E('em', {}, _('none'));
		};
		o.modalonly = false;

		o = s.option(form.DummyValue, '_ipv6_display', _('IPv6 Address'));
		o.textvalue = function(section_id) {
			var addr6 = uci.get('ha-cluster', section_id, 'address6');
			if (addr6) return addr6;
			return E('em', {}, _('none'));
		};
		o.modalonly = false;

		o = s.option(form.DummyValue, '_enabled_display', _('Enable'));
		o.textvalue = function(section_id) {
			return getBool(uci.get('ha-cluster', section_id, 'enabled'), true) ? _('Yes') : _('No');
		};
		o.modalonly = false;

		o = s.option(form.ListValue, 'interface', _('Interface'));
		o.rmempty = false;
		o.modalonly = true;
		if (interfaces && interfaces.length) {
			var seen = {};
			interfaces.forEach(function(iface) {
				if (iface.interface && iface.interface !== 'loopback') {
					var ifname = iface.interface;
					if (seen[ifname]) return;
					seen[ifname] = true;
					var device = iface.device || ifname;
					o.value(ifname, ifname + (device !== ifname ? ' (' + device + ')' : ''));
				}
			});
		}
		o.cfgvalue = function(section_id) {
			var ifname = uci.get('ha-cluster', section_id, 'interface');
			if (ifname && !(this.keylist || []).includes(ifname)) {
				this.value(ifname, ifname);
			}
			return ifname;
		};
		o.write = function(section_id, value) {
			uci.set('ha-cluster', section_id, 'interface', value);

			var instName = 'main';
			var exists = uci.sections('ha-cluster', 'vrrp_instance').some(function(inst) {
				return inst['.name'] === instName;
			});
			if (!exists) {
				var globalPriority = uci.get('ha-cluster', 'config', 'node_priority') || '100';
				var defaultIface = '';
				var ifaceList = interfaces || [];
				for (var i = 0; i < ifaceList.length; i++) {
					if (ifaceList[i].interface === 'lan') { defaultIface = 'lan'; break; }
				}
				uci.add('ha-cluster', 'vrrp_instance', instName);
				uci.set('ha-cluster', instName, 'vrid', String(computeVrid(instName)));
				if (defaultIface)
					uci.set('ha-cluster', instName, 'interface', defaultIface);
				uci.set('ha-cluster', instName, 'priority', globalPriority);
				uci.set('ha-cluster', instName, 'nopreempt', '1');
				uci.set('ha-cluster', instName, 'advert_int', '1');
			}
			uci.set('ha-cluster', section_id, 'vrrp_instance', instName);
		};

		o = s.option(form.Value, 'address', _('Virtual IP Address (IPv4)'));
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.254';
		o.rmempty = true;
		o.modalonly = true;
		o.description = _('Optional. You can configure IPv4 only, IPv6 only, or both (dual-stack).');
		o.validate = function(section_id, value) {
			var addr6 = this.map.lookupOption('address6', section_id);
			var addr6val = addr6 ? addr6[0].formvalue(section_id) : '';
			if (!value && !addr6val)
				return _('At least one of IPv4 or IPv6 address must be set');
			return true;
		};

		o = s.option(form.Value, 'netmask', _('Netmask'));
		o.datatype = 'ip4addr';
		o.placeholder = '255.255.255.0';
		o.modalonly = true;
		o.depends({ address: /.+/ });

		o = s.option(form.Value, 'address6', _('Virtual IP Address (IPv6)'));
		o.datatype = 'ip6addr';
		o.placeholder = 'fd00::1';
		o.rmempty = true;
		o.modalonly = true;
		o.description = _('Optional. Multicast VRRP advertises it in a second instance with VRID+128; unicast VRRP fails it over with the single instance.');
		o.validate = function(section_id, value) {
			var addr = this.map.lookupOption('address', section_id);
			var addrval = addr ? addr[0].formvalue(section_id) : '';
			if (!value && !addrval)
				return _('At least one of IPv4 or IPv6 address must be set');
			return true;
		};

		o = s.option(form.Value, 'prefix6', _('IPv6 Prefix Length'));
		o.datatype = 'range(1,128)';
		o.placeholder = '64';
		o.modalonly = true;
		o.depends({ address6: /.+/ });

		o = s.option(form.Flag, 'enabled', _('Enable'));
		boolFlag(o, true);
		o.modalonly = true;

		s = m.section(form.NamedSection, 'config', 'global', _('Synchronization'),
			_('Keeps configuration files and DHCP leases identical on the cluster nodes. These settings must be the same on every node.'));

		var encryption_key_option = s.option(form.Value, 'encryption_key', _('Encryption Key'),
			_('256-bit AES key (64 hexadecimal characters), used for both configuration and lease sync. Must be identical on all nodes. Leave empty to sync in plaintext.'));
		encryption_key_option.password = true;
		encryption_key_option.datatype = 'and(hexstring,rangelength(64,64))';
		encryption_key_option.rmempty = true;
		encryption_key_option.placeholder = _('Click "Generate New Key" below to create a secure random key');

		o = s.option(form.Button, '_generate_key', _('Generate New Key'));
		o.inputtitle = _('Generate New Key');
		o.inputstyle = 'action';
		o.onclick = function(ev, section_id) {
			ui.showModal(_('Generating encryption key...'), [
				E('p', { 'class': 'spinning' }, _('Generating secure random key...'))
			], 'wait');

			L.resolveDefault(callGenerateKey(), {}).then(function(result) {
				ui.hideModal();

				if (result && result.success && result.key) {
					var uiEl = encryption_key_option.getUIElement(section_id);
					if (uiEl) {
						uiEl.setValue(result.key);
					}

					ui.showModal(_('Encryption Key Generated'), [
						E('p', {}, _('Encryption key generated successfully!')),
						E('p', { 'class': 'alert-message warning' }, [
							E('strong', {}, _('IMPORTANT:')),
							' ',
							_('Copy this key to all cluster nodes.')
						]),
						E('pre', {
							'style': 'padding: 10px; border: 1px solid; border-radius: 4px; user-select: all; font-family: monospace; word-break: break-all;'
						}, result.key),
						E('p', { 'style': 'margin-top: 1em;' }, _('Click the key above to select it.')),
						E('div', { 'class': 'alert-message info', 'style': 'margin-top: 1em;' }, [
							E('strong', {}, _('Next steps:')),
							E('ol', { 'style': 'margin: 0.5em 0;' }, [
								E('li', {}, _('Save & Apply changes on this router')),
								E('li', {}, _('On each peer router, go to: Services → High Availability → General → Synchronization')),
								E('li', {}, _('Paste this key into the "Encryption Key" field')),
								E('li', {}, _('Save & Apply on all peer routers'))
							])
						]),
						E('div', { 'class': 'right' }, [
							E('button', {
								'type': 'button',
								'class': 'btn cbi-button-positive',
								'click': ui.hideModal
							}, _('Close'))
						])
					]);

					if (navigator.clipboard && navigator.clipboard.writeText) {
						navigator.clipboard.writeText(result.key).then(function() {
							ui.addNotification(null, E('p', {}, _('Key copied to clipboard')), 'info');
						}).catch(function(err) {
							console.warn('Clipboard write failed (key still visible in modal):', err);
						});
					}
				} else {
					ui.addNotification(null,
						E('p', {}, _('Failed to generate key: ') + (result.error || _('Unknown error'))),
						'danger');
				}
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null,
					E('p', {}, _('Error generating key: ') + err.message),
					'danger');
			});
		};

		var groups = uci.sections('ha-cluster', 'sync_group');

		// Same rule as the backend: an authoritative dnsmasq while several
		// nodes serve DHCP. Shown once, under the DHCP config sync when it
		// applies, else under lease sync
		var hasSyncPeer = uci.sections('ha-cluster', 'peer').some(function(peer) {
			return !getBool(peer.vrrp_only, false) && !!peer.address;
		});
		var dhcpGroup = uci.get('ha-cluster', 'dhcp');
		var dhcpFiles = dhcpGroup ? L.toArray(dhcpGroup.config_files) : [];
		var hintUnderDhcp = owsyncInstalled && hasSyncPeer && dhcpGroup != null &&
			dhcpGroup['.type'] === 'sync_group' && groupEnabled(dhcpGroup) &&
			dhcpFiles.length > 0;
		var leaseSyncActive = leaseSyncInstalled && hasSyncPeer &&
			getBool(uci.get('ha-cluster', 'config', 'lease_sync'), false);
		var dhcpAuthoritative = uci.sections('dhcp', 'dnsmasq').some(function(dnsmasq) {
			return getBool(dnsmasq.authoritative, false);
		});
		var authoritativeConflict = getBool(uci.get('ha-cluster', 'config', 'enabled'), false) &&
			dhcpAuthoritative && (hintUnderDhcp || leaseSyncActive);
		var authoritativeHint = function() {
			if (!authoritativeConflict)
				return;
			o = s.option(form.DummyValue, '_dhcp_authoritative');
			o.renderWidget = function() {
				// Full width in the flex option row, like the theme's banners
				return E('div', { 'class': 'alert-message warning', 'style': 'flex: 1' }, [
					E('h4', {}, _('dnsmasq is authoritative')),
					E('p', {}, _('Several nodes serve DHCP, so an authoritative dnsmasq rejects the clients of the other nodes. Turn off Authoritative in DHCP and DNS on every node.')),
					E('div', { 'class': 'right' }, E('a', { 'class': 'btn', 'href': L.url('admin/network/dhcp') }, _('Go to DHCP and DNS…')))
				]);
			};
		};

		s = m.section(form.NamedSection, 'config', 'global', _('Configuration Files'));

		if (owsyncInstalled) {
			// Maps to sync_group.<name>.enabled; the group is created when first enabled
			var groupFlag = function(name, title, description) {
				var o = s.option(form.Flag, '_group_' + name, title, description);
				o.rmempty = false;
				o.cfgvalue = function() {
					var group = uci.get('ha-cluster', name);
					return (group && groupEnabled(group)) ? '1' : '0';
				};
				o.write = function(section_id, value) {
					if (!uci.get('ha-cluster', name)) {
						if (value === '1') {
							uci.add('ha-cluster', 'sync_group', name);
							uci.set('ha-cluster', name, 'enabled', '1');
							uci.set('ha-cluster', name, 'config_files', [ name ]);
						}
					} else if (this.cfgvalue(section_id) !== value) {
						uci.set('ha-cluster', name, 'enabled', value);
					}
				};
				return o;
			};

			groupFlag('dhcp', _('DHCP and DNS'),
				_('<code>/etc/config/dhcp</code>: address pools, static leases, DNS settings.'));
			if (hintUnderDhcp)
				authoritativeHint();
			groupFlag('firewall', _('Firewall'),
				_('<code>/etc/config/firewall</code>: zones, rules, port forwards. Review the rules before enabling: they apply to every node.'));
		} else {
			var enabledGroups = groups.filter(groupEnabled).length;
			o = s.option(form.DummyValue, '_owsync_missing');
			o.renderWidget = function() {
				return installHint(_('owsync is not installed. Install the <code>owsync</code> package to synchronize configuration files.') +
					(enabledGroups ? ' ' + N_(enabledGroups,
						'The enabled sync group in the configuration will apply once it is installed.',
						'The %d enabled sync groups in the configuration will apply once it is installed.').format(enabledGroups) : ''));
			};
		}

		s = m.section(form.NamedSection, 'config', 'global', _('DHCP Leases'));

		if (leaseSyncInstalled) {
			o = s.option(form.Flag, 'lease_sync', _('Real-time Lease Sync'),
				_('Replicates DHCP leases between nodes so that clients keep their address after a failover. Independent of the DHCP configuration sync above.'));
			o.rmempty = false;
			o.cfgvalue = function(section_id) {
				return getBool(uci.get('ha-cluster', section_id, 'lease_sync'), false) ? '1' : '0';
			};
			o.write = function(section_id, value) {
				if (this.cfgvalue(section_id) !== value)
					uci.set('ha-cluster', section_id, 'lease_sync', value);
			};
		} else {
			o = s.option(form.DummyValue, '_lease_sync_missing');
			o.renderWidget = function(section_id) {
				return installHint(_('lease-sync is not installed. Install the <code>lease-sync</code> package to synchronize DHCP leases.') +
					(getBool(uci.get('ha-cluster', section_id, 'lease_sync'), false)
						? ' ' + _('Lease sync is on in the configuration and will start once it is installed.') : ''));
			};
		}

		if (!hintUnderDhcp)
			authoritativeHint();

		return m.render();
	}
});
