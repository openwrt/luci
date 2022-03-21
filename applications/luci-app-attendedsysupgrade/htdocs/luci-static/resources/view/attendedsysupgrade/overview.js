'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
'require poll';
'require request';
'require dom';
'require fs';

var callPackagelist = rpc.declare({
	object: 'rpc-sys',
	method: 'packagelist',
});

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board',
});

var callUpgradeStart = rpc.declare({
	object: 'rpc-sys',
	method: 'upgrade_start',
	params: ['keep'],
});

/**
 * Returns the branch of a given version. This helps to offer upgrades
 * for point releases (aka within the branch).
 * 
 * Logic:
 * SNAPSHOT -> SNAPSHOT
 * 21.02-SNAPSHOT -> 21.02
 * 21.02.0-rc1 -> 21.02
 * 19.07.8 -> 19.07
 * 
 * @param {string} version 
 * Input version from which to determine the branch
 * @returns {string}
 * The determined branch
 */
function get_branch(version) {
	return version.replace('-SNAPSHOT', '').split('.').slice(0, 2).join('.');
}

/**
 * The OpenWrt revision string contains both a hash as well as the number 
 * commits since the OpenWrt/LEDE reboot. It helps to determine if a 
 * snapshot is newer than another.
 * 
 * @param {string} revision
 * Revision string of a OpenWrt device
 * @returns {integer}
 * The number of commits since OpenWrt/LEDE reboot
 */
function get_revision_count(revision) {
	return parseInt(revision.substring(1).split('-')[0]);
}

