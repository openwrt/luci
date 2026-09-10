'use strict';
'require dom';
'require baseclass';
'require wwand.format as fmt';

/* Live signal graphs, shared so they can sit inside the modem status page.
   They were a page of their own for a while; they belong beside the numbers
   they explain, and a second page meant a second poll of the same ubus method.

   THE HISTORY LIVES IN THE BROWSER. Every sample is one `modem_signal` reply
   pushed into a ring buffer here; nothing is stored on the router. That is the
   deliberate half of the design (ddimension/wwand#14): a daemon-side buffer
   would have to be serialised into every status call and would keep sampling
   while nobody is watching. The cost is that the window starts empty and is
   lost on reload — acceptable for the job this is for, which is aiming an
   antenna while looking at it.

   THE CALLER OWNS THE SAMPLES. `push()` takes a modem_signal reply the page has
   already fetched for its own panels, so the graphs cost no extra RPC. It also
   means the graph DOM must OUTLIVE the caller's repaint: status.js rebuilds its
   panels every second, and a canvas rebuilt with them would lose its ring
   buffers every tick and never draw a line. Keep the node create() returns
   outside whatever gets replaced.

   ONE INSTANCE PER MODEM. create() is called per modem and holds that modem's
   buffers, so a multi-modem router keeps each history separate and switching
   between them does not splice one modem's readings onto another's line. Only
   the selected modem is sampled — the page fetches signal for the one it is
   showing — so an unwatched modem's line simply has no new points; returning to
   it shows its earlier window with an honest gap, rather than a fabricated one.
   That is also the polite behaviour: polling every modem would keep every
   modem's fast telemetry loop awake for graphs nobody is looking at. */

/* WHERE THE THRESHOLDS COME FROM — checked, not guessed.
 *
 * Teltonika's published recommendations (wiki.teltonika-networks.com,
 * "Mobile Signal Strength Recommendations", read 2026-09-10):
 *
 *     RSRP   >= -80 excellent · -80..-90 good · -90..-100 fair/poor · < -100 poor
 *     RSSI   >  -65 excellent · -65..-75 good · -75..-85 fair · -85..-95 poor
 *     SINR   >= 20  excellent · 13..20   good · 0..13     fair/poor · <= 0 poor
 *     RSRQ   >= -10 excellent · -10..-15 good · -15..-20  fair/poor · <= -20 poor
 *
 * Worth recording: `board.bars_from_signal()` already implements exactly this —
 * RSRP -80/-90/-100 and RSSI -65/-75/-85/-95 (board.uc:136-143) — so the ladder
 * behind the router's signal LEDs was never a guess, it just never said where it
 * came from. The graph draws the same boundaries the LEDs step at, which is the
 * point: what the case shows and what the browser shows should agree.
 *
 * DO THE RATs NEED THEIR OWN BANDS? Checked, and for RSRP and SINR: no.
 * hicelltek.com/en/blog/rsrp-rsrq-sinr-normal-values/ (read 2026-09-10) prints
 * 4G and 5G tables side by side and gives SSB-RSRP the same -80/-90/-100/-110
 * steps as LTE RSRP, and SSB-SINR the same 20/13/0/-5 as LTE SINR; the wider
 * convention agrees for sub-6 GHz, noting only that mmWave wants RSRP above -85.
 * So one set of rules per canvas grades both series honestly, and a per-RAT
 * ladder would invent a distinction the sources do not make.
 *
 * RSRQ is where they genuinely part: LTE -10/-12/-15/-17 against NR -10/-13/-15
 * (same source), and Teltonika's LTE ladder is a third variant (-10/-15/-20).
 * All three agree only on -10 = excellent. The tree follows Teltonika elsewhere,
 * so the RSRQ canvas draws Teltonika's and the hint says NR sits a little
 * tighter. That much disagreement between published tables is itself the
 * finding: RSRQ is a soft indicator of cell load, not a target.
 *
 * EC/IO IS THE WEAKEST-SOURCED OF THE FOUR and the hint says so rather than
 * implying the same rigour. The one figure that can be anchored is Venn
 * Telecom's "once the EC/IO is above ~ -7.0 dB, your connection is going to
 * suffer" (help.venntelecom.com, read 2026-09-10); the -6/-10/-13 steps drawn
 * here are the operator convention that sits around it, and published tables
 * for it live in images rather than text. 3G is also the RAT a modem falls back
 * TO, so the useful reading is usually "we are on 3G at all", not the exact dB.
 *
 * Each scale is a readable window, not the full 3GPP reporting range: -120..-50
 * dBm covers every labelled boundary with headroom, where -140..-44 would
 * squeeze everything interesting into a few pixels. Values outside are clamped
 * and the legend still prints the true number. */
