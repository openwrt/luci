'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci';
'require ui';


const callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

const check_setting = [ 'attendedsysupgrade', 'client', 'login_check_for_upgrades' ];

function setSetUpgradeCheck(pref) {
	uci.set(...check_setting, pref);
	return uci.save()
		.then(L.bind(L.ui.changes.init, L.ui.changes))
		.then(L.bind(L.ui.changes.displayChanges, L.ui.changes));
}

function showUpgradeNotification(type, boardinfo, version, upgrade_info)
{

	// TODO show the toggle for _('Look online for upgrades upon status page load')...

	const table_rows = [
		// Title                Current                     Available
		[_('Firmware Version'), boardinfo.release.version,  upgrade_info.version_number        ],
		[_('Revision'),         boardinfo.release.revision, upgrade_info.version_code          ],
		[_('Kernel Version'),   boardinfo.kernel,           upgrade_info.linux_kernel?.version ],
	];

	const table = E('table', { 'class': 'table' });

	table.appendChild(
		E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, [  ]),
			E('th', { 'class': 'th' }, [ _('Current') ]),
			E('th', { 'class': 'th' }, [ _('Available') ])
		])
	);

	table_rows.forEach(([c1, c2, c3]) => {
		table.appendChild(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, [ c1 ]),
			E('td', { 'class': 'td left'                 }, [ c2 ?? '?' ]),
			E('td', { 'class': 'td left'                 }, [ c3 ?? '?' ]),
		]));
	});

	const branch = version.split('.').slice(0, 2).join('.');
	ui.addTimeLimitedNotification(_('New Firmware Available'), [
		E('p', _('A new %s version of OpenWrt is available:').format(type)),
		table,
		E('p', [
			_('Check') + ' ',
			E('a', {href: '/cgi-bin/luci/admin/system/attendedsysupgrade'}, _('Attended Sysupgrade')),
			' ' + _('and') + ' ',
			E('a', {href: `https://openwrt.org/releases/${branch}/notes-${version}`}, _('release notes')),
		]),
		E('div', { class: 'btn', click: () => setSetUpgradeCheck(false) }, _('Stop showing upgrade alerts')),
	], 60000, 'notice');
}

function shouldUpgrade(installed, available)
{
	// If installed is any snapshot (release or main), don't upgrade.

	if (! available) return false;
	if (! installed) return false;
	if (installed.includes('SNAPSHOT')) return false;

	// At this point we know the versions are in one of two forms:
	//    MM.mm.rr
	//    MM.mm.rr-rcN
	// so partition them up into a 4-element array, with a value of
	// 99 for the "release candidate" part of any release.
	const parse = (v) => [
		...v.split('-')[0].split('.').map(Number),
		Number(v.split(/rc/)[1] || 99)
	];

	const [aParts, iParts] = [parse(available), parse(installed)];

	for (let i = 0; i < iParts.length; i++) {
		const aVal = aParts[i];
		const iVal = iParts[i];
		if (aVal > iVal) return true;
		if (aVal < iVal) return false;
	}

	return false;
}

async function checkDeviceAvailable(boardinfo, new_version)
{
	const profile_url = `https://downloads.openwrt.org/releases/${new_version}/targets/${boardinfo?.release?.target}/profiles.json`;
	return fetch(profile_url)
		.then(response => response.json())
		.then(data => {
			// special case for x86, armsr and loongarch
			if (Object.keys(data?.profiles).length == 1 && Object.keys(data?.profiles)[0] == "generic") {
				return [true, data];
			}

			for (const profileName in data?.profiles) {
				if (profileName === boardinfo?.board_name) {
					return [true, data];
				}
				const profile = data?.profiles[profileName];
				if (profile.supported_devices?.includes(boardinfo?.board_name)) {
					return [true, data];
				}
			}

			return [false, null];
		})
		.catch(error => {
			console.error('Failed to fetch firmware upgrade profile information:', error);
			return [false, null];
		});
};

return baseclass.extend({
	title: '',

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			uci.load(check_setting[0]),
		]);
	},


	oneshot: function(data) {
		var boardinfo = data[0];
		const check_upgrades = uci.get_bool(...check_setting);

		if (check_upgrades) {
			fetch('https://downloads.openwrt.org/.versions.json')
			.then(response => response.json())
			.then(async (versions) => {
				var label = null;
				var new_version = null;

				const installed_version = boardinfo?.release?.version;
				const prev_version = versions?.oldstable_version;
				const curr_version = versions?.stable_version;
				const next_version = versions?.upcoming_version;  // Only available during "rc".

				if (shouldUpgrade(installed_version, prev_version)) {
					// On old branch, and a newer 'old stable' is available.
					label = 'old stable';
					new_version = prev_version;
				} else if (shouldUpgrade(installed_version, curr_version)) {
					// On old stable or current branch, and newer stable is available.
					label = 'stable';
					new_version = curr_version;
				} else if (shouldUpgrade(installed_version, next_version)) {
					// On current stable or rc branch, a newer rc is available.
					label = 'release candidate';
					new_version = next_version;
				}

				if (new_version) {
					(async function(label, new_version) {
						const [available, upgrade_info] = await checkDeviceAvailable(boardinfo, new_version);
						if (available && upgrade_info)
							showUpgradeNotification(label, boardinfo, new_version, upgrade_info);
					})(label, new_version);
				}

			})
			.catch(error => {
					console.error('Failed to fetch firmware upgrade version information:', error);
			});
		}
	},

	render: function(data) {
		const isReadOnlyView = !L.hasViewPermission();
		if (isReadOnlyView)
			return null;

		let check_upgrades = uci.get(...check_setting);
		if (check_upgrades != null)
			return null;

		let modal_body = [
			E('p',  _('Checking for firmware upgrades requires access to several files ' +
			  'on the downloads site, so requires internet access.')),

			E('p',  _('The check will be performed every time the Status -> Overview page is loaded.')),

			E('p', _('You have not yet specified a preference for this setting. ' +
			  'Once set, this dialog will not be shown again, but you can go to ' +
			  'System -> Attended Sysupgrade configuration to change the setting.')),

			E('div', { class: 'right' }, [
				E('div', { class: 'btn', click: () => setSetUpgradeCheck(true)  }, _('Yes, enable checking')),
				E('div', { class: 'btn', click: () => setSetUpgradeCheck(false) }, _('No, disable checking')),
				E('div', { class: 'btn', click: ui.hideModal }, _('Close')),
			]),
		];
		ui.showModal(_('Check online for firmware upgrades'), modal_body);

		return null;
	}
});
