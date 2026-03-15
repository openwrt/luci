'use strict';
'require view';
'require form';
'require fs';
'require ui';

/*
	include custom CSS
*/
document.querySelector('head').appendChild(E('link', {
	'rel': 'stylesheet',
	'type': 'text/css',
	'href': L.resource('view/adblock/custom.css')
}));

/*
	module-level file size set during render, read by observer
*/
let fileSize = 0;

/*
	button state helper
*/
function updateButtons() {
	const buttons = document.querySelectorAll('#btnClear, #btnCreate, #btnSave, #btnUpload, #btnDownload');
	if (fileSize === 0) {
		if (buttons[1]) buttons[1].removeAttribute('disabled');
		if (buttons[2]) buttons[2].removeAttribute('disabled');
	} else {
		if (buttons[0]) buttons[0].removeAttribute('disabled');
		if (buttons[3]) buttons[3].removeAttribute('disabled');
		if (buttons[4]) buttons[4].removeAttribute('disabled');
	}
}

/*
	observe DOM changes
*/
const observer = new MutationObserver(function (mutations) {
	if (mutations) {
		const inputs = document.querySelectorAll('input');
		inputs.forEach(function (input) {
			input.setAttribute('autocomplete', 'off')
			input.setAttribute('autocorrect', 'off')
			input.setAttribute('autocapitalize', 'off')
			input.setAttribute('spellcheck', false)
		})
		const labels = document.querySelectorAll('label[for^="widget.cbid.json"][for$="name"]');
		labels.forEach(function (label) {
			label.setAttribute("style", "font-weight: bold !important; color: #595 !important;");
		})
		updateButtons();
	}
});

const targetNode = document.getElementById('view');
const observerConfig = {
	childList: true,
	subtree: true,
	attributes: false,
	characterData: false
};
observer.observe(targetNode, observerConfig);

/*
	button handling
*/
function handleEdit(ev) {
	if (ev === 'upload') {
		return ui.uploadFile('/etc/adblock/adblock.custom.feeds').then(function () {
			L.resolveDefault(fs.read_direct('/etc/adblock/adblock.custom.feeds', 'json'), "").then(function (data) {
				if (data && Object.keys(data).length > 0) {
					for (let i = 0; i < Object.keys(data).length; i++) {
						let feed = Object.keys(data)[i];
						let descr = data[feed].descr;
						if (feed && descr) {
							continue;
						}
						return fs.write('/etc/adblock/adblock.custom.feeds', null).then(function () {
							ui.addNotification(null, E('p', _('Upload of the custom feed file failed.')), 'error');
						});
					}
					location.reload();
				} else {
					return fs.write('/etc/adblock/adblock.custom.feeds', null).then(function () {
						ui.addNotification(null, E('p', _('Upload of the custom feed file failed.')), 'error');
					});
				}
			});
		}).catch(function () { });
	}
	if (ev === 'download') {
		return fs.read_direct('/etc/adblock/adblock.custom.feeds', 'blob').then(function (blob) {
			let url = window.URL.createObjectURL(blob),
				date = new Date(),
				name = 'adblock.custom.feeds_%04d-%02d-%02d.json'.format(date.getFullYear(), date.getMonth() + 1, date.getDate()),
				link = E('a', { 'style': 'display:none', 'href': url, 'download': name });
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		}).catch(function () { });
	}
	if (ev === 'create') {
		return fs.read_direct('/etc/adblock/adblock.feeds', 'json').then(function (content) {
			fs.write('/etc/adblock/adblock.custom.feeds', JSON.stringify(content)).then(function () {
				location.reload();
			});
		});
	}
	if (ev === 'clear') {
		return fs.write('/etc/adblock/adblock.custom.feeds', null).then(function () {
			location.reload();
		});
	}
	if (ev === 'save') {
		const invalid = document.querySelectorAll('.cbi-input-invalid');
		if (invalid.length > 0) {
			document.body.scrollTop = document.documentElement.scrollTop = 0;
			return ui.addNotification(null, E('p', _('Invalid input values, unable to save modifications.')), 'error');
		}
	}
	/*
		gather all input data and fall through from 'save'
	*/
	const exportObj = {};
	const nodeKeys = document.querySelectorAll('[id^="widget.cbid.json"][id$="name"]');
	for (const keyNode of nodeKeys) {
		const keyValue = keyNode.value?.trim();
		if (!keyValue) continue;
		const idParts = keyNode.id.split(".");
		const ruleId = idParts[3];
		if (!ruleId) continue;
		const selector =
			`[id^="widget.cbid.json.${ruleId}."], ` +
			`[id^="cbid.json.${ruleId}.rule"]`;
		const elements = document.querySelectorAll(selector);
		const sub = {};
		for (const el of elements) {
			const parts = el.id.split(".");
			const key = parts[parts.length - 1];
			const value = el.value?.trim();
			if (!value) continue;
			if (["url", "rule", "size", "descr"].includes(key)) {
				sub[key] = value;
			}
		}
		/* require at least descr and url to produce a valid feed entry */
		if (sub.descr && sub.url) {
			exportObj[keyValue] = sub;
		}
	}
	/*
		save to file and reload
	*/
	const exportJson = JSON.stringify(exportObj, null, 4);
	return fs.write('/etc/adblock/adblock.custom.feeds', exportJson)
		.then(() => location.reload());
}

