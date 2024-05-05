'use strict';
'require dom';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

/*
	button handling
*/
function handleAction(ev) {
	if (ev === 'restart' || ev === 'reload') {
		let map = document.querySelector('.cbi-map');
		return dom.callClassMethod(map, 'save')
		.then(L.bind(ui.changes.apply, ui.changes))
		.then(function() {
			return fs.exec_direct('/etc/init.d/banip', [ev]);
		});
	} else {
		return fs.exec_direct('/etc/init.d/banip', [ev]);
	}
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.read_direct('/etc/banip/banip.custom.feeds'), ''),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.feeds'), ''),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.countries'), ''),
			uci.load('banip')
		]);
	},

	render: function (result) {
		let m, s, o;

		m = new form.Map('banip', 'banIP', _('Configuration of the banIP package to ban incoming and outgoing IPs via named nftables Sets. \
			For further information please check the <a style="color:#37c;font-weight:bold;" href="https://github.com/openwrt/packages/blob/master/net/banip/files/README.md" target="_blank" rel="noreferrer noopener" >online documentation</a>'));

		/*
			poll runtime information
		*/
		let buttons, rtRes, infStat, infVer, infElements, infFeeds, infDevices, infUplink, infSystem, nftInfos, runInfos, infFlags, last_run

		pollData: poll.add(function () {
			return L.resolveDefault(fs.stat('/var/run/banip.lock')).then(function (stat) {
				buttons = document.querySelectorAll('.cbi-button');
				infStat = document.getElementById('status');
				if (stat) {
					for (let i = 0; i < buttons.length; i++) {
						buttons[i].setAttribute('disabled', 'true');
					}
					if (infStat && !infStat.classList.contains('spinning')) {
						infStat.classList.add('spinning');
					}
				} else {
					for (let i = 0; i < buttons.length; i++) {
						buttons[i].removeAttribute('disabled');
					}
					if (infStat && infStat.classList.contains('spinning')) {
						infStat.classList.remove('spinning');
					}
				}
				L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['status'])).then(function (result) {
					if (result) {
						rtRes = result.trim().split('\n');
						if (rtRes) {
							for (let i = 0; i < rtRes.length; i++) {
								if (rtRes[i].match(/^\s+\+\sstatus\s+\:\s+(.*)$/)) {
									rtRes.status = rtRes[i].match(/^\s+\+\sstatus\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\sversion\s+\:\s+(.*)$/)) {
									rtRes.version = rtRes[i].match(/^\s+\+\sversion\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\selement_count\s+\:\s+(.*)$/)) {
									rtRes.elementCount = rtRes[i].match(/^\s+\+\selement_count\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\sactive_feeds\s+\:\s+(.*)$/)) {
									rtRes.activeFeeds = rtRes[i].match(/^\s+\+\sactive_feeds\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\sactive_devices\s+\:\s+(.*)$/)) {
									rtRes.activeDevices = rtRes[i].match(/^\s+\+\sactive_devices\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\sactive_uplink\s+\:\s+(.*)$/)) {
									rtRes.activeUplink = rtRes[i].match(/^\s+\+\sactive_uplink\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\snft_info\s+\:\s+(.*)$/)) {
									rtRes.nftInfo = rtRes[i].match(/^\s+\+\snft_info\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\srun_info\s+\:\s+(.*)$/)) {
									rtRes.runInfo = rtRes[i].match(/^\s+\+\srun_info\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\srun_flags\s+\:\s+(.*)$/)) {
									rtRes.runFlags = rtRes[i].match(/^\s+\+\srun_flags\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\slast_run\s+\:\s+(.*)$/)) {
									rtRes.lastRun = rtRes[i].match(/^\s+\+\slast_run\s+\:\s+(.*)$/)[1];
								} else if (rtRes[i].match(/^\s+\+\ssystem_info\s+\:\s+(.*)$/)) {
									rtRes.systemInfo = rtRes[i].match(/^\s+\+\ssystem_info\s+\:\s+(.*)$/)[1];
								}
							}
						}
						if (rtRes) {
							infStat = document.getElementById('status');
							if (infStat) {
								infStat.textContent = rtRes.status || '-';
							}
							infVer = document.getElementById('version');
							if (infVer) {
								infVer.textContent = rtRes.version || '-';
							}
							infElements = document.getElementById('elements');
							if (infElements) {
								infElements.textContent = rtRes.elementCount || '-';
							}
							infFeeds = document.getElementById('feeds');
							if (infFeeds) {
								infFeeds.textContent = rtRes.activeFeeds || '-';
							}
							infDevices = document.getElementById('devices');
							if (infDevices) {
								infDevices.textContent = rtRes.activeDevices || '-';
							}
							infUplink = document.getElementById('uplink');
							if (infUplink) {
								infUplink.textContent = rtRes.activeUplink || '-';
							}
							nftInfos = document.getElementById('nft');
							if (nftInfos) {
								nftInfos.textContent = rtRes.nftInfo || '-';
							}
							runInfos = document.getElementById('run');
							if (runInfos) {
								runInfos.textContent = rtRes.runInfo || '-';
							}
							infFlags = document.getElementById('flags');
							if (infFlags) {
								infFlags.textContent = rtRes.runFlags || '-';
							}
							last_run = document.getElementById('last');
							if (last_run) {
								last_run.textContent = rtRes.lastRun || '-';
							}
							infSystem = document.getElementById('system');
							if (infSystem) {
								infSystem.textContent = rtRes.systemInfo || '-';
							}
						}
					} else {
						infStat = document.getElementById('status');
						if (infStat) {
							infStat.textContent = '-';
							poll.stop();
							if (infStat.classList.contains('spinning')) {
								infStat.classList.remove('spinning');
							}
						}
					}
				});
			});
		}, 2);

		/*
			runtime information and buttons
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function (view, section_id) {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Information')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Status')),
					E('div', { 'class': 'cbi-value-field spinning', 'id': 'status', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '\xa0')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Version')),
					E('div', { 'class': 'cbi-value-field', 'id': 'version', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Element Count')),
					E('div', { 'class': 'cbi-value-field', 'id': 'elements', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Active Feeds')),
					E('div', { 'class': 'cbi-value-field', 'id': 'feeds', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Active Devices')),
					E('div', { 'class': 'cbi-value-field', 'id': 'devices', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Active Uplink')),
					E('div', { 'class': 'cbi-value-field', 'id': 'uplink', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('NFT Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'nft', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Run Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'run', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Run Flags')),
					E('div', { 'class': 'cbi-value-field', 'id': 'flags', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('Last Run')),
					E('div', { 'class': 'cbi-value-field', 'id': 'last', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;font-weight:bold;padding-top:0rem;' }, _('System Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'system', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, '-')
				]),
				E('div', { class: 'right' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, function () {
							return handleAction('lookup');
						})
					}, [_('Domain Lookup')]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, function () {
							return handleAction('stop');
						})
					}, [_('Stop')]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, function () {
							return handleAction('reload');
						})
					}, [_('Reload')]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, function () {
							return handleAction('restart');
						})
					}, [_('Restart')])
				])
			]);
		}, o, this);
		this.pollData;

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'banip', _('Settings'));
		s.addremove = false;
		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('adv_chain', _('Table/Chain Settings'));
		s.tab('adv_set', _('Feed/Set Settings'));
		s.tab('adv_log', _('Log Settings'));
		s.tab('adv_email', _('E-Mail Settings'));
		s.tab('feeds', _('Feed Selection'));

		/*
			general settings tab
		*/
		o = s.taboption('general', form.Flag, 'ban_enabled', _('Enabled'), _('Enable the banIP service.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_debug', _('Verbose Debug Logging'), _('Enable verbose debug logging in case of processing errors.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_autodetect', _('Auto Detection'), _('Detect relevant network devices, interfaces, subnets, protocols and utilities automatically.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_protov4', _('IPv4 Support'), _('Enables IPv4 support.'));
		o.depends('ban_autodetect', '0');
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', form.Flag, 'ban_protov6', _('IPv6 Support'), _('Enables IPv6 support.'));
		o.depends('ban_autodetect', '0');
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', widgets.DeviceSelect, 'ban_dev', _('Network Devices'), _('Select the WAN network device(s).'));
		o.depends('ban_autodetect', '0');
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', widgets.NetworkSelect, 'ban_ifv4', _('IPv4 Network Interfaces'), _('Select the logical WAN IPv4 network interface(s).'));
		o.depends('ban_autodetect', '0');
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', widgets.NetworkSelect, 'ban_ifv6', _('IPv6 Network Interfaces'), _('Select the logical WAN IPv6 network interface(s).'));
		o.depends('ban_autodetect', '0');
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', form.ListValue, 'ban_fetchcmd', _('Download Utility'), _('Select one of the pre-configured download utilities.'));
		o.depends('ban_autodetect', '0');
		o.value('uclient-fetch');
		o.value('wget');
		o.value('curl');
		o.value('aria2c');
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', form.Value, 'ban_fetchparm', _('Download Parameters'), _('Override the pre-configured download options for the selected download utility.'))
		o.depends('ban_autodetect', '0');
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', widgets.NetworkSelect, 'ban_trigger', _('Reload Trigger Interface'), _('List of available reload trigger interface(s).'));
		o.multiple = true;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.Value, 'ban_triggerdelay', _('Trigger Delay'), _('Additional trigger delay in seconds during interface reload and boot.'));
		o.placeholder = '10';
		o.datatype = 'range(1,300)';
		o.rmempty = true;

		o = s.taboption('general', form.ListValue, 'ban_fetchretry', _('Download Retries'), _('Number of download attempts in case of an error (not supported by uclient-fetch).'));
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

		o = s.taboption('general', form.Flag, 'ban_fetchinsecure', _('Download Insecure'), _('Don\'t check SSL server certificates during download.'));
		o.rmempty = true;

		/*
			additional settings tab
		*/
		o = s.taboption('advanced', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs a banIP service restart to take effect.') + '</em>';

		o = s.taboption('advanced', form.ListValue, 'ban_nicelimit', _('Nice Level'), _('The selected priority will be used for banIP background processing.'));
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

		o = s.taboption('advanced', form.ListValue, 'ban_filelimit', _('Max Open Files'), _('Increase the maximal number of open files, e.g. to handle the amount of temporary split files while loading the Sets.'));
		o.value('512');
		o.value('1024');
		o.value('2048');
		o.value('4096');
		o.default = '1024';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('advanced', form.ListValue, 'ban_cores', _('CPU Cores'), _('Limit the cpu cores used by banIP to save RAM.'));
		o.value('1');
		o.value('2');
		o.value('4');
		o.value('8');
		o.value('16');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('advanced', form.ListValue, 'ban_splitsize', _('Set Split Size'), _('Split external Set loading after every n members to save RAM.'));
		o.value('512');
		o.value('1024');
		o.value('2048');
		o.value('4096');
		o.value('8192');
		o.value('16384');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'ban_basedir', _('Base Directory'), _('Base working directory while banIP processing.'));
		o.placeholder = '/tmp';
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'ban_backupdir', _('Backup Directory'), _('Target directory for compressed feed backups.'));
		o.placeholder = '/tmp/banIP-backup';
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'ban_reportdir', _('Report Directory'), _('Target directory for banIP-related report files.'));
		o.placeholder = '/tmp/banIP-report';
		o.rmempty = true;

		o = s.taboption('advanced', form.Flag, 'ban_deduplicate', _('Deduplicate IPs'), _('Deduplicate IP addresses across all active Sets and tidy up the local blocklist.'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'ban_reportelements', _('Report Elements'), _('List Set elements in the status and report, disable this to reduce the CPU load.'));
		o.default = 1
		o.optional = true;

		/*
			advanced chain settings tab
		*/
		o = s.taboption('adv_chain', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs a banIP service restart to take effect.') + '</em>';

		o = s.taboption('adv_chain', form.ListValue, 'ban_nftpriority', _('Chain Priority'), _('Set the nft chain priority within the banIP table, lower values means higher priority.'));
		o.value('10');
		o.value('0');
		o.value('-100');
		o.value('-150');
		o.value('-200');
		o.default = '-100';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.Value, 'ban_allowflag', _('Allow Protocol/Ports'), _('Always allow a protocol \(tcp/udp\) with certain ports or port ranges in WAN-Input and WAN-Forward chain.'));
		o.placeholder = 'tcp 80 443-445';
		o.rmempty = true;

		o = s.taboption('adv_chain', widgets.DeviceSelect, 'ban_vlanallow', _('Allow VLAN Forwards'), _('Always allow certain VLAN forwards.'));
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', widgets.DeviceSelect, 'ban_vlanblock', _('Block VLAN Forwards'), _('Always block certain VLAN forwards.'));
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.ListValue, 'ban_icmplimit', _('ICMP-Threshold'), _('ICMP-Threshold in packets per second to prevent WAN-DDoS attacks. To disable this safeguard set it to \'0\'.'));
		o.value('0');
		o.value('10');
		o.value('50');
		o.value('100');
		o.value('250');
		o.value('500');
		o.value('1000');
		o.default = '10';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.ListValue, 'ban_synlimit', _('SYN-Threshold'), _('SYN-Threshold in packets per second to prevent WAN-DDoS attacks. To disable this safeguard set it to \'0\'.'));
		o.value('0');
		o.value('10');
		o.value('50');
		o.value('100');
		o.value('250');
		o.value('500');
		o.value('1000');
		o.default = '10';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.ListValue, 'ban_udplimit', _('UDP-Threshold'), _('UDP-Threshold in packets per second to prevent WAN-DDoS attacks. To disable this safeguard set it to \'0\'.'));
		o.value('0');
		o.value('100');
		o.value('250');
		o.value('500');
		o.value('1000');
		o.value('2500');
		o.value('5000');
		o.default = '100';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		/*
			advanced Set settings tab
		*/
		o = s.taboption('adv_set', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs a banIP service restart to take effect.') + '</em>';

		o = s.taboption('adv_set', form.ListValue, 'ban_nftpolicy', _('Set Policy'), _('Set the nft policy for banIP-related Sets.'));
		o.value('memory', _('memory'));
		o.value('performance', _('performance'));
		o.default = 'memory';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_set', form.ListValue, 'ban_blocktype', _('Block Type'), _('Drop packets silently or actively reject the traffic on WAN-Input and WAN-Forward chains.'));
		o.value('drop', _('drop'));
		o.value('reject', _('reject'));
		o.default = 'drop';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_set', form.ListValue, 'ban_blockpolicy', _('Default Block Policy'), _('By default each feed is active in all supported chains. Limit the default block policy to a certain chain.'));
		o.value('input', _('WAN-Input Chain'));
		o.value('forwardwan', _('WAN-Forward Chain'));
		o.value('forwardlan', _('LAN-Forward Chain'));
		o.optional = true;
		o.rmempty = true;

		let feed, feeds, descr;
		if (result[0]) {
			try {
				feeds = JSON.parse(result[0]);
			} catch (e) {
				feeds = "";
				ui.addNotification(null, E('p', _('Unable to parse the custom feed file!')), 'error');
			}
		} else if (result[1]) {
			try {
				feeds = JSON.parse(result[1]);
			} catch (e) {
				feeds = "";
				ui.addNotification(null, E('p', _('Unable to parse the default feed file!')), 'error');
			}
		}
		if (feeds) {
			o = s.taboption('adv_set', form.MultiValue, 'ban_blockinput', _('WAN-Input Chain'), _('Limit certain feeds to the WAN-Input chain.'));
			o.value('allowlist', _('local allowlist'));
			o.value('blocklist', _('local blocklist'));
			for (let i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				o.value(feed);
			}
			o.optional = true;
			o.rmempty = true;

			o = s.taboption('adv_set', form.MultiValue, 'ban_blockforwardwan', _('WAN-Forward Chain'), _('Limit certain feeds to the WAN-Forward chain.'));
			o.value('allowlist', _('local allowlist'));
			o.value('blocklist', _('local blocklist'));
			for (let i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				o.value(feed);
			}
			o.optional = true;
			o.rmempty = true;

			o = s.taboption('adv_set', form.MultiValue, 'ban_blockforwardlan', _('LAN-Forward Chain'), _('Limit certain feeds to the LAN-Forward chain.'));
			o.value('allowlist', _('local allowlist'));
			o.value('blocklist', _('local blocklist'));
			for (let i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				o.value(feed);
			}
			o.optional = true;
			o.rmempty = true;
		}

		/*
			advanced log settings tab
		*/
		o = s.taboption('adv_log', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs a banIP service restart to take effect.') + '</em>';

		o = s.taboption('adv_log', form.ListValue, 'ban_nftloglevel', _('NFT Log Level'), _('Set the syslog level for NFT logging.'));
		o.value('emerg', _('emerg'));
		o.value('alert', _('alert'));
		o.value('crit', _('crit'));
		o.value('err', _('err'));
		o.value('warn', _('warn'));
		o.value('notice', _('notice'));
		o.value('info', _('info'));
		o.value('debug', _('debug'));
		o.default = 'warn';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.Flag, 'ban_logprerouting', _('Log Prerouting'), _('Log suspicious Prerouting packets.'));
		o.rmempty = false;

		o = s.taboption('adv_log', form.Flag, 'ban_loginput', _('Log WAN-Input'), _('Log suspicious incoming WAN packets.'));
		o.rmempty = false;

		o = s.taboption('adv_log', form.Flag, 'ban_logforwardwan', _('Log WAN-Forward'), _('Log suspicious forwarded WAN packets.'));
		o.rmempty = false;

		o = s.taboption('adv_log', form.Flag, 'ban_logforwardlan', _('Log LAN-Forward'), _('Log suspicious forwarded LAN packets.'));
		o.rmempty = false;

		o = s.taboption('adv_log', form.Value, 'ban_logreadfile', _('Logfile Location'), _('Location for parsing the log file, e.g. via syslog-ng, to deactivate the standard parsing via logread.'));
		o.placeholder = '/var/log/messages';
		o.rmempty = true;

		o = s.taboption('adv_log', form.ListValue, 'ban_loglimit', _('Log Limit'), _('Parse only the last stated number of log entries for suspicious events. To disable the log monitor at all set it to \'0\'.'));
		o.value('0');
		o.value('50');
		o.value('100');
		o.value('250');
		o.value('500');
		o.value('1000');
		o.default = '100';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_logcount', _('Log Count'), _('Number of failed login attempts of the same IP in the log before blocking.'));
		o.placeholder = '1';
		o.datatype = 'range(1,10)';
		o.rmempty = true;

		o = s.taboption('adv_log', form.DynamicList, 'ban_logterm', _('Log Terms'), _('The default regular expressions are filtering suspicious ssh, LuCI, nginx and asterisk traffic.'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.Flag, 'ban_remotelog', _('Enable Remote Logging'), _('Enable the cgi interface to receive remote logging events.'));
		o.default = 0
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_remotetoken', _('Remote Token'), _('Token to communicate with the cgi interface.'));
		o.depends('ban_remotelog', '1');
		o.datatype = 'and(minlength(3),maxlength(20))';
		o.validate = function (section_id, value) {
			if (!value) {
				return _('Empty field not allowed');
			}
			if (!value.match(/^[A-Za-z0-9\.\:]+$/)) {
				return _('Invalid characters');
			}
			return true;
		}
		o.optional = true;
		o.rmempty = true;

		/*
			advanced email settings tab
		*/
		o = s.taboption('adv_email', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('To enable email notifications, set up the \'msmtp\' package and specify a vaild E-Mail receiver address.') + '</em>';

		o = s.taboption('adv_email', form.Flag, 'ban_mailnotification', _('E-Mail Notification'), _('Receive E-Mail notifications with every banIP run.'));
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'ban_mailreceiver', _('E-Mail Receiver Address'), _('Receiver address for banIP notification E-Mails, this information is required to enable E-Mail functionality.'));
		o.placeholder = 'name@example.com';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'ban_mailsender', _('E-Mail Sender Address'), _('Sender address for banIP notification E-Mails.'));
		o.placeholder = 'no-reply@banIP';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'ban_mailtopic', _('E-Mail Topic'), _('Topic for banIP notification E-Mails.'));
		o.placeholder = 'banIP notification';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'ban_mailprofile', _('E-Mail Profile'), _('Profile used by \'msmtp\' for banIP notification E-Mails.'));
		o.placeholder = 'ban_notify';
		o.datatype = 'uciname';
		o.rmempty = true;

		/*
			feeds tab
		*/
		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('External Blocklist Feeds') + '</em>';

		if (feeds) {
			o = s.taboption('feeds', form.MultiValue, 'ban_feed', _('Blocklist Feed'));
			for (let i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				descr = feeds[feed].descr.trim() || '-';
				o.value(feed, feed + ' (' + descr + ')');
			}
			o.optional = true;
			o.rmempty = true;
		}

		let err, ccode, rir, country, countries = [];
		if (result[2]) {
			countries = result[2].trim().split('\n');

			o = s.taboption('feeds', form.MultiValue, 'ban_country', _('Countries') + ' (<abbr title="Regional Internet Registries">RIR</abbr>)');
			for (let i = 0; i < countries.length; i++) {
				try {
					ccode = countries[i].match(/^(\w+)\t/)[1].trim();
					rir = countries[i].match(/^\w+\t(\w+)\t/)[1].trim();
					country = countries[i].match(/^\w+\t\w+\t(.*$)/)[1].trim();
					o.value(ccode, country + ' (' + rir + ')');
				} catch (e) {
					countries[i] = "";
					if (!err) {
						ui.addNotification(null, E('p', _('Unable to parse the countries file!')), 'error');
					}
					err = e;
				}
			}
			o.optional = true;
			o.rmempty = true;
		}

		o = s.taboption('feeds', form.MultiValue, 'ban_region', _('Regional Internet Registry'));
		o.value('AFRINIC', _('AFRINIC - serving Africa and the Indian Ocean region'));
		o.value('APNIC', _('APNIC - serving the Asia Pacific region'));
		o.value('ARIN', _('ARIN - serving Canada and the United States'));
		o.value('LACNIC', _('LACNIC - serving the Latin American and Caribbean region'));
		o.value('RIPE', _('RIPE - serving Europe, Middle East and Central Asia'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DynamicList, 'ban_asn', _('ASNs'));
		o.datatype = 'uinteger';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_feeds');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('External Allowlist Feeds') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'ban_allowurl', _('Allowlist Feed URLs'));
		if (countries) {
			for (let i = 0; i < countries.length; i++) {
				try {
					ccode = countries[i].match(/^(\w+)\t/)[1].trim();
					rir = countries[i].match(/^\w+\t(\w+)\t/)[1].trim();
					country = countries[i].match(/^\w+\t\w+\t(.*$)/)[1].trim();
					o.value('https://www.ipdeny.com/ipblocks/data/aggregated/' + ccode + '-aggregated.zone', country + ' IPv4 (' + rir + ')');
					o.value('https://www.ipdeny.com/ipv6/ipaddresses/aggregated/' + ccode + '-aggregated.zone', country + ' IPv6 (' + rir + ')');
				} catch (e) {
					countries[i] = "";
				}
			}
		}
		o.optional = true;
		o.rmempty = true;
		o.validate = function (section_id, value) {
			if (!value) {
				return true;
			}
			if (!value.match(/^(http:\/\/|https:\/\/)[A-Za-z0-9\/\.\-_\?\&\+=:~#]+$/)) {
				return _('Protocol/URL format not supported');
			}
			return true;
		}

		o = s.taboption('feeds', form.DummyValue, '_feeds');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('Local Feed Settings') + '</em>';

		o = s.taboption('feeds', form.Flag, 'ban_autoallowlist', _('Auto Allowlist'), _('Automatically add resolved domains and uplink IPs to the local banIP allowlist.'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('feeds', form.ListValue, 'ban_autoallowuplink', _('Auto Allow Uplink'), _('Limit the uplink autoallow function.'));
		o.depends('ban_autoallowlist', '1');
		o.value('disable', _('Disable'));
		o.value('subnet', _('Subnet'));
		o.value('ip', _('IP'));
		o.default = 'subnet';
		o.placeholder = _('-- default --');
		o.create = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.Flag, 'ban_autoblocklist', _('Auto Blocklist'), _('Automatically add resolved domains and suspicious IPs to the local banIP blocklist.'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('feeds', form.Flag, 'ban_autoblocksubnet', _('Auto Block Subnet'), _('Automatically add entire subnets to the blocklist Set based on an additional RDAP request with the suspicious IP.'));
		o.default = 0
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.ListValue, 'ban_nftexpiry', _('Blocklist Set Expiry'), _('Expiry time for auto added blocklist Set members.'));
		o.value('10s');
		o.value('1m');
		o.value('5m');
		o.value('1h');
		o.value('2h');
		o.value('1d');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.Flag, 'ban_allowlistonly', _('Allowlist Only'), _('Restrict the internet access from/to a small number of secure IPs.'));
		o.rmempty = false;

		return m.render();
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
