'use strict';
'require fs';
'require view';

return view.extend({
	load: function() {
		var list_files = ['conf', 'session'],
		    actions = [];
		for (var index = 0; index < list_files.length; ++index) {
			actions.push(
				fs.exec_direct('/usr/libexec/aria2-call', [ 'cat', list_files[index] ])
				.then(function(json) {
					var res = {};

					try { res = JSON.parse(json); }
					catch(err) {}

					res.file = res.file || '';
					res.content = 'content' in res ? res.content.trim() : '';
					res.rows = res.content.split('\n', 20).length;
					return res;
				})
			);
		}
		return Promise.all(actions);
	},

	render: function(data) {
		var textareaEl = function(id, data, descr) {
			return E('div', {'class': 'cbi-section'}, [
				E('div', {'class': 'cbi-section-descr'}, descr.format(data.file)),
				E('div', { 'id' : id},
					E('textarea', {
						'id': 'widget.' + id,
						'style': 'width: 100%',
						'readonly': true,
						'wrap': 'off',
						'rows': data.rows >= 20 ? 20 : data.rows + 1
					}, data.content)
				)
			]);
		};

		return E('div', {'class': 'cbi-map'}, [
			E('h2', {'name': 'content'}, '%s - %s'.format(_('Aria2'), _('Files'))),
			E('div', {'class': 'cbi-map-descr'}, _('Here shows the files used by aria2.')),
			textareaEl('config_area', data[0], _('Content of config file: <code>%s</code>')),
			textareaEl('session_area', data[1], _('Content of session file: <code>%s</code>'))
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
