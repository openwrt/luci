'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci'
'require ui';

var callLuciVersion = rpc.declare({
	object: 'luci',
	method: 'getVersion'
});

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

function showUpgradeModal(type, current_version, new_version) {
	ui.showModal(_('New Firmware Available'), [
		E('p', _('A new %s version of OpenWrt is available: %s').format(type, new_version)),
		E('p', _('Your current version is: %s').format(current_version)),
		E('p', _('Please check the https://firmware-selector.openwrt.org/ for the firmware upgrade image')),
		E('div', { class: 'btn', click: ui.hideModal }, _('Close')),
	]);
};

function checkDeviceAvailable(boardinfo, new_version) {
	const profile_url = 'https://downloads.openwrt.org/releases/%s/targets/%s/profiles.json'.format(new_version, boardinfo.release.target);
	return fetch(profile_url)
		.then(response => response.json())
		.then(data => {
			// special case for x86 and armsr
			if (Object.keys(data.profiles).length == 1 && Object.keys(data.profiles)[0] == "generic") {
				return true;
			}

			for (var i = 0; i < data.profiles.length; i++) {
				if (data.profiles[i].profile == boardinfo.board_name) {
					return true;
				}
				for (var j = 0; j < data.profiles[i].supported_devices.length; j++) {
					if (data.profiles[i].supported_devices[j] == boardinfo.board_name) {
						return true;
					}
				}
			}
		})
		.catch(error => {
			console.error('Failed to fetch profile information:', error);
			return false;
		});
};


return baseclass.extend({
	title: _('System'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(callLuciVersion(), { revision: _('unknown version'), branch: 'LuCI' }),
			uci.load('luci')
		]);
	},

	oneshot: function(data) {
		var boardinfo = data[0];
		var check_upgrades = uci.get_first('luci', 'core', 'check_firmware_version') || false;
		console.log(check_upgrades)

		if (check_upgrades == '1' || check_upgrades == 'true') {
				fetch('https://downloads.openwrt.org/.versions.json')
				.then(response => response.json())
				.then(data => {
						if (data.oldstable_version
								&& data.oldstable_version > boardinfo.release.version
								&& checkDeviceAvailable(boardinfo, data.oldstable_version)) {
							showUpgradeModal("oldstable", boardinfo.release.version, data.oldstable_version)
						} else if (data.stable_version
								&& data.stable_version > boardinfo.release.version
								&& checkDeviceAvailable(boardinfo, data.stable_version)) {
							showUpgradeModal("stable", boardinfo.release.version, data.stable_version)
						} else if (data.upcoming_version
								&& boardinfo.release.version > data.stable_version
								&& data.upcoming_version > boardinfo.release.version
								&& checkDeviceAvailable(boardinfo, data.upcoming_version)) {
							showUpgradeModal("upcomming", boardinfo.release.version, data.upcoming_version)
						}
				})
				.catch(error => {
						console.error('Failed to fetch version information:', error);
				});
		}
	},

	render: function(data) {
		var boardinfo   = data[0],
		    systeminfo  = data[1],
		    luciversion = data[2];

		luciversion = luciversion.branch + ' ' + luciversion.revision;

		var datestr = null;

		if (systeminfo.localtime) {
			var date = new Date(systeminfo.localtime * 1000);

			datestr = '%04d-%02d-%02d %02d:%02d:%02d'.format(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1,
				date.getUTCDate(),
				date.getUTCHours(),
				date.getUTCMinutes(),
				date.getUTCSeconds()
			);
		}

		var fields = [
			_('Hostname'),         boardinfo.hostname,
			_('Model'),            boardinfo.model,
			_('Architecture'),     boardinfo.system,
			_('Target Platform'),  (L.isObject(boardinfo.release) ? boardinfo.release.target : ''),
			_('Firmware Version'), (L.isObject(boardinfo.release) ? boardinfo.release.description + ' / ' : '') + (luciversion || ''),
			_('Kernel Version'),   boardinfo.kernel,
			_('Local Time'),       datestr,
			_('Uptime'),           systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null,
			_('Load Average'),     Array.isArray(systeminfo.load) ? '%.2f, %.2f, %.2f'.format(
				systeminfo.load[0] / 65535.0,
				systeminfo.load[1] / 65535.0,
				systeminfo.load[2] / 65535.0
			) : null
		];

		var table = E('table', { 'class': 'table' });

		for (var i = 0; i < fields.length; i += 2) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ fields[i] ]),
				E('td', { 'class': 'td left' }, [ (fields[i + 1] != null) ? fields[i + 1] : '?' ])
			]));
		}

		return table;
	}
});
