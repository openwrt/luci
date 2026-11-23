'use strict';
'require view';
'require form';
'require rpc';
'require ui';

const callStatus = rpc.declare({
	object: 'luci.sf21-dpns',
	method: 'getStatus',
	expect: { '': {} }
});

const callSetOffload = rpc.declare({
	object: 'luci.sf21-dpns',
	method: 'setOffload',
	params: [ 'lf4_offload', 'lf_offload', 'l2_bridge_iso' ],
	expect: { '': {} }
});

return view.extend({
	load() {
		return callStatus();
	},

	render(st) {
		const cf = st.configured || {};
		let m, s, o;

		/* JSONMap: a key holding an object is one named section of that type */
		m = new form.JSONMap({
			offload: {
				ipv4: cf.lf4_offload ? 'routed' : 'nat',
				ipv6: (cf.lf_offload !== false) ? 'routed' : 'nat',
				l2_bridge_iso: (cf.l2_bridge_iso !== false) ? '1' : '0'
			}
		}, _('NPU offload settings'),
			_('The NPU looks up a forwarded connection either in its NAT table or in its routing table ("LF" lookup), but not both for the same IP version. Choose which kind of traffic is offloaded; the other kind is forwarded by the CPU. Hardware flow offloading itself is enabled in the <a href="%s">Firewall settings</a>.').format(L.url('admin/network/firewall')) +
			'<br /><strong>' + _('Changes take effect after a reboot.') + '</strong>');

		s = m.section(form.NamedSection, 'offload', 'offload');
		s.addremove = false;

		o = s.option(form.ListValue, 'ipv4', _('IPv4 offloaded in hardware'));
		o.value('nat', _('NAT44 (masquerading)'));
		o.value('routed', _('Routing without NAT'));
		o.description = _('Default: NAT44, which is what a typical home router uses.');

		o = s.option(form.ListValue, 'ipv6', _('IPv6 offloaded in hardware'));
		o.value('routed', _('Routing without NAT'));
		o.value('nat', _('NAT66'));
		o.description = _('Default: routed IPv6, NAT66 is rarely used.');

		o = s.option(form.Flag, 'l2_bridge_iso', _('Bridge isolation'),
			_('Forward L2 traffic in hardware only between ports of the same bridge and honour the "isolated" port flag. Turn off only for debugging.'));
		o.default = '1';
		o.rmempty = false;

		this.map = m;

		return m.render();
	},

	handleSave() {
		const m = this.map;

		return m.save().then(() => {
			const get = (opt) => m.data.get('offload', 'offload', opt);

			return callSetOffload(
				get('ipv4') == 'routed',
				get('ipv6') == 'routed',
				get('l2_bridge_iso') == '1');
		}).then((res) => {
			if (res.error)
				ui.addNotification(null, E('p', _('Saving failed: %s').format(res.error)), 'error');
			else if (res.reboot)
				ui.addNotification(null, E('p', [
					_('Settings saved. They take effect after a reboot.'), ' ',
					E('a', { 'href': L.url('admin/system/reboot') }, _('Reboot now'))
				]), 'info');
			else
				ui.addNotification(null, E('p', _('Settings saved, they match the running configuration.')), 'info');
		});
	},

	handleSaveApply(ev) {
		return this.handleSave(ev);
	},

	handleReset: null
});
