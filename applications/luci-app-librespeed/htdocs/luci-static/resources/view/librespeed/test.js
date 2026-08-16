'use strict';
'require view';
'require ui';
'require poll';
'require rpc';
'require librespeed.common as lscommon';

/* The alias comes from the require above; the repo eslint config only
 * knows the stock module names. */
/* global lscommon */

const callStart = rpc.declare({
	object: 'librespeed',
	method: 'start',
	expect: { '': {} }
});

const callStop = rpc.declare({
	object: 'librespeed',
	method: 'stop',
	expect: { '': {} }
});

const callStatus = rpc.declare({
	object: 'librespeed',
	method: 'status',
	expect: { '': {} }
});

const callResult = rpc.declare({
	object: 'librespeed',
	method: 'result',
	expect: { '': {} }
});

const callConfig = rpc.declare({
	object: 'librespeed',
	method: 'config',
	expect: { '': {} }
});

const callHistory = rpc.declare({
	object: 'librespeed',
	method: 'history',
	params: [ 'from', 'to', 'limit' ],
	expect: { '': {} }
});

/* The Test page is an overview, not analysis: a fixed last-24h download
 * chart. No entry limit -- a 15-minute schedule makes 96 points a day, which
 * is nothing for the SVG, and a capped fetch would quietly turn "last 24
 * hours" into "last few hours". The History page fetches whatever range the
 * user asks for; this page never should. */
const recentSeconds = 86400;
const recentRows = 5;

/* A measurement takes tens of seconds, so nothing waits on it: start returns as
 * soon as the job is detached and this is how often we ask how it is going. */
const pollInterval = 2;

function fmt(value, digits) {
	return (typeof value == 'number' && isFinite(value))
		? value.toFixed(digits != null ? digits : 2)
		: '–';
}

function fmtTime(epochOrIso) {
	if (!epochOrIso)
		return '';

	const d = (typeof epochOrIso == 'number')
		? new Date(epochOrIso * 1000)
		: new Date(epochOrIso);

	return isNaN(d.getTime()) ? String(epochOrIso) : d.toLocaleString();
}

function fmtElapsed(seconds) {
	if (!(seconds >= 0))
		return '';

	const m = Math.floor(seconds / 60),
	      s = Math.floor(seconds % 60);

	return '%d:%02d'.format(m, s);
}

/* The three stages a measurement walks through, with the share of the overall
 * bar each one gets. Ping streams no percent, so it holds a token slice. */
const PHASES = [
	[ 'ping',     0,  10,  _('Ping') ],
	[ 'download', 10, 55,  _('Download') ],
	[ 'upload',   55, 100, _('Upload') ]
];

/* Maps the streamed per-phase percent onto one overall run percent, so the
 * bar moves forward through the whole run instead of refilling per phase.
 * Null means there is nothing honest to show and the bar stays indeterminate. */
function overallProgress(status) {
	const span = PHASES.find(p => p[0] == status.phase);

	if (!span)
		return null;
	if (typeof status.progress != 'number')
		return (status.phase == 'ping') ? 5 : null;

	return Math.round(span[1] + (span[2] - span[1]) * Math.min(status.progress, 100) / 100);
}

function polar(cx, cy, r, deg) {
	const a = deg * Math.PI / 180;
	return [ cx + r * Math.cos(a), cy - r * Math.sin(a) ];
}

/* The dial's top end: the smallest "nice" ceiling above the fastest rate seen,
 * so a 550 Mbps line gets a 600 dial rather than pinning the needle at an
 * arbitrary full stop. Grows during the run when the rate outruns it. */
function niceTop(mbps) {
	/* Each of these divides cleanly by 5 and 10, so the dial's labels and
	 * ticks always land on round numbers: a ~560 Mbps line gets a 0-1000
	 * dial labelled every 200 with ticks every 100. */
	const steps = [ 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000 ];

	for (let i = 0; i < steps.length; i++)
		if (mbps <= steps[i])
			return steps[i];

	return Math.ceil(mbps / 10000) * 10000;
}

function gaugeLabel(v) {
	return v >= 1000 ? (v / 1000) + ' G' : String(v);
}

