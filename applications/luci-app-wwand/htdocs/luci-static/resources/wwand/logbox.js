'use strict';
'require baseclass';
'require dom';
'require rpc';
'require ui';

/* The wwand log, on the status page, with the filters the log's own structure
   already implies.

   WHERE IT COMES FROM. `log.read` over ubus, the same source LuCI's own System
   Log view uses (tools/views.js, LuCI Master as installed 2026-07-22) — not a
   new daemon method and not a shell-out. An entry is
   { time, priority, msg, ... }, where the facility is priority >> 3 and the
   severity is priority & 7, and `msg` is "tag[pid]: text".

   IT IS NOT A POLL. The status page around it refreshes every second, and a log
   that scrolls while you are reading it is worse than one you refresh yourself;
   a thousand-line fetch a second would also be the most expensive thing on the
   page by a wide margin. Loads once, refreshes on demand, and offers a live
   toggle that is off by default. */

const callLogRead = rpc.declare({
	object: 'log',
	method: 'read',
	params: [ 'lines', 'stream', 'oneshot' ],
	expect: { log: [] },
});

const SEVERITY = [ 'emerg', 'alert', 'crit', 'err', 'warn', 'notice', 'info', 'debug' ];

/* How many log entries to ASK FOR. Not the same as how many wwand lines come
   back: the ring buffer is shared with everything else on the box, and on a
   chatty one (dropbear, netifd, the kernel) wwand can be a small fraction of
   it. So the fetch is deliberately larger than the display count, and the
   footer says how many of the fetched entries were wwand's — otherwise
   "100 lines" silently means "the 12 wwand lines that happened to be in the
   last 100 of everything". */
const FETCH = { '100': 600, '250': 1500, '1000': 6000, 'all': 20000 };

/* A wwand message is "wwand[pid]: <subject>: <rest>", and the subject is what
   the filters are made of:
     modem <name>: at2: …      -> modem wwmodem0, subsystem at2
     interface <name>: state … -> connection wwand0
     board <id>: …             -> subsystem board
     autosetup: …              -> subsystem autosetup
     hotplug add cdc-wdm0      -> subsystem hotplug (no colon at all)
   Anything that does not fit keeps its text and lands under no filter, which is
   the right failure: a line the parser does not understand must still be
   readable, and must not quietly disappear when a filter is set. */
function parse(msg) {
	const m = /^wwand\[(\d+)\]:\s*(.*)$/.exec(msg);

	if (!m)
		return null;

	const out = { pid: m[1], text: m[2], modem: null, conn: null, subsys: null };
	let rest = out.text;
	let s = /^(modem|interface|board)\s+(\S+?):\s*(.*)$/.exec(rest);

	if (s) {
		if (s[1] == 'modem') out.modem = s[2];
		else if (s[1] == 'interface') out.conn = s[2];
		else out.subsys = 'board';

		rest = s[3];
	}

	if (!out.subsys) {
		/* the next "word:" is the subsystem — at, at2, qmi, telemetry, … — but
		   only when it really is one. "state CONNECTED -> IDLE" has no colon,
		   and a bare AT response can carry one anywhere, so the token is
		   required to be short and free of spaces. */
		const t = /^([a-z0-9_]{1,12}):\s/.exec(rest);

		if (t) {
			out.subsys = t[1];
			out.bare = !s ? t[1] : null;   /* see classify() */
		} else if (!s) {
			out.subsys = (/^([a-z0-9_]{1,16})\b/.exec(rest) || [])[1] || null;
		}
	}

	return out;
}

/* SOME LINES ADDRESS A CONNECTION BY ITS BARE NAME. Most say "interface X: …",
   but the datapath says "wwand0: uplink aggregation on (…)" with no prefix, and
   parse() can only see a short token followed by a colon — which is exactly what
   a subsystem looks like. So `wwand0` turned up in the subsystem list next to
   `at` and `telemetry`, and filtering by connection missed those lines.

   It cannot be settled by the SHAPE of the name: L3 names are free-form
   (wwand0 is a suggestion, not a rule), so a /^wwand\d+$/ test would be right
   on our boxes and wrong on anyone else's. What settles it is the log itself —
   the same fetch also carries unambiguous "interface X: …" lines, and a bare
   token that matches one of those names is that connection. Evidence over
   pattern; a name never seen with the prefix stays a subsystem, which is the
   safe direction. */
