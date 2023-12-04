'use strict';
'require view';
'require form';
'require rpc';
'require uci';

var callTorHsList = rpc.declare({
	object: 'tor-hs-rpc',
	method: 'list-hs',
});


return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(callTorHsList(), {}),
		]);
	},

	render: function (data) {
		var hsList = [];
		if (data[0]['hs-list']) {
			hsList = data[0]['hs-list'];
		}
		var hsMap = new Map();
		hsList.forEach(function (hs) {
			hsMap.set(hs.name, hs.hostname);
		});

		var m, s, o;

		m = new form.Map('tor-hs', _('Tor Onion Services'),
			_('Tor Onion (Hidden) Services are proxy tunnels to your local website, SSH and other services.') + '<br />' +
			_('For further information <a %s>check the documentation</a>')
				.format('href="https://openwrt.org/docs/guide-user/services/tor/hs" target="_blank" rel="noreferrer"')
		);

		s = m.section(form.GridSection, 'hidden-service', _('Tor Onion Services'));
		s.addremove = true;
		s.nodescriptions = true;
		s.sectiontitle = function (section_id) {
			let tor = uci.get('tor-hs', section_id);
			let sectionName = section_id;
			if (tor['.anonymous']) {
				sectionName = tor['Name'];
			}
			return sectionName;
		};

		o = s.option(form.Flag, 'Enabled', _('Enabled'));
		o.default = '1';
		o.rmempty = false;
		// We also need to set Name field with the same name as section
		// The only option to do that is to override write() for some other field i.e. Enabled
		o.write = function (section_id, formvalue) {
			// first save the Enabled
			uci.set('tor-hs', section_id, 'Enabled', formvalue);
			// set Name field
			var name = this.map.data.get(this.map.config, section_id, 'Name') || '';
			if (!name) {
				// Typically the empty Name happens for new unsaved sections
				name = section_id;
				// manually set Name to trigger change
				uci.set('tor-hs', section_id, 'Name', name);
			}
			return name;
		};

		o = s.option(form.DummyValue, '_Domain', _('Onion domain'));
		o.modalonly = false;
		o.rawhtml = true;
		o.textvalue = function (section_id) {
			var name = uci.get('tor-hs', section_id, 'Name');
			if (!name)
				return '';
			var hostname = hsMap.get(name);
			if (!hostname)
				return '';
			return '<a href="http://' + hostname + '" target="_blank" rel="noreferrer">' + _('Link') + '</a>';
		};

		o = s.option(form.Value, 'Description', _('Description'));
		o.modalonly = true;

		o = s.option(form.Value, 'IPv4', _('Destination address'),
			_('Traffic will be forwarded to the target hostname')
		);
		o.datatype = 'host';
		o.default = '127.0.0.1';

		o = s.option(form.DynamicList, 'PublicLocalPort', _('Public ports to local'),
			_('A single <code>Port</code> when the public port is the same as local e.g. <code>80</code>.') + '<br />' +
			_('A pair <code>PublicPort;LocalPort</code> e.g. <code>80;8080</code>.') + '<br />' +
			_('A pair <code>PublicPort;unix:Socket</code> e.g. <code>80;unix:/var/run/nginx.sock</code>.')
		);
		o.datatype = 'list(string)';
		o.default = ['80', '443']; // by default expose http and https ports
		o.rmempty = false;

		o = s.option(form.Value, 'HookScript', _('Hook Script'),
			_('Path to script which is executed after starting Tor.') + '<br />' +
			_('The .onion domain is passed into the script via parameter <code>--update-onion HOSTNAME</code>.')
		);
		o.modalonly = true;

		return m.render();
	},
});
