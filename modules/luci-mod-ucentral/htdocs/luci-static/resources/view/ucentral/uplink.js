'use strict';
'require view';
'require form';
'require fs';
'require tools.ucentral as uctool';

var profile = null;

function serialize(data) {
	if (data.broadband.protocol != 'default')
		profile.broadband = Object.assign({}, data.broadband);
	else
		delete profile.broadband;

	return JSON.stringify(profile, function(key, val) {
		return (key.charAt(0) != '.') ? val : undefined;
	}, '\t');
}

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read('/etc/ucentral/profile.json'), '').then(function(data) {
			try { profile = JSON.parse(data); }
			catch(e) { profile = {}; };

			if (!L.isObject(profile.broadband))
				profile.broadband = { protocol: 'default' };
		});
	},

	render: function() {
		var m, s, o, data = { broadband: {} };

		m = new form.JSONMap(data);
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'broadband', 'broadband', _('Uplink configuration'),
			_('The uplink settings allow overriding the WAN connection properties of the local device.'));

		o = s.option(form.ListValue, 'protocol', _('Connection'));
		o.value('default', _('Use default cloud settings'));
		o.value('static', _('Static address configuration'));
		o.value('dhcp', _('Address configuration via DHCP'));
		o.value('pppoe', _('Address configuration via PPPoE'));
		o.value('wwan', _('Cellular network connection'));

		o = s.option(form.ListValue, 'modem-type', _('Modem type'));
		o.depends('protocol', 'wwan');
		o.value('wwan', _('Automatic', 'Automatic modem type selection'));
		o.value('mbim', 'MBIM');
		o.value('qmi', 'QMI');

		o = s.option(form.Value, 'access-point-name', _('APN', 'Cellular access point name'));
		o.depends('protocol', 'wwan');
		o.validate = function(section_id, value) {
			if (!/^[a-zA-Z0-9\-.]*[a-zA-Z0-9]$/.test(value))
				return _('Invalid APN provided');

			return true;
		};

		o = s.option(form.Value, 'pin-code', _('PIN'));
		o.depends('protocol', 'wwan');
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';

		o = s.option(form.ListValue, 'authentication-type', _('Authentication'));
		o.depends('protocol', 'wwan');
		o.value('', _('No authentication'));
		o.value('pap-chap', 'PAP/CHAP');
		o.value('chap', 'CHAP');
		o.value('pap', 'PAP');

		o = s.option(form.Value, 'user-name', _('Username'));
		o.depends('authentication-type', 'pap-chap');
		o.depends('authentication-type', 'chap');
		o.depends('authentication-type', 'pap');
		o.depends('protocol', 'pppoe');

		o = s.option(form.Value, 'password', _('Password'));
		o.depends('authentication-type', 'pap-chap');
		o.depends('authentication-type', 'chap');
		o.depends('authentication-type', 'pap');
		o.depends('protocol', 'pppoe');
		o.password = true;

		o = s.option(form.Value, 'ipv4-address', _('IPv4 Address'), _('Address and mask in CIDR notation.'));
		o.depends('protocol', 'static');
		o.datatype = 'or(cidr4,ipnet4)';
		o.rmempty = false;

		o = s.option(form.Value, 'ipv4-gateway', _('IPv4 Gateway'));
		o.depends('protocol', 'static');
		o.datatype = 'ip4addr("nomask")';
		o.rmempty = false;

		o = s.option(form.Value, 'ipv6-address', _('IPv6 Address'), _('Address and mask in CIDR notation.'));
		o.depends('protocol', 'static');
		o.datatype = 'or(cidr6,ipnet6)';

		o = s.option(form.Value, 'ipv6-gateway', _('IPv6 Gateway'));
		o.depends('protocol', 'static');
		o.datatype = 'ip6addr("nomask")';

		o = s.option(form.DynamicList, 'use-dns', _('DNS Servers'));
		o.depends('protocol', 'static');
		o.datatype = 'ipaddr("nomask")';

		for (var i = 0; i < s.children.length; i++)
			data.broadband[s.children[i].option] = profile.broadband[s.children[i].option];

		return m.render();
	},

	handleSave: uctool.save.bind(uctool, serialize),

	handleSaveApply: null,
	handleReset: null
});
