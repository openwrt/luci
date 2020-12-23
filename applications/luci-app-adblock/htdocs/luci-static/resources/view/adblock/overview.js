'use strict';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

/*
	button handling
*/
async function handleAction(ev) {
	if (ev === 'timer') {
		L.ui.showModal(_('Refresh Timer'), [
			E('p', _('To keep your adblock lists up-to-date, you should setup an automatic update job for these lists.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('h5', _('Existing job(s)')),
				E('textarea', {
					'id': 'cronView',
					'style': 'width: 100% !important; padding: 5px; font-family: monospace',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': 5
				})
			]),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em' }, [
				E('h5', _('Set/Replace a new adblock job')),
				E('select', { 'class': 'cbi-input-select', 'id': 'timerA' }, [
					E('option', { 'value': 'start' }, 'Start'),
					E('option', { 'value': 'reload' }, 'Reload'),
					E('option', { 'value': 'restart' }, 'Restart')
				]),
				'\xa0\xa0\xa0',
				_('Adblock action')
				]),
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
				E('input', { 'class': 'cbi-input-text', 'id': 'timerH', 'maxlength': '2' }, [
				]),
				'\xa0\xa0\xa0',
				_('The hours portition (req., range: 0-23)')
				]),
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
				E('input', { 'class': 'cbi-input-text', 'id': 'timerM', 'maxlength': '2' }),
				'\xa0\xa0\xa0',
				_('The minutes portion (opt., range: 0-59)')
				]),
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
				E('input', { 'class': 'cbi-input-text', 'id': 'timerD', 'maxlength': '13' }),
				'\xa0\xa0\xa0',
				_('The day of the week (opt., values: 1-7 possibly sep. by , or -)')
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function(ev) {
						var action  = document.getElementById('timerA').value;
						var hours   = document.getElementById('timerH').value;
						var minutes = document.getElementById('timerM').value || '0';
						var days    = document.getElementById('timerD').value || '*';
						if (hours) {
							L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['timer', action, hours, minutes, days]))
							.then(function(res) {
								if (res) {
									ui.addNotification(null, E('p', _('The Refresh Timer could not been updated.')), 'error');
								} else {
									ui.addNotification(null, E('p', _('The Refresh Timer has been updated.')), 'info');
								}
							});
						} else {
							document.getElementById('timerH').focus();
							return
						}
						L.hideModal();
					})
				}, _('Save'))
			])
		]);
		L.resolveDefault(fs.read_direct('/etc/crontabs/root'), ' ')
		.then(function(res) {
			document.getElementById('cronView').value = res.trim();
		});
		document.getElementById('timerH').focus();
		return
	}

	if (ev === 'suspend') {
		if (document.getElementById('status') && document.getElementById('btn_suspend') && document.getElementById('status').textContent.substr(0,6) === 'paused') {
			document.querySelector('#btn_suspend').textContent = 'Suspend';
			ev = 'resume';
		} else if (document.getElementById('status') && document.getElementById('btn_suspend')) {
			document.querySelector('#btn_suspend').textContent = 'Resume';
		}
	}

	L.Poll.start();
	fs.exec_direct('/etc/init.d/adblock', [ev])
	var running = 1;
	while (running === 1) {
		await new Promise(r => setTimeout(r, 1000));
		L.resolveDefault(fs.read_direct('/var/run/adblock.pid')).then(function(res) {
			if (!res) {
				running = 0;
			}
		})
	}
	L.Poll.stop();
}

