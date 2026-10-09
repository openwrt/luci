'use strict';
/* SPDX-License-Identifier: GPL-2.0-only */
'require view';
'require dom';
'require form';
'require poll';
'require rpc';
'require uci';
'require ui';

const callStatus = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'status',
	expect: { '': {} }
});

const callDevices = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'devices',
	expect: { devices: [] }
});

const callJob = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'job',
	expect: { '': {} }
});

const callMount = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'mount',
	params: [ 'volume', 'mountpoint', 'password', 'pim', 'keyfiles', 'slot', 'readonly', 'nokernelcrypto' ]
});

const callUnmount = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'unmount',
	params: [ 'slot', 'force' ]
});

const callCreate = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'create',
	params: [ 'volume', 'size', 'device', 'password', 'pim', 'keyfiles', 'encryption', 'hash', 'filesystem', 'quick' ]
});

const callCreateKeyfile = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'create_keyfile',
	params: [ 'path' ]
});

const callAbort = rpc.declare({
	object: 'luci.veracrypt-lite',
	method: 'abort'
});

const ENCRYPTION = [
	'AES', 'Serpent', 'Twofish', 'Camellia', 'Kuznyechik',
	'AES-Twofish', 'AES-Twofish-Serpent', 'Camellia-Kuznyechik',
	'Camellia-Serpent', 'Kuznyechik-AES', 'Kuznyechik-Serpent-Camellia',
	'Kuznyechik-Twofish', 'Serpent-AES', 'Serpent-Twofish-AES',
	'Twofish-Serpent'
];

/* As in the backend: the packaged VeraCrypt 1.26 has no Argon2id (BLAKE2b). */
const HASH = [ 'SHA-512', 'SHA-256', 'BLAKE2s-256', 'Whirlpool', 'Streebog' ];

/* Inner filesystems: [ label, formatter, package with the formatter ] */
const FILESYSTEMS = {
	fat: [ 'FAT', null, null ],
	exfat: [ 'exFAT', 'mkfs.exfat', 'exfat-mkfs' ],
	ext4: [ 'ext4', 'mkfs.ext4', 'e2fsprogs' ],
	none: [ _('None (format it later)'), null, null ]
};

const MOUNT_NAME = /^[A-Za-z0-9._-]{1,64}$/;

/* The backend answers { error: "..." } when it refuses a request. */
function check(reply) {
	if (reply && reply.error)
		throw new Error(reply.error);

	return reply;
}

function notifyError(err) {
	ui.addNotification(null, E('p', {}, [ err.message || err ]), 'danger');
}

