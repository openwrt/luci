'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require uci';
'require dom';
'require ui';
'require wificalling-gateway.node-import as nodeImport';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read('/var/run/wificalling-gateway/node-status.json'), '{}'),
			uci.load('wificalling-gateway')
		]);
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
			if (n.state === 'unreachable') return _('Offline');
			if (n.ping_ms == null) return _('Unknown');
			if (n.ping_ms <= 100) return _('Excellent');
			if (n.ping_ms <= 200) return _('Good');
			if (n.ping_ms <= 300) return _('Fair');
			return _('Poor');
		}
		function nodeState(n) {
			if (!n) return '-';
			if (n.state === 'reachable' || n.state === 'tcp_reachable') return _('Alive');
			if (n.state === 'unreachable') return _('Offline');
			return _('Unknown');
		}
		function latency(n) { return n && n.ping_ms != null ? n.ping_ms + ' ms (' + n.measurement + ')' : '-'; }

		var m = new form.Map('wificalling-gateway', _('Wi-Fi Calling Gateway settings'),
			_('Configure proxy nodes and assign fixed LAN devices. Monitoring and logs are available from the submenu.'));
		var importPanel = E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Import proxy node')),
			E('p', {}, _('Paste one AnyTLS, Hysteria2/Hy2, TUIC, VLESS, or VMess link. It is parsed locally in this browser and is not sent to an external service.')),
			E('button', { class: 'btn cbi-button-positive', click: function() {
				var input = E('textarea', { class: 'cbi-input-textarea', rows: 6, style: 'width:100%', placeholder: 'anytls://…' });
				ui.showModal(_('Import node link'), [input, E('div', { class: 'right' }, [
					E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
					E('button', { class: 'btn cbi-button-positive', click: function() {
						var parsed;
						try { parsed = nodeImport.parse(input.value); }
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
		var p = s.option(form.ListValue, 'protocol', _('Protocol'));
		['anytls','hysteria2','tuic','vless','vmess'].forEach(function(x) { p.value(x); });
		s.option(form.Value, 'server', _('Server')).datatype = 'host';
		s.option(form.Value, 'port', _('Port')).datatype = 'port';
		var nodeStatus = s.option(form.DummyValue, '_node_status', _('Node status'));
		nodeStatus.textvalue = function(id) { return E('span', { id: 'wfc-node-state-' + id }, nodeState(nodeById(id))); };
		var nodePing = s.option(form.DummyValue, '_node_ping', _('Ping / latency'));
		nodePing.textvalue = function(id) { return E('span', { id: 'wfc-node-ping-' + id }, latency(nodeById(id))); };
		var nodeQuality = s.option(form.DummyValue, '_node_quality', _('Quality'));
		nodeQuality.textvalue = function(id) { return E('span', { id: 'wfc-node-quality-' + id }, quality(nodeById(id))); };
		var secret = s.option(form.Value, 'password', _('Password'));
		secret.password = true; secret.textvalue = function(id) { return this.cfgvalue(id) ? _('Set') : _('Not set'); };
		var uuidField = s.option(form.Value, 'uuid', _('UUID'));
		uuidField.password = true; uuidField.textvalue = function(id) { return this.cfgvalue(id) ? _('Set') : _('Not set'); };
		s.option(form.Value, 'sni', _('TLS server name'));
		var securityOpt = s.option(form.ListValue, 'security', _('Security'));
		securityOpt.value('', _('None')); securityOpt.value('tls'); securityOpt.value('reality');
		securityOpt.depends('protocol', 'vless');
		securityOpt.depends('protocol', 'vmess');
		// The compiler has no reality arm for VMess; selecting it would emit a
		// cleartext outbound that sing-box check accepts. Reject it up front.
		securityOpt.validate = function(section_id, value) {
			if (value == 'reality' && this.map.getSectionValue(section_id, 'protocol') == 'vmess')
				return false;
			return true;
		};
		s.option(form.Flag, 'insecure', _('Allow insecure certificate'));
		s.option(form.Value, 'alpn', _('ALPN'));
		s.option(form.Value, 'pin_sha256', _('TLS public-key SHA-256 (base64)'));
		s.option(form.Value, 'flow', _('VLESS flow'));
		s.option(form.Value, 'public_key', _('Reality public key'));
		s.option(form.Value, 'short_id', _('Reality short ID'));
		s.option(form.Value, 'fingerprint', _('Reality fingerprint'));
		var udpMode = s.option(form.ListValue, 'udp_mode', _('TUIC UDP mode'));
		udpMode.value('native', _('Native')); udpMode.value('quic', _('QUIC'));
		var transport = s.option(form.ListValue, 'transport', _('Transport'));
		transport.value('', _('None')); transport.value('ws', _('WebSocket'));
		s.option(form.Value, 'path', _('WebSocket path'));
		s.option(form.Value, 'host', _('WebSocket Host'));

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
		ips.datatype = 'ip4addr'; ips.rmempty = false; ips.placeholder = '192.168.31.189';

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
		return m.render().then(function(formNode) { return E([], [importPanel, formNode]); });
	}
});