const SCALES = {
	rsrp: { min: -120, max: -50, unit: 'dBm',
	        good: -80, fair: -90, weak: -100,
	        labels: [ _('excellent'), _('good'), _('fair') ],
	        title: _('Signal strength (RSRP)'),
	        hint: _('The measure to aim an antenna by, and the same steps the router\'s signal LEDs use: the serving cell\'s own power, RSRP on LTE and 5G, RSCP on 3G. LTE and 5G NR are graded alike, because published tables give SSB-RSRP the same boundaries as LTE RSRP below 6 GHz. RSSI is a different measure on its own graph.') },
	rssi: { min: -110, max: -30, unit: 'dBm',
	        good: -65, fair: -75, weak: -85,
	        labels: [ _('excellent'), _('good'), _('fair') ],
	        title: _('Band power (RSSI)'),
	        hint: _('Total received power in the band — the serving cell plus its neighbours plus interference. Coarser than RSRP and graded 20 dB higher (-65/-75/-85 dBm), which is why it has its own graph: a strong signal reaches -46 dBm, off the top of any scale drawn for RSRP. On 2G it is the only measure there is, and on a modem that reports nothing better it is all you get. Each line carries the radio that measured it; the plain amber one appears only when the reply is untagged.') },
	sinr: { min: -10, max: 30, unit: 'dB',
	        good: 20, fair: 13, weak: 0,
	        labels: [ _('excellent'), _('good'), _('fair') ],
	        title: _('Signal quality (SINR)'),
	        hint: _('How far the wanted signal stands above noise and interference — this, not RSRP, is what throughput follows. 0 dB is the edge of usable. LTE and 5G NR share these boundaries in the published tables.') },
	rsrq: { min: -25, max: -3, unit: 'dB',
	        good: -10, fair: -15, weak: -20,
	        labels: [ _('excellent'), _('good'), _('fair') ],
	        title: _('Reference signal quality (RSRQ)'),
	        hint: _('Mostly a read on how busy the cell is: it falls as the cell fills, even with the antenna untouched. Treat it as an indicator rather than a target — published ladders disagree below -10 dB, and 5G NR is graded a little tighter than the LTE steps drawn here.') },
	ecio: { min: -20, max: 0, unit: 'dB',
	        good: -6, fair: -10, weak: -13,
	        labels: [ _('excellent'), _('good'), _('fair') ],
	        title: _('3G signal quality (Ec/Io)'),
	        hint: _('The 3G counterpart to SINR: pilot energy against everything else in the carrier. Above roughly -7 dB a connection starts to suffer; the steps drawn here are the common operator convention around that figure, which is less firmly published than the LTE and 5G ladders. On a modem that normally runs LTE, this canvas appearing at all is the news.') },
};

/* ONE SERIES PER RAT, never one line that quietly changes meaning, and the same
   colour for a RAT on every canvas so the eye can follow it across them. */
const RAT = {
	lte:  '#0069d9',   /* blue   */
	nr:   '#8e44ad',   /* purple */
	umts: '#17a2b8',   /* teal   */
	gsm:  '#6c757d',   /* grey   */
	any:  '#e0a800',   /* amber, the band-wide fallback */
};

const SERIES = {
	/* Solid = the serving cell's own power (RSRP, or RSCP on 3G); dashed = the
	   band-wide RSSI, which counts neighbours and interference too. Same RAT,
	   same colour, so the pair reads as one radio measured two ways — and the
	   untagged amber line appears only when the modem tags nothing at all.

	   THEY ARE ON SEPARATE CANVASES because they are separate quantities with
	   ladders 20 dB apart. Sharing one pinned a -46 dBm RSSI to the top edge of
	   an RSRP scale, where it showed nothing (ddimension/wwand#14). */
	rsrp: [ { label: _('RSRP LTE'), colour: RAT.lte },
	        { label: _('RSRP 5G'),  colour: RAT.nr },
	        { label: _('RSCP 3G'),  colour: RAT.umts } ],
	/* dashed here too, though nothing solid shares the canvas: the reader who
	   has learnt "dashed = band power" on one graph should not have to relearn
	   it on the next. */
	rssi: [ { label: _('RSSI LTE'), colour: RAT.lte,  dashed: true },
	        { label: _('RSSI 3G'),  colour: RAT.umts, dashed: true },
	        { label: _('RSSI 2G'),  colour: RAT.gsm,  dashed: true },
	        { label: _('RSSI'),     colour: RAT.any,  dashed: true } ],
	sinr: [ { label: _('SINR LTE'),  colour: RAT.lte },
	        { label: _('SINR 5G'),   colour: RAT.nr } ],
	rsrq: [ { label: _('RSRQ LTE'),  colour: RAT.lte },
	        { label: _('RSRQ 5G'),   colour: RAT.nr } ],
	ecio: [ { label: _('Ec/Io 3G'),  colour: RAT.umts } ],
};

