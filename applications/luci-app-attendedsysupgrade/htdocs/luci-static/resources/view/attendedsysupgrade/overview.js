'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
'require poll';
'require request';
'require dom';

var callPackagelist = rpc.declare({
	object: 'rpc-sys',
	method: 'packagelist',
});

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callUpgradeStart = rpc.declare({
	object: 'rpc-sys',
	method: 'upgrade_start',
	params: ["keep"]
});

function install_sysupgrade(url, keep, sha256) {
	displayStatus("notice spinning", E('p', _('Downloading firmware from server to browser')));
	request.get(url, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			responseType: 'blob'
		})
		.then(response => {
			var form_data = new FormData();
			form_data.append("sessionid", rpc.getSessionID());
			form_data.append("filename", "/tmp/firmware.bin");
			form_data.append("filemode", 600);
			form_data.append("filedata", response.blob());

			displayStatus("notice spinning", E('p', _('Uploading firmware from browser to device')));
			request.get(L.env.cgi_base + "/cgi-upload", {
					method: 'PUT',
					content: form_data
				})
				.then(response => response.json())
				.then(response => {
					if (response.sha256sum != sha256) {
						displayStatus("warning", [
							E('b', _('Wrong checksum')),
							E('p', _('Error during download of firmware. Please try again')),
							E('div', {
								'class': 'btn',
								'click': ui.hideModal
							}, _('Close'))
						]);
					} else {
						displayStatus('warning spinning', E('p', _('Installing the sysupgrade. Do not unpower device!')));
							L.resolveDefault(callUpgradeStart(keep), {}).then(response => {
								if (keep) {
									ui.awaitReconnect(window.location.host);
								} else {
									ui.awaitReconnect('192.168.1.1', 'openwrt.lan');
								}
							});
					}
				});
		});
}

