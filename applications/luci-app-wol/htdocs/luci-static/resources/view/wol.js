'use strict';
'require view';
'require dom';
'require uci';
'require fs';
'require ui';
'require rpc';
'require form';
'require tools.widgets as widgets';

return view.extend({
	formdata: { wol: {} },

	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/bin/etherwake')),
			L.resolveDefault(fs.stat('/usr/bin/wol')),
			this.callHostHints(),
			uci.load('etherwake')
		]);
	},

	render: function(data) {
		var has_ewk = data[0],
		    has_wol = data[1],
		    hosts = data[2],
		    m, s, o;

		this.formdata.has_ewk = has_ewk;
		this.formdata.has_wol = has_wol;

		m = new form.JSONMap(this.formdata, _('Wake on LAN'),
			_('Wake on LAN is a mechanism to boot computers remotely in the local network.'));

		s = m.section(form.NamedSection, 'wol');

		if (has_ewk && has_wol) {
			o = s.option(form.ListValue, 'executable', _('WoL program'),
				_('Sometimes only one of the two tools works. If one fails, try the other one'));

			o.value('/usr/bin/etherwake', 'Etherwake');
			o.value('/usr/bin/wol', 'WoL');
		}

		if (has_ewk) {
			o = s.option(widgets.DeviceSelect, 'iface', _('Network interface to use'),
				_('Specifies the interface the WoL packet is sent on'));

			o.default = uci.get('etherwake', 'setup', 'interface');
			o.rmempty = false;
			o.noaliases = true;
			o.noinactive = true;

			if (has_wol)
				o.depends('executable', '/usr/bin/etherwake');
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

			if (has_wol)
				o.depends('executable', '/usr/bin/etherwake');
		}

		return m.render();
	},

	handleWakeup: function(ev) {
		var map = document.querySelector('#maincontent .cbi-map'),
		    data = this.formdata;

		return dom.callClassMethod(map, 'save').then(function() {
			if (!data.wol.mac)
				return alert(_('No target host specified!'));

			var bin = data.executable || (data.has_ewk ? '/usr/bin/etherwake' : '/usr/bin/wol'),
			    args = [];

			if (bin == '/usr/bin/etherwake') {
				args.push('-D', '-i', data.wol.iface);

				if (data.wol.broadcast == '1')
					args.push('-b');

				args.push(data.wol.mac);
			}
			else {
				args.push('-v', data.wol.mac);
			}

			ui.showModal(_('Waking host'), [
				E('p', { 'class': 'spinning' }, [ _('Starting WoL utility…') ])
			]);

			return fs.exec(bin, args).then(function(res) {
				ui.showModal(_('Waking host'), [
					res.stderr ? E('p', [ res.stdout ]) : '',
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
		return E('div', { 'class': 'cbi-page-actions' }, [
			E('button', {
				'class': 'cbi-button cbi-button-save',
				'click': L.ui.createHandlerFn(this, 'handleWakeup')
			}, [ _('Wake up host') ])
		]);
	}
});
