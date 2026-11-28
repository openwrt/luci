'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require validation';

/*
 * What the installed daemon package was built with, one word per line:
 * nothing in cake-adapt, mqtt in cake-adapt-mqtt, mqtt and tls in
 * cake-adapt-mqtt-ssl. A missing file reads as nothing.
 */
const FEATURES_FILE = '/usr/share/cake-adapt/features';

function parseFeatures(text) {
	const words = String(text ?? '').split(/\s+/);

	return { mqtt: words.includes('mqtt'), tls: words.includes('tls') };
}

/*
 * What the daemon uses for an option left empty, in the units of the form:
 * cake-adapt -D prints it, one "name=value" line each, and load() reads it.
 * The placeholders and the checks below both read this table.
 */
const DAEMON = '/usr/sbin/cake-adapt';
const defaults = {};

function parseDefaults(text) {
	const parsed = {};

	for (const line of String(text ?? '').split('\n')) {
		const index = line.indexOf('=');

		if (index > 0)
			parsed[line.slice(0, index)] = line.slice(index + 1);
	}
	return parsed;
}

/*
 * The numeric options, each with how many stored units one form unit is
 * (options.c's option table): kbit/s to bit/s, seconds to microseconds, and so
 * on. A ratio is stored per million.
 */
const KILO = 1000n, MILLI = 1000n, SECOND = 1000000n, MINUTE = 60n * SECOND;
const RATIO_ONE = 1000000n;
const scales = {
	mqtt_port: 1n,
	no_pingers: 1n,
	reflector_ping_interval_s: SECOND,
	irtt_session_duration_m: MINUTE,
	min_dl_shaper_rate_kbps: KILO,
	base_dl_shaper_rate_kbps: KILO,
	max_dl_shaper_rate_kbps: KILO,
	min_ul_shaper_rate_kbps: KILO,
	base_ul_shaper_rate_kbps: KILO,
	max_ul_shaper_rate_kbps: KILO,
	log_file_max_size_KB: 1024n,
	log_file_max_time_mins: MINUTE,
	log_file_buffer_timeout_ms: MILLI,
	ul_congest_ack_share: RATIO_ONE,
	connection_active_thr_kbps: KILO,
	sustained_idle_sleep_thr_s: SECOND,
	stall_detection_thr: 1n,
	connection_stall_thr_kbps: KILO,
	global_ping_response_timeout_s: SECOND,
	dl_owd_delta_delay_thr_ms: MILLI,
	ul_owd_delta_delay_thr_ms: MILLI,
	dl_avg_owd_delta_max_adjust_up_thr_ms: MILLI,
	ul_avg_owd_delta_max_adjust_up_thr_ms: MILLI,
	dl_avg_owd_delta_max_adjust_down_thr_ms: MILLI,
	ul_avg_owd_delta_max_adjust_down_thr_ms: MILLI,
	bufferbloat_detection_window: 1n,
	bufferbloat_detection_thr: 1n,
	high_load_thr: RATIO_ONE,
	shaper_rate_min_adjust_down_bufferbloat: RATIO_ONE,
	shaper_rate_max_adjust_down_bufferbloat: RATIO_ONE,
	shaper_rate_min_adjust_up_load_high: RATIO_ONE,
	shaper_rate_max_adjust_up_load_high: RATIO_ONE,
	shaper_rate_adjust_down_load_low: RATIO_ONE,
	shaper_rate_adjust_up_load_low: RATIO_ONE,
	bufferbloat_refractory_period_ms: MILLI,
	decay_refractory_period_ms: MILLI,
	alpha_baseline_increase: RATIO_ONE,
	alpha_baseline_decrease: RATIO_ONE,
	alpha_delta_ewma: RATIO_ONE,
	reflector_health_check_interval_s: SECOND,
	reflector_response_deadline_s: SECOND,
	reflector_misbehaving_detection_window: 1n,
	reflector_misbehaving_detection_thr: 1n,
	reflector_replacement_interval_mins: MINUTE,
	reflector_comparison_interval_mins: MINUTE,
	reflector_sum_owd_baselines_delta_thr_ms: MILLI,
	reflector_owd_delta_ewma_delta_thr_ms: MILLI,
	monitor_achieved_rates_interval_ms: MILLI,
	monitor_cpu_usage_interval_ms: MILLI,
	if_up_check_interval_s: SECOND
};

/* Longest text the daemon takes: it refuses a value of this size or more (config.h). */
const IFNAME_SIZE = 16, STRING_SIZE = 512, REFLECTOR_SIZE = 256, MAX_REFLECTORS = 64;
const textSizes = {
	interface: IFNAME_SIZE, ul_if: IFNAME_SIZE, dl_if: IFNAME_SIZE,
	pinger_method: STRING_SIZE,
	mqtt_host: STRING_SIZE, mqtt_topic: STRING_SIZE, mqtt_username: STRING_SIZE,
	mqtt_password: STRING_SIZE, mqtt_ca_file: STRING_SIZE
};
const pingerMethods = [ 'fping', 'fping-ts', 'irtt', 'native', 'native-ts' ];
const UINT_MAX = 4294967295n, UINT64_MAX = (1n << 64n) - 1n;
/* The daemon's size_t; the smaller, 32-bit one, as the x86 and 32-bit builds have it. */
const SIZE_MAX = UINT_MAX;
/* CAKE holds whole bytes/s. */
const SHAPER_RATE_STEP = 8n;

