'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function () {
		var m, s, o;

		m = new form.Map('watchcat', 
			_('Watchcat'), 
			_("Here you can set up several checks and actions to take in the event that a host becomes unreachable. \
			Click the <b>Add</b> button at the bottom to set up more than one action."));

		s = m.section(form.TypedSection, 'watchcat', _('Watchcat'), _('These rules will govern how this device reacts to network events.'));
		s.anonymous = true;
		s.addremove = true;

		s.tab('general', _('General Settings'));

		o = s.taboption('general', form.ListValue, 'mode',
			_('Mode'),
			_("Ping Reboot: Reboot this device if a ping to a specified host fails for a specified duration of time. <br /> \
				Periodic Reboot: Reboot this device after a specified interval of time. <br /> \
				Restart Interface: Restart a network interface if a ping to a specified host fails for a specified duration of time."));
		o.value('ping_reboot', _('Ping Reboot'));
		o.value('periodic_reboot', _('Periodic Reboot'));
		o.value('restart_iface', _('Restart Interface'));

		o = s.taboption('general', form.Value, 'period', 
			_('Period'), 
			_("In Periodic Reboot mode, it defines how often to reboot. <br /> \
				In Ping Reboot mode, it defines the longest period of \
				time without a reply from the Host To Check before a reboot is engaged. <br /> \
				In Network Restart mode, it defines the longest period of \
				time without a reply from the Host to Check before the interface is restarted. \
				<br /><br />The default unit is seconds, without a suffix, but you can use the \
				suffix <b>m</b> for minutes, <b>h</b> for hours or <b>d</b> \
				for days. <br /><br />Examples:<ul><li>10 seconds would be: <b>10</b> or <b>10s</b></li><li>5 minutes would be: <b>5m</b></li><li> \
				1 hour would be: <b>1h</b></li><li>1 week would be: <b>7d</b></li><ul>"));
		o.default = '6h';

		o = s.taboption('general', form.Value, 'pinghosts', _('Host To Check'), _(`IPv4 address or hostname to ping.`));
		o.datatype = 'host(1)';
		o.default = '8.8.8.8';
		o.depends({ mode: "ping_reboot" });
		o.depends({ mode: "restart_iface" });

		o = s.taboption('general', form.Value, 'pingperiod', 
			_('Check Interval'), 
			_("How often to ping the host specified above. \
				<br /><br />The default unit is seconds, without a suffix, but you can use the suffix <b>m</b> for minutes, <b>h</b> for hours or <b>d</b> for days. <br /><br /> \
				Examples:<ul><li>10 seconds would be: <b>10</b> or <b>10s</b></li><li>5 minutes would be: <b>5m</b></li><li>1 hour would be: <b>1h</b></li><li>1 week would be: <b>7d</b></li><ul>"));
		o.default = '30s';
		o.depends({ mode: "ping_reboot" });
		o.depends({ mode: "restart_iface" });

		o = s.taboption('general', form.ListValue, 'pingsize', 
			_('Ping Packet Size'));
		o.value('small', _('Small: 1 byte'));
		o.value('windows', _('Windows: 32 bytes'));
		o.value('standard', _('Standard: 56 bytes'));
		o.value('big', _('Big: 248 bytes'));
		o.value('huge', _('Huge: 1492 bytes'));
		o.value('jumbo', _('Jumbo: 9000 bytes'));
		o.default = 'standard';
		o.depends({ mode: 'ping_reboot' });
		o.depends({ mode: 'restart_iface' });

		o = s.taboption('general', form.Value, 'forcedelay',
			_('Force Reboot Delay'),
			_("Applies to Ping Reboot and Periodic Reboot modes</i> <br /> When rebooting the router, the service will trigger a soft reboot. \
				Entering a non-zero value here will trigger a delayed hard reboot if the soft reboot were to fail. \
				Enter the number of seconds to wait for the soft reboot to fail or use 0 to disable the forced reboot delay."));
		o.default = '1m';
		o.depends({ mode: 'ping_reboot' });
		o.depends({ mode: 'periodic_reboot' });

		o = s.taboption('general', widgets.DeviceSelect, 'interface',
			_('Interface'),
			_('Interface to monitor and/or restart'),
			_('<i>Applies to Ping Reboot and Restart Interface modes</i> <br /> Specify the interface to monitor and restart if a ping over it fails.'));
		o.depends({ mode: 'ping_reboot' });
		o.depends({ mode: 'restart_iface' });

		o = s.taboption('general', widgets.NetworkSelect, 'mmifacename',
			_('Name of ModemManager Interface'), 
			_("Applies to Ping Reboot and Restart Interface modes</i> <br /> If using ModemManager, \
				you can have Watchcat restart your ModemManger interface by specifying its name."));
		o.depends({ mode: 'restart_iface' });
		o.optional = true;

		o = s.taboption('general', form.Flag, 'unlockbands', 
			_('Unlock Modem Bands'), 
			_('If using ModemManager, then before restarting the interface, set the modem to be allowed to use any band.'));
		o.default = '0';
		o.depends({ mode: 'restart_iface' });

		return m.render();
	}
});
