'use strict';
'require view';
'require form';
'require rpc';

return view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			this.callHostHints(),
		]);
	},

	render: function(data) {
		var hosts = data[0];
		var m, s, o;

		m = new form.Map('keepalived');

		s = m.section(form.GridSection, 'peer', _('Peers'),
			_('Peers can be referenced into Instances cluster and data/config synchronization'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.optional = false;
		o.placeholder = 'name';

		o = s.option(form.Value, 'address', _('Peer Address'));
		o.optional = false;
		o.rmempty = false;
		o.datatype = 'ipaddr';
		for(var mac in hosts) {
			if (hosts[mac]['ipaddrs'] == 'undefined') {
				continue;
			}
			for(var i = 0; i < hosts[mac]['ipaddrs'].length; i++) {
				o.value(hosts[mac]['ipaddrs'][i]);
			}
		}

		o = s.option(form.Flag, 'sync', _('Enable Sync'),
			_('Auto Synchonize Config/Data files with peer'));

		o = s.option(form.ListValue, 'sync_mode', _('Sync Mode'),
			_('Current System should act as Sender/Receiver.') + '<br/>' +
			_('If peer is backup node, Current system should be sender, If peer is master current system should be receiver'));
		o.value('send', _('Sender'));
		o.value('receive', _('Receiver'));
		o.default = 'send';
		o.depends({ 'sync' : '1' });

		o = s.option(form.Value, 'ssh_port', _('SSH Port'),
			_('If peer runs on non standard ssh port, change to correct ssh port number'));
		o.datatype = 'port';
		o.default = '22';
		o.modalonly = true;
		o.depends({ 'sync' : '1', 'sync_mode' : 'send' });

		o = s.option(form.Value, 'sync_dir', _('Sync Directory'),
			_('Sender will send files to this location of receiver. Must be same on Master/Backup'));
		o.default = '/usr/share/keepalived/rsync';
		o.optional = false;
		o.rmempty = false;
		o.modalonly = true;
		o.datatype = 'directory';
		o.depends({ 'sync' : '1' });

		o = s.option(form.FileUpload, 'ssh_key', _('Path to SSH Private Key'),
			_('Use SSH key for password less authentication, SSH Key would be used on current system'));
		o.root_directory = '/etc/keepalived/keys';
		o.enable_upload = true;
		o.modalonly = true;
		o.datatype = 'file';
		o.depends({ 'sync' : '1', 'sync_mode' : 'send' });
	
		o = s.option(form.TextValue, 'ssh_pubkey', _('SSH Public Key'),
			_('Authorize ssh public key of peer'));
		o.datatype = 'string';
		o.modalonly = true;
		o.depends({ 'sync' : '1', 'sync_mode' : 'receive' });

		o = s.option(form.DynamicList, 'sync_list', _('Sync Files'),
			_('Additional files to synchronize, By default it synchronizes sysupgrade backup files'));
		o.datatype = 'file';
		o.modalonly = true;
		o.depends({ 'sync' : '1', 'sync_mode' : 'send' });

		return m.render();
	}
});
