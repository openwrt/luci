'use strict';
'require network';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';
'require olsr.common_js as olsr';

return olsr.olsrview.extend({

	action_routes() {
		let self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_jsoninfo('routes')
				.then(function ([data, has_v4, has_v6, error]) {
					if (error) {
						reject(error);
					}

					const resolveVal = uci.get('luci_olsr', 'general', 'resolve');

					function compare(a, b) {
						if (a.proto === b.proto) {
							return a.rtpMetricCost < b.rtpMetricCost;
						} else {
							return a.proto < b.proto;
						}
					}
					let modifiedData;
					self
					 .callGetHosts()
						.then(function (res) {
							function matchHostnames(ip) {
								let lines = res.hosts.split('\n');
								for (let line of lines) {
									const ipandhostname = line.trim().split(/\s+/);
									if (ipandhostname[0] === ip) {
											return ipandhostname[1];
									}
							}
							return null;
							}
							modifiedData = data.map(function (v) {
								if (resolveVal === '1') {
									const hostname = matchHostnames(v.gateway);
									if (hostname) {
										v.hostname = hostname;
									}
								}
								return v;
							});

							modifiedData.sort(compare);

							const result = { routes: modifiedData, has_v4: has_v4, has_v6: has_v6 };
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

	load() {
		let self = this;
		poll.add(function () {
			self.render();
		}, 5);
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},

	render() {
		let routes_res;
		let has_v4;
		let has_v6;
		return this.action_routes()
			.then(function (result) {
				routes_res = result.routes;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				const table = E('div', { 'class': 'table cbi-section-table', 'id': 'olsrd_routes' }, [
					E('div', { 'class': 'tr cbi-section-table-cell' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Announced network')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('OLSR gateway')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Interface')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Metric')),
						E('div', { 'class': 'th cbi-section-table-cell' }, 'ETX'),
					]),
				]);
				const rv = [];
				for (let route of routes_res) {
					const ETX = (parseFloat(route.etx) || 0).toFixed(3);
					rv.push({
						hostname: route.hostname,
						dest: route.destination,
						genmask: route.genmask,
						gw: route.gateway,
						interface: route.networkInterface,
						metric: route.metric,
						etx: ETX,
						color: etx_color(parseFloat(ETX)),
					});
				}

				const rt = document.getElementById('olsrd_routes');
				if (rt) {
					let s =
						'<div class="tr cbi-section-table-cell">' +
						'<div class="th cbi-section-table-cell">Announced network</div>' +
						'<div class="th cbi-section-table-cell">OLSR gateway</div>' +
						'<div class="th cbi-section-table-cell">Interface</div>' +
						'<div class="th cbi-section-table-cell">Metric</div>' +
						'<div class="th cbi-section-table-cell">ETX</div>' +
						'</div>';

					for (let idx = 0; idx < rv.length; idx++) {
						const route = rv[idx];

						s +=
							'<div class="tr cbi-section-table-row cbi-rowstyle-' +
							(1 + (idx % 2)) +
							' proto-' +
							route.proto +
							'">' +
							'<div class="td cbi-section-table-cell left">' +
							route.dest +
							'/' +
							route.genmask +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							'<a href="http://' +
							route.gw +
							'/cgi-bin-status.html">' +
							route.gw +
							'</a>';

						if (route.hostname) {
							if (route.proto == '6') {
								s += ' / <a href="http://[%q]/cgi-bin-status.html">%h</a>'.format(route.hostname, route.hostname || '')
							} else {
								s += ' / <a href="http://%q/cgi-bin-status.html">%h</a>'.format(route.hostname, route.hostname || '');
							}
						}

						s +=
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							route.interface +
							'</div>' +
							'<div class="td cbi-section-table-cell left">' +
							route.metric +
							'</div>' +
							'<div class="td cbi-section-table-cell left" style="background-color:' +
							route.color +
							'">' +
							(route.etx || '?') +
							'</div>' +
							'</div>';
					}

					rt.innerHTML = s;
				}

				let i = 1;

				for (let route of routes_res) {
					const ETX = parseInt(route.etx) || 0;
					const color = etx_color(ETX);

					const tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + route.proto }, [
						E('div', { 'class': 'td cbi-section-table-cell left' }, route.destination + '/' + route.genmask),
						E('div', { 'class': 'td cbi-section-table-cell left' }, [
							route.proto === '6' ? E('a', { 'href': 'http://[' + route.gateway + ']/cgi-bin-status.html' }, route.gateway) : E('a', { 'href': 'http://' + route.gateway + '/cgi-bin-status.html' }, route.gateway),
							route.hostname ? E('span', {}, [' / ', E('a', { 'href': 'http://%q/cgi-bin-status.html'.format(route.hostname) }, '%h'.format(route.hostname))]) : '',
						]),
						E('div', { 'class': 'td cbi-section-table-cell left' }, route.networkInterface),
						E('div', { 'class': 'td cbi-section-table-cell left' }, route.metric),
						E('div', { 'class': 'td cbi-section-table-cell left', 'style': 'background-color:' + color }, [ETX.toFixed(3)]),
					]);

					table.appendChild(tr);
					i = (i % 2) + 1;
				}

				const fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of currently known routes to other OLSR nodes')), table]);

				const h2 = E('h2', { 'name': 'content' }, _('Known OLSR routes'));
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
					statusOlsrCommonJs = E('script', { 'type': 'text/javascript', 'src': L.resource('common/common_js.js') });
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
