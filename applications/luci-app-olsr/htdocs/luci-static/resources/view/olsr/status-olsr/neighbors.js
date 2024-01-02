'use strict';
'require uci';
'require view';
'require poll';
'require rpc';
'require ui';
'require network';

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

function snr_colors(snr) {
	let color = '#bb3333';
	if (snr === 0) {
		color = '#bb3333';
	} else if (snr > 30) {
		color = '#00cc00';
	} else if (snr > 20) {
		color = '#ffcb05';
	} else if (snr > 5) {
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

	action_neigh: async function () {
		try {
			const [data, has_v4, has_v6, error] = await this.fetch_jsoninfo('links');

			if (error) {
				throw error;
			}

			function compare(a, b) {
				if (a.proto === b.proto) {
					return a.linkCost < b.linkCost;
				} else {
					return a.proto < b.proto;
				}
			}

			var assoclist = [];
			var resolveVal = uci.get('luci_olsr', 'general', 'resolve');
			var devices;
			var defaultgw;

			devices = await network.getWifiDevices();
			var rts = await network.getWANNetworks();

			rts.forEach(function (rt) {
				defaultgw = rt.getGatewayAddr() || '0.0.0.0';
			});

			var networkPromises = devices.map(async function (dev) {
				var networks = await dev.getWifiNetworks();

				var promiseArr = networks.map(async function (net) {
					var radio = await net.getDevice();
					var [ifname, devnetwork, device, list] = await Promise.all([net.getIfname(), net.getNetworkNames(), radio ? radio.getName() : null, net.getAssocList()]);

					assoclist.push({
						ifname: ifname,
						network: devnetwork[0],
						device: device,
						list: list,
					});
				});

				await Promise.all(promiseArr);
			});

			await Promise.all(networkPromises);
			var res = '';
			var self = this;
			await (async function () {
				try {
					res = await self.callGetHosts();
				}
				catch (e) {
					console.error(e);
				}
			})();

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
			var modifiedData = await Promise.all(
				data.map(async function (v) {
					var snr = 0;
					var signal = 0;
					var noise = 0;
					var mac = '';
					var ip;
					var neihgt = [];

					if (resolveVal === '1') {
						var hostname = matchHostnames(v.remoteIP);
						if (hostname) {
							v.hostname = hostname;
						}
					}
					var hosthints = await network.getHostHints();
					var networkStatus = await network.getStatusByAddress(v.localIP);
					var lmac = await hosthints.getMACAddrByIPAddr(v.localIP);
					var rmac = await hosthints.getMACAddrByIPAddr(v.remoteIP);

					for (let i = 0; i < assoclist.length; i++) {
						var val = assoclist[i];
						if (networkStatus != undefined && val.network === networkStatus.interface && val.list) {
							for (var assocmac in val.list) {
								var assot = val.list[assocmac];
								if (rmac == assot.mac) {
									signal = parseInt(assot.signal);
									noise = parseInt(assot.noise);
									snr = noise * -1 - signal * -1;
								}
							}
						}
					}

					if (networkStatus) {
						v.interface = networkStatus;
					}
					v.snr = snr || null;
					v.signal = signal || null;
					v.noise = noise || null;
					if (rmac) {
						v.remoteMAC = rmac;
					}
					if (lmac) {
						v.localMAC = lmac;
					}

					if (defaultgw === v.remoteIP) {
						v.defaultgw = 1;
					}
					return v;
				})
			);

			modifiedData.sort(compare);

			var result = { links: modifiedData, has_v4: has_v4, has_v6: has_v6 };
			return result;
		} catch (err) {
			console.error(err);
			throw err;
		}
	},

	load: function () {
		var self = this;
		poll.add(function () {
			self.render();
		}, 5);
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},
	render: function () {
		var neigh_res;
		var has_v4;
		var has_v6;
		var self = this;

		return this.action_neigh()
			.then(function (result) {
				neigh_res = result.links;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;

				var table = E('div', { 'class': 'table cbi-section-table', 'id': 'olsr_neigh_table' }, [
					E('div', { 'class': 'tr cbi-section-table-cell' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Neighbour IP')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Hostname')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Interface')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Local interface IP')),
						E('div', { 'class': 'th cbi-section-table-cell' }, 'LQ'),
						E('div', { 'class': 'th cbi-section-table-cell' }, 'NLQ'),
						E('div', { 'class': 'th cbi-section-table-cell' }, 'ETX'),
						E('div', { 'class': 'th cbi-section-table-cell' }, 'SNR'),
					]),
				]);

				var rv = [];
				for (var k = 0; k < neigh_res.length; k++) {
					var link = neigh_res[k];
					link.linkCost = (link.linkCost).toFixed(3) || 0;
					if (link.linkCost === 4194304) {
						link.linkCost = 0;
					}
					var color = etx_color(link.linkCost);
					var snr_color = snr_colors(link.snr);
					var defaultgw_color = '';
					if (link.defaultgw === 1) {
						defaultgw_color = '#ffff99';
					}

					rv.push({
						rip: link.remoteIP,
						hn: link.hostname,
						lip: link.localIP,
						ifn: link.interface,
						lq: link.linkQuality.toFixed(3),
						nlq: link.neighborLinkQuality.toFixed(3),
						cost: link.linkCost,
						snr: link.snr,
						signal: link.signal,
						noise: link.noise,
						color: color,
						snr_color: snr_color,
						dfgcolor: defaultgw_color,
						proto: link.proto,
					});
				}

				var nt = document.getElementById('olsr_neigh_table');
				if (nt) {
					var s =
						'<div class="tr cbi-section-table-cell">' +
						'<div class="th cbi-section-table-cell">Neighbour IP</div>' +
						'<div class="th cbi-section-table-cell">Hostname</div>' +
						'<div class="th cbi-section-table-cell">Interface</div>' +
						'<div class="th cbi-section-table-cell">Local interface IP</div>' +
						'<div class="th cbi-section-table-cell">LQ</div>' +
						'<div class="th cbi-section-table-cell">NLQ</div>' +
						'<div class="th cbi-section-table-cell">ETX</div>' +
						'<div class="th cbi-section-table-cell">SNR</div>' +
						'</div>';

					for (var idx = 0; idx < rv.length; idx++) {
						var neigh = rv[idx];

						if (neigh.proto == '6') {
							s +=
								'<div class="tr cbi-section-table-row cbi-rowstyle-' +
								(1 + (idx % 2)) +
								' proto-' +
								neigh.proto +
								'">' +
								'<div class="td cbi-section-table-cell left" style="background-color:' +
								neigh.dfgcolor +
								'"><a href="http://[' +
								neigh.rip +
								']/cgi-bin-status.html">' +
								neigh.rip +
								'</a></div>';
						} else {
							s +=
								'<div class="tr cbi-section-table-row cbi-rowstyle-' +
								(1 + (idx % 2)) +
								' proto-' +
								neigh.proto +
								'">' +
								'<div class="td cbi-section-table-cell left" style="background-color:' +
								neigh.dfgcolor +
								'"><a href="http://' +
								neigh.rip +
								'/cgi-bin-status.html">' +
								neigh.rip +
								'</a></div>';
						}
						if (neigh.hn) {
							s += '<div class="td cbi-section-table-cell left" style="background-color:' + neigh.dfgcolor + '"><a href="http://' + neigh.hn + '/cgi-bin-status.html">' + neigh.hn + '</a></div>';
						} else {
							s += '<div class="td cbi-section-table-cell left" style="background-color:' + neigh.dfgcolor + '">?</div>';
						}
						s +=
							'<div class="td cbi-section-table-cell left" style="background-color:' +
							neigh.dfgcolor +
							'">' +
							(neigh?.ifn?.interface ?? '?') +
							'</div>' +
							'<div class="td cbi-section-table-cell left" style="background-color:' +
							neigh.dfgcolor +
							'">' +
							neigh.lip +
							'</div>' +
							'<div class="td cbi-section-table-cell left" style="background-color:' +
							neigh.dfgcolor +
							'">' +
							neigh.lq +
							'</div>' +
							'<div class="td cbi-section-table-cell left" style="background-color:' +
							neigh.dfgcolor +
							'">' +
							neigh.nlq +
							'</div>' +
							'<div class="td cbi-section-table-cell left" style="background-color:' +
							neigh.color +
							'">' +
							neigh.cost +
							'</div>' +
							'<div class="td cbi-section-table-cell left" style="background-color:' +
							neigh.snr_color +
							'" title="Signal: ' +
							neigh.signal +
							' Noise: ' +
							neigh.noise +
							'">' +
							(neigh.snr || '?') +
							'</div>' +
							'</div>';
					}

					nt.innerHTML = s;
				}

				var i = 1;

				for (var k = 0; k < neigh_res.length; k++) {
					var link = neigh_res[k];
					link.linkCost = Number(link.linkCost).toFixed(3) || 0;
					if (link.linkCost === 4194304) {
						link.linkCost = 0;
					}

					color = etx_color(link.linkCost);
					snr_color = snr_colors(link.snr);

					if (link.snr === 0) {
						link.snr = '?';
					}

					var defaultgw_color = '';
					if (link.defaultgw === 1) {
						defaultgw_color = '#ffff99';
					}

					var tr = E(
						'div',
						{
							'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + link.proto,
						},
						[
							link.proto === '6'
								? E(
									'div',
									{
										'class': 'td cbi-section-table-cell left',
										'style': 'background-color:' + defaultgw_color,
									},
									[
										E(
											'a',
											{
												'href': 'http://[' + link.remoteIP + ']/cgi-bin-status.html',
											},
											link.remoteIP
										),
									]
								)
								: E(
									'div',
									{
										'class': 'td cbi-section-table-cell left',
										'style': 'background-color:' + defaultgw_color,
									},
									[
										E(
											'a',
											{
												'href': 'http://' + link.remoteIP + '/cgi-bin-status.html',
											},
											link.remoteIP
										),
									]
								),
							E(
								'div',
								{
									'class': 'td cbi-section-table-cell left',
									'style': 'background-color:' + defaultgw_color,
								},
								[E('a', { 'href': 'http://%q/cgi-bin-status.html'.format(link.hostname) }, '%h'.format(link.hostname))]
							),
							E(
								'div',
								{
									'class': 'td cbi-section-table-cell left',
									'style': 'background-color:' + defaultgw_color,
								},
								link?.interface?.interface ?? '?'
							),
							E(
								'div',
								{
									'class': 'td cbi-section-table-cell left',
									'style': 'background-color:' + defaultgw_color,
								},
								link.localIP
							),
							E(
								'div',
								{
									'class': 'td cbi-section-table-cell left',
									'style': 'background-color:' + defaultgw_color,
								},
								[E('div', {}, link.linkQuality.toFixed(3))]
							),
							E(
								'div',
								{
									'class': 'td cbi-section-table-cell left',
									'style': 'background-color:' + defaultgw_color,
								},
								[E('div', {}, link.neighborLinkQuality.toFixed(3))]
							),
							E(
								'div',
								{
									'class': 'td cbi-section-table-cell left',
									'style': 'background-color:' + color,
								},
								[E('div', {}, link.linkCost)]
							),
							E(
								'div',
								{
									'class': 'td cbi-section-table-cell left',
									'style': 'background-color:' + snr_color,
									'title': 'Signal: ' + link.signal + ' Noise: ' + link.noise,
								},
								link.snr
							),
						]
					);

					table.appendChild(tr);
					i = (i % 2) + 1;
				}

				var fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of currently established OLSR connections')), table]);

				var h2 = E('h2', { 'name': 'content' }, _('OLSR connections'));
				var divToggleButtons = E('div', { 'id': 'togglebuttons' });
				var statusOlsrLegend = E('div', {}, [
					E('h3', {}, [_('Legend') + ':']),
					E('ul', {}, [
						E('li', {}, [E('strong', {}, [_('LQ: ')]), _('Success rate of packages received from the neighbour')]),
						E('li', {}, [E('strong', {}, [_('NLQ: ')]), _('Success rate of packages sent to the neighbour')]),
						E('li', {}, [E('strong', {}, [_('ETX: ')]), _('Expected retransmission count')]),
						E('li', { 'style': 'list-style: none' }, [
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
					statusOlsrCommonJs = E('script', {
						type: 'text/javascript',
						src: L.resource('common/common_js.js'),
					});
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
