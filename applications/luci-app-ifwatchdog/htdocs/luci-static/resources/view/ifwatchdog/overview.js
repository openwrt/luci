'use strict';
'require view';
'require form';
'require network';
'require rpc';
'require poll';
'require dom';

var callStatus = rpc.declare({
	object: 'ifwatchdog',
	method: 'status',
	expect: { '': { instances: [], now_mono: 0 } }
});

// Client-side mirror of the backend valid_ifname(): the first char class
// excludes '-', so a value can never become an ifup/ping option. Defence in
// depth — the backend validates regardless.
function ifnameValidate(section_id, value) {
	if (value == '')
		return true;
	if (!/^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,14}$/.test(value))
		return _('Invalid interface name (no leading "-", max 15 chars).');
	return true;
}

// The backend only enforces a floor conditionally (e.g. debounce/action_window
// only once an action is configured; max_handshake_age only for method
// handshake/both) - mirror that here instead of a flat datatype minimum,
// which would wrongly reject e.g. a valid monitor-mode debounce=0.
function conditionalFloorValidate(fieldName, triggerValues, min) {
	return function(section_id, value) {
		var opt = this.map.lookupOption(fieldName, section_id);
		var current = opt ? opt[0].formvalue(section_id) : triggerValues[0];
		if (triggerValues.indexOf(current) === -1 || value === '' || value == null)
			return true;
		return (+value >= min) ? true
			: _('Must be >= %d when %s is %s.').format(min, fieldName, current);
	};
}
function actionFloorValidate(min) {
	return conditionalFloorValidate('action', ['ifup', 'script'], min);
}

function statusTable(result) {
	var instances = result.instances || [];
	var nowMono = result.now_mono || 0;
	var head = E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _('Section')),
		E('th', { 'class': 'th' }, _('Interface')),
		E('th', { 'class': 'th' }, _('State')),
		E('th', { 'class': 'th' }, _('Handshake age')),
		E('th', { 'class': 'th' }, _('HS state')),
		E('th', { 'class': 'th' }, _('Ping')),
		E('th', { 'class': 'th' }, _('Last action'))
	]);

	if (!instances || !instances.length)
		return E('em', {}, _('No running watchdog instances.'));

	var nowSec = Date.now() / 1000;
	var rows = instances.map(function(it) {
		var la = it.last_action ? new Date(it.last_action * 1000).toLocaleString() : '-';
		var age = (it.handshake_age != null) ? (it.handshake_age + 's') : '-';
		// A status file that stopped updating means the process is gone
		// (SIGKILL/OOM/rename). Three missed cycles is the signal; a 180s floor
		// avoids false staleness at short intervals on a loaded router.
		var limit = Math.max(180, 3 * (it.interval || 60));
		// Router uptime (monotonic) rather than wall clock: routers have no RTC
		// and an NTP step at boot must not make a fresh row look stale (or a
		// truly stale one look fresh). Falls back to wall time only for a
		// status file written before this field existed (pre-upgrade daemon).
		var stale = (nowMono && it.updated_mono != null)
			? (nowMono - it.updated_mono > limit)
			: (it.updated ? (nowSec - it.updated > limit) : true);
		var state = stale ? _('stale (no update)') : (it.state || '-');
		// "cannot measure" (amber) is a different class from "refused" (red).
		// breaker_tripped is sticky: it stays true across cycles where the
		// breaker is engaged even if THIS cycle's transient state looks benign.
		var hard  = stale || state == 'invalid' || state == 'disabled' ||
		            state == 'breaker' || it.breaker_tripped;
		var soft  = state == 'holding' || state == 'lockbusy' || state == 'down';
		var stateCell = hard
			? E('strong', { 'style': 'color:#a00' }, state)
			: (soft ? E('strong', { 'style': 'color:#a60' }, state)
			        : E('strong', {}, state));
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, it.section || '-'),
			E('td', { 'class': 'td' }, it.interface || '-'),
			E('td', { 'class': 'td' }, stateCell),
			E('td', { 'class': 'td' }, age),
			E('td', { 'class': 'td' }, it.handshake_state || '-'),
			E('td', { 'class': 'td' }, it.ping || '-'),
			E('td', { 'class': 'td' }, la)
		]);
	});

	return E('table', { 'class': 'table' }, [ head ].concat(rows));
}

