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

	renderTrackScript: function(m) {
		var s, o;
		var vrrp_scripts;

		vrrp_scripts = uci.sections('keepalived', 'vrrp_script');
		if (vrrp_scripts == '') {
			ui.addNotification(null, E('p', _('VRRP Scripts must be configured for Track Scripts')));
		}

		s = m.section(form.GridSection, 'track_script', _('Track Script'),
			_('Tracking scripts would be referenced from VRRP instances'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.optional = false;
		o.rmempty = false;

		o = s.option(form.ListValue, 'value', _('VRRP Script'));
		o.optional = false;
		o.rmempty = false;
		if (vrrp_scripts != '') {
			for (i = 0; i < vrrp_scripts.length; i++) {
				o.value(vrrp_scripts[i]['name']);
			}
		}

		o = s.option(form.Value, 'weight', _('Weight'));
		o.optional = true;
		o.datatype = 'and(integer, range(-253, 253))';

		o = s.option(form.ListValue, 'direction', _('Direction'));
		o.optional = true;
		o.default = '';
		o.value('reverse', _('Reverse'));
		o.value('noreverse', _('No Reverse'));
	},

	renderVRRPScript: function(m) {
		var s, o;

		s = m.section(form.GridSection, 'vrrp_script', _('VRRP Script'),
			_('Adds a script to be executed periodically. Its exit code will be recorded for all VRRP instances and sync groups which are monitoring it'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.optional = true;
		o.placeholder = 'name';

		o = s.option(form.FileUpload, 'script', _('Script'),
			_('Path of the script to execute'));
		o.root_directory = '/etc/keepalived/scripts';
		o.enable_upload = true;
		o.optional = true;
		o.datatype = 'file';

		o = s.option(form.Value, 'interval', _('Interval'),
			_('Seconds between script invocations'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.default = 60;

		o = s.option(form.Value, 'weight', _('Weight'),
			_('Adjust script execution priority'));
		o.optional = true;
		o.datatype = 'and(integer, range(-253, 253))';

		o = s.option(form.Value, 'rise', _('Rise'),
			_('Required number of successes for OK transition'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'fail', _('Fail'),
			_('Required number of successes for KO transition'));
		o.optional = true;
		o.datatype = 'uinteger';
	},

	render: function() {
		var m;

		m = new form.Map('keepalived');

		this.renderVRRPScript(m);
		this.renderTrackScript(m);

		return m.render();
	}

});
