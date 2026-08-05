'use strict';
'require dom';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require uqr';
'require tools.widgets as widgets';

/*
	button handling
*/
function handleAction(ev) {
	const status = document.getElementById('status');
	const map = document.querySelector('.cbi-map');
	if (ev === 'restart' || ev === 'reload') {
		return dom.callClassMethod(map, 'save')
			.then(L.bind(ui.changes.apply, ui.changes))
			.then(function () {
				document.querySelectorAll('.cbi-page-actions button').forEach(function (btn) {
					btn.disabled = true;
					btn.blur();
				});
				return fs.exec_direct('/etc/init.d/adblock', [ev]);
			});
	} else {
		if (ev === 'stop') {
			/* a resume after a stop makes no sense, reset the toggle right away */
			const btnSuspend = document.getElementById('btn_suspend');
			if (btnSuspend) {
				btnSuspend.textContent = _('Suspend');
			}
		} else if (status && status.getAttribute('data-state') === 'paused') {
			ev = 'resume';
		}
		document.querySelectorAll('.cbi-page-actions button').forEach(function (btn) {
			btn.disabled = true;
			btn.blur();
		});
		return fs.exec_direct('/etc/init.d/adblock', [ev]);
	}
}

/*
	runtime string helpers

	f_jsnup() packs several runtime fields into display strings of the form
	"key: value, key: value, ...". Split them up again so they can be rendered
	as chips and key/value rows instead of one long line.
*/
function parsePairs(text) {
	const pairs = [];
	(text || '').split(', ').forEach(function (item) {
		const idx = item.indexOf(': ');
		if (idx > 0) {
			pairs.push([item.substring(0, idx), item.substring(idx + 2)]);
		} else if (item.trim()) {
			pairs.push([null, item.trim()]);
		}
	});
	return pairs;
}

function pickValue(pairs, key) {
	for (let i = 0; i < pairs.length; i++) {
		if (pairs[i][0] === key) {
			return pairs[i][1];
		}
	}
	return '-';
}

/* expand grouped flags, e.g. "ext. DNS (std/prot/remote/bridge): ✘/✔/✘/✘" */
function expandFlags(pairs) {
	const flags = [];
	pairs.forEach(function (pair) {
		if (!pair[0]) {
			return;
		}
		const group = pair[0].match(/^(.*?)\s*\(([^()]*\/[^()]*)\)$/);
		if (group) {
			const names = group[2].split('/');
			const values = pair[1].split('/');
			if (names.length === values.length) {
				for (let i = 0; i < names.length; i++) {
					flags.push([group[1] + ' ' + names[i], values[i]]);
				}
				return;
			}
		}
		flags.push(pair);
	});
	return flags;
}

function flagChips(text) {
	return expandFlags(parsePairs(text)).sort(function (a, b) {
		return a[0].localeCompare(b[0]);
	}).map(function (flag) {
		const on = flag[1] === '\u2714';
		return E('span', { 'class': 'adb-chip ' + (on ? 'adb-chip-on' : 'adb-chip-off') }, [
			E('span', { 'class': 'adb-mark' }, [on ? '\u2714' : '\u2718']),
			flag[0]
		]);
	});
}

function activeFeeds(feeds) {
	return (Array.isArray(feeds) ? feeds : []).filter(function (feed) {
		return feed && feed !== '-';
	});
}

function feedChips(feeds) {
	const chips = feeds.map(function (feed) {
		return E('span', { 'class': 'adb-chip adb-chip-feed' }, [feed]);
	});
	return chips.length ? chips : ['-'];
}

/*
	system_info is "cores: n, fetch: cmd, model, target, distribution version".
	Keep the named entries and the board model, drop target and release.
*/
function sysPairs(text) {
	let plain = 0;
	return parsePairs(text).filter(function (pair) {
		return pair[0] || ++plain === 1;
	});
}

