'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

// The Thread radio is a tun-like netdev with no DEVTYPE in sysfs, so the
// generic Device class falls back to the ethernet icon. Own the device
// instances (same pattern as luci-proto-relay) so the interface list shows
// a wireless icon and a meaningful type.
var ThreadDevice = {
	getType: function() {
		return 'wifi';
	},

	getTypeI18n: function() {
		return _('Thread Radio');
	}
};

function threadDev(proto, name) {
	var m = name ? name.match(/^([^:/]+)/) : null;
	return m ? network.instantiateDevice(m[1], proto, ThreadDevice) : null;
}

network.registerErrorCode('MISSING_BACKBONE_NETWORK', _('Backbone network is not configured'));
network.registerErrorCode('MISSING_BACKBONE_IFNAME',  _('Unable to determine the backbone network device'));
network.registerErrorCode('MISSING_DEVICE',           _('Thread network device is not configured'));
network.registerErrorCode('MISSING_RADIO_URL',        _('Radio URL is not configured'));
network.registerErrorCode('MISSING_SVC_MDNSD',        _('The mdnsd service is not running'));
network.registerErrorCode('MISSING_UBUS_OBJ',         _('Unable to reach the otbr ubus object'));

return network.registerProtocol('openthread', {
	getI18n: function() {
		return _('Thread');
	},

	getDevice: function() {
		return threadDev(this, this._get('device'));
	},

	getL2Device: function() {
		return threadDev(this, this._ubus('device'));
	},

	getL3Device: function() {
		return threadDev(this, this._ubus('l3_device'));
	},

	getPackageName: function() {
		return 'openthread-br';
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', widgets.NetworkSelect, 'backbone_network',
			_('Backbone network'),
			_('The network whose interface carries mDNS, TREL and border routing for the Thread mesh; usually the LAN.'));
		o.exclude = s.section;
		o.nocreate = true;
		o.rmempty = false;

		// no_device makes this protocol virtual, so the stock device picker
		// is inactive here -- and an inactive picker deletes the option on
		// save. Aliasing an own option onto `device` keeps the field
		// editable and, through the sibling-alias guard in
		// AbstractValue.remove(), stops the picker from unsetting it.
		o = s.taboption('general', form.Value, '_thread_device',
			_('Thread network device'),
			_('Name of the network device otbr-agent creates for the Thread interface.'));
		o.ucioption = 'device';
		o.rmempty = false;
		o.placeholder = 'wpan0';

		o = s.taboption('general', form.Value, 'radio_url',
			_('Radio URL'),
			_('How otbr-agent reaches the 802.15.4 radio.'));
		o.rmempty = false;
		o.placeholder = 'spinel+hdlc+uart:///dev/ttyACM0?uart-baudrate=460800';

		o = s.taboption('advanced', form.Value, 'dataset',
			_('Operational dataset'),
			_('Hex-encoded active operational dataset committed at startup. Usually left empty: the network is formed or joined from the OpenThread application instead.'));
		o.optional = true;
		o.datatype = 'hexstring';
		o.password = true;

		o = s.taboption('advanced', form.DynamicList, 'prefix',
			_('On-mesh prefixes'),
			_('Prefixes announced to the Thread network.'));
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'verbose',
			_('Verbose logging'));
		o.optional = true;
	}
});
