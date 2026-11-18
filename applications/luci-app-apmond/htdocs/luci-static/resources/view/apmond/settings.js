'use strict';
'require view';
'require form';
'require uci';
'require dom';
'require view.apmond.common as common';

/*
 * ApmonD settings: the single "config apmond 'setup'" section of /etc/config/apmond.
 * Every option is optional and has a built-in default in apmond, so defaults are shown as
 * placeholders and an option is only written when it is changed.
 *
 * Save & Apply commits the config; the apmond init script's reload trigger then runs
 * "service apmond reload", which restarts the daemon with the new settings and gives the
 * config file back to group apmond (mode 0640), so the daemon, running as user apmond, can
 * read it. The debug level is set here only.
 */

var DEFAULT_SEED = '--__';

return view.extend({
	load: function() {
		return uci.load('apmond');
	},

	/* true when apmond would use its built-in default passphrase */
	seedIsDefault: function(seed) {
		if (seed == null || seed === '' || seed === DEFAULT_SEED) {
			return true;
		}
		return false;
	},

	/*
	 * ListValue that never writes its default to an unset option: picking the default
	 * leaves the option unset, or removes it if it was set.
	 */
	listDefault: function(o, dflt) {
		o.default = dflt;
		o.write = function(section_id, value) {
			if (value === dflt) {
				if (this.cfgvalue(section_id) != null) {
					return this.remove(section_id);
				}
				return;
			}
			return form.ListValue.prototype.write.apply(this, [ section_id, value ]);
		};
		return o;
	},

	/* a Value for a whole number between min and max, with the default as placeholder */
	intValue: function(s, tab, name, title, descr, dflt, min, max) {
		var o = s.taboption(tab, form.Value, name, title, descr);

		o.datatype = 'range(%d,%d)'.format(min, max);
		o.placeholder = dflt;
		o.rmempty = true;
		return o;
	},

	/* an absolute path, or empty */
	validatePath: function(section_id, value) {
		if (value === '' || /^\/[^ ]*$/.test(value)) {
			return true;
		}
		return _('Must be an absolute path');
	},

	seedNotice: function() {
		return E('div', { 'class': 'alert-message notice' },
			_('The built-in default passphrase is in use. Make ApmonD more secure by adding your own passphrase, the same on every node.'));
	},

	render: function() {
		var self = this;
		var m;
		var s;
		var o;

		m = new form.Map('apmond', _('ApmonD'),
			_('ApmonD monitors the access points of your network. Every node, the access points and the router, runs the same daemon and should have identical settings. Save & Apply restarts apmond on this node.'));

		s = m.section(form.NamedSection, 'setup', 'apmond', _('Settings'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		/* General */

		o = s.taboption('general', form.Flag, 'enabled', _('Enabled'),
			_('Run the ApmonD daemon on this node.'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'apmon_seed', _('Passphrase'),
			_('Identical on every node. The encryption keys and the IPv6 ULA prefix are both derived from it. While it is empty a built-in default is used, which gives no real protection.'));
		o.password = true;
		o.rmempty = true;

		this.intValue(s, 'general', 'interval', _('Report interval'),
			_('Seconds between reports, 10 to 3600. Default 30.'), '30', 10, 3600);

		o = s.taboption('general', form.ListValue, 'role', _('Role'),
			_('The collector, the node with an upstream wan gateway, receives the reports of every node.'));
		o.value('auto', _('Auto detect'));
		o.value('collector', _('Force collector'));
		o.value('sender', _('Force sender'));
		this.listDefault(o, 'auto');

		o = s.taboption('general', form.ListValue, 'debuglevel', _('Debug level'));
		o.value('0', _('0 - errors'));
		o.value('1', _('1 - notices'));
		o.value('2', _('2 - info'));
		o.value('3', _('3 - debug'));
		this.listDefault(o, '1');

		/* Advanced */

		this.intValue(s, 'advanced', 'port', _('Port'),
			_('TCP port of the collector; the same on every node. Default 2468.'), '2468', 1, 65535);

		o = s.taboption('advanced', form.Value, 'collector', _('Collector address'),
			_('Senders only: the collector address to report to. Empty uses the collector ULA, ending ::1, found automatically.'));
		o.datatype = 'host';
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'interface', _('Interface'),
			_('The network interface whose device carries the ULA addresses and the collector listener, for example lan (br-lan.10 with VLANs). Default lan.'));
		o.placeholder = 'lan';
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'netdev', _('Network device'),
			_('Overrides Interface: the network device to use directly. Normally empty.'));
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'device', _('Device'),
			_('Its MAC address identifies this node, and its bridge forwarding table gives the wired clients. Default br-lan.'));
		o.placeholder = 'br-lan';
		o.rmempty = true;

		this.intValue(s, 'advanced', 'key_epoch', _('Key epoch'),
			_('Change it on every node together with a new passphrase. Default 0.'), '0', 0, 2147483647);

		this.intValue(s, 'advanced', 'prev_epoch_grace', _('Previous key epoch grace'),
			_('Collector: also accept the previous key epoch for this many seconds after start, while the nodes change over. Default 0.'), '0', 0, 2592000);

		this.intValue(s, 'advanced', 'client_stale_timeout', _('Stale client timeout'),
			_('Collector: seconds a client that has gone from its node\'s report is kept, greyed out, before it is removed. Default 600.'), '600', 0, 86400);

		this.intValue(s, 'advanced', 'collector_recheck', _('Collector re-check'),
			_('Collector: re-run duplicate address detection on the collector address every this many report cycles, and give way if another node holds it. 0 turns it off. Default 10.'), '10', 0, 1000);

		this.intValue(s, 'advanced', 'max_age', _('Maximum clock difference'),
			_('Collector: reports whose time differs from the collector by more than this many seconds are rejected. Default 120.'), '120', 10, 3600);

		this.intValue(s, 'advanced', 'max_message_size', _('Maximum message size'),
			_('Collector: the largest accepted report, in bytes. Default 262144.'), '262144', 4096, 4194304);

		this.intValue(s, 'advanced', 'startup_delay', _('Startup delay'),
			_('Seconds before the first report. Default 10.'), '10', 0, 3600);

		this.intValue(s, 'advanced', 'router_takeover_misses', _('Router takeover misses'),
			_('A backed-off collector takes over the collector address after it has not answered this many checks. Default 3.'), '3', 1, 100);

		this.intValue(s, 'advanced', 'claim_delay_max', _('Maximum claim delay'),
			_('Random delay of 0 to this many seconds before the collector address is first claimed. Default 10.'), '10', 0, 60);

		o = s.taboption('advanced', form.Value, 'log_mountpoint', _('Log mountpoint'),
			_('Where the log is kept, in the apmond directory of this mountpoint, for example /mnt/usb. Default /tmp.'));
		o.placeholder = '/tmp';
		o.rmempty = true;
		o.validate = this.validatePath;

		this.intValue(s, 'advanced', 'max_log_entries', _('Maximum log entries'),
			_('The log file is trimmed to the last this many lines. Default 500.'), '500', 10, 100000);

		return m.render().then(function(node) {
			/* the notice lives outside the map, which re-renders its own contents on save */
			self.noticeSlot = E('div', {});
			self.updateSeedNotice();
			return E('div', {}, [ self.noticeSlot, node, common.footer() ]);
		});
	},

	/* show the default passphrase notice while the saved config has no passphrase of its own */
	updateSeedNotice: function() {
		var notice = null;

		if (!this.noticeSlot) {
			return;
		}

		if (this.seedIsDefault(uci.get('apmond', 'setup', 'apmon_seed'))) {
			notice = this.seedNotice();
		}

		dom.content(this.noticeSlot, notice);
	},

	/*
	 * Save (also used by Save & Apply): the map saves and reloads the uci data, then the
	 * notice follows the saved value
	 */
	handleSave: function(ev) {
		var self = this;

		return Promise.resolve(this.super('handleSave', [ ev ])).then(function(rv) {
			self.updateSeedNotice();
			return rv;
		});
	}
});
