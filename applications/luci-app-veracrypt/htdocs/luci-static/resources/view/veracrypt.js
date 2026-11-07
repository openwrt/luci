'use strict';
/* SPDX-License-Identifier: GPL-2.0-only */
'require view';
'require form';
'require uci';
'require rpc';
'require ui';

/*
 * Text from the router (file names, paths, veracrypt output) must never be
 * parsed as HTML. E() and ui.showModal() put a plain string into innerHTML,
 * so pass strings as text nodes instead.
 */
function El(tag, attr, data) {
	if (!(attr instanceof Object) || Array.isArray(attr))
		data = attr, attr = null;
	if (typeof data === 'string' || typeof data === 'number')
		data = [ String(data) ];
	return E(tag, attr || {}, data);
}

function modal(title) {
	var args = Array.prototype.slice.call(arguments);
	if (title !== null && title !== undefined)
		args[0] = [ String(title) ];
	return ui.showModal.apply(ui, args);
}

var callStatus = rpc.declare({
	object: 'luci.veracrypt',
	method: 'status'
});

var callListDev = rpc.declare({
	object: 'luci.veracrypt',
	method: 'listdev'
});

var callListDir = rpc.declare({
	object: 'luci.veracrypt',
	method: 'listdir',
	params: [ 'path' ]
});

var callMkdir = rpc.declare({
	object: 'luci.veracrypt',
	method: 'mkdir',
	params: [ 'path' ]
});

var callRm = rpc.declare({
	object: 'luci.veracrypt',
	method: 'rm',
	params: [ 'path' ]
});

var RUN_PARAMS = [
	'action', 'name', 'volume', 'mountpoint', 'password', 'new_password',
	'pim', 'new_pim', 'hash', 'new_hash', 'encryption', 'filesystem',
	'keyfiles', 'new_keyfiles', 'protect_hidden',
	'protection_password', 'protection_pim', 'protection_hash',
	'protection_keyfiles', 'slot', 'size', 'volume_type', 'random_source',
	'token_lib', 'token_pin', 'mount_options', 'auto_mount', 'force', 'all',
	'quick', 'no_size_check', 'legacy_password_maxlength',
	'allow_insecure_mount', 'fsck_auto', 'backup_file'
];

function timeoutSec() {
	var t = parseInt(uci.get('veracrypt', 'main', 'timeout'), 10);
	if (isNaN(t) || t < 300)
		t = 300;
	return t;
}

function fmtClock(sec) {
	if (sec < 0)
		sec = 0;
	var m = Math.floor(sec / 60);
	var s = sec % 60;
	return '%d:%02d'.format(m, s);
}

function callRunWithTimeout() {
	return rpc.declare({
		object: 'luci.veracrypt',
		method: 'run',
		timeout: timeoutSec() * 1000,
		params: RUN_PARAMS
	});
}

function invokeRun(opts) {
	opts = opts || {};
	return callRunWithTimeout()(
		opts.action || '', opts.name || '', opts.volume || '', opts.mountpoint || '',
		opts.password || '', opts.new_password || '', opts.pim || '', opts.new_pim || '',
		opts.hash || '', opts.new_hash || '', opts.encryption || '', opts.filesystem || '',
		opts.keyfiles || '', opts.new_keyfiles || '',
		opts.protect_hidden || '', opts.protection_password || '', opts.protection_pim || '',
		opts.protection_hash || '', opts.protection_keyfiles || '', opts.slot || '',
		opts.size || '', opts.volume_type || '', opts.random_source || '',
		opts.token_lib || '', opts.token_pin || '', opts.mount_options || '',
		opts.auto_mount || '', opts.force || '', opts.all || '', opts.quick || '',
		opts.no_size_check || '', opts.legacy_password_maxlength || '',
		opts.allow_insecure_mount || '', opts.fsck_auto || '', opts.backup_file || ''
	);
}

function callJobWithTimeout() {
	return rpc.declare({
		object: 'luci.veracrypt',
		method: 'job',
		timeout: Math.max(20000, Math.min(60000, timeoutSec() * 1000)),
		params: [ 'id' ]
	});
}

var callTools = rpc.declare({
	object: 'luci.veracrypt',
	method: 'tools'
});

var callJobLog = rpc.declare({
	object: 'luci.veracrypt',
	method: 'job_log',
	params: [ 'id' ]
});

var callJobAbort = rpc.declare({
	object: 'luci.veracrypt',
	method: 'job_abort',
	timeout: 60000,
	params: [ 'id' ]
});

var callJobDismount = rpc.declare({
	object: 'luci.veracrypt',
	method: 'job_dismount',
	params: [ 'id' ]
});

function missingPackages(t, fs) {
	if (!fs || fs === 'none')
		return [];
	var missing = [];
	if (fs === 'ext4' || fs === 'ext3' || fs === 'ext2') {
		if (!t || !t.has_mkfs_ext4)
			missing.push('e2fsprogs');
		if (!t || !t.has_kmod_ext4)
			missing.push('kmod-fs-ext4');
	}
	else if (fs === 'fat' || fs === 'vfat') {
		/* VeraCrypt formats FAT itself; mounting needs the kernel module. */
		if (!t || !t.has_kmod_vfat)
			missing.push('kmod-fs-vfat');
	}
	else if (fs === 'ntfs') {
		if (!t || !t.has_mkfs_ntfs)
			missing.push('ntfs-3g-utils');
		if (!t || !t.has_kmod_ntfs)
			missing.push('kmod-fs-ntfs3');
	}
	else if (fs === 'exfat') {
		if (!t || !t.has_mkfs_exfat)
			missing.push('exfat-mkfs');
		if (!t || !t.has_kmod_exfat)
			missing.push('kmod-fs-exfat');
	}
	return missing;
}

function packagesForFsck(fs) {
	switch (fs) {
		case 'ext4':
		case 'ext3':
		case 'ext2':
			return [ 'e2fsprogs' ];
		case 'fat':
		case 'vfat':
			return [ 'dosfstools' ];
		case 'ntfs':
			return [ 'ntfs-3g-utils' ];
		case 'exfat':
			return [ 'exfat-fsck' ];
		default:
			return [ 'e2fsprogs' ];
	}
}

function fsckToolsReady(t, fs) {
	if (!t)
		return false;
	if (!fs || fs === 'none')
		return !!(t.has_e2fsck || t.has_fsck_ext4 || t.has_fsck_fat || t.has_fsck_exfat || t.has_ntfsfix || t.has_fsck);
	if (fs === 'ext4' || fs === 'ext3' || fs === 'ext2')
		return !!(t.has_e2fsck || t.has_fsck_ext4);
	if (fs === 'fat' || fs === 'vfat')
		return !!t.has_fsck_fat;
	if (fs === 'ntfs')
		return !!t.has_ntfsfix;
	if (fs === 'exfat')
		return !!t.has_fsck_exfat;
	return !!t.has_fsck;
}

function setLogText(logEl, text) {
	if (!logEl)
		return;
	var nearBottom = (logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight) < 48;
	logEl.textContent = text || '';
	if (nearBottom)
		logEl.scrollTop = logEl.scrollHeight;
}

function copyText(text) {
	text = text || '';
	if (navigator.clipboard && navigator.clipboard.writeText)
		return navigator.clipboard.writeText(text);
	var ta = document.createElement('textarea');
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.left = '-9999px';
	document.body.appendChild(ta);
	ta.select();
	try { document.execCommand('copy'); } catch (e) {}
	document.body.removeChild(ta);
	return Promise.resolve();
}

function saveTextFile(name, text) {
	var blob = new Blob([ text || '' ], { type: 'text/plain;charset=utf-8' });
	var url = URL.createObjectURL(blob);
	var a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	window.setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
}

function logStamp(action) {
	var d = new Date();
	function z(n) { return (n < 10 ? '0' : '') + n; }
	return 'veracrypt-' + (action || 'job') + '-' +
		d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' +
		z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds()) + '.log';
}

function abortButton(ctl) {
	return El('button', {
		'type': 'button',
		'class': 'btn cbi-button-remove',
		'title': _('Abort / cancel. Stop the job on the router (veracrypt, fsck, or apk) and close this dialog.'),
		'click': function(ev) {
			ctl.stopped = true;
			// No job id yet: abort it as soon as the run call returns one.
			if (!ctl.job) {
				ev.currentTarget.disabled = true;
				ev.currentTarget.textContent = _('Aborting…');
				return;
			}
			callJobAbort(ctl.job).then(function(res) {
				ui.hideModal();
				showResult({ ok: false, error: (res && res.output) || _('Aborted.') });
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, El('p', err.message || _('Aborted.')), 'warning');
			});
		}
	}, _('Abort'));
}

