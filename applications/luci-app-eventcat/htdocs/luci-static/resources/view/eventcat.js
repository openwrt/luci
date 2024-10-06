'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
    render: function () {
        var m, s, o;

        m = new form.Map('eventcat',
            _('Eventcat'),
            _('Configure Eventcat to monitor network connectivity and execute actions based on connectivity status or periodic checks.'));

        s = m.section(form.TypedSection, 'eventcat', _('Eventcat'), _('These rules will govern how the device reacts to network events.'));
        s.anonymous = true;
        s.addremove = true;

        s.tab('general', _('General Settings'));

        o = s.taboption('general', form.ListValue, 'mode',
            _('Mode'),
            _('Select the mode for Eventcat. Connectivity Check monitors hosts periodically, while Periodic runs actions at regular intervals.'));
        o.value('connectivity_check', _('Connectivity Check'));
        o.value('periodic', _('Periodic'));

        o = s.taboption('general', form.ListValue, 'action',
            _('Action'),
            _('Select the action to take when the condition is met.'));
        o.value('reboot', _('Reboot Device'));
        o.value('restart_interface', _('Restart Interface'));
        o.value('run_script', _('Run Script'));

        o = s.taboption('general', form.Value, 'period',
            _('Period'),
            _('Interval in seconds for periodic actions or connectivity checks.'));
        o.datatype = 'string';
        o.validate = function (section_id, value) {
            return (/^\d+[smhd]?$/).test(value) ? true : _('Invalid period format. Use numbers optionally followed by s, m, h, or d (e.g., 10, 10s, 10d).');
        };
        o.default = '6h';

        o = s.taboption('general', widgets.DeviceSelect, 'interface',
            _('Interface'),
            _('Network interface to monitor or restart.'));
        o.depends({ action: 'restart_interface' });
        o.depends({ mode: 'connectivity_check' });

        o = s.taboption('general', form.DynamicList, 'host',
            _('Hosts to Check'),
            _('List of hosts (IP addresses) to check for connectivity.'));
        o.datatype = 'host';
        o.depends({ mode: 'connectivity_check' });

        o = s.taboption('general', form.Value, 'script',
            _('Script to Run'),
            _('Specify the script path to execute when action is set to "Run Script".'));
        o.datatype = 'file';
        o.default = '/usr/bin/custom_script.sh';
        o.depends({ action: 'run_script' });

        o = s.taboption('general', form.ListValue, 'address_family',
            _('Address Family'),
            _('Select the IP address family for pinging the host.'));
        o.value('ipv4', _('IPv4'));
        o.value('ipv6', _('IPv6'));
        o.value('any', _('Any'));
        o.default = 'ipv4';
        o.depends({ mode: 'connectivity_check' });

        o = s.taboption('general', form.Value, 'ping_interval',
            _('Ping Interval'),
            _('Interval in seconds between each connectivity check.'));
        o.datatype = 'uinteger';
        o.default = '30';
        o.depends({ mode: 'connectivity_check' });

        o = s.taboption('general', form.Value, 'ping_timeout',
            _('Ping Timeout'),
            _('Timeout in seconds for each ping attempt.'));
        o.datatype = 'uinteger';
        o.default = '5';
        o.depends({ mode: 'connectivity_check' });

        return m.render();
    }
});