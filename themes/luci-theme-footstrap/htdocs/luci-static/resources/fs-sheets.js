'use strict';
'require baseclass';

/* ---- a view's injected CSS: never DELETE it; leave a poisoned document to a real load ----
 *
 * A view's <style> dies with the document on a full load, but SPA nav never reloads, so it restyles
 * every page after. `luci-app-filemanager` injects
 * `.cbi-button-save:not(.custom-save-button) { display: none !important }` — unlayered and
 * important, outranking every cascade layer, so one visit removes Save/Reset from every config page.
 *
 * Deleting such sheets on navigation is not the answer: a stylesheet only returns if its injector
 * runs again, and a library importing CSS at module eval never does (the module is cached for the
 * life of the document). ACE's 14 KB editor sheet is imported once, and after a sweep its editor
 * came back as a black rectangle two million pixels tall. Deletion is silently one-way.
 *
 * So: a sheet matching only its own app's widgets is inert elsewhere and is left alone. One
 * reaching into the widget universe the THEME styles can repaint any page, which spends the
 * document — the router then refuses to hand it to another view and falls back to a real page load,
 * trading speed and never correctness (fs-router.js owns that refusal; this module answers the
 * question).
 *
 * `invasiveSheet()` is that test, and its universe is read back from cascade.css itself rather than
 * from a hand-written list, so it tracks the theme; 0.3 ms per nav. Exempt: anything the server
 * marked `[data-fs-shell]` (partials/head.ut) and anything inside `#view`, which dies with the
 * content swap. LuCI core injects no <style> at runtime (checked: luci.js, ui.js, cbi.js). If
 * cascade.css cannot be read, every view sheet counts as invasive: fail to the slow path, never
 * the broken one. */
let _themeNames = null;

/* What counts as a NAME — a class or an id — in a selector: the vocabulary the invasive-sheet test
 * is written in. One copy, because widening it in the harvester alone puts names into `names` that
 * pinnedToApp() can never match, and a selector that does reach the chrome then reads as pinned and
 * is left unfenced.
 *
 * Shared safely because every use is String.match(): a /g regex is stateful under .test(), while
 * [Symbol.match] resets lastIndex first. Do not call .test() on this one. */
const NAME_RE = /[.#][A-Za-z_][\w-]*/g;

/* ---- a quoted value is data, and every scanner below would otherwise read it as syntax ----
 *
 * `[title="a,b"]` is one selector part carrying a comma, `[href*="("]` one attribute carrying an
 * unbalanced paren, `[data-x=".foo"]` names no class at all. Read literally each scanner gets a
 * different wrong answer: selectorParts() splits the part in two and the tail reads as unpinned,
 * fenceRules() rejoins it as `[title="a, b"]` and silently rewrites the app's own selector, and
 * stripPseudoArgs() drives `depth` into a hole and eats the rest of the selector.
 *
 * One masker answers it for all three. It replaces the CONTENT of every quoted string with spaces,
 * length-preserving 1:1, so a scanner can read the mask and still slice the ORIGINAL — the fence
 * must write back the app's own bytes. An escape and the character it escapes are both content, so
 * `\"` cannot close the string. */
function maskStrings(text) {
	let out = '', q = null;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (q === null) {
			out += ch;
			if (ch === '"' || ch === '\'') q = ch;
			continue;
		}
		if (ch === '\\') {
			out += ' ';
			if (i + 1 < text.length) { out += ' '; i++; }
			continue;
		}
		out += (ch === q) ? ch : ' ';
		if (ch === q) q = null;
	}
	return out;
}

/* a re-hosted <style>'s text is no longer what its app wrote, and dedupeViewSheets keys on the
 * original — otherwise the app's next identical copy stops looking like a duplicate */
const origText = new WeakMap();

function themeNames() {
	if (_themeNames) return _themeNames;
	const names = new Set();	/* every class and id the theme styles */
	const props = new Set();	/* every custom property it declares or reads */
	const walk = (rules) => {
		for (const r of rules) {
			/* masked like every other read of a selector: a `.foo` inside one of OUR quoted values
			 * would enter `names` as a name we style, and pinnedToApp() masks, so it could never
			 * match — see NAME_RE */
			if (r.selectorText)
				(maskStrings(r.selectorText).match(NAME_RE) || []).forEach((n) => names.add(n));
			if (r.cssText)
				(r.cssText.match(/--[A-Za-z_][\w-]*/g) || []).forEach((p) => props.add(p));
			if (r.cssRules) walk(r.cssRules);
		}
	};
	for (const ss of document.styleSheets) {
		if (!ss.href || !(/\/cascade\.css/).test(ss.href)) continue;
		try { walk(ss.cssRules); } catch (e) { return null; }
	}
	_themeNames = names.size ? { names, props } : null;
	return _themeNames;
}

/* Is this selector part held inside the app's OWN markup by a name the theme does not know?
 * `#cbi-podkop-section > .cbi-section-remove` is — podkop's section must exist for it to match, so
 * it can reach neither another page nor our chrome. A part made entirely of names the theme knows
 * (`*`, `.nav`, `ul.nav > li > a`) has nothing pinning it anywhere.
 *
 * Functional pseudo-class arguments are stripped before looking for the pin, which is the whole
 * difference between podkop and the file manager: `.cbi-button-save:not(.custom-save-button)` names
 * an app class inside a NEGATION, so it excludes the app's markup rather than requiring it.
 *
 * Shared by invasiveSheet() and fenceRules(), which must agree by construction: a part able to
 * reach another page is exactly a part able to reach the chrome. */
