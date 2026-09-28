'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require librespeed.common as lscommon';

/* global lscommon */

const callConfig = rpc.declare({
	object: 'librespeed',
	method: 'config',
	expect: { '': {} }
});

/* The intervals the init script can put in cron; it leaves out any other. */
const INTERVAL_RE = /^(?:(?:[1-9]|[1-5][0-9])m|(?:[1-9]|1[0-9]|2[0-3])h|1d|7d)$/;

return view.extend({
	load() {
		return Promise.all([
			callConfig().catch(() => ({})),
			lscommon.callLinks().catch(() => ({})),
			uci.load('librespeed')
		]);
	},

	render(data) {
		const config = data[0],
		      links = data[1].links || [],
		      ifmap = data[1].interfaces || {},
		      linkOf = n => ifmap[n] || n;
		let m, s, o;

		/* Links, plus stored names that are not links: a save drops what is not offered. */
		const offer = (opt, stored) => {
			const label = n => {
				if (links.indexOf(ifmap[n]) >= 0)
					return _('%s (recorded as %s)').format(n, ifmap[n]);
				if (ifmap[n])
					return _('%s (no gateway)').format(n);
				return Object.keys(ifmap).length ? _('%s (not found)').format(n) : n;
			};

			links.forEach(n => opt.value(n));
			stored.filter((n, i, a) => n && links.indexOf(n) < 0 && a.indexOf(n) == i)
				.forEach(n => opt.value(n, label(n)));
		};

		m = new form.Map('librespeed', _('LibreSpeed – Settings'));

		s = m.section(form.NamedSection, 'main', 'librespeed', _('Measurement'));

		o = s.option(form.ListValue, 'interface', _('Interface'),
			_('Logical interface measured by default: by the Test page unless another one is chosen there, and by an automatic test that names no interface.'));
		o.default = 'wan';
		offer(o, [ uci.get('librespeed', 'main', 'interface') || 'wan' ]);
		const mainIface = o;

		o = s.option(form.Value, 'server', _('Server'),
			_("Numeric server id from the LibreSpeed server list, or 'auto' to pick the closest."));
		o.default = 'auto';
		o.validate = function(section_id, value) {
			if (value == '' || value == 'auto' || /^[0-9]+$/.test(value))
				return true;
			return _("Must be a server id or 'auto'");
		};

		o = s.option(form.Value, 'server_list', _('Server list URL'),
			_('URL of a LibreSpeed server list in JSON, from a self-hosted deployment: either a static file such as https://example.org/servers.json or a generator such as https://example.org/backend/servers.php. Leave empty for the official list.'));
		o.optional = true;
		o.placeholder = 'https://librespeed.org/backend-servers/servers.php';
		o.validate = function(section_id, value) {
			if (value == '' || /^https?:\/\/.+/.test(value))
				return true;
			return _('Must be an http(s) URL');
		};

		o = s.option(form.ListValue, 'scheme', _('Protocol'),
			_('On routers without AES acceleration, TLS itself can bound the result — forcing plain HTTP then measures the line rather than the cipher.'));
		o.value('auto', _('server default'));
		o.value('https', _('force HTTPS'));
		o.value('http', _('force HTTP'));
		o.default = 'auto';

		/* The help sits above the table, as a phone hides the column headings. */
		s = m.section(form.TableSection, 'schedule', _('Scheduled measurements'), [
			[ _('Enable'), _('Runs a measurement from cron at the chosen interval. Note that a measurement saturates the connection while it runs.') ],
			[ _('Days'), _('Leave empty to run every day. A weekly test runs on one of the chosen days, or on any day when none is chosen; the day is drawn once and kept while it stays among the chosen days.') ],
			[ _('Hours'), _('An hour window on the 24-hour clock, such as 2-5 for 02:00–05:59. A daily or weekly measurement runs at a random time inside it, drawn when the schedule is applied; shorter intervals only run within it. Leave empty for any time. A window across midnight is not supported.') ]
		].map(h => E('p', {}, [ '%s: %s'.format(h[0], h[1]) ])));
		s.anonymous = true;
		s.addremove = true;
		/* A new row gets the night window of the shipped first row. */
		s.handleAdd = function(ev, name) {
			const sid = this.map.data.add('librespeed', 'schedule', name);

			this.map.data.set('librespeed', sid, 'hours', '2-5');

			return this.map.save(null, true);
		};
		/* The legacy named section first, as the init script reads it first. */
		s.cfgsections = function() {
			const legacy = (uci.get('librespeed', 'schedule') || {})['.type'] == 'librespeed';

			return (legacy ? [ 'schedule' ] : []).concat(
				uci.sections('librespeed', 'schedule').map(x => x['.name']));
		};
		const rows = s.cfgsections();

		o = s.option(form.ListValue, 'interface', _('Interface'));
		o.optional = true;
		o.placeholder = _('Default interface');
		offer(o, rows.map(sid => uci.get('librespeed', sid, 'interface')));
		/* Only enabled tests reach the crontab, one per link. The legacy row
		 * without an interface measures the default interface chosen above. */
		const measured = (sid, v) => linkOf(v || (sid == 'schedule' ? mainIface.formvalue('main') : ''));
		o.validate = function(section_id, value) {
			if (!value && section_id != 'schedule')
				return _('Choose the interface this test measures.');

			if (enabled.formvalue(section_id) != '1')
				return true;

			const name = measured(section_id, value);
			const taken = this.section.cfgsections().some(sid => sid != section_id &&
				enabled.formvalue(sid) == '1' && measured(sid, this.formvalue(sid) ?? this.cfgvalue(sid)) == name);

			return !taken || _('Another enabled automatic test already measures %s.').format(name);
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		const enabled = o;

		o = s.option(form.ListValue, 'interval', _('Interval'));
		/* From the shared table, so the Test page's status label and these
		 * choices cannot drift apart. */
		Object.keys(lscommon.INTERVALS).forEach(k =>
			o.value(k, lscommon.INTERVALS[k]));
		/* A hand-set interval is offered as it is, or a save would replace it. */
		rows.map(sid => uci.get('librespeed', sid, 'interval'))
			.filter((v, i, a) => v && !lscommon.INTERVALS[v] && a.indexOf(v) == i)
			.forEach(v => o.value(v));
		o.default = '1d';
		o.depends('enabled', '1');
		o.retain = true;
		/* Without a width the table squeezes the column and cuts the labels. */
		o.width = '13em';
		o.validate = function(section_id, value) {
			return INTERVAL_RE.test(value) ||
				_('The interval %s is not supported. Use 1-59m, 1-23h, 1d or 7d.').format(value);
		};

		o = s.option(form.MultiValue, 'days', _('Days'));
		lscommon.DAYS.forEach(d => o.value(d[0], d[1]));
		o.optional = true;
		o.depends('enabled', '1');
		o.retain = true;
		/* The init script hands this straight to cron, which wants commas. */
		o.cfgvalue = function(section_id) {
			const v = form.MultiValue.prototype.cfgvalue.apply(this, arguments);
			const on = {};

			if (v == null || v == '*')
				return [];

			/* A hand-set range (1-5) as its days, so an untouched save keeps it. */
			String(v).split(',').forEach(p => {
				const r = p.match(/^([0-6])(?:-([0-6]))?$/);

				if (r)
					for (let d = +r[1]; d <= +(r[2] ?? r[1]); d++)
						on[d] = true;
			});

			return lscommon.DAYS.map(d => d[0]).filter(d => on[d]);
		};
		o.write = function(section_id, value) {
			const list = Array.isArray(value) ? value.filter(v => v !== '') : [];
			if (!list.length)
				return this.remove(section_id);
			return this.super('write', [ section_id, list.join(',') ]);
		};

		o = s.option(form.Value, 'hours', _('Hours'));
		o.placeholder = '2-5';
		o.optional = true;
		o.depends('enabled', '1');
		o.retain = true;
		o.validate = function(section_id, value) {
			if (value == '')
				return true;
			const m = value.match(/^([01]?[0-9]|2[0-3])(-([01]?[0-9]|2[0-3]))?$/);
			if (!m)
				return _('Use an hour (0-23) or a range like 2-5');
			if (m[3] != null && +m[3] < +m[1])
				return _('The window must not cross midnight');
			return true;
		};

		s = m.section(form.NamedSection, 'history', 'librespeed', _('History'));

		o = s.option(form.Flag, 'enabled', _('Keep history'));
		o.default = '1';

		o = s.option(form.Value, 'path', _('Path'),
			_('History stored in /tmp is lost when the router reboots.'));
		o.default = '/tmp/librespeed/history.jsonl';
		o.depends('enabled', '1');

		o = s.option(form.ListValue, 'retention', _('Retention'));
		o.value('7d', _('7 days'));
		o.value('30d', _('30 days'));
		o.value('90d', _('90 days'));
		o.value('365d', _('1 year'));
		o.default = '30d';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'archive_path', _('Archive path'),
			_('Completed days are reduced to daily minimum, average and maximum and appended here once a day, so measurements since the last flush may be lost after an unexpected power loss. Leave empty to keep no persistent history.'));
		o.placeholder = '/etc/librespeed/history-daily.jsonl';
		o.optional = true;
		o.depends('enabled', '1');

		o = s.option(form.ListValue, 'archive_retention', _('Archive retention'));
		o.value('90d', _('90 days'));
		o.value('365d', _('1 year'));
		o.value('730d', _('2 years'));
		o.default = '365d';
		o.depends('enabled', '1');

		return m.render().then(node => {
			const scheds = config.schedules || [];
			const box = E('div', { 'style': 'margin-top:1em' });

			if (scheds.length) {
				/* Epochs computed by the backend in the router's timezone. */
				box.appendChild(E('h4', {}, [ _('Upcoming measurements') ]));
				box.appendChild(E('table', { 'class': 'table', 'style': 'max-width:32em' },
					scheds.flatMap(sc => (sc.next_runs || []).map(e => {
						const d = new Date(e * 1000);

						return E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td' }, [ linkOf(sc.interface) ]),
							E('td', { 'class': 'td' }, [ d.toLocaleDateString(undefined,
								{ weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' }) ]),
							E('td', { 'class': 'td' }, [ d.toLocaleTimeString() ])
						]);
					}))));
				box.appendChild(E('p', { 'style': 'color:#888' }, [
					_('The time of a daily measurement is drawn anew whenever the schedule is applied. A weekly measurement keeps its drawn day and time while they fit the chosen days and hours.')
				]));
			}
			else {
				box.appendChild(E('p', { 'style': 'color:#888' }, [
					_('No schedule is active. Enable it above and apply to draw the measurement time.')
				]));
			}

			/* A sibling of the form, not a child: Map.render() replaces its
			 * own root on every Save and Reset, and would take the schedule
			 * preview with it. The preview reads the applied crontab, so it
			 * is correct to keep it as it is until Apply. */
			return E([], [ node, box ]);
		});
	}
});
