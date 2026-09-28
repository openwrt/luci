'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require tools.widgets as widgets';
'require librespeed.common as lscommon';

/* The alias comes from the require above; the repo eslint config only
 * knows the stock module names. */
/* global lscommon */

const callConfig = rpc.declare({
	object: 'librespeed',
	method: 'config',
	expect: { '': {} }
});

/* Sections of UCI network only: a result is filed under the interface it
 * belongs to, never under a dynamic one such as lte_4 that netifd adds at
 * runtime and that no configuration names, nor under wan6 beside wan. */
function isNetwork(section_id, name) {
	return (uci.get('network', name) || {})['.type'] == 'interface' &&
		lscommon.linkName(name) == name;
}

/* An option naming wan6 beside wan shows wan, the name its results are
 * recorded under, and keeps wan6 until another interface is chosen: a
 * test of wan6 still goes out of its device while wan is down. So does
 * one naming a dynamic interface (lte_4), shown as its parent. `shown`
 * gives the value of a section without one. */
function showsLink(o, shown) {
	const base = widgets.NetworkSelect.prototype;
	const current = function(section_id) {
		const v = this.cfgvalue(section_id);

		return (v == null && shown) ? shown(section_id) : v;
	};
	const kept = function(section_id) {
		const v = this.cfgvalue(section_id);

		return v != null && lscommon.linkName(v) != v &&
			this.formvalue(section_id) == lscommon.linkName(v);
	};
	/* A value the list cannot show -- a dynamic interface while netifd
	 * lists it under no parent, or not at all -- is not lost to a save:
	 * the widget offers it as it is when it can, and when it cannot, its
	 * empty choice keeps it instead of deleting it. */
	const unlisted = function(section_id) {
		const v = this.cfgvalue(section_id);

		return v != null && v !== '' && !this.formvalue(section_id) &&
			!(this.networks || []).some(n => n.getName() == lscommon.linkName(v));
	};

	o.filter = function(section_id, name) {
		const v = current.call(this, section_id);

		return isNetwork(section_id, name) || (v != null && name == lscommon.linkName(v));
	};
	o.renderWidget = function(section_id, option_index, cfgvalue) {
		if (cfgvalue == null && shown)
			cfgvalue = shown(section_id);

		return base.renderWidget.call(this, section_id, option_index,
			(cfgvalue != null) ? lscommon.linkName(cfgvalue) : cfgvalue);
	};
	o.write = function(section_id, value) {
		return kept.call(this, section_id) ? null : base.write.call(this, section_id, value);
	};
	o.remove = function(section_id) {
		return (kept.call(this, section_id) || unlisted.call(this, section_id))
			? null : base.remove.call(this, section_id);
	};
}

/* The cron lines the init script can write: minutes 1-59, hours 1-23, a
 * day and a week. Anything else would leave the test out of the crontab
 * with only a syslog note, so the page refuses it instead. */
const INTERVAL_RE = /^(?:(?:[1-9]|[1-5][0-9])m|(?:[1-9]|1[0-9]|2[0-3])h|1d|7d)$/;

