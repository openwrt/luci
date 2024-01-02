'use strict';
'require uci';
'require view';
'require rpc';
'require ui';
'require network';

return view.extend({
	callGetJsonStatus: rpc.declare({
		object: 'olsrinfo',
		method: 'getjsondata',
		params: ['otable', 'v4_port', 'v6_port'],
	}),

	fetch_jsoninfo: function (otable) {
		var jsonreq4 = '';
		var jsonreq6 = '';
		var v4_port = parseInt(uci.get('olsrd', 'olsrd_jsoninfo', 'port') || '') || 9090;
		var v6_port = parseInt(uci.get('olsrd6', 'olsrd_jsoninfo', 'port') || '') || 9090;
		var json;
		var self = this;
		return new Promise(function (resolve, reject) {
			L.resolveDefault(self.callGetJsonStatus(otable, v4_port, v6_port), {})
				.then(function (res) {
					json = res;

					jsonreq4 = JSON.parse(json.jsonreq4);
					jsonreq6 = json.jsonreq6 !== '' ? JSON.parse(json.jsonreq6) : [];

					var jsondata4 = {};
					var jsondata6 = {};
					var data4 = [];
					var data6 = [];
					var has_v4 = false;
					var has_v6 = false;

					if (jsonreq4 === '' && jsonreq6 === '') {
						window.location.href = 'error_olsr';
						reject([null, 0, 0, true]);
						return;
					}

					if (jsonreq4 !== '') {
						has_v4 = true;
						jsondata4 = jsonreq4 || {};
						if (otable === 'status') {
							data4 = jsondata4;
						} else {
							data4 = jsondata4[otable] || [];
						}

						for (var i = 0; i < data4.length; i++) {
							data4[i]['proto'] = '4';
						}
					}

					if (jsonreq6 !== '') {
						has_v6 = true;
						jsondata6 = jsonreq6 || {};
						if (otable === 'status') {
							data6 = jsondata6;
						} else {
							data6 = jsondata6[otable] || [];
						}

						for (var j = 0; j < data6.length; j++) {
							data6[j]['proto'] = '6';
						}
					}

					for (var k = 0; k < data6.length; k++) {
						data4.push(data6[k]);
					}

					resolve([data4, has_v4, has_v6, false]);
				})
				.catch(function (err) {
					console.error(err);
					reject([null, 0, 0, true]);
				});
		});
	},

	action_interfaces: async function () {
		try {
			const [data, has_v4, has_v6, error] = await this.fetch_jsoninfo('interfaces');

			if (error) {
				throw error;
			}

			function compare(a, b) {
				return a.proto < b.proto;
			}

			const modifiedData = await Promise.all(
				data.map(async function (v) {
					const interfac = await network.getStatusByAddress(v.olsrInterface.ipAddress);
					if (interfac) {
						v.interface = interfac;
					}
					return v;
				})
			);

			modifiedData.sort(compare);

			const result = {
				iface: modifiedData,
				has_v4: has_v4,
				has_v6: has_v6,
			};

			return result;
		} catch (err) {
			throw err;
		}
	},

	load: function () {
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},
	render: function () {
		var iface_res;
		var has_v4;
		var has_v6;
		var self = this;
		return this.action_interfaces()
			.then(function (result) {
				iface_res = result.iface;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				var table = E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Interface')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Device')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('State')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('MTU')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('WLAN')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Source address')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Netmask')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Broadcast address')),
					]),
				]);
				var i = 1;

				for (var k = 0; k < iface_res.length; k++) {
					var iface = iface_res[k];

					var tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + iface.proto }, [
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface?.interface?.interface ?? '?'),
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface.name),
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface.olsrInterface.up ? _('up') : _('down')),
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface.olsrInterface.mtu),
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface.olsrInterface.wireless ? _('yes') : _('no')),
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface.olsrInterface.ipAddress),
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface.olsrInterface.ipv4Address !== '0.0.0.0' ? iface.olsrInterface.ipv4Netmask : ''),
						E('div', { 'class': 'td cbi-section-table-cell left' }, iface.olsrInterface.ipv4Address !== '0.0.0.0' ? iface.olsrInterface.ipv4Broadcast : iface.olsrInterface.ipv6Multicast),
					]);

					table.appendChild(tr);
					i = (i % 2) + 1;
				}

				var fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of interfaces where OLSR is running')), table]);

				var h2 = E('h2', { 'name': 'content' }, _('Interfaces'));
				var divToggleButtons = E('div', { 'id': 'togglebuttons' });
				var statusOlsrCommonJs = null;

				if (has_v4 && has_v6) {
					statusOlsrCommonJs = E('script', { 'type': 'text/javascript', 'src': L.resource('common/common_js.js') });
				}

				var result = E([], {}, [h2, divToggleButtons, fieldset, statusOlsrCommonJs]);

				return result;
			})
			.catch(function (error) {
				console.error(error);
			});
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});