/* ONE definition of how a series is stroked, used by the line in the graph and
   by its key in the legend. Two copies drifted apart the moment the legend
   stopped being a colour block. */
function strokeOf(s) {
	return 'stroke:%s;stroke-width:%s%s'.format(
		s.colour, s.dashed ? '1.4' : '1.6', s.dashed ? ';stroke-dasharray:5,3' : '');
}

const HEIGHT = 200;
const SVGNS = 'http://www.w3.org/2000/svg';

return baseclass.extend({
	/* one canvas: the SVG, its ring buffers, and the legend cells to update */
	mkGraph: function(graphs, kind, svgText) {
		const scale = SCALES[kind];
		const series = SERIES[kind];
		const box = E('div', {
			'style': 'width:100%%;height:%dpx;border:1px solid #999;background:#fff'.format(HEIGHT),
		}, E(svgText));
		const svg = box.firstElementChild;

		/* The series paths are built HERE, not in the SVG file. The file used to
		   carry a fixed set of them, which silently capped how many RATs a
		   canvas could show — adding 3G and 2G meant editing an asset to add
		   two more <path> elements with hard-coded colours. The canvas is now
		   just the threshold rules, and each series brings its own line. */
		const paths = series.map((s) => {
			const p = document.createElementNS(SVGNS, 'path');

			p.setAttribute('d', '');
			p.setAttribute('style', 'fill:none;stroke-linejoin:round;' + strokeOf(s));
			svg.appendChild(p);

			return p;
		});

		const legend = series.map(() => E('span', {}, [ '—' ]));

		/* A legend entry appears WITH its series. Listing every RAT the app can
		   plot told an LTE-only modem's owner that "RSCP 3G" and "RSSI 2G" were
		   "not reported", which is true and useless — it reads as something
		   missing rather than something absent by design. The canvases already
		   hide themselves on the same rule; the rows inside them should not be
		   noisier than the canvas around them. */
		/* THE KEY IS A LINE SAMPLE, NOT A COLOUR BLOCK. Two series on the same
		   canvas share a RAT colour on purpose — RSRP LTE and RSSI LTE are one
		   radio measured two ways — and the only thing telling them apart in the
		   graph is that one is dashed. A square swatch threw exactly that away,
		   so the legend showed two identical blue chips for two different lines.

		   The sample is a real SVG stroke with the SAME dash array as the line
		   it stands for, not a CSS dashed border: `border-top:dashed` is drawn
		   at each browser's discretion, and Firefox renders it as a fine
		   dash-dot that is hard to tell from a solid rule at legend size
		   (reported from Firefox, 2026-09-10). Stroking it the way the graph
		   strokes it makes the key and the line the same picture by
		   construction. */
		const legendRow = series.map((s, i) => {
			const key = document.createElementNS(SVGNS, 'svg');

			key.setAttribute('width', '22');
			key.setAttribute('height', '10');
			key.setAttribute('style', 'vertical-align:middle;margin-right:.45em');

			const rule = document.createElementNS(SVGNS, 'line');

			rule.setAttribute('x1', '0');  rule.setAttribute('y1', '5');
			rule.setAttribute('x2', '22'); rule.setAttribute('y2', '5');
			rule.setAttribute('style', strokeOf(s));
			key.appendChild(rule);

			return E('span', {
				'style': 'white-space:nowrap;display:none' },
				[ key, s.label + ': ', legend[i] ]);
		});

		/* Start hidden and reveal on the first real value, stickily. A canvas
		   only some modems can fill — Ec/Io on an LTE-only stack, RSRQ on a
		   modem that reports none — would otherwise sit there empty forever,
		   indistinguishable from a broken graph. Sticky, because a 5G leg
		   dropping out for ten minutes must leave its canvas in place: hiding
		   it would erase the very gap that says 5G went away. */
		/* The explanation is a MOUSE-OVER, not a paragraph. Printed under every
		   canvas it cost more vertical space than the graphs themselves and
		   pushed the panels below off the screen — and it is reference text,
		   read once and then in the way. It hangs off the heading and the
		   legend, both marked with the app's dotted-underline "there is more
		   here" convention (fmt.term), so it is discoverable rather than
		   hidden. */
		const node = E('div', { 'class': 'cbi-section',
			'style': 'flex:1;min-width:320px;display:none' }, [
			E('h3', {}, [ fmt.term(scale.title, scale.hint) ]),
			box,
			/* A FLEX ROW, because these entries cannot wrap on their own.
			   They are appended to the parent by DOM calls, so there is no
			   whitespace text node between them — and between two adjacent
			   inline boxes with no intervening space there is no line-break
			   opportunity at all. The row therefore ran on past the column and
			   overlapped what came next; Chrome happened to hide it, Firefox
			   showed it (reported 2026-09-10). `flex-wrap` gives the break
			   opportunity structurally instead of depending on stray text
			   nodes, and `gap` replaces the per-entry margin so the spacing
			   does not double up at a wrap. */
			E('div', { 'title': scale.hint,
				'style': 'display:flex;flex-wrap:wrap;gap:2px 1.5em;'
					+ 'align-items:center;margin:4px 0 6px;font-size:90%;cursor:help' },
				legendRow),
		]);

		graphs.push({
			kind: kind, svg: svg, scale: scale, node: node,
			series: series, legend: legend, legendRow: legendRow, paths: paths,
			values: series.map(() => []),
			seen: series.map(() => false),
			marks: [],
			width: 0, step: 3,
		});

		return node;
	},

	/* grid labels + the time marks along the bottom, once the box has a width */
	prepare: function(ctx) {
		const width = ctx.svg.parentNode.offsetWidth - 2;

		if (width <= 0 || width === ctx.width)
			return;

		ctx.width = width;
		ctx.wanted = Math.floor(width / ctx.step);

		const G = ctx.svg;
		const s = ctx.scale;

		/* the quality thresholds, placed by VALUE rather than by a fixed
		   fraction of the canvas — they mean a signal level, not a position */
		const height = HEIGHT - 2;
		const yOf = (v) => height - ((v - s.min) / (s.max - s.min)) * height;

		for (const t of [ { id: 't_good', v: s.good, txt: s.labels[0] },
		                  { id: 't_fair', v: s.fair, txt: s.labels[1] },
		                  { id: 't_poor', v: s.weak, txt: s.labels[2] } ]) {
			const line = G.querySelector('#' + t.id);
			const label = G.querySelector('#' + t.id + '_l');
			const y = yOf(t.v);

			if (line) {
				line.setAttribute('y1', y);
				line.setAttribute('y2', y);
			}

			if (label) {
				label.setAttribute('y', y - 3);
				label.textContent = '%s — %d %s'.format(t.txt, Math.round(t.v), s.unit);
			}
		}

		/* a minute mark every 60 samples, like the bandwidth graph.

		   REMOVE THE OLD ONES FIRST. prepare() runs again whenever the box
		   changes width — on reveal, on a window resize — and appending a
		   second set left two ladders of labels overlapping at slightly
		   different offsets ("2r8m" where two "2m" and "8m" collided). Seen on
		   the NR7101 the moment the canvases became revealable.

		   The marks also go BEHIND the series: insertBefore the first path, or a
		   later repaint would lay grid lines over data drawn earlier. */
		const first = ctx.paths[0];

		for (const old of ctx.marks)
			old.remove();

		ctx.marks = [];

		for (let i = width % (ctx.step * 60); i < width; i += ctx.step * 60) {
			const line = document.createElementNS(SVGNS, 'line');
			line.setAttribute('x1', i); line.setAttribute('y1', 0);
			line.setAttribute('x2', i); line.setAttribute('y2', '100%');
			line.setAttribute('style', 'stroke:#000;stroke-width:0.1');

			const text = document.createElementNS(SVGNS, 'text');
			text.setAttribute('x', i + 5);
			text.setAttribute('y', 15);
			text.setAttribute('style', 'fill:#666; font-size:9pt; font-family:sans-serif');
			text.appendChild(document.createTextNode(Math.round((width - i) / ctx.step / 60) + 'm'));

			G.insertBefore(line, first);
			G.insertBefore(text, first);
			ctx.marks.push(line, text);
		}
	},

	draw: function(ctx, values) {
		/* REVEAL BEFORE MEASURING, or the canvas can never appear: a node at
		   display:none has offsetWidth 0, prepare() bails on a zero width, and
		   an early return here would skip the very code that unhides it. That
		   deadlock is exactly what the first build did — every canvas stayed
		   hidden and the page showed nothing but the empty-state line. */
		let revealed = false;

		for (let i = 0; i < ctx.series.length; i++) {
			if (values[i] == null || ctx.seen[i])
				continue;

			ctx.seen[i] = true;
			ctx.legendRow[i].style.display = '';
			revealed = true;
		}

		if (revealed) {
			ctx.node.style.display = '';
			ctx.width = 0;     /* it had none while hidden — measure again */
		}

		this.prepare(ctx);

		const height = HEIGHT - 2;
		const s = ctx.scale;
		const span = s.max - s.min;

		for (let i = 0; i < ctx.series.length; i++) {
			const buf = ctx.values[i];

			/* buffer every sample even while there is nowhere to draw it: a
			   canvas revealed a second from now should show the second it was
			   revealed by, not start from empty */
			buf.push(values[i]);

			while (buf.length > (ctx.wanted || 1))
				buf.shift();

			if (!ctx.width)
				continue;

			/* A line, not a filled area. Upstream's bandwidth graph fills down to
			   the baseline because zero bytes/s is a meaningful floor; -125 dBm
			   is not, and the slab it paints buries the threshold rules under a
			   block of colour.

			   A GAP IS NOT A ZERO either: a modem reporting no RSRP this second
			   must leave a hole, never a line dropping to the bottom of the
			   scale, which would read as "signal lost". A path says that
			   directly — every run of real values starts a fresh `M`. */
			const d = [];
			let pen = false;

			for (let j = 0; j < buf.length; j++) {
				const v = buf[j];
				const x = ctx.width - (buf.length - 1 - j) * ctx.step;

				if (v == null) {
					pen = false;
					continue;
				}

				const clamped = Math.min(s.max, Math.max(s.min, v));
				const y = height - ((clamped - s.min) / span) * height;

				d.push('%s%d,%s'.format(pen ? 'L' : 'M', Math.round(x), y.toFixed(1)));
				pen = true;
			}

			ctx.paths[i].setAttribute('d', d.join(' '));

			/* legend: current, and the average and peak over the window that is
			   actually on screen — a peak from a sample that has scrolled away
			   is a number the user cannot see any more */
			const seen = buf.filter((x) => x != null);
			const cur = buf[buf.length - 1];
			const avg = seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : null;

			/* ONE msgid, not three. `avg` and `peak` as separate _() calls put
			   two context-free words in the catalogue and left the sentence
			   around them untranslatable, so its word order, spacing and
			   punctuation were fixed for every language.

			   ONE space before the bracket, not two: LuCI's i18n-scan collapses
			   whitespace when it builds the catalogue (build/i18n-scan.pl:43,85),
			   so a literal with a double space can never match the msgid it
			   generates and the translation would silently never apply. No
			   shipped template in the tree contains one. */
			dom.content(ctx.legend[i], [ (cur != null)
				? _('%.1f %s (avg %.1f, peak %.1f)').format(cur, s.unit,
					avg, Math.max.apply(null, seen))
				: _('not reported') ]);
		}
	},

	/* Build the canvases for one modem. Returns the node to place and a push()
	   to feed it; the caller keeps both for as long as that modem stays
	   selected, and drops them (fresh buffers) when it changes. */
	create: function(svgText) {
		const graphs = [];

		/* Every canvas starts hidden, so a modem that reports nothing would
		   leave a blank strip between the warnings and the panels with no hint
		   why. Say it instead — and say the right thing: "no RSRP" is not "not
		   registered", which is the distinction fmt.signalNone() exists to keep
		   (the panel that used to make that claim was contradicted on screen by
		   the Serving cell panel beside it). */
		const empty = E('em', {}, [ '' ]);

		const node = E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap' },
			[ empty ].concat([ 'rsrp', 'rssi', 'sinr', 'rsrq', 'ecio' ]
				.map((k) => this.mkGraph(graphs, k, svgText))));

		return {
			node: node,
			push: L.bind(function(sig, reg) {
				const sample = fmt.signalSample(sig);

				for (const ctx of graphs)
					this.draw(ctx, sample[ctx.kind]);

				const any = graphs.some((ctx) => ctx.seen.some((v) => v));

				empty.style.display = any ? 'none' : '';

				if (!any)
					dom.content(empty, [ fmt.signalNone(reg) ]);
			}, this),
		};
	},
});
