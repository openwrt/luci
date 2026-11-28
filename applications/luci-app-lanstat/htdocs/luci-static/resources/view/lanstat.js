'use strict';
'require view';
'require uci';

return view.extend({
	load: function() {
		return L.resolveDefault(uci.load('lanstat'), null);
	},

	render: function() {
		var port = uci.get('lanstat', 'main', 'port') || '6670';
		var host = window.location.hostname;
		if (host.indexOf(':') !== -1 && host.charAt(0) !== '[')
			host = '[' + host + ']';
		var url = 'http://' + host + ':' + port + '/';

		if (window.location.protocol === 'https:') {
			return E('div', { 'class': 'cbi-map' }, [
				E('h2', {}, _('lanstat')),
				E('div', { 'class': 'cbi-map-descr' },
					_('HTTPS LuCI cannot embed the HTTP dashboard directly. Open it in a new tab instead.')),
				E('div', { 'class': 'cbi-section' }, [
					E('p', {}, [
						E('a', {
							'class': 'btn cbi-button cbi-button-action',
							'href': url,
							'target': '_blank',
							'rel': 'noopener noreferrer'
						}, _('Open lanstat Dashboard') + ' (' + url + ')')
					])
				])
			]);
		}

		var style = E('style', {}, [
			'body[data-page="admin-status-lanstat"] { background: #0b1020 !important; overflow: hidden !important; }',
			'body[data-page="admin-status-lanstat"] #maincontent, body[data-page="admin-status-lanstat"] #maincontent.container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: #0b1020 !important; }',
			'body[data-page="admin-status-lanstat"] #view, body[data-page="admin-status-lanstat"] .cbi-map { margin: 0 !important; padding: 0 !important; }',
			'body[data-page="admin-status-lanstat"] footer { display: none !important; }'
		].join('\n'));

		var iframe = E('iframe', {
			'src': url,
			'title': _('lanstat'),
			'style': [
				'width: 100%',
				'height: calc(100vh - 54px)',
				'border: none',
				'border-radius: 0',
				'margin: 0',
				'padding: 0',
				'background: #0b1020',
				'display: block'
			].join('; ')
		});

		function syncHeight() {
			var rect = iframe.getBoundingClientRect();
			var top = rect.top > 0 ? Math.ceil(rect.top) : 0;
			iframe.style.height = Math.max(400, window.innerHeight - top) + 'px';
		}

		window.requestAnimationFrame(syncHeight);
		window.addEventListener('resize', syncHeight);

		return E('div', { 'class': 'cbi-map', 'style': 'margin-bottom: 0;' }, [
			style,
			iframe
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
