'use strict';
'require view';
'require form';
'require rpc';
'require tools.widgets as widgets';
'require librespeed.common as lscommon';

const callConfig = rpc.declare({
	object: 'librespeed',
	method: 'config',
	expect: { '': {} }
});

return view.extend({
	load() {
		return callConfig().catch(() => ({}));
	},

	render(config) {
		let m, s, o;

		m = new form.Map('librespeed', _('LibreSpeed – Settings'));

		s = m.section(form.NamedSection, 'main', 'librespeed', _('Measurement'));

		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'),
			_('Logical interface the measurement is bound to.'));
		o.default = 'wan';
		o.nocreate = true;

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

		s = m.section(form.NamedSection, 'schedule', 'librespeed', _('Scheduled measurements'));

		o = s.option(form.Flag, 'enabled', _('Enable'),
			_('Runs a measurement from cron at the chosen interval. Note that a measurement saturates the connection while it runs.'));

		o = s.option(form.ListValue, 'interval', _('Interval'));
		/* From the shared table, so the Test page's status label and these
		 * choices cannot drift apart. */
		Object.keys(lscommon.INTERVALS).forEach(k =>
			o.value(k, lscommon.INTERVALS[k]));
		o.default = '1d';
		o.depends('enabled', '1');

		o = s.option(form.MultiValue, 'days', _('Days'),
			_('Leave empty to run every day.'));
		o.value('1', _('Monday'));
		o.value('2', _('Tuesday'));
		o.value('3', _('Wednesday'));
		o.value('4', _('Thursday'));
		o.value('5', _('Friday'));
		o.value('6', _('Saturday'));
		o.value('0', _('Sunday'));
		o.optional = true;
		o.depends('enabled', '1');
		/* The init script hands this straight to cron, which wants commas. */
		o.cfgvalue = function(section_id) {
			const v = form.MultiValue.prototype.cfgvalue.apply(this, arguments);
			return (v == null || v == '*') ? [] : String(v).split(',');
		};
		o.write = function(section_id, value) {
			const list = Array.isArray(value) ? value.filter(v => v !== '') : [];
			if (!list.length)
				return this.remove(section_id);
			return this.super('write', [ section_id, list.join(',') ]);
		};

		o = s.option(form.Value, 'hours', _('Hours'),
			_('An hour window on the 24-hour clock, such as 2-5 for 02:00–05:59. A daily measurement runs at a random time inside it, drawn when the schedule is applied; shorter intervals only run within it. Leave empty for any time. A window across midnight is not supported.'));
		o.placeholder = '2-5';
		o.optional = true;
		o.depends('enabled', '1');
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
			const cron = config && config.schedule && config.schedule.cron;
			const box = E('div', { 'style': 'margin-top:1em' });

			if (cron) {
				/* Epochs computed by the backend in the router's timezone. */
				const runs = (config && config.schedule && config.schedule.next_runs || [])
					.map(e => new Date(e * 1000));

				box.appendChild(E('h4', {}, [ _('Upcoming measurements') ]));
				box.appendChild(E('table', { 'class': 'table', 'style': 'max-width:24em' },
					runs.map(d => E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, [ d.toLocaleDateString() ]),
						E('td', { 'class': 'td' }, [ d.toLocaleTimeString() ])
					]))));
				box.appendChild(E('p', { 'style': 'color:#888' }, [
					_('A daily measurement runs at a time drawn when the schedule is applied; saving draws it anew.')
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