function request_sysupgrade(server_url, data) {
	var res, req;

	if (data.request_hash) {
		req = request.get(server_url + "/api/build/" + data.request_hash)
	} else {
		req = request.post(server_url + "/api/build", {
			profile: data.board_name,
			version: data.version,
			packages: data.packages,
			diff_packages: true,
		})
	}

	req.then(response => {
		switch (response.status) {
			case 200:
				var res = response.json()
				var image;
				console.log(res)
				for (image of res.images) {
					if (image.type == "sysupgrade") {
						break;
					}
				}
				if (image.name != undefined) {
					var sysupgrade_url = server_url + "/store/" + res.bin_dir + "/" + image.name;

					var keep = E('input', {
						type: 'checkbox'
					})
					keep.checked = true;

					var fields = [
						_('Version'), res.version_number + ' ' + res.version_code,
						_('File'), E('a', {
							'href': sysupgrade_url
						}, image.name),
						_('SHA256'), image.sha256,
						_('Build Date'), res.build_at,
						_('Target'), res.target,
					];

					var table = E('div', {
						'class': 'table'
					});

					for (var i = 0; i < fields.length; i += 2) {
						table.appendChild(E('div', {
							'class': 'tr'
						}, [
							E('div', {
								'class': 'td left',
								'width': '33%'
							}, [fields[i]]),
							E('div', {
								'class': 'td left'
							}, [(fields[i + 1] != null) ? fields[i + 1] : '?'])
						]));
					}

					var modal_body = [
						table,
						E('p', {}, E('label', {
							'class': 'btn'
						}, [
							keep, ' ', _('Keep settings and retain the current configuration')
						])),
						E('div', {
							'class': 'right'
						}, [
							E('div', {
								'class': 'btn',
								'click': ui.hideModal
							}, _('Cancel')),
							' ',
							E('div', {
								'class': 'btn cbi-button-action',
								'click': function() {
									install_sysupgrade(sysupgrade_url, keep.checked, image.sha256)
								}
							}, _('Install Sysupgrade'))
						])
					]

					ui.showModal(_('Successfully created sysupgrade image'), modal_body);
				}

				break;
			case 202:
				res = response.json()
				data.request_hash = res.request_hash;
				switch (res.status) {
					case "queued":
						displayStatus("notice spinning", E('p', _('Request in build queue')));
						break;
					case "started":
						displayStatus("notice spinning", E('p', _('Building the sysupgrade image')));
						break;
				}
				setTimeout(function() {
					request_sysupgrade(server_url, data);
				}, 5000);
				break;
			case 400: // bad request
			case 422: // bad package
			case 500: // build failed
				res = response.json()
				var body = [
					E('p', {}, _(res.message)),
					E('p', {}, _("Please report the error message and request")),
					E('b', {}, _("Request to server:")),
					E('pre', {}, JSON.stringify(data, null, 4)),

				]

				if (res.stdout) {
					body.push(E('b', {}, "STDOUT:"))
					body.push(E('pre', {}, res.stdout))

				}

				if (res.stderr) {
					body.push(E('b', {}, "STDERR:"))
					body.push(E('pre', {}, res.stderr))

				}

				body = body.concat([
					E('div', {
						'class': 'right'
					}, [
						E('div', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Close'))
					])
				]);
				ui.showModal(_('Error building the sysupgrade'), body);
				break;
		}
	});
}

function check_sysupgrade(server_url, current_version, board_name, packages) {
	displayStatus("notice spinning", E('p', _('Searching for an available sysupgrade')));
	var current_branch = current_version.split(".").slice(0, 2).join(".");
	var candidates = [];
	fetch(server_url + "/api/latest")
		.then(response => response.json())
		.then(response => {
			if (current_version == "SNAPSHOT") {
				candidates.push("SNAPSHOT");
			} else {
				for (let version of response["latest"]) {
					var branch = version.split(".").slice(0, 2).join(".");

					// already latest version installed
					if (current_version == version) {
						break;
					}

					// warn user that a new major release would be installed
					//if (current_branch != branch) {
					//	branch["warn_branch_jump"] = true;
					//}

					candidates.unshift(version);

					// don't offer branches older than the current
					if (current_branch == branch) {
						break;
					}
				}
			}
			if (candidates) {
				var m, s, o;
				var advanced_mode = uci.get_first('attendedsysupgrade', 'client', 'advanced_mode') || 0;

				console.log(candidates);

				var mapdata = {
					request: {
						board_name: board_name,
						version: candidates[0],
						packages: Object.keys(packages).sort(),
					}
				}

				m = new form.JSONMap(mapdata, '');

				s = m.section(form.NamedSection, 'request', 'example', '',
					'Use defaults for the safest update');
				o = s.option(form.ListValue, 'version', 'Select firmware version');
				for (let candidate of candidates) {
					o.value(candidate, candidate);
				}

				if (advanced_mode == 1) {
					o = s.option(form.Value, 'board_name', 'Board Name / Profile');
					o = s.option(form.DynamicList, 'packages', 'Packages');
				}


				m.render()
					.then(function(form_rendered) {
						ui.showModal(_('New upgrade available'), [
							form_rendered,
							E('div', {
								'class': 'right'
							}, [
								E('div', {
									'class': 'btn',
									'click': ui.hideModal
								}, _('Cancel')),
								' ',
								E('div', {
									'class': 'btn cbi-button-action',
									'click': function() {
										m.save().then(foo => {
											request_sysupgrade(
												server_url, mapdata.request
											)
										});
									}
								}, _('Request Sysupgrade'))
							])
						]);
					});
			} else {
				ui.showModal(_('No upgrade available'), [
					E('p', {}, _("The device runs the latest firmware version")),
					E('div', {
						'class': 'right'
					}, [
						E('div', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Close'))
					])
				]);
			}
		});
}

function displayStatus(type, content) {
	if (type) {
		var message = ui.showModal('', '');

		message.classList.add('alert-message');
		DOMTokenList.prototype.add.apply(message.classList, type.split(/\s+/));

		if (content)
			dom.content(message, content);
	} else {
		ui.hideModal();
	}
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callPackagelist(), {}),
			L.resolveDefault(callSystemBoard(), {}),
			uci.load('attendedsysupgrade')
		]);
	},
	render: function(res) {
		var packages = res[0].packages;
		var current_version = res[1].release.version;
		var board_name = res[1].board_name;
		var auto_search = uci.get_first('attendedsysupgrade', 'client', 'auto_search') || 1;
		var server_url = uci.get_first('attendedsysupgrade', 'server', 'url');

		var view = [
			E('h2', _("Attended Sysupgrade")),
			E('p', _('The attended sysupgrade service allows to easily upgrade vanilla and custom firmware images.')),
			E('p', _('This is done by building a new firmware on demand via an online service.'))
		];

		if (auto_search == 1) {
			check_sysupgrade(server_url, current_version, board_name, packages)
		}

		view.push(E('p', {
			'class': 'btn cbi-button-positive',
			'click': function() {
				check_sysupgrade(server_url, current_version, board_name, packages)
			}
		}, _('Search for sysupgrade')));

		return view;
	},

});