/* Split a selector list on its TOP-LEVEL commas. `String.split(',')` cannot: `:not(.a, .b)` is one
 * part carrying a comma, and both halves then reach pinnedToApp() as garbage — the tail keeps a
 * visible app name, so the file manager's motivating rule reads as pinned and is neither judged nor
 * fenced.
 *
 * Scans the mask and slices the original (see maskStrings): a comma inside `[title="a,b"]` is a
 * character in a value, and fenceRules() joins the parts straight back into selectorText. */
function selectorParts(text) {
	const scan = maskStrings(text);
	const out = [];
	let depth = 0, start = 0;
	for (let i = 0; i < scan.length; i++) {
		const ch = scan[i];
		if (ch === '(') depth++;
		else if (ch === ')') depth--;
		else if (ch === ',' && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
	}
	out.push(text.slice(start).trim());
	return out.filter(Boolean);
}

/* Drop every functional pseudo-class argument, nesting included. A regex cannot: stopping at the
 * first `)` leaves `:not(:is(.app))` as a stray paren plus a `.app` that looks like a pin.
 *
 * Works on the mask, so a paren inside `[href*="("]` cannot drive `depth` into a hole and a `.foo`
 * inside an attribute value cannot read as the app's own pin. The output is read by NAME_RE and
 * never written back to the CSSOM. */
function stripPseudoArgs(part) {
	const scan = maskStrings(part);
	let out = '', depth = 0;
	for (let i = 0; i < scan.length; i++) {
		const ch = scan[i];
		if (ch === '(' ) { depth++; if (depth === 1) { out += ' '; continue; } }
		if (ch === ')') { depth--; continue; }
		if (!depth) out += ch;
	}
	return out;
}

function pinnedToApp(part, names) {
	return (stripPseudoArgs(part).match(NAME_RE) || []).some((n) => !names.has(n));
}

/* A rule with a bare selector (`:root`, `pre`, `*`) cannot touch us if none of its DECLARATIONS
 * can: a custom property this theme never reads is inert wherever it lands, which is the difference
 * between an app costing a full page load and not.
 *
 * Still invasive: any standard property on a bare selector (`:root { color-scheme: light dark }`
 * re-points every UA widget at the OS preference), and any custom property the theme reads — the
 * private `--fs-*` tier exists so an app writing `--accent` on `:root` cannot repaint us. */
function inertDeclarations(rule, props) {
	const st = rule.style;
	if (!st || !st.length) return false;	/* no declarations to judge -> judge by selector */
	for (let i = 0; i < st.length; i++) {
		const p = st.item(i);
		if (p.slice(0, 2) !== '--') return false;	/* a real property: it paints something */
		if (props.has(p)) return false;			/* a custom property the theme itself reads */
	}
	return true;
}

/* ---- the verdict is a property of the sheet, taken BEFORE we rewrite it ----
 *
 * An invasive verdict is sticky, and must be: once rehostIntoThemeLayer() fences a sheet, what
 * stands in the DOM is no longer the CSS its app wrote, and re-judging our own edit answers a
 * different question.
 *
 * Only `true` is kept. A clean sheet can still grow hostile rules — an app building its CSS with
 * insertRule() has an empty sheet the first time we look — so a clean verdict stays provisional. */
const _invasive = new WeakSet();

function invasiveSheet(el, universe) {
	if (_invasive.has(el)) return true;
	const v = judgeSheet(el, universe);
	/* Cache only a verdict we could actually read. A <link> has no .sheet until its bytes land, so
	 * judgeSheet's "unreadable -> invasive" default fires for every linked app stylesheet the
	 * instant the observer sees it; remembering that turns a benign sheet into a permanently spent
	 * document and every navigation from that page into a full load.
	 *
	 * Re-taking is safe and does not break the rule above, because the cases do not overlap: a
	 * <style> in the document always has a sheet, so its verdict is cached when taken, and a <link>
	 * is never edited (the element is disabled and the href re-imported), so a later read still sees
	 * the app's untouched CSS.
	 *
	 * The conservative half is preserved: `v` is returned as taken, so an unreadable sheet is still
	 * fenced on sight. Only the memory is dropped. */
	let readable;
	try { readable = !!el.sheet; } catch (e) { readable = false; }
	if (v && readable) _invasive.add(el);
	return v;
}

/* true when this sheet can repaint a page that is not its own. A sheet that is not readable —
 * still loading, 404, cross-origin — is invasive by default: unknown CSS takes the slow path,
 * never the broken one. */
function judgeSheet(el, universe) {
	let sheet;
	try { sheet = el.sheet; } catch (e) { return true; }
	if (!sheet) return true;

	const { names, props } = universe;
	let invasive = false;
	const walk = (rules) => {
		for (const r of rules) {
			if (invasive) return;
			if (r.selectorText) {
				/* One question, the same one fenceRules() asks: is this part pinned inside the
				 * app's own markup? A part with no such pin matches the same widgets everywhere,
				 * and that is what invasive means.
				 *
				 * Do not ask "does it name anything the theme styles?" first: a pin is a name the
				 * theme does NOT know, so "names nothing of ours" reads as pinned when it often
				 * means the opposite — `*:not(#zzz)` and `[class]` are both unpinned and both match
				 * the whole document, and the sheet was judged clean while flattening 95 of 338
				 * chrome elements. */
				for (const p of selectorParts(r.selectorText)) {
					if (pinnedToApp(p, names)) continue;
					/* Unpinned, but it may still be unable to touch us: a rule whose every
					 * declaration is a custom property this theme never reads is inert wherever it
					 * lands (`:root { --app-temp-status-temp: … }`). */
					if (inertDeclarations(r, props)) continue;
					invasive = true;
					return;
				}
			}
			if (r.cssRules) walk(r.cssRules);
			/* an @import's rules are not r.cssRules — follow it, or the verdict is blind to every
			 * rule behind it, including our own re-hosting shim. An unreadable import is invasive,
			 * like any sheet we cannot read. */
			if (r.styleSheet) {
				let imported;
				try { imported = r.styleSheet.cssRules; } catch (e) { invasive = true; return; }
				if (imported) walk(imported);
			}
		}
	};
	try { walk(sheet.cssRules); } catch (e) { return true; }
	return invasive;
}

/* Both element kinds count: `luci-app-banip` and `luci-app-adblock` append a <link> to <head> at
 * module eval styling stock widgets, unlayered, on every page. A <link> inside the view tree needs
 * no handling — it dies with the swap. */
const VIEW_SHEETS = 'style:not([data-fs-shell]), link[rel~="stylesheet"]:not([data-fs-shell])';

/* Does this sheet outlive the page it arrived with? Everything this module decides hangs off that,
 * and the answer is where the element sits: a sheet inside the view tree dies with the swap, so it
 * can neither poison the next page, nor need scoping, nor be a duplicate worth removing. Named
 * because `!el.closest('#view')` states where an element is, not what follows from it. */
function outlivesPage(el) {
	return !el.closest('#view');
}

/* Is `path` — a menu.d node's `css` — already carried by this document in a form that SURVIVES a
 * swap? The router asks before committing a client navigation, since only a server render emits
 * that <link> and a page whose stylesheet is missing must arrive by full load (fs-router.js). A
 * link inside #view does not count: it is about to be deleted with the view.
 *
 * Whole path, never a suffix. head.ut prints `{{ resource }}/{{ dispatched.css }}?v=…` from the
 * same base value the runtime holds, so the server's href is reconstructable rather than guessable
 * — only the cache key comes off. A suffix match would let a third-party node declaring
 * `"css": "custom.css"` read as already-carried on the strength of `luci-app-adblock`'s own
 * custom.css, and the router would swap into a page whose stylesheet was never linked.
 *
 * Equality also fails in the direction that only costs speed: L.path() drops a path containing
 * characters it does not allow (no `+ ~ ( ) @ ! ' $ &`, nothing non-ASCII), while head.ut
 * interpolates `css` raw, so such a node's `want` collapses to the bare base, matches nothing, and
 * every entry into that page is a full load. No in-tree node sets `css`, so the shape is
 * third-party only. */
function documentCarries(path) {
	const want = L.resource(String(path));
	for (const link of document.querySelectorAll('link[rel~="stylesheet"][href]')) {
		if (!outlivesPage(link))
			continue;
		if ((link.getAttribute('href') || '').split('?')[0] === want)
			return true;
	}
	return false;
}

/* An invasive sheet we OWN is contained: scopeToCurrentPage() darkens it the moment the router
 * stamps the new page. One we could not attribute (an @import at the top, a sheet built with
 * insertRule(), anything unreadable) still spends the document, which is the conservative half.
 *
 * A SILENCED sheet is contained too. Re-hosting a <link> owns the @import shim and silences the
 * original for good, but the original stays in the document and a disabled sheet still answers
 * `cssRules` — counting it would re-judge it invasive on every ask, owned by nobody, and turn the
 * SPA router off for the life of the document on exactly the apps this module was written for.
 *
 * Sound because `el.sheet.disabled = true` is what decides whether CSS paints (see silence()) and
 * nothing re-enables it: scopeToCurrentPage() only touches sheets in `_owner`, and the silenced
 * original is deliberately not one. */
function documentPoisoned() {
	const names = themeNames();
	return Array.prototype.some.call(
		document.querySelectorAll(VIEW_SHEETS),
		(el) => outlivesPage(el)
			&& (!names || (invasiveSheet(el, names) && !_owner.has(el) && !_silenced.has(el))));
}

/* ---- an invasive sheet still has to render ITS page: re-host it into the theme layer ----
 *
 * documentPoisoned() saves every page after this one; it cannot save this one, where the sheet is
 * already applying. Every footstrap rule lives in a @layer and an unlayered normal declaration
 * beats a layered one at any specificity, so a third-party `* { margin: 0; padding: 0 }` owns the
 * chrome outright — on a layer-less theme the same `*` (0,0,0) loses to any class selector. The
 * layers are what hand it the win (issue #8).
 *
 * So put the sheet back on specificity footing by re-hosting it into the EXISTING `theme` layer;
 * only same-layer arbitrates by specificity. Measured on the real cascade:
 *
 *   app unlayered (today)        chrome BROKEN   app's own design OK
 *   app -> @layer theme          chrome OK       app's own design OK
 *   app -> @layer before theme   chrome OK       app's own design BROKEN
 *
 * Do not take the third shape: the theme would then beat the app at any specificity, including the
 * rules the app aims at its own page (openclash's `#tab-header ul.cbi-tabmenu li` against our
 * `ul.cbi-tabmenu li`). In `theme` the app keeps them and `*` still loses to the chrome's 0,3,1. No
 * new layer is declared — a re-opened `@layer theme` block appends to the one 00-header.css names.
 *
 * This deliberately does not fix `base`: the app must outrank `theme` for its own page to work, so
 * it sits above `base` and `*` still wipes base's widget padding. An unlayered `*` beats base
 * today too, and the only way out would re-break the app.
 *
 * Never delete the sheet instead. Re-hosting moves where a rule lands in the cascade and every rule
 * still exists, so a library's "did I already import this?" check still finds its sheet; a <link>
 * is disabled rather than removed, so an app that looks its own <link> up by href still finds it. */
/* ---- the fence: the chrome is ours, so make a foreign rule unable to MATCH it ----
 *
 * Re-hosting settles a fight on specificity but not one against `!important`, which ranks above
 * layers. The only pure-CSS answer to a foreign flag is our own flag in an earlier layer — ~550 of
 * them, and the `color`/`background` ones would beat this theme's own forced-colors block.
 *
 * So do not out-rank the rule: put the chrome where it cannot be addressed. Appending
 * `:where(:not([data-fs-chrome], [data-fs-chrome] *))` to a foreign selector's subject leaves it
 * matching everything except us, and `!important` has nothing left to win.
 *
 * The chrome is not one element, so the fence names no element: naming `.fs-sidebar` left the skip
 * link and the search overlay exposed while every test said the chrome was defended. With
 * `data-fs-chrome` an element declares that it is ours where it is written, and the fence and the
 * pin follow. `npm run chrome-fence` holds the three together.
 *
 * `:where()` is load-bearing: it contributes zero specificity, so the app's rules keep their exact
 * weight against each other and against the theme on its own page. A plain `:not(.fs-sidebar)`
 * takes its argument's specificity and would re-order the app's stylesheet against itself.
 *
 * Only unpinned parts are fenced: a pinned part cannot reach the chrome anyway.
 *
 * Two silent traps, both of which cost the app its rule:
 *  - a selector LIST must be fenced part by part; appending to the whole `selectorText` fences only
 *    the last part, leaving `*, ul` as `*, ul:where(…)`;
 *  - a pseudo-element must stay last — `a::after` plus a tail append serialises to
 *    `a::after:where()`, the argument silently eaten, matching nothing, and the setter reports
 *    success. The fence goes before it: `a:where(…)::after`. */
const CHROME_FENCE = ':where(:not([data-fs-chrome],[data-fs-chrome] *))';

function fenceSelector(part) {
	/* The getter always normalises a pseudo-element to `::`, legacy `:before` included. The split
	 * point is found on the mask and sliced out of the original, because `::` is legal inside a
	 * quoted attribute value (an IPv6 literal): read raw, the fence lands inside the quotes and the
	 * app's rule comes back matching a value it never wrote, as valid CSS the setter accepts. */
	const i = maskStrings(part).indexOf('::');
	return i < 0 ? part + CHROME_FENCE : part.slice(0, i) + CHROME_FENCE + part.slice(i);
}

function fenceRules(rules, names) {
	for (const r of rules) {
		if (r.selectorText) {
			const parts = selectorParts(r.selectorText);
			if (parts.length && parts.some((p) => !pinnedToApp(p, names))) {
				/* the setter parses the whole selector and, on one it cannot parse, does nothing
				 * and does not throw, so a failure leaves the rule unfenced rather than
				 * half-written */
				try {
					r.selectorText = parts
						.map((p) => (pinnedToApp(p, names) ? p : fenceSelector(p))).join(', ');
				} catch (e) { /* left unfenced on purpose: the app keeps its rule */ }
			}
		}
		if (r.cssRules) fenceRules(r.cssRules, names);
	}
}

/* An @import's rules live in a separately fetched sheet, so they are not there when the shim is
 * inserted: retry until they are, then fence. A sheet that never becomes readable stays unfenced,
 * which is where we already were.
 *
 * The bound is a deadline in ms, not a frame count — 60 frames is 1 s at 60 Hz and 2 s on a 30 Hz
 * panel, so the budget would move with the display. Frames remain the retry tick, since a cache hit
 * lands on the first one. */
function fenceImported(styleEl, names, until) {
	/* no initialiser: every path below assigns, so `= null` would be a dead store
	 * (no-useless-assignment) */
	let rules;
	try {
		const first = styleEl.sheet && styleEl.sheet.cssRules[0];
		rules = first && first.styleSheet && first.styleSheet.cssRules;
	} catch (e) { rules = null; }
	if (rules) { fenceRules(rules, names); return; }
	if (Date.now() < until) { requestAnimationFrame(() => fenceImported(styleEl, names, until)); return; }
	/* Giving up is reportable: the irreversible half already happened — the app's original is
	 * silenced and the shim owns the page — so a fence that never lands leaves the app's rules
	 * reaching the chrome while every later pass skips the sheet as handled. rAF does not fire in a
	 * background tab, so a page opened in one can pass the deadline without a single retry. */
	console.error('footstrap: could not read the re-hosted @import within the deadline — the sheet '
		+ 'stays unfenced and may repaint the chrome on this page.', styleEl);
}

/* what a sheet IS, as text: the rules that are applying, not the markup that may have produced
 * them. Serialised only to compare, never re-parsed. */
const serializeRules = (rules) => Array.prototype.map.call(rules, (r) => r.cssText).join('\n');

/* ---- a <style>'s textContent is NOT its sheet ----
 *
 * Wrapping re-sets textContent, which re-parses, and whatever the parse does not reproduce is
 * deleted — by the one fix in this file whose thesis is that deleting a view's CSS is one-way. Two
 * shapes where the text does not describe the sheet: a <style> filled by insertRule() (the text is
 * empty while the rules apply, so the wrap writes `@layer theme {}` over a live sheet), and one
 * carrying @import (invalid inside @layer, so the wrapped copy comes back without it).
 *
 * So ask the exact question — does re-parsing this text give back the sheet that is applying? —
 * rather than enumerate the shapes, which is what missed insertRule(). The probe is a constructible
 * sheet: never adopted, so nothing paints and no observer sees it. It also drops @import per spec,
 * so that case needs no test of its own.
 *
 * No probe means no answer, and the honest answer to "may I re-parse this?" is then no: the sheet
 * keeps every rule and the fence still holds the chrome without the wrap. */
let _probe = null;
function textIsSheet(el, live) {
	try {
		if (!_probe) _probe = new CSSStyleSheet();
		_probe.replaceSync(el.textContent);
		return serializeRules(_probe.cssRules) === serializeRules(live);
	} catch (e) { return false; }
}

/* Sheets taken out of the cascade for good — the re-hosted <link> originals. Remembered because a
 * silenced sheet is still an element that answers `cssRules`, so every later ask re-judges it
 * invasive; see documentPoisoned(). */
const _silenced = new WeakSet();

/* Take a re-hosted <link> out of the cascade, and mean it.
 *
 * `el.disabled = true` alone does not: the IDL attribute forwards to the ELEMENT's flag, while
 * `el.sheet.disabled` is what decides whether the CSS paints — and a <link> that is still loading
 * has no `.sheet` for the assignment to reach. Every runtime injection is in that state when the
 * observer hands it here, so the sheet comes up enabled when the bytes arrive and the app's
 * original, unfenced CSS paints beside the fenced shim (95 of 338 chrome elements flattened). */
function silence(el) {
	_silenced.add(el);
	setEnabled(el, false);
}

/* ---- page ownership: contain an invasive sheet instead of spending the document ----
 *
 * A foreign sheet is injected by ONE page and has no business painting any other. Treating every
 * invasive sheet as spending the document is correct but is paid by ordinary pages: stock
 * `luci-app-filemanager` lands two <style>s in <head>, both invasive on their bare selectors, and
 * `luci-app-ssclash` adds four more as the Ace editor initialises. With ownership, leaving either
 * page stays an in-place SPA navigation (medians 24 ms and 27 ms) instead of a full load.
 *
 * Removing the sheet on the way out is the obvious fix and the wrong one: an append at module top
 * level happens once, because `L.require` caches the module, so a second visit renders unstyled.
 * Disabling is reversible, which is the whole difference.
 *
 * Owner = the page in `body[data-page]` when the sheet was re-hosted. fs-router's navigate() stamps
 * data-page BEFORE it require()s the view class, so when a view module evaluates and appends its
 * <style> the attribute already names its page; on a full load the server stamped it.
 *
 * Recorded on the element that PAINTS, never on the permanently silenced one: for a <link> that is
 * the @import shim, and re-enabling the original would undo silence() and put the app's unfenced
 * CSS back over the chrome.
 *
 * The owner is the APP, not the page: an app whose pages share one injected <style> would have it
 * owned by whichever page loaded first and arrive dark on the others. `admin/<group>/<app>` — the
 * first three dispatch segments — is the smallest key that keeps an app's own pages together while
 * still blocking the leak onto other apps and onto stock pages.
 *
 * Segments, never the dash-joined `data-page`: a dispatch segment may contain a dash
 * (`admin/system/package-manager`), so splitting the attribute on '-' would cut inside a name. */
const _owner = new WeakMap();
const APP_DEPTH = 3;

/* the router hands this over on every navigation; until it does — the initial full load — ask the
 * server which page it dispatched to */
let _curKey = null;

function appKey(segs) {
	return (segs || []).slice(0, APP_DEPTH).join('/');
}

/* ---- the URL is not the page ----
 *
 * `L.env.dispatchpath` is the leaf the SERVER resolved this request to, while the address bar holds
 * what was asked for: LuCI's dispatcher walks a node down to its firstchild without rewriting the
 * URL, so `/cgi-bin/luci/admin/status` and `/cgi-bin/luci/` both dispatch to
 * `admin/status/overview`. Keyed on the URL, the first SPA navigation away disables the sheets that
 * page owns — and the app's original <link> is already silenced for good, so nothing paints them
 * again for the life of the document. */
/* Who a sheet injected right now belongs to, when that is not the page the chrome is showing.
 *
 * A require in flight cannot be stopped: click a page whose module injects CSS, click away before
 * it lands, and the <style> appears after the router has stamped data-page for the page that
 * superseded it. Credited to currentKey() it is bound to the wrong page for the life of the
 * document — disabled on its own page and enabled on one it has no business painting. So the router
 * names the owner for the duration of such a require (fs-router.js), and this is that hint.
 *
 * One slot, stamped with the navigation that set it. The router only names an owner for a require
 * that has yet to evaluate its module. Two cold requires can still overlap, and then the newer one
 * wins the slot — it is the page the user is looking at, and crediting its sheet to the superseded
 * page would leave the visible page unpainted. The generation stamp keeps the older require's
 * `.finally` from clearing a slot the newer one now holds.
 *
 * Nothing better is available: LuCI evaluates a view module inside `eval()` in its own require(),
 * so nothing observable says which module is running when a <style> appears. The remaining hole is
 * two cold requires overlapping. */
let _ownerHint = null;
let _ownerGen = -1;
function attributeTo(segs, gen) {
	/* a stale require letting go of a slot somebody else now holds: leave it alone */
	if (segs == null && gen !== _ownerGen) return;
	_ownerHint = (segs == null) ? null : appKey(segs);
	_ownerGen = (segs == null) ? -1 : gen;
}

function ownerKey() {
	return (_ownerHint !== null) ? _ownerHint : currentKey();
}

function currentKey() {
	if (_curKey !== null) return _curKey;
	const dp = L.env && L.env.dispatchpath;
	if (dp && dp.length) return appKey(dp);
	/* no env to read (a document that never got the bootstrap): the URL is all there is */
	const p = location.pathname.replace(/^.*\/cgi-bin\/luci\/?/, '').replace(/\/+$/, '');
	return appKey(p ? p.split('/') : []);
}

/* Both halves, for the reason silence() gives: el.disabled is the element's flag, el.sheet.disabled
 * decides whether the CSS paints, and a still-loading <link> has no .sheet for the assignment to
 * reach — so a switch-off re-asserts once the bytes arrive. `once`, because the element is marked
 * fsLayered by then and a sheet that never loads has nothing to silence. */
function setEnabled(el, on) {
	el.disabled = !on;
	if (el.sheet) el.sheet.disabled = !on;
	else if (!on) el.addEventListener('load', () => { if (el.sheet) el.sheet.disabled = true; }, { once: true });
}

/* Called by the router right after it stamps data-page, with the RESOLVED segments. Only sheets we
 * own are touched: a clean sheet is harmless, and an invasive one we could not attribute still
 * poisons the document and keeps the full-load path rather than being disabled on its own page.
 *
 * `keep` is the page still ON SCREEN. A client navigation has a window in which two pages are real
 * — the incoming one renders into a hidden stage while the outgoing one is still being read — and
 * scoping is needed before that staged render, since a view must not measure itself through a sheet
 * that does not own its page. Doing both halves then would strip the outgoing page's stylesheet off
 * content the user is looking at, so the router calls this twice: with `keep` before the staged
 * render, and with nothing at the swap. */
function scopeToCurrentPage(segs, keep) {
	if (segs) _curKey = appKey(segs);
	const key = currentKey();
	const spared = (keep && keep.length) ? appKey(keep) : null;
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (!outlivesPage(el) || !_owner.has(el)) return;
		const owner = _owner.get(el);
		if (spared !== null && owner === spared && owner !== key) return;
		setEnabled(el, owner === key);
	});
}