/* The running test's centrepiece: a circular speedometer with a needle. The
 * dial is the current rate against the niceTop() range -- never the test's
 * completion, which is a different number and reads as a small percentage
 * below the circle. */
function gauge(mbps, top, ci) {
	ci = ci || 0;
	const cx = 100, cy = 95, r = 80, span = 216, start = 198;
	const p1 = polar(cx, cy, r, start),
	      p2 = polar(cx, cy, r, start - span);
	const len = span / 360 * 2 * Math.PI * r;
	const path = 'M %f %f A %f %f 0 1 1 %f %f'.format(p1[0], p1[1], r, r, p2[0], p2[1]);
	const amt = (typeof mbps == 'number')
		? Math.max(0, Math.min(1, mbps / top)) : 0;

	/* Ticks every tenth of the range, longer ones with a label every fifth:
	 * a 0-1000 dial reads 0/200/400/600/800/1000 with marks each 100. */
	let marks = '';

	for (let i = 0; i <= 10; i++) {
		const a = start - i / 10 * span,
		      major = (i % 2 == 0),
		      t1 = polar(cx, cy, r - 10, a),
		      t2 = polar(cx, cy, r - (major ? 18 : 14), a);
		marks += '<line class="librespeed-gauge-tick" x1="%f" y1="%f" x2="%f" y2="%f"/>'
			.format(t1[0], t1[1], t2[0], t2[1]);

		if (major) {
			const p = polar(cx, cy, r - 28, a);
			marks += '<text x="%f" y="%f" text-anchor="middle" font-size="8.5" fill-opacity=".55">%s</text>'
				.format(p[0], p[1] + 3, gaugeLabel(top * i / 10));
		}
	}

	const tip = polar(cx, cy, r - 20, start - amt * span);

	return '<svg class="librespeed-gauge" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">' +
		'<path class="librespeed-gauge-bg" d="%s"/>'.format(path) +
		'<path class="librespeed-gauge-fill librespeed-stroke-%d" d="%s" stroke-dasharray="%f %f"/>'
			.format(ci, path, amt * len, len) +
		marks +
		'<line class="librespeed-gauge-needle" x1="%f" y1="%f" x2="%f" y2="%f"/>'
			.format(cx, cy, tip[0], tip[1]) +
		'<circle class="librespeed-gauge-hub" cx="%f" cy="%f" r="4"/>'.format(cx, cy) +
		'<text x="100" y="133" text-anchor="middle" font-size="26" font-weight="500">%s</text>'
			.format((typeof mbps == 'number') ? '%.2f'.format(mbps) : '–') +
		'<text x="100" y="147" text-anchor="middle" font-size="11" fill-opacity=".6">Mbps</text>' +
		'</svg>';
}

/* One value with its small label underneath; the figures are the point of the
 * page, so they get the size. */
function figure(value, unit, label, big) {
	return E('div', {}, [
		E('div', { 'class': big ? 'librespeed-value' : 'librespeed-value-sm' }, [
			value,
			E('span', { 'class': 'librespeed-muted', 'style': 'font-size:.45em' }, [ ' ' + unit ])
		]),
		E('div', { 'class': 'librespeed-muted librespeed-caps' }, [ label ])
	]);
}

