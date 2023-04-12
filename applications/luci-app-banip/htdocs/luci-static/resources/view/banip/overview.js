'use strict';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

function handleAction(ev) {
	fs.exec_direct('/etc/init.d/banip', [ev])
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.read_direct('/etc/banip/banip.feeds'), ''),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.countries'), ''),
			uci.load('banip')
		]);
	},

	render: function (result) {
		var m, s, o;

		m = new form.Map('banip', 'banIP', _('Configuration of the banIP package to ban incoming and outgoing ip addresses/subnets via sets in nftables. \
			For further information <a href="https://github.com/openwrt/packages/blob/master/net/banip/files/README.md" target="_blank" rel="noreferrer noopener" >check the online documentation</a>'));

		/*
			poll runtime information
		*/
		var buttons, rt_res, inf_stat, inf_version, inf_elements, inf_feeds, inf_devices, inf_subnets, inf_system, nft_infos, run_infos, inf_flags, last_run

		pollData: poll.add(function () {
			return L.resolveDefault(fs.stat('/var/run/banip.lock')).then(function (stat) {
				buttons = document.querySelectorAll('.cbi-button');
				inf_stat = document.getElementById('status');
				if (stat) {
					for (var i = 0; i < buttons.length; i++) {
						buttons[i].setAttribute('disabled', 'true');
					}
					if (inf_stat && !inf_stat.classList.contains('spinning')) {
						inf_stat.classList.add('spinning');
					}
				} else {
					for (var i = 0; i < buttons.length; i++) {
						buttons[i].removeAttribute('disabled');
					}
					if (inf_stat && inf_stat.classList.contains('spinning')) {
						inf_stat.classList.remove('spinning');
					}
				}
				L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['status'])).then(function (result) {
					if (result) {
						rt_res = result.trim().split('\n');
						if (rt_res) {
							for (var i = 0; i < rt_res.length; i++) {
								if (rt_res[i].match(/^\s+\+\sstatus\s+\:\s+(.*)$/)) {
									rt_res.status = rt_res[i].match(/^\s+\+\sstatus\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\sversion\s+\:\s+(.*)$/)) {
									rt_res.version = rt_res[i].match(/^\s+\+\sversion\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\selement_count\s+\:\s+(.*)$/)) {
									rt_res.element_count = rt_res[i].match(/^\s+\+\selement_count\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\sactive_feeds\s+\:\s+(.*)$/)) {
									rt_res.active_feeds = rt_res[i].match(/^\s+\+\sactive_feeds\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\sactive_devices\s+\:\s+(.*)$/)) {
									rt_res.active_devices = rt_res[i].match(/^\s+\+\sactive_devices\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\sactive_subnets\s+\:\s+(.*)$/)) {
									rt_res.active_subnets = rt_res[i].match(/^\s+\+\sactive_subnets\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\snft_info\s+\:\s+(.*)$/)) {
									rt_res.nft_info = rt_res[i].match(/^\s+\+\snft_info\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\srun_info\s+\:\s+(.*)$/)) {
									rt_res.run_info = rt_res[i].match(/^\s+\+\srun_info\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\srun_flags\s+\:\s+(.*)$/)) {
									rt_res.run_flags = rt_res[i].match(/^\s+\+\srun_flags\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\slast_run\s+\:\s+(.*)$/)) {
									rt_res.last_run = rt_res[i].match(/^\s+\+\slast_run\s+\:\s+(.*)$/)[1];
								} else if (rt_res[i].match(/^\s+\+\ssystem_info\s+\:\s+(.*)$/)) {
									rt_res.system_info = rt_res[i].match(/^\s+\+\ssystem_info\s+\:\s+(.*)$/)[1];
								}
							}
						}
						if (rt_res) {
							inf_stat = document.getElementById('status');
							if (inf_stat) {
								inf_stat.textContent = rt_res.status || '-';
							}
							inf_version = document.getElementById('version');
							if (inf_version) {
								inf_version.textContent = rt_res.version || '-';
							}
							inf_elements = document.getElementById('elements');
							if (inf_elements) {
								inf_elements.textContent = rt_res.element_count || '-';
							}
							inf_feeds = document.getElementById('feeds');
							if (inf_feeds) {
								inf_feeds.textContent = rt_res.active_feeds || '-';
							}
							inf_devices = document.getElementById('devices');
							if (inf_devices) {
								inf_devices.textContent = rt_res.active_devices || '-';
							}
							inf_subnets = document.getElementById('subnets');
							if (inf_subnets) {
								inf_subnets.textContent = rt_res.active_subnets || '-';
							}
							nft_infos = document.getElementById('nft');
							if (nft_infos) {
								nft_infos.textContent = rt_res.nft_info || '-';
							}
							run_infos = document.getElementById('run');
							if (run_infos) {
								run_infos.textContent = rt_res.run_info || '-';
							}
							inf_flags = document.getElementById('flags');
							if (inf_flags) {
								inf_flags.textContent = rt_res.run_flags || '-';
							}
							last_run = document.getElementById('last');
							if (last_run) {
								last_run.textContent = rt_res.last_run || '-';
							}
							inf_system = document.getElementById('system');
							if (inf_system) {
								inf_system.textContent = rt_res.system_info || '-';
							}
						}
					} else {
						inf_stat = document.getElementById('status');
						if (inf_stat) {
							inf_stat.textContent = '-';
							poll.stop();
							if (inf_stat.classList.contains('spinning')) {
								inf_stat.classList.remove('spinning');
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
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Status')),
					E('div', { 'class': 'cbi-value-field spinning', 'id': 'status', 'style': 'color:#37c' }, '\xa0')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Version')),
					E('div', { 'class': 'cbi-value-field', 'id': 'version', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Element Count')),
					E('div', { 'class': 'cbi-value-field', 'id': 'elements', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Feeds')),
					E('div', { 'class': 'cbi-value-field', 'id': 'feeds', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Devices')),
					E('div', { 'class': 'cbi-value-field', 'id': 'devices', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Subnets')),
					E('div', { 'class': 'cbi-value-field', 'id': 'subnets', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('NFT Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'nft', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'run', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Flags')),
					E('div', { 'class': 'cbi-value-field', 'id': 'flags', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Last Run')),
					E('div', { 'class': 'cbi-value-field', 'id': 'last', 'style': 'color:#37c' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('System Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'system', 'style': 'color:#37c' }, '-')
				]),
				E('div', { class: 'right' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
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
		s.tab('adv_chain', _('Chain/Set Settings'));
		s.tab('adv_log', _('Log Settings'));
		s.tab('adv_email', _('E-Mail Settings'));
		s.tab('feeds', _('Blocklist Feeds'));

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
		o.unspecified = true;
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', widgets.NetworkSelect, 'ban_ifv4', _('Network Interfaces'), _('Select the logical WAN IPv4 network interface(s).'));
		o.depends('ban_autodetect', '0');
		o.unspecified = true;
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.retain = true;

		o = s.taboption('general', widgets.NetworkSelect, 'ban_ifv6', _('Network Interfaces'), _('Select the logical WAN IPv6 network interface(s).'));
		o.depends('ban_autodetect', '0');
		o.unspecified = true;
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

		o = s.taboption('general', widgets.NetworkSelect, 'ban_trigger', _('Startup Trigger Interface'), _('List of available network interfaces to trigger the banIP start.'));
		o.unspecified = true;
		o.multiple = true;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.Value, 'ban_triggerdelay', _('Trigger Delay'), _('Additional trigger delay in seconds before banIP processing actually starts.'));
		o.placeholder = '10';
		o.datatype = 'range(1,300)';
		o.rmempty = true;

		o = s.taboption('general', form.ListValue, 'ban_triggeraction', _('Trigger Action'), _('Trigger action on ifup interface events.'));
		o.value('start', _('start (default)'));
		o.value('reload', _('reload'));
		o.value('restart', _('restart'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'ban_deduplicate', _('Deduplicate IPs'), _('Deduplicate IP addresses across all active sets and and tidy up the local blocklist.'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_loginput', _('Log WAN-Input'), _('Log suspicious incoming WAN packets (dropped).'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_logforwardwan', _('Log WAN-Forward'), _('Log suspicious forwarded WAN packets (dropped).'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_logforwardlan', _('Log LAN-Forward'), _('Log suspicious forwarded LAN packets (rejected).'));
		o.rmempty = false;

		/*
			additional settings tab
		*/
		o = s.taboption('advanced', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>' + _('Changes on this tab needs a banIP service restart to take effect.') + '</b></em>';

		o = s.taboption('advanced', form.ListValue, 'ban_nicelimit', _('Nice Level'), _('The selected priority will be used for banIP background processing.'));
		o.value('-20', _('Highest Priority'));
		o.value('-10', _('High Priority'));
		o.value('0', _('Normal Priority (default)'));
		o.value('10', _('Less Priority'));
		o.value('19', _('Least Priority'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('advanced', form.ListValue, 'ban_filelimit', _('Max Open Files'), _('Increase the maximal number of open files, e.g. to handle the amount of temporary split files while loading the sets.'));
		o.value('512', _('512'));
		o.value('1024', _('1024 (default)'));
		o.value('2048', _('2048'));
		o.value('4096', _('4096'));
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

		o = s.taboption('advanced', form.ListValue, 'ban_splitsize', _('Set Split Size'), _('Split external set loading after every n members to save RAM.'));
		o.value('256');
		o.value('512');
		o.value('1024');
		o.value('2048');
		o.value('4096');
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

		o = s.taboption('advanced', form.Flag, 'ban_reportelements', _('Report Elements'), _('List Set elements in the status and report, disable this to reduce the CPU load.'));
		o.default = 1
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'ban_fetchinsecure', _('Download Insecure'), _('Don\'t check SSL server certificates during download.'));
		o.rmempty = true;

		/*
			advanced chain/set settings tab
		*/
		o = s.taboption('adv_chain', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>' + _('Changes on this tab needs a banIP service restart to take effect.') + '</b></em>';

		o = s.taboption('adv_chain', form.ListValue, 'ban_nftpolicy', _('Set Policy'), _('Set the nft policy for banIP-related sets.'));
		o.value('memory', _('memory (default)'));
		o.value('performance', _('performance'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.ListValue, 'ban_nftpriority', _('Chain Priority'), _('Set the nft chain priority within the banIP table. Please note: lower values means higher priority.'));
		o.value('0', _('0'));
		o.value('-100', _('-100'));
		o.value('-200', _('-200 (default)'));
		o.value('-300', _('-300'));
		o.value('-400', _('-400'));
		o.optional = true;
		o.rmempty = true;

		if (result[0]) {
			var feed, feeds;
			feeds = JSON.parse(result[0]);

			o = s.taboption('adv_chain', form.MultiValue, 'ban_blockinput', _('WAN-Input Chain'), _('Limit certain feeds to the WAN-Input chain.'));
			o.value('allowlist', _('local allowlist'));
			o.value('blocklist', _('local blocklist'));
			for (var i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				o.value(feed);
			}
			o.optional = true;
			o.rmempty = true;

			o = s.taboption('adv_chain', form.MultiValue, 'ban_blockforwardwan', _('WAN-Forward Chain'), _('Limit certain feeds to the WAN-Forward chain.'));
			o.value('allowlist', _('local allowlist'));
			o.value('blocklist', _('local blocklist'));
			for (var i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				o.value(feed);
			}
			o.optional = true;
			o.rmempty = true;

			o = s.taboption('adv_chain', form.MultiValue, 'ban_blockforwardlan', _('LAN-Forward Chain'), _('Limit certain feeds to the LAN-Forward chain.'));
			o.value('allowlist', _('local allowlist'));
			o.value('blocklist', _('local blocklist'));
			for (var i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				o.value(feed);
			}
			o.optional = true;
			o.rmempty = true;
		}

		o = s.taboption('adv_chain', form.ListValue, 'ban_nftexpiry', _('Blocklist Expiry'), _('Expiry time for auto added blocklist set members.'));
		o.value('10s');
		o.value('1m');
		o.value('5m');
		o.value('1h');
		o.value('2h');
		o.optional = true;
		o.rmempty = true;

		/*
			advanced log settings tab
		*/
		o = s.taboption('adv_log', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>' + _('Changes on this tab needs a banIP service restart to take effect.') + '</b></em>';

		o = s.taboption('adv_log', form.ListValue, 'ban_nftloglevel', _('Log Level'), _('Set the syslog level for NFT logging.'));
		o.value('emerg', _('emerg'));
		o.value('alert', _('alert'));
		o.value('crit', _('crit'));
		o.value('err', _('err'));
		o.value('warn', _('warn (default)'));
		o.value('notice', _('notice'));
		o.value('info', _('info'));
		o.value('debug', _('debug'));
		o.value('audit', _('audit'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.ListValue, 'ban_loglimit', _('Log Limit'), _('Parse only the last stated number of log entries for suspicious events.'));
		o.value('50', _('50'));
		o.value('100', _('100 (default)'));
		o.value('250', _('250'));
		o.value('500', _('500'));
		o.value('1000', _('1000'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_logcount', _('Log Count'), _('Number of failed login attempts of the same IP in the log before blocking.'));
		o.placeholder = '1';
		o.datatype = 'range(1,10)';
		o.rmempty = true;

		o = s.taboption('adv_log', form.DynamicList, 'ban_logterm', _('Log Terms'), _('The default log terms / regular expressions are filtering suspicious ssh, LuCI, nginx and asterisk traffic.'));
		o.optional = true;
		o.rmempty = true;

		/*
			advanced email settings tab
		*/
		o = s.taboption('adv_email', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>' + _('To enable email notifications, set up the \'msmtp\' package and specify a vaild E-Mail receiver address.') + '</b></em>';

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
			blocklist feeds tab
		*/
		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>' + _('List of supported and fully pre-configured banIP feeds.') + '</b></em>';

		if (result[0]) {
			var focus, feed, feeds;
			feeds = JSON.parse(result[0]);

			o = s.taboption('feeds', form.MultiValue, 'ban_feed', _('Feed Selection'));
			for (var i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				focus = feeds[feed].focus.trim();
				o.value(feed, feed + ' (' + focus + ')');
			}
			o.optional = true;
			o.rmempty = true;
		}

		/*
			prepare country data
		*/
		var code, country, countries = [];
		if (result[1]) {
			countries = result[1].trim().split('\n');

			o = s.taboption('feeds', form.MultiValue, 'ban_country', _('Countries'));
			for (var i = 0; i < countries.length; i++) {
				code = countries[i].match(/^(\w+);/)[1].trim();
				country = countries[i].match(/^\w+;(.*$)/)[1].trim();
				o.value(code, country);
			}
			o.optional = true;
			o.rmempty = true;
		}

		o = s.taboption('feeds', form.DynamicList, 'ban_asn', _('ASNs'));
		o.datatype = 'uinteger';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.Flag, 'ban_autoallowlist', _('Auto Allowlist'), _('Automatically transfers uplink IPs to the banIP allowlist.'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('feeds', form.Flag, 'ban_autoblocklist', _('Auto Blocklist'), _('Automatically transfers suspicious IPs to the banIP blocklist.'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('feeds', form.Flag, 'ban_allowlistonly', _('Allowlist Only'), _('Restrict the internet access from/to a small number of secure IPs.'));
		o.rmempty = false;

		return m.render();
	},
	handleReset: null
});
