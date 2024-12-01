'use strict';
'require view';
'require ui';
'require form';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('keepalived'),
		]);
	},

	render: function(data) {
		let m, s, o;
		var instances;

		instances = uci.sections('keepalived', 'vrrp_instance');
		if (instances == '' || instances.length < 1) {
			ui.addNotification(null, E('p', _('Instances must be configured for VRRP Groups')));
		}

		m = new form.Map('keepalived');

		s = m.section(form.GridSection, 'vrrp_sync_group', _('VRRP synchronization group'),
			_('VRRP Sync Group is an extension to VRRP protocol.') + '<br/>' +
			_('The main goal is to define a bundle of VRRP instance to get synchronized together') + '<br/>' +
			_('so that transition of one instance will be reflected to others group members'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.optional = false;
		o.placeholder = 'name';

		o = s.option(form.DynamicList, 'group', _('Instance Group'));
		o.rmempty = false;
		o.optional = false;
		for (var i = 0; i < instances.length; i++) {
			o.value(instances[i]['name']);
		}

		o = s.option(form.Flag, 'smtp_alert', _('Email Notification'),
			_('Send email notification during state transition'));
		o.optional = true;
		o.default = false;

		o = s.option(form.Flag, 'global_tracking', _('Global Tracking'),
			_('Track interfaces, scripts and files'));
		o.optional = true;
		o.default = false;

		return m.render();
	}
});
