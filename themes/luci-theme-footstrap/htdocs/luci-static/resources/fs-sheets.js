'use strict';
'require baseclass';

/* ---- a view's injected CSS: never DELETE it; leave a poisoned document by a real load ----
 *
 * A view's <style> dies with the document on a full load; SPA nav never reloads, so it restyles
 * every page after. `luci-app-filemanager` injects `.cbi-button-apply, .cbi-button-reset,
 * .cbi-button-save:not(.custom-save-button) { display: none !important }` — unlayered + important,
 * outranking every cascade layer: one visit and Save/Reset are gone from every config page.
 *
 * But DELETING them on nav broke SSClash. A poller can be re-registered by re-rendering the view;
 * a stylesheet only returns if its injector runs AGAIN, and a library importing CSS at MODULE EVAL
 * never will (module cached for the life of the document). ACE's ace_editor.css (14 KB of
 * absolutely-positioned layers, gutter, line boxes) is imported once — after the sweep, navigating
 * back to its editor gave a black rectangle 2 007 346 px tall. Deletion was silently one-way.
 *
 * So: a sheet matching only its OWN app's widgets (`.ace_*`, `.cpu-status-view-mode-entry`) is
 * inert elsewhere — LEAVE it. One reaching into the widget universe the THEME styles
 * (`.cbi-button-save`, `pre`, `:root`) can repaint any page: that document is spent, so refuse to
 * hand it to another view and fall back to a REAL page load — speed traded, never correctness, and
 * the fresh document carries no view CSS, so SPA nav resumes right after. That refusal is the SPA
 * router's (fs-router.js) — this module only answers the question.
 *
 * `invasiveSheet()` is that test; its universe is read back from cascade.css itself (same-origin,
 * so `cssRules` is readable) rather than a hand-written list, so it tracks the theme. 0.3 ms per
 * nav. Exempt: anything the server marked `[data-fs-shell]` — the shell's own two links and two
 * styles, marked rather than guessed at (partials/head.ut) — and
 * anything inside `#view` (dies with the content swap); LuCI core injects no <style> at runtime at
 * all (checked: luci.js, ui.js, cbi.js). If cascade.css cannot be read, EVERY view sheet counts as
 * invasive: fail to the slow path, never the broken one. */
let _themeNames = null;

/* What counts as a NAME — a class or an id — in a selector. This is the vocabulary the whole zone
 * test is written in: themeNames() harvests the theme's names with it, pinnedToApp() looks for the
 * app's own name with it, and judgeSheet() asks whether a part names anything of ours with it. Three
 * copies of the pattern sat under a comment explaining that two copies of the JUDGEMENT would drift
 * into disagreeing — and a vocabulary that disagrees with itself is the same bug one level down: widen
 * it in the harvester alone and names enter `names` that the other two can never match, so a selector
 * that does reach the chrome reads as pinned and is left unfenced.
 *
 * Shared safely BECAUSE every use is String.match(): a /g regex is stateful under .test(), but
 * [Symbol.match] resets lastIndex first. Do not call .test() on this one. */
