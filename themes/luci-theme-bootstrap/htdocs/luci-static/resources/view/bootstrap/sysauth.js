'use strict';
'require ui';
'require view';

return view.extend({
	render() {
		const form = document.querySelector('form');
		const btn = document.querySelector('button');

		const dlg = ui.showModal(
			_('Authorization Required'),
			Array.from(document.querySelectorAll('section > *')),
			'login'
		);

		form.addEventListener('keypress', (ev) => {
			if (ev.key === 'Enter')
				btn.click();
		});

		btn.addEventListener('click', () => {
			dlg.querySelectorAll('*').forEach((node) => {
				node.style.display = 'none';
			});
			dlg.appendChild(E('div', {
				class: 'spinning'
			}, _('Logging in…')));

			form.submit();
		});

		document.querySelector('input[type="password"]').focus();

		return '';
	},

	addFooter() {},

});