'use strict';
'require view';
'require rpc';
'require poll';

// ── RPC declarations ──────────────────────────────────────────────────────────

var callStatus = rpc.declare({
	object: 'luci.starlink-panel',
	method: 'status',
	expect: {}
});

var callDish = rpc.declare({
	object: 'luci.starlink-panel',
	method: 'dish',
	expect: {}
});

var callRebootDish = rpc.declare({
	object: 'luci.starlink-panel',
	method: 'reboot_dish',
	expect: {}
});

var callDisableHwOffloading = rpc.declare({
	object: 'luci.starlink-panel',
	method: 'disable_hw_offloading',
	expect: {}
});

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtBytes(b) {
	b = parseInt(b) || 0;
	if (b === 0) return '0 B';
	var units = ['B', 'KB', 'MB', 'GB', 'TB'];
	var i = 0;
	while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
	return b.toFixed(i > 0 ? 2 : 0) + '\u00a0' + units[i];
}

function fmtBps(bps) {
	bps = parseFloat(bps) || 0;
	if (bps >= 1e9) return (bps / 1e9).toFixed(2) + '\u00a0Gbps';
	if (bps >= 1e6) return (bps / 1e6).toFixed(1) + '\u00a0Mbps';
	if (bps >= 1e3) return (bps / 1e3).toFixed(1) + '\u00a0Kbps';
	return bps.toFixed(0) + '\u00a0bps';
}

function fmtUptime(s) {
	s = parseInt(s) || 0;
	var d = Math.floor(s / 86400);
	var h = Math.floor((s % 86400) / 3600);
	var m = Math.floor((s % 3600) / 60);
	if (d > 0) return d + 'd\u00a0' + h + 'h\u00a0' + m + 'm';
	if (h > 0) return h + 'h\u00a0' + m + 'm';
	return m + 'm';
}

function fmtPct(f) {
	return (parseFloat(f) * 100).toFixed(2) + '%';
}

// ── Tiny HTML helpers ─────────────────────────────────────────────────────────

var BADGE_COLORS = {
	ok:      'background:#1a7f37;color:#fff',
	warn:    'background:#9a6700;color:#fff',
	err:     'background:#cf222e;color:#fff',
	info:    'background:#0550ae;color:#fff',
	muted:   'background:#6e7781;color:#fff',
	off:     'background:#444c56;color:#cdd9e5'
};

function badge(text, type) {
	var s = BADGE_COLORS[type] || BADGE_COLORS.muted;
	return '<span style="' + s + ';padding:1px 8px;border-radius:10px;font-size:0.82em;font-weight:600;white-space:nowrap">' + String(text) + '</span>';
}

function dot(ok) {
	var c = ok ? '#2ea043' : '#cf222e';
	return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + c + ';margin-right:5px;flex-shrink:0"></span>';
}

function row(label, value) {
	return '<div class="sl-row"><span class="sl-lbl">' + label + '</span><span class="sl-val">' + value + '</span></div>';
}

function card(title, icon, body, extraClass) {
	return '<div class="sl-card' + (extraClass ? ' ' + extraClass : '') + '">' +
		'<div class="sl-card-hd"><span class="sl-card-icon">' + icon + '</span>' + title + '</div>' +
		'<div class="sl-card-bd">' + body + '</div>' +
		'</div>';
}

function alertRow(label, value, isAlert) {
	if (!isAlert) return '';
	return '<div class="sl-alert-row">' + badge('!', 'err') + ' ' + label + ': ' + value + '</div>';
}

// ── CSS ───────────────────────────────────────────────────────────────────────

