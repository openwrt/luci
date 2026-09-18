'use strict';
'require baseclass';
'require rpc';
'require ui';
'require fs-axes as axes';

/* fs-assets — putting a file ON THE ROUTER, and taking it off again.
 *
 * Two uploads live here, the pattern tile and the login photo, and everything they need that the
 * rest of the theme does not: a DOMParser pass over an SVG, a canvas re-encode of a photo, the
 * chmod that makes a freshly written 0600 file servable, and the rollback that runs when the token
 * write fails after the bytes have landed.
 *
 * It is a module of its own because of WHERE it is needed: this machinery is reached only from the
 * Appearance page, one out of nearly two hundred, and it was ~4 KB of DOMParser, canvas and rpc
 * plumbing downloaded to a router's browser on the way to the DHCP page.
 *
 * The token accessors and the two live appliers live in `fs-axes` beside the axes themselves — the
 * Appearance previews and head.ut's pre-paint read the same fields — so this file requires that one
 * and nothing else of the theme's. */

/* `reject: true` is load-bearing: without it a refused write arrives as SUCCESS. rpc.js raises on
 * the ubus status code only when the declaration asks it to, and otherwise hands the code back as
 * the resolved value — measured on the router, a per-config ACL refusal resolves with 6
 * (permission denied) and every `.then()` below runs as if the file had been written, greying the
 * Save button over a write that never happened. */
/* The four messages each said twice or three times below. Hoisted because a string literal is not
 * mangled, so every repeat is paid in full on flash — and because a message with two spellings is a
 * message that gets fixed in one of them. The msgid and its 'footstrap' context stay literal
 * arguments here, which is what update-po.sh's extractor reads. */
const MSG_UPLOAD_FAILED = _('Upload failed.', 'footstrap');
const MSG_NOT_SVG = _('That file is not an SVG image.', 'footstrap');
const MSG_BAD_IMAGE = _('Could not process the image.', 'footstrap');
const MSG_PICK_SVG = _('Please choose an SVG file.', 'footstrap');
/* One template, two numbers, rather than composing "1 script, 3 external references" out of
 * pluralised fragments at run time: a translator gets one sentence to place the two %d's in,
 * instead of a jigsaw of "script"/"scripts" and "reference"/"references" that has to agree in
 * every language's own plural rule. */
const MSG_SANITIZED = _('Cleaned before upload: removed %d unsafe element(s) and %d external reference(s).', 'footstrap');
const MSG_NOTHING_LEFT = _('That SVG had nothing left once the unsafe parts were removed.', 'footstrap');

const _uciSet = rpc.declare({ object: 'uci', method: 'set', params: [ 'config', 'section', 'values' ], reject: true });
const _uciCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ], reject: true });

/* ---- the pattern: an SVG the admin uploads, tiled and recoloured ----
 *
 * The bytes come from the admin, never from a third-party host: a theme in a package feed does not
 * reach out at run time.
 *
 * Router-side, like the login photo and for the same reason — a file cannot live in localStorage,
 * and a pattern is something a router wears. The path is a fixed server-side constant matched
 * exactly by the rpcd ACL, so nothing user-controlled reaches a path. It lives under /etc so a
 * package upgrade cannot delete it (keep.d carries it across a sysupgrade). It keeps the .svg name
 * for its own sake — the CGI handler that now serves it (root/www/cgi-bin) sets Content-Type
 * itself and does not rely on uhttpd's by-extension typing the way the login photo's /www symlink
 * still does.
 *
 * How it is made to fit is 15-wallpaper.css's mask, not anything done to the bytes: the file
 * supplies the alpha and the theme the colour, so one upload reads correctly in both modes and
 * under every palette.
 *
 * What is cleaned, and why cleaning is honest here: an SVG is a document, not a picture, and while
 * a masked or background image never executes script, the same file fetched from its own URL would
 * (OpenWrt forum thread 251930). THIS FILE IS NOT THE SECURITY BOUNDARY and none of what follows
 * changes that: the rpcd ACL authorises the cgi-upload POST regardless of what wrote it, so a `curl`
 * straight to the endpoint skips every check below, and what actually stops the file executing if
 * it is ever opened directly is the server's own response headers — the CGI handler
 * (root/www/cgi-bin/luci-theme-footstrap-pattern) sends `Content-Security-Policy: default-src
 * 'none'; sandbox` on every request for it, upload path or not. That is true of the bytes this
 * module hands to `fetch()` whether they are the admin's original file, a cleaned copy, or (before
 * this pass existed) a refusal that never reached the server at all. So sanitizing changes
 * CONVENIENCE, not the threat model: an admin whose export carries a stray handler or an external
 * `url()` — an editor artefact, not a deliberate payload in the overwhelming case — gets a working
 * tile and a note about what was taken out, instead of a refusal they have to go and hand-edit
 * their way around. */