/* Take a sheet and scope it in the same breath. scopeToCurrentPage() runs on NAVIGATION, so it
 * only sees sheets that were already here; one arriving afterwards is scoped by nobody until the
 * next click — which is exactly the cold-require case the owner hint exists for, where the sheet
 * paints a page it does not belong to in the meantime.
 *
 * `ownerKey()` is the page the sheet belongs to and `currentKey()` the page on screen; on every
 * ordinary arrival they are the same string and this is a no-op. */
function claimOwner(el) {
	const key = ownerKey();
	_owner.set(el, key);
	if (outlivesPage(el)) setEnabled(el, key === currentKey());
}

function rehostIntoThemeLayer(el, universe) {
	if (el.dataset.fsLayered) return;

	if (el.tagName === 'LINK') {
		/* a <link>'s rules cannot be moved into a layer in place, but an @import can name one; the
		 * href is absolute and same-origin, so the re-fetch is a cache hit */
		const s = document.createElement('style');
		s.dataset.fsLayered = '1';
		s.textContent = '@import url("' + el.href.replace(/["\\]/g, '\\$&') + '") layer(theme);';
		el.dataset.fsLayered = '1';
		el.after(s);		/* keep source order: ties inside the layer still resolve as they did */
		silence(el);
		claimOwner(s);
		fenceImported(s, universe.names, Date.now() + 1000);	/* a cache hit lands on the first frame */
		return;
	}

	let rules;
	try { rules = el.sheet && el.sheet.cssRules; } catch (e) { return; }
	/* No rules yet: nothing to re-host, nothing to fence and nothing to MARK. An app that appends an
	 * empty <style> and fills it with insertRule() arrives here first, and marking it handled would
	 * leave the sheet it is about to build unfenced for the life of the document. */
	if (!rules || !rules.length) return;

	/* Handled, and never twice: fenceRules() is not idempotent, because pinnedToApp() strips a
	 * functional pseudo-class before looking for the app's name, so an already-fenced selector reads
	 * as unpinned again and a second pass appends a second fence. */
	el.dataset.fsLayered = '1';

	/* Wrap only if the text still IS the sheet (textIsSheet). When it is not, the sheet stays
	 * unlayered rather than lose rules, and is still fenced below — the fence is pure CSSOM, needs
	 * no re-parse, and is the half that answers `!important` anyway.
	 *
	 * Layer by text, fence by CSSOM, in that order: re-setting textContent re-parses and would throw
	 * away any selector already rewritten. A <style>'s url()s resolve against the document either
	 * way, which is not true of a <link> — cssText serialises `url("img.png")` still relative, so
	 * inlining a linked sheet would re-base every image and font in it. */
	if (textIsSheet(el, rules)) {
		origText.set(el, el.textContent);	/* dedupeViewSheets keys on this — see there */
		el.textContent = '@layer theme {\n' + el.textContent + '\n}';
	}
	try { if (el.sheet) fenceRules(el.sheet.cssRules, universe.names); } catch (e) { /* unfenced, not broken */ }
	/* Last, because the line above may have re-parsed the sheet: assigning textContent throws the
	 * old CSSStyleSheet away and the new one comes back ENABLED, so claiming before the wrap
	 * switches a sheet off and back on within the same call. ownerKey() is read here either way,
	 * while the router's hint still names the page whose module is evaluating. */
	claimOwner(el);	/* a <style> is re-hosted IN PLACE, so it paints itself */
}

/* Re-hosting needs the theme's own selectors to tell an invasive sheet from an inert one, so if
 * cascade.css cannot be read, re-host nothing: documentPoisoned() already fails every sheet to the
 * slow path, and demoting an app we could not judge is the one move with no way back. */
function rehostInvasiveSheets() {
	const universe = themeNames();		/* {names, props} — NOT a bare Set; the fence wants .names */
	if (!universe) return;
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (el.dataset.fsLayered) return;
		/* A sheet with no rules yet is not an innocent sheet: `insertRule()` produces no mutation
		 * record, so an app that appends an empty <style> and fills it later is judged empty here
		 * and never looked at again — measured, a `* { padding: 0 !important }` built that way
		 * flattened the chrome and stayed unfenced for the life of the document. One deferred look
		 * per such element is enough, and costs nothing where a <style> arrives with its rules
		 * already in it. */
		let rules = null;
		try { rules = el.sheet && el.sheet.cssRules; } catch (e) { /* cross-origin: judged below */ }
		if (rules && !rules.length && !el.__fsRecheck) {
			el.__fsRecheck = true;
			window.setTimeout(() => {
				let now;
				try { now = el.isConnected && el.sheet && el.sheet.cssRules; } catch (e) { return; }
				if (now && now.length) rehostInvasiveSheets();
			}, 2000);
		}
		if (invasiveSheet(el, universe)) rehostIntoThemeLayer(el, universe);
	});
}

