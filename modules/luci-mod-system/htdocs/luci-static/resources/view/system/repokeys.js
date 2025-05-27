'use strict';
'require baseclass';
'require view';
'require fs';
'require ui';

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
	for (name of safeList) {
		if (file === name)
			return true;
	}
	return false;
}

function normalizeKey(s) {
	return s.replace(/\s+/g, ' ').trim();
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

function renderKeyItem(pubkey) {
	const safeFile = isFileInSafeList(pubkey?.filename);
	const lines = pubkey?.key?.trim()?.split('\n').map(line =>
		[ E('br'), E('code', line) ]
	).flat();
	return E('div', {
		class: 'item',
		click: (isReadonlyView || safeFile) ? null : removeKey,
		'data-file': pubkey?.filename,
		'data-key': normalizeKey(pubkey?.key)
	}, [
		E('strong', [ pubkey?.filename || _('Unnamed key') ]),
		...lines
	]);
}

function refreshKeyList(list, keys) {
	while (!matchesElem(list.firstElementChild, '.add-item'))
		list.removeChild(list.firstElementChild);

	keys.forEach(function(pubkey) {
		list.insertBefore(renderKeyItem(pubkey), list.lastElementChild);
	});

	if (list.firstElementChild === list.lastElementChild)
		list.insertBefore(E('p', _('No software repository public keys present yet.')), list.lastElementChild);
}

function saveKeyFile(keyContent, file, fileContent) {
	const ts = Date.now();
	// generate a file name in case key content was pasted
	const filename = file ? file?.name?.split('.')?.[0] + (KEYEXT || '') : null;
	const noname = 'key_' + ts + (KEYEXT || '');
	return fs.write(KEYDIR + (filename ?? noname), fileContent ?? keyContent, 384 /* 0600 */);
}

function removeKey(ev) {
	const file = ev.currentTarget.getAttribute('data-file');
	const list = findParent(ev.target, '.cbi-dynlist');

	L.showModal(_('Delete key'), [
		E('div', _('Really delete the following software repository public key?')),
		E('pre', [ file ]),
		E('div', { class: 'right' }, [
			E('div', { class: 'btn', click: L.hideModal }, _('Cancel')),
			' ',
			E('div', {
				class: 'btn danger',
				click: function() {
					fs.remove(KEYDIR + file).then(() => {
						return listKeyFiles().then(keys => refreshKeyList(list, keys));
					});
					ui.hideModal();
				}
			}, _('Delete key'))
		])
	]);
}

function isPemFormat(content) {
	return /-BEGIN ([A-Z ]+)?PUBLIC KEY-/.test(content);
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
	const list = findParent(ev.target, '.cbi-dynlist');
	const input = list.querySelector('textarea[type="text"]');
	const key = input.value;

	if (!key.length)
		return;

	const formatError = keyEnvironmentCheck(key);
	if (formatError) {
		ui.addTimeLimitedNotification(_('Invalid key format'), [
			E('p', formatError)
		], 7000, 'warning');
		return;
	}

	// Prevent duplicates
	const exists = Array.from(list.querySelectorAll('.item')).some(
		item => item.getAttribute('data-key') === normalizeKey(key)
	);
	if (exists) {
		ui.addTimeLimitedNotification(_('Add key'), [
			E('div', _('The given software repository public key is already present.')),
		], 7000, 'notice');
		return;
	}

	input.value = '';
	saveKeyFile(key, file, fileContent)
		.then(() => listKeyFiles())
		.then(keys => refreshKeyList(list, keys))
		.catch(e => ui.addNotification(null, E('p', e.message)));
}

function dragKey(ev) {
	ev.stopPropagation();
	ev.preventDefault();
	ev.dataTransfer.dropEffect = 'copy';
}

function dropKey(ev) {
	ev.preventDefault();
	ev.stopPropagation();

	const input = ev.currentTarget.querySelector('textarea[type="text"]');

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
		return determineKeyEnv().then(listKeyFiles);
	},

	render(keys) {
		const list = E('div', {
			class: 'cbi-dynlist',
			style: 'max-width: 800px',
			dragover: isReadonlyView ? null : dragKey,
			drop: isReadonlyView ? null : dropKey
		}, [
			E('div', { class: 'add-item' }, [
				E('textarea', {
					id: 'key-input',
					'aria-label': _('Paste or drag repository public key'),
					class: 'cbi-input-text',
					type: 'text',
					placeholder: _('Paste or drag to upload a software repository public key…'),
					keydown: function(ev) { if (ev.keyCode === 13) addKey(ev); },
					disabled: isReadonlyView
				}),
				E('button', {
					class: 'cbi-button',
					click: ui.createHandlerFn(this, addKey),
					disabled: isReadonlyView
				}, _('Add key'))
			])
		]);

		refreshKeyList(list, keys);
		window.addEventListener('dragover', handleWindowDragDropIgnore);
		window.addEventListener('drop', handleWindowDragDropIgnore);

		return E('div', {}, [
			E('h2', _('Repository Public Keys')),
			E('div', { class: 'cbi-section-descr' },
				_('Each software repository public key (from official or third party repositories) allows packages in lists signed by it to be installed by the package manager.')),
			E('div', { class: 'cbi-section-descr' },
				_('Each key is stored as a file in <code>%s</code>.').format(KEYDIR)),
			E('div', { class: 'cbi-section-node' }, list)
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