function installPackages(list) {
	var limit = timeoutSec();
	var statusEl = El('p');
	var elapsed = 0;
	var left = limit;
	var ctl = { stopped: false };
	function paint() {
		statusEl.textContent = _('apk add %s — elapsed %s, timeout in %s').format(list.join(' '), fmtClock(elapsed), fmtClock(left));
	}
	modal(_('Install packages'), [
		statusEl,
		El('div', { 'class': 'right' }, [ abortButton(ctl) ])
	]);
	paint();
	var iv = window.setInterval(function() {
		elapsed++;
		left--;
		paint();
	}, 1000);
	var inst = rpc.declare({
		object: 'luci.veracrypt',
		method: 'pkg_install',
		timeout: limit * 1000,
		params: [ 'packages' ]
	});
	return inst(list.join(' ')).then(function(res) {
		if (ctl.stopped) {
			// Abort was pressed before the job id arrived.
			return ((res && res.pending && res.job) ? callJobAbort(res.job) : Promise.resolve(null)).then(function(r) {
				ui.hideModal();
				showResult({ ok: false, error: (r && r.output) || _('Aborted.') });
				return { ok: false, aborted: true };
			});
		}
		if (res && res.pending) {
			ctl.job = res.job;
			return waitJob(left, statusEl, null, ctl);
		}
		return res;
	}).then(function(res) {
		window.clearInterval(iv);
		if (ctl.stopped)
			return false;
		ui.hideModal();
		showResult(res);
		return res && res.ok !== false;
	}).catch(function(err) {
		window.clearInterval(iv);
		ui.hideModal();
		if (ctl.stopped)
			return false;
		var msg = err.message || String(err);
		if (/permission|access denied/i.test(msg))
			msg = _('Installing packages from this page needs the "luci-app-veracrypt-pkg" permission. Install %s under System → Software instead.').format(list.join(' '));
		ui.addNotification(null, El('p', msg), 'error');
		return false;
	});
}

function ensureFsPackages(o) {
	if (o.action !== 'create')
		return Promise.resolve(true);
	var fs = o.filesystem || 'none';
	if (!fs || fs === 'none')
		return Promise.resolve(true);
	return callTools().then(function(t) {
		var pkgs = missingPackages(t, fs);
		if (!pkgs.length)
			return true;
		return new Promise(function(resolve) {
			modal(_('Missing tools for %s').format(fs), [
				El('p', _('Creating a volume with an inner %s filesystem needs these packages, which are not installed: %s. Already-present mkfs tools and kmods are not listed. Install with apk add, or create with filesystem=none and format after mapping.').format(fs, pkgs.join(' '))),
				El('div', { 'class': 'right' }, [
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close this dialog. The volume is not created.'),
						'click': function() { ui.hideModal(); resolve(false); }
					}, _('Cancel')),
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Create the container with --filesystem=none. Format the inner filesystem later after mount.'),
						'click': function() {
							ui.hideModal();
							o.filesystem = 'none';
							resolve(true);
						}
					}, _('Create with filesystem=none')),
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn cbi-button-apply',
						'title': _('apk add %s, then create the volume with the chosen inner filesystem.').format(pkgs.join(' ')),
						'click': function() {
							ui.hideModal();
							installPackages(pkgs).then(function(ok) { resolve(ok); });
						}
					}, _('apk add and continue'))
				])
			]);
		});
	});
}

function ensureFsckPackages(o) {
	if (o.action !== 'fsck')
		return Promise.resolve(true);
	var fs = o.filesystem || '';
	var pkgs = packagesForFsck(fs);
	return callTools().then(function(t) {
		if (fsckToolsReady(t, fs))
			return true;
		return new Promise(function(resolve) {
			modal(_('Missing fsck tools'), [
				El('p', _('Checking a volume cannot be done without the matching fsck tool. The app decrypts with --filesystem=none, runs fsck on the mapper or loop device and keeps it mapped until you close the dialog. Install: %s (e2fsprogs for ext*, dosfstools for FAT, exfat-fsck for exFAT, ntfs-3g-utils for NTFS).').format(pkgs.join(' '))),
				El('div', { 'class': 'right' }, [
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close this dialog. fsck is not run.'),
						'click': function() { ui.hideModal(); resolve(false); }
					}, _('Cancel')),
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn cbi-button-apply',
						'title': _('Install %s with apk add. fsck cannot run without these tools.').format(pkgs.join(' ')),
						'click': function() {
							ui.hideModal();
							installPackages(pkgs).then(function(ok) { resolve(ok); });
						}
					}, _('apk add'))
				])
			]);
		});
	});
}

function showResult(res) {
	var err = res && res.error ? String(res.error) : '';
	if (res && res.need_packages) {
		var pkgs = String(res.need_packages).split(/[\s,]+/).filter(Boolean);
		modal(_('Missing fsck tools'), [
			El('pre', err || _('Checking a volume cannot be done without the matching fsck tool.')),
			El('p', _('apk add %s').format(pkgs.join(' '))),
			El('div', { 'class': 'right' }, [
				El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Close this dialog. fsck is not run.'),
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				El('button', {
					'type': 'button',
					'class': 'btn cbi-button-apply',
					'title': _('Install %s with apk add. fsck cannot run without these tools.').format(pkgs.join(' ')),
					'click': function() {
						ui.hideModal();
						installPackages(pkgs);
					}
				}, _('apk add'))
			])
		]);
		return;
	}
	if (!res || res.ok === false)
		ui.addNotification(null, El('pre', err || _('Command failed')), 'error');
	else if (res.output)
		ui.addNotification(null, El('pre', res.output), 'info');
	else
		ui.addNotification(null, El('p', _('OK')), 'info');
}

function field(type, attrs) {
	attrs = attrs || {};
	attrs.type = type || 'text';
	attrs.style = (attrs.style || '') + ';width:100%';
	return El('input', attrs);
}

function select(values, cur) {
	var s = El('select', { 'style': 'width:100%' });
	values.forEach(function(v) {
		var val = Array.isArray(v) ? v[0] : v;
		var lab = Array.isArray(v) ? v[1] : v;
		var opt = El('option', { 'value': val }, lab);
		if (String(cur) === String(val))
			opt.selected = true;
		s.appendChild(opt);
	});
	return s;
}

function pathRow(label, value, dirsOnly, opts) {
	opts = opts || {};
	var allowDirValue = !!opts.allowDirValue || !!dirsOnly;
	var inp = field('text', {
		'value': value || '',
		'placeholder': dirsOnly ? '/mnt/data' : '/mnt/sda1/media.hc'
	});
	var listing = El('div', { 'style': 'max-height:180px;overflow:auto;margin-top:6px' });
	var status = El('p', { 'class': 'cbi-map-descr' });
	var newName = El('input', {
		'type': 'text',
		'placeholder': 'newdir',
		'style': 'width:60%'
	});
	var browse = value || '/mnt';
	if (!dirsOnly && browse.lastIndexOf('/') > 0)
		browse = browse.substring(0, browse.lastIndexOf('/')) || '/mnt';

	function setStatus(t) {
		status.textContent = t || '';
	}

	function load(path) {
		if (!path)
			path = '/mnt';
		setStatus(_('Listing %s…').format(path));
		return callListDir(path).then(function(res) {
			while (listing.firstChild)
				listing.removeChild(listing.firstChild);
			if (!res || res.ok === false) {
				setStatus(res && res.error ? res.error : _('Cannot list directory'));
				var trimmed = String(path || '').replace(/\/+$/, '');
				var parent = trimmed.substring(0, trimmed.lastIndexOf('/')) || '/mnt';
				if (parent !== path)
					return load(parent);
				return;
			}
			browse = res.path || path;
			setStatus(_('Browsing %s. Create or delete here without leaving this dialog.').format(browse));
			(res.entries || []).forEach(function(ent) {
				if (!ent || !ent.name)
					return;
				var isDir = ent.type === 'dir';
				var isDot = ent.name === '..';
				var row = El('div', { 'style': 'white-space:nowrap;margin:1px 0' });
				if (!dirsOnly || isDir) {
					row.appendChild(El('button', {
						'type': 'button',
						'class': 'btn',
						'style': 'margin:1px',
						'title': isDir
							? _('Open directory %s').format(ent.path)
							: _('Select file %s').format(ent.path),
						'click': function(ev) {
							if (ev)
								ev.preventDefault();
							if (isDir) {
								if (allowDirValue && !isDot)
									inp.value = ent.path;
								load(ent.path);
							}
							else {
								inp.value = ent.path;
							}
						}
					}, isDir ? ent.name + '/' : ent.name));
				}
				else {
					row.appendChild(El('span', { 'style': 'margin:1px' }, ent.name));
				}
				if (!isDot) {
					row.appendChild(El('button', {
						'type': 'button',
						'class': 'btn cbi-button-remove',
						'style': 'margin:1px',
						'title': _('Delete %s after confirmation. The dialog stays open.').format(ent.path),
						'click': function(ev) {
							if (ev) {
								ev.preventDefault();
								ev.stopPropagation();
							}
							removePath(ent.path, isDir);
						}
					}, _('Delete')));
				}
				listing.appendChild(row);
			});
		}).catch(function(err) {
			setStatus(err.message || String(err));
		});
	}

	function makeDir(ev) {
		if (ev) {
			ev.preventDefault();
			ev.stopPropagation();
		}
		var n = (newName.value || '').trim().replace(/\/+$/, '');
		if (!n) {
			setStatus(_('Type a directory name, then Create directory.'));
			return;
		}
		var p = n.charAt(0) === '/' ? n : String(browse || '/mnt').replace(/\/+$/, '') + '/' + n.replace(/^\/+/, '');
		setStatus(_('Creating %s…').format(p));
		return callMkdir(p).then(function(res) {
			if (!res || res.ok === false) {
				setStatus(res && res.error ? res.error : _('mkdir failed'));
				return;
			}
			inp.value = p;
			newName.value = '';
			return load(p);
		}).catch(function(err) {
			setStatus(err.message || String(err));
		});
	}

	function removePath(p, isDir) {
		p = String(p || '').trim();
		if (!p) {
			setStatus(_('Nothing to delete.'));
			return;
		}
		var msg = isDir
			? _('Delete directory %s? This cannot be undone.').format(p)
			: _('Delete file %s? This cannot be undone.').format(p);
		if (!window.confirm(msg))
			return;
		setStatus(_('Deleting %s…').format(p));
		return callRm(p).then(function(res) {
			if (!res)
				return;
			if (!res.ok) {
				setStatus(res.error || _('delete failed'));
				return;
			}
			if (inp.value === p)
				inp.value = browse || '';
			setStatus(_('Deleted %s.').format(p));
			return load(browse);
		}).catch(function(err) {
			setStatus(err.message || String(err));
		});
	}

	newName.addEventListener('keydown', function(ev) {
		if (ev.key === 'Enter' || ev.keyCode === 13) {
			ev.preventDefault();
			ev.stopPropagation();
			makeDir(ev);
		}
	});

	load(browse);

	return {
		node: El('div', { 'class': 'cbi-value' }, [
			El('label', { 'class': 'cbi-value-title' }, label),
			El('div', { 'class': 'cbi-value-field' }, [
				El('p', { 'class': 'cbi-map-descr' },
					dirsOnly
						? _('Type the directory, browse below, or create a directory. Create and per-row Delete stay in this dialog.')
						: (allowDirValue
							? _('Type a path, or browse and click a file or directory. A directory is a valid keyfile: all non-hidden files in it are used.')
							: _('Type the container path, or browse and click the file. You can create directories here.'))
				),
				inp,
				status,
				listing,
				El('div', {}, [
					newName,
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Create the named directory under the current folder. The dialog stays open.'),
						'click': makeDir
					}, _('Create directory'))
				])
			])
		]),
		getValue: function() {
			return (inp.value || '').trim() || value || '';
		},
		getDir: function() {
			return browse || '/mnt';
		}
	};
}