return view.extend({
	alertNode: null,
	statusNode: null,
	resultHeading: null,
	resultNode: null,
	button: null,
	lastSeen: null,
	config: {},

	load() {
		return Promise.all([
			callStatus().catch(() => ({})),
			callResult().catch(() => ({})),
			callConfig().catch(() => ({})),
			callHistory(Math.floor(Date.now() / 1000 - recentSeconds),
				undefined, 0).catch(() => ({}))
		]);
	},

	renderRecent(data) {
		const entries = Array.isArray(data && data.entries) ? data.entries : [];

		/* Kept so switching the metric can redraw without refetching. */
		this.recentData = data;

		this.recentNode.innerHTML = '';
		this.recentCount.textContent = entries.length
			? N_(entries.length, '%d measurement', '%d measurements')
				.format(entries.length) : '';

		/* The active button names the metric, so the subtitle only carries
		 * the window. */
		this.recentSwitch.replaceChildren(...lscommon.switcher(this,
			lscommon.GROUPS.speed.map(k => {
				const m = lscommon.METRICS.find(x => x[0] == k);
				return [ k, m[1] ];
			}), this.recentMetric,
			function(v) {
				this.recentMetric = v;
				this.renderRecent(this.recentData);
			}, _('Metric')).childNodes);

		/* The stability story of the last day, told in one sentence and four
		 * figures: what is normal, how much it wobbles, where it is now. */
		const metric = this.recentMetric || 'download_mbps';
		const st = lscommon.seriesStats(entries, metric, data && data.resolution);

		if (st && st.count > 1) {
			const varPct = (st.max - st.min) / st.avg * 100,
			      offPct = (st.current - st.avg) / st.avg * 100;
			let story;

			/* The heading above names the metric, so the sentence does not
			 * repeat it -- and a word like "download" cannot be spliced into
			 * a translated sentence anyway. */
			if (offPct < -15)
				story = _('Declining — the last measurement is %d%% below the 24-hour average.')
					.format(Math.round(-offPct));
			else if (varPct > 30)
				story = _('Variable — ranged from %d to %d Mbps.')
					.format(Math.round(st.min), Math.round(st.max));
			else
				story = _('Stable — averaged %d Mbps, ranging from %d to %d Mbps.')
					.format(Math.round(st.avg), Math.round(st.min), Math.round(st.max));

			this.recentNode.appendChild(E('p', { 'class': 'librespeed-muted', 'style': 'margin:.25em 0 .5em' },
				[ story ]));
		}

		const chart = E('div', {});
		this.recentNode.appendChild(chart);

		const drew = lscommon.renderChart(chart, entries, {
			series: [ metric ],
			resolution: data && data.resolution,
			hover: true
		});

		/* Entries may well exist -- the count above says so -- while none of
		 * them carries a download figure, so name the window rather than
		 * claiming there is nothing at all. */
		if (!drew) {
			this.recentNode.appendChild(E('p', { 'class': 'librespeed-muted' },
				[ _('No data in the last 24 hours.') ]));
			return;
		}

		if (st && st.count > 1) {
			const stat = (label, v) => E('span', {}, [
				E('strong', {}, [ '%d'.format(Math.round(v)) ]),
				E('span', { 'class': 'librespeed-muted' }, [ ' ' + label ])
			]);

			this.recentNode.appendChild(E('div', {
				'class': 'librespeed-muted librespeed-stats',
				'style': 'margin:1em 0 1.5em'
			}, [
				stat(_('current'), st.current),
				stat(_('average'), st.avg),
				stat(_('best'), st.max),
				stat(_('worst'), st.min)
			]));
		}

		const fmtNum = (v, d) => (typeof v == 'number') ? v.toFixed(d) : '–';
		/* The shared formatter carries the date-only guard: a daily
		 * aggregate's bare date fed to new Date() is read as UTC midnight
		 * and shifts a calendar day in negative offsets. */
		const when = e => lscommon.chartStampFull(e, data && data.resolution);

		/* The sort key carries the same decimal count as the display half:
		 * ui.Table stringifies the whole cell and compares digit runs one by
		 * one, so ragged fractions would put 94.4 above 94.35. */
		const num = (v, d) => (typeof v == 'number') ? v.toFixed(d) : '';

		/* Nodes, not strings: ui.Table writes bare strings into innerHTML
		 * and the server name comes from a downloaded list. */
		const cell = t => E('span', {}, [ t ]);
		this.recentTable.update(entries.slice(-recentRows).reverse().map(e => [
			[ e.epoch ?? 0, cell(when(e)) ],
			cell((e.server && e.server.name) || '–'),
			[ num(e.download_mbps, 2), cell(fmtNum(e.download_mbps, 2)) ],
			[ num(e.upload_mbps, 2), cell(fmtNum(e.upload_mbps, 2)) ],
			[ num(e.ping_ms, 1), cell(fmtNum(e.ping_ms, 1)) ],
			[ num(e.jitter_ms, 1), cell(fmtNum(e.jitter_ms, 1)) ]
		]));
		this.recentNode.appendChild(this.recentTableNode);

		this.recentNode.appendChild(E('div', { 'style': 'text-align:right; margin-top:.75em' }, [
			E('a', { 'href': L.url('admin', 'network', 'librespeed', 'history') },
				[ _('View full history »') ])
		]));
	},

	handleStart(ev) {
		return callStart().then(L.bind(function(res) {
			if (res && res.error) {
				ui.addNotification(null, E('p', [
					_('Could not start the measurement: %s').format(res.error)
				]));
				return;
			}

			/* Show the running state immediately rather than waiting up to
			 * pollInterval for the next status. */
			this.renderStatus({ running: true, started: Date.now() / 1000 });
			this.setBusy(true);
		}, this));
	},

	handleStop(ev) {
		return callStop().then(L.bind(function() {
			this.setBusy(false);
		}, this));
	},

	setBusy(running) {
		if (!this.button)
			return;

		this.button.textContent = running ? _('Stop test') : _('Start test');
		this.button.className = running ? 'cbi-button cbi-button-reset'
		                                : 'cbi-button cbi-button-action';
		this.button.onclick = ui.createHandlerFn(this,
			running ? 'handleStop' : 'handleStart');
	},

	runContext() {
		const parts = [];

		if (this.config.server && this.config.server != 'auto')
			parts.push(_('server %s').format(this.config.server));
		if (this.config.interface)
			parts.push(this.config.interface);

		return parts.join(' · ');
	},

	renderStatus(status) {
		this.alertNode.innerHTML = '';
		this.statusNode.innerHTML = '';

		/* The result block steps aside while a measurement runs -- the page
		 * narrates one thing at a time. */
		this.resultNode.style.display = status.running ? 'none' : '';
		this.resultHeading.textContent = (!status.running && status.last_error)
			? _('Last successful measurement') : '';

		/* One quiet live region, outside the tree that is rebuilt every
		 * poll: announcing the rebuilt gauge SVG would read the whole dial
		 * out several times a run. Set only on change, so it speaks once
		 * per phase step. */
		const announce = status.running
			? (PHASES.find(p => p[0] == status.phase) || [])[3] || _('Connecting to the test server…')
			: '';

		if (this.liveNode.textContent != announce)
			this.liveNode.textContent = announce;

		if (status.running) {
			const rows = [];

			/* The walk through the stages, with the current one highlighted --
			 * this is what says why nothing moves yet while connecting. */
			const phaseIdx = PHASES.findIndex(p => p[0] == status.phase);

			rows.push(E('div', { 'class': 'librespeed-steps librespeed-caps' },
				PHASES.map((p, i) => E('span', {
					'class': 'librespeed-step' +
						(i == phaseIdx ? ' librespeed-step-active' :
							(phaseIdx >= 0 && i < phaseIdx ? ' librespeed-step-done' : '')),
					/* Spoken as well as dimmed: opacity is invisible to a
					 * screen reader. */
					'aria-current': i == phaseIdx ? 'step' : null
				}, [ p[3] ]))));

			/* The dial range is frozen at the start of the run -- a familiar
			 * line gets a familiar dial -- and only ever expands, once the
			 * rate actually exceeds it. Recomputing it downwards mid-run
			 * would pull the needle back while the speed grows. */
			if (!this.wasRunning)
				this.runTop = niceTop(Math.max(this.lastPeak || 0, 50) * 1.02);
			if (typeof status.mbps == 'number' && status.mbps > this.runTop)
				this.runTop = niceTop(status.mbps * 1.02);
			this.wasRunning = true;

			/* The spinner is LuCI's own; while the client still negotiates
			 * with the server there is nothing to point the gauge at. */
			if (phaseIdx < 0)
				rows.push(E('p', { 'class': 'spinning', 'style': 'margin-top:.75em' },
					[ _('Connecting to the test server…') ]));
			else {
				/* The dial is hidden from assistive tech -- its ten tick
				 * labels are noise there -- so the one figure it carries,
				 * the running rate, is repeated as plain hidden text that
				 * browse mode can still reach. */
				const holder = E('div', { 'aria-hidden': 'true' });
				holder.innerHTML = gauge(
					(typeof status.mbps == 'number' && status.mbps > 0)
						? status.mbps : null,
					this.runTop,
					status.phase == 'upload' ? 1 : 0);
				rows.push(holder);
				if (typeof status.mbps == 'number' && status.mbps > 0)
					rows.push(E('span', { 'class': 'librespeed-visually-hidden' },
						[ '%.2f Mbps'.format(status.mbps) ]));
			}

			/* Completion is a different number than the rate on the arc, so
			 * it stays a small figure below the circle rather than feeding
			 * the gauge and pretending to be a speed. */
			const overall = overallProgress(status);

			if (overall != null)
				rows.push(E('div', { 'class': 'librespeed-muted' },
					[ overall + ' %' ]));

			/* The backend counts on the clock that stamped the start; the
			 * difference of two unrelated clocks can be negative. The old
			 * subtraction stays as a fallback for an updating router. */
			const elapsed = typeof status.elapsed == 'number'
				? fmtElapsed(status.elapsed)
				: (status.started
					? fmtElapsed(Date.now() / 1000 - status.started) : '');

			if (elapsed)
				rows.push(E('div', { 'class': 'librespeed-muted' },
					[ _('%s elapsed').format(elapsed) ]));

			const ctx = this.runContext();

			if (ctx)
				rows.push(E('div', { 'class': 'librespeed-muted', 'style': 'margin-top:.5em' }, [ ctx ]));

			rows.forEach(r => this.statusNode.appendChild(r));
		}
		else
			this.wasRunning = false;

		if (!status.running && status.last_error == 'stopped') {
			/* Stopping is something the user did, not something that went
			 * wrong; a red banner would turn their own click into an error. */
			this.alertNode.appendChild(E('p', { 'class': 'librespeed-muted' }, [
				_('The last measurement was stopped.'),
				status.last_finished ? ' · ' + fmtTime(status.last_finished) : ''
			]));
		}
		else if (!status.running && status.last_error) {
			/* Compact, and above the figures: the failure is news, the last
			 * good result is still the substance of the page. */
			this.alertNode.appendChild(E('div', {
				'class': 'alert-message warning',
				'style': 'display:inline-block; text-align:left'
			}, [
				E('strong', {}, [ _('Last measurement failed') ]),
				E('br'),
				status.last_error,
				status.last_finished ? ' · ' + fmtTime(status.last_finished) : ''
			]));
		}
	},

	renderResult(result) {
		this.resultNode.innerHTML = '';

		/* Remembered as the dial-range seed for the next run. */
		if (result && (typeof result.download_mbps == 'number' || typeof result.upload_mbps == 'number'))
			this.lastPeak = Math.max(result.download_mbps || 0, result.upload_mbps || 0);

		if (!result || result.download_mbps == null) {
			this.resultNode.appendChild(E('p', { 'class': 'librespeed-muted', 'style': 'margin-top:.5em' }, [
				_('No measurement yet.')
			]));
			return;
		}

		/* The result in the same visual language the run used: one dial per
		 * direction, both on one shared scale so they compare at a glance,
		 * with the latency figures small beside them. */
		const top = niceTop(Math.max(result.download_mbps || 0,
			result.upload_mbps || 0, 50) * 1.02);
		/* Same color language as the History chart -- download is always the
		 * theme color, upload the companion shade -- plus the direction arrow,
		 * so the two dials cannot be mistaken for one another. */
		const dial = (v, label, ci, arrow) => {
			const holder = E('div', { 'class': 'librespeed-result-gauge' });
			holder.innerHTML = gauge((typeof v == 'number') ? v : null, top, ci);
			holder.appendChild(E('div', { 'class': 'librespeed-caps' }, [
				E('span', { 'class': 'librespeed-fg-%d'.format(ci), 'style': 'font-weight:700' },
					[ arrow + ' ' ]),
				E('span', { 'class': 'librespeed-muted' }, [ label ])
			]));
			return holder;
		};

		this.resultNode.appendChild(E('div', { 'class': 'librespeed-result-gauges' }, [
			dial(result.download_mbps, _('Download'), 0, '\u2193'),
			dial(result.upload_mbps, _('Upload'), 1, '\u2191')
		]));

		this.resultNode.appendChild(E('div', {
			'style': 'display:flex; justify-content:center; gap:3.5em; margin-top:.5em'
		}, [
			figure(fmt(result.ping_ms, 1), 'ms', _('Ping'), false),
			figure(fmt(result.jitter_ms, 1), 'ms', _('Jitter'), false)
		]));

		/* One fact per row rather than one long sentence: each has its own
		 * meaning and the eye can scan for the one it wants. */
		const meta = [];

		if (result.server && result.server.name)
			meta.push([ _('Server'), result.server.name ]);
		if (result.interface)
			meta.push([ _('Interface'), result.interface ]);

		const proto = [];

		if (result.family)
			proto.push(result.family == 'ipv6' ? 'IPv6' : 'IPv4');
		if (result.proto)
			proto.push(result.proto == 'https' ? _('encrypted (HTTPS)') : _('plain HTTP'));
		if (proto.length)
			meta.push([ _('Protocol'), proto.join(' \u00b7 ') ]);

		if (result.timestamp)
			meta.push([ _('Completed'), fmtTime(result.timestamp) ]);

		const grid = E('div', { 'class': 'librespeed-meta' });

		meta.forEach(m => {
			grid.appendChild(E('span', { 'class': 'librespeed-muted' }, [ m[0] ]));
			grid.appendChild(E('span', {}, [ m[1] ]));
		});

		this.resultNode.appendChild(grid);

		/* The link comes from the telemetry server's reply -- from outside
		 * the router -- so only plain web schemes may pass into the href. */
		if (result.share && /^https?:\/\//i.test(result.share))
			this.resultNode.appendChild(E('p', { 'style': 'margin:.5em 0 0' }, [
				E('a', {
					'href': result.share,
					'target': '_blank',
					'rel': 'noreferrer'
				}, [ _('View result') ])
			]));
	},

	render(data) {
		const status = data[0] || {},
		      result = data[1] || {},
		      config = data[2] || {},
		      recent = data[3] || {};

		this.config = config;
		this.alertNode = E('div', {});
		this.statusNode = E('div', {});
		this.resultHeading = E('div', { 'class': 'librespeed-muted', 'style': 'margin-top:.35em' });
		this.resultNode = E('div', {});
		this.recentNode = E('div', {});
		this.liveNode = E('div', {
			'role': 'status',
			'aria-live': 'polite',
			'class': 'librespeed-visually-hidden'
		});
		this.recentCount = E('span', { 'class': 'librespeed-muted' });
		this.recentSubtitle = E('div', { 'class': 'librespeed-muted' },
			[ _('last 24 hours') ]);
		/* Built once and refilled: ui.Table gives sortable headers, the same
		 * as the History page's table. */
		this.recentTable = new ui.Table([
			_('Time'), _('Server'),
			_('Download [Mbps]'), _('Upload [Mbps]'), _('Ping [ms]'), _('Jitter [ms]')
		], { id: 'librespeed-recent' });
		this.recentTableNode = this.recentTable.render();
		this.recentMetric = 'download_mbps';
		/* Two directions, one chart at a time: the page answers "how am I
		 * doing" at a glance, and mixing both series would make that a
		 * comparison instead. History is where series get combined. The
		 * buttons themselves are filled by renderRecent, first call included. */
		this.recentSwitch = E('div', {});
		this.button = E('button', { 'class': 'cbi-button cbi-button-action' },
			[ _('Start test') ]);

		this.lastSeen = status.last_finished;

		this.renderStatus(status);
		this.renderResult(result);
		this.renderRecent(recent);
		this.setBusy(!!status.running);

		poll.add(L.bind(function() {
			return callStatus().then(L.bind(function(st) {
				st = st || {};
				this.renderStatus(st);
				this.setBusy(!!st.running);

				/* Only refetch the result and the recent chart when a run has
				 * actually finished, rather than on every tick. */
				if (!st.running && st.last_finished !== this.lastSeen) {
					this.lastSeen = st.last_finished;
					return Promise.all([
						callResult().then(L.bind(this.renderResult, this)),
						callHistory(Math.floor(Date.now() / 1000 - recentSeconds),
							undefined, 0)
							.then(L.bind(this.renderRecent, this))
							.catch(() => {})
					]);
				}
			}, this));
		}, this), pollInterval);

		/* A third element, where a row has one, explains the value on hover
		 * or focus. data-tooltip is LuCI's own mechanism -- a plain title
		 * attribute leaves it to the browser, which shows nothing on some --
		 * and the dotted underline is the affordance, since the theme styles
		 * tooltips only inside form fields. The panel stays a compact status
		 * list, and the reasoning still lives where the choice is made. */
		const kv = rows => E('table', { 'class': 'table' },
			rows.map(r => E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td librespeed-muted', 'style': 'width:45%' }, [ r[0] ]),
				E('td', { 'class': 'td' }, [
					r[2] ? E('span', {
						/* tabindex, or the focus half of "hover or focus"
						 * never fires: a bare span is not in the tab order. */
						'class': 'librespeed-hint',
						'tabindex': '0',
						'data-tooltip': r[2]
					}, [ r[1] ]) : r[1]
				])
			])));

		/* Computed by the backend in the router's timezone; the browser may
		 * well sit in another one, so it only formats the epoch. */
		const sched = config.schedule || {};
		const next = sched.next_runs || [];
		/* Strict, matching history.js: the backend derives this from the
		 * crontab and emits a real boolean, never UCI's '0'/'1'. */
		const schedRows = [ [ _('Enabled'), sched.enabled === true ? _('Yes') : _('No') ] ];

		if (sched.enabled === true) {
			/* The shared table translates the six tokens the UI offers; the
			 * init script accepts more, so the raw token is the fallback. */
			schedRows.push([ _('Interval'),
				lscommon.INTERVALS[sched.interval || '1d'] || sched.interval ]);
			if (next.length)
				schedRows.push([ _('Next run'), new Date(next[0] * 1000).toLocaleString() ]);
		}

		/* The main card carries the result; the aside carries what the next
		 * run will do. Plain sections and tables, so every theme renders it. */
		const aside = E('div', {}, [
			E('div', { 'class': 'cbi-section', 'style': 'margin:0 0 1em 0' }, [
				E('h3', [ _('Test configuration') ]),
				kv([
					[ _('Interface'), config.interface || 'wan' ],
					[ _('Server'), (config.server == 'auto' || !config.server)
						? _('automatic (nearest)') : config.server ],
					[ _('Protocol'),
						config.scheme == 'https' ? _('HTTPS (forced)')
							: (config.scheme == 'http' ? _('HTTP (forced)')
								: _('server default')),
						config.scheme == 'http'
							? _('Unencrypted transfers, so the line is measured rather than the cipher.')
							: (config.scheme == 'https'
								? _('Encrypted transfers, which on hardware without AES acceleration may bound the result.')
								: _('Whichever scheme the server list provides.')) ]
				])
			]),
			E('div', { 'class': 'cbi-section', 'style': 'margin:0' }, [
				E('h3', [ _('Schedule status') ]),
				kv(schedRows)
			])
		]);

		const main = E('div', { 'class': 'cbi-section librespeed-center', 'style': 'margin:0' }, [
			this.alertNode,
			this.liveNode,
			this.statusNode,
			this.resultHeading,
			this.resultNode,
			E('div', { 'style': 'margin-top:1em' }, [ this.button ])
		]);

		const recentSection = E('div', { 'class': 'cbi-section', 'style': 'margin:1.5em 0 0 0' }, [
			/* Heading and count on one line, the controls on their own below:
			 * the metric buttons and the window they cover belong together,
			 * the way the History toolbar pairs series with range. */
			E('div', { 'class': 'librespeed-footer', 'style': 'margin:0; align-items:baseline' }, [
				E('h3', { 'style': 'margin:0' }, [ _('Recent history') ]),
				this.recentCount
			]),
			E('div', { 'class': 'librespeed-toolbar', 'style': 'margin:.5em 0 .75em' }, [
				this.recentSwitch,
				this.recentSubtitle
			]),
			this.recentNode
		]);

		return E([], [
			lscommon.cssLink(),
			E('h2', [ _('LibreSpeed') ]),
			E('h3', [ _('Router speed test') ]),
			E('p', { 'class': 'librespeed-muted' },
				[ _('Measures the internet connection from this router.') ]),
			E('div', { 'class': 'librespeed-columns' }, [
				E('div', {}, [ main, recentSection ]),
				aside
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
