'use strict';
/* SPDX-License-Identifier: GPL-2.0-only */
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
'require poll';

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
	params: [ 'path', 'recursive' ]
});

var RUN_PARAMS = [
	'action', 'name', 'volume', 'mountpoint', 'password', 'new_password',
	'pim', 'new_pim', 'hash', 'new_hash', 'encryption', 'filesystem',
	'fs_options', 'keyfiles', 'new_keyfiles', 'protect_hidden',
	'protection_password', 'protection_pim', 'protection_hash',
	'protection_keyfiles', 'slot', 'size', 'volume_type', 'random_source',
	'token_lib', 'token_pin', 'mount_options', 'auto_mount', 'force',
	'quick', 'verbose', 'no_size_check', 'legacy_password_maxlength',
	'allow_insecure_mount', 'fsck_auto'
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

function callJobWithTimeout() {
	return rpc.declare({
		object: 'luci.veracrypt',
		method: 'job',
		timeout: Math.min(30000, timeoutSec() * 1000)
	});
}

var callTools = rpc.declare({
	object: 'luci.veracrypt',
	method: 'tools'
});

var callJobLog = rpc.declare({
	object: 'luci.veracrypt',
	method: 'job_log'
});

var callJobAbort = rpc.declare({
	object: 'luci.veracrypt',
	method: 'job_abort'
});

var callJobAnswer = rpc.declare({
	object: 'luci.veracrypt',
	method: 'job_answer',
	params: [ 'answer' ]
});

function packagesForFs(fs) {
	switch (fs) {
		case 'ext4':
		case 'ext3':
		case 'ext2':
			return [ 'lvm2', 'e2fsprogs', 'kmod-fs-ext4' ];
		case 'vfat':
			return [ 'lvm2', 'dosfstools', 'kmod-fs-vfat' ];
		case 'ntfs':
			return [ 'lvm2', 'ntfs-3g', 'kmod-fs-ntfs3' ];
		case 'exfat':
			return [ 'lvm2', 'exfatprogs', 'kmod-fs-exfat' ];
		default:
			return [];
	}
}

function packagesForFsck(fs) {
	switch (fs) {
		case 'ext4':
		case 'ext3':
		case 'ext2':
			return [ 'e2fsprogs' ];
		case 'vfat':
			return [ 'dosfstools' ];
		case 'ntfs':
			return [ 'ntfs-3g' ];
		case 'exfat':
			return [ 'exfatprogs' ];
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
	if (fs === 'vfat')
		return !!t.has_fsck_fat;
	if (fs === 'ntfs')
		return !!t.has_ntfsfix;
	if (fs === 'exfat')
		return !!t.has_fsck_exfat;
	return !!t.has_fsck;
}

function toolsReady(t, fs) {
	if (!fs || fs === 'none')
		return true;
	if (!t || !t.has_dmsetup)
		return false;
	if ((fs === 'ext4' || fs === 'ext3' || fs === 'ext2') && !t.has_mkfs_ext4)
		return false;
	if (fs === 'vfat' && !t.has_mkfs_vfat)
		return false;
	if (fs === 'ntfs' && !t.has_mkfs_ntfs)
		return false;
	if (fs === 'exfat' && !t.has_mkfs_exfat)
		return false;
	return true;
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
	return E('button', {
		'type': 'button',
		'class': 'btn cbi-button-remove',
		'title': _('Abort / cancel. Stop the job on the router (veracrypt, fsck, or apk) and close this dialog.'),
		'click': function() {
			ctl.stopped = true;
			callJobAbort().then(function(res) {
				ui.hideModal();
				showResult({ ok: false, error: (res && res.output) || _('Aborted.') });
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, E('p', err.message || _('Aborted.')), 'warning');
			});
		}
	}, _('Abort'));
}

function installPackages(list) {
	var limit = timeoutSec();
	var statusEl = E('p');
	var elapsed = 0;
	var left = limit;
	var ctl = { stopped: false };
	function paint() {
		statusEl.textContent = _('apk add %s — elapsed %s, timeout in %s').format(list.join(' '), fmtClock(elapsed), fmtClock(left));
	}
	ui.showModal(_('Install packages'), [
		statusEl,
		E('div', { 'class': 'right' }, [ abortButton(ctl) ])
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
		if (ctl.stopped)
			return { ok: false, aborted: true };
		if (res && res.pending)
			return waitJob(left, statusEl, null, ctl);
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
		if (ctl.stopped)
			return false;
		ui.hideModal();
		ui.addNotification(null, E('p', err.message || String(err)), 'error');
		return false;
	});
}

function ensureFsPackages(o) {
	if (o.action !== 'create')
		return Promise.resolve(true);
	var fs = o.filesystem || 'none';
	var pkgs = packagesForFs(fs);
	if (!pkgs.length)
		return Promise.resolve(true);
	return callTools().then(function(t) {
		if (toolsReady(t, fs))
			return true;
		return new Promise(function(resolve) {
			ui.showModal(_('Missing tools for %s').format(fs), [
				E('p', _('Creating a volume with an inner %s filesystem needs: %s (dmsetup from lvm2, mkfs, and the kmod). Install with apk add, or create with filesystem=none and format after mount.').format(fs, pkgs.join(' '))),
				E('div', { 'class': 'right' }, [
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close this dialog. The volume is not created.'),
						'click': function() { ui.hideModal(); resolve(false); }
					}, _('Cancel')),
					' ',
					E('button', {
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
					E('button', {
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
			ui.showModal(_('Missing fsck tools'), [
				E('p', _('Checking a volume cannot be done without the matching fsck tool. The app decrypts with --filesystem=none, runs fsck on the mapper or loop device, then dismounts. Install: %s (e2fsprogs for ext*, dosfstools for FAT, exfatprogs for exFAT, ntfs-3g for NTFS).').format(pkgs.join(' '))),
				E('div', { 'class': 'right' }, [
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close this dialog. fsck is not run.'),
						'click': function() { ui.hideModal(); resolve(false); }
					}, _('Cancel')),
					' ',
					E('button', {
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
	if (err.indexOf('PKCS') !== -1 || err.indexOf('Security Tokens') !== -1)
		err = _('No PKCS #11 library loaded. Set the library path under Timeouts → Security token library (for example /usr/lib/libykcs11.so). This app has no Settings > Security Tokens.');
	if (res && res.need_packages) {
		var pkgs = String(res.need_packages).split(/[\s,]+/).filter(Boolean);
		ui.showModal(_('Missing fsck tools'), [
			E('pre', err || _('Checking a volume cannot be done without the matching fsck tool.')),
			E('p', _('apk add %s').format(pkgs.join(' '))),
			E('div', { 'class': 'right' }, [
				E('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Close this dialog. fsck is not run.'),
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
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
		ui.addNotification(null, E('pre', err || _('Command failed')), 'error');
	else if (res.output)
		ui.addNotification(null, E('pre', res.output), 'info');
	else
		ui.addNotification(null, E('p', _('OK')), 'info');
}

function field(type, attrs) {
	attrs = attrs || {};
	attrs.type = type || 'text';
	attrs.style = (attrs.style || '') + ';width:100%';
	return E('input', attrs);
}

function select(values, cur) {
	var s = E('select', { 'style': 'width:100%' });
	values.forEach(function(v) {
		var val = Array.isArray(v) ? v[0] : v;
		var lab = Array.isArray(v) ? v[1] : v;
		var opt = E('option', { 'value': val }, lab);
		if (String(cur) === String(val))
			opt.selected = true;
		s.appendChild(opt);
	});
	return s;
}

function pathRow(label, value, dirsOnly) {
	var inp = field('text', {
		'value': value || '',
		'placeholder': dirsOnly ? '/mnt/Buffalo' : '/mnt/sda2/media.tc'
	});
	var listing = E('div', { 'style': 'max-height:180px;overflow:auto;margin-top:6px' });
	var status = E('p', { 'class': 'cbi-map-descr' });
	var newName = E('input', {
		'type': 'text',
		'placeholder': dirsOnly ? 'Buffalo' : 'newdir',
		'style': 'width:60%'
	});
	var browse = value || '/mnt';
	if (!dirsOnly && browse.lastIndexOf('/') > 0)
		browse = browse.replace(/\/[^\/]+$/, '') || '/mnt';

	function setStatus(t) {
		status.textContent = t || '';
	}

	function load(path) {
		if (!path)
			path = '/mnt';
		setStatus(_('Listing %s …').format(path));
		return callListDir(path).then(function(res) {
			while (listing.firstChild)
				listing.removeChild(listing.firstChild);
			if (!res || res.ok === false) {
				setStatus(res && res.error ? res.error : _('Cannot list directory'));
				var parent = String(path || '').replace(/\/+$/, '').replace(/\/[^\/]+$/, '') || '/mnt';
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
				var row = E('div', { 'style': 'white-space:nowrap;margin:1px 0' });
				if (!dirsOnly || isDir) {
					row.appendChild(E('button', {
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
								if (dirsOnly && !isDot)
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
					row.appendChild(E('span', { 'style': 'margin:1px' }, ent.name));
				}
				if (!isDot) {
					row.appendChild(E('button', {
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
		setStatus(_('Creating %s …').format(p));
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
		setStatus(_('Deleting %s …').format(p));
		return callRm(p, '').then(function(res) {
			if (res && res.need_recursive) {
				if (!window.confirm(_('Directory %s is not empty. Delete it and all contents? This cannot be undone.').format(p))) {
					setStatus(_('Delete cancelled.'));
					return;
				}
				return callRm(p, '1');
			}
			return res;
		}).then(function(res) {
			if (!res)
				return;
			if (!res.ok && res.ok !== 1) {
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
		node: E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, label),
			E('div', { 'class': 'cbi-value-field' }, [
				E('p', { 'class': 'cbi-map-descr' },
					dirsOnly
						? _('Type the directory, browse below, or create/delete. Create and delete stay in this dialog.')
						: _('Type the container path, or browse and click the file. You can create or delete directories and files here.')
				),
				inp,
				status,
				listing,
				E('div', {}, [
					newName,
					' ',
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Create the named directory under the current folder. The dialog stays open.'),
						'click': makeDir
					}, _('Create directory')),
					' ',
					E('button', {
						'type': 'button',
						'class': 'btn cbi-button-remove',
						'title': _('Delete the path in the text field after confirmation. The dialog stays open.'),
						'click': function(ev) {
							var p = (inp.value || '').trim();
							removePath(p, p.charAt(p.length - 1) === '/' || dirsOnly);
						}
					}, _('Delete selected'))
				])
			])
		]),
		getValue: function() {
			return (inp.value || '').trim() || value || '';
		}
	};
}

function val(el) {
	return el && el.value != null ? String(el.value) : '';
}

function flag(el) {
	return el && el.checked ? '1' : '';
}

function waitJob(limit, statusEl, logEl, ctl) {
	var left = limit;
	var elapsed = 0;
	var job = callJobWithTimeout();
	ctl = ctl || {};

	function paint() {
		statusEl.textContent = _('Working… elapsed %s. Operation will time out in %s. Header derivation and random generation can take several minutes on a slow CPU with little RAM.').format(fmtClock(elapsed), fmtClock(left));
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
				error: _('Timed out after %s. veracrypt may still be running on the router. Use Abort next time, or raise Timeouts.')
					.format(fmtClock(limit))
			};
		}
		return job().then(function(res) {
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

function runAction(opts) {
	var limit = timeoutSec();
	var statusEl = E('p');
	var elapsed = 0;
	var left = limit;
	var ctl = { stopped: false };
	function paint() {
		statusEl.textContent = _('Working… elapsed %s. Operation will time out in %s. Header derivation and random generation can take several minutes on a slow CPU with little RAM.').format(fmtClock(elapsed), fmtClock(left));
	}
	var logEl = E('pre', {
		'style': 'max-height:280px;overflow:auto;white-space:pre-wrap;user-select:text;background:var(--background-color-high, #111);padding:8px'
	});
	var showLive = E('input', { 'type': 'checkbox' });
	showLive.checked = true;
	showLive.addEventListener('change', function() {
		logEl.style.display = showLive.checked ? '' : 'none';
	});
	var ynBox = E('p');
	if (opts.action === 'fsck' && opts.fsck_auto !== '1') {
		ynBox.appendChild(E('p', { 'class': 'cbi-map-descr' },
			_('fsck is interactive. Press y or n for each prompt.')));
		ynBox.appendChild(E('button', {
			'type': 'button',
			'class': 'btn cbi-button-apply',
			'title': _('Answer yes to the current fsck prompt.'),
			'click': function() { callJobAnswer('y'); }
		}, _('y')));
		ynBox.appendChild(E('span', {}, ' '));
		ynBox.appendChild(E('button', {
			'type': 'button',
			'class': 'btn',
			'title': _('Answer no to the current fsck prompt.'),
			'click': function() { callJobAnswer('n'); }
		}, _('n')));
	}
	var closeBtn = E('button', {
		'type': 'button',
		'class': 'btn',
		'style': 'display:none',
		'title': _('Close this dialog. The job has finished.'),
		'click': function() { ui.hideModal(); }
	}, _('Close'));
	var copyBtn = E('button', {
		'type': 'button',
		'class': 'btn',
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
	var saveBtn = E('button', {
		'type': 'button',
		'class': 'btn',
		'title': _('Save the log as a text file on this computer.'),
		'click': function() {
			callJobLog().then(function(res) {
				var t = (res && res.output) || logEl.textContent || '';
				saveTextFile(logStamp(opts.action), t);
			}).catch(function() {
				saveTextFile(logStamp(opts.action), logEl.textContent || '');
			});
		}
	}, _('Save log'));
	ui.showModal(_('VeraCrypt'), [
		statusEl,
		E('p', {}, [
			E('label', {}, [ showLive, ' ', _('Show live output') ])
		]),
		ynBox,
		logEl,
		E('p', { 'class': 'cbi-map-descr' },
			_('XHR timeout is %d seconds (minimum 300). Change it under Timeouts, then Save & Apply.').format(limit)),
		E('div', { 'class': 'right' }, [
			copyBtn, ' ', saveBtn, ' ', abortEl, ' ', closeBtn
		])
	]);
	paint();
	var iv = window.setInterval(function() {
		elapsed++;
		left--;
		paint();
	}, 1000);
	var run = callRunWithTimeout();
	return run(
		opts.action || '', opts.name || '', opts.volume || '', opts.mountpoint || '',
		opts.password || '', opts.new_password || '', opts.pim || '', opts.new_pim || '',
		opts.hash || '', opts.new_hash || '', opts.encryption || '', opts.filesystem || '',
		opts.fs_options || '', opts.keyfiles || '', opts.new_keyfiles || '',
		opts.protect_hidden || '', opts.protection_password || '', opts.protection_pim || '',
		opts.protection_hash || '', opts.protection_keyfiles || '', opts.slot || '',
		opts.size || '', opts.volume_type || '', opts.random_source || '',
		opts.token_lib || '', opts.token_pin || '', opts.mount_options || '',
		opts.auto_mount || '', opts.force || '', opts.quick || '', opts.verbose || '',
		opts.no_size_check || '', opts.legacy_password_maxlength || '',
		opts.allow_insecure_mount || '', opts.fsck_auto || ''
	).then(function(res) {
		if (ctl.stopped)
			return { ok: false, aborted: true };
		if (res && res.pending)
			return waitJob(left, statusEl, logEl, ctl);
		return res;
	}).then(function(res) {
		window.clearInterval(iv);
		if (ctl.stopped)
			return res;
		if (res && (res.output || res.error))
			setLogText(logEl, res.output || res.error);
		if (res && res.ok === false)
			statusEl.textContent = res.error || _('Failed.');
		else
			statusEl.textContent = (res && res.summary) || _('Finished. Copy or save the log, then Close.');
		closeBtn.style.display = '';
		abortEl.style.display = 'none';
		return res;
	}).catch(function(err) {
		window.clearInterval(iv);
		if (ctl.stopped)
			return;
		setLogText(logEl, err.message || String(err));
		statusEl.textContent = err.message || String(err);
		closeBtn.style.display = '';
		abortEl.style.display = 'none';
	});
}

var HASHES = [ '', 'sha-512', 'sha-256', 'ripemd160', 'whirlpool', 'streebog' ];
var CIPHERS = [ '', 'AES', 'Serpent', 'Twofish', 'Camellia', 'Kuznyechik',
	'AES-Twofish', 'AES-Twofish-Serpent', 'Serpent-AES', 'Serpent-Twofish-AES',
	'Twofish-Serpent' ];
var FSTYPES = [ '', 'ext4', 'ext3', 'ext2', 'vfat', 'ntfs', 'exfat', 'none' ];
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

return view.extend({
	load: function() {
		return uci.load('veracrypt').then(function() {
			if (!uci.get('veracrypt', 'main')) {
				uci.add('veracrypt', 'settings', 'main');
				uci.set('veracrypt', 'main', 'timeout', '300');
			}
			return callStatus();
		}).then(function(st) {
			return [ true, st ];
		});
	},

	render: function(data) {
		var st = data[1] || {};
		var status = {};
		(st.volumes || []).forEach(function(v) {
			status[v.name] = v;
		});
		var slots = st.slots || [];
		var m, s, o;

		var body = E('div');

		body.appendChild(E('h3', _('Slots')));
		body.appendChild(E('p', { 'class': 'cbi-map-descr' },
			_('Used slots plus one empty slot. Open file picks a container; open device lists /dev/sd*, nvme, mmc, mapper.')));
		if (st.version)
			body.appendChild(E('p', {}, st.version));

		var table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Slot')),
				E('th', { 'class': 'th' }, _('Volume')),
				E('th', { 'class': 'th' }, _('Actions'))
			])
		]);
		(slots || []).forEach(function(sl) {
			if (!sl.used)
				return;
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, String(sl.slot)),
				E('td', { 'class': 'td' }, sl.line || ''),
				E('td', { 'class': 'td' }, [
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Show properties of the volume in slot %s (veracrypt --volume-properties).').format(String(sl.slot)),
						'click': ui.createHandlerFn(this, function() {
							return runAction({ action: 'volume-properties', slot: String(sl.slot) });
						})
					}, _('Properties')),
					' ',
					E('button', {
						'type': 'button',
						'class': 'btn cbi-button-remove',
						'title': _('Unmount slot %s (veracrypt --unmount --slot=%s).').format(String(sl.slot), String(sl.slot)),
						'click': ui.createHandlerFn(this, function() {
							return runAction({ action: 'unmount', slot: String(sl.slot) }).then(function(res) {
								if (res && res.ok !== false)
									window.location.reload();
							});
						})
					}, _('Unmount')),
					' ',
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Check the inner filesystem of this volume: decrypt with --filesystem=none, fsck the mapper or loop device, then dismount. Unmount first if it is mounted.'),
						'click': ui.createHandlerFn(this, function() {
							var parts = String(sl.line || '').trim().split(/\s+/);
							openFsck({ volume: parts[1] || '', slot: String(sl.slot) });
						})
					}, _('Check'))
				])
			]));
		});

		var nextSlot = st.next_slot || 1;
		if (nextSlot > 0) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, String(nextSlot)),
				E('td', { 'class': 'td' }, _('(empty)')),
				E('td', { 'class': 'td' }, [
					E('button', {
						'type': 'button',
						'class': 'btn cbi-button-apply',
						'title': _('Browse for a container file and mount it in slot %s.').format(String(nextSlot)),
						'click': ui.createHandlerFn(this, function() {
							openFilePicker(nextSlot);
						})
					}, _('Open file')),
					' ',
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Pick a block device (/dev/sd*, nvme, mmc, mapper) and mount it in slot %s.').format(String(nextSlot)),
						'click': ui.createHandlerFn(this, function() {
							openDevicePicker(nextSlot);
						})
					}, _('Open device'))
				])
			]));
		}
		body.appendChild(table);
		if (st.list)
			body.appendChild(E('pre', st.list));

		body.appendChild(E('p', {}, [
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('List mounted VeraCrypt volumes (veracrypt --list).'),
				'click': ui.createHandlerFn(this, function() {
					return runAction({ action: 'list' });
				})
			}, _('List volumes')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Unmount every VeraCrypt volume (veracrypt --unmount).'),
				'click': ui.createHandlerFn(this, function() {
					return runAction({ action: 'unmount' }).then(function(res) {
						if (res && res.ok !== false)
							window.location.reload();
					});
				})
			}, _('Unmount all')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Show the VeraCrypt version string (veracrypt --version).'),
				'click': ui.createHandlerFn(this, function() {
					return runAction({ action: 'version' });
				})
			}, _('Version')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Run VeraCrypt algorithm self-tests (veracrypt --test).'),
				'click': ui.createHandlerFn(this, function() {
					return runAction({ action: 'test' });
				})
			}, _('Test algorithms')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Show console help (veracrypt --help).'),
				'click': ui.createHandlerFn(this, function() {
					return runAction({ action: 'help' });
				})
			}, _('Help'))
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
			var fname = field('text', { 'placeholder': 'media.hc', 'value': initial.filename || '' });
			var kf = pathRow(_('Keyfiles'), '', false);
			var nkf = pathRow(_('New keyfiles'), '', false);
			var rnd = field('text', { 'value': '/dev/urandom', 'placeholder': '/dev/urandom' });
			var pw = field('password');
			var npw = field('password');
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
			quick.checked = !!showQuick;
			fsckauto.checked = true;
			if (initial.size)
				size.value = initial.size;

			var nodes = [
				E('p', _('Passwords are sent on stdin and are not saved.'))
			];
			if (showVolume)
				nodes.push(vol.node);
			if (showFilename)
				nodes.push(E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Container file name')),
					E('div', { 'class': 'cbi-value-field' }, fname)
				]));
			if (showMount)
				nodes.push(mp.node);
			if (showKeyfiles)
				nodes.push(kf.node);
			nodes = nodes.concat(extraNodes({
				vol: vol, mp: mp, kf: kf, nkf: nkf, rnd: rnd, pw: pw, npw: npw,
				pim: pim, npim: npim, slot: slot, hash: hash, nhash: nhash,
				enc: enc, fs: fs, vtype: vtype, size: size, autom: autom,
				force: force, quick: quick, fname: fname, fsckauto: fsckauto
			}));
			if (showSlot)
				nodes.push(E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Slot (1–64)')),
					E('div', { 'class': 'cbi-value-field' }, slot)
				]));
			if (showQuick || showForce)
				nodes.push(E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Options')),
					E('div', { 'class': 'cbi-value-field' }, [
						showQuick ? E('label', {}, [ quick, ' ', _('quick format') ]) : '',
						showQuick && showForce ? ' ' : '',
						showForce ? E('label', {}, [ force, ' ', _('overwrite if the file exists') ]) : ''
					])
				]));
			nodes.push(E('div', { 'class': 'right' }, [
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close this dialog without running VeraCrypt.'),
						'click': ui.hideModal
					}, _('Cancel')),
					' ',
					E('button', {
						'type': 'button',
						'class': 'btn cbi-button-apply',
						'title': _('Run the VeraCrypt command. The password is sent on stdin, not --password on the command line.'),
						'click': ui.createHandlerFn(this, function() {
							var o = collect({
								vol: vol, mp: mp, kf: kf, nkf: nkf, rnd: rnd, pw: pw, npw: npw,
								pim: pim, npim: npim, slot: slot, hash: hash, nhash: nhash,
								enc: enc, fs: fs, vtype: vtype, size: size, autom: autom,
								force: force, quick: quick, fname: fname, fsckauto: fsckauto
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
							if (o.action === 'create') {
								var fn = val(fname) || initial.filename || 'media.hc';
								o.volume = String((showVolume ? vol.getValue() : '') || '/mnt').replace(/\/+$/, '') + '/' + fn.replace(/^\/+/, '');
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
							}
							if (o.action === 'fsck') {
								o.password = val(pw);
								o.pim = val(pim) || '0';
								o.filesystem = val(fs);
								o.fsck_auto = flag(fsckauto) ? '1' : '0';
								o.protect_hidden = 'no';
								o.mount_options = 'nokernelcrypto';
							}
							ui.hideModal();
							return ensureFsPackages(o).then(function(go) {
								if (!go)
									return;
								return ensureFsckPackages(o).then(function(go2) {
									if (!go2)
										return;
									return runAction(o).then(function(res) {
										if (res && res.ok !== false && (o.action === 'mount' || o.action === 'unmount' || o.action === 'create' || o.action === 'fsck'))
											window.location.reload();
									});
								});
							});
						})
					}, _('Run'))
			]));
			ui.showModal(title, [
				E('form', {
					'submit': function(ev) {
						if (ev && ev.preventDefault)
							ev.preventDefault();
						return false;
					}
				}, nodes)
			]);
		}

		function mountExtras(f) {
			return [
				E('p', _('Cipher and hash come from the volume header. Password is required. PIM and keyfiles only if the volume was created with them. Always mounts with nokernelcrypto.')),
				E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Password')), E('div', { 'class': 'cbi-value-field' }, f.pw) ]),
				E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), E('div', { 'class': 'cbi-value-field' }, f.pim) ])
			];
		}

		function openFsck(initial) {
			actionModal(_('Check filesystem'), function(f) {
				return [
					E('p', _('Decrypts without mounting (veracrypt --filesystem=none), lists the mapper or loop device (veracrypt -l), runs fsck -f on that device, then dismounts. Unmount the volume first if it is mounted. Default is automatic yes to all prompts; uncheck for interactive y/n.')),
					E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Password')), E('div', { 'class': 'cbi-value-field' }, f.pw) ]),
					E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('PIM (empty = default)')), E('div', { 'class': 'cbi-value-field' }, f.pim) ]),
					E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Inner filesystem (optional hint)')), E('div', { 'class': 'cbi-value-field' }, f.fs) ]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Automatic yes')),
						E('div', { 'class': 'cbi-value-field' }, [
							E('label', {}, [ f.fsckauto, ' ', _('Yes to all fsck prompts (default). Uncheck to answer y or n.') ])
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
			ui.showModal(_('Open file'), [
				E('p', _('Browse, create or delete, then select the container. Create and delete stay in this dialog.')),
				row.node,
				E('div', { 'class': 'right' }, [
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close the file picker without mounting.'),
						'click': ui.hideModal
					}, _('Cancel')),
					' ',
					E('button', {
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
			ui.showModal(_('Open device'), [ E('p', _('Loading block devices…')) ]);
			return callListDev().then(function(res) {
				var devs = (res && res.devices) || [];
				var rows = [ E('p', _('Block devices (/dev/sd*, nvme, mmc, mapper, and other /sys/class/block nodes)')) ];
				if (!devs.length)
					rows.push(E('p', _('No nodes under /sys/class/block. You can still browse /dev.')));
				devs.forEach(function(d) {
					rows.push(E('div', {}, [
						E('button', {
							'type': 'button',
							'class': 'btn',
							'style': 'margin:2px',
							'title': _('Mount %s as a VeraCrypt volume in slot %s.').format(d.path, String(slotNo)),
							'click': function() { usePath(d.path); }
						}, d.path)
					]));
				});
				var fu = new ui.FileUpload('/dev', {
					root_directory: '/dev',
					initial_directory: '/dev',
					show_hidden: true,
					enable_upload: false,
					enable_remove: false,
					enable_download: false,
					directory_create: false,
					directory_select: false
				});
				rows.push(E('p', _('Or browse /dev:')));
				var holder = E('div');
				rows.push(holder);
				Promise.resolve(fu.render()).then(function(el) { holder.appendChild(el); });
				rows.push(E('div', { 'class': 'right' }, [
					E('button', {
						'type': 'button',
						'class': 'btn',
						'title': _('Close the device picker without mounting.'),
						'click': ui.hideModal
					}, _('Cancel')),
					' ',
					E('button', {
						'type': 'button',
						'class': 'btn cbi-button-apply',
						'title': _('Use the selected /dev node and open the mount dialog for slot %s.').format(String(slotNo)),
						'click': function() {
							var p = fu.getValue();
							if (p)
								usePath(p);
						}
					}, _('Use selected /dev node'))
				]));
				ui.showModal(_('Open device'), rows);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, E('p', err.message || String(err)), 'error');
			});
		}

		body.appendChild(E('h3', _('Operations')));
		body.appendChild(E('p', {}, [
			E('button', {
				'type': 'button',
				'class': 'btn cbi-button-apply',
				'title': _('Mount a container file or device to a directory. Cipher and hash come from the volume header. Password is sent on stdin.'),
				'click': function() {
				actionModal(_('Mount'), mountExtras, function() { return { action: 'mount' }; }, {
					slot: String(nextSlot || 1), showMount: true, showKeyfiles: true, showSlot: true
				});
			} }, _('Mount…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Check the inner filesystem: decrypt with --filesystem=none, run fsck on the mapper or loop device, then dismount. Unmount first if the volume is mounted.'),
				'click': function() {
				openFsck({ slot: String(nextSlot || 1) });
			} }, _('Check filesystem…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Create a new volume (folder + file name, size, password, mount directory). Creating a mount directory does not close this dialog. After create the volume is mounted there.'),
				'click': function() {
				actionModal(_('Create volume'), function(f) {
					return [
						E('p', _('Folder + file name become the container path. Set or create the mount directory; creating a directory does not close this dialog. After create, the volume is mounted there. Defaults: AES-Twofish-Serpent, SHA-512, 100M, quick format.')),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Password')), E('div', { 'class': 'cbi-value-field' }, f.pw) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('PIM (empty = VeraCrypt default)')), E('div', { 'class': 'cbi-value-field' }, f.pim) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Size (--size)')), E('div', { 'class': 'cbi-value-field' }, f.size) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Volume type')), E('div', { 'class': 'cbi-value-field' }, f.vtype) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Encryption')), E('div', { 'class': 'cbi-value-field' }, f.enc) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Hash')), E('div', { 'class': 'cbi-value-field' }, f.hash) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Inner filesystem')), E('div', { 'class': 'cbi-value-field' }, f.fs) ])
					];
				}, function() { return { action: 'create' }; }, {
					encryption: 'AES-Twofish-Serpent',
					hash: 'sha-512',
					volume_type: 'normal',
					filesystem: 'none',
					dirOnly: true,
					showMount: true,
					showFilename: true,
					showQuick: true,
					showForce: true,
					volume: '/mnt',
					mountpoint: '/mnt/Buffalo',
					filename: 'media.hc',
					size: '100M'
				});
			} }, _('Create…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Change the volume password and/or keyfiles (veracrypt --change). Current password is sent on stdin.'),
				'click': function() {
				actionModal(_('Change password / keyfiles'), function(f) {
					return [
						E('p', _('veracrypt --change. Current password on stdin. New password is required by VeraCrypt as --new-password.')),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Current password')), E('div', { 'class': 'cbi-value-field' }, f.pw) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('New password')), E('div', { 'class': 'cbi-value-field' }, f.npw) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('PIM / new PIM')), E('div', { 'class': 'cbi-value-field' }, [ f.pim, f.npim ]) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Hash / new hash')), E('div', { 'class': 'cbi-value-field' }, [ f.hash, f.nhash ]) ]),
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
			} }, _('Change…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Write a backup of the volume headers (veracrypt --backup-headers).'),
				'click': function() {
				actionModal(_('Backup headers'), function(f) {
					return [
						E('p', _('veracrypt --backup-headers. Password, PIM and keyfiles must match the volume.')),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Password')), E('div', { 'class': 'cbi-value-field' }, f.pw) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('PIM (empty = default)')), E('div', { 'class': 'cbi-value-field' }, f.pim) ])
					];
				}, function(f) {
					return { action: 'backup-headers', password: val(f.pw), pim: val(f.pim) };
				}, { showKeyfiles: true });
			} }, _('Backup headers…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Restore volume headers from a backup (veracrypt --restore-headers).'),
				'click': function() {
				actionModal(_('Restore headers'), function(f) {
					return [
						E('p', _('veracrypt --restore-headers. Password, PIM and keyfiles must match the volume.')),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Password')), E('div', { 'class': 'cbi-value-field' }, f.pw) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('PIM (empty = default)')), E('div', { 'class': 'cbi-value-field' }, f.pim) ])
					];
				}, function(f) {
					return { action: 'restore-headers', password: val(f.pw), pim: val(f.pim) };
				}, { showKeyfiles: true });
			} }, _('Restore headers…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Create a random keyfile. Path is the Volume / file field.'),
				'click': function() {
				actionModal(_('Create keyfile'), function(f) {
					return [
						E('p', _('Path is the Volume / file field. veracrypt --create-keyfile. No password.')),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Random source')), E('div', { 'class': 'cbi-value-field' }, f.rnd) ])
					];
				}, function(f) {
					return { action: 'create-keyfile', random_source: val(f.rnd) || '/dev/urandom' };
				});
			} }, _('Create keyfile…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Show properties of a volume or slot (veracrypt --volume-properties).'),
				'click': function() {
				actionModal(_('Volume properties'), function() {
					return [ E('p', _('veracrypt --volume-properties for a mounted volume path or slot. No password.')) ];
				}, function() { return { action: 'volume-properties' }; }, { showSlot: true });
			} }, _('Properties…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('Mount favorite or device-hosted volumes (veracrypt --auto-mount).'),
				'click': function() {
				actionModal(_('Auto-mount'), function(f) {
					return [
						E('p', _('veracrypt --auto-mount=favorites|devices|devices_favorites. Always nokernelcrypto.')),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('What to mount')), E('div', { 'class': 'cbi-value-field' }, f.autom) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Password')), E('div', { 'class': 'cbi-value-field' }, f.pw) ]),
						E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('PIM (empty = default)')), E('div', { 'class': 'cbi-value-field' }, f.pim) ])
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
			} }, _('Auto-mount…')),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'title': _('List keyfiles on the PKCS #11 token. Set Timeouts → Security token library first.'),
				'click': function() {
				var lib = uci.get('veracrypt', 'main', 'token_lib') || '';
				if (!lib) {
					ui.addNotification(null, E('p',
						_('No PKCS #11 library path is set. Use Timeouts → Security token library (example: /usr/lib/libykcs11.so). This LuCI app has no Settings > Security Tokens.')
					), 'warning');
					return;
				}
				return runAction({ action: 'list-token-keyfiles', token_lib: lib });
			} }, _('List token keyfiles'))
		]));

		m = new form.Map('veracrypt', _('Favorite volumes'),
			_('Saved volume paths. Use Browse to pick a container or mount directory. Slot is 1–64. Passwords are not stored.'));

		s = m.section(form.NamedSection, 'main', 'settings', _('Timeouts'));
		s.addremove = false;
		s.anonymous = false;
		o = s.option(form.Value, 'timeout', _('XHR / operation timeout (seconds)'));
		o.datatype = 'and(uinteger,min(300))';
		o.placeholder = '300';
		o.default = '300';
		o.description = _('Minimum 300 (5 minutes). Header derivation and random generation on a slow chipset with little RAM can take much longer. Save & Apply before the next mount or create.');

		o = s.option(form.FileUpload, 'token_lib', _('Security token library (PKCS #11)'));
		o.root_directory = '/';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = false;
		o.optional = true;
		o.description = _('Optional. Path to a PKCS #11 .so (for example /usr/lib/libykcs11.so). Leave empty if you do not use a token.');

		s = m.section(form.GridSection, 'volume', _('Favorites'));
		s.anonymous = false;
		s.addremove = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add favorite');

		o = s.option(form.DummyValue, '_state', _('State'));
		o.modalonly = false;
		o.textvalue = function(sid) {
			var stv = status[sectionName(sid)];
			return stv && stv.mounted ? _('Mounted') : _('Dismounted');
		};

		o = s.option(form.FileUpload, 'volume', _('Volume file'));
		o.root_directory = '/';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = true;
		o.enable_download = false;
		o.directory_create = true;
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.FileUpload, 'mountpoint', _('Mount point'));
		o.root_directory = '/';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = true;
		o.directory_create = true;
		o.directory_select = true;
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.ListValue, 'slot', _('Slot'));
		o.value('', _('(auto)'));
		for (var i = 1; i <= 64; i++)
			o.value(String(i), String(i));
		o.modalonly = true;

		o = s.option(form.Flag, 'nokernelcrypto', _('No kernel crypto'));
		o.default = '1';
		o.modalonly = true;
		o.description = _('Always recommended on this router (veracrypt -m=nokernelcrypto).');

		o = s.option(form.Value, 'pim', _('PIM'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.modalonly = true;

		o = s.option(form.ListValue, 'protect_hidden', _('Protect hidden volume'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.default = 'no';
		o.modalonly = true;

		o = s.option(form.FileUpload, 'keyfiles', _('Keyfiles'));
		o.root_directory = '/';
		o.show_hidden = true;
		o.enable_upload = false;
		o.enable_remove = true;
		o.directory_create = true;
		o.modalonly = true;

		o = s.option(form.Flag, 'truecrypt', _('TrueCrypt mode'));
		o.modalonly = true;
		o.description = _('Only if the container is a TrueCrypt volume. A .tc file name does not mean TrueCrypt.');

		o = s.option(form.DummyValue, '_actions', _('Actions'));
		o.modalonly = false;
		o.rawhtml = true;
		o.textvalue = function(sid) {
			var name = sectionName(sid);
			var stv = status[name];
			var mounted = stv && stv.mounted;
			var wrap = E('span', { 'style': 'white-space:nowrap' });
			if (mounted) {
				wrap.appendChild(E('button', {
					'type': 'button',
					'class': 'btn cbi-button-remove',
					'title': _('Unmount favorite %s from its mount point.').format(name),
					'click': ui.createHandlerFn(this, function() {
						return runAction({ action: 'unmount', name: name }).then(function(res) {
							if (res && res.ok !== false)
								window.location.reload();
						});
					})
				}, _('Unmount')));
			}
			else {
				wrap.appendChild(E('button', {
					'type': 'button',
					'class': 'btn cbi-button-apply',
					'title': _('Mount favorite %s. Password is sent on stdin, not --password.').format(name),
					'click': ui.createHandlerFn(this, function() {
						var pw = field('password');
						ui.showModal(_('Mount %s').format(name), [
							E('p', uci.get('veracrypt', sid, 'volume') || ''),
							pw,
							E('div', { 'class': 'right' }, [
								E('button', {
									'type': 'button',
									'class': 'btn',
									'title': _('Close without mounting.'),
									'click': ui.hideModal
								}, _('Cancel')),
								' ',
								E('button', {
									'type': 'button',
									'class': 'btn cbi-button-apply',
									'title': _('Mount this favorite. Password is sent on stdin.'),
									'click': ui.createHandlerFn(this, function() {
										ui.hideModal();
										return runAction({ action: 'mount', name: name, password: val(pw) }).then(function(res) {
											if (res && res.ok !== false)
												window.location.reload();
										});
									})
								}, _('Mount'))
							])
						]);
					})
				}, _('Mount')));
				wrap.appendChild(E('span', {}, ' '));
				wrap.appendChild(E('button', {
					'type': 'button',
					'class': 'btn',
					'title': _('Check the inner filesystem of this favorite: decrypt with --filesystem=none, fsck, then dismount.'),
					'click': ui.createHandlerFn(this, function() {
						openFsck({
							volume: uci.get('veracrypt', sid, 'volume') || '',
							slot: uci.get('veracrypt', sid, 'slot') || ''
						});
					})
				}, _('Check')));
			}
			return wrap;
		};

		return m.render().then(function(node) {
			body.appendChild(node);
			return body;
		});
	}
});
