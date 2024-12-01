'use strict';
'require form';

return L.view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('dump1090', _('dump1090'), 
			_('dump1090 is a Mode S decoder specifically designed for RTLSDR devices. Here you can configure the settings.'));

		s = m.section(form.TypedSection, 'dump1090', '');
		s.addremove = true;
		s.anonymous = false;

		o = s.option(form.Flag, 'disabled', _('Enabled'));
		o.enabled = '0';
		o.disabled = '1';

		o = s.option(form.Flag, 'respawn', _('Respawn'));

		o = s.option(form.Value, 'device_index', _('RTL device index'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'gain', _('Gain (-10 for auto-gain)'));
		o.rmempty = true;
		o.datatype = 'integer';

		o = s.option(form.Flag, 'enable_agc', _('Enable automatic gain control'));

		o = s.option(form.Value, 'freq', _('Frequency'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'ifile', _('Data file'));
		o.rmempty = true;
		o.datatype = 'file';

		o = s.option(form.ListValue, 'iformat', _('Sample format for data file'));
		o.value('', _('Default'));
		o.value('UC8', 'UC8');
		o.value('SC16', 'SC16');
		o.value('SC16Q11', 'SC16Q11');

		o = s.option(form.Flag, 'throttle', _('When reading from a file play back in realtime, not at max speed'));

		o = s.option(form.Flag, 'raw', _('Show only messages hex values'));

		o = s.option(form.Flag, 'net', _('Enable networking'));

		o = s.option(form.Flag, 'modeac', _('Enable decoding of SSR Modes 3/A & 3/C'));

		o = s.option(form.Flag, 'net_beast', _('TCP raw output in Beast binary format'));

		o = s.option(form.Flag, 'net_only', _('Enable just networking, no RTL device or file used'));

		o = s.option(form.Value, 'net_bind_address', _('IP address to bind to'));
		o.rmempty = true;
		o.datatype = 'ipaddr';

		o = s.option(form.Value, 'net_http_port', _('HTTP server port'));
		o.rmempty = true;
		o.datatype = 'port';

		o = s.option(form.Value, 'net_ri_port', _('TCP raw input listen port'));
		o.rmempty = true;
		o.datatype = 'port';

		o = s.option(form.Value, 'net_ro_port', _('TCP raw output listen port'));
		o.rmempty = true;
		o.datatype = 'port';

		o = s.option(form.Value, 'net_sbs_port', _('TCP BaseStation output listen port'));
		o.rmempty = true;
		o.datatype = 'port';

		o = s.option(form.Value, 'net_bi_port', _('TCP Beast input listen port'));
		o.rmempty = true;
		o.datatype = 'port';

		o = s.option(form.Value, 'net_bo_port', _('TCP Beast output listen port'));
		o.rmempty = true;
		o.datatype = 'port';

		o = s.option(form.Value, 'net_fatsv_port', _('FlightAware TSV output port'));
		o.rmempty = true;
		o.datatype = 'port';

		o = s.option(form.Value, 'net_ro_size', _('TCP raw output minimum size'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'net_ro_interval', _('TCP raw output memory flush rate in seconds'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'net_heartbeat', _('TCP heartbeat rate in seconds'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'net_buffer', _('TCP buffer size 64Kb * (2^n)'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Flag, 'net_verbatim', _('Do not apply CRC corrections to messages we forward'));

		o = s.option(form.Flag, 'forward_mlat', _('Allow forwarding of received mlat results to output ports'));

		o = s.option(form.Value, 'lat', _('Reference/receiver latitude for surface posn'));
		o.rmempty = true;
		o.datatype = 'float';

		o = s.option(form.Value, 'lon', _('Reference/receiver longitude for surface posn'));
		o.rmempty = true;
		o.datatype = 'float';

		o = s.option(form.Value, 'max_range', _('Absolute maximum range for position decoding'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Flag, 'fix', _('Enable single-bits error correction using CRC'));

		o = s.option(form.Flag, 'no_fix', _('Disable single-bits error correction using CRC'));

		o = s.option(form.Flag, 'no_crc_check', _('Disable messages with broken CRC'));

		o = s.option(form.Flag, 'phase_enhance', _('Enable phase enhancement'));

		o = s.option(form.Flag, 'aggressive', _('More CPU for more messages'));

		o = s.option(form.Flag, 'mlat', _('Display raw messages in Beast ascii mode'));

		o = s.option(form.Flag, 'stats', _('Print stats at exit'));

		o = s.option(form.Flag, 'stats_range', _('Collect/show range histogram'));

		o = s.option(form.Value, 'stats_every', _('Show and reset stats every seconds'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Flag, 'onlyaddr', _('Show only ICAO addresses'));

		o = s.option(form.Flag, 'metric', _('Use metric units'));

		o = s.option(form.Value, 'snip', _('Strip IQ file removing samples'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'debug', _('Debug mode flags'));
		o.rmempty = true;

		o = s.option(form.Value, 'ppm', _('Set receiver error in parts per million'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'html_dir', _('Base directory for the internal HTTP server'));
		o.placeholder = '/usr/share/dump1090';
		o.rmempty = true;
		o.datatype = 'directory';

		o = s.option(form.Value, 'write_json', _('Periodically write json output to a directory'));
		o.placeholder = '/var/run/dump1090';
		o.rmempty = true;
		o.datatype = 'directory';

		o = s.option(form.Value, 'write_json_every', _('Write json output every t seconds'));
		o.rmempty = true;
		o.datatype = 'uinteger';

		o = s.option(form.ListValue, 'json_location_accuracy', _('Accuracy of receiver location in json metadata'));
		o.value('', _('Default'));
		o.value('0', _('No location'));
		o.value('1', _('Approximate'));
		o.value('2', _('Exact'));

		o = s.option(form.Flag, 'oversample', _('Use the 2.4MHz demodulator'));

		o = s.option(form.Flag, 'dcfilter', _('Apply a 1Hz DC filter to input data'));

		o = s.option(form.Flag, 'measure_noise', _('Measure noise power'));

		return m.render();
	}
});
