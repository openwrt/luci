'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('firewall', _('Firewall - Ipsets'),
			_('IPsets is great for collecting a large set of IP addresses/networks under one label and then using the label in subsequent rules as a single match criteria.'));

		s = m.section(form.GridSection, 'ipset');
		s.addremove = true;
		s.anonymous = true;


		o = s.tab("general", _("General Settings"));
		o = s.tab("advanced", _('Advanced Settings'));

		o = s.taboption('general', form.Flag, 'enabled',
			_('Enabled'),
			_('Allows to disable the declaration of the ipset without the need to delete the section.'));
		o.modalonly = true;
		o.rmempty = false;
		o.default = true;

		o = s.taboption('general', form.Flag, 'reload_set',
			_('Recreating'),
			_('Reloading, or recreating, ipsets on firewall reload. If not enabled ipset will create once and never changed on update except on boot.'));
		o.modalonly = true;
		o.rmempty = true;
		o.default = false;

		o = s.taboption('advanced', form.Value, 'external',
			_('External'),
			_('If the external option is set to a name, the firewall will simply reference an already existing ipset pointed to by the name.'));
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'name',
			_('Name'),
			_('Specifies the firewall internal name of the ipset which is used to reference the set.'));
		o.rmempty = false;

		o = s.taboption('general',form.ListValue, 'storage',
			_('Storage method'),
			_('Specifies the storage method used by the ipset.'));
		o.value('hash', _('Hash'));
		o.value('bitmap', _('Bitmap'));
		o.value('list', _('List'));
		o.default = 'hash';

		o = s.taboption('general', form.ListValue, 'family',
			_('Protocal family'),
			_('Protocol family to create ipset for.'));
		o.value('', _('Any'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.depends('storage', 'hash');
		o.depends('storage', 'list');
		o.default = 'ipv4'
		o.modalonly = true;

		// @todo value must be set in dependency of storage
		o = s.taboption('general', form.DynamicList, 'match',
			_('Match'),
			_('Specifies the matching data types and their direction.'));
		o.depends('storage', 'hash');
		o.depends('storage', 'bitmap');
		o.value('src_ip', _('Source IP'));
		o.value('dest_ip', _('Destination IP'));
		o.value('src_port', _('Source Port'));
		o.value('dest_port', _('Destination Port'));
		o.value('src_mac', _('Source MAC'));
		o.value('dest_mac',_('Destination MAC'));
		o.value('src_net', _('Source Net'));
		o.value('dest_net', _('Destination Net'));
//		if storage is list then change dropdown with list and not with src_* / dest_*

		o = s.taboption('general', form.Value, 'iprange',
			_('IP range'),
			_('Specifies the IP range to cover.'));
		o.depends('storage', 'bitmap');
		o.rmempty = false;
		o.modalonly = true;
//		o.validate add validation if match is ip

		o = s.taboption('general', form.Value, 'portrange',
			_('Port range'),
			_('Specifies the port range to cover.'));
		o.depends('storage', 'bitmap');
		o.rmempty = false;
		o.modalonly = true;
//		o.validate add validation if match is port
//		o.datatype add datatype '1-20'

		o = s.taboption('advanced', form.Value, 'netmask',
			_('Netmask'),
			_('Network addresses will be stored in the set instead of IP host addresses.'));
		o.depends('storage', 'hash');
		o.depends('storage', 'bitmap');
		o.datatype = 'range(1-32)';
		o.modalonly = true;
//		o.validate add validation if match is ip

		o = s.taboption('advanced', form.Value, 'maxelem',
			_('Max entries'),
			_('Limits the number of items that can be added to the set (default 65536).'));
		o.depends('storage', 'hash');
		o.depends('storage', 'list');
		o.datatype = 'uinteger';
		o.modalonly = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'hashsize',
			_('Hashsize'),
			_('Specifies the initial hash size of the set (default 1024).'));
		o.depends('storage', 'hash');
		o.rmempty = true
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'timeout',
			_('Timeout'),
			_('Specifies the default timeout in seconds for entries added to this ipset (default no timeout).'));
		o.datatype = 'uinteger';
		o.default = ''
		o.rmempty = true
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, 'entry',
			_('Entry'),
			_('List of entries in the Ipset.'));
		o.modalonly = true;
//		o.validate add validation depending on match and storage

		o = s.taboption('advanced', form.Value, 'loadfile',
			_('File'),
			_('Such an external file contain entries that where populated by other programs.'));
		o.datatype = 'file'
		o.modalonly = true;

		return m.render()
	}
});