return view.extend({
	steps: {
		init: _('10% Received build request'),
		download_imagebuilder: _('20% Downloading ImageBuilder archive'),
		unpack_imagebuilder: _('40% Setup ImageBuilder'),
		calculate_packages_hash: _('60% Validate package selection'),
		building_image: _('80% Generating firmware image')
	},

	data: {
		url: '',
		revision: '',
		advanced_mode: 0,
	},

	firmware: {
		profile: '',
		target: '',
		version: '',
		packages: [],
		diff_packages: true,
		filesystem: '',
	},

	handle200: function (response) {
		res = response.json();
		var image;
		for (image of res.images) {
			if (this.firmware.filesystem == image.filesystem) {
				if (this.data.efi) {
					if (image.type == 'combined-efi') {
						break;
					}
				} else {
					if (image.type == 'sysupgrade' || image.type == 'combined') {
						break;
					}
				}
			}
		}

		if (image.name != undefined) {
			var sysupgrade_url = `${this.data.url}/store/${res.bin_dir}/${image.name}`;

			var keep = E('input', { type: 'checkbox' });
			keep.checked = true;

			var fields = [
				_('Version'), `${res.version_number} ${res.version_code}`,
				_('SHA256'), image.sha256,
			];

			if (this.data.advanced_mode == 1) {
				fields.push(
					_('Profile'), res.id,
					_('Target'), res.target,
					_('Build Date'), res.build_at,
					_('Filename'), image.name,
					_('Filesystem'), image.filesystem,
				)
			}

			fields.push('', E('a', { href: sysupgrade_url }, _('Download firmware image')))

			var table = E('div', { class: 'table' });

			for (var i = 0; i < fields.length; i += 2) {
				table.appendChild(E('tr', { class: 'tr' }, [
					E('td', { class: 'td left', width: '33%' }, [fields[i]]),
					E('td', { class: 'td left' }, [fields[i + 1]]),
				]));
			}

			var modal_body = [
				table,
				E('p', { class: 'mt-2' },
					E('label', { class: 'btn' }, [
						keep, ' ',
						_('Keep settings and retain the current configuration')
					])),
				E('div', { class: 'right' }, [
					E('div', { class: 'btn', click: ui.hideModal }, _('Cancel')), ' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive important',
						'click': ui.createHandlerFn(this, function () {
							this.handleInstall(sysupgrade_url, keep.checked, image.sha256)
						})
					}, _('Install firmware image')),
				]),
			];

			ui.showModal(_('Successfully created firmware image'), modal_body);
		}
	},

	handle202: function (response) {
		response = response.json();
		this.data.request_hash = res.request_hash;

		if ('queue_position' in response) {
			ui.showModal(_('Queued...'), [
				E('p', { 'class': 'spinning' }, _('Request in build queue position %s').format(response.queue_position))
			]);
		} else {
			ui.showModal(_('Building Firmware...'), [
				E('p', { 'class': 'spinning' }, _('Progress: %s').format(this.steps[response.imagebuilder_status]))
			]);
		}
	},

	handleError: function (response) {
		response = response.json();
		var body = [
			E('p', {}, _('Server response: %s').format(response.detail)),
			E('a', { href: 'https://github.com/openwrt/asu/issues' }, _('Please report the error message and request')),
			E('p', {}, _('Request Data:')),
			E('pre', {}, JSON.stringify({ ...this.data, ...this.firmware }, null, 4)),
		];

		if (response.stdout) {
			body.push(E('b', {}, 'STDOUT:'));
			body.push(E('pre', {}, response.stdout));
		}

		if (response.stderr) {
			body.push(E('b', {}, 'STDERR:'));
			body.push(E('pre', {}, response.stderr));
		}

		body = body.concat([
			E('div', { class: 'right' }, [
				E('div', { class: 'btn', click: ui.hideModal }, _('Close')),
			]),
		]);

		ui.showModal(_('Error building the firmware image'), body);
	},

	handleRequest: function () {
		var request_url = `${this.data.url}/api/v1/build`;
		var method = "POST"
		var content = this.firmware;

		/**
		 * If `request_hash` is available use a GET request instead of 
		 * sending the entire object.
		 */
		if (this.data.request_hash) {
			request_url += `/${this.data.request_hash}`;
			content = {};
			method = "GET"
		}

		request.request(request_url, { method: method, content: content })
			.then((response) => {
				switch (response.status) {
					case 202:
						this.handle202(response);
						break;
					case 200:
						poll.stop();
						this.handle200(response);
						break;
					case 400: // bad request
					case 422: // bad package
					case 500: // build failed
						poll.stop();
						this.handleError(response);
						break;
				}
			});
	},

	handleInstall: function (url, keep, sha256) {
		ui.showModal(_('Downloading...'), [
			E('p', { 'class': 'spinning' }, _('Downloading firmware from server to browser'))
		]);

		request.get(url, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			responseType: 'blob',
		})
			.then((response) => {
				var form_data = new FormData();
				form_data.append('sessionid', rpc.getSessionID());
				form_data.append('filename', '/tmp/firmware.bin');
				form_data.append('filemode', 600);
				form_data.append('filedata', response.blob());

				ui.showModal(_('Uploading...'), [
					E('p', { 'class': 'spinning' }, _('Uploading firmware from browser to device'))
				]);

				request
					.get(`${L.env.cgi_base}/cgi-upload`, {
						method: 'PUT',
						content: form_data,
					})
					.then((response) => response.json())
					.then((response) => {
						if (response.sha256sum != sha256) {

							ui.showModal(_('Wrong checksum'), [
								E('p', _('Error during download of firmware. Please try again')),
								E('div', { class: 'btn', click: ui.hideModal }, _('Close'))
							]);
						} else {
							ui.showModal(_('Installing...'), [
								E('p', { class: 'spinning' }, _('Installing the sysupgrade. Do not unpower device!'))
							]);

							L.resolveDefault(callUpgradeStart(keep), {})
								.then((response) => {
									if (keep) {
										ui.awaitReconnect(window.location.host);
									} else {
										ui.awaitReconnect('192.168.1.1', 'openwrt.lan');
									}
								});
						}
					});
			});
	},

	handleCheck: function () {
		var { url, revision } = this.data
		var { version, target } = this.firmware
		var candidates = [];
		var response;
		var request_url = `${url}/api/overview`;
		if (version.endsWith('SNAPSHOT')) {
			request_url = `${url}/api/v1/revision/${version}/${target}`;
		}

		ui.showModal(_('Searching...'), [
			E('p', { 'class': 'spinning' },
				_('Searching for an available sysupgrade of %s - %s').format(version, revision))
		]);

		L.resolveDefault(request.get(request_url))
			.then(response => {
				if (!response.ok) {
					ui.showModal(_('Error connecting to upgrade server'), [
						E('p', {}, _('Could not reach API at "%s". Please try again later.').format(response.url)),
						E('pre', {}, response.responseText),
						E('div', { class: 'right' }, [
							E('div', { class: 'btn', click: ui.hideModal }, _('Close'))
						]),
					]);
					return;
				}
				if (version.endsWith('SNAPSHOT')) {
					const remote_revision = response.json().revision;
					if (get_revision_count(revision) < get_revision_count(remote_revision)) {
						candidates.push([version, remote_revision]);
					}
				} else {
					const latest = response.json().latest;

					for (let remote_version of latest) {
						var remote_branch = get_branch(remote_version);

						// already latest version installed
						if (version == remote_version) {
							break;
						}

						// skip branch upgrades outside the advanced mode
						if (this.data.branch != remote_branch && this.data.advanced_mode == 0) {
							continue;
						}

						candidates.unshift([remote_version, null]);

						// don't offer branches older than the current
						if (this.data.branch == remote_branch) {
							break;
						}
					}
				}

				if (candidates.length) {
					var m, s, o;

					var mapdata = {
						request: {
							profile: this.firmware.profile,
							version: candidates[0][0],
							packages: Object.keys(this.firmware.packages).sort(),
						},
					};

					var map = new form.JSONMap(mapdata, '');

					s = map.section(form.NamedSection, 'request', '', '', 'Use defaults for the safest update');
					o = s.option(form.ListValue, 'version', 'Select firmware version');
					for (let candidate of candidates) {
						o.value(candidate[0], candidate[1] ? `${candidate[0]} - ${candidate[1]}` : candidate[0]);
					}

					if (this.data.advanced_mode == 1) {
						o = s.option(form.Value, 'profile', _('Board Name / Profile'));
						o = s.option(form.DynamicList, 'packages', _('Packages'));
					}

					L.resolveDefault(map.render()).
						then(form_rendered => {
							ui.showModal(_('New firmware upgrade available'), [
								E('p', _('Currently running: %s - %s').format(this.firmware.version, this.data.revision)),
								form_rendered,
								E('div', { class: 'right' }, [
									E('div', { class: 'btn', click: ui.hideModal }, _('Cancel')), ' ',
									E('button', {
										'class': 'btn cbi-button cbi-button-positive important',
										'click': ui.createHandlerFn(this, function () {
											map.save().then(() => {
												this.firmware.packages = mapdata.request.packages;
												this.firmware.version = mapdata.request.version;
												this.firmware.profile = mapdata.request.profile;
												poll.add(L.bind(this.handleRequest, this), 5);
											});
										})
									}, _('Request firmware image')),
								]),
							]);
						});
				} else {
					ui.showModal(_('No upgrade available'), [
						E('p', _('The device runs the latest firmware version %s - %s').format(version, revision)),
						E('div', { class: 'right' }, [
							E('div', { class: 'btn', click: ui.hideModal }, _('Close')),
						]),
					]);
				}

			});
	},

	load: function () {
		return Promise.all([
			L.resolveDefault(callPackagelist(), {}),
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(fs.stat("/sys/firmware/efi"), null),
			uci.load('attendedsysupgrade'),
		]);
	},

	render: function (res) {
		this.data.app_version = res[0].packages['luci-app-attendedsysupgrade'];
		this.firmware.packages = res[0].packages;

		this.firmware.profile = res[1].board_name;
		this.firmware.target = res[1].release.target;
		this.firmware.version = res[1].release.version;
		this.data.branch = get_branch(res[1].release.version);
		this.data.revision = res[1].release.revision;
		this.data.efi = res[2];
		if (res[1].rootfs_type) {
			this.firmware.filesystem = res[1].rootfs_type;
		} else {
			L.resolveDefault(fs.read("/proc/mounts"), '')
			.then(mounts => {
				mounts = mounts.split(/\r?\n/);
				var mount_point = '/';
				for (var i = 0; i < mounts.length; i++) {
					// /dev/root /rom squashfs ro,relatime 0 0
					var [ ,path,type,,, ] = mounts[i].split(' ')
					if (path == mount_point) {
						if (type != 'overlay') {
							this.firmware.filesystem = type;
							break;
						} else {
							// restart search for root mountpoint
							i = -1;
							mount_point = '/rom';
						}
					}
				}
			});
		}

		this.data.url = uci.get_first('attendedsysupgrade', 'server', 'url');
		this.data.advanced_mode = uci.get_first('attendedsysupgrade', 'client', 'advanced_mode') || 0

		return E('p', [
			E('h2', _('Attended Sysupgrade')),
			E('p', _('The attended sysupgrade service allows to easily upgrade vanilla and custom firmware images.')),
			E('p', _('This is done by building a new firmware on demand via an online service.')),
			E('p', _('Currently running: %s - %s').format(this.firmware.version, this.data.revision)),
			E('button', {
				'class': 'btn cbi-button cbi-button-positive important',
				'click': ui.createHandlerFn(this, this.handleCheck)
			}, _('Search for firmware upgrade'))
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
