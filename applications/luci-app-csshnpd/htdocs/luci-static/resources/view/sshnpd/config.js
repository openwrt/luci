'use strict';
'require view';
'require form';

function normalizeAtsign(s) {
	if (!s)
		return '';
	s = s.trim().toLowerCase();
	if (s.length === 0)
		return '';
	return s.startsWith('@') ? s : '@' + s;
}

function validateAtsign(section_id, value) {
	if (!value || value.trim().length < 1) {
		return _('Must not be empty and should start with @ (e.g., "@a").');
	}

	if (value.indexOf(',') !== -1) {
		return _('Device atSign must be a single atSign.');
	}

	let mgr = this.section ? this.section.getOption('manager') : null;
	if (mgr) {
		mgr.triggerValidation(section_id);
	}

	return true;
}

function validateManager(section_id, value) {
	if (!value || value.trim().length < 1) {
		return _('Must not be empty and should start with @ (e.g., "@a").');
	}

	let devOpt = this.section ? this.section.getOption('atsign') : null;
	let devAtsign = null;
	if (devOpt) {
		devAtsign = devOpt.formvalue(section_id);
		if (devAtsign == null) {
			devAtsign = devOpt.cfgvalue(section_id);
		}
		if (devAtsign == null) {
			devAtsign = devOpt.default;
		}
	}

	let normDev = normalizeAtsign(devAtsign);

	let managers = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
	if (managers.length === 0) {
		return _('Must not be empty and should start with @ (e.g., "@a").');
	}

	if (normDev && normDev !== '@') {
		for (let mgr of managers) {
			if (normalizeAtsign(mgr) === normDev) {
				return _('Manager atSign must not be the same as Device atSign.');
			}
		}
	}

	return true;
}

function validateDevice(section_id, value) {
	if (value.length < 1) {
		return _('Must be at least one character long (e.g., "a").');
	}
	if (value.length == 1) {
		if (!/^[a-z]+$/.test(value)) {
			return _('First character should be a lowercase letter (e.g., "a").');
		} else {
			return true;
		}
	}
	if (!/^[a-z][a-z0-9_-]+$/.test(value)) {
		return _('Device names may contain a-z 0-9 _ or - (e.g., "my_thing1").');
	}
	if (value.length > 36) {
		return _('Maximum device name length is 36 characters.');
	}
	return true;
}

function validateOTP(section_id, value) {
	if (value.length != 6) {
		return _('Must be six characters (e.g., "S3CR3T").');
	}
	return true;
}

function firstAt(section_id, value) {
	if (value) {
		value = value.trim();
		if (!value.startsWith('@')) {
			value = '@' + value; // Ensure @ at start
		}
	}
	return this.super('write', [section_id, value]);
}

function writeManager(section_id, value) {
	if (value) {
		let list = value.split(',')
			.map(s => s.trim())
			.filter(s => s.length > 0)
			.map(s => s.startsWith('@') ? s : '@' + s);
		value = list.join(',');
	}
	return this.super('write', [section_id, value]);
}

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('sshnpd', _('NoPorts'),
			_('Daemon Configuration'));

		s = m.section(form.TypedSection, 'sshnpd', _('sshnpd config'));
		s.anonymous = true;

		o = s.option(form.Value, 'atsign', _('Device atSign'),
			_('The device atSign e.g. @device'));
		o.default = '@device';
		o.validate = validateAtsign;
		o.write = firstAt;

		o = s.option(form.Value, 'manager', _('Manager atSign'),
			_('The manager atSign e.g. @manager'));
		o.default = '@manager';
		o.validate = validateManager;
		o.write = writeManager;

		o = s.option(form.Value, 'device', _('Device name'),
			_('The name for this device e.g. openwrt'));
		o.default = 'openwrt';
		o.validate = validateDevice;

		s.option(form.Value, 'args', _('Additional arguments'),
			_('Further command line arguments for the NoPorts daemon'));

		o = s.option(form.Value, 'otp', _('Enrollment OTP/SPP'),
			_('One Time Passcode (OTP) for device atSign enrollment'));
		o.default = '000000';
		o.validate = validateOTP;

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Check here to enable the service'));
		o.default = '1';
		o.rmempty = false;

		return m.render();
	},
});
