'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require uci';
'require tools.widgets as widgets';

var getStatus = rpc.declare({ object: 'luci.mtk_hqos', method: 'status', expect: {} });

function rateText(value) {
	return Number(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function decoded(hex) {
	var v = parseInt(hex, 16);
	return {
		max: (v & 0x800) ? ((v >>> 4) & 127) * Math.pow(10, v & 15) : 0,
		min: (v & 0x08000000) ? ((v >>> 20) & 127) * Math.pow(10, (v >>> 16) & 15) : 0,
		scheduler: (v >>> 30) & 3,
		weight: ((v >>> 12) & 15) || 16
	};
}
function queueNames() {
	var names = {};
	uci.sections('mtk_hqos', 'queue', function(s) { names[s.queue] = s.name || _('Queue %s').format(s.queue); });
	return names;
}
function renderStatus(node, data, detailed) {
	var last = data.last || {}, state = data.state || {}, rows = [];
	var message = !data.supported ? _('HQoS driver unavailable') :
		last.success === false ? _('Apply failed') :
		state.enabled ? _('Enabled') : _('Disabled');
	rows.push(E('p', { 'role': 'status' }, message));
	if (!data.supported)
		rows.push(E('p', {}, _('This firmware does not provide the required MT7986 HQoS driver.')));
	if (last.success === false) {
		rows.push(E('p', { 'class': 'alert-message warning', 'role': 'alert' }, [last.message || _('Unknown error')]));
		if (last.rollback === false)
			rows.push(E('p', {}, _('Rollback was incomplete. Check hardware settings before applying again.')));
		if (last.committed)
			rows.push(E('p', {}, _('Rules were applied, but their state could not be saved.')));
	}
	if (state.updated)
		rows.push(E('p', { 'class': 'cbi-section-descr' }, _('Last applied: %s. Active rules: %s.').format(new Date(state.updated * 1000).toLocaleString(), state.rule_count || 0)));
	if (data.supported && detailed) {
		var names = queueNames(), configured = Object.keys(state.queues || {});
		if (!configured.length)
			rows.push(E('p', {}, _('No custom queues have been applied.')));
		var table = E('table', { 'class': 'table' }, [E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Queue')),
			E('th', { 'class': 'th' }, _('Scheduler')),
			E('th', { 'class': 'th' }, _('Weight')),
			E('th', { 'class': 'th' }, _('Minimum (Mbit/s)')),
			E('th', { 'class': 'th' }, _('Maximum (Mbit/s)'))
		])]);
		configured.sort(function(a, b) { return +a - +b; }).forEach(function(q) {
			var item = (data.queues || {})[q];
			if (!item) return;
			var actual = decoded(item.actual || item.effective);
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Queue') }, [(names[q] || _('Class')) + ' В· ' + q]),
				E('td', { 'class': 'td', 'data-title': _('Scheduler') }, String(actual.scheduler)),
				E('td', { 'class': 'td', 'data-title': _('Weight') }, String(actual.weight)),
				E('td', { 'class': 'td', 'data-title': _('Minimum') }, rateText(actual.min)),
				E('td', { 'class': 'td', 'data-title': _('Maximum') }, actual.max ? rateText(actual.max) : _('Unlimited'))
			]));
		});
		if (configured.length) rows.push(table);
		rows.push(E('p', { 'class': 'cbi-section-descr' }, data.extended ?
			_('Hardware settings, not measured throughput.') :
			_('Legacy driver: calculated values only. Queue weights and hardware readback require a newer driver.')));
		if (data.policy && data.policy.values) {
			var mappingLines = [];
			Object.keys(data.policy.ports || {}).forEach(function(device) {
				var port = data.policy.ports[device];
				for (var cls = 0; cls < 16; cls++) {
					var target = data.policy.values[16 + port * 16 + cls];
					if (target >= 0) mappingLines.push(_('Class %s в†’ %s в†’ queue %s').format(cls, device, target));
				}
			});
			if (mappingLines.length) rows.push(E('details', {}, [E('summary', {}, _('Applied egress mappings')), E('ul', {}, mappingLines.map(function(line) { return E('li', {}, line); }))]));
			var schedulerLines = Object.keys(data.policy.schedulers || {}).map(function(id) {
				var value = parseInt(data.policy.schedulers[id], 16);
				return _('Scheduler %s: %s, maximum %s').format(id, (value & 0x8000) ? 'WFQ' : 'SP', (value & 0x800) ? rateText(((value >>> 4) & 127) * Math.pow(10, value & 15)) + ' Mbit/s' : _('not set'));
			});
			rows.push(E('p', { 'class': 'cbi-section-descr' }, schedulerLines.join('; ')));
		}
		var details = E('details', {}, [E('summary', {}, _('Raw queue registers'))]);
		var lines = Object.keys(data.queues || {}).sort(function(a, b) { return +a - +b; }).map(function(q) {
			var item = data.queues[q];
			return q + ': baseline=' + item.baseline + ' ' + (item.actual ? 'actual=' + item.actual : 'calculated=' + item.effective);
		});
		details.appendChild(E('pre', { 'style': 'overflow-x:auto' }, lines.join('\n')));
		rows.push(details);
	}
	var expanded = Array.from(node.querySelectorAll('details')).map(function(el) { return el.open; });
	node.replaceChildren.apply(node, rows);
	node.querySelectorAll('details').forEach(function(el, i) { el.open = !!expanded[i]; });
}
function bandwidth(section, key, title, description) {
	var o = section.option(form.Value, key, title, description);
	o.default = '0'; o.rmempty = false;
	o.textvalue = function(id) { var v = this.cfgvalue(id); return +v ? v : (key === 'rate' ? _('Driver default') : _('Not set')); };
	o.cfgvalue = function(id) { return String(Number(uci.get('mtk_hqos', id, key) || 0) / 1000); };
	o.write = function(id, value) { uci.set('mtk_hqos', id, key, String(Math.round(Number(value) * 1000))); };
	o.validate = function(id, value) {
		return /^(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/.test(value || '') &&
			(+value === 0 || (+value >= 10 && +value <= 2500)) ? true : _('Enter 0 or a rate between 10 and 2500 Mbit/s.');
	};
	return o;
}
return view.extend({
	load: function() { return Promise.all([getStatus().catch(function() { return { failed: true }; }), uci.load('mtk_hqos')]); },
	render: function(result) {
		var data = result[0];
		var m = new form.Map('mtk_hqos', _('MediaTek HQoS'),
			_('Manage hardware Ethernet queues while retaining hardware flow offloading.'));
		m.tabbed = true;
		var live = E('div'), diagnostics = E('div');
		var s = m.section(form.NamedSection, 'main', 'global', _('General settings'));
		var general = s;
		var o = s.option(form.DummyValue, '_status', _('Status'));
		o.renderWidget = function() { return live; };
		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.description = _('Controls Ethernet queues. Wi-Fi/WED output and upstream provider queues are not managed.');
		o.default = '0'; o.rmempty = false;
		s = m.section(form.GridSection, 'queue', _('Queues'),
			_('Weights share available bandwidth between competing queues in the same WFQ scheduler.'));
		s.anonymous = true; s.addremove = true; s.nodescriptions = true;
		var queues = s;
		s.addbtntitle = _('Add queue'); s.modaltitle = _('Edit queue');
		o = s.option(form.Value, 'name', _('Name')); o.placeholder = _('e.g. Background');
		o = s.option(form.ListValue, 'queue', _('Queue ID')); o.rmempty = false;
		for (var q = 0; q < 16; q++) o.value(String(q));
		o.description = _('Queue IDs do not indicate priority. Each queue can only be configured once.');
		o.validate = function(id, value) {
			var duplicate = false;
			uci.sections('mtk_hqos', 'queue', function(other) { if (other['.name'] !== id && other.queue === value) duplicate = true; });
			return duplicate ? _('This queue is already configured.') : true;
		};
		o = s.option(form.ListValue, 'scheduler', _('Scheduler'));
		o.value('-1', _('Driver default')); o.value('0', '0'); o.value('1', '1');
		o.default = '-1'; o.rmempty = false; o.modalonly = true;
		o.description = _('Selects a scheduler, not a priority level. Its mode and total rate are unchanged.');
		o = s.option(form.ListValue, 'weight', _('Weight'));
		o.value('0', _('Driver default')); for (var w = 1; w <= 16; w++) o.value(String(w), String(w));
		o.default = '0'; o.rmempty = false;
		o.textvalue = function(id) { return Number(this.cfgvalue(id)) ? this.cfgvalue(id) : _('Driver default'); };
		o.description = _('Higher weights receive a larger share under contention. 0 preserves the driver settings.');
		o = bandwidth(s, 'rate', _('Maximum (Mbit/s)'), _('0 preserves the driver limit.'));
		o = bandwidth(s, 'minimum', _('Minimum (Mbit/s)'), _('0 keeps the minimum set by the driver. This is not a guaranteed Internet speed.'));
		o.modalonly = true;
		for (var j = 1; j <= 16; j++) o.depends('weight', String(j));
		var validateRate = o.validate;
		o.validate = function(id, value) {
			var valid = validateRate.call(this, id, value);
			if (valid !== true) return valid;
			var max = Number(this.section.getOption('rate').formvalue(id));
			return max && +value > max ? _('The minimum cannot exceed the maximum.') : true;
		};
		s = m.section(form.GridSection, 'mapping', _('Egress mappings'),
			_('Advanced: override the hardware queue for a class on a physical Ethernet output. Without a mapping, the queue ID equals the class ID.'));
		s.anonymous = true; s.addremove = true; s.nodescriptions = true;
		var mappings = s;
		s.addbtntitle = _('Add mapping'); s.modaltitle = _('Edit egress mapping');
		o = s.option(form.Flag, 'enabled', _('Enabled')); o.default = '1'; o.rmempty = false;
		o = s.option(form.ListValue, 'class', _('Class')); o.rmempty = false;
		for (var cls = 0; cls < 16; cls++) o.value(String(cls));
		o = s.option(form.ListValue, 'device', _('Physical output')); o.rmempty = false;
		Object.keys((data.policy || {}).ports || {}).forEach(function(device) { o.value(device); });
		o.description = _('Outputs sharing a GMAC also share this mapping. An empty list requires a driver with egress mapping support.');
		o = s.option(form.ListValue, 'queue', _('Queue ID')); o.rmempty = false;
		for (var target = 0; target < 16; target++) o.value(String(target));
		s = m.section(form.GridSection, 'rule', _('Traffic rules'),
			_('First match wins. Drag rules to change their order. Changes affect new connections.'));
		var rules = s;
		s.anonymous = true; s.addremove = true; s.nodescriptions = true; s.sortable = true; s.addbtntitle = _('Add rule'); s.modaltitle = _('Edit traffic rule');
		o = s.option(form.Flag, 'enabled', _('Enabled')); o.default = '1'; o.rmempty = false;
		o = s.option(form.Value, 'name', _('Name')); o.placeholder = _('e.g. Voice');
		o = s.option(form.ListValue, 'hook', _('Traffic origin')); o.value('forward', _('Forwarded traffic')); o.value('output', _('Router traffic')); o.default = 'forward'; o.rmempty = false; o.modalonly = true;
		o.textvalue = function(id) { return this.cfgvalue(id) === 'output' ? _('Router traffic') : _('Forwarded traffic'); };
		o = s.option(widgets.DeviceSelect, 'device', _('Output device')); o.rmempty = false; o.multiple = false; o.noaliases = true; o.modalonly = true;
		o.description = _('Select the actual Ethernet output. For outer AWG packets, select the Internet-facing device.');
		o = s.option(form.Value, 'source', _('Source address')); o.datatype = 'ipaddr'; o.placeholder = _('Any'); o.modalonly = true;
		o = s.option(form.ListValue, 'proto', _('Protocol')); o.value('all', _('Any')); o.value('tcp', 'TCP'); o.value('udp', 'UDP'); o.default = 'all'; o.rmempty = false; o.modalonly = true;
		o = s.option(form.Value, 'port', _('Destination port')); o.datatype = 'range(1,65535)'; o.depends('proto', 'tcp'); o.depends('proto', 'udp'); o.modalonly = true;
		o = s.option(form.Value, 'dscp', _('DSCP'));
		o.placeholder = _('Any'); o.rmempty = true; o.modalonly = true;
		o.value('', _('Any'));
		o.value('EF', 'EF В· 46'); o.value('LE', 'LE В· 1');
		for (var cs = 0; cs < 8; cs++) o.value('CS' + cs, 'CS' + cs + ' В· ' + (cs * 8));
		for (var af = 1; af <= 4; af++) for (var dp = 1; dp <= 3; dp++)
			o.value('AF' + af + dp, 'AF' + af + dp + ' В· ' + (af * 8 + dp * 2));
		o.description = _('Matches an existing IPv4/IPv6 DSCP value without changing it. Empty matches any value; CS0 matches only 0.');
		o.textvalue = function(id) { return this.cfgvalue(id) || _('Any'); };
		o.validate = function(id, value) {
		return !value || /^(CS[0-7]|AF[1-4][1-3]|EF|LE)$/i.test(value) ||
			(/^[0-9]+$/.test(value) && Number(value) <= 63) ? true : _('Enter 0вЂ“63, CS0вЂ“CS7, AF11вЂ“AF43, EF or LE.');
	};
		o = s.option(form.ListValue, 'queue', _('Class')); o.rmempty = false;
		o.load = function(id) { this.keylist = []; this.vallist = []; for (var n = 0; n < 16; n++) this.value(String(n), E('span', {}, [_('Class %s').format(n)])); return uci.get('mtk_hqos', id, 'queue'); };
		o.textvalue = function(id) { var q = this.cfgvalue(id); return E('span', {}, [_('Class %s').format(q)]); };
		for (var i = 0; i < 16; i++) o.value(String(i), E('span', {}, [_('Class %s').format(i)]));
		o = s.option(form.DummyValue, '_match', _('Match'));
		o.modalonly = false;
		o.textvalue = function(id) {
			var rule = uci.get('mtk_hqos', id) || {};
			var parts = [rule.hook === 'output' ? _('Router traffic') : _('Forwarded traffic')];
			if (rule.device) parts.push(rule.device);
			if (rule.source) parts.push(_('Source: %s').format(rule.source));
			if (rule.proto && rule.proto !== 'all') parts.push(rule.proto.toUpperCase());
			if (rule.port) parts.push(_('Port: %s').format(rule.port));
			if (rule.dscp != null && rule.dscp !== '') parts.push('DSCP ' + rule.dscp);
			return parts.join(' В· ');
		};
		s = m.section(form.TypedSection, '_diagnostics', _('Diagnostics'));
		s.anonymous = true;
		s.cfgsections = function() { return ['_diagnostics']; };
		o = s.option(form.DummyValue, '_hardware');
		o.renderWidget = function() { return diagnostics; };
		m.children = [general, queues, rules, mappings, s];

		function update(value) {
			if (value.failed) {
				live.replaceChildren(E('p', { 'role': 'status' }, _('Status unavailable. Retrying in 5 seconds.')));
				diagnostics.replaceChildren(E('p', {}, _('Status unavailable. Retrying in 5 seconds.')));
				return;
			}
			renderStatus(live, value, false);
			renderStatus(diagnostics, value, true);
		}
		update(data);
		poll.add(function() {
			return getStatus().then(update).catch(function() { update({ failed: true }); });
		}, 5);
		return m.render();
	}
});