const NAME_RE = /[.#][A-Za-z_][\w-]*/g;

/* ---- A QUOTED VALUE IS DATA, AND EVERY SCANNER BELOW USED TO READ IT AS SYNTAX ----
 *
 * `[title="a,b"]` is ONE selector part carrying a comma; `[href*="("]` is one attribute carrying an
 * unbalanced paren; `[data-x=".foo"]` names no class at all. Read literally, each of the three
 * scanners in this file gets a different wrong answer out of the same string:
 *  - selectorParts() split `.app-row[title="a,b"]` into `.app-row[title="a` and `b"]`. The second
 *    half carries no class or id, so pinnedToApp() called it UNPINNED and judgeSheet() called the
 *    sheet invasive — documentPoisoned() then reported the document spent and the SPA fell back to a
 *    full load on every navigation for the life of the page, which is the exact failure the <link>
 *    caching bug above was written to end.
 *  - fenceRules() rejoins the parts with ', ', so that same rule came back as `[title="a, b"]` —
 *    the app's own selector silently rewritten to match a value it never asked for, by the setter
 *    reporting success. Deleting a rule is what this file exists to prevent; changing one is worse,
 *    because nothing looks wrong afterwards.
 *  - stripPseudoArgs() counts parens, so `[href*="("]` drove `depth` to 1 and never back: the whole
 *    remainder of the selector was eaten and a part pinned by the app's own id read as unpinned.
 *
 * One masker answers it for all three, so the vocabulary cannot disagree with itself the way the
 * comment above NAME_RE warns about. It replaces the CONTENT of every quoted string with spaces and
 * is length-preserving 1:1, which is what lets selectorParts() scan the mask and still slice the
 * ORIGINAL — the fence must write back the app's own bytes, not our reading of them. An escape and
 * the character it escapes are both content, so `\"` cannot close the string. */
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

/* a re-hosted <style>'s text is no longer what its app wrote — dedupeViewSheets keys on the
 * original, or the app's next identical copy stops looking like a duplicate (see there) */
const origText = new WeakMap();

function themeNames() {
	if (_themeNames) return _themeNames;
	const names = new Set();	/* every class and id the theme styles */
	const props = new Set();	/* every custom property it declares or reads */
	const walk = (rules) => {
		for (const r of rules) {
			/* masked like every other read of a selector: a `.foo` inside one of OUR quoted values
			 * would enter `names` as a name we style, and pinnedToApp() — which masks — could then
			 * never match it. That is the harvester-only widening NAME_RE's comment describes, and
			 * it ends with a foreign selector that does reach the chrome reading as pinned. */
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
 * `#cbi-podkop-section > .cbi-section-remove` is: podkop's section has to exist for it to match
 * anything, so it can never reach another page — or our chrome. A part made ENTIRELY of names the
 * theme knows (`*`, `.nav`, `#indicators`, `ul.nav > li > a`) has nothing pinning it anywhere.
 *
 * Functional pseudo-class arguments are stripped before looking for the pin, and that is the whole
 * difference between podkop and the file manager: `.cbi-button-save:not(.custom-save-button)` names
 * an app class too, but inside a NEGATION — it does not require the app's markup, it excludes it.
 *
 * Shared by invasiveSheet() (is this sheet dangerous?) and fenceRules() (which parts get fenced?) —
 * they must agree by construction: a part judged able to reach another page is exactly a part able
 * to reach the chrome. Two copies of this test would drift into disagreeing. */
/* Split a selector list on its TOP-LEVEL commas. `String.split(',')` cannot: `:not(.a, .b)` is one
 * part carrying a comma, and splitting it there hands both halves to pinnedToApp() as garbage —
 * `.cbi-button-save:not(.custom-save-button` keeps a visible app name (the argument regex needs a
 * closing paren to fire), so the file manager's own motivating rule reads as pinned and is neither
 * judged nor fenced. Measured on the router: `documentPoisoned()` said clean. `:not(a, b)` is
 * ordinary modern CSS, not an exotic.
 *
 * Scans the MASK and slices the ORIGINAL (see maskStrings): a comma inside `[title="a,b"]` is a
 * character in a value, not a separator — while the parts handed back must be the app's own bytes,
 * because fenceRules() joins them straight back into selectorText. */
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

/* Drop every functional pseudo-class ARGUMENT, nesting included. The old regex
 * (`/:[a-z-]+\([^)]*\)/g`) stops at the first `)`, so `:not(:is(.app))` left a stray `)` and, worse,
 * left `.app` looking like a pin.
 *
 * Works on the MASK, which does two things at once here: a paren inside `[href*="("]` no longer
 * drives `depth` into a hole it never comes back from, and the `.foo` in `[data-x=".foo"]` stops
 * looking like the app's own pin to pinnedToApp() — the only caller. Its output is read by NAME_RE
 * and never written back to the CSSOM, so masking the content away costs nothing. */
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

/* A rule with a bare SELECTOR (`:root`, `pre`, `*`) still cannot touch us if none of its
 * DECLARATIONS can: a custom property this theme never reads is inert. That is the difference
 * between an app costing a full page load and not — `luci-app-temp-status` opens with
 * `:root { --app-temp-status-temp: #147aff; … }`, and both it and the file manager's hex editor
 * would otherwise read as "document spent" on the strength of the selector alone.
 *
 * Still invasive: any STANDARD property on a bare selector (the stock file manager writes
 * `:root { color-scheme: light dark }`, re-pointing every UA widget at the OS preference), and any
 * custom property the THEME reads — the point of the private `--fs-*` tier is that an app writing
 * `--accent`/`--radius` on `:root` cannot repaint us, and this must keep it so for names we read. */
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

/* ---- the verdict is a property of the sheet, taken BEFORE we rewrite it -------------------
 *
 * An invasive verdict is STICKY, and it has to be: the moment rehostIntoThemeLayer() fences a sheet,
 * what stands in the DOM is no longer the CSS its app wrote, and re-judging our own edit answers a
 * different question than the one asked.
 *
 * It used to answer the right one BY ACCIDENT. The fence named a class (`.fs-sidebar`), so a fenced
 * selector still carried a name the theme styles, still tripped the `themeHit` test, and
 * documentPoisoned() went on reporting the document spent. Nothing said that was load-bearing —
 * moving the fence onto an attribute leaves no class name in the text, every fenced document would
 * have read CLEAN, and the SPA would have carried openclash's `*{padding:0!important}` into the next
 * page with the chrome fenced and the content flattened. Take the verdict once, keep it.
 *
 * Only `true` is kept. A clean sheet can still GROW hostile rules — an app that builds its CSS with
 * insertRule() has an EMPTY sheet the first time we look — so a clean verdict stays provisional and
 * is re-taken on every ask. */
const _invasive = new WeakSet();

function invasiveSheet(el, universe) {
	if (_invasive.has(el)) return true;
	const v = judgeSheet(el, universe);
	/* CACHE ONLY A VERDICT WE COULD ACTUALLY READ.
	 *
	 * A <link> has NO .sheet until its bytes land, and judgeSheet's "unreadable -> invasive" default
	 * therefore fires for EVERY linked app stylesheet at the instant <head>'s observer first sees
	 * it. Remembering that verdict is what turned a benign sheet into a permanently spent document:
	 * measured on the router, `luci-app-mwan3` ships ONE rule —
	 * `#mwan3-service-status > .alert-message { … }`, pinned to the app's own id, which this
	 * module's own judgement calls clean — and its <link> on the Overview left documentPoisoned()
	 * true for the life of the page, so every navigation FROM THE LANDING PAGE was a full load.
	 * Proven by serving those same bytes twice: as a <style> the document stayed clean, as a <link>
	 * it went poisoned. Nothing about the CSS decided it; only how it arrived.
	 *
	 * Safe to re-take, and the "never re-judge our own edit" rule above still holds, because the
	 * two cases do not overlap: rehostIntoThemeLayer() edits a <style>'s text and fences its rules
	 * — and a <style> in the document always HAS a sheet, so its verdict was cached when taken and
	 * is never re-taken. A <link> it never edits at all (it disables the element and re-imports the
	 * href into the theme layer), so a later read still sees the app's untouched CSS, which is the
	 * right question. A 404 or cross-origin sheet keeps answering `true` on every ask exactly as
	 * before — it simply is not remembered, which changes nothing.
	 *
	 * Conservative WHILE unreadable is preserved: `v` is still returned as taken, so a hostile
	 * sheet is fenced and re-hosted on sight and the document reads spent until the bytes prove
	 * otherwise. Only the memory is dropped. */
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
				/* ONE question, the SAME one fenceRules() asks: is this part held inside the app's
				 * own markup by a name the theme does not know? `#cbi-podkop-section >
				 * .cbi-section-remove` is — podkop's section has to exist for it to match anything,
				 * so it can never reach another page or our chrome. A part with no such pin matches
				 * the same widgets everywhere, and that is what invasive MEANS.
				 *
				 * This used to ask a second question first — "does it name anything the theme
				 * styles?" — and skip the part when the answer was no. That is the hole: a pin is a
				 * name the theme does NOT know, so "names nothing of ours" was read as "pinned" when
				 * it often means the exact opposite. Measured on the router, verdict CLEAN and 95 of
				 * 338 chrome elements flattened, by two selectors an app could write by accident:
				 *   *:not(#zzz) { padding: 0 !important }     ← the `#` is inside a NEGATION
				 *   [class]     { padding: 0 !important }     ← no class/id name at all
				 * Both are unpinned, both match the whole document. fenceRules() already keyed on
				 * pinnedToApp() alone and would have fenced them — it never got the chance, because
				 * the judge called the sheet clean and nothing was re-hosted. The comment above
				 * pinnedToApp() claims the two agree "by construction"; now they do. */
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
			 * rule behind it. Re-hosting a <link> produces exactly such a shim, and a sheet that
			 * judged its own shim inert would report a document clean while still carrying the
			 * poison into the next page. Unreadable (cross-origin) import: invasive, like any
			 * sheet we cannot read. */
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

/* Both element kinds count; the <link> half is not hypothetical: `luci-app-banip` and
 * `luci-app-adblock` append `<link rel=stylesheet href=…/custom.css>` to <head> at MODULE EVAL,
 * and it styles `.cbi-input-text`/`.cbi-input-select` — stock widgets, every page, unlayered. A
 * <link> INSIDE the view tree (`luci-app-nlbwmon`) needs no handling: it dies with the swap. */
const VIEW_SHEETS = 'style:not([data-fs-shell]), link[rel~="stylesheet"]:not([data-fs-shell])';

/* DOES THIS SHEET OUTLIVE THE PAGE IT ARRIVED WITH? Everything this module decides hangs off that
 * one question, and the answer is where the element sits: a <style>/<link> inside the view tree
 * dies with the swap (dom.content() replaces #view's children), so it can neither poison the next
 * page, nor need scoping to this one, nor be a duplicate worth removing. Only sheets outside it
 * are this module's business. Named because it is asked in four places and read wrong in none of
 * them only by luck: `!el.closest('#view')` states where an element is, not what follows from it. */
function outlivesPage(el) {
	return !el.closest('#view');
}

/* Is `path` — a menu.d node's `css`, i.e. a path under /luci-static/resources — already carried by
 * this document in a form that SURVIVES a swap?
 *
 * The router asks before committing a client navigation: only a server render emits that <link>, so
 * a page whose stylesheet is missing must arrive by full load (see fs-router.js). The question is
 * this module's because the answer is: a link inside #view is about to be deleted with the rest of
 * the view, and counting it would hand the router a sheet the next dom.content() throws away —
 * `luci-app-nlbwmon` returns E('link', …, L.resource('view/nlbw.css')) from render(), so that shape
 * is real.
 *
 * WHOLE PATH, NOT A SUFFIX. head.ut prints `{{ resource }}/{{ dispatched.css }}?v=…`, and the base in
 * that line is the SAME value the runtime holds: luci-base's own header.ut hands `resource` to
 * `new LuCI({…})`, and
 * `L.resource()` joins it back exactly, so the server's href is reconstructable rather than guessable
 * — only the cache key has to come off. A suffix match is what a guess costs: anchored at nothing but
 * a `/`, `custom.css` matches any sheet ending in that filename, and two in-tree apps append exactly
 * that to <head> at module eval — `luci-app-adblock` and `luci-app-banip` both add
 * `L.resource('view/<app>/custom.css')`, outside #view, so outlivesPage() keeps them and this module
 * disables rather than removes them: they stay for the life of the document. A third-party node
 * declaring `"css": "custom.css"` would then read as already-carried the moment the user had passed
 * through Adblock → Feeds, and the router would swap into a page whose stylesheet was never linked —
 * the one outcome the guard exists to prevent.
 *
 * Equality also keeps the failure safe, in the direction that costs only speed. L.path() keeps a part
 * only if it matches /^(?:[a-zA-Z0-9_.%,;-]+\/)*[a-zA-Z0-9_.%,;-]+$/ — no `+ ~ ( ) @ ! ' $ &`, nothing
 * non-ASCII, no leading `/` — and drops it otherwise, while head.ut interpolates `css` raw and uhttpd
 * serves those names without complaint. So a third-party `"css": "view/foo/style(dark).css"` does get
 * linked and rendered; `want` collapses to the bare base, matches no href, and every entry into that
 * page is a full load. A suffix compare covered those names, and losing them is what closing the false
 * positive above costs. No in-tree node sets `css` at all, so the shape is third-party only. */
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

/* An invasive sheet we OWN is contained — scopeToCurrentPage() darkens it the moment the router
 * stamps the new page, so it cannot reach the next page and the document is not spent. One we could
 * not attribute (not re-hostable, so never owned: an @import at the top, a sheet built with
 * insertRule(), anything unreadable) still spends it, which is the pre-existing behaviour and the
 * conservative half.
 *
 * A SILENCED sheet is contained too, and missing that undid the whole of the above for the <link>
 * half. Re-hosting a <link> owns the @import SHIM and silences the ORIGINAL for good (see
 * rehostIntoThemeLayer) — but the original stays in the document and a disabled sheet still answers
 * `cssRules`, so it re-judged as invasive on every ask, was owned by nobody, and this returned true
 * for the life of the document. Which means the very apps this module was written for
 * (`luci-app-banip`, `luci-app-adblock`, `luci-app-openclash` — all three inject a <link>) turned
 * the SPA router off entirely: a full page load on every navigation, from the moment such a page was
 * opened until the tab was closed. The <style> half never showed it, because a <style> is re-hosted
 * IN PLACE and therefore owned.
 *
 * Sound for the same reason ownership is: `el.sheet.disabled = true` is what decides whether CSS
 * paints (silence() explains why the element flag alone is not enough), and nothing re-enables it —
 * scopeToCurrentPage() only ever touches sheets in `_owner`, and the original is deliberately not
 * one. A sheet that paints nothing cannot poison the next page. */
function documentPoisoned() {
	const names = themeNames();
	return Array.prototype.some.call(
		document.querySelectorAll(VIEW_SHEETS),
		(el) => outlivesPage(el)
			&& (!names || (invasiveSheet(el, names) && !_owner.has(el) && !_silenced.has(el))));
}

/* ---- an invasive sheet still has to render ITS page: re-host it into the theme LAYER ----
 *
 * documentPoisoned() saves every page AFTER this one. It cannot save this one — the sheet is
 * already applying. Every footstrap rule lives in a @layer, and an UNLAYERED normal declaration
 * beats a layered one at any specificity, so a third-party reset owns the chrome outright:
 * `luci-app-openclash` ships `* { margin: 0; padding: 0 }` (a log.htm reset, leaked document-wide
 * by a <link> its Lua template prints into .fs-content). Measured on the router with those two
 * rules and nothing else: menu text flush at x=0 with the icons clipped, submenu indent gone, tabs
 * collapsed to a bare text row. On stock luci-theme-bootstrap — no layers — the same `*` (0,0,0)
 * loses to any class selector on specificity and nobody ever noticed. That asymmetry is the whole
 * bug, and it is ours: the layers are what handed a 0,0,0 selector the win (issue #8).
 *
 * So put the sheet back on specificity footing: re-host it into the EXISTING `theme` layer. Only
 * same-layer arbitrates by specificity — which is exactly what makes bootstrap survive. Measured,
 * all three placements, on the real cascade:
 *
 *   app unlayered (today)        chrome BROKEN   app's own design OK
 *   app -> @layer theme          chrome OK       app's own design OK
 *   app -> @layer before theme   chrome OK       app's own design BROKEN
 *
 * The tempting shape is the third — give the app its own layer under the theme. Do NOT: the theme
 * then beats the app at ANY specificity, including the rules it aims at its own page. OpenClash
 * restyles its tabs with `#tab-header ul.cbi-tabmenu li` (1,1,2) and footstrap styles
 * `ul.cbi-tabmenu li` (0,1,2) — demote the app and footstrap repaints the app author's own tabs.
 * In `theme` the app keeps them, and `*` still loses to the chrome's 0,3,1. No new layer is
 * declared; a re-opened `@layer theme` block appends to the one 00-header.css already names.
 *
 * What this deliberately does NOT fix: `base`. The app must outrank `theme` for its own page to
 * work, so it sits above `base`, and `*` still wipes base's widget padding (cssdiff: `input`
 * 4px->0, `.ifacebadge`, `strong` margins). That is not a regression — an unlayered `*` beats base
 * today too — it is the price of the same trade, and the only way out would re-break the app.
 *
 * NEVER delete the sheet instead (see dedupeViewSheets below for what that cost). Re-hosting moves
 * where a rule lands in the cascade; every rule still exists, so a library's "did I already import
 * this?" check still finds its sheet. A <link> is DISABLED rather than removed, so an app that
 * looks its own <link> back up by href still finds the element. */
/* ---- the fence: the chrome is ours, so make a foreign rule unable to MATCH it ----
 *
 * Re-hosting into the theme layer settles a fight on specificity. It cannot settle one against
 * `!important`, because importance ranks ABOVE layers — measured: `* { padding: 0 !important }`
 * still owns the chrome after re-hosting, and so does `#indicators { display: none !important }`.
 * The only pure-CSS answer to a foreign flag is our own flag in an earlier layer (it wins — also
 * measured), but that means ~550 of them, and `color`/`background` among them would beat this
 * theme's OWN forced-colors block. Fixing the cascade by breaking high-contrast is not a fix.
 *
 * So do not out-rank the rule — put the chrome where it cannot be addressed. Appending
 * `:where(:not([data-fs-chrome], [data-fs-chrome] *))` to a foreign selector's SUBJECT leaves it
 * matching everything it used to except us. `!important` has nothing left to win.
 *
 * The chrome is NOT one element, and naming one is how this went wrong the first time: the fence
 * said `.fs-sidebar`, which is the menu in both layouts (the bar is the same markup) — but the skip
 * link is a sibling of .fs-shell and the Appearance popover hangs off <body>, so both stayed exposed
 * while every test said the chrome was defended. `data-fs-chrome` is the fix: an element DECLARES
 * that it is ours, where it is written (header.ut, fs-appearance.js), and the fence and the pin
 * follow without being told. A future chrome root cannot forget to edit a constant in this file,
 * because there is no constant naming it any more. `npm run chrome-fence` holds the three together.
 *
 * `:where()` is load-bearing and not cosmetic: it contributes ZERO specificity, so `*` stays 0,0,0
 * and `#indicators` stays 1,0,0 and the app's rules keep their exact weight against each other and
 * against the theme on its own page. A plain `:not(.fs-sidebar)` takes its argument's specificity
 * and would silently re-order the app's stylesheet against itself.
 *
 * Only UNPINNED parts are fenced. A part pinned by the app's own name cannot reach the chrome
 * anyway (proven by the same test invasiveSheet uses), so leaving it alone costs nothing and keeps
 * the surgery as small as the danger.
 *
 * Two silent traps, both measured on the real CSSOM, both of which cost the app its rule:
 *  - A selector LIST must be fenced part by part. Appending to the whole `selectorText` fences only
 *    the last part: `*, ul` came back as `*, ul:where(…)` — `*` unfenced, chrome still exposed.
 *  - A pseudo-element must stay LAST. `a::after` + a tail append serialised to `a::after:where()`
 *    — the argument silently EATEN, leaving an empty `:where()` that matches NOTHING, and the
 *    setter reported success. The fence goes before the pseudo-element: `a:where(…)::after`. */
const CHROME_FENCE = ':where(:not([data-fs-chrome],[data-fs-chrome] *))';

function fenceSelector(part) {
	/* The getter always normalises a pseudo-element to `::`, incl. legacy `:before` — and the split
	 * point is found on the MASK and sliced out of the ORIGINAL, exactly as selectorParts() does and
	 * for the same reason: `::` is legal inside a quoted attribute VALUE (an IPv6 literal is the real
	 * case — `[data-addr*="::"]`, `a[href*="[::1]"]`). Read raw, the fence went INSIDE the quotes and
	 * the app's rule came back matching a value it never wrote — still valid CSS, so the setter
	 * reported success and nothing looked wrong afterwards, which this file's header calls the worse
	 * half of the two failures. */
	const i = maskStrings(part).indexOf('::');
	return i < 0 ? part + CHROME_FENCE : part.slice(0, i) + CHROME_FENCE + part.slice(i);
}

function fenceRules(rules, names) {
	for (const r of rules) {
		if (r.selectorText) {
			const parts = selectorParts(r.selectorText);
			if (parts.length && parts.some((p) => !pinnedToApp(p, names))) {
				/* The setter parses the whole selector and, on one it cannot parse, does NOTHING and
				 * does not throw — so it is atomic: never a half-written selector, and a failure just
				 * leaves the rule where it already was (unfenced, i.e. today's exposure). */
				try {
					r.selectorText = parts
						.map((p) => (pinnedToApp(p, names) ? p : fenceSelector(p))).join(', ');
				} catch (e) { /* left unfenced on purpose: the app keeps its rule */ }
			}
		}
		if (r.cssRules) fenceRules(r.cssRules, names);
	}
}

/* An @import's rules live in a sheet that is fetched separately, so they are not there the moment
 * the shim is inserted — retry until they are, then fence. Bounded: a sheet that never becomes
 * readable (404, cross-origin) simply stays unfenced, which is where we already were.
 *
 * The bound is a DEADLINE in ms, not a frame count. It was 60 frames described as "~1 s", which is
 * only true at 60 Hz: the same 60 frames is 2 s on a 30 Hz panel and longer still on a throttled
 * clock, so the budget moved with the display. Frames remain the retry TICK (they are what the
 * browser gives for free and a cache hit lands on the first one); only the giving-up point is
 * measured in time. */
function fenceImported(styleEl, names, until) {
	/* no initialiser: every path below assigns (the try, or the catch's null), so `= null`
	 * here was a dead store — eslint 10 puts no-useless-assignment in recommended and said so. */
	let rules;
	try {
		const first = styleEl.sheet && styleEl.sheet.cssRules[0];
		rules = first && first.styleSheet && first.styleSheet.cssRules;
	} catch (e) { rules = null; }
	if (rules) { fenceRules(rules, names); return; }
	if (Date.now() < until) { requestAnimationFrame(() => fenceImported(styleEl, names, until)); return; }
	/* GIVING UP IS A REPORTABLE EVENT. The irreversible half already happened — the app's original
	 * is silenced, the shim owns the page — so a fence that never lands leaves that app's rules
	 * reaching the chrome while every later pass skips the sheet as handled and documentPoisoned()
	 * calls the document clean. It is also not only the slow-router case: rAF does not fire in a
	 * background tab, so a page opened in one and left there passes the deadline without a single
	 * retry. Rare, silent and it looks like a CSS bug, which is exactly what a console line is for. */
	console.error('footstrap: could not read the re-hosted @import within the deadline — the sheet '
		+ 'stays unfenced and may repaint the chrome on this page.', styleEl);
}

/* What a sheet IS, as text: the rules that are APPLYING, not the markup that may or may not have
 * produced them. Serialised only ever to COMPARE — never re-parsed, so the serialiser cannot cost
 * anyone a rule. */
const serializeRules = (rules) => Array.prototype.map.call(rules, (r) => r.cssText).join('\n');

/* ---- a <style>'s textContent is NOT its sheet, and both the wrap and the dedupe assumed it was ----
 *
 * Wrapping means re-setting textContent, which RE-PARSES: whatever the parse does not reproduce is
 * deleted — silently, by the one fix in this file whose entire thesis is that deleting a view's CSS
 * is one-way (see the head of the file). Two shapes where the text does not describe the sheet, and
 * they are one question, not two:
 *  - an app that builds its CSS with insertRule() — an empty <style> appended first, rules pushed in
 *    after: the text is EMPTY while the rules apply, so the wrap writes `@layer theme {}` over a live
 *    sheet and every rule in it is gone.
 *  - a <style> carrying @import: it is invalid inside @layer and has to sit at the top of a sheet, so
 *    the wrapped copy comes back without it.
 *
 * So ask the exact question once — does re-parsing this text give back the sheet that is applying? —
 * rather than enumerate the shapes that make it false; the enumeration is what missed insertRule().
 * The probe is a CONSTRUCTIBLE sheet: never adopted, so nothing paints, no <head> mutation, and our
 * own observer never sees it. It also drops @import (per spec), which is why that case needs no test
 * of its own — the serialisations differ and the answer is already no.
 *
 * No probe means no answer, and the honest answer to "may I re-parse this?" when we cannot check is
 * NO: the sheet keeps every rule and the fence still holds Zone 1 without it. */
let _probe = null;
function textIsSheet(el, live) {
	try {
		if (!_probe) _probe = new CSSStyleSheet();
		_probe.replaceSync(el.textContent);
		return serializeRules(_probe.cssRules) === serializeRules(live);
	} catch (e) { return false; }
}

/* Sheets taken out of the cascade FOR GOOD — the re-hosted <link> originals. Kept because a
 * silenced sheet is still an ELEMENT in the document that still answers `cssRules`, so every later
 * ask re-judges it as invasive; documentPoisoned() explains what that cost. */
const _silenced = new WeakSet();

/* Take a re-hosted <link> out of the cascade — and MEAN IT.
 *
 * `el.disabled = true` alone does not do it, and the failure is silent and total. The IDL attribute
 * forwards to the ELEMENT's own flag; the thing that decides whether the CSS paints is
 * `el.sheet.disabled`, and a <link> that is still LOADING has no `.sheet` at all. Every runtime
 * injection is in exactly that state when <head>'s observer hands it here — which is the case this
 * module exists for (`luci-app-banip` and `luci-app-adblock` append their <link> at module eval,
 * openclash prints one from its template). So the assignment landed on nothing, the sheet came up
 * ENABLED when the bytes arrived, and the app's ORIGINAL, UNFENCED CSS went on painting beside the
 * fenced @import shim.
 *
 * Measured on the router with `* { padding: 0 !important }` behind a runtime <link>: `el.disabled`
 * read back `true`, `el.sheet.disabled` was `false`, and 95 of the 338 chrome elements were
 * flattened — the sidebar's own padding went 0px 88px -> 0px — while the shim's fenced copy sat
 * there matching nothing. Setting `el.sheet.disabled = true` by hand restored all of it. The
 * documented "openclash: 47 damaged -> 0" holds only because THAT sheet is server-rendered and has
 * therefore already loaded by the time the immediate pass sees it.
 */
function silence(el) {
	_silenced.add(el);
	setEnabled(el, false);
}

/* ---- PAGE OWNERSHIP: contain an invasive sheet instead of spending the document ----
 *
 * A foreign sheet is injected by ONE page and has no business painting any other. Before this, an
 * invasive sheet made the whole document spent (documentPoisoned) and the SPA fell back to a full
 * load on the way OUT — correct, and paid by ORDINARY pages: `luci-app-filemanager`, a stock app,
 * lands TWO <style>s in <head>. Its HexEditor module calls `injectHexEditorCSS()` at MODULE EVAL
 * and the view's own `render()` calls `insertCss()` on every arrival; both are invasive on their
 * BARE selectors, not on the ones pinned to `#file-manager-container` — HexEditor declares
 * `:root { --span-spacing; --clr-background; … }`, the view adds `:root`, `.cbi-page-actions`,
 * `.cbi-button-save:not(.custom-save-button)` and a `td:last-child` riding as the second half of
 * `#file-manager-container th:last-child, td:last-child`. `luci-app-ssclash` adds four more as the
 * Ace editor initialises. Invasive by the only definition that also catches `[class] { padding: 0
 * !important }`.
 *
 * Measured on owrt2512, 25.12.4, with ownership taken out of documentPoisoned() and put back:
 * leaving either page is a FULL LOAD, 5 runs of 5, and with ownership all 5 are in place —
 * medians 24 ms (filemanager) and 27 ms (ssclash). The control is a page that injects nothing
 * (System -> General): in place either way. Stock LuCI's own pages inject nothing into <head> on
 * 24.10/25.12 — the realtime graphs style their SVG text with an inline `style=` attribute — so
 * what this costs a router is decided entirely by which apps are installed on it.
 *
 * Removing the sheet on the way out is NOT the fix, and it is the obvious one: an append at MODULE
 * TOP LEVEL happens once, because `L.require` caches the module, so a second visit re-runs nothing
 * and the page renders unstyled — HexEditor's injector above is exactly that shape, and its own
 * `getElementById('hexeditor-styles')` guard never gets a second chance to notice the element is
 * gone, because nothing calls it again. A sheet injected from `render()` would survive removal, but
 * the two cases are indistinguishable from here and only one mechanism can be right for both.
 * Disabling is reversible, which is the whole difference.
 *
 * OWNER = body[data-page] when the sheet was re-hosted. The order that makes this sound is in
 * fs-router.js: navigate() stamps data-page BEFORE it require()s the view class, so at the
 * moment a view module evaluates and appends its <style>, the attribute already names ITS page. On a
 * full load the server stamped it. Either way "now" is the sheet's own page.
 *
 * Recorded on the element that PAINTS, never on the one that was permanently silenced: for a <link>
 * that is the @import shim, and re-enabling the original instead would undo silence() and put the
 * app's unfenced CSS back over the chrome — the measured 95-of-338 flattening.
 *
 * THE OWNER IS THE APP, NOT THE PAGE, and that is not a guess — per-page was written first and
 * swept: `luci-app-zapret2` has three pages that share ONE injected <style>
 * (`.label-status { … !important }`), so it was owned by whichever loaded first and arrived DARK on
 * the other two. Per-page ownership silently un-styles any app whose pages share an injector, which
 * is a whole class of app, not a corner. `admin/<group>/<app>` — the first three dispatch segments —
 * is the smallest key that keeps an app's own pages together while still blocking the leak this
 * exists to block: onto OTHER apps and onto stock pages. The sweep is
 * `tools/...`-less on purpose (it needs a live router); re-run it against a router with third-party
 * apps after touching this, and look for a sheet that a full load has and an SPA arrival does not.
 *
 * Segments, never the dash-joined `data-page`: a dispatch segment may itself contain a dash
 * (`admin/system/package-manager`), so splitting the attribute on '-' would cut inside a name. */
const _owner = new WeakMap();
const APP_DEPTH = 3;

/* The router hands this over on every navigation (it holds the resolved segments). Until it does —
 * the initial full load — ask the SERVER which page it dispatched to. */
let _curKey = null;

function appKey(segs) {
	return (segs || []).slice(0, APP_DEPTH).join('/');
}

/* ---- THE URL IS NOT THE PAGE, and a sheet keyed on the URL is a sheet that dies ----
 *
 * `L.env.dispatchpath` is the leaf the SERVER resolved this request to; the address bar holds what
 * was ASKED for, and LuCI's dispatcher walks a node down to its firstchild without rewriting it.
 * Two shapes of that, both ordinary:
 *
 *   /cgi-bin/luci/admin/status  -> admin/status/overview   the Status menu's OWN link
 *   /cgi-bin/luci/              -> admin/status/overview   the landing page, on a router with no
 *                                                          luci-mod-dashboard
 *
 * The URL says `admin/status` and `''`; the router, one navigation later, hands
 * scopeToCurrentPage() the RESOLVED `admin/status/overview`. Those keys can never match, so the
 * first SPA navigation away from such a page disables the sheets that page owns — and
 * rehostIntoThemeLayer() has already silenced the app's original <link> for good, so nothing
 * paints them again for the life of the document. A full-load key that is wrong is worse than no
 * key at all: it is a sheet that works until you navigate.
 *
 * Measured on owrt2512 with luci-app-mwan3, whose status include injects
 * `#mwan3-service-status > .alert-message { display:inline-block; width:15rem; … }`: full load on
 * /admin/status renders the card as `inline-block 240px 96px`; System -> General and back leaves
 * it `block 966px` — every interface card on the Overview stacked full-width. Keyed on the
 * dispatch path: 240px before and after. */
/* WHO A SHEET INJECTED RIGHT NOW BELONGS TO, when that is not the page the chrome is showing.
 *
 * On a FIRST visit the require() of a view IS its render, and a require in flight cannot be
 * stopped: click a page whose module injects CSS, click away before it lands, and the app's <style>
 * appears after the router has already stamped data-page for the page that superseded it. Credited
 * to currentKey() that sheet is bound to the wrong page for the life of the document — disabled on
 * its own page and ENABLED on one it has no business painting, which for luci-app-filemanager means
 * `.cbi-button-save { display: none !important }` on somebody else's config form (reproduced on the
 * stand: the System page came back with no Save button, and stayed that way across return visits).
 *
 * So the router names the owner for the duration of such a require (see fs-router.js), and this is
 * that hint.
 *
 * ONE SLOT, STAMPED WITH THE NAVIGATION THAT SET IT. The router only names an owner for a require
 * that has yet to evaluate its module, so the common shape — a cold require in flight, the user
 * clicking on to a page already in LuCI's class cache — no longer touches this slot at all. Two
 * COLD requires can still overlap, and then the newer one wins the slot: it is the page the user is
 * looking at, and crediting ITS sheet to the page it superseded would leave the visible page
 * unpainted, which is the worse of the two errors. The generation stamp is what keeps that from
 * getting worse still — the older require's `.finally` must not clear a slot the newer one now
 * holds, or the newer page's own sheet lands unattributed.
 *
 * There is no way to do better from here: LuCI evaluates a view module inside `eval()` in its own
 * `require()` (luci.js), so nothing observable says WHICH module is running when a <style> appears —
 * `document.currentScript` is null and the injection is synchronous inside a promise chain we do
 * not own. The remaining hole is therefore two cold requires overlapping, where the first one's
 * sheet is credited to the second's page — the pre-existing behaviour, now narrowed to that one
 * case instead of every navigation away from a cold require. */
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

/* BOTH HALVES, for the reason the paragraph above silence() measured: el.disabled is the ELEMENT's
 * flag and el.sheet.disabled is what decides whether the CSS paints, and a still-loading <link> has
 * no .sheet for the assignment to reach — so a switch-off also re-asserts once the bytes arrive.
 * `once` — the element is marked fsLayered by then, so this never re-arms, and a sheet that never
 * loads has nothing to silence.
 *
 * silence() is this with the element remembered, and says so by calling it: the two used to write
 * the rule out separately, which is one copy of a JUDGEMENT more than this file allows itself. */
function setEnabled(el, on) {
	el.disabled = !on;
	if (el.sheet) el.sheet.disabled = !on;
	else if (!on) el.addEventListener('load', () => { if (el.sheet) el.sheet.disabled = true; }, { once: true });
}

/* Called by the router right after it stamps data-page, with the RESOLVED segments. Only sheets we
 * OWN are touched: a clean sheet is harmless and an invasive one we could not attribute still
 * poisons the document, so it keeps the full-load path rather than being silently disabled on its
 * own page. */
/* `keep` is the page still ON SCREEN, and it exists because a client navigation now has a window in
 * which two pages are real: the incoming one renders into a hidden stage while the outgoing one is
 * still being read (fs-router's staged swap). Scoping is needed BEFORE the staged render — a view
 * must not measure itself through a sheet that does not own its page — but doing both halves then
 * strips the outgoing page's own stylesheet off content the user is looking at, for the 600-1800 ms
 * the staging window exists to fill. So the router calls this twice: once with `keep` set to the
 * page it is leaving, which enables the incoming page's sheets and leaves the departing page's
 * alone, and once with nothing at the swap, which is the ordinary sweep. */
function scopeToCurrentPage(segs, keep) {
	if (segs) _curKey = appKey(segs);
	const key = currentKey();
	const spared = (keep && keep.length) ? appKey(keep) : null;
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (!outlivesPage(el) || !_owner.has(el)) return;
		const owner = _owner.get(el);
		/* the page on screen keeps what it owns until the swap takes it off screen */
		if (spared !== null && owner === spared && owner !== key) return;
		setEnabled(el, owner === key);
	});
}

/* TAKE A SHEET, AND SCOPE IT IN THE SAME BREATH.
 *
 * scopeToCurrentPage() runs on NAVIGATION, so it only ever sees sheets that were already here. A
 * sheet that arrives afterwards is scoped by nobody until the next click — and the one case where
 * that matters is precisely the case the owner hint exists for: a cold require whose page the user
 * has already left injects its <style> into a document showing somebody else's page, and the sheet
 * paints there until the user navigates again. Measured with a view whose module appends
 * `body { outline: 3px solid rgb(9,9,9) }`: correctly credited to its own page, and still painting
 * the outline on the page that superseded it.
 *
 * So the stamp and the switch are one act. `ownerKey()` is the page the sheet BELONGS to and
 * `currentKey()` the page on screen; on every ordinary arrival they are the same string and this is
 * a no-op. */
function claimOwner(el) {
	const key = ownerKey();
	_owner.set(el, key);
	if (outlivesPage(el)) setEnabled(el, key === currentKey());
}

function rehostIntoThemeLayer(el, universe) {
	if (el.dataset.fsLayered) return;

	if (el.tagName === 'LINK') {
		/* A <link>'s rules cannot be moved into a layer in place — but an @import CAN name one.
		 * The href is already absolute and same-origin, so the re-fetch is a cache hit. */
		const s = document.createElement('style');
		s.dataset.fsLayered = '1';
		s.textContent = '@import url("' + el.href.replace(/["\\]/g, '\\$&') + '") layer(theme);';
		el.dataset.fsLayered = '1';
		el.after(s);		/* keep source order: ties inside the layer still resolve as they did */
		silence(el);
		claimOwner(s);	/* the shim paints; the original is silenced for good */
		fenceImported(s, universe.names, Date.now() + 1000);	/* a cache hit lands on the first frame */
		return;
	}

	let rules;
	try { rules = el.sheet && el.sheet.cssRules; } catch (e) { return; }
	/* No rules yet: nothing to re-host, nothing to fence — and, crucially, nothing to MARK. An app
	 * that appends an empty <style> and fills it with insertRule() arrives here first; marking it
	 * handled now would leave the sheet it is about to build unfenced for the life of the document. */
	if (!rules || !rules.length) return;

	/* Handled — and never twice. fenceRules() is NOT idempotent: pinnedToApp() strips a functional
	 * pseudo-class before looking for the app's own name, so an already-fenced selector reads as
	 * unpinned all over again and a second pass appends a second fence. The mark is the only thing
	 * that says the work is done, so it has to be set for every path below, wrapped or not. */
	el.dataset.fsLayered = '1';

	/* Wrap only if the text still IS the sheet (see textIsSheet). When it is not, the sheet stays
	 * unlayered — Zone 2 exactly where it already was, which is a trade — rather than lose rules,
	 * and it is still FENCED below: the fence is pure CSSOM, needs no re-parse, and is the half that
	 * answers `!important` anyway.
	 *
	 * Layer by TEXT, fence by CSSOM, in that order: re-setting textContent re-parses the sheet and
	 * would throw away any selector we had already rewritten. A <style>'s url()s resolve against the
	 * document either way, so re-parsing costs nothing here — which is exactly NOT true of a <link>
	 * (measured: cssText serialises `url("img.png")` still relative, so inlining a linked sheet would
	 * silently re-base every image and font in it. That is why a <link> keeps its @import). */
	if (textIsSheet(el, rules)) {
		origText.set(el, el.textContent);	/* dedupeViewSheets keys on this — see there */
		el.textContent = '@layer theme {\n' + el.textContent + '\n}';
	}
	try { if (el.sheet) fenceRules(el.sheet.cssRules, universe.names); } catch (e) { /* unfenced, not broken */ }
	/* LAST, because the line above may have re-parsed the sheet. `el.disabled` is not a content
	 * attribute — it is the element's view of `el.sheet.disabled`, and assigning textContent throws
	 * the old CSSStyleSheet away and builds a new one, which comes back ENABLED. Claiming before the
	 * wrap therefore switched a sheet off and then switched it back on within the same call, which is
	 * how a sheet belonging to a page the user had left went on painting the page that superseded it
	 * (measured: `body { outline: 3px solid rgb(9,9,9) }` from a still-loading view, live on
	 * System -> System). Ownership is recorded from the same call either way — ownerKey() is read
	 * here, while the router's hint still names the page whose module is evaluating. */
	claimOwner(el);	/* a <style> is re-hosted IN PLACE, so it paints itself */
}

/* Re-hosting needs the theme's own selectors to tell an invasive sheet from an inert one. If
 * cascade.css cannot be read we cannot classify, so re-host NOTHING and leave the cascade exactly
 * as it is: documentPoisoned() already fails every sheet to the slow path in that case, and
 * silently demoting an app we could not judge is the one move with no way back for its author. */
function rehostInvasiveSheets() {
	const universe = themeNames();		/* {names, props} — NOT a bare Set; the fence wants .names */
	if (!universe) return;
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (el.dataset.fsLayered) return;
		/* A SHEET WITH NO RULES YET IS NOT AN INNOCENT SHEET. `insertRule()` produces no mutation
		 * record of any kind, so an app that appends an empty <style> and fills it later — lazily, on
		 * first hover, from a `.then()` — is judged here as empty, found not invasive, and never
		 * looked at again unless some other sheet happens to be added afterwards. Measured: a
		 * `* { padding: 0 !important }` inserted that way flattened the chrome (the sidebar's 20px
		 * padding went to 0) and stayed unfenced for the life of the document. One deferred look per
		 * such element is enough, and it costs nothing in the ordinary case where a <style> arrives
		 * with its rules already in it. */
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
 * Not deleting view CSS costs where an app injects on EVERY render: `luci-app-podkop` calls
 * injectGlobalStyles() from render() (4 KB, no guard) and `luci-app-mosdns` re-appends three
 * CodeMirror <link>s, so every SPA re-visit adds a copy that never stops being parsed. Dropping an
 * EXACT duplicate cannot break anyone, for the reason the sweep failed: the rules do not go away —
 * the surviving copy is byte-identical, and a library's "have I already imported this?" check (what
 * ACE died on) still finds its sheet. Keep the FIRST copy: it is what any handle the app kept
 * points at.
 *
 * Key a <style> on what its APP wrote, not on what stands in the DOM: re-hosting rewrites the text
 * (@layer wrapper), so a wrapped first copy and podkop's next byte-identical injection would no
 * longer match — the duplicate detector would go quiet exactly where it earns its keep, and the
 * copies would pile up again. A <link> keys on href, which re-hosting leaves alone.
 *
 * Re-hosting must therefore run BEFORE this, never after: a fresh copy of a <link> is appended to
 * <head>, which is EARLIER in document order than a template's <link> down in .fs-content, so the
 * "keep the first" rule would keep the raw copy, drop the re-hosted one, and strand its @import
 * shim — the chrome breaking again while shims pile up once per render (measured; that is the leak
 * this function exists to prevent). Re-host first and both copies are equivalent by the time they
 * are compared, so whichever survives is already layered and the loser's shim is a byte-identical
 * duplicate this same pass collapses. */
function sheetKey(el) {
	if (el.tagName === 'LINK') return 'LINK|' + el.href;
	const t = origText.get(el);
	if (t !== undefined) return 'STYLE|' + t;
	/* Not wrapped, so no original was kept — and this sheet's textContent may not BE its sheet (see
	 * textIsSheet): every insertRule-built <style> has an empty one, so keying on the text gave them
	 * all the same key and the second one was REMOVED as a "duplicate" of a sheet it shares nothing
	 * with. That is the deletion this file exists to prevent, dressed as a dedupe. Key on what is
	 * applying instead. */
	let rules;
	try { rules = el.sheet && el.sheet.cssRules; } catch (e) { return null; }
	/* A sheet with no rules is a duplicate of nothing — and it is very likely a <style> an app has
	 * appended but not yet filled: removing it strands the handle it is about to insertRule through. */
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

/* ---- THE LAYER ORDER IS A DOCUMENT-WIDE FACT, AND A SHEET INSERTED FIRST CAN REWRITE IT ----
 *
 * `@layer tokens, base, theme, page;` in 00-header.css is what makes theme beat base. That
 * statement only holds while cascade.css is the FIRST sheet in the document to name a layer — the
 * order is fixed by first appearance, and an earlier sheet naming `theme` makes theme the FIRST
 * layer, i.e. the WEAKEST. Every later name is appended after it, so the whole cascade inverts:
 * `tokens, base, page` end up above `theme` and base's `* { padding: 0 }` wins over the chrome's
 * own rules. Measured on the router: `.fs-content` padding 24px/28px -> 0, and the top bar, the
 * tabs and every button flattened with it.
 *
 * Which is exactly what re-hosting an app's sheet into `@layer theme` can cause, because WHERE the
 * app put its <style> is the app's choice. Ace (shipped by `luci-app-ssclash`, and by any package
 * that embeds an editor) calls `dom.importCssString`, which inserts its <style> as the FIRST CHILD
 * of <head> — ahead of cascade.css. Wrapping that sheet, as the fence must, moved the first mention
 * of `theme` to the top of the document and took the theme layer down with it. It is lazy, too:
 * Ace adds more of those sheets on first hover, which is the "reloading fixes it until I touch
 * anything" in the report.
 *
 * The repair is one declaration, and it works because inserting a NEW sheet re-runs the ordering
 * (moving an existing one does NOT — measured, both ways): re-declare the canonical order from a
 * fresh <style> placed first in <head>. Cheap, idempotent, and it states the same order 00-header.css
 * does — one more copy of it, which is why the text is derived from nothing and simply repeated
 * here, in the one other place that can see the whole document. */
const LAYER_ORDER = '@layer tokens, base, theme, page;';
let _layerStmt = null;

function reassertLayerOrder() {
	const head = document.head;
	if (!head) return;
	/* The anchor is whichever of ours comes first: cascade.css, or the statement a previous pass
	 * already put in front of it. Only a sheet ahead of THAT can have named a layer before we did —
	 * on a page with no foreign sheet this is one querySelectorAll and out. */
	const own = [...document.querySelectorAll('link[rel~="stylesheet"]')]
		.find((l) => (/\/cascade\.css/).test(l.href || ''));
	if (!own) return;
	const anchor = _layerStmt && _layerStmt.isConnected ? _layerStmt : own;
	const ahead = [...document.querySelectorAll('style, link[rel~="stylesheet"]')]
		.some((el) => el !== anchor && el !== own &&
			(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING));
	if (!ahead) return;

	/* A FRESH element every time: re-inserting the same node is a move, and a move does not re-run
	 * the ordering (measured — the inverted document stayed inverted). Dropping the previous one
	 * keeps this at one spare <style> per document however many sheets an app injects. */
	if (_layerStmt) _layerStmt.remove();
	_layerStmt = document.createElement('style');
	_layerStmt.textContent = LAYER_ORDER;
	head.insertBefore(_layerStmt, head.firstChild);
}

/* Watch <head> rather than deduping on navigation: the copy arrives too late otherwise — podkop
 * injects from its render(), which resolves AFTER the router's require() callback, so a nav-time
 * sweep left the document permanently carrying one stale duplicate (bounded, never zero). The
 * observer collapses the copy in the microtask it appears in. It cannot loop: a removal produces a
 * mutation with no ADDED nodes, and the handler bails unless a stylesheet was added.
 *
 * The immediate pass is not the observer's job and cannot be: a legacy Lua page's <link> is in the
 * SERVER's HTML (openclash prints it into .fs-content), so it is parsed and applying long before
 * this module is even fetched — there is no mutation to observe. It is re-hosted on the first pass
 * instead, which costs a brief flash of unstyled chrome before the modules land; the page then
 * settles correct, where today it stays broken. Runtime injections land in <head> (podkop, banip,
 * adblock, the file manager), which is what the observer watches — deliberately not the whole
 * document, since LuCI's poll rewrites content every second and this would fire on every tick. */
function watchViewSheets() {
	/* Dedupe the immediate pass too, in the observer's order (re-host strictly first — see there).
	 * It used to re-host only, which left the server-rendered duplicate — the one case this pass
	 * exists for — uncollapsed for the life of the document. Measured with the real
	 * luci-app-openclash: it prints the same <link href=oc.css> from three templates, so its
	 * Overwrite Settings page carried two identical links and the two @import shims we make for
	 * them, parsing 117 KB of CSS twice. The observer never fires for either: both are in the
	 * SERVER's HTML, so there is no mutation to see. */
	rehostInvasiveSheets();
	dedupeViewSheets();
	reassertLayerOrder();	/* strictly AFTER the re-host: it is the wrap that can invert the order */
	const mo = new MutationObserver((muts) => {
		for (const m of muts)
			for (const n of m.addedNodes)
				if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') {
					/* `continue`, not `return`: our own statement can share a batch with the very
					 * sheet that made it necessary, and bailing on the batch would skip that one. */
					if (n === _layerStmt) continue;
					rehostInvasiveSheets();	/* strictly before the dedupe — see there */
					dedupeViewSheets();
					reassertLayerOrder();
					return;
				}
	});
	mo.observe(document.head, { childList: true });
	/* …and <body>, because `document.head.appendChild` is a CONVENTION, not a rule. An app that
	 * appends its <style> to <body> (or to documentElement) after chrome init was seen by nothing:
	 * the immediate pass had already run and the mutation was not under observation. Measured with
	 * `* { padding: 0 !important }` in a body-appended <style>: 95 of 338 chrome elements flattened
	 * and the sheet never marked. documentPoisoned() still saw it, so the SPA fell back to full
	 * loads — the page you are ON stayed broken, which is the half that matters.
	 *
	 * childList WITHOUT subtree, exactly as for <head>: this fires only for DIRECT children of
	 * <body>, and LuCI's poll rewrites content inside #view — a descendant — so the per-tick cost
	 * the head-only choice was protecting stays zero. */
	mo.observe(document.body, { childList: true });
}

return baseclass.extend({
	attributeTo,
	documentCarries,
	documentPoisoned,
	scopeToCurrentPage,
	watchViewSheets
});
