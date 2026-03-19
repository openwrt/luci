'use strict';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';
'require olsr.common_js as olsr';

return olsr.olsrview.extend({

	action_smartgw() {
		let self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_jsoninfo('gateways')
				.then(function ([data, has_v4, has_v6, error]) {
					if (error) {
						reject(error);
					}

					function compare(a, b) {
						if (a.proto === b.proto) {
							return a.cost < b.cost;
						} else {
							return a.proto < b.proto;
						}
					}

					data.ipv4.sort(compare);
					data.ipv6.sort(compare);

					const result = { gws: data, has_v4: has_v4, has_v6: has_v6 };
					resolve(result);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},

	load() {
		let self = this;
		poll.add(function () {
			self.render();
		}, 5);
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},

	render() {
		let gws_res;
		let has_v4;
		let has_v6;
		return this.action_smartgw()
			.then(function (result) {
				gws_res = result.gws;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				const fieldset = E('fieldset', { 'class': 'cbi-section' }, [
					E('legend', {}, _('Overview of smart gateways in this network')),
					E('div', { 'class': 'table cbi-section-table', 'id': 'olsrd_smartgw' }, [
						E('div', { 'class': 'tr cbi-section-table-titles' }, [
							E('div', { 'class': 'th cbi-section-table-cell' }, _('Gateway')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('Selected')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('ETX')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('Hops')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('Uplink')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('Downlink')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('IPv4')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('IPv6')),
							E('div', { 'class': 'th cbi-section-table-cell' }, _('Prefix')),
						]),
					]),
				]);
				let has_smartgw;
				uci.sections('olsrd', 'olsrd', function (s) {
					if (s.SmartGateway && s.SmartGateway === 'yes') {
						has_smartgw = true;
					}
				});

				const rv = [];
				for (let gw of gws_res.ipv4) {
					gw.cost = parseFloat(gw.cost) / 1024 || 0;
					if (gw.cost >= 100) {
						gw.cost = 0;
					}

					rv.push({
						proto: gw.IPv4 ? '4' : '6',
						originator: gw.originator,
						selected: gw.selected ? _('yes') : _('no'),
						cost: gw.cost > 0 ? gw.cost.toFixed(3) : _('infinite'),
						hops: gw.hops,
						uplink: gw.uplink,
						downlink: gw.downlink,
						v4: gw.IPv4 ? _('yes') : _('no'),
						v6: gw.IPv6 ? _('yes') : _('no'),
						prefix: gw.prefix,
					});
				}

				const smartgwdiv = document.getElementById('olsrd_smartgw');
				if (smartgwdiv) {
					let s =
						'<div class="tr cbi-section-table-titles">' +
						'<div class="th cbi-section-table-cell">Gateway</div>' +
						'<div class="th cbi-section-table-cell">Selected</div>' +
						'<div class="th cbi-section-table-cell">ETX></div>' +
						'<div class="th cbi-section-table-cell">Hops></div>' +
						'<div class="th cbi-section-table-cell">Uplink</div>' +
						'<div class="th cbi-section-table-cell">Downlink</div>' +
						'<div class="th cbi-section-table-cell">IPv4</div>' +
						'<div class="th cbi-section-table-cell">IPv6</div>' +
						'<div class="th cbi-section-table-cell">Prefix</div>' +
						'</div>';

					for (let idx = 0; idx < rv.length; idx++) {
						const smartgw = rv[idx];
						let linkgw;
						s += '<div class="tr cbi-section-table-row cbi-rowstyle-' + (1 + (idx % 2)) + ' proto-' + smartgw.proto + '">';

						if (smartgw.proto == '6') {
							linkgw = '<a href="http://[' + smartgw.originator + ']/cgi-bin-status.html">' + smartgw.originator + '</a>';
						} else {
							linkgw = '<a href="http://' + smartgw.originator + '/cgi-bin-status.html">' + smartgw.originator + '</a>';
						}

						s +=
							'<div class="td cbi-section-table-cell left">' +
							linkgw +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.selected +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.cost +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.hops +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.uplink +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.downlink +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.v4 +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.v6 +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							smartgw.prefix +
							'</div>';

						s += '</div>';
					}
					smartgwdiv.innerHTML = s;
				}

				let i = 1;

				if (has_smartgw) {
					for (let gw of gws_res.ipv4) {
						gw.cost = parseInt(gw.cost) / 1024 || 0;
						if (gw.cost >= 100) {
							gw.cost = 0;
						}

						const tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + gw.proto }, [
							gw.proto === '6'
								? E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://[' + gw.originator + ']/cgi-bin-status.html' }, gw.originator)])
								: E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://' + gw.originator + '/cgi-bin-status.html' }, gw.originator)]),
							E('div', { 'class': 'td cbi-section-table-cell left' }, [gw.selected ? _('yes') : _('no')]),
							E('div', { 'class': 'td cbi-section-table-cell left' }, [gw.cost > 0 ? String.format('%.3f', gw.cost) : _('infinite')]),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.hops),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.uplink),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.downlink),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.IPv4 ? _('yes') : _('no')),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.IPv6 ? _('yes') : _('no')),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.prefix),
						]);

						fieldset.appendChild(tr);
						i = (i % 2) + 1;
					}

					const h2 = E('h2', { 'name': 'content' }, _('SmartGW announcements'));
					const divToggleButtons = E('div', { 'id': 'togglebuttons' });
					let statusOlsrCommonJs = null;

					if (has_v4 && has_v6) {
						statusOlsrCommonJs = E('script', { 'type': 'text/javascript', 'src': L.resource('common/common_js.js') });
					}

					const fresult = E([], {}, [h2, divToggleButtons, fieldset, statusOlsrCommonJs]);

					return fresult;
				} else {
					return E('h2', {}, _('SmartGateway is not configured on this system'));
				}
			})
			.catch(function (error) {
				console.error(error);
			});
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
