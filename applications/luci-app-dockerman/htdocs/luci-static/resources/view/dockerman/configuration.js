'use strict';
'require form';
'require fs';

/* 
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
Based on Docker Lua by lisaac <https://github.com/lisaac/luci-app-dockerman>
LICENSE: GPLv2.0
*/


return L.view.extend({
	render() {
		const m = new form.Map('dockerd', _('Docker - Configuration'),
			_('DockerMan is a simple docker manager client for LuCI'));

		let o, t, s, ss;

		s = m.section(form.NamedSection, 'globals', 'section', _('Global settings'));

		t = s.tab('globals', _('Globals'));

		o = s.taboption('globals', form.Value, 'ps_flags',
			_('Default ps flags'),
			_('Flags passed to docker top (ps). Leave empty to use the built-in default.'));
		o.placeholder = '-ww';
		o.rmempty = true;
		o.optional = true;

		o = s.taboption('globals', form.Value, 'api_version',
			_('Api Version'),
			_('Lock API endpoint to a specific version (helps guarantee behaviour).') + '<br/>' +
			_('Causes errors when a chosen API > Docker endpoint API support.'));
		o.rmempty = true;
		o.optional = true;
		o.value('v1.44');
		o.value('v1.45');
		o.value('v1.46');
		o.value('v1.47');
		o.value('v1.48');
		o.value('v1.49');
		o.value('v1.50');
		o.value('v1.51');
		o.value('v1.52');

		// Check if local dockerd is available
		o = s.taboption('globals', form.DirectoryPicker, 'data_root', _('Docker Root Dir'),
			_('For local dockerd socket instances only.'));
		o.datatype = 'folder';
		o.default = '/opt/docker';
		o.root_directory = '/';
		o.show_hidden = true;

		o = s.taboption('globals', form.Value, 'bip',
			_('Default bridge'),
			_('Configure the default bridge network'));
		o.placeholder = '172.17.0.1/16';
		o.datatype = 'ipaddr';

		o = s.taboption('globals', form.DynamicList, 'registry_mirrors',
			_('Registry Mirrors'),
			_('It replaces the daemon registry mirrors with a new set of registry mirrors'));
		o.placeholder = _('Example: ') + 'https://hub-mirror.c.163.com';
		o.value('https://docker.io');
		o.value('https://ghcr.io');
		o.value('https://hub-mirror.c.163.com');

		o = s.taboption('globals', form.ListValue, 'log_level',
			_('Log Level'),
			_('Set the logging level'));
		o.value('debug', _('Debug'));
		o.value('', _('Info')); // default
		o.value('warn', _('Warning'));
		o.value('error', _('Error'));
		o.value('fatal', _('Fatal'));
		o.rmempty = true;

		o = s.taboption('globals', form.DynamicList, 'hosts',
			_('Client connection'),
			_('Specifies where the Docker daemon will listen for client connections. default: ') + 'unix:///var/run/docker.sock' + '<br />' + 
			_('Note that dockerd no longer listens on IP:port without TLS options after v27.'));
		o.placeholder = _('Example: tcp://0.0.0.0:2375');
		o.default = 'unix:///var/run/docker.sock';
		o.rmempty = true;
		o.value('unix:///var/run/docker.sock');
		o.value('tcp://0.0.0.0:2375');
		o.value('tcp://0.0.0.0:2376');
		o.value('tcp6://[::]:2375');
		o.value('tcp6://[::]:2376');


		t = s.tab('auth', _('Registry Auth'));

		o = s.taboption('auth', form.SectionValue, '__auth__', form.TableSection, 'auth', null, 
			_('Used for push/pull operations on custom registries.') + '<br/>' +
			_('Destinations prefixed with a Registry host matching an entry in this table invoke its corresponding credentials.') + '<br/>' +
			_('The first match is used.') + '<br/>' +
			_('A Token is preferred over a Password.') + '<br/>' +
			_('Tokes and Passwords are not encrypted in the uci configuration.'));
		ss = o.subsection;
		ss.anonymous = true;
		ss.nodescriptions = true;
		ss.addremove = true;
		ss.sortable = true;

		o = ss.option(form.Value, 'username',
			_('User'));
		o.placeholder = 'jbloggs';
		o.rmempty = false;

		o = ss.option(form.Value, 'password',
			_('Password'));
		o.placeholder = 'foobar';
		o.password = true;

		o = ss.option(form.Value, 'serveraddress',
			_('Registry'));
		o.datatype = 'or(hostname,hostport,ipaddr,ipaddrport)';
		o.placeholder = 'registry.foo.io[:443] | 192.0.2.1[:443]';
		o.rmempty = false;
		o.value('container-registry.oracle.com');
		o.value('registry.docker.io');
		o.value('gcr.io');
		o.value('ghcr.io');
		o.value('quay.io');
		o.value('registry.gitlab.com');
		o.value('registry.redhat.io');

		o = ss.option(form.Value, 'token',
			_('Token'));
		o.password = true;


		return m.render();
	}
});
