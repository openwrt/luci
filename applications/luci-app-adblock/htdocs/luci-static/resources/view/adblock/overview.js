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
		const map = document.querySelector('.cbi-map');
		return dom.callClassMethod(map, 'save')
			.then(L.bind(ui.changes.apply, ui.changes))
			.then(function () {
				document.querySelectorAll('.cbi-page-actions button').forEach(function (btn) {
					btn.disabled = true;
					btn.blur();
				});
				return fs.exec_direct('/etc/init.d/adblock', [ev]);
			})
	} else {
		if (ev !== 'stop') {
			document.querySelectorAll('.cbi-page-actions button').forEach(function (btn) {
				btn.disabled = true;
				btn.blur();
			});
			if (document.getElementById('status') &&
				document.getElementById('status').textContent.substring(0, 6) === 'paused') {
				ev = 'resume';
			}
		}
		return fs.exec_direct('/etc/init.d/adblock', [ev]);
	}
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.read_direct('/etc/adblock/adblock.custom.feeds'), ''),
			L.resolveDefault(fs.read_direct('/etc/adblock/adblock.feeds'), ''),
			L.resolveDefault(fs.read_direct('/etc/adblock/adblock.categories'), ''),
			uci.load('adblock')
		]);
	},
	render: function (result) {
		let m, s, o;

		m = new form.Map('adblock', 'Adblock', _('Configuration of the adblock package to block ad/abuse domains by using DNS. \
			For further information <a href="https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md" target="_blank" rel="noreferrer noopener" >check the online documentation</a>'));

		/*
			poll runtime information
		*/
		pollData: poll.add(function () {
			return L.resolveDefault(fs.read_direct('/var/run/adb_runtime.json'), 'null').then(function (res) {
				const status = document.getElementById('status');
				const buttons = document.querySelectorAll('.cbi-page-actions button');
				try {
					var info = JSON.parse(res);
				} catch (e) {
					status.textContent = '-';
					poll.stop();
					if (status.classList.contains('spinning')) {
						buttons.forEach(function (btn) {
							btn.disabled = false;
						})
						status.classList.remove('spinning');
					}
					ui.addNotification(null, E('p', _('Unable to parse the runtime information!')), 'error');
				}
				if (status && info) {
					status.textContent = (info.adblock_status || '-') + ' / ' + (info.adblock_version || '-');
					if (info.adblock_status === "running") {
						if (!status.classList.contains("spinning")) {
							status.classList.add("spinning");
						}
					} else {
						if (status.classList.contains("spinning")) {
							buttons.forEach(function (btn) {
								btn.disabled = false;
							})
							status.classList.remove("spinning");
							if (document.getElementById('btn_suspend')) {
								if (status.textContent.substring(0, 6) === 'paused') {
									document.querySelector('#btn_suspend').textContent = 'Resume';
								}
								if (document.getElementById('status').textContent.substring(0, 7) === 'enabled') {
									document.querySelector('#btn_suspend').textContent = 'Suspend';
								}
							}
						}
					}
					if (status.textContent.substring(0, 6) === 'paused' && document.getElementById('btn_suspend')) {
						document.querySelector('#btn_suspend').textContent = 'Resume';
					}
				} else if (status) {
					status.textContent = '-';
					poll.stop();
					if (status.classList.contains('spinning')) {
						buttons.forEach(function (btn) {
							btn.disabled = false;
						})
						status.classList.remove('spinning');
					}
				}
				var domains = document.getElementById('domains');
				if (domains && info) {
					domains.textContent = info.blocked_domains || '-';
				}
				var feeds = document.getElementById('feeds');
				var src_array = [];
				if (feeds && info) {
					for (var i = 0; i < info.active_feeds.length; i++) {
						if (i < info.active_feeds.length - 1) {
							src_array += info.active_feeds[i] + ', ';
						} else {
							src_array += info.active_feeds[i]
						}
					}
					feeds.textContent = src_array || '-';
				}
				var backend = document.getElementById('backend');
				if (backend && info) {
					backend.textContent = info.dns_backend || '-';
				}
				var ifaces = document.getElementById('ifaces');
				if (ifaces && info) {
					ifaces.textContent = info.run_ifaces || '-';
				}
				var dirs = document.getElementById('dirs');
				if (dirs && info) {
					dirs.textContent = info.run_directories || '-';
				}
				var flags = document.getElementById('flags');
				if (flags && info) {
					flags.textContent = info.run_flags || '-';
				}
				var run = document.getElementById('run');
				if (run && info) {
					run.textContent = info.last_run || '-';
				}
				var sys = document.getElementById('sys');
				if (sys && info) {
					sys.textContent = info.system_info || '-';
				}
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
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Status / Version')),
					E('div', { 'class': 'cbi-value-field spinning', 'id': 'status', 'style': 'margin-bottom:-5px;color:#37c;' }, '\xa0')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Blocked Domains')),
					E('div', { 'class': 'cbi-value-field', 'id': 'domains', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Active Feeds')),
					E('div', { 'class': 'cbi-value-field', 'id': 'feeds', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('DNS Backend')),
					E('div', { 'class': 'cbi-value-field', 'id': 'backend', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Run Interfaces')),
					E('div', { 'class': 'cbi-value-field', 'id': 'ifaces', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Run Directories')),
					E('div', { 'class': 'cbi-value-field', 'id': 'dirs', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Run Flags')),
					E('div', { 'class': 'cbi-value-field', 'id': 'flags', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Last Run')),
					E('div', { 'class': 'cbi-value-field', 'id': 'run', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('System Info')),
					E('div', { 'class': 'cbi-value-field', 'id': 'sys', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				])
			]);
		}, o, this);
		this.pollData;

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'adblock', _('Settings'));
		s.addremove = false;
		s.tab('general', _('General Settings'));
		s.tab('additional', _('Additional Settings'));
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

		o = s.taboption('general', form.Flag, 'adb_dnsforce', _('Force Local DNS'), _('Redirect all DNS queries from specified zones to the local DNS resolver, applies to UDP and TCP protocol.'));
		o.rmempty = false;

		o = s.taboption('general', widgets.ZoneSelect, 'adb_zonelist', _('Forced Zones'), _('Firewall source zones that should be forced locally.'));
		o.depends('adb_dnsforce', '1');
		o.multiple = true;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.DynamicList, 'adb_portlist', _('Forced Ports'), _('Firewall ports that should be forced locally.'));
		o.depends('adb_dnsforce', '1');
		o.multiple = true;
		o.nocreate = false;
		o.datatype = 'port';
		o.value('53');
		o.value('853');
		o.value('5353');
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_tld', _('TLD Compression'), _('The top level domain compression removes thousands of needless host entries from the final DNS blocklist.'));
		o.default = 1
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

		o = s.taboption('additional', form.Flag, 'adb_fetchinsecure', _('Download Insecure'), _('Don\'t check SSL server certificates during download.'));
		o.default = 0
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

		o = s.taboption('adv_dns', form.ListValue, 'adb_dnsinstance', _('DNS Instance'), _('Set the dns backend instance used by adblock.'));
		o.depends('adb_dns', 'dnsmasq');
		o.value('0', _('First instance (default)'));
		o.value('1', _('Second instance'));
		o.value('2', _('Third instance'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_dnstimeout', _('DNS Restart Timeout'), _('Timeout to wait for a successful DNS backend restart.'));
		o.placeholder = '20';
		o.datatype = 'range(5,60)';
		o.rmempty = true;

		o = s.taboption('adv_dns', form.DynamicList, 'adb_denyip', _('Block Local Client IPs'), _('Block all requests of certain DNS clients based on their IP address (RPZ-CLIENT-IP).'));
		o.datatype = 'or(ip4addr("nomask"),ip6addr("nomask"))';
		o.depends('adb_dns', 'bind');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_dns', form.DynamicList, 'adb_allowip', _('Allow Local Client IPs'), _('Allow all requests of certain DNS clients based on their IP address (RPZ-CLIENT-IP).'));
		o.datatype = 'or(ip4addr("nomask"),ip6addr("nomask"))';
		o.depends('adb_dns', 'bind');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_jail', _('Jail Blocklist'), _('Builds an additional restrictive DNS blocklist to block access to all domains except those listed in the allowlist. \
			You can use this restrictive blocklist e.g. for guest wifi or kidsafe configurations.'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_jaildir', _('Jail Directory'), _('Target directory for the generated jail blocklist. \
			If this directory points to your DNS directory, the jail blocklist replaces your default blocklist.'));
		o.depends('adb_jail', '1');
		o.placeholder = '/tmp';
		o.rmempty = true;

		/*
			advanced report settings tab
		*/
		o = s.taboption('adv_report', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />';

		o = s.taboption('adv_report', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>Changes on this tab needs a full adblock service restart to take effect.</b></em>';

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

		o = s.taboption('adv_report', form.Value, 'adb_replisten', _('Report Ports'), _('Space separated list of ports used by tcpdump.'));
		o.placeholder = '53';
		o.rmempty = true;

		o = s.taboption('adv_report', form.Flag, 'adb_represolve', _('Resolve IPs'), _('Resolve reporting IP addresses by using reverse DNS (PTR) lookups.'));
		o.rmempty = true;

		o = s.taboption('adv_report', form.Flag, 'adb_map', _('GeoIP Map'), _('Enable a GeoIP map that shows the geographical location of the blocked domains. This requires external requests to get the map tiles and geolocation data.'));
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
		let feed, feeds, chain, descr;
		if (result && Object.keys(result).length) {
			if (result[0]) {
				try {
					feeds = JSON.parse(result[0]);
				} catch (e) {
					ui.addNotification(null, E('p', _('Unable to parse the custom feed file!')), 'error');
				}
			}
			if (result[1] && (!feeds || (feeds && !Object.keys(feeds).length))) {
				try {
					feeds = JSON.parse(result[1]);
				} catch (e) {
					ui.addNotification(null, E('p', _('Unable to parse the default feed file!')), 'error');
				}
			}
		}
		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs an adblock service reload to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />'
			+ '<em style="color:#37c;font-weight:bold;">' + _('External Blocklist Feeds') + '</em>';

		if (feeds && Object.keys(feeds).length) {
			o = s.taboption('feeds', form.MultiValue, 'adb_feed', _('Blocklist Feed'));
			for (let i = 0; i < Object.keys(feeds).length; i++) {
				feed = Object.keys(feeds)[i].trim();
				chain = feeds[feed].size.trim() || 'in';
				descr = feeds[feed].descr.trim() || '-';
				o.value(feed, feed + ' (' + chain + ', ' + descr + ')');
			}
			o.optional = true;
			o.rmempty = true;
		}

		/*
			prepare category data
		*/
		var code, category, list, path, categories = [];
		if (result[2]) {
			categories = result[2].trim().split('\n');
		}

		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('UTCapitole Archive Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_utc_feed', _('Categories'));
		for (var i = 0; i < categories.length; i++) {
			code = categories[i].match(/^(\w+);/)[1].trim();
			if (code === 'utc') {
				category = categories[i].match(/^\w+;(.*$)/)[1].trim();
				o.value(category);
			}
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('StevenBlack List Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_stb_feed', _('Categories'));
		for (var i = 0; i < categories.length; i++) {
			code = categories[i].match(/^(\w+);/)[1].trim();
			if (code === 'stb') {
				list = categories[i].match(/^\w+;(.*);/)[1].trim();
				path = categories[i].match(/^.*;(.*$)/)[1].trim();
				o.value(path, list);
			}
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('Hagezi List Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_hag_feed', _('Categories'));
		for (var i = 0; i < categories.length; i++) {
			code = categories[i].match(/^(\w+);/)[1].trim();
			if (code === 'hag') {
				list = categories[i].match(/^\w+;(.*);/)[1].trim();
				path = categories[i].match(/^.*;(.*$)/)[1].trim();
				o.value(path, list);
			}
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('feeds', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<hr style="width: 200px; height: 1px;" /><em style="color:#37c;font-weight:bold;">' + _('1Hosts List Selection') + '</em>';

		o = s.taboption('feeds', form.DynamicList, 'adb_hst_feed', _('Categories'));
		for (var i = 0; i < categories.length; i++) {
			code = categories[i].match(/^(\w+);/)[1].trim();
			if (code === 'hst') {
				list = categories[i].match(/^\w+;(.*);/)[1].trim();
				path = categories[i].match(/^.*;(.*$)/)[1].trim();
				o.value(path, list);
			}
		}
		o.optional = true;
		o.rmempty = true;

		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'click': function () {
						return handleAction('stop');
					}
				}, [_('Stop')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply important',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btn_suspend',
					'click': function () {
						return handleAction('suspend');
					}
				}, [_('Suspend')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none;margin-right:.4em;',
					'click': function () {
						return handleAction('reload');
					}
				}, [_('Save & Reload')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'click': function () {
						handleAction('restart');
					}
				}, [_('Save & Restart')])
			])
		});
		return m.render();
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