/* ---- the one thing that IS safe to remove: a byte-identical second copy ----
 *
 * Not deleting view CSS costs where an app injects on every render: `luci-app-podkop` injects 4 KB
 * from render() with no guard, `luci-app-mosdns` re-appends three CodeMirror <link>s, so every SPA
 * re-visit adds a copy that never stops being parsed. Dropping an exact duplicate cannot break
 * anyone, because the rules do not go away — the surviving copy is byte-identical, so a library's
 * "have I already imported this?" check still finds its sheet. Keep the FIRST copy: it is what any
 * handle the app kept points at.
 *
 * Key a <style> on what its APP wrote, not on what stands in the DOM: re-hosting rewrites the text,
 * so a wrapped first copy and the app's next identical injection would stop matching and the copies
 * would pile up again. A <link> keys on href, which re-hosting leaves alone.
 *
 * Re-hosting must therefore run BEFORE this: a re-hosted <link>'s shim is appended to <head>, which
 * is earlier in document order than a template's <link> in .fs-content, so "keep the first" would
 * keep the raw copy and strand the shim. Re-host first and both copies are equivalent by the time
 * they are compared. */
function sheetKey(el) {
	if (el.tagName === 'LINK') return 'LINK|' + el.href;
	const t = origText.get(el);
	if (t !== undefined) return 'STYLE|' + t;
	/* Not wrapped, so no original was kept — and the textContent may not BE the sheet (textIsSheet):
	 * every insertRule-built <style> has an empty one, so keying on the text gives them all the same
	 * key and removes the second as a "duplicate" of a sheet it shares nothing with. Key on what is
	 * applying instead. */
	let rules;
	try { rules = el.sheet && el.sheet.cssRules; } catch (e) { return null; }
	/* a sheet with no rules is a duplicate of nothing, and is very likely a <style> an app has
	 * appended but not yet filled: removing it strands the handle it will insertRule through */
	if (!rules || !rules.length) return null;
	return 'STYLE|' + serializeRules(rules);
}

