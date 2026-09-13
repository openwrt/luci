'use strict';
'require dom';
'require view';
'require fs';
'require ui';
'require uci';
'require form';

function handleAction(ev) {
	if (ev === 'restart') {
		const map = document.querySelector('.cbi-map');

		return dom.callClassMethod(map, 'save')
			.then(function () {
				return Promise.all([
					uci.changes(),
					fs.exec('/etc/init.d/shunt', ['running'])
				]);
			})
			.then(function (res) {
				const pending = res[0] && Object.keys(res[0]).length;
				const running = res[1] && res[1].code === 0;

				if (pending && running) {
					L.bind(ui.changes.apply, ui.changes)();
					return null;
				}

				if (pending) {
					return uci.apply().then(function () {
						if (ui.changes.setIndicator) {
							ui.changes.setIndicator(0);
						}
						return fs.exec_direct('/etc/init.d/shunt', [ev]);
					});
				}
				return fs.exec_direct('/etc/init.d/shunt', [ev]);
			})
			.catch(function (e) {
				ui.addNotification(null,
					E('p', {}, [_('Apply failed: %s').format(e)]), 'error');
			});
	}
	return fs.exec_direct('/etc/init.d/shunt', [ev]);
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('shunt').catch(() => 0),
			uci.load('network').catch(() => 0)
		]);
	},

	render: function () {
		if (!uci.sections('shunt').length) {
			ui.addNotification(null, E('p', _('No shunt config found!')), 'error');
			return;
		}

		let m, s, o;

		m = new form.Map('shunt', _('Policies'),
			_('Evaluated top to bottom - the first policy a packet matches \
				wins. Within one policy the selectors are ANDed: source plus domain means only that client, and only to those domains.'));
		s = m.section(form.GridSection, 'policy');
		s.addremove = true;
		s.anonymous = false;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add policy');

		// The section name becomes an nftables identifier, so it is validated
		// where it is typed rather than silently skipped later.
		s.renderSectionAdd = function (extra_class) {
			const el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments);
			const nameEl = el.querySelector('.cbi-section-create-name');

			if (nameEl) {
				ui.addValidator(nameEl, 'and(uciname,maxlength(24))', true);
			}

			return el;
		};

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;
		o.default = '1';
		o.editable = true;

		o = s.option(form.ListValue, 'action', _('Action'),
			_('Route the selected traffic into the interface below, or \
				bypass it - a bypass policy marks nothing and exempts the traffic from every policy after it.'));
		o.value('route', _('Route into a policy interface'));
		o.value('bypass', _('Bypass - leave the traffic alone'));
		o.default = 'route';
		o.editable = true;

		o = s.option(form.Value, 'interface', _('Interface'),
			_('The device or logical interface this policy routes into. A \
				netifd name is resolved to its device; any other device name is used as entered.'));
		o.rmempty = false;
		o.depends('action', 'route');

		uci.sections('network', 'interface').forEach(function (n) {
			if (n['.name'] !== 'loopback') {
				o.value(n['.name'], '%s (%s)'.format(n['.name'], _('interface')));
			}
		});

		o = s.option(form.ListValue, 'fallback', _('Fallback Behavior'));
		o.value('main', _('Fall through to the normal uplink'));
		o.value('block', _('Block the traffic (killswitch)'));
		o.default = 'main';
		o.depends('action', 'route');

		o = s.option(form.Flag, 'keep_local', _('Keep Local Traffic'),
			_('Traffic to networks the routing table already has a route for \
				- your other subnets, your static routes - stays on the normal path instead of entering the policy interface. Turn this off only for a hermetic killswitch.'));
		o.default = '1';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('action', 'route');

		o = s.option(form.DynamicList, 'src', _('Source Addresses'),
			_('Client addresses or prefixes this policy applies to. Leave empty to apply to every client.'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'src_mac', _('Source MAC Addresses'),
			_('Client MACs this policy applies to, ORed with the addresses above.'));
		o.datatype = 'macaddr';
		o.modalonly = true;

		o = s.option(form.MultiValue, 'proto', _('Protocols'),
			_('Restrict to tcp, udp or both. A port without a protocol covers both.'));
		o.value('tcp', 'tcp');
		o.value('udp', 'udp');
		o.modalonly = true;

		o = s.option(form.DynamicList, 'dport', _('Destination Ports'),
			_('Single ports or ranges like 8000-8080, ANDed with the addresses below.'));
		o.datatype = 'or(port, portrange)';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'dst', _('Destination Addresses'),
			_('Destination addresses or prefixes to route into this policy.'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'domain', _('Domains'),
			_('example.com matches that name only, *.example.com matches its \
				subdomains but not the apex - list both to cover both.'));
		o.modalonly = true;

		o = s.option(form.Value, 'gw4', _('IPv4 Gateway Override'),
			_('Only needed when the gateway discovered from netifd is wrong. \
				Point to point interfaces need no gateway at all.'));
		o.datatype = 'ip4addr';
		o.modalonly = true;

		o = s.option(form.Value, 'gw6', _('IPv6 Gateway Override'));
		o.datatype = 'ip6addr';
		o.modalonly = true;

		s = m.section(form.TypedSection, 'global');
		s.anonymous = true;
		s.addremove = false;
		s.render = L.bind(function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('restart');
					})
				}, [_('Save & Restart')])
			]);
		});

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