function parseTokenKeyfiles(text) {
	var out = [];
	String(text || '').split(/\r?\n/).forEach(function(line) {
		line = line.trim();
		var m = line.match(/(token:\/\/slot\/[0-9]+\/file\/\S+|emv:\/\/slot\/[0-9]+)/);
		if (m)
			out.push(m[1]);
	});
	return out;
}

function keyfilesRow(label, initial) {
	var items = splitKeyfiles(initial || '');
	var listEl = El('div');
	var tokenBox = El('div');
	var picker = pathRow(_('Browse'), '', false, { allowDirValue: true });

	function renderList() {
		while (listEl.firstChild)
			listEl.removeChild(listEl.firstChild);
		if (!items.length) {
			listEl.appendChild(El('p', { 'class': 'cbi-map-descr' }, _('No keyfiles selected.')));
			return;
		}
		items.forEach(function(p, idx) {
			listEl.appendChild(El('div', { 'style': 'white-space:nowrap;margin:2px 0' }, [
				El('span', {}, p),
				' ',
				El('button', {
					'type': 'button',
					'class': 'btn cbi-button-remove',
					'title': _('Remove %s from the keyfile list. The file is not deleted.').format(p),
					'click': function() {
						items.splice(idx, 1);
						renderList();
					}
				}, _('Remove'))
			]));
		});
	}

	function addPath(p) {
		p = String(p || '').trim();
		if (!p)
			return;
		if (items.indexOf(p) === -1)
			items.push(p);
		renderList();
	}

	function addTokenFiles() {
		var lib = uci.get('veracrypt', 'main', 'token_lib') || '';
		if (!lib) {
			ui.addNotification(null, El('p',
				_('No PKCS #11 library path is set. Use Settings → Security token library (example: /usr/lib/libykcs11.so).')
			), 'warning');
			return;
		}
		while (tokenBox.firstChild)
			tokenBox.removeChild(tokenBox.firstChild);
		tokenBox.appendChild(El('p', { 'class': 'cbi-map-descr' }, _('Listing token keyfiles…')));
		return invokeRun({ action: 'list-token-keyfiles', token_lib: lib }).then(function(res) {
			while (tokenBox.firstChild)
				tokenBox.removeChild(tokenBox.firstChild);
			var paths = parseTokenKeyfiles((res && (res.output || res.error)) || '');
			if (!paths.length) {
				tokenBox.appendChild(El('p', { 'class': 'cbi-map-descr' },
					(res && res.error) || _('No token keyfiles listed. Set Settings → Security token library, or import a keyfile onto the token.')));
				return;
			}
			tokenBox.appendChild(El('p', { 'class': 'cbi-map-descr' },
				_('Token keyfiles. Click to add. VeraCrypt never modifies keyfile contents.')));
			paths.forEach(function(p) {
				tokenBox.appendChild(El('button', {
					'type': 'button',
					'class': 'btn',
					'style': 'margin:2px',
					'title': _('Add %s as a keyfile.').format(p),
					'click': function() { addPath(p); }
				}, p));
			});
		}).catch(function(err) {
			while (tokenBox.firstChild)
				tokenBox.removeChild(tokenBox.firstChild);
			tokenBox.appendChild(El('p', { 'class': 'cbi-map-descr' }, err.message || String(err)));
		});
	}

	renderList();
	return {
		node: El('div', { 'class': 'cbi-value' }, [
			El('label', { 'class': 'cbi-value-title' }, label || _('Keyfiles')),
			El('div', { 'class': 'cbi-value-field' }, [
				El('p', { 'class': 'cbi-map-descr' },
					_('VeraCrypt never modifies keyfile contents. You can select more than one keyfile (the order does not matter). If you add a folder, all non-hidden files found in it will be used as keyfiles.')),
				listEl,
				tokenBox,
				picker.node,
				El('div', {}, [
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Add the selected file to the keyfile list.'),
						'click': function() { addPath(picker.getValue()); }
					}, _('Add file')),
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Add the current directory as a keyfile. All non-hidden files in it will be used.'),
						'click': function() { addPath(picker.getValue() || picker.getDir()); }
					}, _('Add directory')),
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Select keyfiles stored on a security token or smart card (token://).'),
						'click': addTokenFiles
					}, _('Add token files'))
				])
			])
		]),
		getValue: function() {
			return joinKeyfiles(items);
		}
	};
}

function val(el) {
	return el && el.value != null ? String(el.value) : '';
}

function flag(el) {
	return el && el.checked ? '1' : '';
}

function actionHint(action) {
	switch (action) {
		case 'mount':
			return _('This operation can take several minutes on a slow CPU with little RAM.');
		case 'create':
			return _('Creating a volume, especially without quick format, can take several minutes on a slow CPU with little RAM.');
		case 'fsck':
			return _('Decrypting the volume and running fsck can take several minutes on a slow CPU with little RAM.');
		case 'test':
			return _('Algorithm self-tests can take several minutes on a slow CPU with little RAM.');
		case 'change':
			return _('Changing the password re-derives the header and can take several minutes on a slow CPU with little RAM.');
		case 'backup-headers':
		case 'restore-headers':
			return _('Header backup or restore can take several minutes on a slow CPU with little RAM.');
		case 'create-keyfile':
			return _('Writing a random keyfile is usually quick.');
		default:
			return '';
	}
}

function workingLine(action, elapsed, left) {
	if (action === 'unmount')
		return _('Unmounting… elapsed %s. Timeout in %s.').format(fmtClock(elapsed), fmtClock(left));
	return _('Working… elapsed %s. Timeout in %s.').format(fmtClock(elapsed), fmtClock(left));
}

function waitJob(limit, statusEl, logEl, ctl, action) {
	var left = limit;
	var elapsed = 0;
	var job = callJobWithTimeout();
	ctl = ctl || {};
	action = action || '';
	var hint = actionHint(action);

	function paint() {
		var line = workingLine(action, elapsed, left);
		// runActionNow shows the hint in its own element.
		if (hint && !ctl.hintShown)
			line += ' ' + hint;
		statusEl.textContent = line;
	}
	paint();

	var iv = window.setInterval(function() {
		elapsed++;
		left--;
		paint();
	}, 1000);

	function poll() {
		if (ctl.stopped) {
			window.clearInterval(iv);
			return { ok: false, aborted: true, error: _('Aborted.') };
		}
		if (left <= 0) {
			window.clearInterval(iv);
			return {
				ok: false,
				error: _('Timed out after %s. veracrypt may still be running on the router. Use Abort next time, or raise the timeout under Settings.')
					.format(fmtClock(limit))
			};
		}
		return job(ctl.job || '').then(function(res) {
			if (ctl.stopped) {
				window.clearInterval(iv);
				return { ok: false, aborted: true, error: _('Aborted.') };
			}
			if (logEl && res && res.output)
				setLogText(logEl, res.output);
			if (res && res.pending)
				return new Promise(function(resolve) {
					window.setTimeout(function() { resolve(poll()); }, 1000);
				});
			window.clearInterval(iv);
			return res;
		}).catch(function(err) {
			window.clearInterval(iv);
			throw err;
		});
	}
	return poll();
}

