'use strict';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';
'require olsr.common_js as olsr';

return olsr.olsrview.extend({

	action_topology() {
		let self = this;
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

					const fresult = { routes: data, has_v4: has_v4, has_v6: has_v6 };
					resolve(fresult);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},

	load() {
		return Promise.all([uci.load('olsrd'), uci.load('luci_olsr')]);
	},

	render() {
		let routes_res;
		let has_v4;
		let has_v6;

		return this.action_topology()
			.then(function (result) {
				routes_res = result.routes;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;
				const table = E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr cbi-section-table-titles' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, _('OLSR node')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('Last hop')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('LQ')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('NLQ')),
						E('div', { 'class': 'th cbi-section-table-cell' }, _('ETX')),
					]),
				]);
				let i = 1;

				for (let route of routes_res) {
					const cost = (parseInt(route.tcEdgeCost) || 0).toFixed(3);
					const color = etx_color(parseInt(cost));
					const lq = (parseInt(route.linkQuality) || 0).toFixed(3);
					const nlq = (parseInt(route.neighborLinkQuality) || 0).toFixed(3);

					const tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + route.proto }, [
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

				const fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of currently known OLSR nodes')), table]);

				const h2 = E('h2', { 'name': 'content' }, _('Active OLSR nodes'));
				const divToggleButtons = E('div', { 'id': 'togglebuttons' });
				const statusOlsrLegend = E('div', {}, [
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
