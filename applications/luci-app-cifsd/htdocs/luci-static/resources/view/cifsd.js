'use strict';
'require fs';
'require form';
'require tools.widgets as widgets';

return L.view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/sbin/block'), null),
			L.resolveDefault(fs.stat('/etc/config/fstab'), null),
		]);
	},
	render: function(stats) {
		var m, s, o;

		m = new form.Map('cifsd', _('Network Shares'));

		s = m.section(form.TypedSection, 'globals');
		s.anonymous = true;

		s.tab('general',  _('General Settings'));
		s.tab('template', _('Edit Template'));

		s.taboption('general', widgets.NetworkSelect, 'interface', _('Interface'),
			_('Listen only on the given interface or, if unspecified, on lan'));

		o = s.taboption('general', form.Value, 'workgroup', _('Workgroup'));
		o.placeholder = 'WORKGROUP';

		o = s.taboption('general', form.Value, 'description', _('Description'));
		o.placeholder = 'Cifsd on OpenWrt';

		o = s.taboption('template', form.TextValue, '_tmpl',
			_('Edit the template that is used for generating the cifsd configuration.'),
			_("This is the content of the file '/etc/cifs/smb.conf.template' from which your cifsd configuration will be generated. \
			Values enclosed by pipe symbols ('|') should not be changed. They get their values from the 'General Settings' tab."));
		o.rows = 20;
		o.cfgvalue = function(section_id) {
			return fs.trimmed('/etc/cifs/smb.conf.template');
		};
		o.write = function(section_id, formvalue) {
			return fs.write('/etc/cifs/smb.conf.template', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
		};


		s = m.section(form.TableSection, 'share', _('Shared Directories'),
			_('Please add directories to share. Each directory refers to a folder on a mounted device.'));
		s.anonymous = true;
		s.addremove = true;

		s.option(form.Value, 'name', _('Name'));
		o = s.option(form.Value, 'path', _('Path'));
		if (stats[0] && stats[1]) {
			o.titleref = L.url('admin', 'system', 'mounts');
		}

		o = s.option(form.Flag, 'browseable', _('Browse-able'));
		o.enabled = 'yes';
		o.disabled = 'no';
		o.default = 'yes';

		o = s.option(form.Flag, 'read_only', _('Read-only'));
		o.enabled = 'yes';
		o.disabled = 'no';
		o.default = 'yes';

		s.option(form.Flag, 'force_root', _('Force Root'));

		o = s.option(form.Value, 'users', _('Allowed users'));
		o.rmempty = true;

		o = s.option(form.Flag, 'guest_ok', _('Allow guests'));
		o.enabled = 'yes';
		o.disabled = 'no';
		o.default = 'no';

		o = s.option(form.Flag, 'inherit_owner', _('Inherit owner'));
		o.enabled = 'yes';
		o.disabled = 'no';
		o.default = 'no';

		s.option(form.Flag, 'hide_dot_files', _('Hide dot files'));

		o = s.option(form.Value, 'create_mask', _('Create mask'));
		o.rmempty = true;
		o.maxlength = 4;
		o.placeholder = '0666';

		o = s.option(form.Value, 'dir_mask', _('Directory mask'));
		o.rmempty = true;
		o.maxlength = 4;
		o.placeholder = '0777';

		return m.render();
	}
});