/*
	The container is a two column grid, so the nodes are emitted flat rather
	than wrapped per row - that is what keeps the values aligned across rows.
	Entries without a key span both columns. The trailing space in the key is
	invisible but keeps the text copyable as "key value".
*/
function stackNodes(pairs, mono) {
	const nodes = [];
	pairs.forEach(function (pair) {
		if (pair[0]) {
			nodes.push(E('span', { 'class': 'adb-key' }, [pair[0], ' ']));
			nodes.push(E('span', { 'class': mono ? 'adb-mono' : '' }, [pair[1]]));
		} else {
			nodes.push(E('span', { 'class': mono ? 'adb-full adb-mono' : 'adb-full' }, [pair[1]]));
		}
	});
	return nodes.length ? nodes : ['-'];
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.read_direct('/etc/adblock/adblock.custom.feeds'), ''),
			L.resolveDefault(fs.read_direct('/etc/adblock/adblock.feeds'), ''),
			L.resolveDefault(fs.read_direct('/etc/adblock/adblock.categories'), ''),
			uci.load('adblock').catch(() => 0)
		]);
	},

	render: function (result) {
		/*
			config check
		*/
		if (!result[3] || result[3].length === 0) {
			ui.addNotification(null, E('p', _('No adblock config found!')), 'error');
			return;
		}

		/*
			main map
		*/
		let m, s, o;
		m = new form.Map('adblock', 'Adblock', _('Configuration of the adblock package to block ad/abuse domains by using DNS. \
			For further information please check the %s.'.format(`<a style="color:#37c;font-weight:bold;" href="https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md" target="_blank" rel="noreferrer noopener" >${_('online documentation')}</a>`)));

		/*
			set text content helper function
		*/
		const setText = (id, value) => {
			const el = document.getElementById(id);
			if (el) {
				el.textContent = (value === 0 || value) ? value : '-';
			}
		};

		/*
			set element content helper function
		*/
		const setNodes = (id, nodes) => {
			const el = document.getElementById(id);
			if (el) {
				dom.content(el, nodes);
			}
		};

		/*
			poll runtime information
		*/
		let parseErrCount = 0;
		poll.add(function () {
			return L.resolveDefault(fs.stat('/var/run/adblock/adblock.runtime.json'), null).then(function (stat) {
				if (!stat) {
					return;
				}
				return L.resolveDefault(fs.read_direct('/var/run/adblock/adblock.runtime.json'), null).then(function (res) {
					const status = document.getElementById('status');
					const buttons = document.querySelectorAll('.cbi-page-actions button');
					let info = null;
					try {
						info = JSON.parse(res);
						parseErrCount = 0;
						if (!poll.active()) {
							poll.start();
						}
					} catch (e) {
						info = null;
						parseErrCount++;
						if (parseErrCount >= 5) {
							ui.addNotification(null, E('p', _('Unable to parse the adblock runtime information!')), 'error');
							poll.stop();
						}
						if (status) {
							status.setAttribute('data-state', '');
							setText('state', '-');
							buttons.forEach(btn => btn.disabled = false);
							status.classList.remove('spinning');
						}
						return;
					}
					if (status && info) {
						const state = info.adblock_status || '-';
						status.setAttribute('data-state', state);
						setText('state', state);
						setText('versions', `${info.frontend_ver || '-'} / ${info.backend_ver || '-'}`);
						if (state === "processing") {
							buttons.forEach(function (btn) {
								btn.disabled = true;
								btn.blur();
							});
							if (!status.classList.contains("spinning")) {
								status.classList.add("spinning");
							}
						} else {
							status.classList.remove("spinning");
							const btnSuspend = document.getElementById('btn_suspend');
							if (btnSuspend) {
								btnSuspend.textContent = (state === 'paused') ? _('Resume') : _('Suspend');
							}
							buttons.forEach(function (btn) {
								btn.disabled = false;
							});
						}
					}
					if (info) {
						const runPairs = parsePairs(info.last_run);
						setText('domains', info.blocked_domains);
						setText('backup', info.backup_cnt);
						setText('last', pickValue(runPairs, 'date / time'));
						setText('last_sub', [pickValue(runPairs, 'mode'), pickValue(runPairs, 'duration'),
						pickValue(runPairs, 'memory')].filter(v => v !== '-').join(', '));
						setNodes('feeds', feedChips(activeFeeds(info.active_feeds)));
						setNodes('flags', flagChips(info.run_flags));
						setNodes('backend', stackNodes(parsePairs(info.dns_backend), false));
						setNodes('ifaces', stackNodes(parsePairs(info.run_ifaces), false));
						setNodes('sys', stackNodes(sysPairs(info.system_info), false));
						setNodes('run', stackNodes(parsePairs(info.run_information), true));
					}
				});
			});
		}, 2);

		/*
			runtime information and buttons
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = function (view, section_id) {
			/*
				scoped theme palette

				Neutral surfaces are derived from translucent grey so they work on
				top of any LuCI theme background. Only the semantic colors are
				switched per color scheme, and both variants are chosen to stay
				readable either way.
			*/
			const style = E('style', { 'type': 'text/css' }, [
				'#adb-status {' +
				'--adb-card-bg: rgba(128,128,128,.07);' +
				'--adb-card-border: rgba(128,128,128,.28);' +
				'--adb-muted: GrayText;' +
				'--adb-ok: #1f8a5f;' +
				'--adb-warn: #a8760a;' +
				'--adb-err: #c0392b;' +
				'--adb-info: #2f6fb0;' +
				'--adb-ok-bg: rgba(31,138,95,.14);' +
				'--adb-info-bg: rgba(47,111,176,.14);' +
				'}' +
				'@media (prefers-color-scheme: dark) {' +
				'#adb-status {' +
				'--adb-ok: #63c79b;' +
				'--adb-warn: #d9ab4e;' +
				'--adb-err: #e8897e;' +
				'--adb-info: #7fb3e8;' +
				'}}' +
				'#adb-status .adb-grid { display: grid; gap: .75em; grid-template-columns: repeat(auto-fit, minmax(11em, 1fr)); margin-bottom: .75em; }' +
				'#adb-status .adb-card { background: var(--adb-card-bg); border: 1px solid var(--adb-card-border); border-radius: 8px; padding: .7em .9em; min-width: 0; overflow-wrap: break-word; }' +
				'#adb-status .adb-block { margin-bottom: .75em; }' +
				'#adb-status .adb-label { font-size: .85em; color: var(--adb-muted); margin-bottom: .3em; }' +
				'#adb-status .adb-sub { font-size: .8em; color: var(--adb-muted); margin-top: .3em; }' +
				'#adb-status .adb-value { font-size: 1.5em; line-height: 1.3; font-variant-numeric: tabular-nums; }' +
				'#adb-status .adb-state { display: flex; align-items: center; gap: .5em; }' +
				'#adb-status .adb-dot { width: .6em; height: .6em; border-radius: 50%; background: var(--adb-muted); flex: 0 0 auto; }' +
				'#adb-status .adb-state[data-state="enabled"] .adb-dot { background: var(--adb-ok); }' +
				'#adb-status .adb-state[data-state="paused"] .adb-dot { background: var(--adb-warn); }' +
				'#adb-status .adb-state[data-state="processing"] .adb-dot { background: var(--adb-info); }' +
				'#adb-status .adb-state[data-state="error"] .adb-dot { background: var(--adb-err); }' +
				'#adb-status .adb-title { font-weight: bold; margin-bottom: .6em; }' +
				'#adb-status .adb-chips { display: flex; flex-wrap: wrap; gap: .35em; }' +
				'#adb-status .adb-chip { font-size: .85em; padding: .15em .6em; border-radius: 6px; border: 1px solid transparent; }' +
				'#adb-status .adb-chip-on { background: var(--adb-ok-bg); color: var(--adb-ok); }' +
				'#adb-status .adb-chip-off { color: var(--adb-muted); border-color: var(--adb-card-border); }' +
				'#adb-status .adb-chip-feed { background: var(--adb-info-bg); color: var(--adb-info); }' +
				'#adb-status .adb-mark { margin-right: .35em; }' +
				'#adb-status .adb-key { color: var(--adb-muted); }' +
				'#adb-status .adb-mono { font-family: monospace; word-break: break-all; }' +
				'#adb-status .adb-stack { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .25em .6em; }' +
				'#adb-status .adb-stack .adb-full { grid-column: 1 / -1; }'
			]);

			return E('div', { 'class': 'cbi-section', 'id': 'adb-status' }, [
				style,
				E('div', { 'class': 'adb-grid' }, [
					E('div', { 'class': 'adb-card' }, [
						E('div', { 'class': 'adb-label' }, [_('Status')]),
						E('div', { 'class': 'adb-state spinning', 'id': 'status', 'data-state': '' }, [
							E('span', { 'class': 'adb-dot' }),
							E('span', { 'class': 'adb-value', 'id': 'state' }, ['-'])
						]),
						E('div', { 'class': 'adb-sub' }, [
							_('Version'), ': ', E('span', { 'id': 'versions' }, ['-'])
						])
					]),
					E('div', { 'class': 'adb-card' }, [
						E('div', { 'class': 'adb-label' }, [_('Blocked Domains')]),
						E('div', { 'class': 'adb-value', 'id': 'domains' }, ['-']),
						E('div', { 'class': 'adb-sub' }, [
							_('Backup'), ': ', E('span', { 'id': 'backup' }, ['-'])
						])
					]),
					E('div', { 'class': 'adb-card' }, [
						E('div', { 'class': 'adb-label' }, [_('Last Run')]),
						E('div', { 'class': 'adb-value', 'id': 'last' }, ['-']),
						E('div', { 'class': 'adb-sub', 'id': 'last_sub' }, ['-'])
					])
				]),
				E('div', { 'class': 'adb-grid' }, [
					E('div', { 'class': 'adb-card' }, [
						E('div', { 'class': 'adb-title' }, [_('DNS Backend')]),
						E('div', { 'class': 'adb-stack', 'id': 'backend' }, ['-'])
					]),
					E('div', { 'class': 'adb-card' }, [
						E('div', { 'class': 'adb-title' }, [_('Run Interfaces')]),
						E('div', { 'class': 'adb-stack', 'id': 'ifaces' }, ['-'])
					]),
					E('div', { 'class': 'adb-card' }, [
						E('div', { 'class': 'adb-title' }, [_('System Info')]),
						E('div', { 'class': 'adb-stack', 'id': 'sys' }, ['-'])
					])
				]),
				E('div', { 'class': 'adb-card adb-block' }, [
					E('div', { 'class': 'adb-title' }, [_('Active Feeds')]),
					E('div', { 'class': 'adb-chips', 'id': 'feeds' }, ['-'])
				]),
				E('div', { 'class': 'adb-card adb-block' }, [
					E('div', { 'class': 'adb-title' }, [_('Run Flags')]),
					E('div', { 'class': 'adb-chips', 'id': 'flags' }, ['-'])
				]),
				E('div', { 'class': 'adb-card adb-block' }, [
					E('div', { 'class': 'adb-title' }, [_('Run Information')]),
					E('div', { 'class': 'adb-stack', 'id': 'run' }, ['-'])
				])
			]);
		};

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'adblock', _('Settings'));
		s.addremove = false;
		s.tab('general', _('General Settings'));
		s.tab('additional', _('Additional Settings'));
		s.tab('firewall', _('Firewall Settings'));
		s.tab('adv_dns', _('Advanced DNS Settings'));
		s.tab('adv_report', _('Advanced Report Settings'));
		s.tab('adv_email', _('Advanced E-Mail Settings'));
		s.tab('feeds', _('Feed Selection'));

		/*
			general settings tab
		*/
		o = s.taboption('general', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />';

		o = s.taboption('general', form.Flag, 'adb_enabled', _('Enabled'), _('Enable the adblock service.'));
		o.rmempty = false;

		o = s.taboption('general', widgets.NetworkSelect, 'adb_trigger', _('Startup Trigger Interface'), _('List of available network interfaces to trigger the adblock start.'));
		o.multiple = true;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.Value, 'adb_triggerdelay', _('Trigger Delay'), _('Additional trigger delay in seconds before adblock processing begins.'));
		o.placeholder = '5';
		o.datatype = 'range(1,300)';
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_tld', _('TLD Compression'), _('The top level domain compression removes thousands of needless host entries from the final DNS blocklist.'));
		o.default = 1;
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_safesearch', _('Enable SafeSearch'), _('Enforcing SafeSearch for google, bing, brave, duckduckgo, yandex, youtube and pixabay.'));
		o.rmempty = false;

		o = s.taboption('general', form.MultiValue, 'adb_safesearchlist', _('Limit SafeSearch'), _('Limit SafeSearch to certain providers.'));
		o.depends('adb_safesearch', '1');
		o.value('google');
		o.value('bing');
		o.value('brave');
		o.value('duckduckgo');
		o.value('yandex');
		o.value('youtube');
		o.value('pixabay');
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_report', _('DNS Report'), _('Gather DNS related network traffic via tcpdump and provide a DNS Report on demand. \
			This needs the additional \'tcpdump\' or \'tcpdump-mini\' package installation and a full adblock service restart to take effect.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'adb_mail', _('E-Mail Notification'), _('Send adblock related notification e-mails. \
			This needs the additional \'msmtp\' package installation.'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'adb_mailreceiver', _('E-Mail Receiver Address'), _('Receiver address for adblock notification e-mails.'));
		o.depends('adb_mail', '1');
		o.placeholder = 'name@example.com';
		o.rmempty = true;

		/*
			additional settings tab
		*/
		o = s.taboption('additional', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />';

		o = s.taboption('additional', form.Flag, 'adb_debug', _('Verbose Debug Logging'), _('Enable verbose debug logging in case of any processing errors.'));
		o.rmempty = false;

		o = s.taboption('additional', form.ListValue, 'adb_cores', _('CPU Cores'), _('Limit the cpu cores used by adblock to save RAM, autodetected by default.'));
		o.value('1');
		o.value('2');
		o.value('4');
		o.value('8');
		o.value('16');
		o.placeholder = _('-- default --');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'adb_nicelimit', _('Nice Level'), _('The selected priority will be used for adblock background processing.'));
		o.value('-20', _('Highest Priority'));
		o.value('-10', _('High Priority'));
		o.value('0', _('Normal Priority'));
		o.value('10', _('Less Priority'));
		o.value('19', _('Least Priority'));
		o.default = '0';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'adb_basedir', _('Base Directory'), _('Base working directory during adblock processing.'));
		o.placeholder = '/tmp';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'adb_backupdir', _('Backup Directory'), _('Target directory for blocklist backups.'));
		o.placeholder = '/tmp/adblock-backup';
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'adb_fetchcmd', _('Download Utility'), _('List of supported and fully pre-configured download utilities.'));
		o.value('uclient-fetch');
		o.value('wget');
		o.value('curl');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'adb_fetchparm', _('Download Parameters'), _('Override the pre-configured download options for the selected download utility. The output flag, e.g. \'-o\' for curl or \'-O\' for wget, must be the last parameter.'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'adb_fetchretry', _('Download Retries'), _('Number of download attempts in case of an error (not supported by uclient-fetch).'));
		o.value('1');
		o.value('3');
		o.value('5');
		o.value('10');
		o.value('20');
		o.default = '5';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.Flag, 'adb_fetchinsecure', _('Download Insecure'), _('Don\'t check SSL server certificates during download.'));
		o.default = 0;
		o.rmempty = true;

		/*
			firewall settings tab
		*/
		o = s.taboption('firewall', form.DummyValue, '_fw_sub1');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />'
			+ '<em style="color:#37c;font-weight:bold;">' + _('External Unfiltered DNS Policy (MAC-/Interface‑based DNS bypass)') + '</em>';

		o = s.taboption('firewall', form.Flag, 'adb_nftallow', _('Enable Unfiltered DNS Routing'), _('Routes selected MACs or interfaces to an unfiltered external DNS resolver, bypassing local adblock.'));
		o.rmempty = false;

		o = s.taboption('firewall', form.DynamicList, 'adb_nftmacallow', _('MAC DNS Filter Targets'), _('Devices with listed MAC addresses will always use the configured unfiltered DNS server.'));
		o.depends('adb_nftallow', '1');
		o.datatype = 'macaddr';
		o.placeholder = '00:11:22:33:44:55';
		o.multiple = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('firewall', widgets.DeviceSelect, 'adb_nftdevallow', _('Interface DNS Filter Targets'), _('Entire interfaces or VLANs will be routed to the unfiltered DNS server.'));
		o.depends('adb_nftallow', '1');
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_allowdnsv4', _('IPv4 DNS Resolver'), _('External IPv4 DNS resolver applied to MACs and interfaces using the unfiltered DNS policy.'));
		o.depends('adb_nftallow', '1');
		o.datatype = 'ip4addr("nomask")';
		o.value('86.54.11.100', _('DNS4EU (unfiltered)'));
		o.value('94.140.14.140', _('AdGuard (unfiltered)'));
		o.value('76.76.2.0', _('Control D (unfiltered)'));
		o.value('1.1.1.1', _('Cloudflare (unfiltered)'));
		o.value('9.9.9.10', _('Quad9 (unfiltered)'));
		o.value('185.150.99.255', _('Digitale Gesellschaft (unfiltered)'));
		o.default = '86.54.11.100';
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_allowdnsv6', _('IPv6 DNS Resolver'), _('External IPv6 DNS resolver applied to MACs and interfaces using the unfiltered DNS policy.'));
		o.depends('adb_nftallow', '1');
		o.datatype = 'ip6addr("nomask")';
		o.value('2a13:1001::86:54:11:100', _('DNS4EU (unfiltered)'));
		o.value('2a10:50c0::1:ff', _('AdGuard (unfiltered)'));
		o.value('2606:1a40::', _('Control D (unfiltered)'));
		o.value('2606:4700:4700::1111', _('Cloudflare (unfiltered)'));
		o.value('2620:fe::10', _('Quad9 (unfiltered)'));
		o.value('2a07:6b47:6b47::255', _('Digitale Gesellschaft (unfiltered)'));
		o.default = '2a13:1001::86:54:11:100';
		o.rmempty = true;

		o = s.taboption('firewall', form.DummyValue, '_fw_sub2');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('External Filtered DNS Policy (MAC-/Interface‑based DNS bypass)') + '</em>';

		o = s.taboption('firewall', form.Flag, 'adb_nftblock', _('Enable Filtered DNS Routing'), _('Routes selected MACs or interfaces to a filtered external DNS resolver, bypassing local adblock.'));
		o.rmempty = false;

		o = s.taboption('firewall', form.DynamicList, 'adb_nftmacblock', _('MAC DNS Filter Targets'), _('Devices with listed MAC addresses will always use the configured filtered DNS server.'));
		o.depends('adb_nftblock', '1');
		o.datatype = 'macaddr';
		o.placeholder = '00:11:22:33:44:55';
		o.multiple = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('firewall', widgets.DeviceSelect, 'adb_nftdevblock', _('Interface DNS Filter Targets'), _('Entire interfaces or VLANs will be routed to the filtered DNS server.'));
		o.depends('adb_nftblock', '1');
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_blockdnsv4', _('IPv4 DNS Resolver'), _('External IPv4 DNS resolver applied to MACs and interfaces using the filtered DNS policy.'));
		o.depends('adb_nftblock', '1');
		o.datatype = 'ip4addr("nomask")';
		o.value('86.54.11.1', _('DNS4EU (protective)'));
		o.value('86.54.11.12', _('DNS4EU (protective+family)'));
		o.value('86.54.11.13', _('DNS4EU (protective+adblock)'));
		o.value('86.54.11.11', _('DNS4EU (protective+family+adblock)'));
		o.value('176.9.93.198', _('dnsforge (normal)'));
		o.value('49.12.43.208', _('dnsforge (clean)'));
		o.value('49.12.222.213', _('dnsforge (hard)'));
		o.value('94.140.14.14', _('AdGuard (default)'));
		o.value('94.140.14.15', _('AdGuard (family)'));
		o.value('76.76.10.0', _('Control D (security)'));
		o.value('76.76.10.10', _('Control D (family)'));
		o.value('76.76.10.11', _('Control D (adblock)'));
		o.value('1.1.1.2', _('Cloudflare (malware)'));
		o.value('1.1.1.3', _('Cloudflare (malware+family)'));
		o.value('9.9.9.9', _('Quad9 (malware)'));
		o.default = '86.54.11.13';
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_blockdnsv6', _('IPv6 DNS Resolver'), _('External IPv6 DNS resolver applied to MACs and interfaces using the filtered DNS policy.'));
		o.depends('adb_nftblock', '1');
		o.datatype = 'ip6addr("nomask")';
		o.value('2a13:1001::86:54:11:1', _('DNS4EU (protective)'));
		o.value('2a13:1001::86:54:11:12', _('DNS4EU (protective+family)'));
		o.value('2a13:1001::86:54:11:13', _('DNS4EU (protective+adblock)'));
		o.value('2a13:1001::86:54:11:11', _('DNS4EU (protective+family+adblock)'));
		o.value('2a01:4f8:151:34aa::198', _('dnsforge (normal)'));
		o.value('2a01:4f8:c012:ed89::208', _('dnsforge (clean)'));
		o.value('2a01:4f8:c17:2c61::213', _('dnsforge (hard)'));
		o.value('2a10:50c0::ad1:ff', _('AdGuard (default)'));
		o.value('2a10:50c0::bad1:ff', _('AdGuard (family)'));
		o.value('2606:1a40:1::', _('Control D (security)'));
		o.value('2606:1a40:1::1', _('Control D (family)'));
		o.value('2606:1a40:1::2', _('Control D (adblock)'));
		o.value('2606:4700:4700::1112', _('Cloudflare (malware)'));
		o.value('2606:4700:4700::1113', _('Cloudflare (malware+family)'));
		o.value('2620:fe::fe', _('Quad9 (malware)'));
		o.default = '2a13:1001::86:54:11:13';
		o.rmempty = true;

		o = s.taboption('firewall', form.DummyValue, '_fw_sub3');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('External Remote DNS Policy (temporary MAC‑based remote DNS bypass)') + '</em>';

		o = s.taboption('firewall', form.Flag, 'adb_nftremote', _('Enable Remote DNS Routing'), _('Allows temporary access to an unfiltered external DNS resolver, bypassing local adblock.'));
		o.rmempty = false;

		o = s.taboption('firewall', form.DynamicList, 'adb_nftmacremote', _('MAC Remote Filter Targets'), _('Listed MAC addresses are allowed to use the remote DNS bypass.'));
		o.depends('adb_nftremote', '1');
		o.datatype = 'macaddr';
		o.placeholder = '00:11:22:33:44:55';
		o.multiple = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_nftremotetimeout', _('Remote DNS Timeout'), _('Time limit in minutes for using the remote DNS bypass per listed MAC address.'));
		o.depends('adb_nftremote', '1');
		o.datatype = 'range(1,300)';
		o.value('5', _('5 minutes'));
		o.value('10', _('10 minutes'));
		o.value('15', _('15 minutes'));
		o.value('30', _('30 minutes'));
		o.value('60', _('60 minutes'));
		o.default = '15';
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_remotednsv4', _('IPv4 Remote DNS Resolver'), _('External IPv4 DNS resolver applied to MACs using the unfiltered remote DNS policy.'));
		o.depends('adb_nftremote', '1');
		o.datatype = 'ip4addr("nomask")';
		o.value('86.54.11.100', _('DNS4EU (unfiltered)'));
		o.value('94.140.14.140', _('AdGuard (unfiltered)'));
		o.value('76.76.2.0', _('Control D (unfiltered)'));
		o.value('1.1.1.1', _('Cloudflare (unfiltered)'));
		o.value('9.9.9.10', _('Quad9 (unfiltered)'));
		o.value('185.150.99.255', _('Digitale Gesellschaft (unfiltered)'));
		o.default = '86.54.11.100';
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_remotednsv6', _('IPv6 Remote DNS Resolver'), _('External IPv6 DNS resolver applied to MACs using the unfiltered remote DNS policy.'));
		o.depends('adb_nftremote', '1');
		o.datatype = 'ip6addr("nomask")';
		o.value('2a13:1001::86:54:11:100', _('DNS4EU (unfiltered)'));
		o.value('2a10:50c0::1:ff', _('AdGuard (unfiltered)'));
		o.value('2606:1a40::', _('Control D (unfiltered)'));
		o.value('2606:4700:4700::1111', _('Cloudflare (unfiltered)'));
		o.value('2620:fe::10', _('Quad9 (unfiltered)'));
		o.value('2a07:6b47:6b47::255', _('Digitale Gesellschaft (unfiltered)'));
		o.default = '2a13:1001::86:54:11:100';
		o.rmempty = true;

		const url = `${window.location.protocol}//${window.location.hostname}/cgi-bin/adblock`;
		const options = {
			pixelSize: 3,
			margin: 1,
			ecLevel: 'M',
			whiteColor: 'white',
			blackColor: 'black'
		};
		const svg = uqr.renderSVG(url, options);
		o = s.taboption('firewall', form.DummyValue, '_fw_qr', _('QRCode for Remote Access'));
		o.rawhtml = true;
		o.default = svg;

		o = s.taboption('firewall', form.DummyValue, '_fw_sub4');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('External DNS Bridge (Zero‑Downtime during DNS Restarts)') + '</em>';

		o = s.taboption('firewall', form.Flag, 'adb_nftbridge', _('Enable DNS Bridge'), _('Enables a temporary DNS bridge to an external DNS resolver during local DNS restarts.'));
		o.rmempty = false;

		o = s.taboption('firewall', form.Value, 'adb_bridgednsv4', _('IPv4 DNS Resolver'), _('External IPv4 DNS resolver used during bridging.'));
		o.depends('adb_nftbridge', '1');
		o.datatype = 'ip4addr("nomask")';
		o.value('86.54.11.1', _('DNS4EU (protective)'));
		o.value('86.54.11.12', _('DNS4EU (protective+family)'));
		o.value('86.54.11.13', _('DNS4EU (protective+adblock)'));
		o.value('86.54.11.11', _('DNS4EU (protective+family+adblock)'));
		o.value('176.9.93.198', _('dnsforge (normal)'));
		o.value('49.12.43.208', _('dnsforge (clean)'));
		o.value('49.12.222.213', _('dnsforge (hard)'));
		o.value('94.140.14.14', _('AdGuard (default)'));
		o.value('94.140.14.15', _('AdGuard (family)'));
		o.value('76.76.10.0', _('Control D (security)'));
		o.value('76.76.10.10', _('Control D (family)'));
		o.value('76.76.10.11', _('Control D (adblock)'));
		o.value('1.1.1.2', _('Cloudflare (malware)'));
		o.value('1.1.1.3', _('Cloudflare (malware+family)'));
		o.value('9.9.9.9', _('Quad9 (malware)'));
		o.value('86.54.11.100', _('DNS4EU (unfiltered)'));
		o.value('94.140.14.140', _('AdGuard (unfiltered)'));
		o.value('76.76.2.0', _('Control D (unfiltered)'));
		o.value('1.1.1.1', _('Cloudflare (unfiltered)'));
		o.value('9.9.9.10', _('Quad9 (unfiltered)'));
		o.value('185.150.99.255', _('Digitale Gesellschaft (unfiltered)'));
		o.default = '86.54.11.13';
		o.rmempty = true;

		o = s.taboption('firewall', form.Value, 'adb_bridgednsv6', _('IPv6 DNS Resolver'), _('External IPv6 DNS resolver used during bridging.'));
		o.depends('adb_nftbridge', '1');
		o.datatype = 'ip6addr("nomask")';
		o.value('2a13:1001::86:54:11:1', _('DNS4EU (protective)'));
		o.value('2a13:1001::86:54:11:12', _('DNS4EU (protective+family)'));
		o.value('2a13:1001::86:54:11:13', _('DNS4EU (protective+adblock)'));
		o.value('2a13:1001::86:54:11:11', _('DNS4EU (protective+family+adblock)'));
		o.value('2a01:4f8:151:34aa::198', _('dnsforge (normal)'));
		o.value('2a01:4f8:c012:ed89::208', _('dnsforge (clean)'));
		o.value('2a01:4f8:c17:2c61::213', _('dnsforge (hard)'));
		o.value('2a10:50c0::ad1:ff', _('AdGuard (default)'));
		o.value('2a10:50c0::bad1:ff', _('AdGuard (family)'));
		o.value('2606:1a40:1::', _('Control D (security)'));
		o.value('2606:1a40:1::1', _('Control D (family)'));
		o.value('2606:1a40:1::2', _('Control D (adblock)'));
		o.value('2606:4700:4700::1112', _('Cloudflare (malware)'));
		o.value('2606:4700:4700::1113', _('Cloudflare (malware+family)'));
		o.value('2620:fe::fe', _('Quad9 (malware)'));
		o.value('2a13:1001::86:54:11:100', _('DNS4EU (unfiltered)'));
		o.value('2a10:50c0::1:ff', _('AdGuard (unfiltered)'));
		o.value('2606:1a40::', _('Control D (unfiltered)'));
		o.value('2606:4700:4700::1111', _('Cloudflare (unfiltered)'));
		o.value('2620:fe::10', _('Quad9 (unfiltered)'));
		o.value('2a07:6b47:6b47::255', _('Digitale Gesellschaft (unfiltered)'));
		o.default = '2a13:1001::86:54:11:13';
		o.rmempty = true;

		o = s.taboption('firewall', form.DummyValue, '_fw_sub5');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('Local DNS Enforcement') + '</em>';

		o = s.taboption('firewall', form.Flag, 'adb_nftforce', _('Force Local DNS'), _('Redirect all local DNS queries from specified LAN zones to the local DNS resolver, applies to UDP and TCP protocol.'));
		o.rmempty = false;

		o = s.taboption('firewall', widgets.DeviceSelect, 'adb_nftdevforce', _('Forced Devices/VLANs'), _('Firewall LAN Devices/VLANs that should be forced locally.'));
		o.depends('adb_nftforce', '1');
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('firewall', form.DynamicList, 'adb_nftportforce', _('Forced Ports'), _('Firewall ports that should be forced locally.'));
		o.depends('adb_nftforce', '1');
		o.multiple = true;
		o.nocreate = false;
		o.datatype = 'port';
		o.value('53');
		o.value('853');
		o.value('5353');
		o.rmempty = true;

		/*
			advanced dns settings tab
		*/
		o = s.taboption('adv_dns', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />';

		o = s.taboption('adv_dns', form.ListValue, 'adb_dns', _('DNS Backend'), _('List of supported DNS backends.'));
		o.value('dnsmasq', _('dnsmasq'));
		o.value('unbound', _('unbound'));
		o.value('named', _('bind'));
		o.value('smartdns', _('smartdns'));
		o.value('kresd', _('kresd'));
		o.value('raw', _('raw'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_dnsinstance', _('DNS Instance'), _('Set the dns backend instance used by adblock.'));
		o.depends('adb_dns', 'dnsmasq');
		o.depends('adb_dns', 'smartdns');
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.default = '0';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_dnsshift', _('Shift DNS Blocklist'), _('Shift the final DNS blocklist to the backup directory and only set a soft link to this file in memory. \
			As long as your backup directory resides on an external drive, enable this option to save memory.'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_dnsflush', _('Flush DNS Cache'), _('Empty the DNS cache before adblock processing starts to reduce the memory consumption.'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_lookupdomain', _('DNS Lookup Domain'), _('Domain to check for a successful DNS backend restart.'));
		o.placeholder = 'localhost';
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_dnsdir', _('DNS Directory'), _('Overwrite the default target directory for the generated blocklist.'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_dnstimeout', _('DNS Restart Timeout'), _('Timeout to wait for a successful DNS backend restart.'));
		o.placeholder = '30';
		o.datatype = 'range(5,60)';
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_jail', _('Jail Mode'), _('Only domains on the allowlist are permitted, all other DNS requests are rejected.'));
		o.rmempty = true;

		/*
			advanced report settings tab
		*/
		o = s.taboption('adv_report', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />';

		o = s.taboption('adv_report', widgets.DeviceSelect, 'adb_repiface', _('Report Interface'), _('List of available network devices used by tcpdump.'));
		o.nocreate = false;
		o.rmempty = true;

		o = s.taboption('adv_report', form.Value, 'adb_reportdir', _('Report Directory'), _('Target directory for DNS related report files.'));
		o.placeholder = '/tmp/adblock-report';
		o.rmempty = true;

		o = s.taboption('adv_report', form.Value, 'adb_repchunkcnt', _('Report Chunk Count'), _('Report chunk count used by tcpdump.'));
		o.placeholder = '5';
		o.datatype = 'range(1,10)';
		o.rmempty = true;

		o = s.taboption('adv_report', form.Value, 'adb_repchunksize', _('Report Chunk Size'), _('Report chunk size used by tcpdump in MByte.'));
		o.placeholder = '1';
		o.datatype = 'range(1,10)';
		o.rmempty = true;

		o = s.taboption('adv_report', form.DynamicList, 'adb_repport', _('Report Ports'), _('The list of ports used by tcpdump.'));
		o.datatype = 'port';
		o.placeholder = '53';
		o.multiple = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_report', form.Value, 'adb_repfilter', _('Report Filter'), _('Optional tcpdump filter expression, logically ANDed to the internal port filter.'));
		o.placeholder = 'not net 10.0.0.0/24';
		o.optional = true;
		o.rmempty = true;
		o.validate = function (section_id, value) {
			if (!value || /^[a-zA-Z0-9 \t.:/()[\]!&|<>=+*%\\-]+$/.test(value)) {
				return true;
			}
			return _('Invalid characters in the tcpdump filter expression!');
		};

		o = s.taboption('adv_report', form.Flag, 'adb_represolve', _('Resolve IPs'), _('Resolve reporting IP addresses by using reverse DNS (PTR) lookups.'));
		o.rmempty = true;

		o = s.taboption('adv_report', form.Flag, 'adb_map', _('GeoIP Map'), _('Enable a GeoIP map that shows the geographical location of the blocked domains.'));
		o.optional = true;
		o.rmempty = true;

		/*
			advanced email settings tab
		*/
		o = s.taboption('adv_email', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />';

		o = s.taboption('adv_email', form.Value, 'adb_mailsender', _('E-Mail Sender Address'), _('Sender address for adblock notification E-Mails.'));
		o.placeholder = 'no-reply@adblock';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'adb_mailtopic', _('E-Mail Topic'), _('Topic for adblock notification E-Mails.'));
		o.placeholder = 'adblock notification';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'adb_mailprofile', _('E-Mail Profile'), _('Profile used by \'msmtp\' for adblock notification E-Mails.'));
		o.placeholder = 'adb_notify';
		o.rmempty = true;

		/*
			feed selection tab
		*/
		let size, descr;
		let feeds = null;

		if (result[0] && result[0].trim() !== "") {
			try {
				feeds = JSON.parse(result[0]);
			} catch (e) {
				ui.addNotification(null, E('p', _('Unable to parse the custom feed file!')), 'error');
			}
		}
		if (!feeds && result[1] && result[1].trim() !== "") {
			try {
				feeds = JSON.parse(result[1]);
			} catch (e) {
				ui.addNotification(null, E('p', _('Unable to parse the default feed file!')), 'error');
			}
		}

		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service reload to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />'
			+ '<em style="color:#37c;font-weight:bold;">' + _('External Blocklist Feeds') + '</em>';

		if (feeds && Object.keys(feeds).length) {
			o = s.taboption('feeds', form.MultiValue, 'adb_feed', _('Blocklist Feed'));
			const feedKeys = Object.keys(feeds);
			for (const feed of feedKeys) {
				size = String(feeds[feed].size ?? '').trim() || '-';
				descr = String(feeds[feed].descr ?? '').trim() || '-';
				o.value(feed.trim(), feed.trim() + ' (' + size + ', ' + descr + ')');
			}
			o.optional = true;
			o.rmempty = true;
		}

		/*
			prepare category data
		*/
		const categories = result[2] ? result[2].trim().split('\n') : [];

		function addCategoryOptions(option, prefix) {
			for (const line of categories) {
				const cat = line.match(/^(\w+);(.*?)(?:;(.*))?$/);
				if (!cat || cat[1].trim() !== prefix) continue;
				cat[3] !== undefined
					? option.value(cat[3].trim(), cat[2].trim())
					: option.value(cat[2].trim());
			}
		}

		o = s.taboption('feeds', form.DummyValue, '_feeds1');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('1Hosts List Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_hst_feed', _('Categories'));
		addCategoryOptions(o, 'hst');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_feeds2');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('Hagezi List Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_hag_feed', _('Categories'));
		addCategoryOptions(o, 'hag');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_feeds3');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('IPFire List Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_ipf_feed', _('Categories'));
		addCategoryOptions(o, 'ipf');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_feeds4');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('StevenBlack List Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_stb_feed', _('Categories'));
		addCategoryOptions(o, 'stb');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_feeds5');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('UTCapitole Archive Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_utc_feed', _('Categories'));
		addCategoryOptions(o, 'utc');
		o.optional = true;
		o.rmempty = true;

		/*
			action buttons
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Stop',
					'click': function () {
						return handleAction('stop');
					}
				}, [_('Stop')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btn_suspend',
					'title': 'Suspend/Resume',
					'click': function () {
						return handleAction('suspend');
					}
				}, [_('Suspend')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Save & Reload',
					'click': function () {
						return handleAction('reload');
					}
				}, [_('Save & Reload')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'title': 'Save & Restart',
					'click': function () {
						return handleAction('restart');
					}
				}, [_('Save & Restart')])
			]);
		};
		return m.render();
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