function showCloseDialog(title, text) {
	modal(title || _('VeraCrypt'), [
		El('pre', {
			'style': 'max-height:360px;overflow:auto;white-space:pre-wrap;user-select:text;background:var(--background-color-high, #111);padding:8px'
		}, text || ''),
		El('div', { 'class': 'right' }, [
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Close this dialog.'),
				'click': ui.hideModal
			}, _('Close'))
		])
	]);
}

/* token:// keyfiles need the PKCS #11 PIN; ask for it once per operation. */
function needsTokenPin(opts) {
	return !opts.token_pin && opts.action !== 'list-token-keyfiles' &&
		/token:\/\//.test([ opts.keyfiles, opts.new_keyfiles, opts.protection_keyfiles ].join(' '));
}

function runAction(opts) {
	if (!needsTokenPin(opts))
		return runActionNow(opts);
	return new Promise(function(resolve) {
		var pin = El('input', { 'type': 'password', 'class': 'cbi-input-password', 'autocomplete': 'off' });
		modal(_('Security token PIN'), [
			El('p', _('The keyfiles include a file on a security token. Enter the token PIN.')),
			pin,
			El('div', { 'class': 'right' }, [
				El('button', { 'type': 'button', 'class': 'btn', 'click': function() {
					ui.hideModal();
					resolve(null);
				} }, _('Cancel')),
				' ',
				El('button', { 'type': 'button', 'class': 'btn cbi-button-apply', 'click': function() {
					ui.hideModal();
					opts.token_pin = pin.value;
					resolve(runActionNow(opts));
				} }, _('Continue'))
			])
		]);
	});
}

function runActionNow(opts) {
	var limit = timeoutSec();
	var action = opts.action || '';
	if (action === 'help' || action === 'version') {
		return invokeRun(opts).then(function(res) {
			showCloseDialog(action === 'help' ? _('Help') : _('Version'),
				(res && (res.output || res.error)) || (res && res.ok !== false ? _('OK') : _('Command failed')));
			return res;
		}).catch(function(err) {
			showCloseDialog(_('VeraCrypt'), err.message || String(err));
		});
	}
	var statusEl = El('p');
	var hintEl = El('p', { 'class': 'cbi-map-descr' }, actionHint(action));
	var elapsed = 0;
	var left = limit;
	var ctl = { stopped: false, hintShown: true };
	var showLog = (action === 'fsck' || action === 'create' || action === 'change' ||
		action === 'backup-headers' || action === 'restore-headers' || action === 'test' ||
		action === 'create-keyfile' || action === 'list-token-keyfiles' ||
		action === 'volume-properties');
	var showCopySave = (action === 'fsck' || action === 'create' || action === 'change' ||
		action === 'backup-headers' || action === 'restore-headers' || action === 'volume-properties');
	var autoClose = (action === 'unmount' || action === 'mount');
	function paint() {
		statusEl.textContent = workingLine(action, elapsed, left);
	}
	var logEl = El('pre', {
		'style': 'max-height:280px;overflow:auto;white-space:pre-wrap;user-select:text;background:var(--background-color-high, #111);padding:8px' +
			(showLog ? '' : ';display:none')
	});
	var ynBox = El('p');
	if (action === 'fsck' && opts.fsck_auto !== '1')
		ynBox.appendChild(El('p', { 'class': 'cbi-map-descr' },
			_('Check only: nothing is changed. Use automatic repair to fix errors.')));
	var closeBtn = El('button', {
		'type': 'button',
		'class': 'btn',
		'style': 'display:none',
		'title': action === 'fsck'
			? _('Unmount the decrypted volume and close this dialog.')
			: _('Close this dialog.'),
		'click': function() {
			function done() {
				ui.hideModal();
				if (action === 'fsck' || action === 'mount' || action === 'create' || action === 'unmount' || action === 'test')
					window.location.reload();
			}
			if (action === 'fsck') {
				statusEl.textContent = _('Unmounting…');
				callJobDismount(ctl.job || '').then(done).catch(done);
				return;
			}
			done();
		}
	}, _('Close'));
	var copyBtn = El('button', {
		'type': 'button',
		'class': 'btn',
		'style': showCopySave ? '' : 'display:none',
		'title': _('Copy the log to the clipboard.'),
		'click': function() {
			var t = logEl.textContent || '';
			copyText(t).then(function() {
				statusEl.textContent = _('Log copied to clipboard.');
			}).catch(function() {
				statusEl.textContent = _('Copy failed. Select the log and copy it yourself.');
			});
		}
	}, _('Copy log'));
	var abortEl = abortButton(ctl);
	var saveBtn = El('button', {
		'type': 'button',
		'class': 'btn',
		'style': showCopySave ? '' : 'display:none',
		'title': _('Save the log as a text file on this computer.'),
		'click': function() {
			callJobLog(ctl.job || '').then(function(res) {
				var t = (res && res.output) || logEl.textContent || '';
				saveTextFile(logStamp(action), t);
			}).catch(function() {
				saveTextFile(logStamp(action), logEl.textContent || '');
			});
		}
	}, _('Save log'));
	var nodes = [ statusEl ];
	if (actionHint(action))
		nodes.push(hintEl);
	nodes.push(ynBox, logEl);
	nodes.push(El('div', { 'class': 'right' }, [
		copyBtn, ' ', saveBtn, ' ', abortEl, ' ', closeBtn
	]));
	modal(_('VeraCrypt'), nodes);
	paint();
	var iv = window.setInterval(function() {
		elapsed++;
		left--;
		paint();
	}, 1000);
	return invokeRun(opts).then(function(res) {
		if (ctl.stopped) {
			window.clearInterval(iv);
			return ((res && res.pending && res.job) ? callJobAbort(res.job) : Promise.resolve(null)).then(function(r) {
				ui.hideModal();
				showResult({ ok: false, error: (r && r.output) || _('Aborted.') });
				return { ok: false, aborted: true };
			});
		}
		if (res && res.pending) {
			window.clearInterval(iv);
			ctl.job = res.job;
			return waitJob(left, statusEl, logEl, ctl, action);
		}
		return res;
	}).then(function(res) {
		window.clearInterval(iv);
		if (ctl.stopped)
			return res;
		if (res && (res.output || res.error))
			setLogText(logEl, res.output || res.error);
		if (res && res.ok === false) {
			statusEl.textContent = res.error || _('Failed.');
			closeBtn.style.display = '';
			abortEl.style.display = 'none';
			res.keepOpen = true;
			return res;
		}
		if (action === 'fsck') {
			statusEl.textContent = _('fsck finished. Volume is still decrypted. Close to unmount.');
			closeBtn.style.display = '';
			abortEl.style.display = 'none';
			if (!res)
				res = { ok: true };
			res.keepOpen = true;
			return res;
		}
		if (autoClose) {
			ui.hideModal();
			// The caller reloads itself once its follow-up work is done.
			if (opts.noReload)
				return res || { ok: true };
			window.location.reload();
			res = res || { ok: true };
			res.keepOpen = true;
			return res;
		}
		statusEl.textContent = _('Finished.');
		closeBtn.style.display = '';
		abortEl.style.display = 'none';
		if (!res)
			res = { ok: true };
		res.keepOpen = true;
		return res;
	}).catch(function(err) {
		window.clearInterval(iv);
		if (ctl.stopped) {
			ui.hideModal();
			return;
		}
		setLogText(logEl, err.message || String(err));
		statusEl.textContent = err.message || String(err);
		closeBtn.style.display = '';
		abortEl.style.display = 'none';
	});
}

var HASHES = [ '', 'sha-512', 'sha-256', 'whirlpool', 'streebog' ];
var CIPHERS = [ '', 'AES', 'Serpent', 'Twofish', 'Camellia', 'Kuznyechik',
	'AES-Twofish', 'AES-Twofish-Serpent', 'Serpent-AES', 'Serpent-Twofish-AES',
	'Twofish-Serpent' ];
var FSTYPES = [ '', 'ext4', 'ext3', 'ext2', 'fat', 'ntfs', 'exfat', 'none' ];
var VTYPES = [ '', 'normal', 'hidden' ];

function slotSelect(cur) {
	var opts = [ [ '', _('(none)') ] ];
	for (var i = 1; i <= 64; i++)
		opts.push([ String(i), String(i) ]);
	return select(opts, cur || '');
}

function sectionName(sid) {
	return uci.get('veracrypt', sid, '.name') || sid;
}

