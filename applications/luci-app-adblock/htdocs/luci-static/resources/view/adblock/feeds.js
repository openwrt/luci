'use strict';
'require view';
'require form';
'require fs';
'require ui';

const feedFile = '/etc/adblock/adblock.custom.feeds';
const uploadFile = '/tmp/adblock.custom.feeds.upload';
const feedKeys = ['url', 'rule', 'size', 'descr'];

/*
	convert the feed object into named sections of a single section type,
	the feed name is kept as a regular option, the section id stays internal
*/
function toSections(feeds) {
	const sections = [];
	let index = 0;

	for (const name of Object.keys(feeds ?? {})) {
		const feed = feeds[name];
		if (!L.isObject(feed)) {
			continue;
		}
		const section = { '.name': 'feed%d'.format(index++), 'name': name };
		for (const key of feedKeys) {
			if (feed[key] != null) {
				section[key] = String(feed[key]);
			}
		}
		sections.push(section);
	}
	return sections;
}

/*
	a feed entry needs a name, a description, a parsing rule and at least one url
*/
function checkFeed(name, feed) {
	if (!name || !name.match(/^[a-z0-9_]{3,20}$/)) {
		return _('Invalid feed name: %s').format(name || '?');
	}
	if (!L.isObject(feed)) {
		return _('Invalid feed entry: %s').format(name);
	}
	if (!feed.descr) {
		return _('Missing description: %s').format(name);
	}
	if (!feed.url) {
		return _('Missing URL: %s').format(name);
	}
	return null;
}

/*
	rebuild the feed object from the form model
*/
function fromSections(map) {
	const feeds = {};
	const names = [];

	for (const section of map.data.sections('json', 'feed')) {
		const name = (section.name ?? '').trim();
		const feed = {};
		for (const key of feedKeys) {
			const value = (section[key] ?? '').trim?.() ?? section[key];
			if (value) {
				feed[key] = value;
			}
		}
		const error = checkFeed(name, feed);
		if (error) {
			return { error: error };
		}
		if (names.includes(name)) {
			return { error: _('Duplicate feed name: %s').format(name) };
		}
		names.push(name);
		feeds[name] = feed;
	}
	return { feeds: feeds };
}

/*
	validate an uploaded feed file
*/
function checkUpload(data) {
	if (!L.isObject(data) || Object.keys(data).length === 0) {
		return _('The uploaded file is no valid custom feed file.');
	}
	for (const name of Object.keys(data)) {
		const error = checkFeed(name, data[name]);
		if (error) {
			return error;
		}
	}
	return null;
}

/*
	notification handler
*/
function notify(message, type) {
	document.querySelectorAll('.adblock-notification').forEach(function (node) {
		node.parentNode?.removeChild(node);
	});
	return ui.addNotification(null, E('p', message), type, 'adblock-notification');
}