var CSS = '<style>' +
':root{--sl-bg:#0d1117;--sl-surface:#161b22;--sl-border:#30363d;--sl-text:#c9d1d9;--sl-muted:#8b949e;--sl-accent:#58a6ff;--sl-green:#3fb950;--sl-yellow:#d29922;--sl-red:#f85149}' +
'.sl-wrap{background:var(--sl-bg);color:var(--sl-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;padding:20px;border-radius:8px;min-height:400px}' +
'.sl-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--sl-border)}' +
'.sl-title{font-size:1.3em;font-weight:700;color:var(--sl-accent);display:flex;align-items:center;gap:8px}' +
'.sl-meta{font-size:0.8em;color:var(--sl-muted);display:flex;align-items:center;gap:10px}' +
'.sl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}' +
'.sl-card{background:var(--sl-surface);border:1px solid var(--sl-border);border-radius:8px;overflow:hidden}' +
'.sl-card-full{grid-column:1/-1}' +
'.sl-card-hd{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--sl-border);font-size:0.88em;font-weight:600;color:var(--sl-muted);text-transform:uppercase;letter-spacing:.06em}' +
'.sl-card-icon{font-size:1.1em}' +
'.sl-card-bd{padding:12px 14px}' +
'.sl-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #21262d;font-size:0.88em;gap:8px}' +
'.sl-row:last-child{border-bottom:none}' +
'.sl-lbl{color:var(--sl-muted);white-space:nowrap}' +
'.sl-val{font-weight:500;text-align:right;word-break:break-all;color:var(--sl-text)}' +
'.sl-big-row{display:flex;justify-content:space-around;padding:10px 0}' +
'.sl-big-item{text-align:center}' +
'.sl-big-num{font-size:1.5em;font-weight:700;color:var(--sl-text)}' +
'.sl-big-lbl{font-size:0.75em;color:var(--sl-muted);margin-top:2px}' +
'.sl-qdisc{font-family:monospace;font-size:0.78em;color:var(--sl-muted);padding:8px;background:#1c2128;border-radius:4px;margin-top:10px;word-break:break-all}' +
'.sl-na{color:var(--sl-muted);font-size:0.85em;font-style:italic;text-align:center;padding:12px 0}' +
'.sl-note{background:#1c2128;border:1px solid var(--sl-border);border-left:3px solid var(--sl-accent);border-radius:0 4px 4px 0;padding:10px 12px;font-size:0.82em;color:var(--sl-muted);margin-top:8px}' +
'.sl-note code{background:#0d1117;padding:1px 5px;border-radius:3px;font-family:monospace;color:var(--sl-accent)}' +
'.sl-alert-row{margin-top:4px;font-size:0.85em;color:var(--sl-yellow)}' +
'.sl-align-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:4px 0}' +
'.sl-align-item{text-align:center;background:#1c2128;border:1px solid var(--sl-border);border-radius:6px;padding:12px 8px}' +
'.sl-align-val{font-size:1.4em;font-weight:700;color:var(--sl-text);letter-spacing:-0.01em}' +
'.sl-align-lbl{font-size:0.78em;color:var(--sl-muted);margin-top:4px}' +
'.sl-align-ok{font-size:1.1em;font-weight:600;color:var(--sl-green);text-align:center;padding:8px}' +
'.sl-reboot-btn{width:100%;margin-top:12px;padding:8px 0;background:#21262d;border:1px solid #f0883e;color:#f0883e;border-radius:6px;font-size:0.88em;font-weight:600;cursor:pointer;letter-spacing:.03em}' +
'.sl-reboot-btn:hover{background:#2d1f0e;border-color:#f0883e}' +
'.sl-reboot-btn:disabled{opacity:0.4;cursor:not-allowed}' +
'.sl-al-list{display:grid;grid-template-columns:1fr 1fr;gap:0}' +
'.sl-al-item{display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #21262d;font-size:0.87em}' +
'.sl-al-item:nth-child(odd):last-child{grid-column:1/-1}' +
'.sl-al-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}' +
'.sl-al-ok{background:var(--sl-green)}' +
'.sl-al-err{background:var(--sl-red)}' +
'.sl-al-txt-ok{color:var(--sl-text)}' +
'.sl-al-txt-err{color:var(--sl-red);font-weight:600}' +
'</style>';

// ── Card builders ─────────────────────────────────────────────────────────────

