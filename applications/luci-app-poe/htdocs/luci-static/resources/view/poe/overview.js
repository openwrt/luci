// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require uci';
'require form';

function portNum(name) {
	var m = String(name).match(/(\d+)/);
	return m ? +m[1] : 0;
}

return view.extend({
	load: function() {
		return uci.load('poe');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('poe', _('Power over Ethernet'),
			_('These settings are written to <code>/etc/config/poe</code> and persist across reboots. ' +
			  'After editing a port, click <em>Save</em> in that port\'s dialog to record the change, then ' +
			  '<em>Save &amp; Apply</em> at the bottom of the page to propagate it to the switch.' +
			  '<br /><br />' +
			  '<em>Save &amp; Apply</em> reloads the configuration without restarting the PoE daemon, so ports that ' +
			  'stay enabled keep delivering power — connected devices will not be power-cycled. Only a port whose own ' +
			  'settings you changed (or one you switch off) is affected.' +
			  '<br /><br />' +
			  'Live per-port status and an immediate on/off toggle are under ' +
			  '<a href="%s">Status → PoE</a>.').format(L.url('admin/status/poe')));

		/* The global power budget is fixed by the switch hardware (PSU rating)
		   and shipped in /etc/config/poe; it is shown read-only on the Status →
		   PoE page and is intentionally not editable here. */

		s = m.section(form.GridSection, 'port');
		s.anonymous = true;
		s.addremove = false;
		s.sortable = false;

		/* /etc/config/poe lists the ports in hardware PSE id order (e.g.: id 1 = lan8
		   … id 8 = lan1), so the grid would otherwise render lan8→lan1. Order
		   the rows by port label instead, to match the Status table. */
		s.cfgsections = function() {
			return uci.sections('poe', 'port')
				.sort(function(a, b) { return portNum(a.name) - portNum(b.name); })
				.map(function(s) { return s['.name']; });
		};

		s.option(form.DummyValue, 'name', _('Port'));

		o = s.option(form.Flag, 'enable', _('Enabled'),
			_('Deliver power on this port.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'priority', _('Priority'),
			_('Lower-priority ports are shed first when the power budget is exceeded.'));
		o.value('', _('Unset (0)'));
		o.value('1', _('Low (1)'));
		o.value('2', _('Medium (2)'));
		o.value('3', _('High (3)'));
		o.optional = true;

		o = s.option(form.Flag, 'poe_plus', _('PoE+'),
			_('Allow higher power (PoE+ / 802.3at) on this port.'));
		o.optional = true;

		return m.render();
	}
});