/* Empty is allowed here; the mount dialog then uses suggestMountpoint(). */
function validMountpoint(section_id, value) {
	const name = (value || '').replace(/^\/mnt\//, '');

	if (!value)
		return true;

	if (!/^\/mnt\//.test(value) || !MOUNT_NAME.test(name) || name == '.' || name == '..')
		return _('Expecting /mnt/NAME, where NAME has only letters, digits, ".", "_" and "-"');

	return true;
}

function validSize(section_id, value) {
	if (!/^[1-9][0-9]*[KMGT]?$/.test(value || ''))
		return _('Expecting a size such as 512M or 2G');

	return true;
}

function validFileName(section_id, value) {
	if (!value || /[/,\x00-\x1f\x7f]/.test(value) || value == '.' || value == '..')
		return _('Expecting a file name without "/" or ","');

	return true;
}

/* A mount directory from the volume name, e.g. /mnt/usb/data.hc -> /mnt/data */
function suggestMountpoint(volume) {
	const name = (volume || '').replace(/^.*\//, '').replace(/\.[^.]*$/, '')
		.replace(/[^A-Za-z0-9._-]/g, '_').substring(0, 64);

	return '/mnt/' + ((MOUNT_NAME.test(name) && name != '.' && name != '..') ? name : 'veracrypt');
}

function deviceLabel(dev) {
	return '%s – %s %1024.1mB'.format(dev.path, dev.name || _('disk'), dev.size);
}

/* An optional integer field: '' -> undefined (not sent), else a number. */
function optInt(value) {
	return (value != null && value !== '') ? +value : undefined;
}

/*
 * Favorites are "volume" sections shared with luci-app-veracrypt. Its keyfile
 * list is comma separated (",," is a literal comma) and mount_options is a
 * comma separated list; options this app does not know are kept as they are.
 * luci-app-veracrypt only accepts "nokernelcrypto" in mount_options, so
 * read-only is kept in a separate "readonly" option that it ignores.
 */
function splitKeyfiles(list) {
	return String(list || '').replace(/,,/g, '\u0001').split(',')
		.filter(k => k !== '').map(k => k.replace(/\u0001/g, ','));
}

function mountOptions(value) {
	return String(value || '').split(',').filter(o => o !== '');
}

/* A Flag for one entry of a favorite's mount_options. */
function mountOptionFlag(s, opt, title, description) {
	const o = s.option(form.Flag, '_' + opt, title, description);

	o.modalonly = true;
	o.load = sid => mountOptions(uci.get('veracrypt', sid, 'mount_options')).includes(opt) ? '1' : '0';
	o.write = (sid, value) => {
		const old = mountOptions(uci.get('veracrypt', sid, 'mount_options'));
		const list = old.filter(x => x != opt);

		if (value == '1')
			list.push(opt);

		if (list.join(',') == old.join(','))
			return;

		if (list.length)
			uci.set('veracrypt', sid, 'mount_options', list.join(','));
		else
			uci.unset('veracrypt', sid, 'mount_options');
	};
	o.remove = sid => o.write(sid, '0');

	return o;
}

/* A file chooser rooted at /mnt that can only pick existing entries. */
function browseOption(s, name, title, directories) {
	const o = s.option(form.FileUpload, name, title);

	o.root_directory = '/mnt';
	o.enable_upload = false;
	o.enable_remove = false;
	o.directory_select = !!directories;

	return o;
}

/*
 * Fields shared by the mount and create dialogs. A favorite with several
 * keyfiles (set in luci-app-veracrypt) shows them instead of the chooser.
 */
function keyOptions(s, keyfiles) {
	let o = s.option(form.Value, 'password', _('Password'));
	o.password = true;
	o.rmempty = true;
	/* The backend counts bytes, not characters. */
	o.validate = (section_id, value) =>
		(new TextEncoder().encode(value || '').length <= 128) || _('At most 128 bytes');

	o = s.option(form.Value, 'pim', _('PIM'),
		_('Leave empty for the default number of iterations.'));
	o.datatype = 'range(0,2147468)';

	if (keyfiles && keyfiles.length > 1) {
		o = s.option(form.DummyValue, '_keyfiles', _('Keyfiles'));
		o.cfgvalue = () => keyfiles.join(', ');
	}
	else {
		o = browseOption(s, 'keyfile', _('Keyfile'));
		o.optional = true;
	}
}

/*
 * Show a JSONMap as a modal dialog. The action gets the entered values (form
 * fields write them into data) and returns a promise; on an error the dialog
 * stays open and shows it.
 */
function showFormModal(title, data, setup, action_label, action) {
	const m = new form.JSONMap({ d: data });
	const s = m.section(form.NamedSection, 'd');
	const errorNode = E('div');

	setup(s);

	return m.render().then(node => {
		ui.showModal(title, [
			node,
			errorNode,
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(m, () => m.save(null, true)
						.then(() => action(data))
						.catch(err => dom.content(errorNode, E('p', { 'class': 'alert-message error' }, [
							err.message || err
						]))))
				}, [ action_label ])
			])
		]);
	});
}

