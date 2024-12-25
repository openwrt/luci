// SPDX-License-Identifier: Apache-2.0

'use strict';
'require dom';
'require fs';
'require poll';
'require uci';
'require view';

return view.extend({
	render: function() {
		/* Thanks to luci-app-aria2 */
		var css = '					\
			#log_textarea {				\
				padding: 10px;			\
				text-align: left;		\
			}					\
			#log_textarea pre {			\
				padding: .5rem;			\
				word-break: break-all;		\
				margin: 0;			\
			}					\
			.description {				\
				background-color: #33ccff;	\
			}';

		var log_textarea = E('div', { 'id': 'log_textarea' },
			E('img', {
				'src': L.resource('icons/loading.gif'),
				'alt': _('Loading...'),
				'style': 'vertical-align:middle'
			}, _('Collecting data...'))
		);

		poll.add(L.bind(function() {
			return fs.read_direct('/var/run/alist/log/alist.log', 'text')
			.then(function(res) {
				var log = E('pre', { 'wrap': 'pre' }, [
					res.trim() || _('Log is empty.')
				]);

				dom.content(log_textarea, log);
			}).catch(function(err) {
				var log;

				if (err.toString().includes('NotFoundError'))
					log = E('pre', { 'wrap': 'pre' }, [
						_('Log file does not exist.')
					]);
				else
					log = E('pre', { 'wrap': 'pre' }, [
						_('Unknown error: %s').format(err)
					]);

				dom.content(log_textarea, log);
			});
		}));

		return E([
			E('style', [ css ]),
			E('div', {'class': 'cbi-map'}, [
				E('div', {'class': 'cbi-section'}, [
					log_textarea,
					E('div', {'style': 'text-align:right'},
					E('small', {}, _('Refresh every %s seconds.').format(L.env.pollinterval))
					)
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
