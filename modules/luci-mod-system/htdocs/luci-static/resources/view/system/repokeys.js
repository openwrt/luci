'use strict';
'require baseclass';
'require fs';
'require form';
'require ui';
'require view';

const APK_DIR = '/etc/apk/keys/';
const OPKG_DIR = '/etc/opkg/keys/';
const isReadonlyView = !L.hasViewPermission() || null;

let KEYDIR = null;
let KEYEXT = null;

/* This safeList is not bullet-proof, but should prevent users
	accidentally deleting official repo keys */
const safeList = [
	'd310c6f2833e97f7', // 24.10 release usign key
	'openwrt-snapshots.pem', // main snapshots EC pub key
];

function isFileInSafeList(file){
	for (let name of safeList) {
		if (file === name)
			return true;
		if (file.toLocaleLowerCase().replace(/^openwrt-[0-9]+\.[0-9]+/i, '') !== file)
			return true;
		if (file.toLocaleLowerCase().replace(/^openwrt-snapshots/i, '') !== file)
			return true;
	}
	return false;
}

function normalizeKey(s) {
	return s?.replace(/\s+/g, ' ')?.trim();
}

function determineKeyEnv() {
	return fs.stat(APK_DIR).then(() => {
		KEYDIR = APK_DIR;
		KEYEXT = '.pem'; // not strictly necessary - apk allows any extension
	}).catch(() => {
		KEYDIR = OPKG_DIR;
		KEYEXT = null; // opkg requires key filenames without an extension
	});
}

function listKeyFiles() {
	return fs.list(KEYDIR).then(entries =>
		Promise.all(entries.map(entry =>
			fs.read(KEYDIR + entry.name).then(content => ({
				filename: entry.name,
				key: content
			}))
		))
	);
}

function saveKeyFile(keyContent, file, fileContent) {
	const ts = Date.now();
	// Note: opkg can only verify against a key with filename that matches its key hash
	// generate a file name in case key content was pasted
	const filename = file ? file?.name?.split('.')?.[0] + (KEYEXT || '') : null;
	const noname = 'key_' + ts + (KEYEXT || '');
	return fs.write(KEYDIR + (filename ?? noname), fileContent ?? keyContent, 384 /* 0600 */);
}

function removeKey(ev, key) {
	L.showModal(_('Delete key'), [
		E('div', _('Really delete the following software repository public key?')),
		E('pre', [ key.filename ]),
		E('div', { class: 'right' }, [
			E('div', { class: 'btn', click: L.hideModal }, _('Cancel')),
			' ',
			E('div', {
				class: 'btn danger',
				click: function() {
					fs.remove(KEYDIR + key.filename)
						.then(() => window.location.reload())
						.catch(e => ui.addNotification(null, E('p', e.message)))
						.finally(() => ui.hideModal());
				}
			}, _('Delete key'))
		])
	]);
}

function isPemFormat(content) {
	return (/-BEGIN ([A-Z ]+)?PUBLIC KEY-/.test(content));
}

function keyEnvironmentCheck(key) {
	const isPem = isPemFormat(key);

	// Reject PEM in OPKG; reject non-PEM in APK
	if (KEYDIR === OPKG_DIR && isPem)
		return _('This key appears to be in PEM format, which is not supported in an opkg environment.');
	if (KEYDIR === APK_DIR && !isPem)
		return _('This key does not appear to be in PEM format, which is required in an apk environment.');

	return null;
}

function addKey(ev, file, fileContent) {
	const input = document.getElementById('key-input');
	const key = (fileContent ?? input?.value?.trim());

	if (!key || !key.length)
		return;

	// Handle remote URL paste
	if (/^https?:\/\/\S+$/i.test(key) && !fileContent) {
		ui.addTimeLimitedNotification(_('Fetching key from URL…'), [], 5000, 'info');

		L.Request.request(key, { method: 'GET' }).then(res => {
			if (res.status !== 200) {
				ui.addTimeLimitedNotification(_('Failed to fetch key'), [
					E('p', _('HTTP error %d').format(res.status)),
				], 7000, 'warning');
				return;
			}

			const fetched = res.responseText?.trim();
			if (!fetched || fetched.length > 8192) {
				ui.addTimeLimitedNotification(_('Key file too large'), [
					E('p', _('Fetched content seems too long. Maximum 8192 bytes.')),
				], 7000, 'warning');
				return;
			}

			if (!fetched || fetched.length < 32) {
				ui.addTimeLimitedNotification(_('Invalid or empty key file'), [
					E('p', _('Fetched content seems empty or too short.')),
				], 7000, 'warning');
				return;
			}

			const filename = res?.url?.split('/').pop().split('?')[0].split('#')[0];

			// Remove extension if any (we'll re-add based on environment)
			const file = {name: filename.replace(/\.[^.]+$/, '') };

			addKey(ev, file, fetched);
		}).catch(err => {
			ui.addTimeLimitedNotification(_('Failed to fetch key'), [
				E('p', err.message),
			], 7000, 'warning');
		});

		return;
	}

	// From here on, key content (either pasted, fetched, or dropped)
	const formatError = keyEnvironmentCheck(key);
	if (formatError) {
		ui.addTimeLimitedNotification(_('Invalid key format'), [
			E('p', formatError)
		], 7000, 'warning');
		return;
	}

	// Prevent duplicates
	listKeyFiles().then(existingKeys => {
		if (existingKeys.some(k => normalizeKey(k.key) === normalizeKey(key))) {
			ui.addTimeLimitedNotification(_('Add key'), [
				E('div', _('The given software repository public key is already present.')),
			], 7000, 'notice');
			return;
		}

		// Save and refresh the UI
		input.value = '';
		saveKeyFile(key, file, fileContent)
			.then(() => window.location.reload())
			.catch(e => ui.addNotification(null, E('p', e.message)));
	});
}

