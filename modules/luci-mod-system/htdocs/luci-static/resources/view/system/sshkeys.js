'use strict';
'require view';
'require fs';
'require ui';

var SSHPubkeyDecoder = L.Class.singleton({
	lengthDecode: function(s, off)
	{
		var l = (s.charCodeAt(off++) << 24) |
				(s.charCodeAt(off++) << 16) |
				(s.charCodeAt(off++) <<  8) |
				 s.charCodeAt(off++);

		if (l < 0 || (off + l) > s.length)
			return -1;

		return l;
	},

	decode: function(s)
	{
		var parts = s.trim().match(/^((?:(?:^|,)[^ =,]+(?:=(?:[^ ",]+|"(?:[^"\\]|\\.)*"))?)+ +)?(ssh-dss|ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp[0-9]+) +([^ ]+)( +.*)?$/);

		if (!parts)
			return null;

		var key = null;
		try { key = atob(parts[3]); } catch(e) {}
		if (!key)
			return null;

		var off, len;

		off = 0;
		len = this.lengthDecode(key, off);

		if (len <= 0)
			return null;

		var type = key.substr(off + 4, len);
		if (type !== parts[2])
			return null;

		off += 4 + len;

		var len1 = off < key.length ? this.lengthDecode(key, off) : 0;
		if (len1 <= 0)
			return null;

		var curve = null;
		if (type.indexOf('ecdsa-sha2-') === 0) {
			curve = key.substr(off + 4, len1);

			if (!len1 || type.substr(11) !== curve)
				return null;

			type = 'ecdsa-sha2';
			curve = curve.replace(/^nistp(\d+)$/, 'NIST P-$1');
		}

		off += 4 + len1;

		var len2 = off < key.length ? this.lengthDecode(key, off) : 0;
		if (len2 < 0)
			return null;

		if (len1 & 1)
			len1--;

		if (len2 & 1)
			len2--;

		var comment = (parts[4] || '').trim(),
		    fprint = parts[3].length > 68 ? parts[3].substr(0, 33) + '…' + parts[3].substr(-34) : parts[3];

		var options = null;
		(parts[1] || '').trim().replace(/(?:^|,)([^ =,]+)(?:=(?:([^ ",]+)|"((?:[^"\\]|\\.)*)"))?/g, function(m, k, p, q) {
			options = options || {};

			if (options.hasOwnProperty(k))
				options[k] += ',' + (q || p || true);
			else
				options[k] = (q || p || true);
		});

		switch (type)
		{
		case 'ssh-rsa':
			return { type: 'RSA', bits: len2 * 8, comment: comment, options: options, fprint: fprint, src: s };

		case 'ssh-dss':
			return { type: 'DSA', bits: len1 * 8, comment: comment, options: options, fprint: fprint, src: s };

		case 'ssh-ed25519':
			return { type: 'ECDH', curve: 'Curve25519', comment: comment, options: options, fprint: fprint, src: s };

		case 'ecdsa-sha2':
			return { type: 'ECDSA', curve: curve, comment: comment, options: options, fprint: fprint, src: s };

		default:
			return null;
		}
	}
});

function renderKeyItem(pubkey) {
	return E('div', {
		class: 'item',
		click: removeKey,
		'data-key': pubkey.src
	}, [
		E('strong', pubkey.comment || _('Unnamed key')), E('br'),
		E('small', [
			'%s, %s'.format(pubkey.type, pubkey.curve || _('%d Bit').format(pubkey.bits)),
			pubkey.options ? E([], [
				' / ', _('Options:'), ' ',
				E('code', Object.keys(pubkey.options).sort().join(', '))
			]) : '',
			E('br'), E('code', pubkey.fprint)
		])
	]);
}

function renderKeys(keys) {
	var list = document.querySelector('.cbi-dynlist');

	while (!matchesElem(list.firstElementChild, '.add-item'))
		list.removeChild(list.firstElementChild);

	keys.forEach(function(key) {
		var pubkey = SSHPubkeyDecoder.decode(key);
		if (pubkey)
			list.insertBefore(renderKeyItem(pubkey), list.lastElementChild);
	});

	if (list.firstElementChild === list.lastElementChild)
		list.insertBefore(E('p', _('No public keys present yet.')), list.lastElementChild);
}

function saveKeys(keys) {
	return fs.write('/etc/dropbear/authorized_keys', keys.join('\n') + '\n', 384 /* 0600 */)
		.then(renderKeys.bind(this, keys))
		.catch(function(e) { ui.addNotification(null, E('p', e.message)) })
		.finally(ui.hideModal);
}

function addKey(ev) {
	var list = findParent(ev.target, '.cbi-dynlist'),
	    input = list.querySelector('input[type="text"]'),
	    key = input.value.trim(),
	    pubkey = SSHPubkeyDecoder.decode(key),
	    keys = [];

	if (!key.length)
		return;

	list.querySelectorAll('.item').forEach(function(item) {
		keys.push(item.getAttribute('data-key'));
	});

	if (keys.indexOf(key) !== -1) {
		ui.showModal(_('Add key'), [
			E('div', { class: 'alert-message warning' }, _('The given SSH public key has already been added.')),
			E('div', { class: 'right' }, E('div', { class: 'btn', click: L.hideModal }, _('Close')))
		]);
	}
	else if (!pubkey) {
		ui.showModal(_('Add key'), [
			E('div', { class: 'alert-message warning' }, _('The given SSH public key is invalid. Please supply proper public RSA or ECDSA keys.')),
			E('div', { class: 'right' }, E('div', { class: 'btn', click: L.hideModal }, _('Close')))
		]);
	}
	else {
		keys.push(key);
		input.value = '';

		return saveKeys(keys).then(function() {
			var added = list.querySelector('[data-key="%s"]'.format(key.replace(/["\\]/g, '\\$&')));
			if (added)
				added.classList.add('flash');
		});
	}
}

function removeKey(ev) {
	var list = findParent(ev.target, '.cbi-dynlist'),
	    delkey = ev.target.getAttribute('data-key'),
	    keys = [];

	list.querySelectorAll('.item').forEach(function(item) {
		var key = item.getAttribute('data-key');
		if (key !== delkey)
			keys.push(key);
	});

	L.showModal(_('Delete key'), [
		E('div', _('Do you really want to delete the following SSH key?')),
		E('pre', delkey),
		E('div', { class: 'right' }, [
			E('div', { class: 'btn', click: L.hideModal }, _('Cancel')),
			' ',
			E('div', { class: 'btn danger', click: ui.createHandlerFn(this, saveKeys, keys) }, _('Delete key')),
		])
	]);
}

function dragKey(ev) {
	ev.stopPropagation();
	ev.preventDefault();
	ev.dataTransfer.dropEffect = 'copy';
}

function dropKey(ev) {
	var file = ev.dataTransfer.files[0],
	    input = ev.currentTarget.querySelector('input[type="text"]'),
	    reader = new FileReader();

	if (file) {
		reader.onload = function(rev) {
			input.value = rev.target.result.trim();
			addKey(ev);
			input.value = '';
		};

		reader.readAsText(file);
	}

	ev.stopPropagation();
	ev.preventDefault();
}

function handleWindowDragDropIgnore(ev) {
	ev.preventDefault()
}

return view.extend({
	load: function() {
		return fs.lines('/etc/dropbear/authorized_keys').then(function(lines) {
			return lines.map(function(line) {
				return SSHPubkeyDecoder.decode(line);
			}).filter(function(line) {
				return line != null;
			});
		});
	},

	render: function(keys) {
		var list = E('div', { 'class': 'cbi-dynlist', 'dragover': dragKey, 'drop': dropKey }, [
			E('div', { 'class': 'add-item' }, [
				E('input', {
					'class': 'cbi-input-text',
					'type': 'text',
					'placeholder': _('Paste or drag SSH key file…') ,
					'keydown': function(ev) { if (ev.keyCode === 13) addKey(ev) }
				}),
				E('button', {
					'class': 'cbi-button',
					'click': ui.createHandlerFn(this, addKey)
				}, _('Add key'))
			])
		]);

		keys.forEach(L.bind(function(pubkey) {
			list.insertBefore(renderKeyItem(pubkey), list.lastElementChild);
		}, this));

		if (list.firstElementChild === list.lastElementChild)
			list.insertBefore(E('p', _('No public keys present yet.')), list.lastElementChild);

		window.addEventListener('dragover', handleWindowDragDropIgnore);
		window.addEventListener('drop', handleWindowDragDropIgnore);

		return E('div', {}, [
			E('h2', _('SSH-Keys')),
			E('div', { 'class': 'cbi-section-descr' }, _('Public keys allow for the passwordless SSH logins with a higher security compared to the use of plain passwords. In order to upload a new key to the device, paste an OpenSSH compatible public key line or drag a <code>.pub</code> file into the input field.')),
			E('div', { 'class': 'cbi-section-node' }, list)
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
