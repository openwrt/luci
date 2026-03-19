'use strict';
'require network';
'require rpc';
'require uci';
'require ui';
'require view';
'require olsr.common_js as olsr';

return olsr.olsrview.extend({

	async action_interfaces() {
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
	},

	load() {
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},

	render() {
		let iface_res;
		let has_v4;
		let has_v6;
		return this.action_interfaces()
			.then(function (result) {
				iface_res = result.iface;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				const table = E('div', { 'class': 'table cbi-section-table' }, [
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
				let i = 1;

				for (let iface of iface_res) {
					const tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + iface.proto }, [
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

				const fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of interfaces where OLSR is running')), table]);

				const h2 = E('h2', { 'name': 'content' }, _('Interfaces'));
				const divToggleButtons = E('div', { 'id': 'togglebuttons' });
				let statusOlsrCommonJs = null;

				if (has_v4 && has_v6) {
					statusOlsrCommonJs = E('script', { 'type': 'text/javascript', 'src': L.resource('common/common_js.js') });
				}

				const fresult = E([], {}, [h2, divToggleButtons, fieldset, statusOlsrCommonJs]);

				return fresult;
			})
			.catch(function (error) {
				console.error(error);
			});
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});
