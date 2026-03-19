'use strict';
'require network';
'require poll';
'require uci';
'require ui';
'require view';
'require olsr.common_js as olsr';

return olsr.olsrview.extend({

	async action_neigh() {
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

			const assoclist = [];
			const resolveVal = uci.get('luci_olsr', 'general', 'resolve');
			let devices;
			let defaultgw;

			devices = await network.getWifiDevices();
			const rts = await network.getWANNetworks();

			rts.forEach(function (rt) {
				defaultgw = rt.getGatewayAddr() || '0.0.0.0';
			});

			const networkPromises = devices.map(async function (dev) {
				const networks = await dev.getWifiNetworks();

				const promiseArr = networks.map(async function (net) {
					const radio = await net.getDevice();
					const [ifname, devnetwork, device, list] = await Promise.all([net.getIfname(), net.getNetworkNames(), radio ? radio.getName() : null, net.getAssocList()]);

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
			let res = '';
			let self = this;
			await (async function () {
				try {
					res = await self.callGetHosts();
				}
				catch (e) {
					console.error(e);
				}
			})();

			function matchHostnames(ip) {
				const lines = res.hosts.split('\n');
				for (let line of lines) {
					const ipandhostname = line.trim().split(/\s+/);
					if (ipandhostname[0] === ip) {
						return ipandhostname[1];
					}
				}
				return null;
			}
			const modifiedData = await Promise.all(
				data.map(async function (v) {
					let snr = 0;
					let signal = 0;
					let noise = 0;

					if (resolveVal === '1') {
						const hostname = matchHostnames(v.remoteIP);
						if (hostname) {
							v.hostname = hostname;
						}
					}
					const hosthints = await network.getHostHints();
					const networkStatus = await network.getStatusByAddress(v.localIP);
					const lmac = await hosthints.getMACAddrByIPAddr(v.localIP);
					const rmac = await hosthints.getMACAddrByIPAddr(v.remoteIP);

					for (let val of assoclist) {
						if (networkStatus != undefined && val.network === networkStatus.interface && val.list) {
							for (let assocmac in val.list) {
								const assot = val.list[assocmac];
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

			const result = { links: modifiedData, has_v4: has_v4, has_v6: has_v6 };
			return result;
		} catch (err) {
			console.error(err);
			throw err;
		}
	},

	load() {
		let self = this;
		poll.add(function () {
			self.render();
		}, 5);
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},

	render() {
		let neigh_res;
		let has_v4;
		let has_v6;

		return this.action_neigh()
			.then(function (result) {
				neigh_res = result.links;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;

				const table = E('div', { 'class': 'table cbi-section-table', 'id': 'olsr_neigh_table' }, [
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

				const rv = [];
				for (let link of neigh_res) {
					link.linkCost = (link.linkCost).toFixed(3) || 0;
					if (link.linkCost === 4194304) {
						link.linkCost = 0;
					}
					const color = etx_color(link.linkCost);
					const snr_color = snr_colors(link.snr);
					let defaultgw_color = '';
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

				const nt = document.getElementById('olsr_neigh_table');
				if (nt) {
					let s =
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

					for (let idx = 0; idx < rv.length; idx++) {
						const neigh = rv[idx];

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

				let i = 1;

				for (let link of neigh_res) {
					link.linkCost = Number(link.linkCost).toFixed(3) || 0;
					if (link.linkCost === 4194304) {
						link.linkCost = 0;
					}

					const color = etx_color(link.linkCost);
					const snr_color = snr_colors(link.snr);

					if (link.snr === 0) {
						link.snr = '?';
					}

					let defaultgw_color = '';
					if (link.defaultgw === 1) {
						defaultgw_color = '#ffff99';
					}

					const tr = E(
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

				const fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of currently established OLSR connections')), table]);

				const h2 = E('h2', { 'name': 'content' }, _('OLSR connections'));
				const divToggleButtons = E('div', { 'id': 'togglebuttons' });
				const statusOlsrLegend = E('div', {}, [
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

				let statusOlsrCommonJs = null;

				if (has_v4 && has_v6) {
					statusOlsrCommonJs = E('script', {
						type: 'text/javascript',
						src: L.resource('common/common_js.js'),
					});
				}

				const fresult = E([], {}, [h2, divToggleButtons, fieldset, statusOlsrLegend, statusOlsrCommonJs]);

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
