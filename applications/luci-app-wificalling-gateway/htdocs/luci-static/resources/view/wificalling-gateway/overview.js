'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require uci';
'require dom';
'require ui';
'require rpc';
'require wificalling-gateway.node-import as nodeImport';

var nodeTestRpc = rpc.declare({
	object: 'luci.wificalling-gateway',
	method: 'node_test',
	params: ['id'],
	expect: {}
});

return view.extend({
	load: function() {
		return uci.load('dhcp').then(function() {
			// dnsmasq's lease file is a UCI option; read the same location
			// dhcp-sync.sh binds from, so the status column never
			// contradicts the actual bindings on routers that move the
			// lease file (e.g. to persist across reboots).
			var leasefile = uci.get('dhcp', '@dnsmasq[0]', 'leasefile') || '/tmp/dhcp.leases';
			return Promise.all([
				L.resolveDefault(fs.read('/var/run/wificalling-gateway/node-status.json'), '{}'),
				uci.load('wificalling-gateway'),
				L.resolveDefault(fs.read(leasefile), ''),
				L.resolveDefault(fs.read('/proc/net/arp'), '')
			]);
		});
	},
	render: function(data) {
		var nodeParsed;
		try { nodeParsed = JSON.parse(data[0]); } catch (e) { nodeParsed = { nodes: [] }; }
		function nodeById(id, source) {
			var nodes = (source || nodeParsed).nodes || [];
			for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
			return null;
		}
		function quality(n) {
			if (!n) return '-';
			if (n.state === 'handshake_ok') return _('Good');
			if (n.state === 'handshake_failed') return _('Offline');
			if (n.state === 'unreachable') return _('Offline');
			// ping_ms may arrive as a JSON number or a quoted string
			// (WireGuard handshake rows carry the verified exit IP).
			var ms = parseFloat(n.ping_ms);
			if (isNaN(ms)) return _('Unknown');
			if (ms <= 100) return _('Excellent');
			if (ms <= 200) return _('Good');
			if (ms <= 300) return _('Fair');
			return _('Poor');
		}
		function nodeState(n) {
			if (!n) return '-';
			if (n.state === 'handshake_ok' || n.state === 'reachable' || n.state === 'tcp_reachable') return _('Alive');
			if (n.state === 'testing') return _('Test in progress');
			if (n.state === 'handshake_failed' || n.state === 'unreachable') return _('Offline');
			return _('Unknown');
		}
		// Short reason label and full explanation for failed WG handshakes
		// (reason comes from node-health.sh's cache: config_missing /
		// timeout / unreachable).
		function wgFailReason(reason) {
			if (reason === 'config_missing') return _('Missing config');
			if (reason === 'timeout') return _('Timeout');
			if (reason === 'unreachable') return _('Unreachable');
			if (reason === 'busy') return _('Test in progress');
			return reason || '';
		}
		function wgFailDetail(reason) {
			if (reason === 'config_missing') return _('Missing key/address');
			if (reason === 'timeout') return _('Handshake timed out (key/psk mismatch?)');
			if (reason === 'unreachable') return _('Server unreachable');
			if (reason === 'busy') return _('Another test is running right now');
			return '';
		}
		// Banner-style notification with an optional detail suffix.
		function testNotify(message, kind, detail) {
			var p = E('p', {}, message);
			if (detail)
				p.appendChild(E('em', {}, ' — ' + detail));
			ui.addNotification(null, p, kind);
		}
		// Manual connection test for one node: fresh WG handshake (bypasses
		// the monitor's 60 s cache) or a TCP reachability probe.
		function runNodeTest(id, btn) {
			if (btn.disabled) return;
			btn.disabled = true;
			var original = btn.textContent;
			btn.textContent = _('Testing…');
			nodeTestRpc(id).then(function(r) {
				btn.disabled = false;
				btn.textContent = original;
				if (r && r.state === 'handshake_ok') {
					testNotify(_('Handshake OK') + ' — ' + r.exit_ip, 'info');
				}
				else if (r && r.state === 'handshake_failed') {
					testNotify(_('Handshake failed') + ' (' + wgFailReason(r.reason) + ')', 'error', wgFailDetail(r.reason));
				}
				else if (r && r.state === 'tcp_reachable') {
					testNotify(_('Alive') + (r.ping_ms ? ' — ' + r.ping_ms + ' ms' : ''), 'info');
				}
				else if (r && r.state === 'unreachable') {
					testNotify(_('Offline'), 'error');
				}
				else {
					testNotify(_('Unable to test node: ') + wgFailReason(r && r.reason), 'error');
				}
			}).catch(function(e) {
				btn.disabled = false;
				btn.textContent = original;
				testNotify(_('Unable to test node: ') + String(e), 'error');
			});
		}
		function latency(n) {
			if (!n) return '-';
			// WireGuard handshake rows carry the verified exit IP instead
			// of an ICMP latency.
			if (n.measurement === 'wg_handshake') return n.ping_ms || '-';
			return n.ping_ms != null ? n.ping_ms + ' ms (' + n.measurement + ')' : '-';
		}
		// Live DHCP lease map (IP -> MAC) and plugin-managed static bindings
		// (wfc_ host sections) for the device policy status column.  dnsmasq
		// lease lines are: expiry MAC IP hostname clientid.
		var leaseMac = {}, leaseHost = {};
		(data[2] || '').split('\n').forEach(function(line) {
			var p = line.split(/\s+/);
			if (p.length >= 4 && /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(p[2])) {
				leaseMac[p[2]] = p[1];
				if (p[3] && p[3] !== '*')
					leaseHost[p[2]] = p[3];
			}
		});
		// Devices seen in the ARP cache but not in the DHCP leases (static
		// IPs, or a router that does not run DHCP at all) still show up in
		// the connected-devices picker and count as online.
		var arpDevices = {};
		(data[3] || '').split('\n').slice(1).forEach(function(line) {
			var p = line.trim().split(/\s+/);
			if (p.length >= 4 && /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(p[0])
				&& /^[0-9a-fA-F:]+$/.test(p[2]))
				arpDevices[p[0]] = p[2];
		});
		var wfcHost = {};
		uci.sections('dhcp', 'host').forEach(function(h) {
			if ((h['.name'] || '').indexOf('wfc_') === 0 && h.ip)
				wfcHost[h.ip] = { mac: h.mac || '', name: h.name || '' };
		});
		function dhcpState(ip) {
			var mac = leaseMac[ip], host = wfcHost[ip];
			if (host && host.mac && mac && host.mac.toLowerCase() === mac.toLowerCase()) return _('Bound');
			if (host && host.mac && mac) return _('MAC changed, rebind on reconnect');
			if (mac) return _('Not bound yet');
			// No DHCP lease (static IP, or a router that does not run DHCP
			// at all, e.g. a secondary/AP router): the ARP cache is the only
			// liveness source, so a recently-seen device is online, not
			// offline.  Only report offline when neither source knows it.
			if (arpDevices[ip]) return _('Online (static IP)');
			return _('Device offline');
		}
		// The router's LAN subnet hint for the IP placeholder, derived from
		// the address the admin uses to reach LuCI (e.g. 192.168.31.x).
		function lanSubnetHint() {
			var host = location.hostname || '';
			if (/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(host)) {
				var parts = host.split('.');
				return parts.slice(0, 3).join('.') + '.x';
			}
			return '192.168.x.x';
		}
		// Connected LAN devices (DHCP hostname when known, ARP-only entries
		// otherwise) for the add-device picker; the router itself and IPs
		// already bound to a device policy are excluded.
		var detected = {};
		Object.keys(leaseHost).forEach(function(ip) {
			detected[ip] = { name: leaseHost[ip], mac: leaseMac[ip] };
		});
		Object.keys(arpDevices).forEach(function(ip) {
			if (!detected[ip])
				detected[ip] = { name: '', mac: arpDevices[ip] };
		});
		var routerHost = (location.hostname || '').toLowerCase();
		var boundIps = {};
		uci.sections('wificalling-gateway', 'device').forEach(function(d) {
			L.toArray(d.source_ip).forEach(function(ip) { boundIps[ip] = true; });
		});
		var detectedDevices = Object.keys(detected)
			.filter(function(ip) {
				return ip !== routerHost && !boundIps[ip];
			})
			.map(function(ip) { return { ip: ip, name: detected[ip].name }; })
			.sort(function(a, b) {
				var na = (a.name || a.ip).toLowerCase(), nb = (b.name || b.ip).toLowerCase();
				return na < nb ? -1 : (na > nb ? 1 : 0);
			});

		// Parse a standard WireGuard config block ([Interface]/[Peer]) into
		// the same node object the link importer produces, so a conf file
		// can be pasted directly instead of being converted to wg:// first.
		function parseWireguardConf(text) {
			var section = null, iface = {}, peer = {};
			text.split('\n').forEach(function(line) {
				var t = line.trim();
				if (t === '[Interface]') { section = 'iface'; return; }
				if (t === '[Peer]') { section = 'peer'; return; }
				if (!section || !t || t.indexOf('#') === 0) return;
				var eq = t.indexOf('=');
				if (eq < 0) return;
				var key = t.slice(0, eq).trim(), val = t.slice(eq + 1).trim();
				if (section === 'iface') iface[key] = val; else peer[key] = val;
			});
			if (!iface.PrivateKey || !iface.Address || !peer.PublicKey || !peer.Endpoint)
				throw new Error(_('WireGuard conf needs PrivateKey, Address, Peer PublicKey and Endpoint'));
			var endpoint = peer.Endpoint.trim().split(':');
			if (endpoint.length !== 2 || !/^[0-9]+$/.test(endpoint[1]))
				throw new Error(_('Invalid WireGuard endpoint: ') + peer.Endpoint);
			return {
				enabled: '1', protocol: 'wireguard',
				label: 'WireGuard ' + endpoint[0],
				server: endpoint[0], port: endpoint[1],
				public_key: peer.PublicKey,
				private_key: iface.PrivateKey,
				local_address: iface.Address.split(',')[0].trim(),
				reserved: iface.Reserved || '',
				mtu: iface.MTU || '',
				pre_shared_key: peer.PresharedKey || ''
			};
		}

		var m = new form.Map('wificalling-gateway', _('Wi-Fi Calling Gateway settings'),
			_('Configure proxy nodes and assign fixed LAN devices. Monitoring and logs are available from the submenu.'));
		var importPanel = E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Import proxy node')),
			E('p', {}, _('Paste one AnyTLS, Hysteria2/Hy2, TUIC, VLESS, VMess, Trojan, or WireGuard link (wg:// or an [Interface]/[Peer] config block). It is parsed locally in this browser and is not sent to an external service.')),
			E('button', { class: 'btn cbi-button-positive', click: function() {
				var input = E('textarea', { class: 'cbi-input-textarea', rows: 6, style: 'width:100%', placeholder: 'anytls://…' });
				ui.showModal(_('Import node link'), [input, E('div', { class: 'right' }, [
					E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
					E('button', { class: 'btn cbi-button-positive', click: function() {
						var parsed;
						try {
							parsed = /^\s*\[Interface\]/m.test(input.value)
								? parseWireguardConf(input.value)
								: nodeImport.parse(input.value);
						}
						catch (err) { ui.addNotification(null, E('p', {}, _('Unable to parse node link:') + ' ' + err.message), 'error'); return; }
						var sid = uci.add('wificalling-gateway', 'node');
						Object.keys(parsed).forEach(function(key) { if (parsed[key] !== '') uci.set('wificalling-gateway', sid, key, parsed[key]); });
						uci.save().then(function() {
							ui.hideModal();
							ui.addNotification(null, E('p', {}, _('Node imported successfully. Reloading settings…')), 'info');
							window.setTimeout(function() { window.location.reload(); }, 500);
						}).catch(function(err) { ui.addNotification(null, E('p', {}, _('Unable to save imported node:') + ' ' + err.message), 'error'); });
					} }, _('Import'))
				])]);
			} }, _('Import node link'))
		]);
		var s = m.section(form.NamedSection, 'main', 'global', _('General'));
		s.option(form.Flag, 'enabled', _('Enable'));
		var logLevel = s.option(form.ListValue, 'log_level', _('Log level'));
		logLevel.value('warn', _('Warning')); logLevel.value('info', _('Information')); logLevel.value('debug', _('Debug'));
		var logEnabled = s.option(form.Flag, 'log_enabled', _('Activity log'));
		logEnabled.default = '1';
		logEnabled.description = _('Record handshake outcomes and sustained encrypted communication. Turn off to stop writing the activity log.');
		var eventInterval = s.option(form.Value, 'event_interval', _('Sustained activity log interval (seconds)'));
		eventInterval.datatype = 'range(30,3600)'; eventInterval.default = '60';
		eventInterval.depends('log_enabled', '1');
		eventInterval.description = _('Continuous traffic is aggregated and written at most once per interval.');
		var maxEvents = s.option(form.Value, 'max_events_per_device', _('Maximum records per device'));
		maxEvents.datatype = 'range(1,500)'; maxEvents.default = '20';
		maxEvents.depends('log_enabled', '1');
		maxEvents.description = _('Each device keeps its own newest records, so one device cannot fill the entire log.');

		s = m.section(form.GridSection, 'node', _('Proxy nodes'));
		s.addremove = true; s.nodescriptions = true; s.anonymous = true; s.addbtntitle = _('Add proxy node');
		s.sectiontitle = function(id) { return uci.get('wificalling-gateway', id, 'label') || id; };
		s.option(form.Flag, 'enabled', _('Enable')).default = '1';
		var nodeLabel = s.option(form.Value, 'label', _('Node display name'));
		nodeLabel.rmempty = false; nodeLabel.placeholder = _('Example: UK AnyTLS');
		nodeLabel.description = _('This name is shown in the device node selector.');
		// The GridSection already renders a Name column from the section
		// title; showing the label field again would duplicate it.
		nodeLabel.modalonly = true;
		var p = s.option(form.ListValue, 'protocol', _('Protocol'));
		['anytls','hysteria2','tuic','vless','vmess','trojan','wireguard'].forEach(function(x) { p.value(x); });
		s.option(form.Value, 'server', _('Server')).datatype = 'host';
		s.option(form.Value, 'port', _('Port')).datatype = 'port';
		var nodeStatus = s.option(form.DummyValue, '_node_status', _('Node status'));
		nodeStatus.textvalue = function(id) {
			var n = nodeById(id);
			var detail = (n && n.state === 'handshake_failed') ? wgFailDetail(n.reason) : '';
			return E('span', { id: 'wfc-node-state-' + id, title: detail || null }, nodeState(n));
		};
		var nodePing = s.option(form.DummyValue, '_node_ping', _('Ping / latency'));
		nodePing.textvalue = function(id) { return E('span', { id: 'wfc-node-ping-' + id }, latency(nodeById(id))); };
		var nodeQuality = s.option(form.DummyValue, '_node_quality', _('Quality'));
		nodeQuality.textvalue = function(id) { return E('span', { id: 'wfc-node-quality-' + id }, quality(nodeById(id))); };
		// Every remaining field stays editable in the per-node modal but
		// is hidden from the table so rows stay compact (Edit shows them).
		var secret = s.option(form.Value, 'password', _('Password'));
		secret.password = true; secret.textvalue = function(id) { return this.cfgvalue(id) ? _('Set') : _('Not set'); };
		secret.modalonly = true;
		var uuidField = s.option(form.Value, 'uuid', _('UUID'));
		uuidField.password = true; uuidField.textvalue = function(id) { return this.cfgvalue(id) ? _('Set') : _('Not set'); };
		uuidField.modalonly = true;
		var sniOpt = s.option(form.Value, 'sni', _('TLS server name'));
		sniOpt.modalonly = true;
		var securityOpt = s.option(form.ListValue, 'security', _('Security'));
		securityOpt.value('', _('None')); securityOpt.value('tls'); securityOpt.value('reality');
		securityOpt.depends('protocol', 'vless');
		securityOpt.depends('protocol', 'vmess');
		// The compiler has no reality arm for VMess; selecting it would emit a
		// cleartext outbound that sing-box check accepts. Reject it up front.
		securityOpt.validate = function(section_id, value) {
			if (value == 'reality' && this.section.formvalue(section_id, 'protocol') == 'vmess')
				return _('Reality security is not available for VMess nodes');
			return true;
		};
		securityOpt.modalonly = true;
		var insecureOpt = s.option(form.Flag, 'insecure', _('Allow insecure certificate'));
		insecureOpt.modalonly = true;
		var alpnOpt = s.option(form.Value, 'alpn', _('ALPN'));
		alpnOpt.modalonly = true;
		var pinOpt = s.option(form.Value, 'pin_sha256', _('TLS public-key SHA-256 (base64)'));
		pinOpt.modalonly = true;
		var flowOpt = s.option(form.Value, 'flow', _('VLESS flow'));
		flowOpt.modalonly = true;
		var pubKeyOpt = s.option(form.Value, 'public_key', _('Reality public key'));
		pubKeyOpt.modalonly = true;
		var shortIdOpt = s.option(form.Value, 'short_id', _('Reality short ID'));
		shortIdOpt.modalonly = true;
		var fpOpt = s.option(form.Value, 'fingerprint', _('Reality fingerprint'));
		fpOpt.modalonly = true;
		var udpMode = s.option(form.ListValue, 'udp_mode', _('TUIC UDP mode'));
		udpMode.value('native', _('Native')); udpMode.value('quic', _('QUIC'));
		udpMode.modalonly = true;
		var transport = s.option(form.ListValue, 'transport', _('Transport'));
		transport.value('', _('None')); transport.value('ws', _('WebSocket'));
		transport.modalonly = true;
		var pathOpt = s.option(form.Value, 'path', _('WebSocket path'));
		pathOpt.modalonly = true;
		var hostOpt = s.option(form.Value, 'host', _('WebSocket Host'));
		hostOpt.modalonly = true;
		var wgKey = s.option(form.Value, 'private_key', _('WireGuard private key'));
		wgKey.password = true; wgKey.textvalue = function(id) { return this.cfgvalue(id) ? _('Set') : _('Not set'); };
		wgKey.modalonly = true;
		var localAddrOpt = s.option(form.Value, 'local_address', _('WireGuard local address'));
		localAddrOpt.modalonly = true;
		var reservedOpt = s.option(form.Value, 'reserved', _('WireGuard reserved (comma-separated)'));
		reservedOpt.modalonly = true;
		var mtuOpt = s.option(form.Value, 'mtu', _('WireGuard MTU'));
		mtuOpt.modalonly = true;
		var wgPsk = s.option(form.Value, 'pre_shared_key', _('WireGuard preshared key'));
		wgPsk.password = true; wgPsk.depends('protocol', 'wireguard');
		wgPsk.textvalue = function(id) { return this.cfgvalue(id) ? _('Set') : _('Not set'); };
		wgPsk.modalonly = true;
		// The per-row connection test goes before the Edit/Delete buttons.
		var nodeRowActions = s.renderRowActions;
		s.renderRowActions = function(section_id, more_label, trEl) {
			var tdEl = nodeRowActions.call(this, section_id, more_label, trEl);
			if (!tdEl.lastElementChild) return tdEl;
			var testBtn = E('button', {
				'class': 'btn cbi-button cbi-button-action',
				id: 'wfc-node-test-' + section_id,
				title: _('Run a fresh connection test for this node'),
				click: function() { runNodeTest(section_id, this); }
			}, _('Test'));
			tdEl.lastElementChild.insertBefore(testBtn, tdEl.lastElementChild.firstChild);
			return tdEl;
		};

		s = m.section(form.GridSection, 'device', _('Device policies'));
		s.addremove = true; s.nodescriptions = true; s.anonymous = true; s.addbtntitle = _('Add LAN device');
		s.sectiontitle = function(id) { return uci.get('wificalling-gateway', id, 'label') || id; };
		s.option(form.Flag, 'enabled', _('Enable')).default = '1';
		var deviceLabel = s.option(form.Value, 'label', _('Device display name'));
		deviceLabel.rmempty = false; deviceLabel.placeholder = _('Example: iPhone 12');
		var routeMode = s.option(form.ListValue, 'route_mode', _('Routing mode'));
		routeMode.value('independent', _('Independent tunnel')); routeMode.value('follow_gateway', _('Follow gateway'));
		routeMode.default = 'independent';
		var selectedNode = s.option(form.ListValue, 'node', _('Node'));
		selectedNode.rmempty = false; selectedNode.depends('route_mode', 'independent');
		selectedNode.description = _('Save the node first, then reload this page to select it for a device.');
		uci.sections('wificalling-gateway', 'node').forEach(function(node) { selectedNode.value(node['.name'], node.label || node['.name']); });
		var ips = s.option(form.DynamicList, 'source_ip', _('LAN IPv4 addresses'));
		ips.datatype = 'ip4addr'; ips.rmempty = false; ips.placeholder = lanSubnetHint();
		var devicePicker = s.option(form.DummyValue, '_device_picker', _('From connected devices'));
		devicePicker.rmempty = true;
		devicePicker.modalonly = true;
		devicePicker.renderWidget = function(section_id) {
			if (!detectedDevices.length)
				return E('span', {}, _('No connected devices detected'));
			var self = this;
			var select = E('select', { class: 'cbi-input-select', change: function(ev) {
				var ip = select.value; if (!ip) return;
				var dev = detectedDevices.find(function(d) { return d.ip === ip; });
				// Address the modal widgets through the form model
				// (getUIElement), not DOM ids: inside a GridSection the
				// row and the modal instantiate the same option twice.
				var labelEl = self.section.getOption('label').getUIElement(section_id);
				if (labelEl)
					labelEl.setValue((dev && dev.name) ? dev.name : '');
				var ipEl = self.section.getOption('source_ip').getUIElement(section_id);
				if (ipEl) {
					var vals = L.toArray(ipEl.getValue());
					if (vals.indexOf(ip) < 0)
						ipEl.setValue(vals.concat([ip]));
				}
			} }, detectedDevices.map(function(d) {
				return E('option', { value: d.ip }, (d.name || d.ip) + ' (' + d.ip + ')');
			}));
			return E('span', {}, [select, E('em', { class: 'cbi-value-description' }, _('Pick a device to fill its label and IP.'))]);
		};
		var dhcpBinding = s.option(form.DummyValue, '_dhcp_binding', _('DHCP binding'));
		// A DummyValue has no editable value: without rmempty the save
		// parse rejects it as "must not be empty", silently breaking the
		// "Save" button.  The grid row renders via textvalue; the edit
		// modal renders the widget with cfgvalue (always null), so
		// renderWidget is overridden to show the same live state in both
		// places.
		dhcpBinding.rmempty = true;
		function bindingState(id) {
			if ((uci.get('wificalling-gateway', id, 'route_mode') || 'independent') !== 'independent')
				return _('Following gateway');
			return L.toArray(uci.get('wificalling-gateway', id, 'source_ip'))
				.map(function(ip) { return ip + ': ' + dhcpState(ip); }).join('<br>');
		}
		dhcpBinding.rawhtml = true;
		dhcpBinding.textvalue = function(id) { return bindingState(id); };
		dhcpBinding.renderWidget = function(section_id, option_index, cfgvalue) {
			return E('output', { 'for': this.cbid(section_id) }, bindingState(section_id));
		};

		poll.add(function() {
			return L.resolveDefault(fs.read('/var/run/wificalling-gateway/node-status.json'), '{}').then(function(raw) {
				var current; try { current = JSON.parse(raw); } catch (e) { current = { nodes: [] }; }
				(current.nodes || []).forEach(function(n) {
					[['state', nodeState(n)], ['ping', latency(n)], ['quality', quality(n)]].forEach(function(v) {
						var el = document.getElementById('wfc-node-' + v[0] + '-' + n.id); if (el) dom.content(el, v[1]);
					});
				});
			});
		}, 5);
		this.mapInstance = m;
		return m.render().then(function(formNode) {
			return E([], [importPanel, formNode]);
		});
	},
	handleSave: function(ev) {
		// On LuCI 24.10 Map.save() only stages a session-scoped UCI
		// changeset; the changes are committed by ui.changes.apply()
		// (upstream's own Save & Apply path), and the default handler's
		// #maincontent .cbi-map lookup also fails under out-of-tree
		// themes.  Save through the form instance and commit+apply so the
		// plain "Save" button persists.  Older LuCI applies inside
		// Map.save() and has no ui.changes, hence the guard.
		var m = this.mapInstance;
		if (!m) return Promise.resolve();
		return m.save().then(function() {
			if (ui.changes) return ui.changes.apply(true);
		});
	}
});