function classify(rows) {
	const known = {};

	for (const r of rows)
		if (r.conn)
			known[r.conn] = true;

	for (const r of rows) {
		if (r.bare && known[r.bare]) {
			r.conn = r.bare;
			r.subsys = null;
		}

		delete r.bare;
	}

	return rows;
}

return baseclass.extend({
	/* Returns { node } — the caller places it once and never rebuilds it, the
	   same contract the graphs have, so the selections survive the page's
	   per-second repaint of everything else. */
	create: function() {
		let rows = [];               /* the parsed wwand entries, newest last */
		let fetched = 0;             /* how many raw entries the last read saw */

		/* The modem the PAGE is showing, so the log follows the selector above
		   it instead of making you set the same thing twice.

		   TWO REASONS IT IS NOT JUST `modem.value = name`. The dropdown is built
		   from the modems that appear IN THE LOG, and a modem that has said
		   nothing yet has no option to select — so the wish is remembered and
		   applied whenever its option turns up. And the page re-renders every
		   second: re-applying on every tick would yank the filter back the
		   instant the reader changed it by hand, so it is applied only when the
		   PAGE's selection actually changes. Theirs wins until then. */
		let wantModem = null;

		/* A TEXTAREA, not a styled <pre>. The first version painted its own
		   light background and dark text, which is a white slab in the middle of
		   a dark theme — the same mistake the threshold rules made in the other
		   direction (ddimension/wwand#14: a theme repainting our colours). A
		   read-only textarea is a form control, so every theme already styles it
		   for its own background, and it is what LuCI's own System Log view uses
		   — the reader gets the widget they already know, with selection and
		   scrolling for free. */
		const out = E('textarea', {
			'readonly': '', 'wrap': 'off', 'rows': 20,
			'style': 'width:100%;font-family:monospace;font-size:90%',
		}, [ '' ]);

		const foot = E('div', { 'style': 'margin-top:.35em;font-size:90%;color:#666' }, [ '' ]);

		const sel = (choices, title) => {
			const e = E('select', { 'class': 'cbi-input-select', 'title': title },
				choices.map((c) => E('option', { 'value': c[0] }, [ c[1] ])));

			e.addEventListener('change', () => render());

			return e;
		};

		const count = sel([ [ '100', '100' ], [ '250', '250' ], [ '1000', '1000' ],
		                    [ 'all', _('all') ] ], _('How many wwand lines to show'));
		const level = sel([ [ 'any', _('any level') ] ]
			.concat(SEVERITY.slice(3).map((s) => [ s, s ])), _('Minimum severity'));
		const modem = sel([ [ 'any', _('any modem') ] ], _('Only this modem'));
		const conn  = sel([ [ 'any', _('any connection') ] ], _('Only this connection'));
		const subsys = sel([ [ 'any', _('any subsystem') ] ], _('Only this subsystem'));

		/* The dropdowns are built from WHAT THE LOG ACTUALLY CONTAINS, not from
		   the configuration: a modem that was renamed, removed or never came up
		   is exactly the one whose lines you are looking for, and a list built
		   from uci would not offer it. Re-built on every fetch, keeping the
		   current selection when it is still present. */
		const refill = (e, values, anyLabel, prefer) => {
			const want = (prefer != null && values.indexOf(prefer) >= 0) ? prefer : e.value;

			dom.content(e, [ E('option', { 'value': 'any' }, [ anyLabel ]) ].concat(
				values.sort().map((v) => E('option', { 'value': v }, [ v ]))));

			e.value = (values.indexOf(want) >= 0) ? want : 'any';
		};

		const render = () => {
			const lim = count.value;
			const maxSev = (level.value == 'any') ? 7 : SEVERITY.indexOf(level.value);

			let show = rows.filter((r) =>
				r.sev <= maxSev &&
				(modem.value  == 'any' || r.modem  == modem.value) &&
				(conn.value   == 'any' || r.conn   == conn.value) &&
				(subsys.value == 'any' || r.subsys == subsys.value));

			const total = show.length;

			if (lim != 'all' && total > +lim)
				show = show.slice(total - +lim);

			/* .value, not dom.content(): a textarea's text is its value, and
			   appending a child node to one leaves the box empty on every
			   browser that follows the spec. */
			out.value = show.length
				? show.map((r) => '%s  %-6s %s'.format(r.stamp, r.sevname, r.text)).join('\n')
				: _('No wwand lines matched.');

			out.scrollTop = out.scrollHeight;

			dom.content(foot, [ _('%d of %d wwand lines, from the last %d log entries on the box.')
				.format(show.length, total, fetched) ]);
		};

		const reload = () => {
			return callLogRead(FETCH[count.value] || 600, false, true).then((entries) => {
				fetched = entries.length;
				rows = [];

				const seen = { modem: {}, conn: {}, subsys: {} };

				for (const e of entries) {
					const p = parse(e.msg || '');

					if (!p)
						continue;

					const sev = (e.priority || 0) & 7;
					const d = new Date(e.time);

					if (p.modem)  seen.modem[p.modem] = true;
					if (p.conn)   seen.conn[p.conn] = true;
					if (p.subsys) seen.subsys[p.subsys] = true;

					rows.push({
						sev: sev, sevname: SEVERITY[sev] || '?',
						stamp: '%02d:%02d:%02d'.format(d.getHours(), d.getMinutes(), d.getSeconds()),
						modem: p.modem, conn: p.conn, subsys: p.subsys, text: p.text,
						bare: p.bare,
					});
				}

				/* second pass: the bare-name connections, now that every
				   "interface X:" line in this fetch has been seen */
				classify(rows);

				seen.conn = {};
				seen.subsys = {};

				for (const r of rows) {
					if (r.conn)   seen.conn[r.conn] = true;
					if (r.subsys) seen.subsys[r.subsys] = true;
				}

				refill(modem, Object.keys(seen.modem), _('any modem'), wantModem);
				refill(conn, Object.keys(seen.conn), _('any connection'));
				refill(subsys, Object.keys(seen.subsys), _('any subsystem'));
				render();
			}).catch((e) => {
				/* An unreadable log is a permission answer, not an empty log —
				   say which, or the reader concludes the daemon has gone quiet. */
				out.value = _('Could not read the system log: %s').format((e && e.message) || e);
				dom.content(foot, [ '' ]);
			});
		};

		count.addEventListener('change', () => reload());

		const btn = E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, reload) },
			[ _('Refresh') ]);

		const liveBox = E('input', { 'type': 'checkbox' });
		let timer = null;

		liveBox.addEventListener('change', () => {
			if (timer) { window.clearInterval(timer); timer = null; }

			if (liveBox.checked)
				/* STOP WHEN THE VIEW IS GONE. Nothing calls back into this widget on
				   navigation, so a plain setInterval would go on reading the SYSTEM
				   LOG every five seconds for the life of the LuCI document, holding
				   the whole widget alive with it. */
				timer = window.setInterval(() => {
					if (!node.isConnected) {
						window.clearInterval(timer);
						timer = null;
						return;
					}

					reload();
				}, 5000);
		});

		const node = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ _('wwand log') ]),
			E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:.5em;align-items:center;margin-bottom:.5em' }, [
				count, level, modem, conn, subsys, btn,
				E('label', { 'style': 'display:flex;align-items:center;gap:.3em;cursor:pointer' },
					[ liveBox, _('auto-refresh') ]),
			]),
			out,
			foot,
		]);

		reload();

		return {
			node: node,
			reload: reload,

			/* called by the page when ITS modem selection changes */
			selectModem: function(name) {
				if (wantModem === name)
					return;

				wantModem = name;

				if (name == null) {
					modem.value = 'any';
				} else if ([ ...modem.options ].some((o) => o.value == name)) {
					modem.value = name;
				} else {
					/* not in the log yet — refill() will pick it up as soon as
					   this modem says something */
					modem.value = 'any';
				}

				render();
			},
		};
	},
});
