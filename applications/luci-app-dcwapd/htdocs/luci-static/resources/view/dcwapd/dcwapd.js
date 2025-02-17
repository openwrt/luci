'use strict';

'require form';
'require rpc';
'require uci';
'require tools.widgets as widgets';
'require view';

return view.extend({

	callLuciWirelessDevices: rpc.declare({
		object: 'luci-rpc',
		method: 'getWirelessDevices',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			L.resolveDefault(L.uci.load('dcwapd'), {}),
			this.callLuciWirelessDevices(),
		]);
	},

	render: function(data) {
		var wireless_devices = data[1];

		var m = new form.Map('dcwapd', _('Dual Channel Wi-Fi AP Daemon'),
			_('With %s you can use two simultaneous Wi-Fi connections to decrease wireless traffic congestion and increase throughput.').format('<abbr title="%s">%s</abbr>').format(_('Dual Channel Wi-Fi AP Daemon'), _('Dual Channel WiFi')));

		// General section
		var s = m.section(form.NamedSection, 'general', _('General'), _('General Settings'));
		s.addremove = false;
		s.dynamic = false;
		s.optional = false;
		s.anonymous = true;

		// Enabled state option
		var enable = s.option(form.Flag, 'enabled', _('Enable'));
		enable.default = false;
		enable.optional = false;
		enable.rmempty = false;

		// Temp dir option
		var tmpdir = s.option(form.Value, 'tmpdir', _('Temp Directory'), _('Specify the temporary directory for dcwapd file storage.'));
		tmpdir.optional = false;
		tmpdir.rmempty = false;

		// Data channels section
		s = m.section(form.TypedSection, 'datachannel', _('Data Channels'), _('Define data channels over which outbound filtered packets will flow.'));
		s.anonymous = false;
		s.addremove = true;

		// SSID option
		var dat_ssid = s.option(form.Value, 'ssid', _('SSID'));
		dat_ssid.optional = false;
		dat_ssid.rmempty = false;
		if (wireless_devices.length > 0) {
			Object.values(wireless_devices).forEach(function (radio) {
				radio?.interfaces?.forEach(function(_if) {
					dat_ssid.value(_if?.config?.ssid ?? 'unknown_ssid');
				});
			});
		} else {
			dat_ssid.value('-');
		}

		// Data bridge option
		var dat_bridge = s.option(widgets.DeviceSelect, 'bridge', _('Bridge'));
		dat_bridge.optional = false;
		dat_bridge.rmempty = false;
		dat_bridge.nocreate = false;
		dat_bridge.noaliases = true;
		dat_bridge.filter = function(section, value) {
			if(value.startsWith('br-'))
				return true;
		}

		// Data interfaces list
		var ifaces = s.option(form.MultiValue, 'interfaces', _('Interfaces'));
		ifaces.optional = true;
		ifaces.rmempty = false;
		if (wireless_devices.length > 0) {
			Object.values(wireless_devices).forEach(function (radio) {
				radio?.interfaces?.forEach(function(_if) {
					ifaces.value(_if?.ifname ?? 'unknown_if_name');
				});
			});
		} else {
			ifaces.value('lo');
		}

		// Channel sets section
		s = m.section(form.TypedSection, 'channel-set', _('Channel Sets'), _('Define primary channels and their corresponding data channels.'));
		s.addremove = true;
		s.dynamic = false;
		s.optional = false;
		s.anonymous = false;

		// Enabled state option
		var enable = s.option(form.Flag, 'enabled', _('Enable'));
		enable.default = false;
		enable.optional = false;
		enable.rmempty = false;

		// SSID option
		var pri_ssid = s.option(form.Value, 'ssid', _('SSID'));
		pri_ssid.optional = false;
		pri_ssid.rmempty = false;
		if (wireless_devices.length > 0) {
			Object.values(wireless_devices).forEach(function (radio) {
				radio?.interfaces?.forEach(function(_if) {
					pri_ssid.value(_if?.config?.ssid ?? 'unknown_ssid');
				});
			});
		} else {
			pri_ssid.value('-');
		}

		// Primary bridge option
		var pri_bridge = s.option(widgets.DeviceSelect, 'bridge', _('Bridge'));
		pri_bridge.optional = false;
		pri_bridge.rmempty = false;
		pri_bridge.nocreate = true;
		pri_bridge.noaliases = true;
		pri_bridge.filter = function(section, value) {
		if (value.startsWith('br-'))
				return true;
		}

		// Data channels list
		var data_channels = s.option(form.MultiValue, 'data_channels', _('Data Channels'));
		data_channels.optional = false;
		data_channels.rmempty = false;
		const dataChannels = L.uci.sections('dcwapd', 'datachannel');
		if (dataChannels.length > 0) {
			Object.values(dataChannels).forEach(function (dc) {
				if(dc['.name'])
					data_channels.value(dc['.name']);
			});
		} else {
			data_channels.value('err: no data_channels');
		}

		// Filters section
		s = m.section(form.TableSection, 'filter', _('Filters'), _('Define filter rules to apply to outbound packets. Matching packets will flow over the data channel.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;

		// Packet Size
		var packetsize = s.option(form.Value, 'packet_size', _('Packet size'));
		packetsize.rmempty = false;
		packetsize.value('*');
		packetsize.default = '*';

		// Source IP
		var srcip = s.option(form.Value, 'source_ip', _('Source IP'));
		srcip.rmempty = false;
		srcip.value('*');
		srcip.default = '*';

		// Source Port
		var srcport = s.option(form.Value, 'source_port', _('Source port'));
		srcport.rmempty = false;
		srcport.value('*');
		srcport.default = '*';

		// Protocol
		var proto = s.option(form.Value, 'protocol', _('Protocol'));
		proto.value('*');
		proto.value('tcp', 'TCP');
		proto.value('udp', 'UDP');
		proto.value('icmp', 'ICMP');
		proto.rmempty = false;
		proto.default = '*';

		// Destination Port
		var dstport = s.option(form.Value, 'dest_port', _('Destination port'));
		dstport.rmempty = false;
		dstport.value('*');
		dstport.default = '*';

		// Filter sets section
		s = m.section(form.TypedSection, 'filter-set', _('Filter Sets'), _('Select filters to apply to matching MAC addresses.'));
		s.addremove = true;
		s.dynamic = false;
		s.anonymous = false;
		s.optional = false;

		// MAC address option
		var mac = s.option(form.Value, 'mac', _('MAC Address'));
		mac.optional = false;
		mac.rmempty = false;
		mac.datatype = 'or(macaddr,"*")';

		// Filters list
		var filters = s.option(form.MultiValue, 'filters', _('Filters'));
		filters.optional = false;
		filters.rmempty = false;
		const filterSections = L.uci.sections('dcwapd', 'filter');
		if (filterSections.length > 0) {
			Object.values(filterSections).forEach(function (element) {
				if(element['.name'])
					filters.value(element['.name']);
			});
		} else {
			filters.value('err: no filters');
		}

		return m.render();
	},
});