return view.extend({
	load() {
		return Promise.all([
			callConfig().catch(() => ({})),
			lscommon.loadLinks()
		]).then(data => data[0]);
	},

	render(config) {
		let m, s, o;

		m = new form.Map('librespeed', _('LibreSpeed – Settings'));

		s = m.section(form.NamedSection, 'main', 'librespeed', _('Measurement'));

		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'),
			_('Logical interface measured by default: by the Test page unless another one is chosen there, and by an automatic test that names no interface.'));
		o.default = 'wan';
		o.nocreate = true;
		showsLink(o);
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

		/* One row per automatic test. The named section 'schedule' comes
		 * first, as the init reads it first: every existing config has it,
		 * and without an interface of its own it measures main.interface.
		 * Rows added here are anonymous 'schedule' sections. The longer
		 * help sits above the table, where a column has no room for it and
		 * where a phone, which hides the column headings, still shows it. */
		s = m.section(form.TableSection, 'schedule', _('Scheduled measurements'), [
			[ _('Enable'), _('Runs a measurement from cron at the chosen interval. Note that a measurement saturates the connection while it runs.') ],
			[ _('Days'), _('Leave empty to run every day. A weekly test runs on one of the chosen days, or on any day when none is chosen; the day is drawn once and kept while it stays among the chosen days.') ],
			[ _('Hours'), _('An hour window on the 24-hour clock, such as 2-5 for 02:00–05:59. A daily or weekly measurement runs at a random time inside it, drawn when the schedule is applied; shorter intervals only run within it. Leave empty for any time. A window across midnight is not supported.') ]
		].map(h => E('p', {}, [ '%s: %s'.format(h[0], h[1]) ])));
		s.anonymous = true;
		s.addremove = true;
		/* An added row starts with the night window the shipped first row
		 * has: left empty, a daily test would run at any hour, the evening
		 * peak included, while the empty cell's placeholder reads 2-5. */
		s.handleAdd = function(ev, name) {
			const sid = this.map.data.add('librespeed', 'schedule', name);

			this.map.data.set('librespeed', sid, 'hours', '2-5');

			return this.map.save(null, true);
		};
		s.cfgsections = function() {
			const legacy = (uci.get('librespeed', 'schedule') || {})['.type'] == 'librespeed';

			return (legacy ? [ 'schedule' ] : []).concat(
				uci.sections('librespeed', 'schedule').map(x => x['.name']));
		};

		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'));
		o.nocreate = true;
		const schedIface = o;
		/* The first row without an interface of its own measures
		 * main.interface until it names another one. It shows the default
		 * as its value for display only: on save, a value equal to the
		 * default as set on this page is not written, as that would pin the
		 * row to it; any other interface is. Names are compared as links,
		 * the way results are recorded. */
		const followsMain = () =>
			uci.get('librespeed', 'schedule', 'interface') == null;
		const defaultIface = () => lscommon.linkName(
			mainIface.formvalue('main') ||
			uci.get('librespeed', 'main', 'interface') || 'wan');
		/* Taken when the form loads: the view builds the form before that,
		 * and a save reloads it. */
		let shownDefault;
		o.load = function(section_id) {
			if (section_id == 'schedule')
				shownDefault = uci.get('librespeed', 'main', 'interface') || 'wan';

			return widgets.NetworkSelect.prototype.load.call(this, section_id);
		};
		showsLink(o, sid => (sid == 'schedule') ? shownDefault : null);
		const writeLink = o.write;
		o.write = function(section_id, value) {
			if (section_id == 'schedule' && followsMain() && value == defaultIface())
				return;
			return writeLink.call(this, section_id, value);
		};
		/* Only enabled tests can collide, as only they reach the crontab,
		 * which keeps one of them per interface. An empty first row is
		 * main.interface, whose value on this page counts, not the saved
		 * one: changing the default to an interface with a row of its own
		 * is refused here instead of losing one of the two tests at apply. */
		const enabledOn = sid => enabled.formvalue(sid) == '1';
		const measured = (sid, value) => value ? lscommon.linkName(value)
			: (sid == 'schedule' ? defaultIface() : '');
		o.validate = function(section_id, value) {
			if (!value && section_id != 'schedule')
				return _('Choose the interface this test measures.');

			if (!enabledOn(section_id))
				return true;

			const name = measured(section_id, value);
			const taken = this.section.cfgsections().some(sid => sid != section_id &&
				enabledOn(sid) && measured(sid, this.formvalue(sid) ?? this.cfgvalue(sid)) == name);

			return !taken || _('Another enabled automatic test already measures %s.').format(name);
		};
		/* Every row validates only on its own events, yet a change of an
		 * interface, of Enable or of the default interface may make or
		 * clear a duplicate in any row. */
		const revalidate = () => {
			schedIface.section.cfgsections().forEach(sid => {
				const el = schedIface.getUIElement(sid);

				if (el)
					el.triggerValidation();
			});
		};
		o.onchange = revalidate;

		/* The first row follows the default interface on this page too,
		 * unless it was given another one. */
		mainIface.onchange = function(ev, section_id, value) {
			const el = schedIface.getUIElement('schedule');
			const cur = el ? el.getValue() : null;

			if (el && followsMain() && (cur == lscommon.linkName(shownDefault) || !cur))
				el.setValue(value);

			shownDefault = value;
			revalidate();
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		const enabled = o;
		o.onchange = revalidate;

		o = s.option(form.ListValue, 'interval', _('Interval'));
		/* Wide enough for the longest choice: the table otherwise squeezes
		 * this column to its heading and cuts every label. */
		o.width = '13em';
		/* From the shared table, so the Test page's status label and these
		 * choices cannot drift apart. */
		Object.keys(lscommon.INTERVALS).forEach(k =>
			o.value(k, lscommon.INTERVALS[k]));
		o.default = '1d';
		o.depends('enabled', '1');
		/* Disabling a test keeps its settings for when it is enabled again. */
		o.retain = true;
		/* A token set by hand outside the choices is offered too, as it is
		 * and in its own row only: a select without it would show the first
		 * choice and write that on save, turning a test every 2 hours into
		 * one every 15 minutes without a word. */
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			const keys = this.keylist, vals = this.vallist;

			if (cfgvalue != null && keys.indexOf(cfgvalue) < 0) {
				this.keylist = keys.concat(cfgvalue);
				this.vallist = vals.concat(cfgvalue);
			}

			try {
				return form.ListValue.prototype.renderWidget.apply(this, arguments);
			}
			finally {
				this.keylist = keys;
				this.vallist = vals;
			}
		};
		o.validate = function(section_id, value) {
			return INTERVAL_RE.test(value) ||
				_('The interval %s is not supported. Use 1-59m, 1-23h, 1d or 7d.').format(value);
		};

		o = s.option(form.MultiValue, 'days', _('Days'));
		lscommon.DAYS.forEach(d => o.value(d[0], d[1]));
		o.optional = true;
		o.depends('enabled', '1');
		o.retain = true;
		/* The init script hands this straight to cron, which wants commas.
		 * A value set by hand may hold a range (1-5) or another order: it is
		 * read as the days it covers, in the order of the choices, so a save
		 * that does not touch it keeps it instead of dropping the range. */
		o.cfgvalue = function(section_id) {
			const v = form.MultiValue.prototype.cfgvalue.apply(this, arguments);
			const on = {};

			if (v == null || v == '*')
				return [];

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
			const scheds = lscommon.activeSchedules(config);
			const box = E('div', { 'style': 'margin-top:1em' });

			if (scheds.length) {
				/* Epochs computed by the backend in the router's timezone;
				 * the rows follow the crontab, each test's runs together. */
				box.appendChild(E('h4', {}, [ _('Upcoming measurements') ]));
				box.appendChild(E('table', { 'class': 'table', 'style': 'max-width:32em' },
					scheds.flatMap(sc => (sc.next_runs || []).map(e => {
						const d = new Date(e * 1000);

						/* With the weekday: a weekly test's day may be drawn. */
						return E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td' }, [ sc.interface ? lscommon.linkName(sc.interface) : '–' ]),
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
