'use strict';
'require uci';
'require view';
'require poll';
'require network';
'require rpc';
'require ui';

return view.extend({
	callGetJsonStatus: rpc.declare({
		object: 'olsrinfo',
		method: 'getjsondata',
		params: ['otable', 'v4_port', 'v6_port'],
	}),

	callGetHosts: rpc.declare({
		object: 'olsrinfo',
		method: 'hosts',
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
	action_hna: function () {
		var self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_jsoninfo('hna')
				.then(function ([data, has_v4, has_v6, error]) {
					if (error) {
						reject(error);
					}

					var resolveVal = uci.get('luci_olsr', 'general', 'resolve');

					function compare(a, b) {
						if (a.proto === b.proto) {
							return a.genmask < b.genmask;
						} else {
							return a.proto < b.proto;
						}
					}
					var modifiedData;
					self
					 .callGetHosts()
						.then(function (res) {
							function matchHostnames(ip) {
								var lines = res.hosts.split('\n');
								for (var i = 0; i < lines.length; i++) {
									var ipandhostname = lines[i].trim().split(/\s+/);
									if (ipandhostname[0] === ip) {
											return ipandhostname[1];
									}
							}
							return null;
							}
							modifiedData = data.map(function (v) {
								if (resolveVal === '1') {
									var hostname = matchHostnames(v.gateway);
									if (hostname) {
										v.hostname = hostname;
									}
								}
								if (v.validityTime) {
									v.validityTime = parseInt((v.validityTime / 1000).toFixed(0));
								}
								return v;
							});

							modifiedData.sort(compare);

							var result = { hna: modifiedData, has_v4: has_v4, has_v6: has_v6 };
							resolve(result);
						})
						.catch(function (err) {
							modifiedData = data;
							console.error(err);
						});
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
		var hna_res;
		var has_v4;
		var has_v6;
		var self = this;
		return this.action_hna()
			.then(function (result) {
				hna_res = result.hna;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				var table = E('div', { 'class': 'table cbi-section-table', 'id': 'olsrd_hna' }, [
					E('div', { 'class': 'tr cbi-section-table-titles' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Announced network')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('OLSR gateway')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Validity Time')),
					]),
				]);

				var i = 1;

				var rv = [];
				for (var k = 0; k < hna_res.length; k++) {
					var entry = hna_res[k];
					rv.push({
						proto: entry.proto,
						destination: entry.destination,
						genmask: entry.genmask,
						gateway: entry.gateway,
						hostname: entry.hostname,
						validityTime: entry.validityTime,
					});
				}

				var info = rv;

				var hnadiv = document.getElementById('olsrd_hna');
				if (hnadiv) {
					var s =
						'<div class="tr cbi-section-table-titles">' +
						'<div class="th cbi-section-table-cell">Announced network</div>' +
						'<div class="th cbi-section-table-cell">OLSR gateway</div>' +
						'<div class="th cbi-section-table-cell">Validity Time</div>' +
						'</div>';

					for (var idx = 0; idx < info.length; idx++) {
						var hna = info[idx];
						var linkgw = '';
						s += '<div class="tr cbi-section-table-row cbi-rowstyle-' + (1 + (idx % 2)) + ' proto-' + hna.proto + '">';

						if (hna.proto === '6') {
							linkgw = '<a href="http://[' + hna.gateway + ']/cgi-bin-status.html">' + hna.gateway + '</a>';
						} else {
							linkgw = '<a href="http://' + hna.gateway + '/cgi-bin-status.html">' + hna.gateway + '</a>';
						}

						var validity = hna.validityTime !== undefined ? hna.validityTime + 's' : '-';
						var hostname = hna.hostname !== null ? ' / <a href="http://%q/cgi-bin-status.html">%h</a>'.format(hna.hostname, hna.hostname) : '';

						s +=
							'<div class="td cbi-section-table-cell left">' +
							(hna.destination + '/' + hna.genmask) +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							(linkgw + hostname) +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							validity +
							'</div>' +
							'</div>';
					}

					hnadiv.innerHTML = s;
				}

				var i = 1;

				for (var k = 0; k < hna_res.length; k++) {
					var route = hna_res[k];

					var tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + route.proto }, [
						E('div', { 'class': 'td cbi-section-table-cell left' }, route.destination + '/' + route.genmask),
						E('div', { 'class': 'td cbi-section-table-cell left' }, [
							route.proto === '6' ? E('a', { 'href': 'http://[' + route.gateway + ']/cgi-bin-status.html' }, route.gateway) : E('a', { 'href': 'http://' + route.gateway + '/cgi-bin-status.html' }, route.gateway),
							route.hostname ? E('span', {}, [' / ', E('a', { 'href': 'http://%q/cgi-bin-status.html'.format(route.hostname) }, '%h'.format(route.hostname))]) : '',
						]),
						E('div', { 'class': 'td cbi-section-table-cell left' }, route.validityTime ? route.validityTime + 's' : '-'),
					]);

					table.appendChild(tr);
					i = (i % 2) + 1;
				}

				var fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of currently active OLSR host net announcements')), table]);

				var h2 = E('h2', { 'name': 'content' }, _('Active host net announcements'));
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
