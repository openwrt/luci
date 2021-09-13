'use strict';
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
	if (ev === 'timer') {
		L.ui.showModal(_('Refresh Timer'), [
			E('p', _('To keep your banIP lists up-to-date, you should setup an automatic update job for these lists.')),
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
					E('h5', _('Set a new banIP job')),
					E('select', { 'class': 'cbi-input-select', 'id': 'timerA' }, [
						E('option', { 'value': 'start' }, 'Start'),
						E('option', { 'value': 'reload' }, 'Reload'),
						E('option', { 'value': 'restart' }, 'Restart'),
						E('option', { 'value': 'refresh' }, 'Refresh'),
						E('option', { 'value': 'suspend' }, 'Suspend'),
						E('option', { 'value': 'resume' }, 'Resume'),
						E('option', { 'value': 'report gen' }, 'Report'),
						E('option', { 'value': 'report mail' }, 'Report &amp; Mail')
					]),
					'\xa0\xa0\xa0',
					_('banIP action')
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
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em' }, [
					E('h5', _('Remove an existing job')),
					E('input', { 'class': 'cbi-input-text', 'id': 'lineno', 'maxlength': '2' }, [
					]),
					'\xa0\xa0\xa0',
					_('Line number to remove')
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function(ev) {
						var lineno  = document.getElementById('lineno').value;
						var action  = document.getElementById('timerA').value;
						var hours   = document.getElementById('timerH').value;
						var minutes = document.getElementById('timerM').value || '0';
						var days    = document.getElementById('timerD').value || '*';
						if (hours) {
							L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['timer', 'add', action, hours, minutes, days]))
							.then(function(res) {
								if (res) {
									ui.addNotification(null, E('p', _('The Refresh Timer could not been updated.')), 'error');
								} else {
									ui.addNotification(null, E('p', _('The Refresh Timer has been updated.')), 'info');
								}
							});
						} else if (lineno) {
							L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['timer', 'remove', lineno]))
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
		L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['timer', 'list']))
		.then(function(res) {
			document.getElementById('cronView').value = res.trim();
		});
		document.getElementById('timerH').focus();
		return
	}

	if (document.getElementById('status') && document.getElementById('status').textContent.substr(0,6) === 'paused') {
		ev = 'resume';
	}

	fs.exec_direct('/etc/init.d/banip', [ev])
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['list']), {}),
			L.resolveDefault(fs.exec_direct('/usr/sbin/iptables', ['-L']), null),
			L.resolveDefault(fs.exec_direct('/usr/sbin/ip6tables', ['-L']), null),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.countries'), ''),
			uci.load('banip')
		]);
	},

	render: function(result) {
		var m, s, o;

		m = new form.Map('banip', 'banIP', _('Configuration of the banIP package to block ip adresses/subnets via IPSet. \
			For further information <a href="https://github.com/openwrt/packages/blob/master/net/banip/files/README.md" target="_blank" rel="noreferrer noopener" >check the online documentation</a>'));

		/*
			poll runtime information
		*/
		var rt_res, inf_stat, inf_ipsets, inf_sources, inf_srcarr, inf_devices, inf_devarr, inf_ifaces, inf_ifarr, inf_logterms, inf_logtarr
		var inf_subnets, inf_subnarr, inf_misc, inf_flags, inf_run

		pollData: poll.add(function() {
			return L.resolveDefault(fs.read_direct('/tmp/ban_runtime.json'), 'null').then(function(res) {
				rt_res = JSON.parse(res);
				inf_stat = document.getElementById('status');
				if (inf_stat && rt_res) {
					inf_stat.textContent = (rt_res.status || '-') + ' / ' + (rt_res.version || '-');
					if (rt_res.status === "running") {
						if (!inf_stat.classList.contains("spinning")) {
							inf_stat.classList.add("spinning");
						}
					} else {
						if (inf_stat.classList.contains("spinning")) {
							inf_stat.classList.remove("spinning");
							if (document.getElementById('btn_suspend')) {
								if (inf_stat.textContent.substr(0,6) === 'paused') {
									document.querySelector('#btn_suspend').textContent = 'Resume';
								}
								if (document.getElementById('status').textContent.substr(0,7) === 'enabled') {
									document.querySelector('#btn_suspend').textContent = 'Suspend';
								}
							}
						}
					}
				} else if (inf_stat) {
					inf_stat.textContent = '-';
					if (inf_stat.classList.contains("spinning")) {
						inf_stat.classList.remove("spinning");
					}
				}
				inf_ipsets = document.getElementById('ipsets');
				if (inf_ipsets && rt_res) {
					inf_ipsets.textContent = rt_res.ipset_info || '-';
				}
				inf_sources = document.getElementById('sources');
				inf_srcarr = [];
				if (inf_sources && rt_res) {
					for (var i = 0; i < rt_res.active_sources.length; i++) {
						if (i < rt_res.active_sources.length-1) {
							inf_srcarr += rt_res.active_sources[i].source + ', ';
						} else {
							inf_srcarr += rt_res.active_sources[i].source
						}
					}
					inf_sources.textContent = inf_srcarr || '-';
				}
				inf_devices = document.getElementById('devices');
				inf_devarr = [];
				if (inf_devices && rt_res) {
					for (var i = 0; i < rt_res.active_devs.length; i++) {
						if (i < rt_res.active_devs.length-1) {
							inf_devarr += rt_res.active_devs[i].dev + ', ';
						} else {
							inf_devarr += rt_res.active_devs[i].dev
						}
					}
					inf_devices.textContent = inf_devarr || '-';
				}
				inf_ifaces = document.getElementById('ifaces');
				inf_ifarr = [];
				if (inf_ifaces && rt_res) {
					for (var i = 0; i < rt_res.active_ifaces.length; i++) {
						if (i < rt_res.active_ifaces.length-1) {
							inf_ifarr += rt_res.active_ifaces[i].iface + ', ';
						} else {
							inf_ifarr += rt_res.active_ifaces[i].iface
						}
					}
					inf_ifaces.textContent = inf_ifarr || '-';
				}
				inf_logterms = document.getElementById('logterms');
				inf_logtarr = [];
				if (inf_logterms && rt_res) {
					for (var i = 0; i < rt_res.active_logterms.length; i++) {
						if (i < rt_res.active_logterms.length-1) {
							inf_logtarr += rt_res.active_logterms[i].term + ', ';
						} else {
							inf_logtarr += rt_res.active_logterms[i].term
						}
					}
					inf_logterms.textContent = inf_logtarr || '-';
				}
				inf_subnets = document.getElementById('subnets');
				inf_subnarr = [];
				if (inf_subnets && rt_res) {
					for (var i = 0; i < rt_res.active_subnets.length; i++) {
						if (i < rt_res.active_subnets.length-1) {
							inf_subnarr += rt_res.active_subnets[i].subnet + ', ';
						} else {
							inf_subnarr += rt_res.active_subnets[i].subnet
						}
					}
					inf_subnets.textContent = inf_subnarr || '-';
				}
				inf_misc = document.getElementById('infos');
				if (inf_misc && rt_res) {
					inf_misc.textContent = rt_res.run_infos || '-';
				}
				inf_flags = document.getElementById('flags');
				if (inf_flags && rt_res) {
					inf_flags.textContent = rt_res.run_flags || '-';
				}
				inf_run = document.getElementById('run');
				if (inf_run && rt_res) {
					inf_run.textContent = rt_res.last_run || '-';
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
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Status / Version')),
					E('div', { 'class': 'cbi-value-field spinning', 'id': 'status', 'style': 'color:#37c' },'\xa0')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('IPSet Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'ipsets', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Sources')),
					E('div', { 'class': 'cbi-value-field', 'id': 'sources', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Devices')),
					E('div', { 'class': 'cbi-value-field', 'id': 'devices', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Interfaces')),
					E('div', { 'class': 'cbi-value-field', 'id': 'ifaces', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Logterms')),
					E('div', { 'class': 'cbi-value-field', 'id': 'logterms', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Active Subnets')),
					E('div', { 'class': 'cbi-value-field', 'id': 'subnets', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Information')),
					E('div', { 'class': 'cbi-value-field', 'id': 'infos', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Flags')),
					E('div', { 'class': 'cbi-value-field', 'id': 'flags', 'style': 'color:#37c' },'-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Last Run')),
					E('div', { 'class': 'cbi-value-field', 'id': 'run', 'style': 'color:#37c' },'-')
				]),
				E('div', { class: 'right' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('timer');
						})
					}, [ _('Refresh Timer...') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'id': 'btn_suspend',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('suspend');
						})
					}, [ _('Suspend') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('refresh');
						})
					}, [ _('Refresh') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('restart');
						})
					}, [ _('Restart') ])
				])
			]);
		}, o, this);
		this.pollData;

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'banip', _('Settings'));
		s.addremove = false;
		s.tab('general',  _('General Settings'));
		s.tab('additional', _('Additional Settings'));
		s.tab('adv_chain', _('Advanced Chain Settings'));
		s.tab('adv_log', _('Advanced Log Settings'));
		s.tab('adv_email', _('Advanced E-Mail Settings'));
		s.tab('sources', _('Blocklist Sources'));

		/*
			general settings tab
		*/
		o = s.taboption('general', form.Flag, 'ban_enabled', _('Enabled'), _('Enable the banIP service.'));
		o.rmempty = false;

		o = s.taboption('general', widgets.NetworkSelect, 'ban_trigger', _('Startup Trigger Interface'), _('List of available network interfaces to trigger the banIP start.'));
		o.unspecified = true;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'ban_autodetect', _('Auto Detection'), _('Detect relevant network interfaces, devices, subnets and protocols automatically.'));
		o.rmempty = false;

		o = s.taboption('general', widgets.NetworkSelect, 'ban_ifaces', _('Network Interfaces'), _('Select the relevant network interfaces manually.'));
		o.depends('ban_autodetect', '0');
		o.unspecified = true;
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_proto4_enabled', _('IPv4 Support'), _('Enables IPv4 support in banIP.'));
		o.depends('ban_autodetect', '0');
		o.optional = true;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_proto6_enabled', _('IPv6 Support'), _('Enables IPv6 support in banIP.'));
		o.depends('ban_autodetect', '0');
		o.optional = true;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_monitor_enabled', _('Log Monitor'), _('Starts a small log monitor in the background to block suspicious SSH/LuCI login attempts.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_logsrc_enabled', _('Enable SRC logging'), _('Log suspicious incoming packets - usually dropped.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_logdst_enabled', _('Enable DST logging'), _('Log suspicious outgoing packets - usually rejected. \
			Logging such packets may cause an increase in latency due to it requiring additional system resources.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'ban_whitelistonly', _('Whitelist Only'), _('Restrict the internet access from/to a small number of secure websites/IPs \
			and block access from/to the rest of the internet.'));
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'ban_mail_enabled', _('E-Mail Notification'), _('Send banIP related notification e-mails. \
			This needs the installation and setup of the additional \'msmtp\' package.'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'ban_mailreceiver', _('E-Mail Receiver Address'), _('Receiver address for banIP notification e-mails.'));
		o.depends('ban_mail_enabled', '1');
		o.placeholder = 'name@example.com';
		o.rmempty = true;

		/*
			additional settings tab
		*/
		o = s.taboption('additional', form.Flag, 'ban_debug', _('Verbose Debug Logging'), _('Enable verbose debug logging in case of any processing errors.'));
		o.rmempty = false;

		o = s.taboption('additional', form.ListValue, 'ban_nice', _('Service Priority'), _('The selected priority will be used for banIP background processing. \
			This change requires a full banIP service restart to take effect.'));
		o.value('-20', _('Highest Priority'));
		o.value('-10', _('High Priority'));
		o.value('0', _('Normal Priority (default)'));
		o.value('10', _('Less Priority'));
		o.value('19', _('Least Priority'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'ban_triggerdelay', _('Trigger Delay'), _('Additional trigger delay in seconds before banIP processing begins.'));
		o.placeholder = '5';
		o.datatype = 'range(1,120)';
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'ban_maxqueue', _('Download Queue'), _('Size of the download queue for download processing in parallel.'));
		o.value('1');
		o.value('2');
		o.value('4');
		o.value('8');
		o.value('16');
		o.value('32');
		o.optional = true;
		o.rmempty = false;

		o = s.taboption('additional', form.Value, 'ban_tmpbase', _('Base Temp Directory'), _('Base Temp Directory used for all banIP related runtime operations.'));
		o.placeholder = '/tmp';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'ban_backupdir', _('Backup Directory'), _('Target directory for compressed source list backups.'));
		o.placeholder = '/tmp/banIP-Backup';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'ban_reportdir', _('Report Directory'), _('Target directory for IPSet related report files.'));
		o.placeholder = '/tmp/banIP-Report';
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'ban_fetchutil', _('Download Utility'), _('List of supported and fully pre-configured download utilities.'));
		o.value('uclient-fetch');
		o.value('wget');
		o.value('curl');
		o.value('aria2c');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.Flag, 'ban_fetchinsecure', _('Download Insecure'), _('Don\'t check SSL server certificates during download.'));
		o.default = 0
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'ban_fetchparm', _('Download Parameters'), _('Manually override the pre-configured download options for the selected download utility.'))
		o.optional = true;
		o.rmempty = true;

		/*
			advanced chain settings tab
		*/
		o = s.taboption('adv_chain', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>Changes on this tab needs a full banIP service restart to take effect.</b></em>';

		o = s.taboption('adv_chain', form.ListValue, 'ban_global_settype', _('Global IPSet Type'), _('Set the global IPset type default, to block incoming (SRC) and/or outgoing (DST) packets.'));
		o.value('src+dst');
		o.value('src');
		o.value('dst');
		o.rmempty = false;

		o = s.taboption('adv_chain', form.ListValue, 'ban_target_src', _('SRC Target'), _('Set the firewall target for all SRC related rules.'));
		o.value('DROP');
		o.value('REJECT');
		o.rmempty = false;

		o = s.taboption('adv_chain', form.ListValue, 'ban_target_dst', _('DST Target'), _('Set the firewall target for all DST related rules.'));
		o.value('REJECT');
		o.value('DROP');
		o.rmempty = false;

		o = s.taboption('adv_chain', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>Individual IPSet Settings</b></em>';

		o = s.taboption('adv_chain', form.ListValue, 'ban_maclist_timeout', _('Maclist Timeout'), _('Set the maclist IPSet timeout.'));
		o.value('1800', _('30 minutes'));
		o.value('3600', _('1 hour'));
		o.value('21600', _('6 hours'));
		o.value('43200', _('12 hours'));
		o.value('86400', _('24 hours'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.ListValue, 'ban_whitelist_timeout', _('Whitelist Timeout'), _('Set the whitelist IPSet timeout.'));
		o.value('1800', _('30 minutes'));
		o.value('3600', _('1 hour'));
		o.value('21600', _('6 hours'));
		o.value('43200', _('12 hours'));
		o.value('86400', _('24 hours'));
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.ListValue, 'ban_blacklist_timeout', _('Blacklist Timeout'), _('Set the blacklist IPSet timeout.'));
		o.value('1800', _('30 minutes'));
		o.value('3600', _('1 hour'));
		o.value('21600', _('6 hours'));
		o.value('43200', _('12 hours'));
		o.value('86400', _('24 hours'));
		o.optional = true;
		o.rmempty = true;

		var info, source, sources = [];
		if (result[0]) {
			sources = result[0].trim().split('\n');
		}

		o = s.taboption('adv_chain', form.MultiValue, 'ban_settype_src', _('SRC IPSet Type'), _('Set individual SRC type per IPset to block only incoming packets.'));
		o.value('whitelist');
		o.value('blacklist');
		for (var i = 0; i < sources.length; i++) {
			if (sources[i].match(/^\s+\+/)) {
				source = sources[i].match(/^\s+\+\s(\w+)\s/)[1].trim();
				o.value(source);
			}
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.MultiValue, 'ban_settype_dst', _('DST IPSet Type'), _('Set individual DST type per IPset to block only outgoing packets.'));
		o.value('whitelist');
		o.value('blacklist');
		for (var i = 0; i < sources.length; i++) {
			if (sources[i].match(/^\s+\+/)) {
				source = sources[i].match(/^\s+\+\s(\w+)\s/)[1].trim();
				o.value(source);
			}
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.MultiValue, 'ban_settype_all', _('SRC+DST IPSet Type'), _('Set individual SRC+DST type per IPset to block incoming and outgoing packets.'));
		o.value('whitelist');
		o.value('blacklist');
		for (var i = 0; i < sources.length; i++) {
			if (sources[i].match(/^\s+\+/)) {
				source = sources[i].match(/^\s+\+\s(\w+)\s/)[1].trim();
				o.value(source);
			}
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>IPv4 Chains</b></em>';

		/*
			prepare iptables data
		*/
		var chain, result_v4=[], result_v6=[];
		if (result[1]) {
			result_v4 = result[1].trim().split('\n');
		} else if (result[2]) {
			result_v4 = result[2].trim().split('\n');
		}

		if (result[2]) {
			result_v6 = result[2].trim().split('\n');
		} else if (result[1]) {
			result_v6 = result[1].trim().split('\n');
		}

		o = s.taboption('adv_chain', form.DynamicList, 'ban_lan_inputchains_4', _('LAN Input'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'input_lan_rule\'.'));
		for (var i = 0; i < result_v4.length; i++) {
			if (result_v4[i].match(/^Chain input[\w_]+\s+/)) {
				chain = result_v4[i].match(/\s+(input[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DynamicList, 'ban_lan_forwardchains_4', _('LAN Forward'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'forwarding_lan_rule\'.'));
		for (var i = 0; i < result_v4.length; i++) {
			if (result_v4[i].match(/^Chain forwarding[\w_]+\s+/)) {
				chain = result_v4[i].match(/\s+(forwarding[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DynamicList, 'ban_wan_inputchains_4', _('WAN Input'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'input_wan_rule\'.'));
		for (var i = 0; i < result_v4.length; i++) {
			if (result_v4[i].match(/^Chain input[\w_]+\s+/)) {
				chain = result_v4[i].match(/\s+(input[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DynamicList, 'ban_wan_forwardchains_4', _('WAN Forward'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'forwarding_wan_rule\'.'));
		for (var i = 0; i < result_v4.length; i++) {
			if (result_v4[i].match(/^Chain forwarding[\w_]+\s+/)) {
				chain = result_v4[i].match(/\s+(forwarding[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>IPv6 Chains</b></em>';

		o = s.taboption('adv_chain', form.DynamicList, 'ban_lan_inputchains_6', _('LAN Input'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'input_lan_rule\'.'));
		for (var i = 0; i < result_v6.length; i++) {
			if (result_v6[i].match(/^Chain input[\w_]+\s+/)) {
				chain = result_v6[i].match(/\s+(input[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DynamicList, 'ban_lan_forwardchains_6', _('LAN Forward'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'forwarding_lan_rule\'.'));
		for (var i = 0; i < result_v6.length; i++) {
			if (result_v6[i].match(/^Chain forwarding[\w_]+\s+/)) {
				chain = result_v6[i].match(/\s+(forwarding[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DynamicList, 'ban_wan_inputchains_6', _('WAN Input'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'input_wan_rule\'.'));
		for (var i = 0; i < result_v6.length; i++) {
			if (result_v6[i].match(/^Chain input[\w_]+\s+/)) {
				chain = result_v6[i].match(/\s+(input[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_chain', form.DynamicList, 'ban_wan_forwardchains_6', _('WAN Forward'), _('Assign one or more relevant firewall chains to banIP. The default chain used by banIP is \'forwarding_wan_rule\'.'));
		for (var i = 0; i < result_v6.length; i++) {
			if (result_v6[i].match(/^Chain forwarding[\w_]+\s+/)) {
				chain = result_v6[i].match(/\s+(forwarding[\w_]+)\s+/)[1].trim();
				o.value(chain);
			}
		}
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		/*
			advanced log settings tab
		*/
		o = s.taboption('adv_log', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>Changes on this tab needs a full banIP service restart to take effect.</b></em>';

		o = s.taboption('adv_log', form.ListValue, 'ban_loglimit', _('Log Limit'), _('Parse only the last stated number of log entries for suspicious events.'));
		o.value('50');
		o.value('100');
		o.value('250');
		o.value('500');
		o.rmempty = false;

		o = s.taboption('adv_log', form.MultiValue, 'ban_logterms', _('Log Terms'), _('Limit the log monitor to certain log terms.'));
		o.value('dropbear');
		o.value('sshd');
		o.value('luci');
		o.value('nginx');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_ssh_logcount', _('SSH Log Count'), _('Number of failed ssh login repetitions of the same ip in the log before banning.'));
		o.placeholder = '3';
		o.datatype = 'range(1,10)';
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_luci_logcount', _('LuCI Log Count'), _('Number of failed LuCI login repetitions of the same ip in the log before banning.'));
		o.placeholder = '3';
		o.datatype = 'range(1,10)';
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_nginx_logcount', _('NGINX Log Count'), _('Number of failed nginx requests of the same ip in the log before banning.'));
		o.placeholder = '5';
		o.datatype = 'range(1,20)';
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_logopts_src', _('SRC Log Options'), _('Set special SRC log options, e.g. to set a limit rate.'));
		o.nocreate = false;
		o.unspecified = true;
		o.value('-m limit --limit 2/sec', _('-m limit --limit 2/sec (default)'));
		o.value('-m limit --limit 10/sec');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('adv_log', form.Value, 'ban_logopts_dst', _('DST Log Options'), _('Set special DST log options, e.g. to set a limit rate.'));
		o.nocreate = false;
		o.unspecified = true;
		o.value('-m limit --limit 2/sec', _('-m limit --limit 2/sec (default)'));
		o.value('-m limit --limit 10/sec');
		o.optional = true;
		o.rmempty = true;

		/*
			advanced email settings tab
		*/
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

		o = s.taboption('adv_email', form.MultiValue, 'ban_mailactions', _('E-Mail Actions'), _('Limit E-Mail trigger to certain banIP actions.'));
		o.value('start');
		o.value('reload');
		o.value('restart');
		o.value('refresh');
		o.rmempty = true;

		/*
			blocklist sources tab
		*/
		o = s.taboption('sources', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>List of supported and fully pre-configured banIP sources.</b></em>';

		o = s.taboption('sources', form.MultiValue, 'ban_sources', _('Sources (Info)'));
		for (var i = 0; i < sources.length; i++) {
			if (sources[i].match(/^\s+\+/)) {
				source = sources[i].match(/^\s+\+\s(\w+)\s/)[1].trim();
				info = sources[i].slice(35,70).trim();
				o.value(source, source + ' (' + info + ')');
			}
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('sources', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>Country Selection</b></em>';

		/*
			prepare country data
		*/
		var code, country, countries = [];
		if (result[3]) {
			countries = result[3].trim().split('\n');
		}

		o = s.taboption('sources', form.DynamicList, 'ban_countries', _('Countries'));
		for (var i = 0; i < countries.length; i++) {
			code = countries[i].match(/^(\w+);/)[1].trim();
			country = countries[i].match(/^\w+;(.*$)/)[1].trim();
			o.value(code, country);
		}
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('sources', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>ASN Selection</b></em>';

		o = s.taboption('sources', form.DynamicList, 'ban_asns', _('ASNs'));
		o.datatype = 'uinteger';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('sources', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em><b>Local Sources</b></em>';

		o = s.taboption('sources', form.MultiValue, 'ban_localsources', _('Local Sources'), _('Limit the selection to certain local sources.'));
		o.value('maclist');
		o.value('whitelist');
		o.value('blacklist');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('sources', form.DynamicList, 'ban_extrasources', _('Extra Sources'), _('Add additional, non-banIP related IPSets e.g. for reporting and queries.'));
		o.datatype = 'uciname';
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('sources', form.Flag, 'ban_autoblacklist', _('Auto Blacklist'), _('Automatically transfers suspicious IPs from the log to the banIP blacklist during runtime.'));
		o.rmempty = false;

		o = s.taboption('sources', form.Flag, 'ban_autowhitelist', _('Auto Whitelist'), _('Automatically transfers uplink IPs to the banIP whitelist during runtime.'));
		o.rmempty = false;

		return m.render();
	},
	handleReset: null
});