function urlValidator(section_id, value) {
	if (!value) {
		return true;
	}
	if (!value.match(/^https?:\/\/[A-Za-z0-9[\]/.?&+_@%=:~#-]+$/)) {
		return _('Protocol/URL format not supported');
	}
	return true;
}

/*
	keep browser autofill out of the modal input fields
*/
function plainInput(option) {
	const renderWidget = option.renderWidget;

	option.renderWidget = function (...args) {
		const node = renderWidget.apply(this, args);
		const input = node?.querySelector?.('input');
		if (input) {
			input.setAttribute('autocomplete', 'off');
			input.setAttribute('autocorrect', 'off');
			input.setAttribute('autocapitalize', 'off');
			input.setAttribute('spellcheck', 'false');
		}
		return node;
	};
	return option;
}

return view.extend({
	load: function () {
		return L.resolveDefault(fs.read_direct(feedFile, 'json'), null);
	},

	handleEdit: function (map, ev) {
		if (ev === 'upload') {
			return ui.uploadFile(uploadFile).then(function () {
				return L.resolveDefault(fs.read_direct(uploadFile, 'json'), null).then(function (data) {
					const error = checkUpload(data);
					if (error) {
						return fs.remove(uploadFile).finally(function () {
							notify(_('Upload of the custom feed file failed: %s').format(error), 'error');
						});
					}
					return fs.write(feedFile, JSON.stringify(data, null, 4)).then(function () {
						return fs.remove(uploadFile).finally(function () {
							location.reload();
						});
					});
				});
			}).catch(function () { });
		}

		if (ev === 'download') {
			return fs.read_direct(feedFile, 'blob').then(function (blob) {
				const url = window.URL.createObjectURL(blob);
				const date = new Date();
				const name = 'adblock.custom.feeds_%04d-%02d-%02d.json'.format(date.getFullYear(), date.getMonth() + 1, date.getDate());
				const link = E('a', { 'style': 'display:none', 'href': url, 'download': name });
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
			}).catch(function () { });
		}

		if (ev === 'fill') {
			return fs.read_direct('/etc/adblock/adblock.feeds', 'json').then(function (content) {
				return fs.write(feedFile, JSON.stringify(content, null, 4)).then(function () {
					location.reload();
				});
			}).catch(function () {
				notify(_('Unable to read the maintainers feed file.'), 'error');
			});
		}

		if (ev === 'clear') {
			return fs.write(feedFile, null).then(function () {
				location.reload();
			});
		}

		/*
			save, the modal dialogs have already written their values to the model
		*/
		const result = fromSections(map);
		if (result.error) {
			notify(_('Unable to save modifications: %s').format(result.error), 'error');
			return Promise.resolve();
		}
		return fs.write(feedFile, JSON.stringify(result.feeds, null, 4)).then(function () {
			notify(_('Custom feed file saved.'), 'info');
		});
	},

	render: function (data) {
		const feeds = L.isObject(data) ? data : {};
		const empty = Object.keys(feeds).length === 0;
		let m, s, o;

		m = new form.JSONMap({ 'feed': toSections(feeds) }, null, _('With this editor you can upload your local custom feed file or fill up an initial one (a 1:1 copy of the version shipped with the package). \
			The file is located at \'/etc/adblock/adblock.custom.feeds\'. \
			Then you can edit this file, delete entries, add new ones or make a local backup. To go back to the maintainers version just clear the custom feed file.'));

		s = m.section(form.GridSection, 'feed');
		s.addremove = true;
		s.anonymous = true;
		s.sortable = false;
		s.nodescriptions = true;
		s.addbtntitle = _('Add feed');
		s.modaltitle = function (section_id) {
			return _('Custom Feed') + ' » ' + (this.map.data.get('json', section_id, 'name') || _('new'));
		};

		o = plainInput(s.option(form.Value, 'name', _('Feed Name')));
		o.datatype = 'and(minlength(3),maxlength(20))';
		o.validate = function (section_id, value) {
			if (!value) {
				return _('Empty field not allowed');
			}
			if (!value.match(/^[a-z0-9_]+$/)) {
				return _('Invalid characters');
			}
			for (const section of this.map.data.sections('json', 'feed')) {
				if (section['.name'] !== section_id && section.name === value) {
					return _('Feed name already used');
				}
			}
			return true;
		};

		o = plainInput(s.option(form.Value, 'descr', _('Description')));
		o.datatype = 'and(minlength(3),maxlength(30))';
		o.validate = function (section_id, value) {
			if (!value) {
				return _('Empty field not allowed');
			}
			return true;
		};

		o = s.option(form.ListValue, 'size', _('Size'));
		o.value('S', _('Small'));
		o.value('M', _('Medium'));
		o.value('L', _('Large'));
		o.value('XL', _('Extra Large'));
		o.value('XXL', _('Extra Extra Large'));
		o.value('VAR', _('Varying'));
		o.default = 'M';

		o = plainInput(s.option(form.Value, 'url', _('URL')));
		o.modalonly = true;
		o.validate = function (section_id, value) {
			if (!value) {
				return _('Empty field not allowed');
			}
			return urlValidator(section_id, value);
		};

		o = plainInput(s.option(form.Value, 'rule', _('Rule')));
		o.modalonly = true;
		o.value('feed 1', _('<Domain>'));
		o.value('feed 127.0.0.1 2', _('127.0.0.1 <Domain>'));
		o.value('feed 0.0.0.0 2', _('0.0.0.0 <Domain>'));
		o.value('feed || 3 [|^]', _('<Adblock Plus Syntax>'));
		o.optional = true;
		o.rmempty = true;

		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'disabled': empty ? 'disabled' : null,
					'click': ui.createHandlerFn(this, function () {
						return this.handleEdit(m, 'download');
					})
				}, [_('Download')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'click': ui.createHandlerFn(this, function () {
						return this.handleEdit(m, 'upload');
					})
				}, [_('Upload')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'disabled': empty ? null : 'disabled',
					'click': ui.createHandlerFn(this, function () {
						return this.handleEdit(m, 'fill');
					})
				}, [_('Fill')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'disabled': empty ? 'disabled' : null,
					'click': ui.createHandlerFn(this, function () {
						return this.handleEdit(m, 'clear');
					})
				}, [_('Clear')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'click': ui.createHandlerFn(this, function () {
						return this.handleEdit(m, 'save');
					})
				}, [_('Save')])
			]);
		}, this);

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
