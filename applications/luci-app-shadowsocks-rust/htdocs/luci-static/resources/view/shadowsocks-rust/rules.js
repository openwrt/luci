/*
 * Copyright (C) 2026 Jove Yu <yushijun110@gmail.com>
 *
 * This is free software, licensed under the GNU General Public License v3.
 * See /LICENSE for more information.
 */

'use strict';
'require view';
'require form';
'require uci';

var conf = 'shadowsocks-rust';

function src_dst_option(s /*, ... */) {
	var o = s.taboption.apply(s, L.varargs(arguments, 1));
	o.datatype = 'or(ipaddr,cidr)';
}

return view.extend({
	load: function() {
		return uci.load(conf).then(function() {
			if (!uci.get_first(conf, 'rules')) {
				uci.set(conf, uci.add(conf, 'rules', 'rules'), 'disabled', '1');
			}
		});
	},
	render: function() {
		var m, s, o;

		m = new form.Map(conf, _('Rules'),
			_('Configure traffic routing rules for transparent proxy. \
				If enabled, packets will first have their source IP addresses checked \
				against <em>Source IPs to Bypass</em>, <em>Source IPs to Forward</em>, \
				<em>Source IPs to Check Destination</em> and if none matches \
				<em>Source Default Policy</em> will give the default action to be taken. \
				If the prior check results in action <em>Check Destination</em>, packets will \
				continue to have their destination addresses checked.'));

		s = m.section(form.NamedSection, 'rules', 'rules');
		s.tab('general', _('General'));
		s.tab('src', _('Source'));
		s.tab('dst', _('Destination'));

		s.taboption('general', form.Flag, 'disabled', _('Disable'));

		o = s.taboption('general', form.ListValue, 'redir_tcp',
			_('TCP Redirect'));
		o.value('', _('None'));
		uci.sections(conf, 'local', function(sdata) {
			if (sdata.protocol === 'redir' && sdata['.name']) {
				var port = sdata.local_port || 'N/A';
				o.value(sdata['.name'], sdata['.name'] + ' (:' + port + ')');
			}
		});

		o = s.taboption('general', form.ListValue, 'redir_udp',
			_('UDP Redirect'));
		o.value('', _('None'));
		uci.sections(conf, 'local', function(sdata) {
			if (sdata.protocol === 'redir' && sdata['.name']) {
				var port = sdata.local_port || 'N/A';
				o.value(sdata['.name'], sdata['.name'] + ' (:' + port + ')');
			}
		});

		o = s.taboption('general', form.ListValue, 'local_default',
			_('Local Default'),
			_('Default action for locally generated TCP packets'));
		o.value('bypass', _('Bypass'));
		o.value('forward', _('Forward'));
		o.value('checkdst', _('Check Destination'));
		o.default = 'bypass';

		o = s.taboption('general', form.Value, 'ifnames',
			_('Interfaces'),
			_('Only apply rules on packets from these network interfaces'));
		o.placeholder = 'wan';

		s.taboption('general', form.Value, 'nft_tcp_extra',
			_('Extra TCP expression'),
			_('Extra nftables expression for matching tcp traffics, e.g. "tcp dport { 80, 443 }"'));

		s.taboption('general', form.Value, 'nft_udp_extra',
			_('Extra UDP expression'),
			_('Extra nftables expression for matching udp traffics, e.g. "udp dport { 53 }"'));

		src_dst_option(s, 'src', form.DynamicList, 'src_ips_bypass',
			_('Bypass'),
			_('Bypass ss-redir for packets with source address in this list'));
		src_dst_option(s, 'src', form.DynamicList, 'src_ips_forward',
			_('Forward'),
			_('Forward through ss-redir for packets with source address in this list'));
		src_dst_option(s, 'src', form.DynamicList, 'src_ips_checkdst',
			_('Check Destination'),
			_('Continue to have destination address checked for packets with source address in this list'));

		o = s.taboption('src', form.ListValue, 'src_default',
			_('Default Policy'),
			_('Default action for packets whose source address do not match any of the source ip/net list'));
		o.value('bypass', _('Bypass'));
		o.value('forward', _('Forward'));
		o.value('checkdst', _('Check Destination'));
		o.default = 'checkdst';

		src_dst_option(s, 'dst', form.DynamicList, 'dst_ips_bypass',
			_('Bypass'),
			_('Bypass ss-redir for packets with destination address in this list'));
		src_dst_option(s, 'dst', form.DynamicList, 'dst_ips_forward',
			_('Forward'),
			_('Forward through ss-redir for packets with destination address in this list'));

		var dir = '/etc/shadowsocks-rust';
		o = s.taboption('dst', form.FileUpload, 'dst_ips_bypass_file',
			_('Bypass File'),
			_('File containing IP/net for the purposes as with <em>Destination IPs to Bypass</em>'));
		o.root_directory = dir;

		o = s.taboption('dst', form.FileUpload, 'dst_ips_forward_file',
			_('Forward File'),
			_('File containing IP/net for the purposes as with <em>Destination IPs to Forward</em>'));
		o.root_directory = dir;

		o = s.taboption('dst', form.ListValue, 'dst_default',
			_('Default Policy'),
			_('Default action for packets whose destination address do not match any of the destination ip list'));
		o.value('bypass', _('Bypass'));
		o.value('forward', _('Forward'));
		o.default = 'bypass';

		return m.render();
	}
});
