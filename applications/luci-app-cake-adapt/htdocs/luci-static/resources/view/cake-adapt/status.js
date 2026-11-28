'use strict';
'require view';
'require dom';
'require fs';
'require poll';
'require request';
'require rpc';
'require uci';
'require ui';

const pollInterval = 2;
const chartHeight = 300;
/* Five minutes of samples at the poll interval. */
const historyPoints = 150;
const unavailable = '–';
const isReadonlyView = !L.hasViewPermission() || null;

const callStatus = (section) => rpc.declare({
	object: `cake-adapt.${section}`,
	method: 'status',
	expect: { '': {} }
})();

/* procd's own record of the service: each instance with running and pid. */
const callProcessList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

/* What the init script's config_get_bool takes as true. */
const enabledValues = [ '1', 'yes', 'on', 'true', 'enabled' ];

/* Runs one instance's action: the init script takes a section after start, stop and restart. */
const initScript = '/etc/init.d/cake-adapt';

/*
 * The theme's own state colours, as LuCI's status pages use them (mwan3's
 * interface states): success is green, warning amber, danger red, notice grey.
 */
const stateClasses = {
	running: 'alert-message success',
	unanswered: 'alert-message warning',
	stopped: 'alert-message danger',
	disabled: 'alert-message notice',
	unknown: 'alert-message notice'
};

/* The daemon's activity, as a theme label next to the state. */
const activityClasses = {
	running: 'label success',
	idle: 'label',
	stall: 'label warning'
};

