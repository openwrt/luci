// Copyright 2021-2022 @systemcrash
//Note: this code follows and allows for ES6 syntax (not officially used in Openwrt 21)

'use strict';
'require fs';
'require rpc';
'require form';
'require uci';
'require ui';
'require view';
'require network';

var isReadonlyView = !L.hasViewPermission() || null;

var pkg = {
	get Name() { return 'p910nd'; },
	get Description() { return _('Port 910n daemon'); },
	get URL() { return 'https://openwrt.org/packages/pkgdata/' + pkg.Name + '/'; }
};

return view.extend({

	load: function () {
		var dev_array = [], //Holds an array of found and filtered /dev/ devices (does not work if this variable is global)
		    line_print_map = new Map(), //Holds the lpX => [dev, vid, pid] [key => value] mappings
		    line_print_removed_map = new Set(), //Holds the removed lpX values
		    ieee1284_device_info = new Map(); // Holds the contents of each "/sys/bus/usb/devices/*\/ieee1284_id"
		/* //hotplug.d stuff
		var script_path = "/etc/hotplug.d/usb/",
		    script_file = '50_usb_printer_hotplug',
		    usb_path = '/sys/bus/usb/devices/';
		*/
		/* //skdud info vector
		var skdud = '/sys/kernel/debug/usb/devices'; //contains currently available usb devices.
		*/
		var folder_dev = '/dev',
		    folder_dev_usb = folder_dev + '/usb',
		    line_print_regex = /lp[0-9]+$/,
		    parse_folder = 'Unable to parse folder \'',
		    parse_folder_close = '\': ',
		    usbline_print_regex = 'usblp\ (.*)\: usblp([0-9])\:.*dev ([0-9]+) .*vid 0x0?0?(.*) pid 0x0?0?(.*)$',
		    // yields e.g.: 2-1:1.0, usblp[0-9], dev#, vid, pid
		    usbline_print_removed_regex = 'usblp([0-9])\: removed$';

		var sbud_ieee_path = '/sys/bus/usb/devices/'; //houses the *\/ieee1284_id files.
		/* // grep sbudx file vector
		var sbudx_ieee1284_file = "/sys/bus/usb/devices/*\/ieee1284_id";
		*/

		function is_usb_line_print_dev(el){
			//this regexp filters dmesg entries matching the regex.
			return el.match(usbline_print_regex);
		};

		// find /sys/bus/usb/devices/*/ -regex ".*lp[0-9]"
		// find /sys/bus/usb/devices/*/ -regex ".*ieee1284_id"

		function five_to_four_filter(el){
			/* Note: we use a map of [key: value] to ensure uniqueness in the list.
			[lpX] => [bus_id, vid, pid]
			*/
			if(!line_print_map.has(Number(el[2]), [el[1], el[4], el[5]]))
				line_print_map.set(Number(el[2]), [el[1], el[4], el[5]]);
			return line_print_map;
		};

		/* 
		 1: get dmesg, filter for usblp. 
		 2: get interface number: "2-1:1.0" (keep most recent for this usblp)
		 3: check existence of '/sys/bus/usb/devices/{a-b.p:x.y}/ieee1284_id'
		 4: parse file for printer info
		 Possible vector to construct USB port numbers from connected devices:
		 5: parse 'cat /sys/kernel/debug/usb/devices' (skip entries with 'B:' ):
			// http://www.makelinux.net/ldd3/chp-13-sect-2.shtml
			// https://www.kernel.org/doc/Documentation/usb/proc_usb_info.txt

			T:  Bus=02 Lev=01 Prnt=01 Port=00 Cnt=01 Dev#= 33 Spd=480  MxCh= 0
			D:  Ver= 2.00 Cls=00(>ifc ) Sub=00 Prot=00 MxPS=64 #Cfgs=  1
			P:  Vendor=03f0 ProdID=4117 Rev= 1.00
			S:  Manufacturer=Hewlett-Packard
			S:  Product=HP LaserJet 1018
			S:  SerialNumber=KP24ZJ1
			C:* #Ifs= 1 Cfg#= 1 Atr=c0 MxPwr= 98mA
			I:* If#= 0 Alt= 0 #EPs= 2 Cls=07(print) Sub=01 Prot=02 Driver=usblp
			E:  Ad=01(O) Atr=02(Bulk) MxPS= 512 Ivl=0ms
			E:  Ad=81(I) Atr=02(Bulk) MxPS= 512 Ivl=0ms

		 6: interpret/filter...
		*/

		return Promise.all([
			uci.load(pkg.Name), // data[0]
			network.getDevices(), // data[1]
			dev_array, // data[2]
			/* Note that this approach of parsing dmesg may fail with v.noisy 
			 * kernel logs flooded with tracebacks and other info.
			 * But in that case, you have bigger fish to fry.
			 */
			fs.exec_direct('/bin/dmesg', [ '-r' ]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load dmesg kernel log: ' + err.message)));
					return ''; //handle "usblp0: removed"?
				}).then(data => {return data.trim().split(/\n/).filter(is_usb_line_print_dev).map(is_usb_line_print_dev).reverse().map(five_to_four_filter).reduce(x => x, "");
			}), // data[3]
			/*
			fs.exec_direct('/bin/cat', [ skdud ]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to parse '+ skdud + ': ' + err.message)));
					return '';
			}).then(data => {return data.trim().split(/\n\n/).filter(x => x.indexOf('B: ') == -1); //retain entries without USB 'B'andwidth - only USB HC have B:
			}), // data[X]
			*/
			/*
			fs.exec_direct('/usr/bin/find', [ sbubx_ieee, '\(', '-regex', '".*\/devices/\d-\d:\d.\d/ieee1284_id"', '-o', '-regex, '".*\/devices\/\d-\d\.\d:\d.\d\/ieee1284_id"', '\)', '|', 'xargs', '-r', 'cat' ]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to parse '+ sbubx_ieee + ' entries: ' + err.message)));
					return '';
			}).then(data => {return data.trim();
			}),
			*/
			/* 'grep -RH ".*" /sys/bus/usb/devices/*\/ieee1284_id' //this fs.exec does not work for some reason. */
			/* fs.exec_direct('/bin/grep', [ '-RH', "'.*'", sbudx_ieee1284_file]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to parse '+ sbudx_ieee1284_file + ' entries: ' + err.message)));
					return '';
			}).then(data => {return data.trim();
			}), // data[X]
			*/
			ieee1284_device_info, //data[4]
			/* This, sbud_ieee_path, is an attempt to be helpful: grab and parse the contents of 
			 * /sys/bus/usb/devices/{a-b.p:x.y}/ieee1284_id files which contain useful info
			 * which describes each printer. Could use this to auto-fill the printer info.
			 */
			fs.list(sbud_ieee_path).catch(function(err) {
				ui.addNotification(null, E('p', {}, _(parse_folder + sbud_ieee_path + parse_folder_close + err.message)));
					return '';
			}).then(entries => {
				return entries.filter(
					e => e.type == 'directory').map(
					entry => {return fs.list(sbud_ieee_path + entry.name).then(
						subentries => {return subentries.filter(
							sube => sube.name == 'ieee1284_id').map(
							e => {return ieee1284_device_info.set(sbud_ieee_path + entry.name + '/' + e.name, fs.read(sbud_ieee_path + entry.name + '/' + e.name))
							})
						})
					});
			}), //data[5]
			// //Look in /dev/usb/ first:
			fs.list(folder_dev_usb).catch(function(err) {
				ui.addNotification(null, E('p', {}, _(parse_folder + folder_dev_usb + parse_folder_close + err.message)));
					return '';
				}).then(entries => dev_array.push(...(entries.filter(e => e.type == 'char' && e.name.match(line_print_regex)).map(e => folder_dev_usb + e.name))) 
			),
			// //Look in /dev/ for other devices for miscellaneous lp:
			fs.list(folder_dev).catch(function(err) {
				ui.addNotification(null, E('p', {}, _(parse_folder + folder_dev + parse_folder_close + err.message)));
					return '';
				}).then(entries => dev_array.push(...(entries.filter(e => e.type == 'char' && e.name.match(line_print_regex)).map(e => folder_dev + e.name))) 
			)
		]);
	},

	render: function (data) {

		var m, d, s, o;

		// console.log(data[2]);
		// console.log(data[3]);
		// console.log(data[4]);
		// console.log(data[7]);

		m = new form.Map(pkg.Name, pkg.Description, _('map ports 9100-9109 to local USB printers.'));

		s = m.section(form.GridSection, pkg.Name);
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;
		s.sortable = true;
		s.rowcolors = true;
		s.addbtntitle = _('Printer');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = true;
		o.modalonly = true;

		var char_devices = data[2].sort();
		var dev_map = data[3];
		var ieee1284_device_info = data[4];

		o = s.option(form.Value, 'device', _('Device Path'), _('Note: Using multiple USB devices, their port numbering can change upon reboot/reconnect. Connected USB/lpX devices should show in this list.'));
		o.placeholder = '/dev/usb/lp*';
		char_devices.forEach(char_dev => {
			if (char_dev.match(/\/lp([0-9]+)$/)) {
				let line_print_num = char_dev.match(/\/lp([0-9]+)$/)[1];
				let device_data = '';
				if (dev_map.size > 0)
					device_data = dev_map.get(line_print_num)[0] + ' : v' + dev_map.get(line_print_num)[1] + '/p' + dev_map.get(line_print_num)[2];
				o.value(char_dev, E([], [char_dev, ' (', E('strong', {}, device_data), ')']));
			}
		});
		o.rmempty = true;
		/* 
		//we need an extra variable to hold the constructed usb_vid_pid - then hotplug.d has direct access to saved usb_ids
		theoretically one can determine the vid/pid from the lp port number, but as we can see from the init code above, it's not trivial
		nor would it be in a shell script language...
		*/
		// var dev_path = o;

		o = s.option(form.ListValue, 'port', _('Listen port'), _('Local TCP listen port for a specific printer. Be aware: node_exporter also listens on port 9100.'));
		for (var i = 0; i < 10; i++) {
			o.value(i, 9100+i);
		}
		o.rmempty = true;

		o = s.option(form.Value, 'bind', _('Listen IP'), _('Which interface to bind to.'));
		o.datatype = 'ipaddr("nomask")';
		o.placeholder = _('any');
		var net_devices = data[1];
		net_devices.forEach(net_dev => {
			net_dev.getIPAddrs().forEach(addr => o.value(addr.split('/')[0], E([], [addr.split('/')[0], ' (', E('strong', {}, net_dev.getName()), ')'])));
			net_dev.getIP6Addrs().forEach(addr => o.value(addr.split('/')[0], E([], [addr.split('/')[0], ' (', E('strong', {}, net_dev.getName()), ')'])));
		});

		o = s.option(form.Flag, 'bidirection', _('Bi-directional'), _('Whether this print port is bi-directional.'));

		o = s.option(form.Flag, 'runas_root', _('Root'), _('Run as root: overrides running as user p910nd, group lp.'));

		o = s.option(form.Flag, 'mdns', _('mDNS'), _('Whether to advertise this printer via mDNS/Bonjour/ZeroConf. Note: currently only advertises one (the first) printer on this host via mDNS'));

		/* See https://developer.apple.com/bonjour/printing-specification/ ( -> bonjourprinting-1.2.1.pdf ) for
		 * a description of the Bonjour fields a la Apple.
		 */
		o = s.option(form.Value, 'mdns_ty', _('Description'), _('User readable description of maker and model.'));
		o.placeholder = 'HP Color LaserJet CP2025dn';
		o.rmempty = true;
		o.optional = true;
		// var mdns_desc = o;

		o = s.option(form.Value, 'mdns_note', _('Location'));
		o.placeholder = 'Wardrobe';
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;
		// var mdns_note = o;

		o = s.option(form.Value, 'mdns_product', _('Product'), _('the value of the “Product” stored in the driver’s PPD file (including the parentheses). E.g. (MFG MODEL).'));
		o.placeholder = '(Color LaserJet CP2025dn)';
		o.rmempty = true;
		o.optional = true;
		o.validate = function(section_id, value) {
			if(value[0] == '(' && value[value.length-1] == ')')
				return true;
			return _('Enclose in ( and ).');
		}
		// var mdns_prod = o;

		o = s.option(form.Value, 'mdns_mfg', _('Manufacturer'), _('the value of the MANUFACTURER (MFG) from the printer’s IEEE1284 device ID.'));
		o.placeholder = 'Manufacturer';
		o.value('Brother');
		o.value('Canon');
		o.value('Epson');
		o.value('Hewlett-Packard');
		o.value('Hitachi');
		o.value('Kyocera');
		o.value('Lexmark');
		o.value('OKI');
		o.value('Ricoh');
		o.value('Samsung');
		o.value('Xerox');
		o.rmempty = true;
		o.optional = true;
		// var mdns_mfg = o;

		o = s.option(form.Value, 'mdns_mdl', _('Model'), _('the value of the MODEL (MDL) from the printer’s IEEE1284 device ID.'));
		o.placeholder = 'CP2025dn';
		o.rmempty = true;
		o.optional = true;
		// var mdns_mdl = o;

		o = s.option(form.Value, 'mdns_cmd', _('Command Language'), _('the value of the COMMAND SET (CMD) from the printer’s IEEE1284 device ID. E.g.: ACL, ESC/P, PCL, PDF17, PJL, POSTSCRIPT, PS, etc.'));
		o.placeholder = 'PS,PDF17,PCL';
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;
		// var mdns_cmd = o;

		return Promise.all([m.render()]);
	}
});