const PAT_PATH  = '/etc/footstrap/pattern.svg';			/* cgi-upload target; the ACL grants exactly this */
const PAT_MAX   = 512 * 1024;							/* a tile that has to reach a router's flash and then every page load */
/* What a cleaned SVG has had taken out of it, decided on the PARSED document and not on its text: a
 * regex over the source guesses at a grammar the browser already implements, and guesses in both
 * directions — a handler pattern also matches an ordinary `only_selected="false"`, while an entity
 * or odd whitespace hides a real handler from it.
 *
 * DOMParser is the parser the file will actually be read by, and parsing is inert: no script runs,
 * no subresource is fetched, no handler is bound. So the questions are exact ones about nodes, and
 * `_sanitizeSvg` below asks all of them in the SAME walk that removes what fails one:
 *
 *   - is it an SVG at all (a parsererror, or a root that is not <svg>, is not an image — refused,
 *     not cleanable: there is no document to clean)
 *   - does it carry an element that executes or embeds (script, foreignObject, iframe, style, …) —
 *     the element is removed
 *   - does it carry a real event-handler attribute — `^on[a-z]+$` — the attribute is removed
 *   - does any value start a `javascript:` url — the attribute is removed
 *   - does any href point off this router — a leading `//`, or a `data:`/`blob:`/`about:` payload —
 *     the attribute is removed
 *   - does an element carry `xml:base` — it moves where every relative reference under it resolves,
 *     so it is removed regardless of what it points to
 *   - does a `style` attribute reach off this document — `url(` naming anything but a same-document
 *     fragment, `@import`, or `expression(` — that ONE DECLARATION is dropped, the rest of the
 *     value kept
 *
 * The check is for the way the file can be reached that a mask does not cover: its own URL, opened
 * directly, same-origin with the session.
 *
 * `animate`/`set` are listed for a second reason as well: they can retarget an attribute at run
 * time (`<set attributename="href" to="javascript:…">`), and a tile that animates repaints a
 * full-viewport layer behind every page.
 *
 * `<style>` is removed whole, as an ELEMENT (PAT_BAD_TAGS): `<style>@import
 * url("//attacker/x.css")</style>` reaches off-router with no script and no href at all, a tile has
 * no legitimate use for a stylesheet, and parsing its CSS to tell a safe one from a dangerous one
 * would be exactly the grammar-guessing this file avoids everywhere else — so the element is taken
 * out without being read.
 *
 * A `style` ATTRIBUTE is narrower, because it is common where the element is not: a vector editor
 * writes one on every shape it draws, and an Inkscape export measured for this fix carried 278 of
 * them — `style="fill:#100f0d;fill-opacity:1;fill-rule:nonzero;stroke:none"` — not one containing a
 * reference of any kind. Removing the attribute outright would touch nearly every real upload for
 * nothing a mask does not already stop, so `_sanitizeStyleValue` below splits it on `;` and drops
 * only the declaration that reaches off this document: `url(` naming anything but a `#fragment`
 * inside the SAME svg, `@import`, or a CSS `expression(` (legacy IE, parsed by nothing shipping
 * today, dropped anyway for the same reason `data:`/`blob:`/`about:` are below — the grammar to
 * tell a dead syntax from a live one in every future engine is not worth having). `url(#gradient)`
 * is how ordinary SVG gradients and clip-paths are written and is kept; a relative or absolute
 * `url(…)` is not, because it is a second fetch and not "into this document" either way. The match
 * is case-insensitive and tolerant of whitespace before the `(` — CSS itself is stricter about the
 * second one, but a check a differently-spaced upload slips past is not a check, and the cost of
 * dropping a declaration that could not have run anyway is one line fewer of `style`, not a hole.
 *
 * `data:`/`blob:`/`about:` were allowed
 * through `href`/`xlink:href` before this pass, on the theory that a tile only ever uses `data:` to
 * embed its own bitmap — closed anyway, because the same scheme admits `data:text/html` and
 * `data:image/svg+xml`, and telling those apart from a `data:image/png` bitmap means parsing the
 * URI's own MIME token, which is exactly the kind of grammar-guessing this file avoids everywhere
 * else. The cost is real: an admin embedding a bitmap inside the tile now needs a second uploaded
 * asset referenced by a same-origin URL instead of a `data:` href — the tile itself is unaffected,
 * since 15-wallpaper.css never used one. */