function dragKey(ev) {
	ev.stopPropagation();
	ev.preventDefault();
	ev.dataTransfer.dropEffect = 'copy';
}

function dropKey(ev) {
	ev.preventDefault();
	ev.stopPropagation();

	const input = document.getElementById('key-input');

	if (!input)
		return;

	for (const file of ev.dataTransfer.files) {
		const reader = new FileReader();
		reader.onload = rev => {
			input.value = rev.target.result;
			addKey(ev, file, rev.target.result);
			input.value = '';
		};
		reader.readAsText(file);
	}
}

function handleWindowDragDropIgnore(ev) {
	ev.preventDefault();
}

return view.extend({
	load() {
		return Promise.all([
			determineKeyEnv().then(listKeyFiles),
		]);
	},

	render([keys]) {

		const m = new form.JSONMap({
			keys: keys,
			fup: {},
		},
			_('Repository Public Keys'), _(
			_('Each software repository public key (from official or third party repositories) allows packages in lists signed by it to be installed by the package manager.') + '<br/>' +
			_('Each key is stored as a file in %s.').format(`<code>${KEYDIR}</code>`)
		));
		m.submit = false;
		m.reset = false;
		m.readonly = isReadonlyView;

		let s, o;

		s = m.section(form.TableSection, 'keys');
		s.anonymous = true;
		s.nodescriptions = true;

		o = s.option(form.DummyValue, 'filename', _('Name'));
		o.width = '20%';
		o = s.option(form.TextValue, 'key', _('Key'));
		o.readonly = true;
		o.monospace = true;
		o.cols = 85;
		o.rows = 5;

		s.renderRowActions = function (section_id) {
			const key = this.map.data.get(this.map.config, section_id);
			const isReservedKey = isFileInSafeList(key.filename); 

			const btns = [
				E('button', {
					'class': 'cbi-button cbi-button-negative remove',
					'click': ui.createHandlerFn(this, this.handleRemove, key),
					'disabled': isReservedKey ? true : null,
				}, [_('Delete')]),
			];

			return E('td', { 'class': 'td middle cbi-section-actions' }, E('div', btns));
		};

		s.handleRemove = function(key, ev) {
			if (isFileInSafeList(key.filename)) {
				ui.addTimeLimitedNotification(null, E('p', _('This key is protected and cannot be deleted.')), 3000, 'warning');
				return;
			}

			return removeKey(ev, key)
		};

		s = m.section(form.NamedSection, 'fup');

		o = s.option(form.DummyValue, '_newkey');
		o.cfgvalue = function(/* section_id*/) {

			const addInput = E('textarea', {
				id: 'key-input',
				'aria-label': _('Paste or drag repository public key'),
				class: 'cbi-input-text',
				type: 'text',
				style: 'width: 100%; min-height: 120px;',
				placeholder: _('Paste content of a file, or a URL to a key file, or drag and drop here to upload a software repository public key…'),
				keydown: function(ev) { if (ev.keyCode === 13 && (ev.ctrlKey || ev.metaKey)) addKey(ev); },
				disabled: isReadonlyView
			});

			addInput.addEventListener('dragover', handleWindowDragDropIgnore);
			addInput.addEventListener('drop', handleWindowDragDropIgnore);

			const addBtn = E('button', {
				class: 'cbi-button',
				click: ui.createHandlerFn(this, addKey),
				disabled: isReadonlyView
			}, _('Add key'));

			return E('div', {
				class: 'cbi-section-node',
				dragover: isReadonlyView ? null : dragKey,
				drop: isReadonlyView ? null : dropKey
			}, [
				E('div', { class: 'cbi-section-descr' }, _('Add new repository public key by pasting its content, a file, or a URL.')),
				E('div', {
					'style': 'height: 20px',
				}, [' ']),
				addInput,
				E('div', { class: 'right' }, [ addBtn ])
			]);
		};

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
