'use strict';
'require view';
'require dom';
'require uci';
'require fs';
'require ui';
'require rpc';
'require form';
'require tools.widgets as widgets';

const ETHERWAKE_BIN = '/usr/bin/etherwake';
const WAKEONLAN_BIN = '/usr/bin/wakeonlan';

return view.extend({
	formdata: { wol: {} },

	callStat: rpc.declare({
		object: 'luci.wol',
		method: 'stat',
		params: [ ],
		expect: { }
	}),

	callExec: rpc.declare({
		object: 'luci.wol',
		method: 'exec',
		params: [ 'name', 'args' ],
		expect: { }
	}),

	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			L.resolveDefault(this.callStat()),
			this.callHostHints(),
			uci.load('luci-wol')
		]);
	},

	render([stat, hosts]) {
			var has_ewk = stat && stat.etherwake,
				has_wol = stat && stat.wakeonlan,
		    m, s, o;

		if (!has_ewk && !has_wol) {
			return E('div', { 'class': 'alert-message warning' }, [
				E('p', _('No Wake on LAN utilities found. Please install either the "etherwake" or "wakeonlan" package.'))
			]);
		}

		this.formdata.has_ewk = has_ewk;
		this.formdata.has_wol = has_wol;

		m = new form.Map('luci-wol', _('Wake on LAN'),
			_('Wake on LAN is a mechanism to boot computers remotely in the local network.'));

		s = m.section(form.NamedSection, 'defaults', 'wol');

		if (has_ewk && has_wol) {
			o = s.option(form.ListValue, 'executable', _('WoL program'),
				_('Sometimes only one of the two tools works. If one fails, try the other one'));

			o.value(ETHERWAKE_BIN, 'Etherwake');
			o.value(WAKEONLAN_BIN, 'Wakeonlan');
		}

		if (has_ewk) {
			o = s.option(widgets.DeviceSelect, 'iface', _('Network interface to use'),
				_('Specifies the interface the WoL packet is sent on'));

			o.rmempty = false;
			o.noaliases = true;
			o.noinactive = true;

			uci.sections('etherwake', 'target', function(section) {
				if (section.mac && section.name) {
					// Create a host entry if it doesn't exist
					if (!hosts[section.mac]) {
						hosts[section.mac] = { name: section.name };
					}
				}
			});

			if (has_wol)
				o.depends('executable', ETHERWAKE_BIN);
		}

		o = s.option(form.Value, 'mac', _('Host to wake up'),
			_('Choose the host to wake up or enter a custom MAC address to use'));

		o.rmempty = false;

		L.sortedKeys(hosts).forEach(function(mac) {
			o.value(mac, E([], [ mac, ' (', E('strong', [
				hosts[mac].name ||
				L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4)[0] ||
				L.toArray(hosts[mac].ip6addrs || hosts[mac].ipv6)[0] ||
				'?'
			]), ')' ]));
		});

		if (has_ewk) {
			o = s.option(form.Flag, 'broadcast', _('Send to broadcast address'));
			o.rmempty = false;

			if (has_wol)
				o.depends('executable', ETHERWAKE_BIN);
		}

		return m.render();
	},

	handleWakeup: function(ev) {
		var map = document.querySelector('#maincontent .cbi-map'),
		    self = this;

		return dom.callClassMethod(map, 'save').then(function() {
			var mac = uci.get('luci-wol', 'defaults', 'mac');
			if (!mac)
				return alert(_('No target host specified!'));

			var bin = uci.get('luci-wol', 'defaults', 'executable');
			
			if (bin == ETHERWAKE_BIN && !self.formdata.has_ewk)
				bin = WAKEONLAN_BIN;
			else if (bin == WAKEONLAN_BIN && !self.formdata.has_wol)
				bin = ETHERWAKE_BIN;
			else if (!bin)
				bin = self.formdata.has_ewk ? ETHERWAKE_BIN : WAKEONLAN_BIN;
			
			var args = [];

			if (bin == ETHERWAKE_BIN) {
				args.push('-D', '-i', uci.get('luci-wol', 'defaults', 'iface'));

				if (uci.get('luci-wol', 'defaults', 'broadcast') == '1')
					args.push('-b');

				args.push(mac);
			}
			else {
				args.push(mac);
			}

			ui.showModal(_('Waking host'), [
				E('p', { 'class': 'spinning' }, [ _('Starting WoL utility…') ])
			]);
			
			return self.callExec(bin, args).then(function(res) {
				ui.showModal(_('Waking host'), [
					res.stdout ? E('p', [ res.stdout ]) : '',
					res.stderr ? E('pre', [ res.stderr ]) : '',
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-primary',
							'click': ui.hideModal
						}, [ _('Dismiss') ])
					])
				]);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, [
					E('p', [ _('Waking host failed: '), err ])
				]);
			});
		});
	},

	addFooter: function() {
		if (!this.formdata.has_ewk && !this.formdata.has_wol) {
			return null;
		}

		return E('div', { 'class': 'cbi-page-actions' }, [
			E('button', {
				'class': 'cbi-button cbi-button-save',
				'click': L.ui.createHandlerFn(this, 'handleWakeup')
			}, [ _('Wake up host') ])
		]);
	}
});