function buildDishCard(d) {
	var body = '';

	if (!d || !d.available) {
		var reason = (d && d.error) ? d.error : 'unavailable';
		body += '<div class="sl-na">Dish API: ' + reason + '</div>';
		body += '<div class="sl-note">For live dish telemetry, install <code>grpcurl</code> (linux/arm64) to <code>/usr/bin/grpcurl</code>.<br>' +
			'Download from <strong>github.com/fullstorydev/grpcurl/releases</strong></div>';
		return card('Dish Telemetry', '📡', body);
	}

	var state    = d.state || 'UNKNOWN';
	var isConn   = state === 'CONNECTED';
	var latency  = parseFloat(d.latency_ms) || 0;
	var drop     = parseFloat(d.drop_rate)  || 0;
	var obst     = parseFloat(d.fraction_obstructed) || 0;
	var elev     = parseFloat(d.elevation_deg) || 0;
	var snrOk    = d.snr_above_noise === 'true';

	body += row('State',       badge(state, isConn ? 'ok' : 'warn'));
	body += row('PoP Latency', badge(latency.toFixed(1) + ' ms',
		latency < 50 ? 'ok' : latency < 100 ? 'warn' : 'err'));
	body += row('Drop Rate',   badge(fmtPct(drop),
		drop < 0.001 ? 'ok' : drop < 0.01 ? 'warn' : 'err'));
	body += row('Obstruction', badge(fmtPct(obst),
		obst < 0.005 ? 'ok' : obst < 0.05 ? 'warn' : 'err'));
	body += row('SNR OK',      badge(snrOk ? 'yes' : 'no', snrOk ? 'ok' : 'err'));
	body += row('Elevation',   elev.toFixed(1) + '°');

	if (d.gps_sats && parseInt(d.gps_sats) > 0) {
		var gpsValid = d.gps_valid === 'true';
		body += row('GPS', badge(parseInt(d.gps_sats) + ' sats', gpsValid ? 'ok' : 'warn') + (gpsValid ? '' : ' ' + badge('no fix', 'err')));
	}
	if (d.eth_speed_mbps && parseInt(d.eth_speed_mbps) > 0)
		body += row('Ethernet', parseInt(d.eth_speed_mbps) + ' Mbps');
	if (d.attitude)
		body += row('Alignment', badge(d.attitude.replace('FILTER_', ''), 'info'));
	if (d.uptime)
		body += row('Dish Uptime', fmtUptime(d.uptime));
	if (d.class_of_service && d.class_of_service !== 'UNKNOWN')
		body += row('Service', badge(d.class_of_service.replace('CLASS_OF_SERVICE_', ''), 'info'));
	if (d.mobility_class && d.mobility_class !== 'UNKNOWN' && d.mobility_class !== 'MOBILITY_CLASS_NONE')
		body += row('Mobility', badge(d.mobility_class.replace('MOBILITY_CLASS_', ''), 'info'));
	var secsToSlot = parseFloat(d.seconds_to_slot) || 0;
	if (secsToSlot > 0 && secsToSlot < 600)
		body += row('Next Slot', badge(secsToSlot.toFixed(0) + 's', 'warn'));
	var obstDur = parseFloat(d.avg_obstruction_dur) || 0;
	var obstInt = parseFloat(d.avg_obstruction_int) || 0;
	if (obstDur > 0)
		body += row('Avg Obstruction', obstDur.toFixed(1) + 's every ' + (obstInt > 0 ? obstInt.toFixed(0) + 's' : '—'));
	if (d.sw_reboot_ready === 'true')
		body += row('SW Update', badge('reboot required', 'warn'));

	// Active alerts only
	if (d.alert_thermal  === 'true') body += alertRow('Thermal throttle', 'active', true);
	if (d.alert_motors   === 'true') body += alertRow('Motors stuck',     'active', true);
	if (d.alert_mast     === 'true') body += alertRow('Mast not vertical','active', true);
	if (d.alert_slow_eth === 'true') body += alertRow('Slow ethernet',    'active', true);
	if (d.alert_heating  === 'true') body += alertRow('Snow melt heating','active', true);

	if (d.hardware) body += row('Dish HW',  '<span style="font-size:0.82em">' + d.hardware + '</span>');
	if (d.software) body += row('Firmware', '<span style="font-size:0.82em">' + d.software + '</span>');
	if (d.dish_id)  body += row('Dish ID',  '<span style="font-size:0.78em;font-family:monospace">' + d.dish_id + '</span>');
	if (d.country_code) body += row('Country', d.country_code);
	if (parseInt(d.bootcount) > 0) body += row('Boot Count', parseInt(d.bootcount).toLocaleString());
	var rebootHour = parseInt(d.swupdate_reboot_hour);
	if (!isNaN(rebootHour)) body += row('Daily Reboot', rebootHour + ':00 local');
	var dlR = d.dl_restrict && d.dl_restrict !== 'NO_LIMIT' ? d.dl_restrict.replace(/_/g, '\u00a0') : null;
	var ulR = d.ul_restrict && d.ul_restrict !== 'NO_LIMIT' ? d.ul_restrict.replace(/_/g, '\u00a0') : null;
	if (dlR) body += row('DL Limit', badge(dlR, 'warn'));
	if (ulR) body += row('UL Limit', badge(ulR, 'warn'));

	return card('Dish Telemetry', '📡', body);
}

