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
		L.resolveDefault(fs.stat('/etc/adblock/adblock.custom.feeds'), '').then(function (stat) {
			const buttons = document.querySelectorAll('#btnClear, #btnCreate, #btnSave, #btnUpload, #btnDownload');
			if (buttons[1] && buttons[2] && stat.size === 0) {
				buttons[1].removeAttribute('disabled');
				buttons[2].removeAttribute('disabled');
			} else if (buttons[0] && buttons[3] && buttons[4] && stat.size > 0) {
				buttons[0].removeAttribute('disabled');
				buttons[3].removeAttribute('disabled');
				buttons[4].removeAttribute('disabled');
			}
		});
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
				if (data) {
					let dataLength = Object.keys(data).length || 0;
					if (dataLength > 0) {
						for (let i = 0; i < dataLength; i++) {
							let feed = Object.keys(data)[i];
							let descr = data[feed].descr;
							if (feed && descr) {
								continue;
							}
							fs.write('/etc/adblock/adblock.custom.feeds', null).then(function () {
								return ui.addNotification(null, E('p', _('Upload of the custom feed file failed.')), 'error');
							});
						}
					} else {
						fs.write('/etc/adblock/adblock.custom.feeds', null).then(function () {
							return ui.addNotification(null, E('p', _('Upload of the custom feed file failed.')), 'error');
						});
					}
					location.reload();
				} else {
					fs.write('/etc/adblock/adblock.custom.feeds', null).then(function () {
						return ui.addNotification(null, E('p', _('Upload of the custom feed file failed.')), 'error');
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
	let sumSubElements = [], exportJson;
	const nodeKeys = document.querySelectorAll('[id^="widget.cbid.json"][id$="name"]');
	for (let i = 0; i < nodeKeys.length; i++) {
		let subElements = {};
		const elements = document.querySelectorAll('[id^="widget.cbid.json.' + nodeKeys[i].id.split('.')[3] + '\."], \
			[id^="cbid.json.' + nodeKeys[i].id.split('.')[3] + '\.rule"]');
		for (const element of elements) {
			let key;
			const value = element.value || "";
			const parts = element.id.split('.');
			if (parts.length === 5) {
				key = element.id.split('.')[4];
			} else if (parts.length === 4) {
				key = element.id.split('.')[3];
			}
			if (!key || value === "") {
				continue;
			}
			switch (key) {
				case 'url':
					subElements.url = value;
					break;
				case 'rule':
					subElements.rule = value;
					break;
				case 'size':
					subElements.size = value;
					break;
				case 'descr':
					subElements.descr = value;
					break;
			}
		}
		if (nodeKeys[i].value !== "" && subElements.descr !== "") {
			sumSubElements.push(nodeKeys[i].value, subElements);
		}
	}
	if (sumSubElements.length > 0) {
		exportJson = JSON.stringify(sumSubElements).replace(/^\[/, '{\n').replace(/\}]$/, '\n\t}\n}\n').replace(/,{"/g, ':{\n\t"').replace(/"},"/g, '"\n\t},\n"').replace(/","/g, '",\n\t"');
	}
	return fs.write('/etc/adblock/adblock.custom.feeds', exportJson).then(function () {
		location.reload();
	});
}

return view.extend({
	load: function () {
		return L.resolveDefault(fs.stat('/etc/adblock/adblock.custom.feeds'), "")
			.then(function (stat) {
			if (!stat) {
				return fs.write('/etc/adblock/adblock.custom.feeds', "");
			}
			return L.resolveDefault(fs.read_direct('/etc/adblock/adblock.custom.feeds', 'json'), "");
		});
	},

	render: function (data) {
		let m, s, o, feed, url, rule, size, descr;

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
				if (!value.match(/^(http:\/\/|https:\/\/)[A-Za-z0-9\/\.\-\?\&\+_@%=:~#]+$/)) {
					return _('Protocol/URL format not supported');
				}
				return true;
			}

			o = s.option(form.Value, 'rule', _('Rule'));
			o.value('/^([[:alnum:]_-]{1,63}\\.)+[[:alpha:]]+([[:space:]]|$)/{print tolower($1)}', _('<DOMAIN>'));
			o.value('/^127\\.0\\.0\\.1[[:space:]]+([[:alnum:]_-]{1,63}\\.)+[[:alpha:]]+([[:space:]]|$)/{print tolower($2)}', _('127.0.0.1<SPACE><DOMAIN>'));
			o.value('/^0\\.0\\.0\\.0[[:space:]]+([[:alnum:]_-]{1,63}\\.)+[[:alpha:]]+([[:space:]]|$)/{print tolower($2)}', _('0.0.0.0<SPACE><DOMAIN>'));
			o.value('BEGIN{FS=\"[|^]\"}/^\\|\\|([[:alnum:]_-]{1,63}\\.)+[[:alpha:]]+\\^(\\$third-party)?$/{print tolower($3)}', _('<ADBLOCK-PLUS>'));
			o.value('BEGIN{FS=\"\/\"}/^http[s]?:\\/\\/([[:alnum:]_-]{1,63}\\.)+[[:alpha:]]+(\\/|$)/{print tolower($3)}', _('<HTTP[S]-URL>'));
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
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('download');
					})
				}, [_('Download')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnUpload',
					'disabled': 'disabled',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('upload');
					})
				}, [_('Upload')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnCreate',
					'disabled': 'disabled',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('create');
					})
				}, [_('Fill')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnClear',
					'disabled': 'disabled',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('clear');
					})
				}, [_('Clear')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'id': 'btnSave',
					'disabled': 'disabled',
					'click': ui.createHandlerFn(this, function () {
						return handleEdit('save');
					})
				}, [_('Save')]),
			])
		});
		return m.render();
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