function dedupeViewSheets() {
	const seen = new Set();
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (!outlivesPage(el)) return;
		const key = sheetKey(el);
		if (key === null) return;
		if (seen.has(key)) el.remove();
		else seen.add(key);
	});
}

/* ---- the layer order is a document-wide fact, and a sheet inserted first can rewrite it ----
 *
 * `@layer tokens, base, theme, page;` in 00-header.css is what makes theme beat base, and it holds
 * only while cascade.css is the FIRST sheet in the document to name a layer: the order is fixed by
 * first appearance, so an earlier sheet naming `theme` makes theme the weakest layer and inverts
 * the whole cascade — base's `* { padding: 0 }` then wins over the chrome's own rules.
 *
 * Re-hosting an app's sheet into `@layer theme` can cause exactly that, because where the app put
 * its <style> is the app's choice: Ace inserts its <style> as the FIRST CHILD of <head>, ahead of
 * cascade.css, and adds more of them on first hover.
 *
 * The repair is one declaration, and it works because inserting a NEW sheet re-runs the ordering
 * while moving an existing one does not (measured both ways): re-declare the canonical order from
 * a fresh <style> placed first in <head>. Cheap and idempotent, and the one other place that can
 * see the whole document, which is why the order is repeated here rather than derived. */
const LAYER_ORDER = '@layer tokens, base, theme, page;';
let _layerStmt = null;