function buildAlignmentCard(d) {
	var body = '';

	if (!d || !d.available) {
		body += '<div class="sl-na">No dish data</div>';
		return card('Alignment', '🎯', body);
	}

	var boreEl  = parseFloat(d.bore_elevation_deg)  || 0;
	var desEl   = parseFloat(d.desired_elevation_deg) || 0;
	var boreAz  = parseFloat(d.bore_azimuth_deg)     || 0;
	var desAz   = parseFloat(d.desired_azimuth_deg)   || 0;
	var tiltNow = parseFloat(d.tilt_angle_deg)        || 0;

	var tiltDiff   = desEl - boreEl;
	var rotateDiff = desAz - boreAz;
	// Normalise azimuth diff to [-180, 180]
	while (rotateDiff >  180) rotateDiff -= 360;
	while (rotateDiff < -180) rotateDiff += 360;

	var tiltAbs   = Math.abs(tiltDiff).toFixed(2);
	var rotateAbs = Math.abs(rotateDiff).toFixed(2);
	var tiltDir   = tiltDiff   < 0 ? '↓' : '↑';
	var rotateDir = rotateDiff > 0 ? '↻' : '↶';

	var aligned = Math.abs(tiltDiff) < 5 && Math.abs(rotateDiff) < 5;

	if (aligned) {
		body += '<div class="sl-align-ok">✓ Dish is well aligned</div>';
	}

	body += '<div class="sl-align-grid">';
	body += '<div class="sl-align-item">' +
		'<div class="sl-align-val">' + tiltAbs + '°' + tiltDir + '</div>' +
		'<div class="sl-align-lbl">Tilt recommendation</div></div>';
	body += '<div class="sl-align-item">' +
		'<div class="sl-align-val">' + rotateAbs + '°' + rotateDir + '</div>' +
		'<div class="sl-align-lbl">Rotate recommendation</div></div>';
	body += '</div>';

	body += row('Current tilt',    tiltNow.toFixed(2) + '°');
	body += row('Elevation',       boreEl.toFixed(2) + '° → ' + desEl.toFixed(2) + '°');
	body += row('Azimuth',         boreAz.toFixed(2) + '° → ' + desAz.toFixed(2) + '°');
	if (d.attitude) body += row('Attitude', badge(d.attitude.replace('FILTER_', ''), 'info'));
	var attUnc = parseFloat(d.attitude_uncertainty_deg) || 0;
	if (attUnc > 0) body += row('Attitude Uncertainty', badge(attUnc.toFixed(2) + '°', attUnc < 1 ? 'ok' : attUnc < 3 ? 'warn' : 'err'));
	if (d.has_actuators) body += row('Actuators', badge(d.has_actuators.replace('HAS_ACTUATORS_', ''), 'info'));

	// Reboot button
	body += '<button class="sl-reboot-btn" id="sl-reboot-btn" onclick="starlinkRebootDish(this)">⟳ Reboot Dish</button>';

	return card('Alignment', '🎯', body);
}

function alItem(ok, okText, errText) {
	var cls = ok ? 'sl-al-ok' : 'sl-al-err';
	var tcls = ok ? 'sl-al-txt-ok' : 'sl-al-txt-err';
	return '<div class="sl-al-item"><span class="sl-al-dot ' + cls + '"></span>' +
		'<span class="' + tcls + '">' + (ok ? okText : errText) + '</span></div>';
}