return view.extend({
	load: function () {
		return L.resolveDefault(fs.stat('/etc/adblock/adblock.custom.feeds'), null)
			.then(function (stat) {
				if (!stat) {
					return fs.write('/etc/adblock/adblock.custom.feeds', "").then(function () {
						return { size: 0, data: null };
					});
				}
				return L.resolveDefault(fs.read_direct('/etc/adblock/adblock.custom.feeds', 'json'), "")
					.then(function (data) {
						return { size: stat.size, data: data };
					});
			});
	},

	render: function (result) {
		let m, s, o, feed, url, rule, size, descr;
		const data = result.data;
		fileSize = result.size;

		m = new form.JSONMap(data, null, _('With this editor you can upload your local custom feed file or fill up an initial one (a 1:1 copy of the version shipped with the package). \
			The file is located at \'/etc/adblock/adblock.custom.feeds\'. \
			Then you can edit this file, delete entries, add new ones or make a local backup. To go back to the maintainers version just clear the custom feed file.'));
		for (let i = 0; i < Object.keys(m.data.data).length; i++) {
			feed = Object.keys(m.data.data)[i];
			url = m.data.data[feed].url;
			rule = m.data.data[feed].rule;
			size = m.data.data[feed].size;
			descr = m.data.data[feed].descr;

			s = m.section(form.TypedSection, feed, null);
			s.addremove = true;
			s.anonymous = true;

			o = s.option(form.Value, 'name', _('Feed Name'));
			o.ucioption = '.name';
			o.datatype = 'and(minlength(3),maxlength(20))';
			o.validate = function (section_id, value) {
				if (!value) {
					return _('Empty field not allowed');
				}
				if (!value.match(/^[a-z0-9_]+$/)) {
					return _('Invalid characters');
				}
				return true;
			}

			o = s.option(form.Value, 'url', _('URL'));
			o.validate = function (section_id, value) {
				if (!value) {
					return true;
				}
				if (!value.match(/^https?:\/\/[A-Za-z0-9\[\]\/.\-?&+_@%=:~#]+$/)) {
					return _('Protocol/URL format not supported');
				}
				return true;
			}

			o = s.option(form.Value, 'rule', _('Rule'));
			o.value('feed 1', _('<Domain>'));
			o.value('feed 127.0.0.1 2', _('127.0.0.1 <Domain>'));
			o.value('feed 0.0.0.0 2', _('0.0.0.0 <Domain>'));
			o.value('feed || 3 [|^]', _('<Adblock Plus Syntax>'));
			o.optional = true;
			o.rmempty = true;

			o = s.option(form.ListValue, 'size', _('Size'));
			o.value('S', _('Small'));
			o.value('M', _('Medium'));
			o.value('L', _('Large'));
			o.value('XL', _('Extra Large'));
			o.value('XXL', _('Extra Extra Large'));
			o.value('VAR', _('Varying'));

			o = s.option(form.Value, 'descr', _('Description'));
			o.datatype = 'and(minlength(3),maxlength(30))';
			o.validate = function (section_id, value) {
				if (!value) {
					return _('Empty field not allowed');
				}
				return true;
			}
		}

		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnDownload',
					'disabled': 'disabled',
					'title': 'Download',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('download');
					})
				}, [_('Download')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnUpload',
					'disabled': 'disabled',
					'title': 'Upload',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('upload');
					})
				}, [_('Upload')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnCreate',
					'disabled': 'disabled',
					'title': 'Fill',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('create');
					})
				}, [_('Fill')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnClear',
					'disabled': 'disabled',
					'title': 'Clear',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('clear');
					})
				}, [_('Clear')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'id': 'btnSave',
					'disabled': 'disabled',
					'title': 'Save',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('save');
					})
				}, [_('Save')]),
			]);
		});
		return m.render();
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});