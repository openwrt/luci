'use strict';

'require form';
'require fs';
'require rpc';
'require uci';
'require view';

const getCompileTimeOptions = rpc.declare({
	object: 'luci.squid',
	method: 'getCompileTimeOptions',
	expect: { options: [] }
});

function validateFile(path) {
	if (!path.startsWith('/etc/squid/')) {
		return _('File must be located in directory /etc/squid');
	}
	return true;
}

function writeFile(path, content) {
	if (content) {
		var normalized = content.replaceAll('\r\n', '\n');
		fs.write(path, normalized);
	}
}

return view.extend({

	load: function() {
		var load_squid = uci.load('squid')
			.then(() => uci.get('squid', 'squid'));
		return Promise.all([load_squid, getCompileTimeOptions()]);
	},

	render: function(data) {
		var { config_file, mime_table } = data[0];
		var options = data[1];

		let m, s, o;

		m = new form.Map('squid', _('Squid'));

		s = m.section(form.TypedSection, 'squid');
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('general', form.Value, 'config_file', _('Config file'));
		o.datatype = 'string';
		o.default = '/etc/squid/squid.conf';
		o.validate = function(section_id, value) {
			return validateFile(value);
		};

		o = s.taboption('general', form.Value, 'mime_table', _('Mime table'));
		o.datatype = 'string';
		o.default = '/etc/squid/mime.conf';
		o.validate = function(section_id, value) {
			return validateFile(value);
		};

		o = s.taboption('general', form.Value, 'http_port', _('Port'));
		o.datatype = 'portrange';
		o.placeholder = '0-65535';

		o = s.taboption('general', form.Value, 'http_port_options', _('HTTP port options'));
		o.datatype = 'string';
		o.optional = true;

		o = s.taboption('general', form.Value, 'ssl_db', _('SSL DB'));
		o.datatype = 'string';
		o.optional = true;

		o = s.taboption('general', form.Value, 'ssldb_options', _('SSL DB options'));
		o.datatype = 'string';
		o.optional = true;

		o = s.taboption('general', form.Value, 'visible_hostname', _('Visible Hostname'));
		o.datatype = 'string';
		o.placeholder = 'OpenWrt';

		o = s.taboption('general', form.Value, 'coredump_dir', _('Coredump files directory'));
		o.datatype = 'string';
		o.placeholder = '/tmp/squid';

		var enable_icmp_option = '--enable-icmp';
		var is_enable_icmp_defined = options.includes(enable_icmp_option);
		o = s.taboption('general', form.Flag, 'pinger_enable', _('Enable ICMP pinger'),
			!is_enable_icmp_defined ? _('Can only be set if Squid is compiled with the %s option').format(`<code>${enable_icmp_option}</code>`) : null);
		o.datatype = 'string';
		o.enabled = 'on';
		o.disabled = 'off';
		o.readonly = !is_enable_icmp_defined;

		o = s.taboption('advanced', form.SectionValue, '_advanced', form.TypedSection, '_advanced', null,
			_('Advanced settings grants you direct access to the configuration files.'));

		var advanced = o.subsection;
		advanced.anonymous = true;
		advanced.cfgsections = function() { return [ '_advanced' ] };

		advanced.tab('_config_file', _('Config file'));
		advanced.tab('_mime_table', _('Mime table'));

		o = advanced.taboption('_config_file', form.TextValue, '_config_file_data');
		o.wrap = false;
		o.rows = 25;
		o.rmempty = false;
		o.cfgvalue = function(section_id) {
			return fs.read(config_file);
		};
		o.write = function(section_id, value) {
			writeFile(config_file, value);
		};

		o = advanced.taboption('_mime_table', form.TextValue, '_mime_table_data');
		o.wrap = false;
		o.rows = 25;
		o.rmempty = false;
		o.cfgvalue = function(section_id) {
			return fs.read(mime_table);
		};
		o.write = function(section_id, value) {
			writeFile(mime_table, value);
		};

		return m.render();
	},

});