function buildAlertsCard(d) {
	if (!d || !d.available) {
		return card('Alerts', '🔔', '<div class="sl-na">No dish data</div>');
	}

	var ok   = function(f) { return f !== 'true'; };
	var swOk = d.sw_update_state === 'IDLE' || d.sw_update_state === '';
	var notObstructed = d.currently_obstructed !== 'true' &&
	                    parseFloat(d.fraction_obstructed || 0) < 0.005;
	var notDisabled   = d.disablement === 'OKAY' || d.disablement === '';

	var body = '<div class="sl-al-list">';
	body += alItem(ok(d.al_heating),     'Not heating',                              'Dish is heating');
	body += alItem(ok(d.al_throttle),    'Normal temperature',                       'Thermal throttle active');
	body += alItem(ok(d.al_shutdown),    'Not in thermal shutdown',                  'Thermal shutdown active');
	body += alItem(ok(d.al_psu_throttle),'External PSU temp OK',                     'PSU thermal throttle');
	body += alItem(ok(d.al_motors),      'Motors healthy',                           'Motors stuck');
	body += alItem(ok(d.al_mast),        'Mast is near vertical',                    'Mast not vertical');
	body += alItem(ok(d.al_slow_eth),    'Normal Ethernet speeds',                   'Slow Ethernet speeds');
	body += alItem(swOk,                 'Software is up to date',                   'Software update: ' + d.sw_update_state);
	body += alItem(ok(d.al_roaming),     'Moving at an acceptable speed',            'Moving too fast (roaming)');
	body += alItem(notObstructed,        'Not obstructed',                           'Dish obstructed');
	body += alItem(notDisabled,          'Not disabled',                             'Disabled: ' + d.disablement);
	body += alItem(ok(d.snr_persistently_low), 'SNR normal',                        'SNR persistently low');
	body += alItem(ok(d.al_unexpected_location), 'Location verified',               'Unexpected location');
	body += alItem(ok(d.al_install_pending), 'Install complete',                    'Install pending');
	var swRebootOk = d.sw_reboot_ready !== 'true';
	body += alItem(swRebootOk,           'Software up to date',                     'Reboot required for SW update');
	body += '</div>';

	var heatingOn = d.al_heating === 'true';
	body += row('Snow melt', badge(heatingOn ? 'ON' : 'OFF', heatingOn ? 'ok' : 'muted'));

	return card('Alerts', '🔔', body);
}

function buildIPv6Card(s) {
	var body = '';

	var hasWan    = !!(s.wan_ipv6    && s.wan_ipv6.trim());
	var hasLan    = !!(s.lan_ipv6    && s.lan_ipv6.trim());
	var hasRoute  = !!(s.ipv6_default_route && s.ipv6_default_route.trim());
	var hasPrefix = !!(s.delegated_prefix  && s.delegated_prefix.trim());
	var hasPrefLft = !!(s.max_preferred_lifetime && s.max_preferred_lifetime !== 'not_set' && s.max_preferred_lifetime !== '');
	var hasValidLft = !!(s.max_valid_lifetime    && s.max_valid_lifetime    !== 'not_set' && s.max_valid_lifetime    !== '');

	body += row('WAN IPv6',
		dot(hasWan) + (hasWan
			? '<span style="font-size:0.82em;font-family:monospace">' + s.wan_ipv6 + '</span>'
			: badge('None', 'err')));

	body += row('LAN Prefix',
		dot(hasLan) + (hasLan
			? '<span style="font-size:0.82em;font-family:monospace">' + s.lan_ipv6 + '</span>'
			: badge('None', 'err')));

	if (hasPrefix) {
		body += row('Delegated /56',
			'<span style="font-size:0.82em;font-family:monospace">' + s.delegated_prefix + '</span>');
	}

	body += row('Default Route', hasRoute
		? badge('present', 'ok')
		: badge('missing', 'err'));

	body += row('Preferred LFT',
		hasPrefLft ? badge(s.max_preferred_lifetime + 's', 'ok') : badge('not set', 'err'));
	body += row('Valid LFT',
		hasValidLft ? badge(s.max_valid_lifetime + 's', 'ok') : badge('not set', 'err'));

	return card('IPv6 Connectivity', '🌐', body);
}

