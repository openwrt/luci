'use strict';
'require ui';
'require view';

return view.extend({
	render: function() {
		var form = document.querySelector('form'),
		    btn = document.querySelector('button');

		var dlg = ui.showModal(
			_('Authorization Required'),
			[].slice.call(document.querySelectorAll('section > *')),
			'login'
		);

		form.addEventListener('keypress', function(ev) {
			if (ev.key == 'Enter')
				btn.click();
		});

		btn.addEventListener('click', function() {
			dlg.querySelectorAll('*').forEach(function(node) { node.style.display = 'none' });
			dlg.appendChild(E('div', { 'class': 'spinning' }, _('Logging in…')));

			form.submit()
		});

		document.querySelector('input[type="password"]').focus();

		return '';
	},

	addFooter: function() {}
});