return view.extend({
	load() {
		return Promise.all([
			callStatus(),
			callJob(),
			uci.load('veracrypt')
		]);
	},

	/* Mounted volumes */

	renderSlots(slots) {
		const rows = [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Slot') ]),
				E('th', { 'class': 'th' }, [ _('Volume') ]),
				E('th', { 'class': 'th' }, [ _('Mount directory') ]),
				E('th', { 'class': 'th' }, [ _('Size') ]),
				E('th', { 'class': 'th' }, [ _('Details') ]),
				E('th', { 'class': 'th cbi-section-actions' })
			])
		];

		for (let v of slots) {
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Slot') }, [ v.slot ]),
				E('td', { 'class': 'td', 'data-title': _('Volume') }, [ v.volume ]),
				E('td', { 'class': 'td', 'data-title': _('Mount directory') }, [ v.mountpoint || '–' ]),
				E('td', { 'class': 'td', 'data-title': _('Size') }, [ v.size ]),
				E('td', { 'class': 'td', 'data-title': _('Details') }, [
					v.type, v.readonly ? ', ' + _('read-only') : '', E('br'),
					E('small', {}, [ v.vdev ])
				]),
				E('td', { 'class': 'td cbi-section-actions' }, [
					E('button', {
						'class': 'btn cbi-button-remove',
						'click': ui.createHandlerFn(this, 'handleUnmount', v, false)
					}, [ _('Unmount') ])
				])
			]));
		}

		if (!slots.length)
			rows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td' }, [ E('em', {}, [ _('No volumes are mounted.') ]) ])
			]));

		return E('table', { 'class': 'table' }, rows);
	},

	refreshStatus() {
		return callStatus().then(status => {
			this.status = status;
			dom.content(this.slotsNode, this.renderSlots(status.slots || []));
		}).catch(notifyError);
	},

	handleUnmount(v, force) {
		return callUnmount(v.slot, force).then(check).then(res => {
			if (res.code == 0) {
				ui.hideModal();
				return this.refreshStatus();
			}

			ui.showModal(_('Unmount failed'), [
				E('pre', {}, [ res.output ]),
				E('p', {}, [
					force ? '' : _('A program may still use files on the volume. Forcing the unmount can lose data that is not yet written.')
				]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ]),
					' ',
					force ? '' : E('button', {
						'class': 'btn cbi-button-negative',
						'click': ui.createHandlerFn(this, 'handleUnmount', v, true)
					}, [ _('Force unmount') ])
				])
			]);
		}).catch(notifyError);
	},

	/* The background job (mount or create) */

	renderJob(job) {
		if (!job.op)
			return dom.content(this.jobNode, null);

		let state;

		if (job.running)
			state = _('Running for %t').format(job.elapsed || 0);
		else if (job.rc == 0)
			state = _('Finished after %t').format(job.elapsed || 0);
		else if (job.rc != null)
			state = _('Failed with exit code %d').format(job.rc);
		else
			state = _('Aborted');

		/* veracrypt redraws progress lines with a carriage return */
		const log = (job.log || '').replace(/[^\n]*\r(?!\n)/g, '');

		dom.content(this.jobNode, E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ _('Last operation') ]),
			E('p', {}, [ E('strong', {}, [ job.op ]), ': ', state ]),
			log ? E('pre', { 'style': 'max-height:20em;overflow:auto;white-space:pre-wrap' }, [ log ]) : '',
			job.running ? E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': ui.createHandlerFn(this, 'handleAbort')
				}, [ _('Abort') ])
			]) : ''
		]));
	},

	pollJob() {
		return callJob().then(job => {
			if (this.jobRunning && !job.running)
				this.refreshStatus();

			this.jobRunning = !!job.running;
			this.renderJob(job);
		});
	},

	handleAbort() {
		if (!confirm(_('Abort the running operation? A partly created volume is left as it is.')))
			return;

		return callAbort().then(check).then(() => this.pollJob()).catch(notifyError);
	},

	/* Called after mount or create started a job. */
	jobStarted(reply) {
		check(reply);
		ui.hideModal();
		this.jobRunning = true;

		return this.pollJob();
	},

	/* Mount dialog; values may come from a favorite. */

	handleMount(fav) {
		fav = fav || {};

		return callDevices().catch(() => []).then(devices => {
			const keyfiles = splitKeyfiles(fav.keyfiles);
			const opts = mountOptions(fav.mount_options);
			const data = {
				source: /^\/dev\//.test(fav.volume) ? fav.volume : '',
				volume: (fav.volume && !/^\/dev\//.test(fav.volume)) ? fav.volume : null,
				mountpoint: fav.mountpoint || '',
				pim: fav.pim || '',
				slot: fav.slot || '',
				keyfile: (keyfiles.length == 1) ? keyfiles[0] : null,
				readonly: (fav.readonly == '1' || opts.includes('ro')) ? '1' : '0',
				nokernelcrypto: opts.includes('nokernelcrypto') ? '1' : '0'
			};

			return showFormModal(_('Mount volume'), data, s => {
				let o = s.option(form.ListValue, 'source', _('Volume'));
				o.value('', _('Container file'));
				for (let dev of devices)
					o.value(dev.path, deviceLabel(dev));

				if (data.source && !devices.some(dev => dev.path == data.source))
					o.value(data.source, data.source);

				o = browseOption(s, 'volume', _('Container file'));
				o.depends('source', '');
				o.rmempty = false;

				o = s.option(form.Value, 'mountpoint', _('Mount directory'),
					_('Created if it does not exist; it must be empty. Default: /mnt/ and the name of the volume.'));
				o.validate = validMountpoint;

				keyOptions(s, keyfiles);

				o = s.option(form.Value, 'slot', _('Slot'),
					_('Leave empty for the first free slot.'));
				o.datatype = 'range(1,64)';

				o = s.option(form.Flag, 'readonly', _('Read-only'));

				o = s.option(form.Flag, 'nokernelcrypto', _('Do not use kernel cryptography'),
					_('Decrypt in VeraCrypt (FUSE) instead of dm-crypt. Without dmsetup this happens anyway.'));
			}, _('Mount'), d => {
				const volume = d.source || d.volume;

				if (!volume)
					throw new Error(_('Choose a volume.'));

				return callMount(volume, d.mountpoint || suggestMountpoint(volume),
					d.password || '', optInt(d.pim),
					(keyfiles.length > 1) ? keyfiles : (d.keyfile ? [ d.keyfile ] : []),
					optInt(d.slot), d.readonly == '1', d.nokernelcrypto == '1')
					.then(L.bind(this.jobStarted, this));
			});
		});
	},

	/* Create dialog: a container file, or a whole unused device. */

	handleCreate() {
		return callDevices().catch(() => []).then(devices => {
			const tools = (this.status && this.status.tools) || {};
			const data = {
				target: '', size: '1G', encryption: 'AES', hash: 'SHA-512',
				filesystem: 'fat', quick: '0'
			};

			return showFormModal(_('Create volume'), data, s => {
				let o = s.option(form.ListValue, 'target', _('Create on'));
				o.value('', _('A new container file'));
				for (let dev of devices)
					o.value(dev.path, _('Device %s (erases it)').format(deviceLabel(dev)));

				o = browseOption(s, 'directory', _('Directory'), true);
				o.depends('target', '');
				o.rmempty = false;

				o = s.option(form.Value, 'name', _('File name'));
				o.depends('target', '');
				o.placeholder = 'volume.hc';
				o.rmempty = false;
				o.validate = validFileName;

				o = s.option(form.Value, 'size', _('Size'),
					_('With a unit: K, M, G or T.'));
				o.depends('target', '');
				o.rmempty = false;
				o.validate = validSize;

				keyOptions(s);

				o = s.option(form.Value, 'password2', _('Confirm password'));
				o.password = true;
				o.validate = function(section_id, value) {
					const pw = this.section.formvalue(section_id, 'password');

					return (value == pw) ? true : _('The passwords do not match');
				};

				o = s.option(form.ListValue, 'encryption', _('Encryption'));
				ENCRYPTION.forEach(e => o.value(e));

				o = s.option(form.ListValue, 'hash', _('Hash'));
				HASH.forEach(h => o.value(h));

				o = s.option(form.ListValue, 'filesystem', _('Filesystem'));
				for (let fs in FILESYSTEMS)
					if (!FILESYSTEMS[fs][1] || tools[FILESYSTEMS[fs][1]])
						o.value(fs, FILESYSTEMS[fs][0]);

				o = s.option(form.Flag, 'quick', _('Quick format'),
					_('Skip filling the volume with random data. Much faster, but the disk then shows which parts of the volume hold data.'));
			}, _('Create'), d => {
				const device = !!d.target;
				const volume = device ? d.target : d.directory + '/' + d.name;

				if (!device && !d.directory)
					throw new Error(_('Choose a directory.'));

				if (!d.password && !d.keyfile)
					throw new Error(_('A password or a keyfile is required.'));

				if (device && !confirm(_('All data on %s will be lost. Continue?').format(volume)))
					return;

				return callCreate(volume, device ? undefined : d.size, device,
					d.password || '', optInt(d.pim), d.keyfile ? [ d.keyfile ] : [],
					d.encryption, d.hash, d.filesystem, d.quick == '1')
					.then(L.bind(this.jobStarted, this));
			});
		});
	},

	handleCreateKeyfile() {
		return showFormModal(_('Create keyfile'), {}, s => {
			let o = browseOption(s, 'directory', _('Directory'), true);
			o.rmempty = false;

			o = s.option(form.Value, 'name', _('File name'));
			o.placeholder = 'keyfile';
			o.rmempty = false;
			o.validate = validFileName;
		}, _('Create'), d => {
			if (!d.directory)
				throw new Error(_('Choose a directory.'));

			return callCreateKeyfile(d.directory + '/' + d.name).then(check).then(res => {
				if (res.code != 0)
					throw new Error(res.output || _('Creating the keyfile failed'));

				ui.hideModal();
				ui.addNotification(null, E('p', {}, [
					_('Keyfile %s created. Keep a copy elsewhere: without it the volume cannot be opened.').format(d.directory + '/' + d.name)
				]), 'info');
			});
		});
	},

	/* Hint for creating volumes with filesystems whose formatter is missing. */
	renderHint(tools) {
		const missing = [];

		for (let fs in FILESYSTEMS)
			if (FILESYSTEMS[fs][1] && !tools[FILESYSTEMS[fs][1]])
				missing.push('%s (%s)'.format(FILESYSTEMS[fs][2], FILESYSTEMS[fs][0]));

		if (!missing.length)
			return '';

		return E('p', { 'class': 'cbi-section-descr' }, [
			_('To create volumes with more filesystems, install: %s.').format(missing.join(', ')), ' ',
			_('Mounting needs the kernel module of the filesystem, e.g. kmod-fs-vfat, kmod-fs-exfat or kmod-fs-ext4.')
		]);
	},

	render([ status, job ]) {
		const self = this;

		this.status = status;
		this.jobRunning = !!job.running;
		this.slotsNode = E('div', {}, [ this.renderSlots(status.slots || []) ]);
		this.jobNode = E('div');
		this.renderJob(job);

		const m = new form.Map('veracrypt');
		const s = m.section(form.GridSection, 'volume', _('Favorites'),
			_('Saved volumes for quick mounting. Passwords are never stored.'));
		s.addremove = true;
		s.anonymous = false;
		s.nodescriptions = true;

		s.renderRowActions = function(section_id) {
			const td = this.super('renderRowActions', [ section_id, _('Edit') ]);

			td.lastChild.insertBefore(E('button', {
				'class': 'btn cbi-button-action',
				'click': ui.createHandlerFn(self, () => self.handleMount(uci.get('veracrypt', section_id)))
			}, [ _('Mount') ]), td.lastChild.firstChild);

			return td;
		};

		let o = browseOption(s, 'volume', _('Volume'));
		o.rmempty = false;

		o = s.option(form.Value, 'mountpoint', _('Mount directory'));
		o.rmempty = false;
		o.validate = validMountpoint;

		o = s.option(form.Value, 'pim', _('PIM'));
		o.datatype = 'range(0,2147468)';
		o.modalonly = true;

		o = s.option(form.Value, 'slot', _('Slot'));
		o.datatype = 'range(1,64)';
		o.modalonly = true;

		o = browseOption(s, 'keyfiles', _('Keyfile'));
		o.description = _('Several keyfiles can only be changed in the full VeraCrypt app.');
		o.modalonly = true;
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			this.readonly = (splitKeyfiles(cfgvalue).length > 1) || null;

			return form.FileUpload.prototype.renderWidget.apply(this, arguments);
		};
		o.validate = function(section_id, value) {
			return (this.readonly || !/,/.test(value || '')) || _('Expecting a path without ","');
		};

		o = s.option(form.Flag, 'readonly', _('Read-only'));
		o.modalonly = true;
		mountOptionFlag(s, 'nokernelcrypto', _('Do not use kernel cryptography'));

		poll.add(L.bind(this.pollJob, this), 3);

		return m.render().then(mapNode => E('div', {}, [
			E('h2', {}, [ _('VeraCrypt (lite)') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				status.version ? _('VeraCrypt %s.').format(status.version) + ' ' : '',
				_('Mount and create VeraCrypt volumes on disks mounted under /mnt. Other operations, such as changing a password, header backups or hidden volumes, are available with veracrypt --text on the command line.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Mounted volumes') ]),
				this.slotsNode,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn cbi-button-action',
						'click': ui.createHandlerFn(this, 'handleMount', null)
					}, [ _('Mount…') ]),
					' ',
					E('button', {
						'class': 'btn cbi-button-add',
						'click': ui.createHandlerFn(this, 'handleCreate')
					}, [ _('Create volume…') ]),
					' ',
					E('button', {
						'class': 'btn',
						'click': ui.createHandlerFn(this, 'handleCreateKeyfile')
					}, [ _('Create keyfile…') ])
				]),
				this.renderHint(status.tools || {})
			]),
			this.jobNode,
			mapNode
		]));
	}
});
