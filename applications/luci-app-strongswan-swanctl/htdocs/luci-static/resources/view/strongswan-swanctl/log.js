'use strict';
'require poll';
'require rpc';
'require ui';
'require view';

const callReadLog = rpc.declare({
	object: 'luci.swanctl',
	method: 'read-log',
	params: ['lines'],
	expect: { '': {} }
});

return view.extend({
	lines: 250,
	filter: '',

	retrieveLog: function () {
		return L.resolveDefault(callReadLog(this.lines), {});
	},

	renderLog: function (log) {
		const textarea = document.getElementById('swanctl-log');
		const path = document.getElementById('swanctl-log-path');
		const notice = document.getElementById('swanctl-log-notice');
		if (!textarea)
			return;

		/*
		 * read-log returns the content of the log file as one string.
		 * The filter works on single lines, so the string has to be split
		 * into lines only if a filter is set. Otherwise it is used as is.
		 */
		let text = log.data ?? '';
		if (this.filter)
			text = text.split('\n')
				.filter(line => line.toLowerCase().includes(this.filter.toLowerCase()))
				.join('\n');

		/* stay at the end of the log if the user did not scroll up */
		const atBottom = textarea.scrollTop + textarea.clientHeight >= textarea.scrollHeight - 5;

		textarea.value = text;
		textarea.placeholder = log.error ? _('The log file %s could not be read.').format(log.path ?? '') : '';

		if (atBottom)
			textarea.scrollTop = textarea.scrollHeight;

		if (path)
			path.textContent = log.path ?? '';

		if (notice)
			notice.style.display = log.enabled ? 'none' : '';
	},

	pollLog: function () {
		return this.retrieveLog().then(L.bind(this.renderLog, this));
	},

	load: function () {
		return this.retrieveLog();
	},

	render: function (log) {
		const linesSelect = E('select', { 'class': 'cbi-input-select' },
			[100, 250, 500, 1000, 5000].map(n =>
				E('option', { 'value': n, 'selected': (n == this.lines) ? '' : null }, n)));

		const filterInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'text',
			'placeholder': _('Filter')
		});

		linesSelect.addEventListener('change', L.bind(function () {
			this.lines = +linesSelect.value;
			this.pollLog();
		}, this));

		filterInput.addEventListener('input', L.bind(function () {
			this.filter = filterInput.value;
			this.pollLog();
		}, this));

		const textarea = E('textarea', {
			'id': 'swanctl-log',
			'readonly': 'readonly',
			'wrap': 'off',
			'rows': 30,
			'style': 'width:100%; font-family:monospace; font-size:smaller'
		});

		/* set as property, the content of E() would be parsed as HTML */
		textarea.value = log.data ?? '';
		textarea.placeholder = log.error ? _('The log file %s could not be read.').format(log.path ?? '') : '';

		const node = E([], [
			E('h2', _('IPsec Log')),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Shows the end of the strongswan log file:'),
				' ',
				E('code', { 'id': 'swanctl-log-path' }, [ log.path ?? '' ])
			]),
			E('div', {
				'id': 'swanctl-log-notice',
				'class': 'alert-message info',
				'style': log.enabled ? 'display:none' : null
			}, _('File logging is disabled. You can enable it on the <a href="%s">service configuration page</a>.')
				.format(L.url('admin/vpn/strongswan-swanctl/strongswan'))),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display:flex; flex-wrap:wrap; gap:.5em; margin-bottom:.5em' }, [
					E('label', {}, [ _('Lines'), ' ', linesSelect ]),
					filterInput,
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'click': function () {
							textarea.scrollTop = textarea.scrollHeight;
						}
					}, _('Scroll to tail', 'scroll to bottom (the tail) of the log file'))
				]),
				textarea
			])
		]);

		/* scrollHeight is only known once the view is attached to the page */
		requestAnimationFrame(() => textarea.scrollTop = textarea.scrollHeight);

		poll.add(L.bind(this.pollLog, this));

		return node;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
