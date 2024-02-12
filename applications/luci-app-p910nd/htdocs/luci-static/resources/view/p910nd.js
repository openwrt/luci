//
// Copyright (c) 2024 Paul Donald <newtwen@gmail.com>
//

'use strict';
'require fs';
'require form';
'require uci';
'require ui';
'require view';
'require network';

var pkg = {
	get Name() { return 'p910nd'; },
	get Description() { return _('Port 910n print daemon'); },
	get URL() { return 'https://openwrt.org/packages/pkgdata/' + pkg.Name + '/'; }
};

return view.extend({

	option_install_kmod_lp: function() {	
		window.open(L.url('admin/system/opkg') +
			'?query=kmod-lp', '_blank', 'noopener');
	},
	option_install_kmod_usb: function() {	
		window.open(L.url('admin/system/opkg') +
			'?query=kmod-usb-printer', '_blank', 'noopener');
	},

	load: function () {

		return Promise.all([
			network.getDevices(),
			// data[0]

			//	# find -L /dev -maxdepth 3 -type c -name lp[0-9]
			fs.exec_direct('/usr/bin/find', [ '-L', '/dev', '-maxdepth', '3', '-type', 'c', '-name', 'lp[0-9]' ]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Error executing "find" command: ' + err.message)));
					return '';
			}).then(data => {
				if(data)
					return data.trim().split('\n').sort();
				else
					return null;
			}),
			// data[1]

			fs.exec_direct('/usr/libexec/opkg-call', [ 'list-installed' ], 'text').catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Error calling "opkg list-installed": ' + err.message)));
				console.log(err);
					return '';
			}).then(data => {return data.trim().split('\n').sort().filter((string) => string.includes(': kmod-'));}),
			// data[2]

		]);
	},

	render: function (data) {

		var m, d, s, o;

		const have_kmod_lp = data[2] ? data[2].find((string) => string.includes('kmod-lp')) ? true: false : false;
		const have_kmod_usb_printer = data[2] ? data[2].find((string) => string.includes('kmod-usb-printer')) ? true: false : false;
		
		m = new form.Map(pkg.Name, pkg.Description, _('map ports 9100-9109 to local printers.'));
		m.readonly = !L.hasViewPermission();

		if ( !have_kmod_usb_printer || !have_kmod_lp ) {			
			s = m.section(form.NamedSection, 'kmods', 'kmods', _(),
				_('One of these kernel modules is needed for p910nd to find your printer.') + '<br />' +
				_('It is safe to install both, even if only one is needed.')
				);
			s.render = L.bind(function(view /*, ... */) {
				return form.NamedSection.prototype.render.apply(this, this.varargs(arguments, 1))
					.then(L.bind(function(node) {
						node.appendChild(E('div', { 'class': 'control-group' }, [
							E('button', {
								'class': 'btn cbi-button-action',
								'click': ui.createHandlerFn(view, 'option_install_kmod_lp', this.map),
								'disabled': have_kmod_lp || null,
								'title': _('Parallel port line printer device support'),
							}, [ 'kmod-lp' ]),
							' ',
							E('button', {
								'class': 'btn cbi-button-action',
								'click': ui.createHandlerFn(view, 'option_install_kmod_usb', this.map),
								'disabled': have_kmod_usb_printer || null,
								'title': _('For USB connected printers'),
							}, [ 'kmod-usb-printer' ])
						]));
						node.appendChild(E('br'));
						node.appendChild(E('br'));
						return node;
					}, this));
			}, s, this);
		}

		s = m.section(form.GridSection, pkg.Name);
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;
		s.sortable = true;
		s.rowcolors = true;
		s.addbtntitle = _('Add printer config');
		s.modaltitle = _('Settings');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = true;

		o = s.option(form.Value, 'device', _('Device'),
			_('Note: character device assignment can change upon reboot/reconnect with multiple USB devices.') + '<br />' +
			_('Connected %s devices show in this list.').format('<code>lpX</code>'));
		o.placeholder = '/dev/usb/lp*';
		if (data[1]) {
			for (const chardev of data[1]) {
				o.value(chardev);
			}
		}
		o.rmempty = true;

		o = s.option(form.ListValue, 'port', _('Port'),
			_('Local TCP listen port for this printer.') + '<br />' +
			_('Be aware: %s also listens on port 9100.').format('<code>node_exporter</code>'));
		for (var i = 0; i < 10; i++) {
			o.value(i, 9100+i);
		}
		o.rmempty = true;

		o = s.option(form.Value, 'bind', _('Listen IP'),
			_('Listen on a specific IP.'));
		o.datatype = 'ipaddr("nomask")';
		o.placeholder = _('any');
		var net_devices = data[0];
		net_devices.forEach(net_dev => {
			net_dev.getIPAddrs().forEach(addr => o.value(addr.split('/')[0], E([], [addr.split('/')[0], ' (', E('strong', {}, net_dev.getName()), ')'])));
			net_dev.getIP6Addrs().forEach(addr => o.value(addr.split('/')[0], E([], [addr.split('/')[0], ' (', E('strong', {}, net_dev.getName()), ')'])));
		});

		o = s.option(form.Flag, 'bidirectional',
			_('Bidirectional mode'),
			_('Whether this print port is bi-directional.')  + '<br />' +
			_('Note: USB hotplug correctly detects this.'));
		o.modalonly = true;

		o = s.option(form.Flag, 'runas_root', _('Run as root'),
			_('Overrides default of %s.').format('<code>user p910nd, group lp</code>'));
		o.modalonly = true;

		o = s.option(form.Flag, 'mdns', 'mDNS',
			_('Whether to advertise this printer via %s.', 'mDNS/Bonjour/ZeroConf').format('mDNS/Bonjour/ZeroConf') + '<br />' +
			_('Note: %s only advertises one (the first) printer on this host.', 'mDNS').format('mDNS') + '<br />' +
			_('Note: USB hotplug attempts to provide some of the values below.'));

		/* See https://developer.apple.com/bonjour/printing-specification/ ( -> bonjourprinting-1.2.1.pdf ) for
		 * a description of the Bonjour fields a la Apple.
		 */
		o = s.option(form.Value, 'mdns_ty', 'mdns_ty',
			_('The %s type element.').format('mDNS') + '<br />' +
			_('User readable description of maker and model.'));
		o.placeholder = 'HP Color LaserJet CP2025dn';
		o.rmempty = true;
		o.optional = true;
		o.depends({mdns: '1'});

		o = s.option(form.Value, 'mdns_note', 'mdns_note',
			_('Serves as Location in Apple standards.'));
		o.placeholder = _('By the router');
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;
		o.depends({mdns: '1'});

		o = s.option(form.Value, 'mdns_product', 'mdns_product',
			_('The %s value.').format('<code>IEEE1284 Product</code>') + '<br />' +
			_('Note: must be %s.').format('<code>(</code>' + _('enclosed within parentheses') + '<code>)</code>'));
		o.placeholder = '(Color LaserJet CP2025dn)';
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;
		o.depends({mdns: '1'});
		o.write = function(section_id, value) {
			if (value){
				if (!value.startsWith('('))
					value = '(' + value;
				if (!value.endsWith(')'))
					value = value + ')';
				if (value === '()')
					return;
				uci.set(pkg.Name, section_id, 'mdns_product', value);
			}
		}

		const string_array_convert = function(string_or_arr, uppercase=false) {
			if (string_or_arr && !Array.isArray(string_or_arr)) {				
				return [...new Set(string_or_arr.split(',')
				.map(element => uppercase? element.toUpperCase().trim(): element.trim() )
				.filter(el => el!='')
				.sort() ) ];
			}
			if (string_or_arr && Array.isArray(string_or_arr)) {
				return string_or_arr
				.map(element => uppercase? element.toUpperCase().trim(): element.trim() )
				.filter(el => el!='')
				.sort()
				.join(',');
			}
		};

		o = s.option(form.Value, 'mdns_mfg', 'mdns_mfg',
			_('The %s value.').format('<code>IEEE1284 MANUFACTURER/MFG</code>'));
		o.placeholder = _('Manufacturer');
		const mfrs = string_array_convert('Apple,Brother,Canon,Deli,Epson,\
		Hewlett-Packard,HP,Hitachi,Kyocera,Lexmark,OKI,Ricoh,Samsung,Xerox,\
		Xprinter,Zebra');
		for(var mfr in mfrs){
			o.value(mfrs[mfr]);
		}

		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;
		o.depends({mdns: '1'});

		o = s.option(form.Value, 'mdns_mdl', 'mdns_mdl',
			_('The %s value.').format('<code>IEEE1284 MODEL/MDL</code>'));
		o.placeholder = 'CP2025dn';
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;
		o.depends({mdns: '1'});

		o = s.option(form.DynamicList, 'mdns_cmd', 'mdns_cmd',
			_('The %s value.').format('<code>IEEE1284 CMD/COMMAND SET</code>') + '<br />' +
			_('Some examples: ') +
			'<code>ACL</code>, <code>ESC/P</code>, <code>PCL</code>, <code>PDF17</code>,' +
			'<code>PJL</code>, <code>POSTSCRIPT</code>, <code>PS</code>' +
			'<br />'+
			_('Note: Set only CMD languages that your printer understands.'));

		o.cfgvalue = function(section_id) {
			return string_array_convert(uci.get(pkg.Name, section_id, 'mdns_cmd'));
		}
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;
		o.modalonly = true;
		o.depends({mdns: '1'});
		o.write = function(section_id, value) {
			uci.set(pkg.Name, section_id, 'mdns_cmd', string_array_convert(value));
		}
		const cmds = string_array_convert('ACL,BDC,BIDI-ECP,BSCCe,CAPT,CEZD,CPCA,CPCL,\
		D4,D4PX,DESKJET,DOWNLOAD,DPL,DW-PCL,DYN,\
		END4,EPL,EPSONFX,ESC/P,ESCPL2,EXT,FWV,GDI,HAPS,\
		HBP,HBPL,HIPERMIP,IBMPPR,IPL,LIPSLX,MLC,\
		PCL,PCL3,PCL3GUI,PCL5c,PCL5e,PCL6,PCLXL,\
		PDF,PDF17,\
		PJL,PML,\
		POSTSCRIPT,PostScript Emulation,PS,\
		PWG_RASTER,RASTER,RCS,URF,URP,XL,XPP,XPS,ZPL');
		for(var cmd of cmds){
			o.value(cmd);
		}

		return Promise.all([m.render()]);
	}
});
