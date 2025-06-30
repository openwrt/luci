'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require view';

const FILENAMES = {
	adb: '/var/lib/unbound/adb_list.overall',
	dhcp: '/var/lib/unbound/dhcp.conf',
	edituci: '/etc/config/unbound',
	extended: '/etc/unbound/unbound_ext.conf',
	manual_edit: '/etc/unbound/unbound.conf',
	manual_show: '/var/lib/unbound/unbound.conf',
	server: '/etc/unbound/unbound_srv.conf',
}

const GUIDES_URL = 'https://openwrt.org/docs/guide-user/services/dns/unbound';
const HELP_URL = 'https://github.com/openwrt/packages/blob/master/net/unbound/files/README.md';

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

return view.extend({
	load() {
		return Promise.all([
			uci.load('unbound'),
			L.resolveDefault(fs.read(FILENAMES['adb']).then(content => ({ content: content || '' })), { content: '' }),
			L.resolveDefault(fs.read(FILENAMES['dhcp']).then(content => ({ content: content || '' })), { content: '' }),
			L.resolveDefault(fs.read(FILENAMES['manual_show']).then(content => ({ content: content || '' })), { content: '' }),
		]);
	},

	render([ub_uci, adb_c, dhcp_c, manual_show_c]) {

		const m = new form.Map('unbound', null);
		m.submit = _('Save');


		const fs_write = (file, value) => fs.write(file, value.trim().replace(/\r\n/g, '\n'));
		const fs_read = (file) => fs.read(file).then(content => {return content});

		const manual = uci.get('unbound', 'ub_main', 'manual_conf');

		const s = m.section(form.NamedSection, 'ub_main', 'unbound');

		// Tabs
		if (manual === '0') {

			s.tab('edituci', _('Edit: UCI'));
			const eu_msg = s.taboption('edituci', form.DummyValue, '_eu_msg', '');
			eu_msg.rawhtml = true;
			eu_msg.default = _("Edit '" + FILENAMES['edituci'] + "' and recipes can be found in OpenWrt " +
				'<a href="%s" target="_blank">Guides</a> '.format(GUIDES_URL) + 
				'and <a href="%s" target="_blank">Github</a>.'.format(HELP_URL));
			const eu = s.taboption('edituci', form.TextValue, 'edituci');
			eu.rows = 25;
			eu.load = () => fs_read(FILENAMES['edituci']);
			eu.write = function(section, value) {
				fs_write(FILENAMES['edituci'], value);
				return null;
			};

			s.tab('manual', _('Show: Unbound'));
			const man_msg = s.taboption('manual', form.DummyValue, '_man_msg', '');
			man_msg.default = _("This shows '" + FILENAMES['manual_show'] + "' generated from UCI configuration.");
			const man = s.taboption('manual', form.TextValue, 'manual');
			man.rows = 25;
			man.readonly = true;
			man.load = () => manual_show_c.content;
			man.write = () => {};

		} else {
			s.tab('manual', _('Edit: Unbound'));
			const man = s.taboption('manual', form.TextValue, 'manual');
			const man_msg = s.taboption('manual', form.DummyValue, '_man_msg', '');
			man_msg.default = _("Edit '" + FILENAMES['manual_edit'] + "' when you do not use UCI.");
			man.rows = 25;
			man.load = () => fs_read(FILENAMES['manual_edit']);
			man.write = function(section, value) {
				fs_write(FILENAMES['manual_edit'], value);
				return null;
			};
		}

		s.tab('server', _('Edit: Server'));
		const serv_msg = s.taboption('server', form.DummyValue, '_serv_msg', '');
		serv_msg.default = _("Edit 'server:' clause options for 'include: " + FILENAMES['server'] + "'");
		const serv = s.taboption('server', form.TextValue, 'server');
		serv.rows = 25;
		serv.load = () => fs_read(FILENAMES['server']);
		serv.write = function(section, value) {
			fs_write(FILENAMES['server'], value);
			return null;
		};

		s.tab('extended', _('Edit: Extended'));
		const ext_msg = s.taboption('extended', form.DummyValue, '_ext_msg', '');
		ext_msg.default = _("Edit clauses such as 'forward-zone:' for 'include:" + FILENAMES['extended'] + "'");
		const ext = s.taboption('extended', form.TextValue, 'extended');
		ext.rows = 25;
		ext.load = () => fs_read(FILENAMES['extended']);
		ext.write = function(section, value) {
			fs_write(FILENAMES['extended'], value);
			return null;
		};

		if (dhcp_c.content) {
			s.tab('dhcp', _('Show: DHCP'));
			const dhcp_msg = s.taboption('manual', form.DummyValue, '_dhcp_msg', '');
			dhcp_msg.default =  _("This shows '" + FILENAMES['dhcp'] +  "' list of hosts from DHCP hook scripts.");
			const dhcp = s.taboption('dhcp', form.TextValue, 'dhcp');
			dhcp.rows = 25;
			dhcp.readonly = true;
			dhcp.load = () => dhcp_c.content;
			dhcp.write = () => {return null;};
		}

		if (adb_c.content) {
			s.tab('adb', _('Show: Adblock'));
			const adb_msg = s.taboption('adb', form.DummyValue, '_adb_msg', '');
			adb_msg.default = _("This shows '" + FILENAMES['adb'] + "' list of adblock domains");
			const adb = s.taboption('adb', form.TextValue, 'adb');
			adb.rows = 25;
			adb.readonly = true;
			adb.load = (adb_c.content?.length <= 262144) ? () => adb_c.content : () => _('Adblock domain list is too large to display in LuCI.');
			adb.write = () => {return null;};
		}
		return m.render();
	},

	// handleSave(ev) {
	// 	const tasks = [];

	// 	document.getElementById('maincontent')
	// 		.querySelectorAll('.cbi-map').forEach(map => {
	// 			tasks.push(DOM.callClassMethod(map, 'save'));
	// 		});

	// 	return Promise.all(tasks);
	// },

	handleSaveApply(ev, mode) {
		this.handleSave(ev).then(() => {
			// classes.ui.changes.apply(mode == '0');
			mode = '1';
			const enabled = uci.get('unbound', 'ub_main', 'enabled');
			const cmd = enabled ? 'reload' : 'stop';

			var Fn = L.bind(() => {
				callRcInit('unbound', cmd);
				document.removeEventListener('uci-applied', Fn);
			});
			document.addEventListener('uci-applied', Fn);
			this.super('handleSaveApply', [ev, mode]);
		});
	},

	handleReset: null,
});