function safeAbsPath(p) {
	p = String(p || '');
	if (!p)
		return '';
	if (p.charAt(0) !== '/')
		return '';
	if (/(^|\/)\.\.(\/|$)/.test(p))
		return '';
	if (/[`$;|&<>(){}!*?'"\\\n\r\t]/.test(p))
		return '';
	return p;
}

/* VeraCrypt keyfile lists are comma separated; ",," is a literal comma. */
function splitKeyfiles(list) {
	return String(list || '').replace(/,,/g, '\u0001').split(',').filter(function(k) {
		return k !== '';
	}).map(function(k) {
		return k.replace(/\u0001/g, ',');
	});
}

function joinKeyfiles(items) {
	return items.map(function(k) {
		return String(k).replace(/,/g, ',,');
	}).join(',');
}

function safeKeyfiles(list) {
	var items = splitKeyfiles(list);
	var ok = items.filter(function(k) {
		return /^(token:\/\/slot\/[0-9]+\/file\/.+|emv:\/\/slot\/[0-9]+)$/.test(k) || safeAbsPath(k) !== '';
	});
	return ok.length === items.length ? joinKeyfiles(ok) : null;
}

/* A directory directly under /mnt, e.g. /mnt/data. */
function isMntChild(p) {
	return typeof p === 'string' && p.length > 5 && p.indexOf('/mnt/') === 0 &&
		p.indexOf('/', 5) < 0;
}

function saveFavorite(name, opts) {
	opts = opts || {};
	name = String(name || '').trim();
	if (!/^[A-Za-z0-9_]{1,32}$/.test(name))
		return Promise.reject({ message: _('Name must be letters, digits or underscore (e.g. buffalo).') });
	if (uci.get('veracrypt', name))
		return Promise.reject({ message: _('A favorite named “%s” already exists.').format(name) });
	var vol = safeAbsPath(opts.volume);
	var mp = safeAbsPath(opts.mountpoint);
	var kf = safeKeyfiles(opts.keyfiles);
	if (!vol)
		return Promise.reject({ message: _('Invalid volume path.') });
	if (!isMntChild(mp))
		return Promise.reject({ message: _('A favorite needs a mount point directly under /mnt (e.g. /mnt/data). Mount the volume with a filesystem first.') });
	if (kf === null)
		return Promise.reject({ message: _('Invalid keyfile in the list.') });
	uci.add('veracrypt', 'volume', name);
	uci.set('veracrypt', name, 'volume', vol);
	uci.set('veracrypt', name, 'mountpoint', mp);
	var sl = parseInt(opts.slot, 10);
	if (sl >= 1 && sl <= 64)
		uci.set('veracrypt', name, 'slot', String(sl));
	if (kf)
		uci.set('veracrypt', name, 'keyfiles', kf);
	return uci.save().then(function() { return uci.apply(); });
}

function suggestFavName(volume) {
	var base = String(volume || '').replace(/\/+$/, '').split('/').pop() || '';
	base = base.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
	if (!base)
		base = 'vol';
	if (/^[0-9]/.test(base))
		base = 'v_' + base;
	return base.substring(0, 32);
}

function promptAddFavorite(opts) {
	var inp = El('input', {
		'type': 'text',
		'class': 'cbi-input-text',
		'placeholder': 'buffalo',
		'style': 'width:100%',
		'value': suggestFavName(opts && opts.volume)
	});
	function go() {
		var n = String(inp.value || '').trim();
		return saveFavorite(n, opts).then(function() {
			ui.hideModal();
			ui.addNotification(null, El('p', _('Saved favorite “%s”.').format(n)), 'info');
			window.location.reload();
		}).catch(function(err) {
			ui.addNotification(null, El('p', err.message || String(err)), 'error');
		});
	}
	inp.addEventListener('keydown', function(ev) {
		if (ev.key === 'Enter' || ev.keyCode === 13) {
			ev.preventDefault();
			go();
		}
	});
	modal(_('Add as favorite'), [
		El('p', _('Short name for this mounted container or device. After Save it appears in Favorites. Passwords are not stored.')),
		El('p', (opts && opts.volume) || ''),
		El('div', { 'class': 'cbi-value' }, [
			El('label', { 'class': 'cbi-value-title' }, _('Name')),
			El('div', { 'class': 'cbi-value-field' }, inp)
		]),
		El('div', { 'class': 'right' }, [
			El('button', { 'type': 'button', 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn cbi-button-apply',
				'title': _('Save this volume in the favorite list.'),
				'click': go
			}, _('Save'))
		])
	]);
	window.setTimeout(function() { try { inp.focus(); inp.select(); } catch (e) {} }, 50);
}

return view.extend({
	load: function() {
		return uci.load('veracrypt').then(function() {
			return L.resolveDefault(callStatus(), {});
		});
	},

	render: function(data) {
		var st = data || {};
		var status = {};
		(st.volumes || []).forEach(function(v) {
			status[v.name] = v;
		});
		var slots = st.slots || [];
		var m, s, o;

		var body = El('div');
		var ver = String(st.version || '').replace(/^veracrypt\s*/i, '');
		var titleKids = [
			El('a', {
				'href': 'https://veracrypt.jp/en/Home.html',
				'target': '_blank',
				'rel': 'noopener noreferrer',
				'title': _('VeraCrypt home page')
			}, _('VeraCrypt'))
		];
		if (ver)
			titleKids.push(' ' + ver);
		var favVol = {};
		uci.sections('veracrypt', 'volume', function(s) {
			if (s.volume)
				favVol[s.volume] = true;
		});
		body.appendChild(El('div', {
			'style': 'display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap'
		}, [
			El('h2', { 'style': 'margin:0' }, titleKids),
			El('div', {}, [
				El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Show the VeraCrypt version string (veracrypt --version).'),
					'click': ui.createHandlerFn(null, function() {
						return runAction({ action: 'version' });
					})
				}, _('Version')),
				' ',
				El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Show console help (veracrypt --help).'),
					'click': ui.createHandlerFn(null, function() {
						return runAction({ action: 'help' });
					})
				}, _('Help'))
			])
		]));
		body.appendChild(El('p', { 'class': 'cbi-map-descr' },
			_('VeraCrypt is free open-source disk encryption software.')));
		body.appendChild(El('hr'));
		body.appendChild(El('h3', _('Slots')));
		body.appendChild(El('p', { 'class': 'cbi-map-descr' },
			_('Used slots plus one empty slot. Mount container picks a file; Mount device lists disks and partitions that are not in use.')));

		var table = El('table', { 'class': 'table' }, [
			El('tr', { 'class': 'tr table-titles' }, [
				El('th', { 'class': 'th' }, _('Slot')),
				El('th', { 'class': 'th' }, _('Volume')),
				El('th', { 'class': 'th' }, _('Actions'))
			])
		]);
		slots.forEach(function(sl) {
			if (!sl.used)
				return;
			var parsed = {
				volume: sl.volume || '',
				vdev: sl.vdev || '',
				mountpoint: sl.mountpoint || ''
			};
			var acts = [
				El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Show properties of the volume in slot %s (veracrypt --volume-properties).').format(String(sl.slot)),
					'click': ui.createHandlerFn(null, function() {
						return runAction({ action: 'volume-properties', slot: String(sl.slot) });
					})
				}, _('Properties')),
				' ',
				El('button', {
					'type': 'button',
					'class': 'btn cbi-button-remove',
					'title': _('Unmount slot %s (veracrypt --unmount --slot=%s).').format(String(sl.slot), String(sl.slot)),
					'click': ui.createHandlerFn(null, function() {
						return runAction({ action: 'unmount', slot: String(sl.slot), volume: parsed.volume, mountpoint: parsed.mountpoint });
					})
				}, _('Unmount'))
			];
			if (parsed.volume && !favVol[parsed.volume]) {
				acts.push(' ');
				acts.push(El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Save this mounted volume in Favorites under a short name. Passwords are not stored.'),
					'click': ui.createHandlerFn(null, function() {
						promptAddFavorite({
							volume: parsed.volume,
							mountpoint: parsed.mountpoint,
							slot: String(sl.slot)
						});
					})
				}, _('Add as favorite')));
			}
			table.appendChild(El('tr', { 'class': 'tr' }, [
				El('td', { 'class': 'td' }, String(sl.slot)),
				El('td', { 'class': 'td' }, parsed.mountpoint
					? '%s → %s (%s)'.format(parsed.volume, parsed.mountpoint, parsed.vdev)
					: '%s (%s)'.format(parsed.volume, parsed.vdev)),
				El('td', { 'class': 'td' }, acts)
			]));
		});

		var nextSlot = (st.next_slot != null) ? +st.next_slot : 1;
		if (nextSlot > 0) {
			table.appendChild(El('tr', { 'class': 'tr' }, [
				El('td', { 'class': 'td' }, String(nextSlot)),
				El('td', { 'class': 'td' }, _('(empty)')),
				El('td', { 'class': 'td' }, [
					El('button', {
						'type': 'button',
						'class': 'btn cbi-button-apply',
						'title': _('Browse for a container file and mount it in slot %s.').format(String(nextSlot)),
						'click': ui.createHandlerFn(null, function() {
							openFilePicker(nextSlot);
						})
					}, _('Mount container')),
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Pick a disk or partition and mount it in slot %s.').format(String(nextSlot)),
						'click': ui.createHandlerFn(null, function() {
							openDevicePicker(nextSlot);
						})
					}, _('Mount device'))
				])
			]));
		}
		body.appendChild(table);

		body.appendChild(El('p', {}, [
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Unmount every VeraCrypt volume (veracrypt --unmount).'),
				'click': ui.createHandlerFn(null, function() {
					if (!window.confirm(_('Unmount every VeraCrypt volume?')))
						return;
					return runAction({ action: 'unmount', all: '1' });
				})
			}, _('Unmount all'))
		]));

		function actionModal(title, extraNodes, collect, initial) {
			initial = initial || {};
			var showVolume = !initial.hideVolume;
			var showFilename = !!initial.showFilename;
			var showMount = !!initial.showMount;
			var showKeyfiles = !!initial.showKeyfiles;
			var showSlot = !!initial.showSlot;
			var showQuick = !!initial.showQuick;
			var showForce = !!initial.showForce;
			var vol = pathRow(_('Volume / file'), initial.volume || '', !!initial.dirOnly);
			var mp = pathRow(_('Mount point'), initial.mountpoint || '', true);
			var fname = field('text', { 'placeholder': initial.filenamePlaceholder || 'media.hc', 'value': initial.filename || '' });
			var kf = keyfilesRow(_('Keyfiles'), initial.keyfiles);
			var nkf = keyfilesRow(_('New keyfiles'));
			var rnd = field('text', { 'value': '/dev/urandom', 'placeholder': '/dev/urandom' });
			var pw = field('password', { 'placeholder': _('Enter password') });
			var npw = field('password', { 'placeholder': _('Enter password') });
			var pim = field('text', { 'placeholder': '0' });
			var npim = field('text');
			var slot = slotSelect(initial.slot || '');
			var hash = select(HASHES, initial.hash || '');
			var nhash = select(HASHES, '');
			var enc = select(CIPHERS, initial.encryption || '');
			var fs = select(FSTYPES, initial.filesystem || '');
			var vtype = select(VTYPES, initial.volume_type || 'normal');
			var size = field('text', { 'placeholder': '100M' });
			var autom = select([
				[ 'favorites', _('favorites') ],
				[ 'devices', _('devices') ],
				[ 'devices_favorites', _('devices and favorites') ]
			], 'favorites');
			var force = field('checkbox');
			var quick = field('checkbox');
			var fsckauto = field('checkbox');
			var bak = pathRow(_('Header backup file'), initial.backup_file || '', false);
			var hpw = field('password');
			var fav = field('checkbox');
			var favname = field('text', { 'placeholder': 'buffalo' });
			quick.checked = !!showQuick;
			fsckauto.checked = true;
			if (initial.size)
				size.value = initial.size;

			var nodes = [
				El('p', _('Passwords are sent on stdin and are not saved.'))
			];
			if (showVolume)
				nodes.push(vol.node);
			if (showFilename)
				nodes.push(El('div', { 'class': 'cbi-value' }, [
					El('label', { 'class': 'cbi-value-title' }, _('Container file name')),
					El('div', { 'class': 'cbi-value-field' }, fname)
				]));
			if (showMount)
				nodes.push(mp.node);
			if (showKeyfiles)
				nodes.push(kf.node);
			nodes = nodes.concat(extraNodes({
				vol: vol, mp: mp, kf: kf, nkf: nkf, rnd: rnd, pw: pw, npw: npw,
				pim: pim, npim: npim, slot: slot, hash: hash, nhash: nhash,
				enc: enc, fs: fs, vtype: vtype, size: size, autom: autom,
				force: force, quick: quick, fname: fname, fsckauto: fsckauto,
				bak: bak, hpw: hpw, fav: fav, favname: favname
			}));
			if (showSlot)
				nodes.push(El('div', { 'class': 'cbi-value' }, [
					El('label', { 'class': 'cbi-value-title' }, _('Slot (1–64)')),
					El('div', { 'class': 'cbi-value-field' }, slot)
				]));
			if (showQuick || showForce)
				nodes.push(El('div', { 'class': 'cbi-value' }, [
					El('label', { 'class': 'cbi-value-title' }, _('Options')),
					El('div', { 'class': 'cbi-value-field' }, [
						showQuick ? El('label', {}, [ quick, ' ', _('quick format') ]) : '',
						showQuick && showForce ? ' ' : '',
						showForce ? El('label', {}, [ force, ' ', _('overwrite if the file exists') ]) : ''
					])
				]));
			nodes.push(El('div', { 'class': 'right' }, [
				El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Close this dialog without running VeraCrypt.'),
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				El('button', {
					'type': 'button',
					'class': 'btn cbi-button-apply',
					'title': _('Run the VeraCrypt command. The password is sent on stdin, not --password on the command line.'),
					'click': ui.createHandlerFn(null, function() {
						var o = collect({
							vol: vol, mp: mp, kf: kf, nkf: nkf, rnd: rnd, pw: pw, npw: npw,
							pim: pim, npim: npim, slot: slot, hash: hash, nhash: nhash,
							enc: enc, fs: fs, vtype: vtype, size: size, autom: autom,
							force: force, quick: quick, fname: fname, fsckauto: fsckauto,
							bak: bak, hpw: hpw, fav: fav, favname: favname
						});
						if (showVolume)
							o.volume = vol.getValue();
						if (showMount)
							o.mountpoint = mp.getValue();
						if (showKeyfiles)
							o.keyfiles = kf.getValue();
						if (showSlot)
							o.slot = val(slot);
						if (showQuick)
							o.quick = flag(quick);
						if (showForce)
							o.force = flag(force);
						if (o.action === 'create' || o.action === 'create-keyfile') {
							var fn = val(fname) || initial.filename || (o.action === 'create-keyfile' ? 'keyfile' : 'media.hc');
							var dir = String((showVolume ? vol.getValue() : '') || '').replace(/\/+$/, '');
							if (!dir) {
								ui.addNotification(null, El('p', _('Choose a folder on a disk mounted under /mnt first.')), 'warning');
								return;
							}
							o.volume = dir + '/' + fn.replace(/^\/+/, '');
							if (o.action === 'create-keyfile') {
								o.random_source = val(rnd) || '/dev/urandom';
							}
						}
						if (o.action === 'create') {
							o.size = val(size) || '100M';
							o.encryption = val(enc) || 'AES-Twofish-Serpent';
							o.hash = val(hash) || 'sha-512';
							o.volume_type = val(vtype) || 'normal';
							o.filesystem = val(fs) || 'none';
							o.pim = val(pim);
							o.password = val(pw);
							o.random_source = val(rnd) || '/dev/urandom';
							o.slot = '';
							o.mount_options = '';
						}
						if (o.action === 'mount') {
							o.password = val(pw);
							o.pim = val(pim) || '0';
							o.protect_hidden = 'no';
							o.mount_options = 'nokernelcrypto';
							o.save_favorite = flag(fav);
							o.favorite_name = val(favname) || suggestFavName(o.volume);
						}
						if (o.action === 'fsck') {
							o.password = val(pw);
							o.pim = val(pim) || '0';
							o.filesystem = val(fs);
							o.fsck_auto = flag(fsckauto) ? '1' : '0';
							o.protect_hidden = 'no';
							o.mount_options = 'nokernelcrypto';
						}
						if (o.action === 'backup-headers' || o.action === 'restore-headers') {
							o.password = val(pw);
							o.pim = val(pim);
							o.backup_file = bak.getValue();
							o.protection_password = val(hpw);
							o.random_source = '/dev/urandom';
						}
						ui.hideModal();
						return ensureFsPackages(o).then(function(go) {
							if (!go)
								return;
							return ensureFsckPackages(o).then(function(go2) {
								if (!go2)
									return;
								// Saving a favorite applies UCI changes: reload only after that.
								if (o.save_favorite)
									o.noReload = true;
								return runAction(o).then(function(res) {
									var next = Promise.resolve(res);
									if (o.save_favorite && res && res.ok !== false && !res.aborted) {
										next = saveFavorite(o.favorite_name, {
											volume: o.volume,
											mountpoint: o.mountpoint,
											slot: o.slot,
											keyfiles: o.keyfiles
										}).then(function() {
											return res;
										}, function(err) {
											/* Keep the error visible: no reload. */
											ui.addNotification(null, El('p', err.message || String(err)), 'error');
											return { ok: false, keepOpen: true };
										});
									}
									return next.then(function(r) {
										if (r && r.keepOpen)
											return;
										if (r && r.ok !== false && (o.action === 'mount' || o.action === 'create'))
											window.location.reload();
									});
								});
							});
						});
					})
				}, _('Run'))
			]));
			modal(title, [
				El('form', {
					'submit': function(ev) {
						if (ev && ev.preventDefault)
							ev.preventDefault();
						return false;
					}
				}, nodes)
			]);
		}

		function mountExtras(f) {
			var nodes = [
				El('p', _('Cipher and hash come from the volume header. A password or keyfiles are required; PIM and keyfiles only if the volume was created with them. Always mounts with nokernelcrypto.')),
				El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Password')), El('div', { 'class': 'cbi-value-field' }, [
					El('p', { 'class': 'cbi-map-descr' }, _('Enter password')),
					f.pw
				]) ]),
				El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), El('div', { 'class': 'cbi-value-field' }, f.pim) ])
			];
			var volPath = f.vol ? f.vol.getValue() : '';
			if (!volPath || !favVol[volPath]) {
				nodes.push(El('div', { 'class': 'cbi-value' }, [
					El('label', { 'class': 'cbi-value-title' }, _('Add as favorite')),
					El('div', { 'class': 'cbi-value-field' }, [
						El('label', {}, [ f.fav, ' ', _('After a successful mount, save this volume in Favorites (passwords are not stored).') ]),
						El('p', { 'class': 'cbi-map-descr' }, _('Favorite name (letters, digits, underscore)')),
						f.favname
					])
				]));
			}
			return nodes;
		}

		function openFsck(initial) {
			actionModal(_('Check filesystem'), function(f) {
				return [
					El('p', _('Decrypts without mounting (veracrypt --filesystem=none), lists the mapper or loop device (veracrypt -l), runs the matching fsck tool on that device and keeps it mapped until you close the dialog. Unmount the volume first if it is mounted. Default is automatic repair; uncheck to only check, without changing anything.')),
					El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Password')), El('div', { 'class': 'cbi-value-field' }, [
						El('p', { 'class': 'cbi-map-descr' }, _('Enter password')),
						f.pw
					]) ]),
					El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), El('div', { 'class': 'cbi-value-field' }, f.pim) ]),
					El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Inner filesystem (optional hint)')), El('div', { 'class': 'cbi-value-field' }, f.fs) ]),
					El('div', { 'class': 'cbi-value' }, [
						El('label', { 'class': 'cbi-value-title' }, _('Automatic yes')),
						El('div', { 'class': 'cbi-value-field' }, [
							El('label', {}, [ f.fsckauto, ' ', _('Repair automatically (default). Uncheck to only check (read-only).') ])
						])
					])
				];
			}, function() { return { action: 'fsck' }; }, {
				volume: (initial && initial.volume) || '',
				slot: (initial && initial.slot) || '',
				showKeyfiles: true,
				showSlot: !!(initial && initial.slot)
			});
		}

		function openFilePicker(slotNo) {
			var row = pathRow(_('Container file'), '', false);
			modal(_('Mount container'), [
				El('p', _('Browse, create or delete, then select the container. Create and delete stay in this dialog.')),
				row.node,
				El('div', { 'class': 'right' }, [
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close the file picker without mounting.'),
						'click': ui.hideModal
					}, _('Cancel')),
					' ',
					El('button', {
						'type': 'button',
						'class': 'btn cbi-button-apply',
						'title': _('Use the selected container file and open the mount dialog for slot %s.').format(String(slotNo)),
						'click': function() {
							var p = row.getValue();
							ui.hideModal();
							if (!p)
								return;
							actionModal(_('Mount'), mountExtras, function() {
								return { action: 'mount' };
							}, { volume: p, slot: String(slotNo), showMount: true, showKeyfiles: true, showSlot: true });
						}
					}, _('Use file'))
				])
			]);
		}

		function openDevicePicker(slotNo) {
			function usePath(p) {
				ui.hideModal();
				actionModal(_('Mount'), mountExtras, function() {
					return { action: 'mount' };
				}, { volume: p, slot: String(slotNo), showMount: true, showKeyfiles: true, showSlot: true });
			}
			modal(_('Mount device'), [ El('p', _('Loading block devices…')) ]);
			return callListDev().then(function(res) {
				var devs = (res && res.devices) || [];
				var rows = [ El('p', _('Unused disks and partitions (/dev/sd*, hd*, vd*, xvd*, nvme*, mmcblk*). Router flash, loop and mapper devices are not offered.')) ];
				if (!devs.length)
					rows.push(El('p', _('No unused disk or partition found. Attach a USB disk and try again.')));
				devs.forEach(function(d) {
					rows.push(El('div', {}, [
						El('button', {
							'type': 'button',
							'class': 'btn',
							'style': 'margin:2px',
							'title': _('Mount %s as a VeraCrypt volume in slot %s.').format(d.path, String(slotNo)),
							'click': function() { usePath(d.path); }
						}, d.path)
					]));
				});
				rows.push(El('div', { 'class': 'right' }, [
					El('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close the device picker without mounting.'),
						'click': ui.hideModal
					}, _('Cancel'))
				]));
				modal(_('Mount device'), rows);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, El('p', err.message || String(err)), 'error');
			});
		}

		body.appendChild(El('h3', _('Operations')));
		body.appendChild(El('p', {}, [
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Check the inner filesystem: decrypt with --filesystem=none and run fsck on the mapper or loop device; it stays mapped until you close the dialog. Unmount first if the volume is mounted.'),
				'click': function() {
					openFsck({ slot: nextSlot > 0 ? String(nextSlot) : '' });
				}
			}, _('Check filesystem…')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Create a new volume (folder + file name, size, password, mount directory). Creating a mount directory does not close this dialog. After create the volume is mounted there.'),
				'click': function() {
					actionModal(_('Create volume'), function(f) {
						return [
							El('p', _('Folder + file name become the container path. Set or create the mount directory; creating a directory does not close this dialog. After create, the volume is mounted there. Defaults: AES-Twofish-Serpent, SHA-512, 100M, quick format.')),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Password')), El('div', { 'class': 'cbi-value-field' }, [
								El('p', { 'class': 'cbi-map-descr' }, _('Enter password')),
								f.pw
							]) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), El('div', { 'class': 'cbi-value-field' }, f.pim) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Size (--size)')), El('div', { 'class': 'cbi-value-field' }, f.size) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Volume type')), El('div', { 'class': 'cbi-value-field' }, f.vtype) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Encryption')), El('div', { 'class': 'cbi-value-field' }, f.enc) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Hash')), El('div', { 'class': 'cbi-value-field' }, f.hash) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Inner filesystem')), El('div', { 'class': 'cbi-value-field' }, f.fs) ])
						];
					}, function() { return { action: 'create' }; }, {
						encryption: 'AES-Twofish-Serpent',
						hash: 'sha-512',
						volume_type: 'normal',
						filesystem: 'ext4',
						dirOnly: true,
						showMount: true,
						showFilename: true,
						showQuick: true,
						showForce: true,
						size: '100M'
					});
				}
			}, _('Create…')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Change the volume password and/or keyfiles (veracrypt --change). Current password is sent on stdin.'),
				'click': function() {
					actionModal(_('Change password / keyfiles'), function(f) {
						return [
							El('p', _('veracrypt --change. Current and new password are both fed on stdin; neither --password nor --new-password appears on the command line.')),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Current password')), El('div', { 'class': 'cbi-value-field' }, f.pw) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('New password')), El('div', { 'class': 'cbi-value-field' }, f.npw) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('PIM / new PIM')), El('div', { 'class': 'cbi-value-field' }, [ f.pim, f.npim ]) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Hash / new hash')), El('div', { 'class': 'cbi-value-field' }, [ f.hash, f.nhash ]) ]),
							f.nkf.node
						];
					}, function(f) {
						return {
							action: 'change',
							password: val(f.pw),
							new_password: val(f.npw),
							pim: val(f.pim),
							new_pim: val(f.npim),
							hash: val(f.hash),
							new_hash: val(f.nhash),
							new_keyfiles: f.nkf.getValue()
						};
					}, { showKeyfiles: true });
				}
			}, _('Change…')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Write a backup of the volume headers (veracrypt --backup-headers).'),
				'click': function() {
					actionModal(_('Backup headers'), function(f) {
						return [
							El('p', _('Writes an external header backup to the file below (not inside the volume). Enter the outer-volume password. If there is a hidden volume, also enter its password. VeraCrypt CLI has no --backup-file flag; this dialog feeds the path and passwords on stdin. A hidden volume that needs its own PIM or keyfiles is not supported here.')),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Outer volume password')), El('div', { 'class': 'cbi-value-field' }, f.pw) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), El('div', { 'class': 'cbi-value-field' }, f.pim) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Hidden volume password (empty = none)')), El('div', { 'class': 'cbi-value-field' }, f.hpw) ]),
							f.bak.node
						];
					}, function(f) {
						return { action: 'backup-headers' };
					}, { showKeyfiles: true, showForce: true });
				}
			}, _('Backup headers…')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Restore volume headers from a backup (veracrypt --restore-headers).'),
				'click': function() {
					actionModal(_('Restore headers'), function(f) {
						return [
							El('p', _('Restores headers from an external backup file into the volume. Volume / file is the container to repair. Header backup file is the .header.bak (or similar) created by Backup headers.')),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Password for the backup')), El('div', { 'class': 'cbi-value-field' }, f.pw) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), El('div', { 'class': 'cbi-value-field' }, f.pim) ]),
							f.bak.node
						];
					}, function(f) {
						return { action: 'restore-headers' };
					}, { showKeyfiles: true });
				}
			}, _('Restore headers…')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Create a new random keyfile as a named file. VeraCrypt never modifies keyfile contents.'),
				'click': function() {
					actionModal(_('Create keyfile'), function(f) {
						return [
							El('p', _('Choose the directory, then type the file name to create. veracrypt --create-keyfile writes that file. A directory cannot be the keyfile path.')),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Random source')), El('div', { 'class': 'cbi-value-field' }, f.rnd) ])
						];
					}, function(f) {
						return { action: 'create-keyfile', random_source: val(f.rnd) || '/dev/urandom' };
					}, {
						dirOnly: true,
						showFilename: true,
						filenamePlaceholder: 'keyfile'
					});
				}
			}, _('Create keyfile…')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Mount all favorites and/or try the password on every unused disk and partition.'),
				'click': function() {
					actionModal(_('Auto-mount'), function(f) {
						return [
							El('p', _('Favorites are mounted on their configured mountpoints; devices are mounted on /mnt/veracryptN. Mountpoints always stay under /mnt. Always nokernelcrypto.')),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('What to mount')), El('div', { 'class': 'cbi-value-field' }, f.autom) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('Password')), El('div', { 'class': 'cbi-value-field' }, [
								El('p', { 'class': 'cbi-map-descr' }, _('Enter password')),
								f.pw
							]) ]),
							El('div', { 'class': 'cbi-value' }, [ El('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), El('div', { 'class': 'cbi-value-field' }, f.pim) ])
						];
					}, function(f) {
						return {
							action: 'auto-mount',
							auto_mount: val(f.autom) || 'favorites',
							password: val(f.pw),
							pim: val(f.pim),
							mount_options: 'nokernelcrypto'
						};
					}, { hideVolume: true, showKeyfiles: true });
				}
			}, _('Auto-mount…')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('List keyfiles on the PKCS #11 token. Set Settings → Security token library first.'),
				'click': function() {
					var lib = uci.get('veracrypt', 'main', 'token_lib') || '';
					if (!lib) {
						ui.addNotification(null, El('p',
							_('No PKCS #11 library path is set. Use Settings → Security token library (example: /usr/lib/libykcs11.so).')
						), 'warning');
						return;
					}
					return runAction({ action: 'list-token-keyfiles', token_lib: lib });
				}
			}, _('List token keyfiles')),
			' ',
			El('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Run VeraCrypt algorithm self-tests (veracrypt --test). Uses the Settings timeout (minimum 300 seconds).'),
				'click': function() {
					return runAction({ action: 'test' });
				}
			}, _('Test algorithms'))
		]));

		body.appendChild(El('hr'));
		m = new form.Map('veracrypt');

		s = m.section(form.NamedSection, 'main', 'settings', _('Settings'));
		s.addremove = false;
		s.anonymous = false;
		s.description = _('Timeouts for mount, create, fsck and algorithm tests. PKCS #11 is optional. Save & Apply after changes.');
		o = s.option(form.Value, 'timeout', _('Operation timeout (seconds)'));
		o.datatype = 'and(uinteger,min(300))';
		o.placeholder = '300';
		o.default = '300';
		o.description = _('Minimum 300 seconds. Raise this for slow devices, large volumes, or full (non-quick) format. Each long operation shows its own elapsed time and remaining timeout.');

		o = s.option(form.FileUpload, 'token_lib', _('Security token library (PKCS #11)'));
		o.root_directory = '/usr/lib';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = false;
		o.optional = true;
		o.description = _('Optional. Path to a PKCS #11 .so (for example /usr/lib/libykcs11.so). Leave empty if you do not use a token.');

		var mFav = new form.Map('veracrypt');
		s = mFav.section(form.GridSection, 'volume', _('Favorites'),
			_('Add a mounted volume from its slot row (Add as favorite), or tick Add as favorite in the mount dialog. Delete from list removes the saved name only — it does not unmount or delete the container. Passwords are not stored. Slot is 1–64.'));
		s.anonymous = false;
		s.addremove = false;
		s.nodescriptions = true;
		s.modaltitle = function(sid) {
			return _('Favorite “%s”: choose volume and mount point').format(sid);
		};

		o = s.option(form.DummyValue, '_state', _('State'));
		o.modalonly = false;
		o.textvalue = function(sid) {
			var stv = status[sectionName(sid)];
			return stv && stv.mounted ? _('Mounted') : _('Unmounted');
		};

		o = s.option(form.FileUpload, 'volume', _('Volume file'));
		o.root_directory = '/mnt';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = false;
		o.enable_download = false;
		o.directory_create = false;
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.FileUpload, 'mountpoint', _('Mount point'));
		o.root_directory = '/mnt';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = false;
		o.directory_create = false;
		o.directory_select = true;
		o.rmempty = false;
		o.editable = true;
		o.validate = function(section_id, value) {
			if (value && !isMntChild(value))
				return _('The mount point must be a directory directly under /mnt (e.g. /mnt/data).');
			return true;
		};

		o = s.option(form.ListValue, 'slot', _('Slot'));
		o.value('', _('(auto)'));
		for (var i = 1; i <= 64; i++)
			o.value(String(i), String(i));
		o.modalonly = true;

		o = s.option(form.Value, 'pim', _('PIM'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.modalonly = true;

		o = s.option(form.FileUpload, 'keyfiles', _('Keyfiles'));
		o.root_directory = '/mnt';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = false;
		o.directory_create = false;
		o.directory_select = true;
		o.modalonly = true;

		o = s.option(form.DummyValue, '_actions', _('Actions'));
		o.modalonly = false;
		o.rawhtml = true;
		o.textvalue = function(sid) {
			var name = sectionName(sid);
			var stv = status[name];
			var mounted = stv && stv.mounted;
			var wrap = El('span', { 'style': 'white-space:nowrap' });
			if (mounted) {
				wrap.appendChild(El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Show properties of this mounted volume (veracrypt --volume-properties).'),
					'click': ui.createHandlerFn(null, function() {
						return runAction({
							action: 'volume-properties',
							volume: uci.get('veracrypt', sid, 'volume') || '',
							slot: uci.get('veracrypt', sid, 'slot') || ''
						});
					})
				}, _('Properties')));
				wrap.appendChild(El('span', {}, ' '));
				wrap.appendChild(El('button', {
					'type': 'button',
					'class': 'btn cbi-button-remove',
					'title': _('Unmount favorite %s from its mount point.').format(name),
					'click': ui.createHandlerFn(null, function() {
						return runAction({
							action: 'unmount',
							name: name,
							volume: uci.get('veracrypt', sid, 'volume') || '',
							mountpoint: uci.get('veracrypt', sid, 'mountpoint') || '',
							slot: uci.get('veracrypt', sid, 'slot') || ''
						});
					})
				}, _('Unmount')));
				wrap.appendChild(El('span', {}, ' '));
			}
			else {
				wrap.appendChild(El('button', {
					'type': 'button',
					'class': 'btn cbi-button-apply',
					'title': _('Mount favorite %s. Password is sent on stdin, not --password.').format(name),
					'click': ui.createHandlerFn(null, function() {
						var pw = field('password', { 'placeholder': _('Enter password') });
						modal(_('Mount %s').format(name), [
							El('p', uci.get('veracrypt', sid, 'volume') || ''),
							El('label', {}, _('Enter password')),
							pw,
							El('div', { 'class': 'right' }, [
								El('button', {
									'type': 'button',
									'class': 'btn',
									'title': _('Close without mounting.'),
									'click': ui.hideModal
								}, _('Cancel')),
								' ',
								El('button', {
									'type': 'button',
									'class': 'btn cbi-button-apply',
									'title': _('Mount this favorite. Password is sent on stdin.'),
									'click': ui.createHandlerFn(null, function() {
										ui.hideModal();
										return runAction({
											action: 'mount',
											name: name,
											password: val(pw),
											keyfiles: uci.get('veracrypt', sid, 'keyfiles') || ''
										});
									})
								}, _('Mount'))
							])
						]);
					})
				}, _('Mount')));
				wrap.appendChild(El('span', {}, ' '));
				wrap.appendChild(El('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Check the inner filesystem of this favorite: decrypt with --filesystem=none and run fsck; it stays mapped until you close the dialog.'),
					'click': ui.createHandlerFn(null, function() {
						openFsck({
							volume: uci.get('veracrypt', sid, 'volume') || '',
							slot: uci.get('veracrypt', sid, 'slot') || '',
							keyfiles: uci.get('veracrypt', sid, 'keyfiles') || ''
						});
					})
				}, _('Check')));
				wrap.appendChild(El('span', {}, ' '));
			}
			wrap.appendChild(El('button', {
				'type': 'button',
				'class': 'btn cbi-button-remove',
				'title': _('Remove “%s” from the favorite list. Does not unmount or delete the container file.').format(name),
				'click': ui.createHandlerFn(null, function() {
					if (!window.confirm(_('Remove “%s” from favorites? The volume file is not deleted and a mounted volume stays mounted.').format(name)))
						return;
					uci.remove('veracrypt', sid);
					return uci.save().then(function() { return uci.apply(); }).then(function() {
						window.location.reload();
					});
				})
			}, _('Delete from list')));
			return wrap;
		};

		return m.render().then(function(node) {
			body.appendChild(node);
			body.appendChild(El('hr'));
			return mFav.render();
		}).then(function(node) {
			body.appendChild(node);
			return body;
		});
	}
});
