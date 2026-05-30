'use strict';
'require uci';
'require view';
'require poll';
'require network';
'require rpc';
'require ui';
'require olsr.common_js as olsr';

return olsr.olsrview.extend({

	action_hna() {
		let self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_jsoninfo('hna')
				.then(function ([data, has_v4, has_v6, error]) {
					if (error) {
						reject(error);
					}

					const resolveVal = uci.get('luci_olsr', 'general', 'resolve');

					function compare(a, b) {
						if (a.proto === b.proto) {
							return a.genmask < b.genmask;
						} else {
							return a.proto < b.proto;
						}
					}
					let modifiedData;
					self
					 .callGetHosts()
						.then(function (res) {
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
							modifiedData = data.map(function (v) {
								if (resolveVal === '1') {
									const hostname = matchHostnames(v.gateway);
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

							const result = { hna: modifiedData, has_v4: has_v4, has_v6: has_v6 };
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
		let hna_res;
		let has_v4;
		let has_v6;
		return this.action_hna()
			.then(function (result) {
				hna_res = result.hna;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				const table = E('div', { 'class': 'table cbi-section-table', 'id': 'olsrd_hna' }, [
					E('div', { 'class': 'tr cbi-section-table-titles' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Announced network')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('OLSR gateway')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Validity Time')),
					]),
				]);

				let i = 1;

				const rv = [];
				for (let entry of hna_res) {
					rv.push({
						proto: entry.proto,
						destination: entry.destination,
						genmask: entry.genmask,
						gateway: entry.gateway,
						hostname: entry.hostname,
						validityTime: entry.validityTime,
					});
				}

				const info = rv;

				const hnadiv = document.getElementById('olsrd_hna');
				if (hnadiv) {
					let s =
						'<div class="tr cbi-section-table-titles">' +
						'<div class="th cbi-section-table-cell">Announced network</div>' +
						'<div class="th cbi-section-table-cell">OLSR gateway</div>' +
						'<div class="th cbi-section-table-cell">Validity Time</div>' +
						'</div>';

					for (let idx = 0; idx < info.length; idx++) {
						const hna = info[idx];
						let linkgw = '';
						s += '<div class="tr cbi-section-table-row cbi-rowstyle-' + (1 + (idx % 2)) + ' proto-' + hna.proto + '">';

						if (hna.proto === '6') {
							linkgw = '<a href="http://[' + hna.gateway + ']/cgi-bin-status.html">' + hna.gateway + '</a>';
						} else {
							linkgw = '<a href="http://' + hna.gateway + '/cgi-bin-status.html">' + hna.gateway + '</a>';
						}

						const validity = hna.validityTime !== undefined ? hna.validityTime + 's' : '-';
						const hostname = hna.hostname !== null ? ' / <a href="http://%q/cgi-bin-status.html">%h</a>'.format(hna.hostname, hna.hostname) : '';

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

				i = 1;

				for (let route of hna_res) {
					const tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + route.proto }, [
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

				const fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of currently active OLSR host net announcements')), table]);

				const h2 = E('h2', { 'name': 'content' }, _('Active host net announcements'));
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