function buildTrafficCard(s, d) {
	var body = '';

	// Instantaneous throughput from dish gRPC (if available)
	if (d && d.available && (d.downlink_bps || d.uplink_bps)) {
		body += '<div class="sl-big-row">';
		body += '<div class="sl-big-item"><div class="sl-big-num">\u2193 ' + fmtBps(d.downlink_bps) + '</div><div class="sl-big-lbl">Downlink (dish)</div></div>';
		body += '<div class="sl-big-item"><div class="sl-big-num">\u2191 ' + fmtBps(d.uplink_bps)   + '</div><div class="sl-big-lbl">Uplink (dish)</div></div>';
		body += '</div>';
	}

	if (s.wan_stats) {
		body += row('WAN\u00a0RX', fmtBytes(s.wan_stats.rx_bytes));
		body += row('WAN\u00a0TX', fmtBytes(s.wan_stats.tx_bytes));
		body += row('WAN\u00a0RX\u00a0pkts', (parseInt(s.wan_stats.rx_packets) || 0).toLocaleString());
		body += row('WAN\u00a0TX\u00a0pkts', (parseInt(s.wan_stats.tx_packets) || 0).toLocaleString());
	}
	if (s.lan_stats) {
		body += row('LAN\u00a0RX', fmtBytes(s.lan_stats.rx_bytes));
		body += row('LAN\u00a0TX', fmtBytes(s.lan_stats.tx_bytes));
	}

	return card('Traffic', '📊', body);
}

function buildQualityCard(s, d) {
	var body = '';

	// Dish PoP latency
	if (d && d.available && d.latency_ms) {
		var l = parseFloat(d.latency_ms);
		body += row('Dish \u2192 PoP',
			badge(l.toFixed(1) + ' ms', l < 50 ? 'ok' : l < 100 ? 'warn' : 'err'));
	}

	// Router ping to well-known targets
	if (s.ping_8888) {
		var p8 = parseFloat(s.ping_8888);
		body += row('Ping 8.8.8.8',
			badge(p8.toFixed(1) + ' ms', p8 < 60 ? 'ok' : p8 < 150 ? 'warn' : 'err'));
	}
	if (s.ping_1001) {
		var p1 = parseFloat(s.ping_1001);
		body += row('Ping 1.0.0.1',
			badge(p1.toFixed(1) + ' ms', p1 < 60 ? 'ok' : p1 < 150 ? 'warn' : 'err'));
	}

	// Conntrack
	if (s.conntrack_count && s.conntrack_max) {
		var ct = parseInt(s.conntrack_count);
		var mx = parseInt(s.conntrack_max);
		var pct = mx > 0 ? Math.round(ct / mx * 100) : 0;
		body += row('Conntrack',
			ct.toLocaleString() + ' / ' + mx.toLocaleString() +
			' ' + badge(pct + '%', pct < 70 ? 'ok' : pct < 90 ? 'warn' : 'err'));
	}

	if (s.uptime) {
		body += row('Router Uptime', fmtUptime(s.uptime));
	}

	return card('Quality', '📶', body);
}

function buildReadyStatesCard(d) {
	if (!d || !d.available) {
		return card('Ready States', '🔌', '<div class="sl-na">No dish data</div>');
	}

	var t = function(v) { return v === 'true'; };
	var body = '<div class="sl-al-list">';
	body += alItem(t(d.rs_rf),   'RF',   'RF');
	body += alItem(t(d.rs_l1l2), 'L1/L2','L1/L2');
	body += alItem(t(d.rs_xphy), 'xPHY', 'xPHY');
	body += alItem(t(d.rs_scp),  'SCP',  'SCP');
	body += alItem(t(d.rs_aap),  'AAP',  'AAP');
	body += '</div>';

	var signedCals = d.has_signed_cals === 'true';
	body += row('Signed Cals', badge(signedCals ? 'yes' : 'no', signedCals ? 'ok' : 'warn'));

	return card('Ready States', '🔌', body);
}

function buildBootStatsCard(d) {
	if (!d || !d.available) return null;

	var stable    = parseInt(d.init_stable_s)     || 0;
	var firstPing = parseInt(d.init_first_ping_s)  || 0;
	var gpsT      = parseInt(d.init_gps_s)         || 0;

	if (!stable && !firstPing && !gpsT) return null;

	var body = '';
	if (gpsT)      body += row('GPS valid',       gpsT + 's');
	if (firstPing) body += row('First PoP ping',  firstPing + 's');
	if (stable)    body += row('Stable connection', badge(stable + 's', stable < 60 ? 'ok' : stable < 120 ? 'warn' : 'err'));
	if (parseInt(d.obst_patches_valid) > 0)
		body += row('Obstruction patches', parseInt(d.obst_patches_valid).toLocaleString());

	return card('Boot Stats', '🚀', body);
}

