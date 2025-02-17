'use strict';
'require view';
'require uci';

return view.extend({
	load: function() {
		return uci.load('ttyd');
	},
	render: function() {
		var port = uci.get_first('ttyd', 'ttyd', 'port') || '7681',
			ssl = uci.get_first('ttyd', 'ttyd', 'ssl') || '0',
			url = uci.get_first('ttyd', 'ttyd', 'url_override');
		if (port === '0')
			return E('div', { class: 'alert-message warning' },
					_('Random ttyd port (port=0) is not supported.<br />Change to a fixed port and try again.'));
		return E('iframe', {
			src: url || ((ssl === '1' ? 'https' : 'http') + '://' + window.location.hostname + ':' + port),
			style: 'width: 100%; min-height: 500px; border: none; border-radius: 3px; resize: vertical;'
		});
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