const byteLength = (text) => new TextEncoder().encode(text).length;

/* target_is_valid in latency.c: an address or hostname that never starts with '-'. */
function targetValid(target) {
	return byteLength(target) > 0 && byteLength(target) < REFLECTOR_SIZE &&
		/^[A-Za-z0-9:][A-Za-z0-9.:_-]*$/.test(target);
}

/* config.c parse_scaled_decimal: a non-negative decimal, stored as a whole number of units. */
function parseDecimal(name, text) {
	const found = /^([0-9]+)(?:\.([0-9]+))?$/.exec(text);
	const scale = scales[name];
	const tooLarge = { error: _("option '%s' is too large").format(name) };

	if (!found)
		return { error: _("option '%s' is not a non-negative decimal").format(name) };

	const whole = BigInt(found[1]);
	if (whole > UINT64_MAX / scale)
		return tooLarge;

	let value = whole * scale, place = scale;
	for (const digit of found[2] || '') {
		/* The next place would not be a whole number of stored units. */
		if (place % 10n != 0n) {
			if (digit != '0')
				return { error: _("option '%s' has more precision than cake-adapt stores").format(name) };
			continue;
		}
		place /= 10n;
		if (value > UINT64_MAX - BigInt(digit) * place)
			return tooLarge;
		value += BigInt(digit) * place;
	}
	return { value };
}

/* validate.c timer_interval_valid: a positive whole number of milliseconds that fits uloop. */
function timerValid(us) {
	return us > 0n && us % MILLI == 0n &&
		us / MILLI <= UINT_MAX;
}

/*
 * A reflector typed or listed, against the others listed (validate.c
 * validate_reflectors, config.c copy_reflector): a message, or true.
 */
function reflectorTooLong(target) {
	return byteLength(target) >= REFLECTOR_SIZE ? _("option 'reflectors' is too long") : true;
}

function reflectorError(target, others) {
	if (reflectorTooLong(target) !== true)
		return reflectorTooLong(target);
	if (!targetValid(target))
		return _("invalid reflector '%s'").format(target);
	if (others.includes(target))
		return _("duplicate reflector '%s'").format(target);
	return true;
}

/* validate.c validate_latency_config: the latency rules apply to an enabled or adjusting instance. */
function latencyChecked(screen) {
	return [ 'enabled', 'adjust_dl_shaper_rate', 'adjust_ul_shaper_rate' ]
		.some((name) => String(screen(name) ?? defaults[name]) == '1');
}

/*
 * Every rule the daemon checks when it loads a section (config.c) and starts
 * (validate.c config_validate), on what is shown. screen(name) returns the
 * value on screen, or nothing when the field is empty, which stands for the
 * default of the table above; reflectors come as a list. features is what
 * the installed package supports (parseFeatures). Returns a list of
 * { option, message }: one entry for each option a failing rule names.
 */