return L.view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['list']), {}),
			uci.load('adblock')
		]);
	},

	render: function(result) {
		var m, s, o;

		m = new form.Map('adblock', 'Adblock', _('Configuration of the adblock package to block ad/abuse domains by using DNS. \
			For further information <a href="https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md" target="_blank" rel="noreferrer noopener" >check the online documentation</a>'));

		/*
			poll runtime information
		*/
		pollData: L.Poll.add(function() {
			return L.resolveDefault(fs.read_direct('/tmp/adb_runtime.json'), 'null').then(function(res) {
				var info = JSON.parse(res);
				var status = document.getElementById('status');
				if (status && info) {
					status.textContent = (info.data.adblock_status || '-') + ' / ' + (info.data.adblock_version || '-');
					if (info.data.adblock_status === "running") {
						if (!status.classList.contains("spinning")) {
							status.classList.add("spinning");
						}
					} else {
						if (status.classList.contains("spinning")) {
							status.classList.remove("spinning");
							L.Poll.stop();
						}
					}
					if (status.textContent.substr(0,6) === 'paused' && document.getElementById('btn_suspend')) {
						document.querySelector('#btn_suspend').textContent = 'Resume';
					}
				} else if (status) {
					status.textContent = '-';
					if (status.classList.contains("spinning")) {
						status.classList.remove("spinning");
					}
				}
				var domains = document.getElementById('domains');
				if (domains && info) {
					domains.textContent = parseInt(info.data.blocked_domains, 10).toLocaleString() || '-';
				}
				var sources = document.getElementById('sources');
				var src_array = [];
				if (sources && info) {
					for (var i = 0; i < info.data.active_sources.length; i++) {
						if (i < info.data.active_sources.length-1) {
							src_array += info.data.active_sources[i].source + ', ';
						} else {
							src_array += info.data.active_sources[i].source
						}
					}
					sources.textContent = src_array || '-';
				}
				var backend = document.getElementById('backend');
				if (backend && info) {
					backend.textContent = info.data.dns_backend || '-';
				}
				var utils = document.getElementById('utils');
				if (utils && info) {
					utils.textContent = info.data.run_utils || '-';
				}
				var ifaces = document.getElementById('ifaces');
				if (ifaces && info) {
					ifaces.textContent = info.data.run_ifaces || '-';
				}
				var dirs = document.getElementById('dirs');
				if (dirs && info) {
					dirs.textContent = info.data.run_directories || '-';
				}
				var flags = document.getElementById('flags');
				if (flags && info) {
					flags.textContent = info.data.run_flags || '-';
				}
				var run = document.getElementById('run');
				if (run && info) {
					run.textContent = info.data.last_run || '-';
				}
			});
		}, 1);

		/*
			runtime information and buttons
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function(view, section_id) {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Information')), 
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Status / Version')),
				E('div', { 'class': 'cbi-value-field spinning', 'id': 'status', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'\xa0')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Blocked Domains')),
				E('div', { 'class': 'cbi-value-field', 'id': 'domains', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Sources')),
				E('div', { 'class': 'cbi-value-field', 'id': 'sources', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('DNS Backend')),
				E('div', { 'class': 'cbi-value-field', 'id': 'backend', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Utils')),
				E('div', { 'class': 'cbi-value-field', 'id': 'utils', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Interfaces')),
				E('div', { 'class': 'cbi-value-field', 'id': 'ifaces', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Directories')),
				E('div', { 'class': 'cbi-value-field', 'id': 'dirs', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Flags')),
				E('div', { 'class': 'cbi-value-field', 'id': 'flags', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Last Run')),
				E('div', { 'class': 'cbi-value-field', 'id': 'run', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { class: 'right' }, [
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('timer');
						})
					}, [ _('Refresh Timer...') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'id': 'btn_suspend',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('suspend');
						})
					}, [ _('Suspend') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('reload');
						})
					}, [ _('Refresh') ])
				])
			]);
		}, o, this);
		this.pollData;

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'adblock', _('Settings'));
		s.addremove = false;
		s.tab('general',  _('General Settings'));
		s.tab('additional', _('Additional Settings'));
		s.tab('adv_dns', _('Advanced DNS Settings'));
		s.tab('adv_report', _('Advanced Report Settings'), _('Changes on this tab needs a full adblock service restart to take effect.<br /><p>&#xa0;</p>'));
		s.tab('adv_email', _('Advanced E-Mail Settings'));
		s.tab('sources', _('Blocklist Sources'), _('List of supported and fully pre-configured adblock sources, already active sources are pre-selected.<br /> \
			<b><em>To avoid OOM errors, please do not select too many lists!</em></b><br /> \
			List size information with the respective domain ranges as follows:<br /> \
			&#8226;&#xa0;<b>S</b> (-10k), <b>M</b> (10k-30k) and <b>L</b> (30k-80k) should work for 128 MByte devices,<br /> \
			&#8226;&#xa0;<b>XL</b> (80k-200k) should work for 256-512 MByte devices,<br /> \
			&#8226;&#xa0;<b>XXL</b> (200k-) needs more RAM and Multicore support, e.g. x86 or raspberry devices.<br /> \
			<p>&#xa0;</p>'));

		/*
			general settings tab
		*/
		o = s.taboption('general', form.Flag, 'adb_enabled', _('Enabled'), _('Enable the adblock service.'));
		o.rmempty = false;

		o = s.taboption('general', widgets.NetworkSelect, 'adb_trigger', _('Startup Trigger Interface'), _('List of available network interfaces to trigger the adblock start. \
			Choose \'unspecified\' to use a classic startup timeout instead of a network trigger.'));
		o.unspecified = true;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_forcedns', _('Force Local DNS'), _('Redirect all DNS queries from \'lan\' zone to the local DNS resolver, applies to UDP and TCP protocol.'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'adb_portlist', _('Local DNS Ports'), _('Space separated list of DNS-related firewall ports which should be forced locally.'));
		o.depends('adb_forcedns', '1');
		o.placeholder = '53 853 5353';
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_safesearch', _('Enable SafeSearch'), _('Enforcing SafeSearch for google, bing, duckduckgo, yandex, youtube and pixabay.'));
		o.rmempty = false;

		o = s.taboption('general', form.MultiValue, 'adb_safesearchlist', _('Limit SafeSearch'), _('Limit SafeSearch to certain providers.'));
		o.depends('adb_safesearch', '1');
		o.value('google');
		o.value('bing');
		o.value('yandex');
		o.value('youtube');
		o.value('pixabay');
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_safesearchmod', _('Relax SafeSearch'), _('Enable moderate SafeSearch filters for youtube.'));
		o.depends('adb_safesearch', '1');
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'adb_report', _('DNS Report'), _('Gather DNS related network traffic via tcpdump and provide a DNS Report on demand. \
			Please note: this needs additional \'tcpdump-mini\' package installation and a full adblock service restart to take effect.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'adb_mail', _('E-Mail Notification'), _('Send adblock related notification e-mails. \
			Please note: this needs additional \'msmtp\' package installation.'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'adb_mailreceiver', _('E-Mail Receiver Address'), _('Receiver address for adblock notification e-mails.'));
		o.depends('adb_mail', '1');
		o.placeholder = 'name@example.com';
		o.rmempty = true;

		/*
			additional settings tab
		*/
		o = s.taboption('additional', form.Flag, 'adb_debug', _('Verbose Debug Logging'), _('Enable verbose debug logging in case of any processing errors.'));
		o.rmempty = false;

		o = s.taboption('additional', form.Flag, 'adb_nice', _('Low Priority Service'), _('Reduce the priority of the adblock background processing to take fewer resources from the system. \
			Please note: This change requires a full adblock service restart to take effect.'));
		o.enabled = '10';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'adb_triggerdelay', _('Trigger Delay'), _('Additional trigger delay in seconds before adblock processing begins.'));
		o.placeholder = '2';
		o.datatype = 'range(1,120)';
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'adb_maxqueue', _('Download Queue'), _('Size of the download queue for download processing (incl. sorting, merging etc.) in parallel.'));
		o.value('1');
		o.value('2');
		o.value('4');
		o.value('8');
		o.value('16');
		o.value('32');
		o.rmempty = false;

		o = s.taboption('additional', form.Value, 'adb_tmpbase', _('Base Temp Directory'), _('Base Temp Directory for all adblock related runtime operations, \
			e.g. downloading, sorting, merging etc.'));
		o.placeholder = '/tmp';
		o.rmempty = true;

		o = s.taboption('additional', form.Flag, 'adb_backup', _('Blocklist Backup'), _('Create compressed blocklist backups, they will be used in case of download errors or during startup.'));
		o.default = 1
		o.rmempty = false;

		o = s.taboption('additional', form.Value, 'adb_backupdir', _('Backup Directory'), _('Target directory for blocklist backups. \
			Default is \'/tmp\', please use preferably an usb stick or another local disk.'));
		o.depends('adb_backup', '1');
		o.placeholder = '/tmp';
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'adb_fetchutil', _('Download Utility'), _('List of supported and fully pre-configured download utilities.'));
		o.value('', _('- unspecified -'));
		o.value('uclient-fetch');
		o.value('wget');
		o.value('curl');
		o.value('aria2c');
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'adb_fetchparm', _('Download Parameters'), _('Special config options for the selected download utility.'))
		o.rmempty = true;

		/*
			advanced dns settings tab
		*/
		o = s.taboption('adv_dns', form.ListValue, 'adb_dns', _('DNS Backend'), _('List of supported DNS backends with their default list directory. \
			To overwrite the default path use the \'DNS Directory\' option.'));
		o.value('', _('- unspecified -'));
		o.value('dnsmasq', _('dnsmasq (/tmp/dnsmasq.d)'));
		o.value('unbound', _('unbound (/var/lib/unbound)'));
		o.value('named', _('named (/var/lib/bind)'));
		o.value('kresd', _('kresd (/etc/kresd)'));
		o.value('raw', _('raw (/tmp)'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_dnsdir', _('DNS Directory'), _('Target directory for the generated blocklist \'adb_list.overall\'.'));
		o.placeholder = '/tmp';
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_dnstimeout', _('DNS Restart Timeout'), _('Timeout to wait for a successful DNS backend restart.'));
		o.placeholder = '20';
		o.datatype = 'range(1,60)';
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_lookupdomain', _('External DNS Lookup Domain'), _('External domain to check for a successful DNS backend restart. \
			Please note: To disable this check set this option to \'false\'.'));
		o.placeholder = 'example.com';
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_dnsfilereset', _('DNS File Reset'), _('Resets the final DNS blocklist \'adb_list.overall\' after DNS backend loading. \
			Please note: This option starts a small ubus/adblock monitor in the background.'));
		o.rmempty = false;

		o = s.taboption('adv_dns', form.Flag, 'adb_dnsflush', _('Flush DNS Cache'), _('Flush the DNS Cache before adblock processing as well.'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_dnsallow', _('Disable DNS Allow'), _('Disable selective DNS whitelisting (RPZ pass through).'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_jail', _('Additional Jail Blocklist'), _('Builds an additional DNS blocklist to block access to all domains except those listed in the whitelist. \
			Please note: You can use this restrictive blocklist e.g. for guest wifi or kidsafe configurations.'));
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Value, 'adb_jaildir', _('Jail Directory'), _('Target directory for the generated jail blocklist \'adb_list.jail\'.'));
		o.depends('adb_jail', '1');
		o.placeholder = '/tmp';
		o.rmempty = true;

		o = s.taboption('adv_dns', form.Flag, 'adb_dnsinotify', _('Disable DNS Restarts'), _('Disable adblock triggered restarts for dns backends with autoload/inotify functions.'));
		o.depends('adb_dnsflush', '0');
		o.rmempty = true;

		/*
			advanced report settings tab
		*/
		o = s.taboption('adv_report', widgets.DeviceSelect, 'adb_repiface', _('Report Interface'), _('List of available network devices used by tcpdump.'));
		o.unspecified = true;
		o.nocreate = false;
		o.rmempty = true;

		o = s.taboption('adv_report', form.Value, 'adb_reportdir', _('Report Directory'), _('Target directory for DNS related report files. \
			Default is \'/tmp\', please use preferably an usb stick or another local disk.'));
		o.placeholder = '/tmp';
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

		/*
			advanced email settings tab
		*/
		o = s.taboption('adv_email', form.Value, 'adb_mailsender', _('E-Mail Sender Address'), _('Sender address for adblock notification E-Mails.'));
		o.placeholder = 'no-reply@adblock';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'adb_mailtopic', _('E-Mail Topic'), _('Topic for adblock notification E-Mails.'));
		o.placeholder = 'adblock notification';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'adb_mailprofile', _('E-Mail Profile'), _('Profile used by \'msmtp\' for adblock notification E-Mails.'));
		o.placeholder = 'adb_notify';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'adb_mailcnt', _('E-Mail Notification Count'), _('Raise the notification count, to get E-Mails if the overall blocklist count is less or equal to the given limit.'));
		o.placeholder = '0';
		o.datatype = 'min(0)';
		o.rmempty = true;

		/*
			blocklist sources tab
		*/
		o = s.taboption('sources', form.MultiValue, 'adb_sources', _('Sources (Size, Focus)'));
		var lines, name, size, focus;
		lines = result[0].trim().split('\n');
		for (var i = 0; i < lines.length; i++) {
			if (lines[i].match(/^\s+\+/)) {
				name  = lines[i].match(/^\s+\+\s(\w+)\s/)[1] || '-';
				size  = lines[i].match(/^\s+\+\s\w+[\sx]+(\w+)/)[1] || '-';
				focus = lines[i].match(/^\s+\+\s\w+[\sx]+\w+\s+([\w\+]+)/)[1] || '-';
				o.value(name, name + ' (' + size + ', ' + focus + ')');
			}
		}
		o.rmempty = false;
		return m.render();
	},
	handleReset: null
});