function reassertLayerOrder() {
	const head = document.head;
	if (!head) return;
	/* the anchor is whichever of ours comes first — cascade.css, or the statement a previous pass
	 * put in front of it — since only a sheet ahead of that can have named a layer before we did */
	const own = [...document.querySelectorAll('link[rel~="stylesheet"]')]
		.find((l) => (/\/cascade\.css/).test(l.href || ''));
	if (!own) return;
	const anchor = _layerStmt && _layerStmt.isConnected ? _layerStmt : own;
	const ahead = [...document.querySelectorAll('style, link[rel~="stylesheet"]')]
		.some((el) => el !== anchor && el !== own &&
			(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING));
	if (!ahead) return;

	/* a fresh element every time: re-inserting the same node is a move, and a move does not re-run
	 * the ordering. Dropping the previous one keeps this at one spare <style> per document. */
	if (_layerStmt) _layerStmt.remove();
	_layerStmt = document.createElement('style');
	_layerStmt.textContent = LAYER_ORDER;
	head.insertBefore(_layerStmt, head.firstChild);
}

/* Watch <head> rather than deduping on navigation: an app injecting from render() resolves after
 * the router's require() callback, so a nav-time sweep leaves the document permanently carrying one
 * stale duplicate. The observer collapses the copy in the microtask it appears in, and cannot loop
 * — a removal produces a mutation with no added nodes and the handler bails.
 *
 * The immediate pass cannot be the observer's job: a legacy Lua page's <link> is in the SERVER's
 * HTML, parsed and applying before this module is fetched, so there is no mutation to observe. It
 * is re-hosted on the first pass instead, at the cost of a brief flash of unstyled chrome.
 *
 * <head>, deliberately not the whole document: LuCI's poll rewrites content on every tick and this
 * would fire on every tick. */
