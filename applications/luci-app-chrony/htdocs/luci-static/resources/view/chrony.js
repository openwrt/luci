'use strict';
'require form';
'require fs';
'require uci';
'require view';
'require tools.widgets as widgets';

return view.extend({

	render(data) {
		const docUrl = 'https://chrony-project.org/documentation.html';
		let m, s, o;

		m = new form.Map('chrony', _('Chrony NTP/NTS daemon'),
			'%s'.format('<a id="docUrl" href="%s" target="_blank" rel="noreferrer">%s</a>'
			.format(docUrl, _('Documentation'))));

		// Interface
		s = m.section(form.NamedSection, 'allow', 'allow', _('Allow'), _('An allow range permits access for chronyc from specific IPs to chronyd.') + '<br/>' +
			_('Delete this section to allow all local IPs.'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'),
			_('Choose IP ranges from this interface to set them as allowed ranges.') + '<br/>' +
			_('Choose a wan interface to allow from all IPs.') + '<br/>' +
			_('Additional firewall configuration is required if you intend wan access.'));
		o.nocreate = true;
		o.rmempty = false;

		// NTS
		s = m.section(form.NamedSection, 'nts', 'nts', _('Network Time Security (NTS)'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, 'rtccheck', _('RTC Check'),
			_('Check for the presence of %s.'.format('<code>/dev/rtc0</code>'), 'Check for RTC character device') + '<br/>' +
			_('Disables certificate time checks via %s if RTC is absent.'.format('<code>nocerttimecheck</code>') ) );
		o.default = o.disabled;

		o = s.option(form.Flag, 'systemcerts', _('Use system CA bundle'));
		o.default = o.enabled;

		o = s.option(form.FileUpload, 'trustedcerts', _('Trusted certificates'));
		o.optional = true;
		o.root_directory = '/etc';

		// Stepping
		s = m.section(form.NamedSection, 'makestep', 'makestep', _('Stepping'), 
			_('Corrects the system clock by stepping immediately when it is so far adrift that the slewing process would take a very long time.'));
		s.anonymous = true;
		s.addremove = true;
		s.singular = true;

		o = s.option(form.Value, 'threshold', _('Trigger Amount Threshold'),
			_('Seconds float value.'));
		o.datatype = 'float';
		o.optional = true;

		o = s.option(form.Value, 'limit', _('Limit'),
			_('First x clock updates'));
		o.datatype = 'integer';
		o.optional = true;

		// Logging
		s = m.section(form.NamedSection, 'logging', 'logging', _('Logging'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'logchange', _('Log any change more than'),
			_('Seconds threshold for the adjustment of the system clock that will generate a syslog message.'));
		o.datatype = 'float';
		o.placeholder = '1';
		o.optional = true;

		// System Clock
		s = m.section(form.NamedSection, 'systemclock', 'systemclock', _('System Clock'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'precision', _('Precision'),
			_('Precision of the system clock (in seconds).'));
		o.datatype = 'string';
		o.placeholder = _('8e-6 (8 microseconds)');
		o.optional = true;

		o = s.option(form.ListValue, 'leapsecmode', _('Leap second mode'),
			_('Strategy to reconcile leap seconds in UTC with solar time.'));
		o.value('', _('(default)'))
		o.value('system')
		o.value('step')
		o.value('slew')
		o.value('ignore')
		o.optional = true;

		// Smoothing
		s = m.section(form.NamedSection, 'smoothtime', 'smoothtime', _('Smoothing'),
			_('Use only when the clients are not configured to poll another NTP server also, because they could reject this server as a falseticker or fail to select a source completely.'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'maxppm', _('Max PPM'),
			_('Maximum frequency offset of the smoothed time to the tracked NTP time (in ppm).'));
		o.datatype = 'uinteger';
		o.placeholder = '400';
		o.optional = false;

		o = s.option(form.Value, 'maxwander', _('Max wander'),
			_('Maximum rate at which the frequency offset is allowed to change (in ppm per second).'));
		o.datatype = 'float';
		o.placeholder = '0.01';
		o.optional = false;

		o = s.option(form.Flag, 'leaponly', _('Leap seconds only'),
			_('Only leap seconds are smoothed out; ignore normal offset and frequency changes.'));
		o.default = o.disabled;

		// Server entries
		s = m.section(form.TypedSection, 'server', _('Server'),
			_('Remote NTP servers for your chronyd'));
		s.anonymous = true;
		s.addremove = true;
		insertTypedSectionOptions(m, s, o, 'server');

		// Pool entries
		s = m.section(form.TypedSection, 'pool', _('Pool'),
			_('Specifies a pool of NTP servers rather than a single NTP server.') + '<br/>' + 
			_('The pool name is expected to resolve to multiple addresses which might change over time.'));
		s.anonymous = true;
		s.addremove = true;
		insertTypedSectionOptions(m, s, o, 'pool');

		// Peer entries
		s = m.section(form.TypedSection, 'peer', _('Peer'),
			_('Specifies a symmetric association with an NTP peer.') + '<br/>' +
			_('A single symmetric association allows the peers to be both servers and clients to each other.'));
		s.anonymous = true;
		s.addremove = true;
		insertTypedSectionOptions(m, s, o, 'peer');

		// Servers assigned (to us) via DHCP
		s = m.section(form.NamedSection, 'dhcp_ntp_server', 'dhcp_ntp_server', _('DHCP(v6)'),
			_('Options for servers provided to this host via DHCP(v6) (via the WAN for example).'));
		s.anonymous = true;
		insertTypedSectionOptions(m, s, o, 'dhcp_ntp_server');


		return m.render();
	}
});

function insertTypedSectionOptions(m, s, o, type) {

		o = s.option(form.Flag, 'disabled', _('Disabled'));
		o.default = o.disabled; // disabled default is disabled i.e., enabled

		if (type != 'dhcp_ntp_server') {
			o = s.option(form.Value, 'hostname', _('Hostname'));
			o.optional = false;
			o.depends('disabled', '0');
		}

		if (type != 'peer') {
			o = s.option(form.Flag, 'iburst', _('iburst'));
			o.rmempty = true;
			o.default = o.disabled
			o.depends('disabled', '0');

			o = s.option(form.Flag, 'nts', _('NTS'));
			o.rmempty = true;
			o.default = o.disabled
			o.depends('disabled', '0');
		}

		o = s.option(form.Flag, 'prefer', _('Prefer'));
		o.default = o.disabled;

		o = s.option(form.Flag, 'xleave', _('Interleave'));
		o.default = o.disabled;

		o = s.option(form.RangeSliderValue, 'minpoll', _('Minimum poll'),
			_('(Log_2 i.e. y=2^x) interval between readings of the NIC clock.'));
		o.min = -7;
		o.max = 24;
		o.step = 1;
		o.default = 4;
		o.calculate = (val) => {
			return 2**Number(val);
		};
		o.calcunits = _('seconds')
		o.depends('disabled', '0');

		o = s.option(form.RangeSliderValue, 'maxpoll', _('Maximum poll'),
			_('(Log_2 i.e. y=2^x) interval between readings of the NIC clock.'));
		o.min = -7;
		o.max = 24;
		o.step = 1;
		o.default = 4;
		o.calculate = (val) => {
			return 2**Number(val);
		};
		o.calcunits = _('seconds');
		o.depends('disabled', '0');

		o = s.option(form.Value, 'mindelay', _('Minimum delay'),
			_('A fixed round-trip delay in seconds to be used instead of that of the previous measurements.') + '<br/>' + 
			_('Exponential and decimal notation are allowed.'));
		o.placeholder = '1e-4'
		o.depends('disabled', '0');

		o = s.option(form.Value, 'maxdelay', _('Maximum delay'),
			_('A fixed round-trip delay in seconds to be used instead of that of the previous measurements.') + '<br/>' + 
			_('Exponential and decimal notation are allowed.'));
		o.placeholder = '3';
		o.depends('disabled', '0');

		o = s.option(form.RangeSliderValue, 'minsamples', _('Minimum samples'));
		o.min = 4;
		o.max = 64;
		o.step = 1;
		o.default = 6;
		o.depends('disabled', '0');

		o = s.option(form.RangeSliderValue, 'maxsamples', _('Maximum samples'),
			_('Number of samples that chronyd should keep for each source.'));
		o.min = 4;
		o.max = 64;
		o.step = 1;
		o.default = 6;
		o.depends('disabled', '0');

}
