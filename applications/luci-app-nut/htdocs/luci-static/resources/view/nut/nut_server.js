'use strict';
'require form';
'require fs';
'require view';

const driver_path = '/lib/nut/';
const ups_daemon = '/usr/sbin/upsd';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/usr/bin/ldd', [ups_daemon]), []).catch(function(err) {
				throw new Error(_('Unable to run ldd: %s').format(err.message));
			}).then(function(stdout) {
				return stdout.includes('libssl.so');
			}),
			L.resolveDefault(fs.list(driver_path), []).then(function(entries) {
				var files = [];
				entries.forEach(object => {
					if (object.type == 'file') {
						files.push(object.name);
					}
				});
				return files;
			}),
		])
	},

	render: function(loaded_promises) {
		let m, s, o;
		const have_ssl_support = loaded_promises[0];
		const driver_list = loaded_promises[1];

		m = new form.Map('nut_server', _('NUT Server'),
			_('Network UPS Tools Server Configuration'));

		// User settings
		s = m.section(form.TypedSection, 'user', _('NUT Users'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'username', _('Username'));
		o.optional = false;

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;
		o.optional = false;

		o = s.option(form.MultiValue, 'actions', _('Allowed actions'));
		// o.widget = 'select'
		o.value('set', _('Set variables'));
		o.value('fsd', _('Forced Shutdown'));
		o.optional = true;

		o = s.option(form.DynamicList, 'instcmd', _('Instant commands'), _('Use %s to see full list of commands your UPS supports (requires %s package)'.format('<code>upscmd -l</code>', '<code>upscmd</code>')));
		o.optional = true;

		o = s.option(form.ListValue, 'upsmon', _('Role'));
		o.value('slave', _('Auxiliary'));
		o.value('master', _('Primary'));
		o.optional = false;

		// Listen settings
		s = m.section(form.TypedSection, 'listen_address', _('Addresses on which to listen'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'address', _('IP Address'));
		o.optional = false;
		o.datatype = 'ipaddr';
		o.placeholder = '127.0.0.1';

		o = s.option(form.Value, 'port', _('Port'));
		o.optional = true;
		o.datatype = 'port';
		o.placeholder = '3493';

		// Server global settings
		s = m.section(form.NamedSection, 'upsd', 'upsd', _('UPS Server Global Settings'));
		s.addremove = true;

		o = s.option(form.Value, 'maxage', _('Maximum Age of Data'), _('Period after which data is considered stale'));
		o.datatype = 'uinteger'
		o.optional = true;
		o.placeholder = 15;

		o = s.option(form.Value, 'runas', _('RunAs User'), _('Drop privileges to this user'));
		o.optional = true;
		o.placeholder = 'nut'

		o = s.option(form.Value, 'statepath', _('Path to state file'));
		o.optional = true;
		o.placeholder = '/var/run/nut'

		o = s.option(form.Value, 'maxconn', _('Maximum connections'));
		o.optional = true;
		o.datatype = 'uinteger'
		o.placeholder = 24;

		if (have_ssl_support) {
			o = s.option(form.Value, 'certfile', _('Certificate file (SSL)'));
			o.optional = true;
		}

		// Drivers global settings
		s = m.section(form.NamedSection, 'driver_global', 'driver_global', _('Driver Global Settings'));
		s.addremove = true;

		o = s.option(form.Value, 'chroot', _('chroot'), _('Run drivers in a chroot(2) environment'));
		o.optional = true;

		o = s.option(form.Value, 'driverpath', _('Driver Path'), _('Path to drivers (instead of default)'));
		o.optional = true;
		o.placeholder = '/lib/lnut';

		o = s.option(form.Value, 'maxstartdelay', _('Maximum Start Delay'), _('Default for UPSes without this field.'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'maxretry', _('Maximum Retries'), _('Maximum number of times to try starting a driver.'));
		o.optional = true;
		o.placeholder = 1
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'retrydelay', _('Retry Delay'), _('Time in seconds between driver start retry attempts.'));
		o.optional = true;
		o.placeholder = 5
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'pollinterval', _('Poll Interval'), _('Maximum time in seconds between refresh of UPS status'));
		o.optional = true;
		o.placeholder = 2
		o.datatype = 'uinteger';

		o = s.option(form.Flag, 'synchronous', _('Synchronous Communication'), _('Driver waits for data to be consumed by upsd before publishing more.'));
		o.optional = true;
		o.default = false;

		o = s.option(form.Value, 'user', _('RunAs User'), _('User as which to execute driver; requires device file accessed by driver to be read-write for that user.'));
		o.optional = true;
		o.placeholder = 'nut';

		// Drivers
		s = m.section(form.TypedSection, 'driver', _('Driver Configuration'),
			_('The name of this section will be used as UPS name elsewhere'));
		s.addremove = true;
		s.anonymous = false;

		o = s.option(form.Value, 'bus', _('USB Bus(es) (regex)'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'community', _('SNMP Community'));
		o.optional = true;
		o.placeholder = 'private';

		o = s.option(form.Value, 'desc', _('Description (Display)'));
		o.optional = true;

		o = s.option(form.ListValue, 'driver', _('Driver'),
			_('If this list is empty you need to %s'.format('<a href="/cgi-bin/luci/admin/system/package-manager?query=nut-driver-">%s</a>'.format(_('install drivers')))));
		driver_list.forEach(driver => {
			o.value(driver);
		});
		o.optional = false;

		o = s.option(form.Flag, 'enable_usb_serial', _('Set USB serial port permissions'),
			_('Enables a hotplug script that makes all ttyUSB devices (e.g. serial USB) group read-write as user %s'.format('<code>nut</code>')));
		o.optional = true;
		o.default = false;

		o = s.option(form.Flag, 'ignorelb', _('Ignore Low Battery'));
		o.optional = true;
		o.default = false;

		o = s.option(form.Flag, 'interruptonly', _('Interrupt Only'));
		o.optional = true;
		o.default = false;

		o = s.option(form.Value, 'interruptsize', _('Interrupt Size'), _('Bytes to read from interrupt pipe'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'maxreport', _('Max USB HID Length Reported'), _('Workaround for buggy firmware'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'maxstartdelay', _('Maximum Start Delay'), _('Time in seconds that upsdrvctl will wait for driver to finish starting'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = 45;

		o = s.option(form.Value, 'mfr', _('Manufacturer (Display)'));
		o.optional = true;

		o = s.option(form.Value, 'model', _('Model (Display)'));
		o.optional = true;

		o = s.option(form.Flag, 'nolock', _('No Lock'), _('Do not lock port when starting driver'));
		o.optional = true;
		o.default = false;

		o = s.option(form.Flag, 'notransferoids', _('No low/high voltage transfer OIDs'));
		o.optional = true;
		o.default = false;

		o = s.option(form.Value, 'offdelay', _('Off Delay(s)'), _('Delay for kill power command'));
		o.optional = true;
		o.placeholder = 20;
		// function o.validate(self, cfg, value);
		//    if n:cfgvalue(cfg) <= value then
		// 	return nil
		//    end
		// end

		o = s.option(form.Value, 'ondelay', _('On Delay(s)'), _('Delay to power on UPS if power returns after kill power'));
		o.optional = true;
		o.placeholder = 30;
		// function o.validate(self, cfg, value);
		//    if o.cfgvalue(cfg) >= value then
		// 	return nil
		//    end
		// end

		o = s.option(form.Value, 'pollfreq', _('Polling Frequency(s)'));
		o.optional = true;
		o.datatype = 'integer';
		o.placeholder = 30;

		o = s.option(form.Value, 'port', _('Port'));
		o.optional = false;
		o.default = 'auto';

		o = s.option(form.Value, 'product', _('Product (regex)'));
		o.optional = true;

		o = s.option(form.Value, 'productid', _('USB Product Id'));
		o.optional = true;

		o = s.option(form.Value, 'sdorder', _('Driver Shutdown Order'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'sdtime', _('Additional Shutdown Time(s)'));
		o.optional = true;

		o = s.option(form.Value, 'serial', _('Serial Number'));
		o.optional = true;

		o = s.option(form.Value, 'snmp_retries', _('SNMP retries'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'snmp_timeout', _('SNMP timeout(s)'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.ListValue, 'snmp_version', _('SNMP version'));
		o.optional = true;
		o.value('v1', _('SNMPv1'));
		o.value('v2c', _('SNMPv2c'));
		o.value('v3', _('SNMPv3'));
		o.value('', '');
		o.placeholder = ''

		o = s.option(form.Value, 'vendor', _('Vendor (regex)'));
		o.optional = true;

		o = s.option(form.Value, 'vendorid', _('USB Vendor Id'));
		o.optional = true;

		o = s.option(form.Flag, 'synchronous', _('Synchronous Communication'), _('Driver waits for data to be consumed by upsd before publishing more.'));
		o.optional = true;
		o.default = false;

		return m.render();
	}
});
