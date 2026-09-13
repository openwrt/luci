'use strict';
'require dom';
'require fs';
'require poll';
'require view';

var css = '				\
#log_textarea {				\
	padding: 10px;			\
	text-align: left;		\
}					\
#log_textarea pre {			\
	padding: .5rem;		\
	word-break: break-all;		\
	margin: 0;			\
}					\
.description {				\
	background-color: #33ccff;	\
}';

function pollLog(e) {
	return Promise.all([
			fs.exec_direct('/usr/libexec/aria2-call', [ 'tail' ]).then(function(res) {
				return res.trim().split(/\n/).reverse().join('\n')
			}),
			fs.exec_direct('/sbin/logread', [ '-e', 'aria2' ]).then(function(res) {
				return res.trim().split(/\n/).reverse().slice(0, 50).join('\n')
			})
		]).then(function(data) {
			var t = E('pre', { 'wrap': 'pre' }, [
				E('div', { 'class': 'description' }, _('Last 50 lines of log file:')),
				E('br'),
				data[0] || _('No log data.'),
				E('br'),
				E('br'),
				E('div', { 'class': 'description' }, _('Last 50 lines of syslog:')),
				E('br'),
				data[1] || _('No log data.')
			]);
			dom.content(e, t);
		});
};

return view.extend({
	render: function() {
		var log_textarea = E('div', { 'id': 'log_textarea' },
			E('img', {
				'src': L.resource('icons/loading.svg'),
				'alt': _('Loading'),
				'style': 'vertical-align:middle'
			}, _('Collecting data...'))
		);

		poll.add(pollLog.bind(this, log_textarea));
		return E([
			E('style', [ css ]),
			E('div', {'class': 'cbi-map'}, [
				E('h2', {'name': 'content'}, '%s - %s'.format(_('Aria2'), _('Log Data'))),
				E('div', {'class': 'cbi-section'}, [
					log_textarea,
					E('div', {'style': 'text-align:right'},
						E('small', {}, _('Refresh every %s seconds.').format(L.env.pollinterval))
					)
				])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