const PAT_BAD_TAGS = [ 'script', 'foreignobject', 'iframe', 'embed', 'object', 'audio', 'video', 'animate', 'set', 'style' ];
const SVG_NS = 'http://www.w3.org/2000/svg';

/* CSS Syntax Level 3 §4.3.7: `\` + 1-6 hex digits (+ one optional trailing whitespace that ends the
 * escape) decodes to that code point, and `\` + any other character is that character literally.
 * Security review finding (LOW): `_externalStyleRef` used to match the literal word `url(`, so a
 * hex-escaped function name — `u\72l(//evil.example/x)`, `\72` being 'r' — reached a real CSS
 * tokenizer as an ordinary `url()` while the literal match never saw it. Decoding first closes it
 * without a second grammar to maintain: once the escape is gone, the same literal match is exactly
 * what a browser would have resolved. */
function _cssUnescape(v) {
	return v.replace(/\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([^\r\n\f])/g,
		(m, hex, lit) => (hex !== undefined ? String.fromCodePoint(parseInt(hex, 16)) : lit));
}

/* True if a CSS declaration reaches off this document — see the comment above PAT_BAD_TAGS for
 * what is and is not admitted and why. `url(` is matched everywhere it occurs, because one
 * declaration can itself carry more than one (a shorthand, or a fallback list), and a single
 * external reference among same-document ones is still external. Case-insensitive and tolerant of
 * whitespace before `(` on purpose: this is the removing side of the check, so matching MORE than
 * the CSS grammar strictly allows costs a dropped declaration that could not have run anyway, while
 * matching less would let a spacing or casing trick back through. */
