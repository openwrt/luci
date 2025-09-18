'use strict';
'require fs';
'require form';
'require rpc';
'require uci';
'require ui';
'require view';
'require tools.widgets as widgets';

const UBNET = 'https://nlnetlabs.nl/projects/unbound/about/';
const README = 'https://github.com/openwrt/packages/blob/master/net/unbound/files/README.md';

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
			uci.load('dhcp'),
		]);
	},

	render([unboundCfg, dhcpCfg]) {
		const m = new form.Map('unbound', _('Recursive DNS'),
			_("Unbound <a href=\"%s\" target=\"_blank\">(NLnet Labs)</a> is a validating, recursive, and caching DNS resolver <a href=\"%s\" target=\"_blank\">(help)</a>.".format(UBNET, README)));

		const s = m.section(form.NamedSection, 'ub_main', 'unbound');
		s.anonymous = true;
		s.addremove = false;

		const manual = uci.get('unbound', 'ub_main', 'manual_conf');
		const dhcpLink = uci.get('unbound', 'ub_main', 'dhcp_link');
		const leasetrig = uci.get('dhcp', 'odhcpd', 'leasetrigger') || 'undefined';

		if (manual === '0' && dhcpLink === 'odhcpd' && leasetrig !== '/usr/lib/unbound/odhcpd.sh') {
			ui.addTimeLimitedNotification(null, E('p', _('Note: local DNS is configured to look at odhpcd, but odhpcd UCI lease trigger is incorrectly set:') +
				"dhcp.odhcpd.leasetrigger='" + leasetrig + "'"), 15000, 'note');
		}

		// Tabs
		s.tab('basic', _('Basic'));
		if (manual === '0') {
			s.tab('advanced', _('Advanced'));
			s.tab('dhcp', _('DHCP'));
			s.tab('resource', _('Resource'));
		}

		// Basic tab items
		const ena = s.taboption('basic', form.Flag, 'enabled', _('Enable Unbound'),
			_('Enable the initialization scripts for Unbound'));
		ena.rmempty = false;

		const mcf = s.taboption('basic', form.Flag, 'manual_conf', _('Manual Conf'),
			_('Skip UCI and use /etc/unbound/unbound.conf'));
		mcf.rmempty = false;

		if (manual === '0') {
			s.taboption('basic', form.Flag, 'localservice', _('Local Service'),
				_('Accept queries only from local subnets')).rmempty = false;

			s.taboption('basic', form.Flag, 'validator', _('Enable DNSSEC'),
				_('Enable the DNSSEC validator module')).rmempty = false;

			const nvd = s.taboption('basic', form.Flag, 'validator_ntp', _('DNSSEC NTP Fix'),
				_('Break the loop where DNSSEC needs NTP and NTP needs DNS'));
			nvd.optional = true;
			nvd.default = '1';
			nvd.depends('validator', '1');

			const prt = s.taboption('basic', form.Value, 'listen_port', _('Listening Port'),
				_('Choose Unbounds listening port'));
			prt.datatype = 'port';
			prt.placeholder = '53';
		} else {
			const ag2b = s.taboption('basic', form.Value, 'root_age', _('Root DSKEY Age'),
				_('Limit days between RFC5011 copies to reduce flash writes'));
			ag2b.datatype = 'and(uinteger,min(1),max(99))';
			ag2b.value('3', '3');
			ag2b.value('9', '9 (' + _('default') + ')');
			ag2b.value('12', '12');
			ag2b.value('24', '24');
			ag2b.value('99', '99 (' + _('never') + ')');

			const tgrb = s.taboption('basic', widgets.NetworkSelect, 'trigger_interface', _('Trigger Networks'),
				_('Networks that may trigger Unbound to reload (avoid wan6)'));
			tgrb.multiple = true;
			tgrb.rmempty = true;
			tgrb.nocreate = true;
		}

		// Advanced, DHCP & Resource tabs only if manual===0
		if (manual === '0') {
			const rlh = s.taboption('advanced', form.Flag, 'rebind_localhost', _('Filter Localhost Rebind'),
				_('Protect against upstream response of 127.0.0.0/8'));
			rlh.rmempty = false;

			const rpv = s.taboption('advanced', form.ListValue, 'rebind_protection', _('Filter Private Rebind'),
				_('Protect against upstream responses within local subnets'));
			rpv.rmempty = false;
			rpv.value('0', _('No Filter'));
			rpv.value('1', _('Filter Private Address'));
			rpv.value('2', _('Filter Entire Subnet'));

			const d64 = s.taboption('advanced', form.Flag, 'dns64', _('Enable DNS64'),
				_('Enable the DNS64 module'));
			d64.rmempty = false;

			const pfx = s.taboption('advanced', form.Value, 'dns64_prefix', _('DNS64 Prefix'),
				_('Prefix for generated DNS64 addresses'));
			pfx.datatype = 'ip6addr';
			pfx.placeholder = '64:ff9b::/96';
			pfx.optional = true;
			pfx.depends('dns64', '1');

			const exga = s.taboption('advanced', form.Flag, 'exclude_ipv6_ga', _('Exclude IPv6 GA'));

			const din = s.taboption('advanced', form.DynamicList, 'domain_insecure', _('Domain Insecure'),
				_('List domains to bypass checks of DNSSEC'));
			din.depends('validator', '1');

			const ag2 = s.taboption('advanced', form.Value, 'root_age', _('Root DSKEY Age'));
			ag2.datatype = 'and(uinteger,min(1),max(99))';
			ag2.value('3', '3');
			ag2.value('9', '9 (' + _('default') + ')');
			ag2.value('12', '12');
			ag2.value('24', '24');
			ag2.value('99', '99 (' + _('never') + ')');

			const ifc = s.taboption('advanced', widgets.NetworkSelect, 'iface_lan', _('LAN Networks'), 
					_('Networks to consider LAN (served) beyond those served by DHCP'));
			ifc.multiple = true;
			ifc.rmempty = true;
			ifc.nocreate = true;
			const wfc = s.taboption('advanced', widgets.NetworkSelect, 'iface_wan', _('WAN Networks'), 
					_('Networks to consider WAN (unserved)'));
			wfc.multiple = true;
			wfc.rmempty = true;
			wfc.nocreate = true;
			const tgr = s.taboption('advanced', widgets.NetworkSelect, 'iface_trig', _('Trigger Networks'), 
					_('Networks that may trigger Unbound to reload (avoid wan6)'));
			tgr.multiple = true;
			tgr.rmempty = true;
			tgr.nocreate = true;

			const bindhide = s.taboption('advanced', form.Flag, 'hide_binddata', _('Refuse possible attack queries'));

			const verb = s.taboption('advanced', form.ListValue, 'verbosity', _('Verbosity'));
			verb.datatype = 'and(uinteger,min(0),max(5))';
			verb.value('0');
			verb.value('1');
			verb.value('2');
			verb.value('3');
			verb.value('4');
			verb.value('5');

			// DHCP tab
			const dlk = s.taboption('dhcp', form.ListValue, 'dhcp_link', _('DHCP Link'),
				_('Link to supported programs to load DHCP into DNS'));
			dlk.rmempty = false;
			['none','dnsmasq','odhcpd'].forEach(v => dlk.value(v, v === 'none' ? _('(none)') : v));

			const dp6 = s.taboption('dhcp', form.Flag, 'dhcp4_slaac6', _('DHCPv4 to SLAAC'),
				_('Use DHCPv4 MAC to discover IP6 hosts SLAAC (EUI64)'));
			dp6.optional = true;
			dp6.depends('dhcp_link', 'odhcpd');

			const dom = s.taboption('dhcp', form.Value, 'domain', _('Local Domain'),
				_('Domain suffix for this router and DHCP clients'));
			dom.placeholder = 'lan';
			dom.optional = true;

			const dty = s.taboption('dhcp', form.ListValue, 'domain_type', _('Local Domain Type'),
				_('How to treat queries of this local domain'));
			dty.optional = true;
			dty.value('deny', _('Denied (nxdomain)'));
			dty.value('refuse', _('Refused'));
			dty.value('static', _('Static (local only)'));
			dty.value('transparent', _('Transparent (local/global)'));
			dty.depends('dhcp_link', 'none');
			dty.depends('dhcp_link', 'odhcpd');

			const addDnsOpts = [
				['add_local_fqdn', _('LAN DNS'), _('How to enter the LAN or local network router in DNS')],
				['add_wan_fqdn', _('WAN DNS'), _('Override the WAN side router entry in DNS')],
			];
			const addDnsValues = [
				['1', _('Hostname, Primary Address')],
				['2', _('Hostname, All Addresses')],
				['3', _('Host FQDN, All Addresses')],
				['4', _('Interface FQDN, All Addresses')]
			];

			addDnsOpts.forEach(([optName,label]) => {
				const opt = s.taboption('dhcp', form.ListValue, optName, label, '');
				opt.optional = true;
				opt.value('0', (optName == 'add_local_fqdn') ? _('No Entry') : _('Use Upstream'));
				addDnsValues.forEach(([val,text]) => opt.value(val, text));
				opt.depends('dhcp_link', 'none');
				opt.depends('dhcp_link', 'odhcpd');
			});

			const exa = s.taboption('dhcp', form.ListValue, 'add_extra_dns', _('Extra DNS'),
				_('Use extra DNS entries found in /etc/config/dhcp'));
			exa.optional = true;
			exa.value('0', _('Ignore'));
			exa.value('1', _('Host Records'));
			exa.value('2', _('Host/MX/SRV RR'));
			exa.value('3', _('Host/MX/SRV/CNAME RR'));

			// Resource tab
			const ctl = s.taboption('resource', form.ListValue, 'unbound_control', _('Unbound Control App'),
				_('Enable access for unbound-control'));
			ctl.value('0', _('No Remote Control'));
			ctl.value('1', _('Local Host, No Encryption'));
			ctl.value('2', _('Local Host, Encrypted'));
			ctl.value('3', _('Local Subnet, Encrypted'));
			ctl.value('4', _('Local Subnet, Static Encryption'));
			ctl.rmempty = false;

			const pro = s.taboption('resource', form.ListValue, 'protocol', _('Recursion Protocol'),
				_('Choose the IP versions used upstream and downstream'));
			pro.value('default', _('Default'));
			pro.value('ip4_only', _('IP4 Only'));
			pro.value('ip6_local', _('IP4 All and IP6 Local'));
			pro.value('ip6_only', _('IP6 Only*'));
			pro.value('ip6_prefer', _('IP6 Preferred'));
			pro.value('mixed', _('IP4 and IP6'));
			pro.rmempty = false;

			const rsc = s.taboption('resource', form.ListValue, 'resource', _('Memory Resource'),
				_('Use menu System/Processes to observe any memory growth'));
			rsc.value('default', _('Default'));
			rsc.value('tiny', _('Tiny'));
			rsc.value('small', _('Small'));
			rsc.value('medium', _('Medium'));
			rsc.value('large', _('Large'));
			rsc.rmempty = false;

			const rsn = s.taboption('resource', form.ListValue, 'recursion', _('Recursion Strength'),
				_('Recursion activity affects memory growth and CPU load'));
			rsn.value('default', _('Default'));
			rsn.value('passive', _('Passive'));
			rsn.value('aggressive', _('Aggressive'));
			rsn.rmempty = false;

			const qry = s.taboption('resource', form.Flag, 'query_minimize', _('Query Minimize'),
				_('Break down query components for limited added privacy'));
			qry.optional = true;
			qry.depends('recursion', 'passive');
			qry.depends('recursion', 'aggressive');

			const qrs = s.taboption('resource', form.Flag, 'query_min_strict', _('Strict Minimize'),
				_("Strict version of 'query minimize' but it can break DNS"));
			qrs.taboptional = true;
			qrs.depends('query_minimize', '1');

			const eds = s.taboption('resource', form.Value, 'edns_size', _('EDNS Size'),
				_('Limit extended DNS packet size'));
			eds.datatype = 'and(uinteger,min(512),max(4096))';
			eds.placeholder = '1280';

			const tlm = s.taboption('resource', form.Value, 'ttl_min', _('TTL Minimum'),
				_('Prevent excessively short cache periods'));
			tlm.datatype = 'and(uinteger,min(0),max(1200))';
			tlm.placeholder = '120';

			const tlnm = s.taboption('resource', form.Value, 'ttl_neg_max', _('TTL Neg Max'));
			tlm.datatype = 'and(uinteger,min(0),max(1200))';
			tlm.placeholder = '1000';

			const rtt = s.taboption('resource', form.Value, 'rate_limit', _('Query Rate Limit'),
				_('Prevent client query overload; zero is off'));
			rtt.datatype = 'and(uinteger,min(0),max(5000))';
			rtt.placeholder = '0';

			const stt = s.taboption('resource', form.Flag, 'extended_stats', _('Extended Statistics'),
				_('Extended statistics are printed from unbound-control'));
			stt.rmempty = false;
		}

		return m.render();
	},

	handleSaveApply(ev, mode) {
		const enabled = uci.get('unbound', 'ub_main', 'enabled');
		const cmd = enabled ? 'reload' : 'stop';

		const Fn = L.bind(() => {
			callRcInit('unbound', cmd);
			document.removeEventListener('uci-applied', Fn);
		});
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	}
});
