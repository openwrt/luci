'use strict';
'require uci';
'require view';
'require poll';
'require rpc';
'require ui';

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
	action_smartgw: function () {
		var self = this;
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

					var result = { gws: data, has_v4: has_v4, has_v6: has_v6 };
					resolve(result);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},
	load: function () {
		var self = this;
		poll.add(function () {
			self.render();
		}, 5);
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},
	render: function () {
		var gws_res;
		var has_v4;
		var has_v6;
		var self = this;
		return this.action_smartgw()
			.then(function (result) {
				gws_res = result.gws;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				var fieldset = E('fieldset', { 'class': 'cbi-section' }, [
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
				var has_smartgw;
				uci.sections('olsrd', 'olsrd', function (s) {
					if (s.SmartGateway && s.SmartGateway === 'yes') {
						has_smartgw = true;
					}
				});

				var rv = [];
				for (var k = 0; k < gws_res.ipv4.length; k++) {
					var gw = gws_res.ipv4[k];
					gw.cost = parseFloat(gw.cost) / 1024 || 0;
					if (gw.cost >= 100) {
						gw.cost = 0;
					}

					rv.push({
						proto: gw.IPv4 ? '4' : '6',
						originator: gw.originator,
						selected: gw.selected ? luci.i18n.translate('yes') : luci.i18n.translate('no'),
						cost: gw.cost > 0 ? gw.cost.toFixed(3) : luci.i18n.translate('infinite'),
						hops: gw.hops,
						uplink: gw.uplink,
						downlink: gw.downlink,
						v4: gw.IPv4 ? luci.i18n.translate('yes') : luci.i18n.translate('no'),
						v6: gw.IPv6 ? luci.i18n.translate('yes') : luci.i18n.translate('no'),
						prefix: gw.prefix,
					});
				}

				var smartgwdiv = document.getElementById('olsrd_smartgw');
				if (smartgwdiv) {
					var s =
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

					for (var idx = 0; idx < rv.length; idx++) {
						var smartgw = rv[idx];
						var linkgw;
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

				var i = 1;

				if (has_smartgw) {
					for (var k = 0; k < gws_res.ipv4.length; k++) {
						var gw = gws_res.ipv4[k];
						gw.cost = parseInt(gw.cost) / 1024 || 0;
						if (gw.cost >= 100) {
							gw.cost = 0;
						}

						var tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + gw.proto }, [
							gw.proto === '6'
								? E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://[' + gw.originator + ']/cgi-bin-status.html' }, gw.originator)])
								: E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://' + gw.originator + '/cgi-bin-status.html' }, gw.originator)]),
							E('div', { 'class': 'td cbi-section-table-cell left' }, [gw.selected ? luci.i18n.translate('yes') : luci.i18n.translate('no')]),
							E('div', { 'class': 'td cbi-section-table-cell left' }, [gw.cost > 0 ? string.format('%.3f', gw.cost) : luci.i18n.translate('infinite')]),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.hops),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.uplink),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.downlink),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.IPv4 ? luci.i18n.translate('yes') : luci.i18n.translate('no')),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.IPv6 ? luci.i18n.translate('yes') : luci.i18n.translate('no')),
							E('div', { 'class': 'td cbi-section-table-cell left' }, gw.prefix),
						]);

						fieldset.appendChild(tr);
						i = (i % 2) + 1;
					}

					var h2 = E('h2', { 'name': 'content' }, _('SmartGW announcements'));
					var divToggleButtons = E('div', { 'id': 'togglebuttons' });
					var statusOlsrCommonJs = null;

					if (has_v4 && has_v6) {
						statusOlsrCommonJs = E('script', { 'type': 'text/javascript', 'src': L.resource('common/common_js.js') });
					}

					var result = E([], {}, [h2, divToggleButtons, fieldset, statusOlsrCommonJs]);

					return result;
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
