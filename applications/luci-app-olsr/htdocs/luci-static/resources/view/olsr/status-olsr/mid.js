'use strict';
'require rpc';
'require uci';
'require ui';
'require view';
'require olsr.common_js as olsr';

return olsr.olsrview.extend({

	action_mid() {
		let self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_jsoninfo('mid')
				.then(function ([data, has_v4, has_v6, error]) {
					if (error) {
						reject(error);
					}

					function compare(a, b) {
						if (a.proto === b.proto) {
							return a.main.ipAddress < b.main.ipAddress;
						} else {
							return a.proto < b.proto;
						}
					}

					data.sort(compare);

					const result = { mids: data, has_v4: has_v4, has_v6: has_v6 };
					resolve(result);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},

	render() {
		let mids_res;
		let has_v4;
		let has_v6;

		return this.action_mid()
			.then(function (result) {
				mids_res = result.mids;
				has_v4 = result.has_v4;
				has_v6 = result.has_v6;

				const table = E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr cbi-section-table-titles' }, [E('div', { 'class': 'th cbi-section-table-cell' }, _('OLSR node')), E('div', { class: 'th cbi-section-table-cell' }, _('Secondary OLSR interfaces'))]),
				]);

				let i = 1;

				for (let mid of mids_res) {
					let aliases = '';
					for (let v of mid.aliases) {
						const sep = aliases === '' ? '' : ', ';
						aliases = v.ipAddress + sep + aliases;
					}

					let host = mid.main.ipAddress;
					if (mid.proto === '6') {
						host = '[' + mid.main.ipAddress + ']';
					}

					const tr = E('div', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + i + ' proto-' + mid.proto }, [
						E('div', { 'class': 'td cbi-section-table-cell left' }, [E('a', { 'href': 'http://' + host + '/cgi-bin-status.html' }, mid.main.ipAddress)]),
						E('div', { 'class': 'td cbi-section-table-cell left' }, aliases),
					]);

					table.appendChild(tr);
					i = (i % 2) + 1;
				}

				const fieldset = E('fieldset', { 'class': 'cbi-section' }, [E('legend', {}, _('Overview of known multiple interface announcements')), table]);

				const h2 = E('h2', { 'name': 'content' }, _('Active MID announcements'));
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
