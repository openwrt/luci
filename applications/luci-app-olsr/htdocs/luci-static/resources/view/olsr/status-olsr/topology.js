'use strict';
'require uci';
'require view';
'require poll';
'require rpc';
'require ui';

function etx_color(etx) {
	let color = '#bb3333';
	if (etx === 0) {
		color = '#bb3333';
	} else if (etx < 2) {
		color = '#00cc00';
	} else if (etx < 4) {
		color = '#ffcb05';
	} else if (etx < 10) {
		color = '#ff6600';
	}
	return color;
}

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
	action_topology: function () {
		var self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_jsoninfo('topology')
				.then(function ([data, has_v4, has_v6, error]) {
					if (error) {
						reject(error);
					}

					function compare(a, b) {
						if (a.proto === b.proto) {
							return a.tcEdgeCost < b.tcEdgeCost;
						} else {
							return a.proto < b.proto;
						}
					}

					data.sort(compare);

					var result = { routes: data, has_v4: has_v4, has_v6: has_v6 };
					resolve(result);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},
	load: function () {
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},
	render: function () {
		var routes_res;
		var has_v4;
		var has_v6;

		return this.action_topology()
			.then(function (result) {
				routes_res = result.routes;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				var table = E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr cbi-section-table-titles' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, _('OLSR node')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Last hop')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('LQ')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('NLQ')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('ETX')),
					]),
				]);
				var i = 1;

				for (var k = 0; k < routes_res.length; k++) {
					var route = routes_res[k];
					var cost = (parseInt(route.tcEdgeCost) || 0).toFixed(3);
					var color = etx_color(parseInt(cost));
					var lq = (parseInt(route.linkQuality) || 0).toFixed(3);
					var nlq = (parseInt(route.neighborLinkQuality) || 0).toFixed(3);

					var tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + route.proto }, [
						route.proto === '6'
							? E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://[' + route.destinationIP + ']/cgi-bin-status.html' }, route.destinationIP)])
							: E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://' + route.destinationIP + '/cgi-bin-status.html' }, route.destinationIP)]),
						route.proto === '6'
							? E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://[' + route.lastHopIP + ']/cgi-bin-status.html' }, route.lastHopIP)])
							: E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://' + route.lastHopIP + '/cgi-bin-status.html' }, route.lastHopIP)]),
						E('div', { 'class': 'td cbi-section-table-cell left' }, lq),
						E('div', { 'class': 'td cbi-section-table-cell left' }, nlq),
						E('div', { 'class': 'td cbi-section-table-cell left', 'style': 'background-color:' + color }, cost),
					]);

					table.appendChild(tr);
					i = (i % 2) + 1;
				}

				var fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of currently known OLSR nodes')), table]);

				var h2 = E('h2', { 'name': 'content' }, _('Active OLSR nodes'));
				var divToggleButtons = E('div', { 'id': 'togglebuttons' });
				var statusOlsrLegend = E('div', {}, [
					E('h3', {}, [_('Legend') + ':']),
					E('ul', {}, [
						E('li', {}, [E('strong', {}, [_('LQ: ')]), _('Success rate of packages received from the neighbour')]),
						E('li', {}, [E('strong', {}, [_('NLQ: ')]), _('Success rate of packages sent to the neighbour')]),
						E('li', {}, [E('strong', {}, [_('ETX: ')]), _('Expected retransmission count')]),
						E('li', { style: 'list-style: none' }, [
							E('ul', {}, [
								E('li', {}, [E('strong', { 'style': 'color:#00cc00' }, [_('Green')]), ':', _('Very good (ETX < 2)')]),
								E('li', {}, [E('strong', { 'style': 'color:#ffcb05' }, [_('Yellow')]), ':', _('Good (2 < ETX < 4)')]),
								E('li', {}, [E('strong', { 'style': 'color:#ff6600' }, [_('Orange')]), ':', _('Still usable (4 < ETX < 10)')]),
								E('li', {}, [E('strong', { 'style': 'color:#bb3333' }, [_('Red')]), ':', _('Bad (ETX > 10)')]),
							]),
						]),
						E('li', {}, [E('strong', {}, [_('SNR: ')]), _('Signal Noise Ratio in dB')]),
						E('li', { 'style': 'list-style: none' }, [
							E('ul', {}, [
								E('li', {}, [E('strong', { 'style': 'color:#00cc00' }, [_('Green')]), ':', _('Very good (SNR > 30)')]),
								E('li', {}, [E('strong', { 'style': 'color:#ffcb05' }, [_('Yellow')]), ':', _('Good (30 > SNR > 20)')]),
								E('li', {}, [E('strong', { 'style': 'color:#ff6600' }, [_('Orange')]), ':', _('Still usable (20 > SNR > 5)')]),
								E('li', {}, [E('strong', { 'style': 'color:#bb3333' }, [_('Red')]), ':', _('Bad (SNR < 5)')]),
							]),
						]),
					]),
				]);

				var statusOlsrCommonJs = null;

				if (has_v4 && has_v6) {
					statusOlsrCommonJs = E('script', { 'type': 'text/javascript', 'src': L.resource('common/common_js.js') });
				}

				var result = E([], {}, [h2, divToggleButtons, fieldset, statusOlsrLegend, statusOlsrCommonJs]);

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