function instanceErrors(screen, features) {
	const errors = [];
	const fail = (message, ...names) => names.forEach((option) => errors.push({ option, message }));
	const text = (name) => {
		const value = screen(name);
		return (value == null || value === '') ? (defaults[name] ?? '') : String(value);
	};
	const on = (name) => text(name) == '1';
	const num = {};
	const known = (...names) => names.every((name) => name in num);
	const reflectors = [].concat(screen('reflectors') ?? []).filter((target) => target !== '');
	/*
	 * config.c load_section: without reflectors, the legacy single latency_target
	 * (not an option of the form; the caller passes the section's stored value)
	 * is the one reflector and, unless no_pingers is set, the only pinger.
	 */
	const legacy = String(screen('latency_target') ?? '');
	const fromLegacy = reflectors.length == 0 && legacy != '';

	if (fromLegacy)
		reflectors.push(legacy);

	/* config.c: text too long, and numbers that are not decimals the daemon stores. */
	for (const name of Object.keys(textSizes))
		if (byteLength(text(name)) >= textSizes[name])
			fail(_("option '%s' is too long").format(name), name);
	for (const name of Object.keys(scales)) {
		const parsed = parseDecimal(name, (fromLegacy && name == 'no_pingers' && !screen(name)) ? '1' : text(name));

		if (parsed.error)
			fail(parsed.error, name);
		else
			num[name] = parsed.value;
	}
	if (reflectors.length > MAX_REFLECTORS)
		fail(_("option 'reflectors' contains more than %d entries").format(MAX_REFLECTORS), 'reflectors');
	for (const target of reflectors)
		if (reflectorTooLong(target) !== true) {
			fail(reflectorTooLong(target), 'reflectors');
			break;
		}
	/* config.c resolve_interfaces. */
	const pair = [ text('ul_if'), text('dl_if') ];
	const partial = (pair[0] != '') != (pair[1] != '');

	if (partial)
		fail(_("options 'ul_if' and 'dl_if' must be configured together"), 'ul_if', 'dl_if');

	const adjusting = on('adjust_dl_shaper_rate') || on('adjust_ul_shaper_rate');

	/*
	 * validate.c config_validate. Without MQTT (cake-adapt) nothing is sent and
	 * the daemon only warns, so the broker settings are not checked; TLS asked
	 * for is refused in every package without it.
	 */
	if (on('mqtt_enabled')) {
		if (features.mqtt && (text('mqtt_host') == '' || /[ /\[\]\t\r\n]/.test(text('mqtt_host'))))
			fail(_("option 'mqtt_host' must be a hostname or IP address"), 'mqtt_host');
		if (features.mqtt && known('mqtt_port') && (num.mqtt_port == 0n || num.mqtt_port > 65535n))
			fail(_("option 'mqtt_port' must be between 1 and 65535"), 'mqtt_port');
		if (features.mqtt && (text('mqtt_topic') == '' || /[+#]/.test(text('mqtt_topic'))))
			fail(_("option 'mqtt_topic' must be nonempty and contain no + or #"), 'mqtt_topic');
		if (features.mqtt && text('mqtt_password') != '' && text('mqtt_username') == '')
			fail(_("option 'mqtt_password' needs mqtt_username"), 'mqtt_password', 'mqtt_username');
		if (on('mqtt_tls')) {
			if (!features.tls)
				fail(_("option 'mqtt_tls' requires the cake-adapt-mqtt-ssl package"), 'mqtt_tls', 'mqtt_enabled');
			else if (!text('mqtt_ca_file').startsWith('/'))
				fail(_("option 'mqtt_ca_file' must be an absolute path"), 'mqtt_ca_file');
		}
	}
	if ((on('enabled') || adjusting) && !partial && pair[0] == '' && text('interface') == '')
		fail(_("set either option 'interface' or both options 'ul_if' and 'dl_if' when cake-adapt is enabled or rate adjustment is configured"), 'interface', 'ul_if', 'dl_if');

	/* validate.c validate_rate_range. */
	for (const [ direction, label, adjust ] of [
		[ 'dl', 'download', 'adjust_dl_shaper_rate' ],
		[ 'ul', 'upload', 'adjust_ul_shaper_rate' ]
	]) {
		const names = [ 'min', 'base', 'max' ].map((level) => `${level}_${direction}_shaper_rate_kbps`);

		if (!known(...names))
			continue;

		const bps = names.map((name) => num[name]);
		const [ min, base, max ] = bps;

		if (!on(adjust) && bps.every((rate) => rate == 0n))
			continue;
		if (min == 0n || base == 0n || max == 0n)
			fail(_('%s min/base/max rates are required together').format(label), ...names);
		else if (min > base || base > max)
			fail(_('%s rates must satisfy minimum <= base <= maximum').format(label), ...names);
		else if (bps.some((rate) => rate % SHAPER_RATE_STEP != 0n))
			fail(_('%s shaper rates must be whole bytes/s (multiples of 8 bit/s)').format(label), ...names);
	}

	/* validate.c validate_latency_config: nothing more unless it will run. */
	if (!on('enabled') && !adjusting)
		return errors;

	/* validate.c validate_pinger. */
	const method = text('pinger_method');
	const methodKnown = pingerMethods.includes(method);
	const interval = num.reflector_ping_interval_s;
	const active = num.no_pingers;

	if (!methodKnown)
		fail(_("option 'pinger_method' must be 'fping', 'fping-ts', 'irtt', 'native' or 'native-ts'"), 'pinger_method');
	if (method == 'irtt' && known('irtt_session_duration_m') && num.irtt_session_duration_m == 0n)
		fail(_("option 'irtt_session_duration_m' must be positive for irtt"), 'irtt_session_duration_m');
	if (reflectors.length == 0)
		fail(_('at least one reflector is required'), 'reflectors');
	else if (known('no_pingers') && (active == 0n || active > BigInt(reflectors.length)))
		fail(_("option 'no_pingers' must be between 1 and the reflector count"), 'no_pingers', 'reflectors');
	for (let index = 0; index < reflectors.length; index++) {
		const problem = reflectorError(reflectors[index], reflectors.slice(index + 1));

		if (problem !== true) {
			fail(problem, 'reflectors');
			break;
		}
	}
	/* ICMP timestamp requests (fping-ts, native-ts) are IPv4 only. */
	if (method == 'fping-ts' || method == 'native-ts') {
		const v6 = reflectors.find((target) => target.includes(':'));

		if (v6 !== undefined)
			fail(_("pinger_method '%s' uses IPv4-only ICMP timestamps; reflector '%s' is IPv6").format(method, v6), 'reflectors', 'pinger_method');
	}
	/* Only an echo pinger (native, fping) reports one shared delay that needs attributing. */
	if (on('tcp_delay_attribution') && methodKnown && method != 'fping' && method != 'native')
		fail(_("option 'tcp_delay_attribution' needs pinger_method 'fping' or 'native'"), 'tcp_delay_attribution', 'pinger_method');
	if (method == 'native' || method == 'native-ts') {
		for (const target of reflectors) {
			if (!validation.parseIPv4(target) && !validation.parseIPv6(target))
				fail(_("native reflector '%s' must be a numeric IP address; use one, or set pinger_method 'fping' for hostnames").format(target), 'reflectors');
		}
	}
	/* Injected timestamps serve only the queue estimate of the attribution. */
	if (on('tcp_ts_request') && !on('tcp_delay_attribution'))
		fail(_("option 'tcp_ts_request' needs tcp_delay_attribution"), 'tcp_ts_request', 'tcp_delay_attribution');
	if (known('reflector_ping_interval_s', 'no_pingers') && active > 0n &&
	    interval / active < MILLI)
		fail(_("option 'reflector_ping_interval_s' must provide at least 1 ms per active reflector"), 'reflector_ping_interval_s', 'no_pingers');

	/* validate.c validate_detection. */
	const monitorInterval = num.monitor_achieved_rates_interval_ms;
	const window = num.bufferbloat_detection_window;

	if (known('monitor_achieved_rates_interval_ms') && !timerValid(monitorInterval))
		fail(_("option 'monitor_achieved_rates_interval_ms' must be a positive whole number of milliseconds no greater than %s").format(String(UINT_MAX)), 'monitor_achieved_rates_interval_ms');
	if (known('bufferbloat_detection_window') && (window == 0n || window > UINT_MAX))
		fail(_("option 'bufferbloat_detection_window' must be between 1 and %s").format(String(UINT_MAX)), 'bufferbloat_detection_window');
	if (known('bufferbloat_detection_thr', 'bufferbloat_detection_window') &&
	    num.bufferbloat_detection_thr > window)
		fail(_("option 'bufferbloat_detection_thr' cannot be greater than 'bufferbloat_detection_window'"), 'bufferbloat_detection_thr', 'bufferbloat_detection_window');
	if (known('ul_congest_ack_share') && num.ul_congest_ack_share > RATIO_ONE)
		fail(_("option 'ul_congest_ack_share' must be between 0 and 1"), 'ul_congest_ack_share');
	for (const name of [ 'alpha_baseline_increase', 'alpha_baseline_decrease', 'alpha_delta_ewma' ])
		if (known(name) && num[name] > RATIO_ONE)
			fail(_('alpha options must be between 0 and 1'), name);

	/* validate.c validate_reflector_policy. */
	const health = num.reflector_health_check_interval_s;

	for (const name of [ 'reflector_health_check_interval_s', 'reflector_response_deadline_s' ])
		if (known(name) && num[name] == 0n)
			fail(_('reflector health interval and response deadline must be positive'), name);
	if (known('reflector_health_check_interval_s') && health != 0n && !timerValid(health))
		fail(_("option 'reflector_health_check_interval_s' must be a whole number of milliseconds no greater than %s").format(String(UINT_MAX)), 'reflector_health_check_interval_s');

	const offenceWindow = num.reflector_misbehaving_detection_window;
	const offences = num.reflector_misbehaving_detection_thr;

	if (known('reflector_misbehaving_detection_window', 'reflector_misbehaving_detection_thr') &&
	    (offenceWindow == 0n || offenceWindow > SIZE_MAX || offences == 0n || offences > offenceWindow))
		fail(_('reflector offence threshold must be between 1 and its window'), 'reflector_misbehaving_detection_window', 'reflector_misbehaving_detection_thr');

	const perReflector = known('reflector_ping_interval_s', 'no_pingers') && active > 0n ?
		interval / active : 0n;
	const stalled = _('stall, global ping timeout and interface retry settings must be positive and representable');

	if (known('stall_detection_thr') && (num.stall_detection_thr == 0n ||
	    (perReflector > 0n && num.stall_detection_thr > UINT64_MAX / perReflector)))
		fail(stalled, 'stall_detection_thr', 'reflector_ping_interval_s', 'no_pingers');
	for (const name of [ 'global_ping_response_timeout_s', 'if_up_check_interval_s' ])
		if (known(name) && num[name] == 0n)
			fail(stalled, name);

	/* validate.c validate_monitoring. */
	if ((on('output_cpu_stats') || on('output_cpu_raw_stats')) &&
	    known('monitor_cpu_usage_interval_ms') && !timerValid(num.monitor_cpu_usage_interval_ms))
		fail(_('CPU monitoring interval must be a positive whole number of milliseconds no greater than %s').format(String(UINT_MAX)), 'monitor_cpu_usage_interval_ms');
	if (known('log_file_buffer_timeout_ms') &&
	    num.log_file_buffer_timeout_ms / MILLI > UINT_MAX)
		fail(_('logging or pinger intervals are too large'), 'log_file_buffer_timeout_ms');
	if (known('reflector_ping_interval_s') && interval > UINT64_MAX / 2n)
		fail(_('logging or pinger intervals are too large'), 'reflector_ping_interval_s');
	if (on('enable_sleep_function') && known('connection_active_thr_kbps')) {
		const threshold = num.connection_active_thr_kbps;
		const over = [ 'min_dl_shaper_rate_kbps', 'min_ul_shaper_rate_kbps' ]
			.filter((name) => known(name) && threshold > num[name]);

		if (over.length)
			fail(_('connection active threshold cannot exceed either minimum shaper rate'), 'connection_active_thr_kbps', 'enable_sleep_function', ...over);
	}
	return errors;
}

/*
 * The Advanced tab of an instance: a NamedSection on that same UCI section,
 * nested in a SectionValue so it can have tabs of its own. Stock NamedSection
 * is bound to one fixed section and load()/parse() walk cfgsections(), so
 * this one takes the instance it is asked for: it renders, loads and parses
 * the section_id the outer TypedSection passes, and its cfgsections() are the
 * outer section's instances (checkDepends walks them to recheck each field).
 */
const AdvancedSection = form.NamedSection.extend({
	cfgsections() {
		return this.parentoption.section.cfgsections();
	},

	load(section_id) {
		return this.loadChildren(section_id).then((values) =>
			values.forEach((value, i) => this.children[i].cfgvalue(section_id, value)));
	},

	parse(section_id) {
		return Promise.all(this.children.map((option) => option.parse(section_id)));
	},

	/* The outer section's node holds this instance's id; the tab groups are found by class. */
	render(section_id) {
		return this.renderUCISection(section_id).then((nodes) => E('div', {
			'class': 'cbi-section-node cbi-section-node-tabbed',
			'data-section-id': section_id
		}, nodes));
	}
});

/*
 * import: config_file, ping_prefix_string, ping_extra_args and
 * log_file_path_override make root run something, choose its arguments or
 * choose where it writes, so they are read only from the root-only
 * /etc/cake-adapt/exec, which this page cannot
 * change; left in /etc/config/cake-adapt, they refuse the instance. Returns
 * "section: option" for each one left there.
 */
function rootOnlyLeftovers(sections) {
	return sections.flatMap((section) => [ 'config_file', 'log_file_path_override', 'ping_extra_args', 'ping_prefix_string' ]
		.filter((name) => section[name] != null)
		.map((name) => `${section['.name']}: ${name}`));
}

return view.extend({
	/* Exposed for the unit tests in the cake-adapt repository (tests/luci_config.js). */
	instanceErrors, reflectorError, reflectorTooLong, latencyChecked, defaults, scales, parseFeatures,
	parseDefaults, rootOnlyLeftovers,

	load() {
		return Promise.all([
			uci.load('cake-adapt'),
			L.resolveDefault(fs.read(FEATURES_FILE), ''),
			L.resolveDefault(fs.exec_direct(DAEMON, [ '-D' ]), '')
		]);
	},

	render(data) {
		const features = parseFeatures(data[1]);

		Object.assign(defaults, parseDefaults(data[2]));
		/*
		 * Settings the package cannot use stay in UCI, unshown. The MQTT switch
		 * still shows while an instance has it on, with a warning, so it can be
		 * turned off.
		 */
		const mqttStored = uci.sections('cake-adapt', 'cake_adapt').some((section) => section.mqtt_enabled == '1');
		const hidden = [];
		const leftovers = rootOnlyLeftovers(uci.sections('cake-adapt', 'cake_adapt'));
		let description = _('Adapts the bandwidth of the CAKE qdiscs that SQM creates to the measured latency. Each section is one instance with its own pair of CAKE qdiscs.');

		if (leftovers.length)
			description += ' ' + _('Warning: %s cannot be set here and keep the instance from starting; root must move them to /etc/cake-adapt/exec.').format(leftovers.join(', '));

		const m = new form.Map('cake-adapt', _('CAKE Adapt'), description);

		const s = m.section(form.TypedSection, 'cake_adapt', _('Instances'));
		s.addremove = true;
		s.anonymous = false;

		s.tab('general', _('General'));
		s.tab('rates', _('Shaper rates'));
		s.tab('reflectors', _('Reflectors'));
		s.tab('advanced', _('Advanced'));

		let o;

		/* General */
		o = s.taboption('general', form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;
		o = s.taboption('general', form.Value, 'interface', _('Interface'),
			_('Upload CAKE interface; download uses ifb4&lt;interface&gt;.'));
		o = s.taboption('general', form.Value, 'ul_if', _('Upload interface'),
			_('With Download interface, overrides Interface for other layouts.'));
		o = s.taboption('general', form.Value, 'dl_if', _('Download interface'));
		o = s.taboption('general', form.Flag, 'adjust_dl_shaper_rate', _('Adjust download'),
			_('Off only observes; on adjusts the download CAKE.'));
		o = s.taboption('general', form.Flag, 'adjust_ul_shaper_rate', _('Adjust upload'));

		/* Shaper rates */
		o = s.taboption('rates', form.Value, 'min_dl_shaper_rate_kbps', _('Download minimum (kbit/s)'));
		o = s.taboption('rates', form.Value, 'base_dl_shaper_rate_kbps', _('Download base (kbit/s)'));
		o = s.taboption('rates', form.Value, 'max_dl_shaper_rate_kbps', _('Download maximum (kbit/s)'));
		o = s.taboption('rates', form.Value, 'min_ul_shaper_rate_kbps', _('Upload minimum (kbit/s)'));
		o = s.taboption('rates', form.Value, 'base_ul_shaper_rate_kbps', _('Upload base (kbit/s)'));
		o = s.taboption('rates', form.Value, 'max_ul_shaper_rate_kbps', _('Upload maximum (kbit/s)'));

		/* Reflectors */
		o = s.taboption('reflectors', form.DynamicList, 'reflectors', _('Reflectors'),
			_('Hosts to ping; a few are active at a time.'));

		/*
		 * Advanced holds its options in tabs of their own: a section on the
		 * same instance, nested in the Advanced tab (AdvancedSection).
		 */
		o = s.taboption('advanced', form.SectionValue, '_advanced', AdvancedSection, null, 'cake_adapt');
		const a = o.subsection;

		a.tab('pinger', _('Pinger'));
		a.tab('logging', _('Logging'));
		a.tab('tcp', _('TCP measurement'));
		a.tab('idle', _('Idle and stall'));
		a.tab('controller', _('Controller'));
		a.tab('health', _('Reflector health'));
		a.tab('timing', _('Timing'));

		/* Advanced: Reflectors and pinger */
		o = a.taboption('pinger', form.Value, 'no_pingers', _('Active reflectors'),
			_('Reflectors pinged at a time, from 1 up to the number of reflectors.'));
		o = a.taboption('pinger', form.Value, 'reflector_ping_interval_s', _('Ping interval (s)'),
			_('Seconds between pings to each active reflector.'));
		o = a.taboption('pinger', form.Flag, 'randomize_reflectors', _('Randomize reflectors'),
			_('Shuffle the reflector list at start.'));
		o.default = o.enabled;
		o.rmempty = false;
		o = a.taboption('pinger', form.ListValue, 'pinger_method', _('Pinger method'),
			_('native (default) or native-ts (IPv4 only): ICMP probes sent by cake-adapt itself, to numeric addresses. fping, fping-ts and irtt are fallbacks that need their package installed; their extra arguments and command prefix, a shell configuration file and the log directory are set only by root, in /etc/cake-adapt/exec. native refuses an instance whose extra arguments or prefix root has set there.'));
		/* Empty keeps the option unset: the daemon's default, which -D names. */
		o.value('', defaults.pinger_method ? _('Default (%s)').format(defaults.pinger_method) : _('Default'));
		for (const method of pingerMethods)
			o.value(method, method);
		o = a.taboption('pinger', form.Value, 'irtt_session_duration_m', _('IRTT session length (min)'),
			_('Length of each IRTT session (irtt only).'));

		/* Advanced: Output and logging */
		if (features.mqtt || mqttStored) {
			o = a.taboption('logging', form.Flag, 'mqtt_enabled', _('Send logs to MQTT'),
				features.mqtt ? _('Off by default. Send generated cake-adapt log records without waiting for the broker. Disconnected or overloaded senders silently discard records. Retry every 10 seconds indefinitely.') :
					_('Warning: this package has no MQTT support. While this is on, cake-adapt sends no logs to MQTT and logs a warning at start; turn it off, or install cake-adapt-mqtt or cake-adapt-mqtt-ssl.'));
			o.rmempty = false;
		}
		else {
			hidden.push('mqtt_enabled');
		}
		if (features.mqtt) {
			o = a.taboption('logging', form.Value, 'mqtt_host', _('MQTT broker host'),
				_('Hostname or IPv4/IPv6 address, without a URL scheme or port.'));
			o = a.taboption('logging', form.Value, 'mqtt_port', _('MQTT broker port'),
				features.tls ? _('Usually 1883 for plain MQTT or 8883 for TLS.') : _('Usually 1883.'));
			o = a.taboption('logging', form.Value, 'mqtt_topic', _('MQTT topic'),
				_('One plain-text log record per message. Use a different topic for each instance if needed.'));
			o = a.taboption('logging', form.Value, 'mqtt_username', _('MQTT username'));
			o = a.taboption('logging', form.Value, 'mqtt_password', _('MQTT password'));
			o.password = true;
		}
		else {
			hidden.push('mqtt_host', 'mqtt_port', 'mqtt_topic', 'mqtt_username', 'mqtt_password');
		}
		if (features.tls) {
			o = a.taboption('logging', form.Flag, 'mqtt_tls', _('Encrypt MQTT with TLS'),
				_('Verify the broker certificate and hostname. Without TLS, MQTT traffic and credentials are unencrypted.'));
			o.rmempty = false;
			o.retain = true;
			o.depends('mqtt_enabled', '1');
			o = a.taboption('logging', form.Value, 'mqtt_ca_file', _('MQTT trusted CA file'),
				_('Absolute path to a trusted CA bundle on the router.'));
			o.retain = true;
			o.depends({ mqtt_enabled: '1', mqtt_tls: '1' });
		}
		else {
			hidden.push('mqtt_tls', 'mqtt_ca_file');
		}
		o = a.taboption('logging', form.Flag, 'log_to_file', _('Log to file'),
			_('Write the log file.'));
		o.default = o.enabled;
		o.rmempty = false;
		o = a.taboption('logging', form.Value, 'log_file_max_size_KB', _('Log size limit (KB)'),
			_('Rotate when the log reaches this size.'));
		o = a.taboption('logging', form.Value, 'log_file_max_time_mins', _('Log time limit (min)'),
			_('Rotate after this time.'));
		o = a.taboption('logging', form.Value, 'log_file_buffer_timeout_ms', _('Log buffer timeout (ms)'),
			_('Longest time a record waits in the write buffer.'));
		o = a.taboption('logging', form.Flag, 'log_file_export_compress', _('Compress exported logs'),
			_('Compress the export written on SIGUSR1.'));
		o.default = o.enabled;
		o.rmempty = false;
		o = a.taboption('logging', form.Flag, 'debug', _('Debug messages'),
			_('Include debug messages in the log file.'));
		o.default = o.enabled;
		o.rmempty = false;
		o = a.taboption('logging', form.Flag, 'log_DEBUG_messages_to_syslog', _('Debug messages to syslog'),
			_('Also send debug messages to syslog.'));
		o = a.taboption('logging', form.Flag, 'output_processing_stats', _('Processing records'),
			_('Write DATA, TCP_QUEUE and TCP_INJECT records to the log.'));
		o = a.taboption('logging', form.Flag, 'output_load_stats', _('Load records'),
			_('Write a LOAD record per traffic sample.'));
		o = a.taboption('logging', form.Flag, 'output_reflector_stats', _('Reflector records'),
			_('Write REFLECTOR records at each reflector comparison.'));
		o = a.taboption('logging', form.Flag, 'output_summary_stats', _('Summary records'),
			_('Write a SUMMARY record per ping reply.'));
		o = a.taboption('logging', form.Flag, 'output_cake_changes', _('Shaper records'),
			_('Write a SHAPER record for each rate change.'));
		o = a.taboption('logging', form.Flag, 'output_cpu_stats', _('CPU records'),
			_('Write CPU usage records.'));
		o = a.taboption('logging', form.Flag, 'output_cpu_raw_stats', _('Raw CPU records'),
			_('Write raw CPU counter records.'));
		o = a.taboption('logging', form.Flag, 'output_memory_stats', _('Memory records'),
			_('Write the daemon memory use every 10 s.'));

		/* Advanced: TCP measurement (eBPF) */
		o = a.taboption('tcp', form.Flag, 'tcp_delay_attribution', _('TCP delay attribution'),
			_('With an echo pinger (native or fping), split the round-trip delay between directions by queue delays measured from TCP timestamps.'));
		o = a.taboption('tcp', form.Value, 'ul_congest_ack_share', _('Upload ACK share'),
			_('0 to 1, 0 is off: while upload is busy, hold download back so its ACKs keep this share of the upload rate.'));
		o = a.taboption('tcp', form.Flag, 'tcp_ts_request', _('TCP timestamp request (experimental)'),
			_('Needs TCP delay attribution: add a timestamp to IPv6 SYNs that lack one so those connections are measured.'));

		/* Advanced: Idle, sleep and stall */
		o = a.taboption('idle', form.Flag, 'enable_sleep_function', _('Sleep when idle'),
			_('Stop pinging when the line is idle.'));
		o.default = o.enabled;
		o.rmempty = false;
		o = a.taboption('idle', form.Value, 'connection_active_thr_kbps', _('Active threshold (kbit/s)'),
			_('Traffic above this rate counts as active; with sleep it must not exceed either minimum rate.'));
		o = a.taboption('idle', form.Value, 'sustained_idle_sleep_thr_s', _('Idle time before sleep (s)'),
			_('Idle time before sleeping.'));
		o = a.taboption('idle', form.Flag, 'min_shaper_rates_enforcement', _('Minimum rates on sleep'),
			_('Set both rates to their minimum on sleep or a global ping timeout.'));
		o = a.taboption('idle', form.Value, 'stall_detection_thr', _('Stall detection count'),
			_('Consecutive missed replies, with low traffic, that mean a stalled connection.'));
		o = a.taboption('idle', form.Value, 'connection_stall_thr_kbps', _('Stall threshold (kbit/s)'),
			_('Traffic below this rate allows a stall.'));
		o = a.taboption('idle', form.Value, 'global_ping_response_timeout_s', _('Global ping timeout (s)'),
			_('No reply from any reflector for this long restarts the pingers.'));

		/* Advanced: Controller tuning */
		o = a.taboption('controller', form.Value, 'dl_owd_delta_delay_thr_ms', _('Download delay threshold (ms)'),
			_('Download delay increase that counts as bufferbloat.'));
		o = a.taboption('controller', form.Value, 'ul_owd_delta_delay_thr_ms', _('Upload delay threshold (ms)'),
			_('Upload delay increase that counts as bufferbloat.'));
		o = a.taboption('controller', form.Value, 'dl_avg_owd_delta_max_adjust_up_thr_ms', _('Download full increase delay (ms)'),
			_('At high load the download increase shrinks to its smallest at this average delay increase.'));
		o = a.taboption('controller', form.Value, 'ul_avg_owd_delta_max_adjust_up_thr_ms', _('Upload full increase delay (ms)'),
			_('The same for upload.'));
		o = a.taboption('controller', form.Value, 'dl_avg_owd_delta_max_adjust_down_thr_ms', _('Download full cut delay (ms)'),
			_('On bufferbloat the download cut reaches its largest at this average delay increase.'));
		o = a.taboption('controller', form.Value, 'ul_avg_owd_delta_max_adjust_down_thr_ms', _('Upload full cut delay (ms)'),
			_('The same for upload.'));
		o = a.taboption('controller', form.Value, 'bufferbloat_detection_window', _('Detection window'),
			_('Recent samples examined for bufferbloat.'));
		o = a.taboption('controller', form.Value, 'bufferbloat_detection_thr', _('Detection threshold'),
			_('Delayed samples within the window that mean bufferbloat.'));
		o = a.taboption('controller', form.Value, 'high_load_thr', _('High load threshold'),
			_('Share of the shaper rate in use that counts as high load.'));
		o = a.taboption('controller', form.Value, 'shaper_rate_min_adjust_down_bufferbloat', _('Smallest cut'),
			_('Smallest cut on bufferbloat, as a multiplier.'));
		o = a.taboption('controller', form.Value, 'shaper_rate_max_adjust_down_bufferbloat', _('Largest cut'),
			_('Largest cut on bufferbloat, as a multiplier.'));
		o = a.taboption('controller', form.Value, 'shaper_rate_min_adjust_up_load_high', _('Smallest increase'),
			_('Smallest increase at high load, as a multiplier.'));
		o = a.taboption('controller', form.Value, 'shaper_rate_max_adjust_up_load_high', _('Largest increase'),
			_('Largest increase at high load, as a multiplier.'));
		o = a.taboption('controller', form.Value, 'shaper_rate_adjust_down_load_low', _('Low load decay'),
			_('Decay toward base from above at low load, as a multiplier.'));
		o = a.taboption('controller', form.Value, 'shaper_rate_adjust_up_load_low', _('Low load recovery'),
			_('Recovery toward base from below at low load, as a multiplier.'));
		o = a.taboption('controller', form.Value, 'bufferbloat_refractory_period_ms', _('Cut refractory period (ms)'),
			_('Minimum time between cuts.'));
		o = a.taboption('controller', form.Value, 'decay_refractory_period_ms', _('Decay refractory period (ms)'),
			_('Minimum time between low-load decay steps.'));
		o = a.taboption('controller', form.Value, 'alpha_baseline_increase', _('Baseline rise rate'),
			_('How fast the baseline of a reflector rises.'));
		o = a.taboption('controller', form.Value, 'alpha_baseline_decrease', _('Baseline fall rate'),
			_('How fast the baseline of a reflector falls.'));
		o = a.taboption('controller', form.Value, 'alpha_delta_ewma', _('Delay smoothing'),
			_('Smoothing of the delay increase.'));

		/* Advanced: Reflector health */
		o = a.taboption('health', form.Value, 'reflector_health_check_interval_s', _('Health check interval (s)'),
			_('Interval between health checks.'));
		o = a.taboption('health', form.Value, 'reflector_response_deadline_s', _('Response deadline (s)'),
			_('A reflector silent for longer commits an offence.'));
		o = a.taboption('health', form.Value, 'reflector_misbehaving_detection_window', _('Offence window'),
			_('Health checks examined for offences.'));
		o = a.taboption('health', form.Value, 'reflector_misbehaving_detection_thr', _('Offence threshold'),
			_('Offences within the window that replace a reflector.'));
		o = a.taboption('health', form.Value, 'reflector_replacement_interval_mins', _('Replacement interval (min)'),
			_('Interval for replacing a random reflector anyway.'));
		o = a.taboption('health', form.Value, 'reflector_comparison_interval_mins', _('Comparison interval (min)'),
			_('Interval for comparing active reflectors.'));
		o = a.taboption('health', form.Value, 'reflector_sum_owd_baselines_delta_thr_ms', _('Baseline difference (ms)'),
			_('Baseline difference from the best reflector that replaces one.'));
		o = a.taboption('health', form.Value, 'reflector_owd_delta_ewma_delta_thr_ms', _('Delay difference (ms)'),
			_('Delay-increase difference from the best reflector that replaces one.'));
		o = a.taboption('health', form.Flag, 'retain_reflector_stats', _('Retain reflector statistics'),
			_('Keep the baseline of a replaced reflector for when it is used again.'));
		o.default = o.enabled;
		o.rmempty = false;

		/* Advanced: Timing */
		o = a.taboption('timing', form.Value, 'monitor_achieved_rates_interval_ms', _('Traffic sampling interval (ms)'),
			_('Interval between traffic samples.'));
		o = a.taboption('timing', form.Value, 'monitor_cpu_usage_interval_ms', _('CPU sampling interval (ms)'),
			_('CPU sampling interval, with CPU records.'));
		o = a.taboption('timing', form.Value, 'if_up_check_interval_s', _('Retry interval (s)'),
			_('Retry interval for a missing interface or qdisc, and for a pinger that failed to start.'));

		/*
		 * Every option shows the daemon's default and checks what is on screen
		 * against the daemon's rules (instanceErrors): the field of an option a
		 * failing rule names turns red and says why. The list is worked out once
		 * for all the fields that ask in the same moment.
		 */
		const options = s.children.concat(a.children).filter((option) => !option.option.startsWith('_'));
		/* What is on screen in both sections of the instance. */
		const valuesOf = (section_id) => Object.assign(s.formvalue(section_id), a.formvalue(section_id));
		const cache = {};
		const errorsOf = (section_id) => {
			if (cache[section_id])
				return cache[section_id];

			const values = valuesOf(section_id);

			/* Options without a field are checked as stored, as the daemon will read them. */
			for (const name of [ 'latency_target', ...hidden ])
				values[name] = uci.get('cake-adapt', section_id, name);
			const errors = instanceErrors((name) => values[name], features);

			cache[section_id] = errors;
			setTimeout(() => delete cache[section_id], 0);
			return errors;
		};

		for (const option of options) {
			if (!(option instanceof form.Flag) && defaults[option.option] != null)
				option.placeholder = defaults[option.option];
			option.validate = function(section_id, value) {
				/* A reflector being typed is checked by itself; the list when it is empty. */
				if (this.option == 'reflectors' && value) {
					const values = valuesOf(section_id);
					const listed = [].concat(values.reflectors ?? []);

					/* The address rules are the latency ones; the size limit is the loader's. */
					return latencyChecked((name) => values[name]) ? reflectorError(value, listed) : reflectorTooLong(value);
				}

				const error = errorsOf(section_id).find((e) => e.option == this.option);

				return error ? error.message : true;
			};
		}

		/*
		 * A change in one field can make another right or wrong (a base above a
		 * maximum, the pinger and the reflectors), so every field of the instance
		 * is checked again. Save then refuses while one is invalid: Map.save
		 * validates every field and each option's parse() rejects an invalid one.
		 */
		return m.render().then((node) => {
			const recheck = (ev) => {
				const holder = ev.target.closest('[data-section-id]');

				if (!holder)
					return;

				const section_id = holder.getAttribute('data-section-id');

				delete cache[section_id];
				for (const option of options)
					option.triggerValidation(section_id);
			};

			for (const type of [ 'keyup', 'input', 'change', 'widget-change', 'cbi-dynlist-change' ])
				node.addEventListener(type, recheck);
			return node;
		});
	}
});
