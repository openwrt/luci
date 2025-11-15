'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci'
'require ui';


const callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

function showUpgradeNotification(type, boardinfo, new_version, upgrade_info)
{
	const table_rows = [
		// Title                Current                     Available
		[_('Firmware Version'), boardinfo.release.version,  upgrade_info.version_number        ],
		[_('Revision'),         boardinfo.release.revision, upgrade_info.version_code          ],
		[_('Kernel Version'),   boardinfo?.kernel,          upgrade_info.linux_kernel?.version ],
	];

	const table = E('table', { 'class': 'table' });

	table.appendChild(
		E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, [  ]),
			E('th', { 'class': 'th' }, [ _('Current') ]),
			E('th', { 'class': 'th' }, [ _('Available') ])
		])
	);

	table_rows.forEach((cols) => {
		table.appendChild(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, [ cols[0] ]),
			E('td', { 'class': 'td left'                 }, [ cols[1] ?? '?' ]),
			E('td', { 'class': 'td left'                 }, [ cols[2] ?? '?' ]),
		]));
	});

	ui.addTimeLimitedNotification(_('New Firmware Available'), [
		E('p', _('A new %s version of OpenWrt is available:').format(type)),
		table,
		E('p', [
			_('Check') + ' ',
			E('a', {href: `/cgi-bin/luci/admin/system/attendedsysupgrade`}, _('Attended Sysupgrade')),
			' ' + _('and') + ' ',
			E('a', {href: `https://openwrt.org/releases/${new_version?.split('.').slice(0, 2).join('.')}/notes-${new_version}`}, _('release notes')),
		]),
	], 60000, 'notice');
};

function shouldUpgrade(installed, available)
{
	// If installed is any snapshot (release or main), don't upgrade.

	if (! available) return false;
	if (! installed || installed.includes('SNAPSHOT')) return false

	const parse = (v) => v.split(/[-+]/)[0]?.split('.').map(Number);
	const parseRC = (v) => v.split(/[-+]/)[1]?.split('').map(Number);
	const isPrerelease = (v) => /-/.test(v);

	const [aParts, bParts] = [parse(available), parse(installed)];

	for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
		const numA = aParts[i] || 0;
		const numB = bParts[i] || 0;
		if (numA > numB) return true;
		if (numA < numB) return false;
	}

	const [aRC, bRC] = [parseRC(available), parseRC(installed)];

	if (aRC > bRC) return true;
	if (aRC < bRC) return false;

	// If numeric parts are equal, handle release candidates
	// if (isPrerelease(available) && !isPrerelease(installed)) return false;
	if (!isPrerelease(available) && isPrerelease(installed)) return true;
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
			uci.load('luci')
		]);
	},

	handleSetUpgradeCheck: function(pref, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.blur();

		uci.set('luci', 'main', 'check_for_newer_firmwares', pref);

		return uci.save()
			.then(L.bind(L.ui.changes.init, L.ui.changes))
			.then(L.bind(L.ui.changes.displayChanges, L.ui.changes));
	},

	oneshot: function(data) {
		var boardinfo = data[0];
		const check_upgrades = uci.get_bool('luci', 'main', 'check_for_newer_firmwares');

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
		const check_upgrades = uci.get_bool('luci', 'main', 'check_for_newer_firmwares') ?? false;
		const isReadonlyView = !L.hasViewPermission();

		let perform_check_pref = E('input', { type: 'checkbox', 'click': L.bind(this.handleSetUpgradeCheck, this, !check_upgrades), });
		perform_check_pref.checked = check_upgrades;

		let perform_check_pref_p = E('div', [_('Look online for upgrades upon status page load') + ' ', perform_check_pref]);

		return E('div', [!isReadonlyView ? perform_check_pref_p : '']);
	}
});