function buildOutageCard(d) {
	if (!d || !d.available || !d.outages || !d.outages.length) {
		return card('Recent Outages', '⚡', '<div class="sl-na">No outage history</div>');
	}

	// Outages are chronological oldest-first; show the 6 most recent
	var outages = d.outages.slice(-6).reverse();
	var body = '';

	for (var i = 0; i < outages.length; i++) {
		var o = outages[i];
		var cause = (o.cause || 'UNKNOWN').replace(/_/g, '\u00a0');
		var dur   = parseFloat(o.duration) || 0;
		var durStr = dur < 1 ? '<1s' : dur < 60 ? dur.toFixed(1) + 's' : (dur / 60).toFixed(1) + 'm';
		var tsMs  = (parseFloat(o.startTimestampNs) || 0) / 1e6;
		var agoS  = tsMs > 0 ? Math.round((Date.now() - tsMs) / 1000) : 0;
		var agoStr = agoS <= 0 ? '' : agoS < 60 ? agoS + 's\u00a0ago' :
			agoS < 3600 ? Math.round(agoS / 60) + 'm\u00a0ago' :
			Math.round(agoS / 3600) + 'h\u00a0ago';

		var causeType = cause.indexOf('OBSTRUCTED') >= 0 ? 'warn' :
			cause.indexOf('NO\u00a0SCHEDULE') >= 0 ? 'info' : 'err';

		body += row(badge(cause, causeType), durStr + (agoStr ? '\u2002·\u2002' + agoStr : ''));
	}

	return card('Recent Outages', '⚡', body);
}

// ── Reboot handler (global so inline onclick can reach it) ───────────────────

window.starlinkRebootDish = function(btn) {
	if (!window.confirm('Reboot the Starlink dish?\n\nThe dish will be offline for ~60 seconds.'))
		return;
	btn.disabled = true;
	btn.textContent = '⟳ Rebooting…';
	callRebootDish().then(function(r) {
		if (r && r.success) {
			btn.textContent = '✓ Reboot sent — dish offline ~60s';
			btn.style.borderColor = 'var(--sl-green)';
			btn.style.color = 'var(--sl-green)';
		} else {
			btn.textContent = '✗ Reboot failed';
			btn.style.borderColor = 'var(--sl-red)';
			btn.style.color = 'var(--sl-red)';
			btn.disabled = false;
		}
	}).catch(function() {
		btn.textContent = '✗ RPC error';
		btn.disabled = false;
	});
};

// ── View ──────────────────────────────────────────────────────────────────────

return view.extend({
	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null,

	load: function() {
		return Promise.all([ callStatus(), callDish() ]);
	},

	render: function(data) {
		var self = this;
		var container = E('div');
		this._updateView(container, data[0] || {}, data[1] || {});

		poll.add(function() {
			return Promise.all([ callStatus(), callDish() ]).then(function(d) {
				var s = d[0] || {};
				if (s.hw_offloading === '1') {
					callDisableHwOffloading();
				}
				self._updateView(container, s, d[1] || {});
			});
		}, 10);

		return container;
	},

	_updateView: function(container, s, d) {
		var dishState = (d && d.available) ? (d.state || 'UNKNOWN') : null;
		var isConn    = dishState === 'CONNECTED';
		var now       = new Date().toLocaleTimeString();

		var html = CSS;
		html += '<div class="sl-wrap">';

		// Header
		html += '<div class="sl-header">';
		html += '<div class="sl-title">🛸 Starlink</div>';
		html += '<div class="sl-meta">';
		if (dishState) {
			html += badge(dishState, isConn ? 'ok' : 'warn') + ' ';
		}
		html += '<span style="color:var(--sl-muted)">Updated ' + now + '</span>';
		html += '</div></div>';

		// Cards grid
		html += '<div class="sl-grid">';
		html += buildDishCard(d);
		html += buildAlignmentCard(d);
		html += buildAlertsCard(d);
		html += buildIPv6Card(s);
		html += buildTrafficCard(s, d);
		html += buildQualityCard(s, d);
		html += buildReadyStatesCard(d);
		var bootCard = buildBootStatsCard(d);
		if (bootCard) html += bootCard;
		html += buildOutageCard(d);
		html += '</div>';

		html += '</div>';
		container.innerHTML = html;
	}
});