function _externalStyleRef(v) {
	v = _cssUnescape(v);
	if ((/@import\b/i).test(v) || (/expression\s*\(/i).test(v)) return true;
	const urlRe = /url\s*\(\s*(['"]?)\s*([^)\s'"]*)/gi;
	let m;
	while ((m = urlRe.exec(v)) !== null)
		if (m[2].charAt(0) !== '#') return true;
	return false;
}

/* A `style` value with every off-document DECLARATION dropped and the rest kept verbatim — see the
 * comment above PAT_BAD_TAGS for the `style` ATTRIBUTE's narrower treatment. Splitting and
 * rejoining on `;` is only ever done when something is actually being removed: a clean value never
 * reaches this function's caller with `removed` counted, so it never gets rewritten either (point 2
 * of the sanitize pass — see `_sanitizeSvg`). */
function _sanitizeStyleValue(v) {
	let removed = 0;
	const kept = v.split(';').filter((raw) => {
		const d = raw.trim();
		if (!d) return true;
		if (_externalStyleRef(d)) { removed++; return false; }
		return true;
	});
	return { value: kept.join(';'), removed };
}

/* One walk that both judges the document's shape and cleans its content — a second traversal that
 * could disagree with this one is exactly the risk a duplicate check runs (openwrt/luci#8981's
 * lesson applied here). Returns `{ error }` for the four things that cannot be cleaned honestly
 * (not an SVG, a parser error, the wrong namespace, nothing left once the unsafe parts are gone),
 * or `{ text, elements, refs }` — `text` is the ORIGINAL string, untouched, when `elements` and
 * `refs` are both 0: a round-trip through XMLSerializer can rewrite namespaces, entities and
 * whitespace, which on a 138 KB tile is silent corruption nobody notices until it is on a router, so
 * serializing only happens when something was actually removed. */
function _sanitizeSvg(text) {
	let doc;
	try { doc = new DOMParser().parseFromString(text, 'image/svg+xml'); }
	catch (e) { return { error: MSG_NOT_SVG }; }
	const root = doc && doc.documentElement;
	/* An SVG is its ROOT'S NAMESPACE, not its root's spelling. `nodeName` is the qualified name, so
	 * it answers both questions wrong at once: `<svg xmlns="http://www.w3.org/1999/xhtml">` reads as
	 * `svg` and is admitted although it is an XHTML document that executes on all three engines,
	 * while `<s:svg xmlns:s="http://www.w3.org/2000/svg">` reads as `s:svg` and is turned away
	 * although it is an ordinary picture. */
	if (!root || doc.querySelector('parsererror') ||
		root.localName.toLowerCase() !== 'svg' || root.namespaceURI !== SVG_NS)
		return { error: MSG_NOT_SVG };

	let elements = 0, refs = 0;

	/* A processing instruction can attach an XSLT stylesheet carried INSIDE this same document, and
	 * the transform's output is a document this walk never sees: `<xsl:element name="script">`
	 * builds the element by name, so nothing here is called script. Measured executing on Firefox
	 * (Chromium and WebKit decline to run XSLT on an image/svg+xml document). A tile has no use for
	 * one, and without the PI the embedded stylesheet is never applied. */

	/* Residual, verified NOT exploitable here (2026-09 security review): a prologue of
	 * `<!DOCTYPE svg SYSTEM "http://evil.example/x.dtd">` is a document-level construct this walk
	 * never visits — `doc.doctype` is left as parsed, the same as everything else here that is not an
	 * element or an attribute — and it survives `XMLSerializer` byte for byte on the same round trip
	 * that runs below when anything else on the document needs cleaning. It costs nothing today
	 * because no shipping engine resolves an external DTD for any document at all, `image/svg+xml`
	 * included (external entity resolution has been off since the XXE era); a browser that ever did
	 * would only reach that fetch by opening the file directly, which the CGI answers with
	 * `Content-Security-Policy: default-src 'none'; sandbox` — every other consumer sees this bundle
	 * only as a `mask-image`/`background-image`/`<img>` source, none of which parses a DOCTYPE at all.
	 * Not closed: dropping `doc.doctype` would carve out one more node type in a walk that otherwise
	 * judges only elements and their attributes, for a fetch nothing in this project's support matrix
	 * performs. Starts mattering the day some consumer of this bundle DOES resolve an external DTD, or
	 * the file is ever served as a navigable document without that header. */
	for (const n of [ ...doc.childNodes ])
		if (n.nodeType === Node.PROCESSING_INSTRUCTION_NODE) { n.remove(); elements++; }

	/* Snapshot before mutating: querySelectorAll answers once, and removing a bad element also
	 * detaches everything under it — `isConnected` is how the loop tells a still-live descendant
	 * from one whose parent already left in an earlier turn of this same loop. */
	const els = [ root ].concat([ ...root.querySelectorAll('*') ]);
	for (const el of els) {
		if (el !== root && !el.isConnected) continue;
		/* localName, never nodeName: in an XML document nodeName carries the namespace PREFIX, so
		 * `<s:script xmlns:s="http://www.w3.org/2000/svg">` reads as `s:script` and walks straight
		 * past a list of names — measured executing on all three engines, as does the same element
		 * put in the xhtml namespace. localName is `script` for every one of those spellings. */
		if (PAT_BAD_TAGS.indexOf((el.localName || el.nodeName).toLowerCase()) >= 0) {
			el.remove();
			elements++;
			continue;
		}
		/* A snapshot, not a live walk: removing an attribute while indexing the live NamedNodeMap
		 * shifts every index after it, the same trap a live NodeList sets for element removal above. */
		const attrs = [];
		for (let i = 0; el.attributes && i < el.attributes.length; i++)
			attrs.push({ name: el.attributes[i].name, value: el.attributes[i].value });
		for (const a of attrs) {
			const n = a.name.toLowerCase();
			const v = String(a.value || '').trim();
			/* a REAL handler is `on` + letters and nothing else; `only_selected` is not one. The
			 * qualified name is right here, unlike on the element above: a prefixed `s:onload` or
			 * `xlink:onload` fires on none of the three engines, so matching localName would only
			 * strip attributes that do nothing.
			 * Verified in the 2026-09 security review, including the case where the prefix is bound
			 * right back to the SVG namespace itself (`s:onload` under `xmlns:s="…/2000/svg"`): SVG
			 * defines its event-handler attributes in NO namespace at all, not "the SVG namespace",
			 * so a prefixed spelling never binds as a listener regardless of what the prefix
			 * resolves to. That is a platform guarantee, not this file's, and would stop holding only
			 * if some future consumer bound SVG event attributes by namespace instead of the empty
			 * one the spec gives them — a change to how SVG itself is interpreted, not something a
			 * check here could see coming or catch. */
			if ((/^on[a-z]+$/).test(n)) { el.removeAttribute(a.name); refs++; continue; }
			/* Residual, verified NOT exploitable here (2026-09 security review): XML attribute-value
			 * normalisation does not fold a numeric character reference the way HTML does, so
			 * `href="javas&#9;cript:alert(1)"` reaches `v` as a DOM string with a LITERAL TAB still in
			 * it — `/^javascript:/i` does not match a value starting with a control character, and the
			 * fixture round-trips through `XMLSerializer` byte for byte, so it survives both this
			 * filter and the serializer. It still resolves to `javascript:` in a real browser, because
			 * a URL parser strips TAB/LF/CR from the scheme before comparing it (WHATWG URL, "scheme
			 * start state") — the same class of hole every naive `^scheme:` regex has. Not closed:
			 * matching every control character a URL parser discards is the grammar-guessing this file
			 * exists to avoid, for a value that never resolves as a URL here in the first place — this
			 * bundle only ever leaves the router as `mask-image`/`background-image`/`<img>`, none of
			 * which reads `href` as navigable, and the CGI serving it back for a direct open sends
			 * `Content-Security-Policy: default-src 'none'; sandbox` regardless. Starts mattering the
			 * day the tile is served without that header, or inlined into a page rather than
			 * referenced as an image. */
			if ((/^javascript:/i).test(v)) { el.removeAttribute(a.name); refs++; continue; }
			/* Security review finding (LOW): `xml:base` (XML Base, W3C) is not itself a reference —
			 * it changes what every RELATIVE one in the subtree UNDER IT resolves against. A perfectly
			 * relative `href="x.png"` inside `<svg xml:base="http://evil.example/">` fetches from
			 * evil.example, and the href check below never sees an absolute URL to catch, because
			 * there isn't one in that attribute — the base moved instead. Removing the ONE attribute
			 * that redirects resolution closes href, xlink:href and a `style` url()'s base alike at
			 * once, the same way `<style>` above is removed whole rather than parsed for a safe half:
			 * a tile has no legitimate use for an alternate base either. Checked on EVERY element via
			 * this same walk, not only the root — XML Base is re-settable at any depth. Matched on the
			 * literal `xml:` prefix, not a resolved namespace, same as every other attribute check
			 * here: `xml` needs no `xmlns:xml` declaration to mean this (Namespaces in XML §4), so the
			 * qualified name alone is the realistic case; an export that goes on to alias some OTHER
			 * prefix to the XML namespace just to carry it is a narrower attack this does not chase,
			 * consistent with this file avoiding a second grammar it would have to maintain. */
			if (n === 'xml:base') { el.removeAttribute(a.name); refs++; continue; }
			/* Residual, verified NOT exploitable here (2026-09 security review): the branch below is
			 * the ONLY place a `url(` is ever inspected. A PRESENTATION ATTRIBUTE that takes the same
			 * function — `fill`, `stroke`, `filter`, `clip-path`, `mask`, `cursor` (SVG 1.1 §11, §15) —
			 * is a plain attribute value to this walk, not a CSS declaration, so `<rect
			 * fill="url(//evil.example/x.svg#g)"/>` matches nothing above and passes with its ORIGINAL
			 * bytes untouched. What it can do is start a second fetch — no script, no navigation,
			 * exactly the reach `_externalStyleRef` already closes for `style` — and that fetch runs
			 * only where the SVG is rendered with its own resource-loading context, which this bundle
			 * never is: it is only ever a `mask-image`/`background-image`/`<img>` source, and a direct
			 * open is answered by the CGI's `Content-Security-Policy: default-src 'none'; sandbox`
			 * regardless. Not closed: doing here what `_sanitizeStyleValue` does for `style` means the
			 * same check against every presentation attribute the SVG spec lets carry a `url()`, a list
			 * this file would then have to track as the spec grows it — the grammar this file exists to
			 * avoid guessing at, moved from one attribute to a dozen. Starts mattering the day a
			 * presentation `url()` gets a fetch path this parser-only pass does not already block by
			 * other means, or the tile stops being image-only. */
			if (n === 'style') {
				const cleaned = _sanitizeStyleValue(v);
				if (cleaned.removed) {
					if (cleaned.value.trim()) el.setAttribute(a.name, cleaned.value);
					else el.removeAttribute(a.name);
					refs += cleaned.removed;
				}
				continue;
			}
			if ((/(?:^|:)href$/).test(n)) {
				/* off-router reference (a leading `//` is protocol-relative and just as external), or
				 * a scheme that can carry a second document behind what looks like a same-document
				 * reference — see the comment above PAT_BAD_TAGS for why this is a blanket removal
				 * and not a MIME-token check. */
				if ((/^(?:[a-z][a-z0-9+.-]*:)?\/\//i).test(v) || (/^(?:data|blob|about):/i).test(v))
					{ el.removeAttribute(a.name); refs++; }
			}
		}
	}

	if (!(elements + refs)) return { text };			/* untouched: hand back the ORIGINAL bytes */
	if (!root.children || root.children.length === 0) return { error: MSG_NOTHING_LEFT };
	return { text: new XMLSerializer().serializeToString(doc), elements, refs };
}

/* read the picked file as text so it can be inspected before upload, and so what reaches the
 * router is exactly the bytes that were checked */
function _readText(file) {
	return new Promise((resolve, reject) => {
		const fr = new FileReader();
		fr.onload = () => resolve(String(fr.result || ''));
		fr.onerror = () => reject(new Error(_('That file could not be read.', 'footstrap')));
		fr.readAsText(file);
	});
}

/* ---- login/page background upload: router-side, and deliberately not an axis ----
 * The other axes are per-browser with a router default; this one has no browser layer. An admin
 * uploads an image once, it becomes the router-wide background for every device and shows
 * pre-login, so it is absent from AXIS_KEYS, snapshotAxes() and matchesSavedDefault() — it must not
 * move the Save button — and needs no factory, so tools/axes.mjs never sees it.
 *
 * The image is a served file, uhttpd having no gzip to make inlining it in every <head> viable;
 * only its cache-bust token lives in uci -> window.__fsSD -> the url() head.ut stamps. The path is
 * a fixed server-side constant matched exactly by the rpcd ACL, so nothing user-controlled reaches
 * a path. */
const BG_PATH  = '/etc/footstrap/login-bg';		/* cgi-upload target; the ACL grants exactly this */
const BG_MAX_SIDE = 1920;						/* cap the longest side — a router serves this off flash with no gzip, and 1080p covers the screens LuCI is actually admin'd from; still crisp full-screen, far fewer flash/wire bytes */
const BG_QUALITY  = 0.9;
const BG_SRC_MAX  = 25 * 1024 * 1024;			/* refuse a source this big before decoding (decode-bomb guard) */
/* No `reject: true` here, unlike every other declare in this file: with it, "the file was already
 * gone" and "the router refused to delete it" arrive as the same Error. Without it the promise
 * resolves with the ubus status as a number, which this code can branch on. */
const _fileRemoveStatus = rpc.declare({ object: 'file', method: 'remove', params: [ 'path' ] });

/* Delete, treating "not found" as done. Anything else is a real refusal (a read-only or full
 * overlay, an immutable flag, a path replaced by a directory) and must not be reported as a
 * removal: the file stays on flash and stays fetchable WITHOUT a session through the /www symlink,
 * which is what an admin removing a background believes they have stopped. */
const UBUS_NOT_FOUND = 4;
function _removeServed(path) {
	return _fileRemoveStatus(path).then((res) => {
		const code = (typeof res === 'number') ? res : parseInt(res, 10);
		if (code === 0 || code === UBUS_NOT_FOUND || isNaN(code)) return;
		return Promise.reject(new Error(
			_('The router refused to delete the file (ubus status %d).', 'footstrap').format(code)));
	});
}
/* cgi-upload writes the file 0600 and uhttpd refuses to serve a file that is not world-readable
 * (0600 -> 403, 0644 -> 200), so make it 0644 first. The rpcd ACL grants exec on exactly two fixed
 * commands — chmod 644 on the two files this module uploads — with no caller-controlled
 * argument. */
const _fileExec = rpc.declare({ object: 'file', method: 'exec', params: [ 'command', 'params' ], reject: true });
/* …and the ubus status is only half of it: `file.exec` reports the command's exit status inside the
 * payload, so a chmod that ran and failed still comes back as a successful call — and the upload
 * then reports success for a file uhttpd will 403, leaving every device a scrim over nothing. */
function _chmodServeable(path) {
	return _fileExec('/bin/chmod', [ '644', path ]).then((res) => {
		if (res && res.code)
			throw new Error(MSG_UPLOAD_FAILED + ' (chmod ' + res.code + ')');
		return res;
	});
}
/* Re-encode the picked image to a bounded JPEG on a canvas. A security step as much as a size one:
 * the canvas keeps only the decoded pixels, so EXIF and any bytes appended past the image are
 * dropped and the uploaded blob is exactly what the browser drew.
 *
 * The whole body is guarded, because a throw inside an event handler does not reject the promise it
 * sits in — it escapes as an uncaught error and leaves the promise pending forever. Two real ways
 * out of `onload`: `getContext('2d')` answers null when the canvas cannot be backed, and
 * drawImage/toBlob can throw. A pending promise leaves the caller's "Uploading…" button disabled
 * and lying until the form is rebuilt on a later arrival at the page. */
function _downscale(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			try {
				const scale = Math.min(1, BG_MAX_SIDE / Math.max(img.width, img.height));
				const w = Math.max(1, Math.round(img.width * scale));
				const h = Math.max(1, Math.round(img.height * scale));
				const cv = document.createElement('canvas');
				cv.width = w; cv.height = h;
				const ctx = cv.getContext('2d');
				if (!ctx) throw new Error('no 2d context');
				ctx.drawImage(img, 0, 0, w, h);
				cv.toBlob((blob) => blob ? resolve(blob) : reject(new Error(MSG_BAD_IMAGE)),
					'image/jpeg', BG_QUALITY);
			} catch (e) { reject(new Error(MSG_BAD_IMAGE)); }
		};
		img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(_('That file is not a readable image.', 'footstrap'))); };
		img.src = url;
	});
}

/* An upload that has landed but could not be RECORDED must not stay on the router. The two paths
 * below write the file first and the token second, and the second half can fail on its own (no
 * `settings` section, a narrowed uci ACL, ubus busy) — the image then sits at mode 0644 and is
 * served to anyone through the /www symlink, which does not depend on the token, while Remove is
 * hidden precisely because the token is empty. Roll the file back and report the failure that
 * started it; a rollback that itself fails is appended, because the admin has to know the file is
 * there. */
function _rollbackUpload(path, cause) {
	return _removeServed(path).then(
		() => Promise.reject(cause),
		() => Promise.reject(new Error(String((cause && cause.message) || cause) + ' — '
			+ _('the uploaded file could not be removed either; it is still on the router.', 'footstrap')))
	);
}

/* ---- one upload, two assets ----
 *
 * Both wallpapers travel the same road: refuse what should not be sent, turn the picked file into
 * the bytes that will actually be stored, POST them to cgi-upload, take the md5 `checksum` back as
 * the cache-bust token, make the file servable, write the token to uci, and only then paint it.
 * Every step of that was written out twice, and the two copies had already drifted — one quoted
 * the url() it wrote with `"` and the other with `'`.
 *
 * What genuinely differs is one function: what `prepare` hands back to be uploaded. The SVG is read
 * as text and inspected, because an SVG is a document and the check has to see the parsed tree; the
 * photo is redrawn on a canvas, which both bounds it and drops EXIF, because a raster has nothing
 * to inspect. Everything either side of that is the same road.
 *
 * `rollback` is the reason the order matters. The bytes land before the token does, and the second
 * half can fail on its own — no `settings` section, a narrowed uci ACL, ubus busy — leaving a file
 * at 0644 served through the /www symlink while Remove stays hidden, because Remove keys off the
 * token being non-empty. So a failure after the write takes the file away again. */
function assetAxis(o) {
	const upload = (file) => Promise.resolve()
		.then(() => o.prepare(file))
		.then((blob) => {
			const fd = new FormData();
			fd.append('sessionid', rpc.getSessionID());
			fd.append('filename', o.path);
			fd.append('filedata', blob, o.filename);
			return fetch(L.env.cgi_base + '/cgi-upload',
				{ method: 'POST', body: fd, credentials: 'same-origin' })
				.then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
		})
		.then((reply) => {
			/* cgi-upload answers { name, size, checksum, sha256sum } or { failure: [code, msg] } */
			if (!reply || reply.failure)
				return Promise.reject(new Error((reply && reply.failure && reply.failure[1])
					|| MSG_UPLOAD_FAILED));
			const tok = String(reply.checksum || '').toLowerCase();
			if (!axes.tokenOk(tok)) return Promise.reject(new Error(MSG_UPLOAD_FAILED));
			/* cgi-upload writes 0600 and uhttpd refuses to serve a file that is not world-readable
			 * (0600 -> 403, 0644 -> 200); _chmodServeable checks the command's exit status, not
			 * just the ubus call's */
			return _chmodServeable(o.path)
				/* uci gets the token and nothing else: putting a file on the router is not the same
				 * act as making every other device paint it */
				.then(() => _uciSet('footstrap', 'settings', { [o.field]: tok }))
				.then(() => _uciCommit('footstrap'))
				.catch((e) => _rollbackUpload(o.path, e))
				.then(() => {
					/* switch this browser onto it: the ordinary axis path, localStorage only */
					axes.applyWallpaper(o.wallpaper);
					o.apply(tok);
					return tok;
				});
		});

	/* Remove: delete the file, blank the token (uci `set` to '', not delete — the scoped ACL grants
	 * set/commit only), clear the url() live. */
	const remove = () => _removeServed(o.path)
		.then(() => _uciSet('footstrap', 'settings', { [o.field]: '' }))
		.then(() => _uciCommit('footstrap'))
		.then(() => { o.apply(''); });

	return { upload, remove };
}

/* The tile. No canvas step, which is what strips a photo's EXIF: an SVG redrawn to a canvas comes
 * back a raster, so the parsed-document check above stands in for it. */
const PATTERN = assetAxis({
	path: PAT_PATH, filename: 'pattern.svg', field: 'pattern', wallpaper: 'pattern',
	apply: (tok) => axes.applyPattern(tok),
	prepare: (file) => {
		if (!file) return Promise.reject(new Error(MSG_PICK_SVG));
		const isSvg = (/(^image\/svg\+xml$)/i).test(file.type || '') || (/\.svg$/i).test(file.name || '');
		if (!isSvg) return Promise.reject(new Error(MSG_PICK_SVG));
		if (file.size > PAT_MAX) return Promise.reject(new Error(_('That file is too large.', 'footstrap')));
		return _readText(file).then((text) => {
			const cleaned = _sanitizeSvg(text);
			if (cleaned.error) return Promise.reject(new Error(cleaned.error));
			/* Told once, here, regardless of whether the upload that follows succeeds — what left
			 * the file is true independently of the network call, and `prepare()` has no channel
			 * back to the caller past the Blob it returns. `ui.addNotification` is the stock banner
			 * every other runtime notice in the theme already uses (fs-router.js). */
			if (cleaned.elements || cleaned.refs)
				ui.addNotification(null, E('p', {}, [ MSG_SANITIZED.format(cleaned.elements, cleaned.refs) ]), 'info');
			return new Blob([ cleaned.text ], { type: 'image/svg+xml' });
		});
	}
});

/* The photo. cgi-upload is the endpoint L.ui.uploadFile uses — session in the `sessionid` field,
 * path in `filename`, bytes in `filedata` — and it authorises the write against the ACL's `file`
 * grant for BG_PATH. */
const LOGIN_BG = assetAxis({
	path: BG_PATH, filename: 'login-bg', field: 'login_bg', wallpaper: 'file',
	apply: (tok) => axes.applyLoginBg(tok),
	prepare: (file) => {
		if (!file || !(/^image\//).test(file.type || ''))
			return Promise.reject(new Error(_('Please choose an image file.', 'footstrap')));
		if (file.size > BG_SRC_MAX)
			return Promise.reject(new Error(_('That image is too large.', 'footstrap')));
		return _downscale(file);
	}
});


return baseclass.extend({
	uploadPattern: PATTERN.upload,
	removePattern: PATTERN.remove,
	uploadLoginBg: LOGIN_BG.upload,
	removeLoginBg: LOGIN_BG.remove,
});