return view.extend({
	load: function() {
		return Promise.all([
			network.getDevices(),
			network.getNetworks()
		]);
	},

	render: function(data) {
		var devices = data[0] || [];
		var networks = data[1] || [];
		var m, s, o;

		m = new form.Map('ifwatchdog', _('Interface Watchdog'),
			_('Watch a network interface and restart it when it silently stalls — ' +
			  'using the WireGuard handshake age and/or an interface-bound ping. ' +
			  'Runs in monitor mode by default; set an action per instance to let it act.'));

		s = m.section(form.GridSection, 'watchdog', _('Watchdogs'));
		s.addremove = true;
		s.anonymous = false;
		s.sortable = false;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Enable this watchdog instance.'));
		o.editable = true;

		o = s.option(form.Value, 'interface', _('Interface'),
			_('L3 device to test — its WireGuard handshake age and/or an interface-bound ping.'));
		o.rmempty = false;
		o.validate = ifnameValidate;
		devices.forEach(function(d) {
			var n = d.getName();
			if (n && n != 'lo') o.value(n);
		});

		o = s.option(form.ListValue, 'method', _('Method'),
			_('How a stall is detected: WireGuard handshake age, an interface-bound ping, or both.'));
		o.value('both', _('handshake + ping'));
		o.value('handshake', _('WireGuard handshake age'));
		o.value('ping', _('interface-bound ping'));
		o.default = 'both';

		o = s.option(form.ListValue, 'action', _('Action'),
			_('What to do when a stall is detected: only log, restart the interface (ifup), or run a script.'));
		o.value('monitor', _('Monitor only (no-op)'));
		o.value('ifup', _('Restart interface (ifup)'));
		o.value('script', _('Run script'));
		o.default = 'monitor';

		/* --- modal-only details --- */
		o = s.option(form.Value, 'ping_host', _('Ping host'),
			_('Target IP or host for the interface-bound ping (methods "ping" and "both").'));
		o.modalonly = true;
		o.datatype = 'host';
		o.default = '1.1.1.1';
		o.depends('method', 'ping');
		o.depends('method', 'both');

		o = s.option(form.Value, 'ping_timeout', _('Ping timeout (s)'),
			_('Seconds to wait for a ping reply.'));
		o.modalonly = true;
		o.datatype = 'uinteger';
		o.default = '3';
		o.depends('method', 'ping');
		o.depends('method', 'both');

		o = s.option(form.Value, 'max_handshake_age', _('Max handshake age (s)'),
			_('If the last WireGuard handshake is older than this, the tunnel counts as ' +
			  'stalled (methods "handshake" and "both"). Must be >= 30 for those methods - below the ' +
			  'default WireGuard keepalive cadence, a healthy tunnel would look stalled between beats.'));
		o.modalonly = true;
		o.validate = conditionalFloorValidate('method', ['handshake', 'both'], 30);
		o.datatype = 'uinteger';
		o.default = '150';
		o.depends('method', 'handshake');
		o.depends('method', 'both');

		o = s.option(form.Value, 'interval', _('Check interval (s)'),
			_('Seconds between checks.'));
		o.modalonly = true; o.datatype = 'and(uinteger,min(5))'; o.default = '60';

		o = s.option(form.Value, 'failures', _('Failures before action'),
			_('Number of consecutive failed checks before the action is taken.'));
		o.modalonly = true; o.datatype = 'uinteger'; o.default = '2';

		o = s.option(form.Value, 'action_network', _('Network to restart'),
			_('UCI network restarted by the "ifup" action. lan/management networks are always refused.'));
		o.modalonly = true;
		o.depends('action', 'ifup');
		o.validate = ifnameValidate;
		networks.forEach(function(n) {
			var nm = n.getName();
			if (nm && !/^(lan.*|loopback|mgmt.*|management.*|admin)$/.test(nm))
				o.value(nm);
		});

		o = s.option(form.Value, 'script', _('Action script'),
			_('Absolute path to a root-owned executable inside /usr/libexec/ifwatchdog.d/. ' +
			  'Runs as root.'));
		o.modalonly = true;
		o.depends('action', 'script');
		o.placeholder = '/usr/libexec/ifwatchdog.d/my-action.sh';

		o = s.option(form.Value, 'debounce', _('Debounce (s)'),
			_('Minimum seconds between two actions — prevents rapid repeats. Must be >= 30 once an ' +
			  'action other than "monitor" is configured.'));
		o.modalonly = true; o.datatype = 'uinteger'; o.default = '120';
		o.validate = actionFloorValidate(30);

		o = s.option(form.Value, 'max_actions', _('Max actions per window'),
			_('Circuit breaker: maximum number of actions allowed within the action window (1-100).'));
		o.modalonly = true; o.datatype = 'and(uinteger,range(1,100))'; o.default = '5';

		o = s.option(form.Value, 'action_window', _('Action window (s)'),
			_('Length of the circuit-breaker window, in seconds. Must be >= 300 once an action other ' +
			  'than "monitor" is configured.'));
		o.modalonly = true; o.datatype = 'uinteger'; o.default = '3600';
		o.validate = actionFloorValidate(300);

		o = s.option(form.DynamicList, 'protected_networks', _('Extra protected networks'),
			_('Networks that must never be restarted, in addition to lan/loopback. ' +
			  'Type a network name and press + (or Enter) to add it.'));
		o.modalonly = true;
		o.placeholder = _('e.g. mgmt');

		o = s.option(form.Flag, 'log', _('Logging'),
			_('Write log messages to the system log.'));
		o.modalonly = true; o.default = '1';

		/* --- live status panel --- */
		var statusBox = E('div', { 'class': 'cbi-section', 'id': 'ifwatchdog-status-box' }, [
			E('h3', {}, _('Live status')),
			E('div', { 'id': 'ifwatchdog-status' }, E('em', {}, _('Collecting data…')))
		]);

		poll.add(function() {
			return callStatus().then(function(result) {
				var cont = document.getElementById('ifwatchdog-status');
				if (cont) dom.content(cont, statusTable(result));
			});
		}, 5);

		return m.render().then(function(mapEl) {
			return E('div', {}, [ statusBox, mapEl ]);
		});
	}
});
