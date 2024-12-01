'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function () {
		let m, s, o;

		m = new form.Map('openwisp',
			_('OpenWISP'),
			_("Configure, start and stop the OpenWISP agent on this device. Read more about configuration values: <a target='_blank' rel='noopener noreferrer' href='https://github.com/openwisp/openwisp-config'>https://github.com/openwisp/openwisp-config</a>"));

		s = m.section(form.NamedSection, 'http', 'controller');

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		// General settings
		o = s.taboption('general', form.Value, 'uuid', _('UUID'), _('The UUID of this  device in the OpenWISP server.'))
		o.readonly = true;

		o = s.taboption('general', form.Value, 'key', _('Key'), _('The Key of this device in the OpenWISP server.'))
		o.readonly = true;

		o = s.taboption('general', form.ListValue, 'enabled',
			_('Enable'),
			_("Enable or disable the OpenWISP service."));
		o.value('disabled', _('Disabled'));
		o.value('monitoring', _('Enabled'));
		o.default = 'monitoring'

		o = s.taboption('general', form.Value, 'url', _('Server URL'), _('The URL to the OpenWISP server. Example: https://openwisp2.mynetwork.com'))
		o.placeholder = 'https://openwisp2.mynetwork.com'

		o = s.taboption('general', form.Value, 'shared_secret', _('Shared Secret'), _('The organization shared secret for auto enrollment.'))
		o.password = true

		o = s.taboption('general', form.Value, 'interval', _('Update Interval'), 'How often to check in with the OpenWISP server. Expressed in seconds.')
		o.placeholder = '120'
		o.rmempty = true
		o.datatype = 'uinteger';

		// Advanced settings
		o = s.taboption('advanced', form.Flag, 'verify_ssl', _('Verify SSL'), _('Verify the server SSL certificate.'))
		o.rmempty = true
		o.default = true

		o = s.taboption('advanced', form.Flag, 'consistent_key', _('Consistent Key'), _('When using Automatic registration, this feature allows devices to keep the same configuration even if reset or re-flashed.  This feature is enabled by default, but must be enabled also in the controller application in order to work.'))
		o.rmempty = true
		o.default = true

		o = s.taboption('advanced', widgets.DeviceSelect, 'mac_interface', _('MAC Interface'), _('The interface to use for getting the MAC for this device.'))
		o.default = 'eth0'

		o = s.taboption('advanced', widgets.NetworkSelect, 'management_interface', _('Management Interface'), _('The interface to use for management and control.'))
		o.placeholder = 'tun0'
		o.rmempty = true

		o = s.taboption('advanced', form.Flag, 'merge_config', _('Merge Config'), _('If selected, in the event a config item is present in both the remote and local configuration, the remote configuration takes precedence over local configuration.'))
		o.rmempty = true
		o.default = true

		o = s.taboption('advanced', form.DynamicList, 'tags', _('Tags'), _('Tags applied to this device.'))

		o = s.taboption('advanced', form.Flag, 'test_config', _('Test Config'), _('If the agent is unable to reach the controller after applying the downloaded config it will be reverted.'))
		o.default = true
		o.rmempty = true

		o = s.taboption('advanced', form.Value, 'test_script', _('Test Script'), 'Path to a custom test script if the default Test Config script does not meet your needs.')
		o.depends({ test_config: '1' })
		o.datatype = "file"

		o = s.taboption('advanced', form.Flag, 'hardware_id_key', _('Hardware ID Key'), _('Use a unique hardware ID for device identification, for example a serial number.'))
		o.default = false
		o.rmempty = true

		o = s.taboption('advanced', form.Value, 'hardware_id_script', _('Hardware ID Script'), 'Path to the script used to return the value of the hardware key.')
		o.depends({ hardware_id_key: '1' })
		o.datatype = "file"

		o = s.taboption('advanced', form.Value, 'bootup_delay', _('Boot Delay'), 'Maximum value of the delay after boot before starting OpenWISP service. Expressed in seconds.')
		o.placeholder = '10'
		o.rmempty = true
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'connect_timeout', _('Connect Timeout'), 'Value passed to curl --connect-timeout argument, defaults to 15. Expressed in seconds.')
		o.placeholder = '15'
		o.rmempty = true
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'max_time', _('Max Time'), _('Value passed to curl --max-time argument, defaults to 30. Expressed in seconds.'))
		o.placeholder = '30'
		o.rmempty = true
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'capath', _('CA Path'), _('Use the specified certificate file to verify the peer. The file may contain multiple CA certificates. The certificate(s) must be in PEM format.'))
		o.datatype = "file"

		o = s.taboption('advanced', form.Value, 'cacert', _('CA Cert'), _('Use the specified certificate directory to verify the peer. The certificates must be in PEM format, and the directory must have been processed using the c_rehash utility supplied with openssl.'))
		o.datatype = "file"

		o = s.taboption('advanced', form.Value, 'pre_reload_hook', _('Pre-reload Hook'), _('Path to pre-reload hook.  The hook is not called if the path does not point to an executable script file. This hook is called each time openwisp-config applies a configuration, but before services are reloaded.'))
		o.placeholder = '/usr/sbin/my_pre_reload_hook'
		o.datatype = "file"

		o = s.taboption('advanced', form.Value, 'post_reload_hook', _('Post-reload Hook'), _('Path to post reload hook script. The hook is not called if the path does not point to an executable script file. This hook is called each time openwisp-config applies a configuration, but after services are reloaded.'))
		o.placeholder = '/usr/sbin/my_post_reload_hook'
		o.datatype = "file"

		return m.render();
	}
});
