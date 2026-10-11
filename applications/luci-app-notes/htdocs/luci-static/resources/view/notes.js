'use strict';

'require notes.markdown as markdown';
'require rpc';
'require ui';
'require view';

const readNotes = rpc.declare({
	object: 'notes',
	method: 'read'
});

const writeNotes = rpc.declare({
	object: 'notes',
	method: 'write',
	params: [ 'contents' ]
});

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return readNotes().catch(function(error) {
			return { error: error && error.message ? error.message : String(error) };
		});
	},

	render: function(data) {
		let contents = data && typeof data.contents === 'string'
			? data.contents
			: '';
		let container;

		function showError(message, details) {
			let elements = [
				E('p', {}, message)
			];

			if (details)
				elements.push(E('p', {}, _('Details: %s').format(details)));

			ui.addNotification(null, E('div', {}, elements), 'danger');
		}

		function errorDetails(result) {
			if (result && typeof result === 'object') {
				if (typeof result.message === 'string')
					return result.message;
				if (typeof result.error === 'string')
					return result.error;
			}

			return result == null ? _('Unknown ubus error') : String(result);
		}

		// Load the preview stylesheet. 'require' only loads .js modules,
		// so the CSS has to be injected manually.
		if (!document.querySelector('link[href*="notes/notes.css"]')) {
			document.head.appendChild(E('link', {
				'rel': 'stylesheet',
				'type': 'text/css',
				'href': L.resource('notes/notes.css')
			}));
		}

		function showView() {
			let preview = E('div', {
				'class': 'notes-preview'
			});

			// markdown.js escapes user content before generating HTML.
			preview.innerHTML = markdown.renderMarkdown(contents);

			container.replaceChildren(
				preview,

				E('div', {
					'class': 'cbi-page-actions',
					'style': 'text-align: right;'
				}, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': showEdit
					}, _('Edit'))
				])
			);
		}

		function showEdit() {
			let textarea = E('textarea', {
				'style': [
					'width: 100%',
					'min-height: 500px',
					'font-family: monospace',
					'box-sizing: border-box'
				].join(';')
			}, [
				contents
			]);

			let saveButton = E('button', {
				'class': 'btn cbi-button cbi-button-save'
			}, _('Save'));

			let cancelButton = E('button', {
				'class': 'btn',
				'click': showView
			}, _('Cancel'));

			function save() {
				if (saveButton.disabled)
					return;

				let newContents = textarea.value;

				saveButton.disabled = true;
				cancelButton.disabled = true;

				return writeNotes(newContents)
					.then(function(result) {
						if (result && result.success) {
							contents = newContents;
							showView();
							return;
						}

						showError(_('Failed to write %s').format('/etc/notes.md'), errorDetails(result));
					})
					.catch(function(error) {
						let details = error && error.message
							? error.message
							: String(error);

						showError(_('Failed to write %s').format('/etc/notes.md'), details);
					})
					.finally(function() {
						saveButton.disabled = false;
						cancelButton.disabled = false;
					});
			}

			saveButton.addEventListener('click', save);

			container.replaceChildren(
				textarea,

				E('div', {
					'class': 'cbi-page-actions',
					'style': 'text-align: right;'
				}, [
					cancelButton,
					saveButton
				])
			);

			textarea.focus();
		}

		container = E('div', {}, [
			E('h2', {}, _('Notes'))
		]);

		if (data && data.error)
			showError(_('Failed to read %s').format('/etc/notes.md'), errorDetails(data));

		showView();

		return container;
	}
});