function watchViewSheets() {
	/* Dedupe on the immediate pass too, in the observer's order (re-host strictly first): a page
	 * whose server HTML prints the same <link> twice produces no mutation for the observer to see,
	 * so without this it carries both links and both @import shims for the life of the document —
	 * 117 KB of CSS parsed twice on luci-app-openclash's Overwrite Settings page. */
	rehostInvasiveSheets();
	dedupeViewSheets();
	reassertLayerOrder();	/* strictly after the re-host: it is the wrap that can invert the order */
	const mo = new MutationObserver((muts) => {
		for (const m of muts)
			for (const n of m.addedNodes)
				if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') {
					/* `continue`, not `return`: our own statement can share a batch with the sheet
					 * that made it necessary */
					if (n === _layerStmt) continue;
					rehostInvasiveSheets();	/* strictly before the dedupe — see there */
					dedupeViewSheets();
					reassertLayerOrder();
					return;
				}
	});
	mo.observe(document.head, { childList: true });
	/* …and <body>, because `document.head.appendChild` is a convention, not a rule: a <style>
	 * appended to <body> after chrome init is seen by nothing otherwise — the immediate pass has
	 * run and the mutation is not observed — and the page the user is ON stays broken.
	 *
	 * childList without subtree, as for <head>: this fires only for direct children of <body>, while
	 * LuCI's poll rewrites content inside #view, a descendant. */
	mo.observe(document.body, { childList: true });
}

return baseclass.extend({
	attributeTo,
	documentCarries,
	documentPoisoned,
	scopeToCurrentPage,
	watchViewSheets
});
