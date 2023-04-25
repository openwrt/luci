'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('keepalived');

		s = m.section(form.TypedSection, 'globals', _('Keepalived Global Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'router_id', _('Router ID'),
			_('String identifying the machine (doesn\'t have to be hostname)'));
		o.optional = true;
		o.placeholder = 'OpenWrt';

		o = s.option(form.Flag, 'linkbeat_use_polling', _('Link Polling'),
			_('Poll to detect media link failure using ETHTOOL, MII or ioctl interface otherwise uses netlink interface'));
		o.optional = true;
		o.default = true;

		o = s.option(form.DynamicList, 'notification_email', _('Notification E-Mail'),
			_('EMail accounts that will receive the notification mail'));
		o.optional = true;
		o.placeholder = 'admin@example.com';

		o = s.option(form.Value, 'notification_email_from', _('Notification E-Mail From'),
			_('Email to use when processing “MAIL FROM:” SMTP command'));
		o.optional = true;
		o.placeholder = 'admin@example.com';

		o = s.option(form.Value, 'smtp_server', _('SMTP Server'),
			_('Server to use for sending mail notifications'));
		o.optional = true;
		o.placeholder = '127.0.0.1 [<PORT>]';

		o = s.option(form.Value, 'smtp_connect_timeout', _('SMTP Connect Timeout'),
			_('Timeout in seconds for SMTP stream processing'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = '30';

		o = s.option(form.Value, 'vrrp_mcast_group4', _('VRRP Multicast Group 4'),
			_('Multicast Group to use for IPv4 VRRP adverts'));
		o.optional = true;
		o.datatype = 'ip4addr';
		o.placeholder = '224.0.0.18';

		o = s.option(form.Value, 'vrrp_mcast_group6', _('VRRP Multicast Group 6'),
			_('Multicast Group to use for IPv6 VRRP adverts'));
		o.optional = true;
		o.datatype = 'ip6addr';
		o.placeholder = 'ff02::12';

		o = s.option(form.Value, 'vrrp_startup_delay', _('VRRP Startup Delay'),
			_('Delay in seconds before VRRP instances start up after'));
		o.optional = true;
		o.datatype = 'float';
		o.placeholder = '5.5';

		return m.render();
	}
});
