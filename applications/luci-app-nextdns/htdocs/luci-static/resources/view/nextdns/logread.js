'use strict';
'require view';
'require poll';
'require fs';

return view.extend({
	render: function() {
		poll.add(function() {
			return L.resolveDefault(fs.exec('/sbin/logread', ['-e', 'nextdns']), { code: 1 })
			.then(function(res) {
				var content;
				if (res.code === 0)
					content = res.stdout.trim();
				if (!content)
					content = _('No nextdns related logs yet!');
				var view       = document.getElementById("view_id");
				view.value     = content;
				view.scrollTop = view.scrollHeight;
			});
		});
		return E('div', { class: 'cbi-map' },
			E('div', { class: 'cbi-section' }, [
				E('div', { class: 'cbi-section-descr' },
					_('The syslog output, pre-filtered for nextdns related messages only.')),
				E('textarea', {
					id: 'view_id',
					readonly: 'readonly',
					wrap: 'off',
					style: 'width: 100% !important;\
						height: 450px !important;\
						border: 1px solid #cccccc;\
						padding: 5px;\
						font-size: 12px;\
						font-family: monospace;\
						resize: none;\
						pointer-events: auto;\
						cursor: auto;'
				})
			])
		);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
