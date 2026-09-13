'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require view';

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

return view.extend({
	load() {
		return Promise.all([
			uci.load('unbound'),
		]);
	},

	render([data]) {
		const requestPath = L.env.requestpath;
		const zoneId = requestPath[requestPath.length-1] || '';

		let found = false;
		uci.sections('unbound', 'zone').forEach(s => {
			if (s['.name'] === zoneId)
				found = true;
		});
		if (requestPath[requestPath.length-2] !== 'zone-details' || !found) {
			window.location.assign(L.url('admin/services/unbound/zones'));
		}

		const m = new form.Map('unbound', _('Directed Zone'),
			_('Edit a forward, stub, or zone-file-cache zone for Unbound to use instead of recursion.'));

		const s = m.section(form.NamedSection, zoneId, 'zone');
		s.anonymous = true;
		s.addremove = false;

		const ena = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Enable this directed zone'));
		ena.rmempty = false;

		const flb = s.option(form.Flag, 'fallback', _('Fall Back'),
			_('Allow open recursion when record not in zone'));
		flb.rmempty = false;

		const zty = s.option(form.ListValue, 'zone_type', _('Zone Type'));
		zty.rmempty = false;
		zty.value('auth_zone', _('Authoritative (zone file)'));
		zty.value('stub_zone', _('Stub (forced recursion)'));
		zty.value('forward_zone', _('Forward (simple handoff)'));

		const znm = s.option(form.DynamicList, 'zone_name', _('Zone Names'),
			_('Zone (Domain) names included in this zone combination'));
		znm.placeholder = 'new.example.net.';

		const srv = s.option(form.DynamicList, 'server', _('Servers'),
			_('Servers for this zone; see README.md for optional form'));
		srv.placeholder = '192.0.2.53';

		const ast = s.option(form.ListValue, 'dns_assist', _('DNS Plugin'),
			_('Check for local program to allow forward to localhost'));
		ast.value('none', _('(none)'));
		ast.value('bind', 'bind');
		ast.value('dnsmasq', 'dnsmasq');
		ast.value('ipset-dns', 'ipset-dns');
		ast.value('nsd', 'nsd');
		ast.value('unprotected-loop', 'unprotected-loop');

		const rlv = s.option(form.Flag, 'resolv_conf', _("Use 'resolv.conf.auto'"),
			_('Forward to upstream nameservers (ISP)'));
		rlv.depends('zone_type', 'forward_zone');

		const tlu = s.option(form.Flag, 'tls_upstream', _('DNS over TLS'),
			_('Connect to servers using TLS'));
		tlu.depends('zone_type', 'forward_zone');

		const prt = s.option(form.Value, 'port', _('Server Port'),
			_('Port servers will receive queries on'));
		prt.depends('tls_upstream', '0');
		prt.datatype = 'port';
		prt.placeholder = '53';

		const tlp = s.option(form.Value, 'tls_port', _('Server TLS Port'),
			_('Port servers will receive queries on'));
		tlp.depends('tls_upstream', '1');
		tlp.datatype = 'port';
		tlp.placeholder = '853';

		const tli = s.option(form.Value, 'tls_index', _('TLS Name Index'),
			_('Domain name to verify TLS certificate'));
		tli.depends('tls_upstream', '1');
		tli.placeholder = 'dns.example.net';

		const url = s.option(form.Value, 'url_dir', _('Zone Download URL'),
			_('Directory only part of URL'));
		url.depends('zone_type', 'auth_zone');
		url.placeholder = 'https://www.example.net/dl/zones/';

		return m.render();
	},

	handleSaveApply(ev, mode) {
		const requestPath = L.env.requestpath;
		const zoneId = requestPath[requestPath.length-1] || '';

		if (zoneId) {
			const enabled = uci.get('unbound', zoneId, 'enabled');
			const cmd = enabled ? 'reload' : 'stop';

			const Fn = L.bind(() => {
				callRcInit('unbound', cmd);
				document.removeEventListener('uci-applied', Fn);
			});
		}
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	}
});