return view.extend({
	load() {
		return Promise.all([
			uci.load('cake-adapt'),
			/* Without the charts the table and the buttons still work. */
			L.resolveDefault(this.loadSVG(L.resource('svg/bandwidth.svg')), null),
			L.resolveDefault(callProcessList('cake-adapt'), null)
		]);
	},

	/* The frame and SVG of LuCI's Realtime Graphs (luci-mod-status). */
	loadSVG(src) {
		return request.get(src).then((response) => {
			if (!response.ok)
				throw new Error(response.statusText);

			return E('div', {
				'style': 'width:100%;height:300px;border:1px solid #000;background:#fff'
			}, E(response.text()));
		});
	},

	rate(bps) {
		return '%1000.2mbit/s'.format(bps || 0);
	},

	delay(us) {
		return '%.1f ms'.format((us || 0) / 1000);
	},

	/* One table cell: a dash unless the direction is available and has the value. */
	cell(direction, key, format) {
		if (!direction || !direction.available || !Number.isFinite(direction[key]))
			return unavailable;
		return format(direction[key]);
	},

	/* A series value to draw: unavailable directions and negative delays are zero. */
	sample(direction, key) {
		const value = direction && direction.available ? direction[key] : 0;
		return Number.isFinite(value) ? Math.max(0, value) : 0;
	},

	/* Append a sample, keeping the newest `wanted` ones. */
	push(series, value, wanted) {
		series.push(value);
		while (series.length > wanted)
			series.shift();
	},

	/* Round the peak up to a step of the 1024-based scale, as Realtime Graphs does. */
	scale(peak) {
		peak = Math.max(1, peak);
		const size = Math.floor(Math.log2(peak));
		const div = Math.pow(2, size - (size % 10));
		const p_o_d = peak / div;
		const mult = (p_o_d < 5) ? 2 : ((p_o_d < 50) ? 10 : ((p_o_d < 500) ? 100 : 1000));

		return peak + (mult * div) - (peak % (mult * div));
	},

	/*
	 * A line, newest sample at the right edge and older ones to its left, so a
	 * short history starts part-way across.
	 */
	points(values, scale, width, height, step) {
		const last = values.length - 1;

		return values.map((value, j) =>
			`${width - (last - j) * step},${height - Math.floor(value * height / scale)}`).join(' ');
	},

	/* Lines only: the template's areas lose their fill, the second series is dashed. */
	updateChart(chart, history, format) {
		const G = chart.firstElementChild;
		const width = document.querySelector('#view').offsetWidth - 2;
		const height = chartHeight - 2;
		const scale = this.scale(Math.max(...history.flat()));

		[ 'rx', 'tx' ].forEach((id, i) => {
			const line = G.getElementById(id);

			line.style.fill = 'none';
			line.style.strokeWidth = '2';
			line.style.strokeDasharray = i ? '6,4' : 'none';
			line.setAttribute('points',
				this.points(history[i], scale, width, height, width / (historyPoints - 1)));
		});
		[ 25, 50, 75 ].forEach((p) =>
			G.getElementById(`label_${p}`).firstChild.data = format(scale * p / 100));
	},

	stateText(status) {
		/* A zero means the daemon could not read the wall clock. */
		const started = Number.isFinite(status.started) && status.started > 0 ? new Date(status.started * 1000).toLocaleString() : unavailable;

		return _('Started %s, version %s').format(started, status.version || unavailable);
	},

	/* procd's instances by name; null when procd did not answer. */
	instances(reply) {
		return reply ? ((reply['cake-adapt'] || {}).instances || {}) : null;
	},

	/* Instances start only when the section is enabled, as the daemon reads the flag. */
	isEnabled(value) {
		return enabledValues.includes(String(value).toLowerCase());
	},

	/*
	 * What the process is doing, from procd and not from the daemon's answer:
	 * running, unanswered (running but its live status did not answer),
	 * stopped, disabled (not running and disabled in the configuration) or
	 * unknown (procd did not answer).
	 */
	instanceState(instances, name, enabled, status) {
		if (instances == null)
			return 'unknown';

		const instance = instances[name];

		if (instance && instance.running)
			return status ? 'running' : 'unanswered';
		return enabled ? 'stopped' : 'disabled';
	},

	stateTitle(state) {
		return {
			running: _('Running'),
			unanswered: _('Running, live status unavailable'),
			stopped: _('Stopped'),
			disabled: _('Disabled'),
			unknown: _('State unavailable')
		}[state];
	},

	stateClass(state) {
		return stateClasses[state];
	},

	/* The daemon's activity label; an unknown activity gets the plain label. */
	activityClass(activity) {
		return activityClasses[activity] || 'label';
	},

	/* The line under the state: the pid and the daemon's details, or why it does not run. */
	instanceText(instances, name, state, status) {
		switch (state) {
		case 'running':
			return `${_('pid %s').format(instances[name].pid)}. ${this.stateText(status)}`;
		case 'unanswered':
			return _('pid %s; the daemon did not answer the status request.').format(instances[name].pid);
		case 'stopped':
			return _('Not running.');
		case 'disabled':
			return _('Not running: the instance is disabled in the configuration.');
		default:
			return _('procd did not report the process state.');
		}
	},

	/*
	 * Which actions are offered: Start only when the instance does not run and
	 * is enabled, Stop only when it runs, Restart when it runs or could start.
	 * Unknown offers what the configuration allows; read-only offers nothing.
	 */
	actionsOffered(state, enabled, readonly) {
		if (readonly)
			return { start: false, stop: false, restart: false };

		const running = state == 'running' || state == 'unanswered';
		const unknown = state == 'unknown';

		return {
			start: (unknown || !running) && enabled,
			stop: unknown || running,
			restart: unknown ? enabled : (running || enabled)
		};
	},

	/* One instance's start, stop or restart through the init script; true when it exited 0. */
	handleAction(name, action) {
		return fs.exec(initScript, [ action, name ]).then((res) => {
			if (res.code !== 0)
				throw (res.stderr || res.stdout || _('exit status %d').format(res.code)).trim();
			return true;
		}).catch((e) => {
			ui.addNotification(null, E('p', _('Failed to execute "%s %s %s": %s').format(initScript, action, name, e)));
			return false;
		});
	},

	/*
	 * What a start or restart that exited 0 did not do, from procd's record of
	 * the instance before and after it: not running means it did not start;
	 * a restart that left the same pid kept the previous configuration, as the
	 * init script does when the new one is refused. Null when nothing is wrong.
	 */
	actionProblem(name, action, before, after) {
		if (action == 'stop')
			return null;
		if (!after || !after.running)
			return _('Instance %s did not start. See the system log (logread -e cake-adapt).').format(name);
		if (action == 'restart' && before && before.running && before.pid == after.pid)
			return _('The configuration of instance %s was refused; it keeps running its previous configuration. See the system log (logread -e cake-adapt).').format(name);
		return null;
	},

	renderRow(title, d) {
		const cells = [
			this.cell(d, 'shaper_bps', (v) => this.rate(v)),
			this.cell(d, 'achieved_bps', (v) => this.rate(v)),
			this.cell(d, 'load_e6', (v) => '%d %%'.format(Math.round(v / 10000))),
			this.cell(d, 'delay_us', (v) => this.delay(v)),
			this.cell(d, 'bufferbloat', (v) => v ? _('Yes') : _('No')),
			this.cell(d, 'tcp_queue_us', (v) => this.delay(v))
		];

		return E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td' }, title) ].concat(
			cells.map((c) => E('td', { 'class': 'td' }, c))));
	},

	render([ , svg ]) {
		const sections = uci.sections('cake-adapt', 'cake_adapt').map((s) => s['.name']);
		const enabled = {};
		const body = E('div', { 'class': 'cbi-map' });
		const labels = { start: _('Start'), restart: _('Restart'), stop: _('Stop') };
		/*
		 * Start is the positive action and Stop the destructive one, filled red
		 * as LuCI's own (Apply unchecked in ui.js, an interface's Stop in
		 * luci-mod-network interfaces.js).
		 */
		const buttonClasses = {
			start: 'btn cbi-button-positive',
			restart: 'btn cbi-button-action',
			stop: 'btn cbi-button-negative important'
		};

		if (!sections.length)
			body.appendChild(E('div', { 'class': 'alert-message' }, [
				_('No instance is configured. '),
				E('a', { 'href': L.url('admin/services/cake-adapt/config') }, _('Configure cake-adapt'))
			]));

		const views = {};
		let update;

		for (const name of sections) {
			enabled[name] = this.isEnabled(uci.get('cake-adapt', name, 'enabled'));

			const title = E('strong', {}, _('Waiting for status…'));
			const activity = E('span', { 'class': 'label hidden' });
			const details = E('p', {});
			const state = E('div', { 'class': 'alert-message notice' }, [
				E('h4', {}, [ title, activity ]), details
			]);
			const buttons = {};
			/*
			 * The buttons stay disabled while the action runs, whatever a poll
			 * shows meanwhile; the state after it sets them again.
			 */
			const act = (action) => {
				const view = views[name];
				const before = view.instance;

				view.busy = true;
				for (const button of Object.values(buttons))
					button.disabled = true;
				buttons[action].classList.add('spinning');
				return this.handleAction(name, action).then((done) => {
					buttons[action].classList.remove('spinning');
					view.busy = false;
					return update().then((instances) => {
						const problem = done && instances != null ? this.actionProblem(name, action, before, instances[name]) : null;

						if (problem)
							ui.addNotification(null, E('p', problem));
					});
				});
			};

			for (const action of [ 'start', 'restart', 'stop' ])
				buttons[action] = E('button', {
					'class': buttonClasses[action],
					'click': () => act(action),
					'disabled': true
				}, labels[action]);

			const table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Direction')),
					E('th', { 'class': 'th' }, _('Shaper rate')),
					E('th', { 'class': 'th' }, _('Achieved')),
					E('th', { 'class': 'th' }, _('Load')),
					E('th', { 'class': 'th' }, _('Added delay')),
					E('th', { 'class': 'th' }, _('Bufferbloat')),
					E('th', { 'class': 'th' }, _('TCP queue'))
				])
			]);
			const charts = svg ? {
				download: svg.cloneNode(true),
				upload: svg.cloneNode(true),
				delay: svg.cloneNode(true)
			} : null;
			const history = { download: [ [], [] ], upload: [ [], [] ], delay: [ [], [] ] };

			body.appendChild(E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, name), state,
				E('div', { 'class': 'cbi-page-actions' }, Object.values(buttons)),
				table
			].concat(charts ? [
				E('h4', {}, _('Download: shaper (blue, solid), achieved (green, dashed)')), charts.download,
				E('h4', {}, _('Upload: shaper (blue, solid), achieved (green, dashed)')), charts.upload,
				E('h4', {}, _('Added delay: download (blue, solid), upload (green, dashed)')), charts.delay
			] : [])));

			views[name] = { state, title, activity, details, buttons, table, charts, history, busy: false, instance: null };
		}

		/* One poll: procd's record of every instance, then the status of the running ones. */
		const showStatus = (name, instances, status) => {
			const view = views[name];
			const { state, title, activity, details, buttons, table, charts, history } = view;
			const current = this.instanceState(instances, name, enabled[name], status);
			const offered = this.actionsOffered(current, enabled[name], isReadonlyView);

			state.className = this.stateClass(current);
			dom.content(title, this.stateTitle(current));
			if (status && status.state) {
				activity.className = this.activityClass(status.state);
				dom.content(activity, _('Activity: %s').format(status.state));
			}
			else {
				activity.className = 'label hidden';
			}
			dom.content(details, this.instanceText(instances, name, current, status));
			view.instance = instances ? instances[name] : null;
			if (!view.busy)
				for (const action of Object.keys(buttons))
					buttons[action].disabled = !offered[action];
			buttons.start.title = enabled[name] ? '' : _('The instance is disabled in the configuration.');

			while (table.rows.length > 1)
				table.deleteRow(1);
			table.appendChild(this.renderRow(_('Download'), status ? status.download : null));
			table.appendChild(this.renderRow(_('Upload'), status ? status.upload : null));

			if (!charts || !status)
				return;

			const d = status.download, u = status.upload;
			const samples = {
				download: [ this.sample(d, 'shaper_bps'), this.sample(d, 'achieved_bps') ],
				upload: [ this.sample(u, 'shaper_bps'), this.sample(u, 'achieved_bps') ],
				delay: [ this.sample(d, 'delay_us'), this.sample(u, 'delay_us') ]
			};

			for (const key of Object.keys(samples))
				samples[key].forEach((v, i) => this.push(history[key][i], v, historyPoints));
			this.updateChart(charts.download, history.download, (v) => this.rate(v));
			this.updateChart(charts.upload, history.upload, (v) => this.rate(v));
			this.updateChart(charts.delay, history.delay, (v) => this.delay(v));
		};

		update = () => L.resolveDefault(callProcessList('cake-adapt'), null).then((reply) => {
			const instances = this.instances(reply);

			return Promise.all(sections.map((name) => {
				const live = instances != null && instances[name] && instances[name].running;

				return (live ? L.resolveDefault(callStatus(name), null) : Promise.resolve(null)).then((status) =>
					showStatus(name, instances, status && status.download && status.upload ? status : null));
			})).then(() => instances);
		});
		poll.add(update, pollInterval);

		return E([], [ E('h2', _('CAKE Adapt')), body ]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
