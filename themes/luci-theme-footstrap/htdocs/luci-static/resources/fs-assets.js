'use strict';
'require baseclass';
'require rpc';
'require ui';
'require fs-axes as axes';

/* fs-assets — putting a file on the router and taking it off again: the pattern and login-photo uploads,
 * the SVG sanitizer, the rollback. A module of its own: only the Appearance page needs these ~4 KB. */

/* Hoisted: a string literal is not mangled, so each repeat is paid on flash; msgid stays literal
 * for update-po.sh. */
const MSG_UPLOAD_FAILED = _('Upload failed.', 'footstrap');
const MSG_NOT_SVG = _('That file is not an SVG image.', 'footstrap');
const MSG_BAD_IMAGE = _('Could not process the image.', 'footstrap');
const MSG_PICK_SVG = _('Please choose an SVG file.', 'footstrap');
/* One template, two numbers: a translator places both %d in one sentence instead of agreeing
 * plurals. */
const MSG_SANITIZED = _('Cleaned before upload: removed %d unsafe element(s) and %d external reference(s).', 'footstrap');
const MSG_NOTHING_LEFT = _('That SVG had nothing left once the unsafe parts were removed.', 'footstrap');

/* ---- the pattern: an SVG the admin uploads, tiled and recoloured ----
 * Fixed path matched by the rpcd ACL, under /etc so an upgrade keeps it. Not the security boundary: a
 * `curl` to cgi-upload skips every check below; a direct open is stopped by the CGI's
 * `Content-Security-Policy: default-src 'none'; sandbox`. */
const PAT_PATH  = '/etc/footstrap/pattern.svg';			/* cgi-upload target; the ACL grants exactly this */
const PAT_MAX   = 512 * 1024;							/* a tile that has to reach a router's flash and then every page load */
/* What `_sanitizeSvg` removes, judged on the parsed document, not the text. Painted as an image nothing
 * loads; these rules cover a direct open of the file:
 *  - elements: only the SVG namespace stays (`<h:frame src="javascript:…">` ran same-origin), minus
 *    script, foreignObject, a `<style>` with an element or off-document ref, an animation whose
 *    attributeName is a URL attribute (SMIL retargets it at run time)
 *  - href, xlink:href, ping: a `#fragment`, or a raster `data:` on an `<image>`; else removed
 *  - on* and `xml:base` removed; `style` and un-namespaced attributes by `_externalStyleRef` */
const PAT_BAD_TAGS = [ 'script', 'foreignobject' ];
const PAT_ANIM_TAGS = [ 'animate', 'set', 'animatetransform', 'animatemotion', 'animatecolor' ];
const PAT_URL_ATTR = /(?:^|:)(?:href|ping)$/;
const PAT_RASTER_DATA = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp)[;,]/i;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* CSS Syntax §4.3.7: `\` + 1-6 hex digits (+ one whitespace) is a code point, so `u\72l(` is
 * `url(`; decode first. */
function _cssUnescape(v) {
	/* §3.3 folds CR LF to LF first, so one whitespace ends `\72<CR><LF>`; unfolded,
	 * `u\72<CR><LF>l(` hid a `url(`. */
	v = v.replace(/\r\n?|\f/g, '\n');
	/* U+FFFD for zero, a surrogate or > U+10FFFF: fromCodePoint throws on `\FFFFFF`. */
	return v.replace(/\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([^\r\n\f])/g, (m, hex, lit) => {
		if (hex === undefined) return lit;
		const cp = parseInt(hex, 16);
		return String.fromCodePoint(cp === 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF) ? 0xFFFD : cp);
	});
}

/* True if CSS text (a declaration or a whole <style>) reaches off this document. `url(` is matched
 * everywhere. Whitespace is CSS's — space, TAB, LF, CR, FF; `\s` also takes NBSP, which CSS keeps in the
 * URL (a fetch of /%C2%A0). `url(`/`expression(` allow space before `(`; `image (` is no function. */
function _externalStyleRef(v) {
	v = _cssUnescape(v);
	if ((/@import\b/i).test(v) || (/expression[ \t\n\r\f]*\(/i).test(v) || (/(?:image-set|cross-fade|image|src)\(/i).test(v)) return true;
	const urlRe = /url[ \t\n\r\f]*\([ \t\n\r\f]*(['"]?)[ \t\n\r\f]*([^) \t\n\r\f'"]*)/gi;
	let m;
	while ((m = urlRe.exec(v)) !== null)
		if (m[2].charAt(0) !== '#') return true;
	return false;
}

/* A `style` minus its off-document declarations: one Inkscape export carried 278 style attributes,
 * none external. */
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

/* One walk judges and cleans, so two traversals cannot disagree. `text` is the original when nothing was
 * removed: an XMLSerializer round-trip rewrites namespaces. */
function _sanitizeSvg(text) {
	const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
	const root = doc.documentElement;
	/* An SVG is its root's namespace, not its spelling: `<svg xmlns=xhtml>` is an executing XHTML
	 * document. */
	if (!root || doc.querySelector('parsererror') ||
		root.localName.toLowerCase() !== 'svg' || root.namespaceURI !== SVG_NS)
		return { error: MSG_NOT_SVG };

	let elements = 0, refs = 0;

	/* A PI can attach an XSLT stylesheet whose output this walk never sees (executes on Firefox). */

	/* An external-DTD DOCTYPE is left: no engine resolves it, and the CSP answers a direct open. */
	for (const n of [ ...doc.childNodes ])
		if (n.nodeType === Node.PROCESSING_INSTRUCTION_NODE) { n.remove(); elements++; }

	/* Snapshot first: removing a node detaches its subtree; isConnected skips it. */
	const els = [ root ].concat([ ...root.querySelectorAll('*') ]);
	for (const el of els) {
		if (el !== root && !el.isConnected) continue;
		/* localName, never nodeName: the prefix hid `s:script` from a name list (executing on 3
		 * engines). */
		const tag = el.localName.toLowerCase();
		/* A browser reads a <style> from its direct text children and steps over an element:
		 * `@imp<x>z</x>ort` is `@import` to it and `@impzort` to textContent: an element removes it,
		 * else textContent is those children. */
		if (el.namespaceURI !== SVG_NS || PAT_BAD_TAGS.indexOf(tag) >= 0 ||
			(PAT_ANIM_TAGS.indexOf(tag) >= 0 &&
				PAT_URL_ATTR.test(String(el.getAttribute('attributeName') || '').trim().toLowerCase())) ||
			(tag === 'style' && (el.children.length || _externalStyleRef(String(el.textContent || ''))))) {
			el.remove();
			elements++;
			continue;
		}
		/* Snapshot: removing while indexing the live NamedNodeMap shifts the indexes. */
		for (const a of Array.from(el.attributes)) {
			const n = a.name.toLowerCase();
			const raw = a.value;
			const v = raw.trim();
			/* A real handler is `on` + letters (`only_selected` is not); a prefixed `s:onload`
			 * binds nothing. */
			if ((/^on[a-z]+$/).test(n)) { el.removeAttribute(a.name); refs++; continue; }
			/* `xml:base` moves what every relative reference below it resolves against, even `#g`;
			 * removed on every element. */
			if (n === 'xml:base') { el.removeAttribute(a.name); refs++; continue; }
			if (n === 'style') {
				const cleaned = _sanitizeStyleValue(v);
				if (cleaned.removed) {
					if (cleaned.value.trim()) el.setAttribute(a.name, cleaned.value);
					else el.removeAttribute(a.name);
					refs += cleaned.removed;
				}
				continue;
			}
			if (PAT_URL_ATTR.test(n)) {
				/* Allowlist, case-sensitive as XML. Strip as the URL parser does: every TAB/LF/CR, then
				 * leading spaces (XML 1.0 admits no other C0 control); trim() also takes NBSP and U+FEFF,
				 * which the parser keeps. */
				const u = raw.replace(/[\t\n\r]/g, '').replace(/^ +/, '');
				if (u.charAt(0) !== '#' && !(el.localName === 'image' && PAT_RASTER_DATA.test(u)))
					{ el.removeAttribute(a.name); refs++; }
			} else if (n.indexOf(':') < 0 && _externalStyleRef(v)) { el.removeAttribute(a.name); refs++; }
		}
	}

	if (!(elements + refs)) return { text };			/* untouched: hand back the original bytes */
	if (root.children.length === 0) return { error: MSG_NOTHING_LEFT };
	return { text: new XMLSerializer().serializeToString(doc), elements, refs };
}

/* ---- login/page background upload: router-side, and not an axis ----
 * One router-wide image shown pre-login: absent from AXIS_KEYS, snapshotAxes() and matchesSavedDefault()
 * so it never moves Save. Only its cache-bust token lives in uci -> window.__fsSD -> head.ut. */
const BG_PATH  = '/etc/footstrap/login-bg';		/* cgi-upload target; the ACL grants exactly this */
const BG_MAX_SIDE = 1920;						/* longest side: 1080p covers the screens LuCI is administered from */
const BG_QUALITY  = 0.9;
const BG_SRC_MAX  = 25 * 1024 * 1024;			/* refuse a source this big before decoding */
/* No `reject: true`: it would make "already gone" and "refused" the same Error. */
const _fileRemoveStatus = rpc.declare({ object: 'file', method: 'remove', params: [ 'path' ] });

/* "Not found" counts as done; any other refusal must surface: the file stays fetchable via /www. */
const UBUS_NOT_FOUND = 4;
function _removeServed(path) {
	return _fileRemoveStatus(path).then((res) => {
		if (res === 0 || res === UBUS_NOT_FOUND) return;
		return Promise.reject(new Error(
			_('The router refused to delete the file (ubus status %d).', 'footstrap').format(res)));
	});
}
/* Re-encode to a bounded JPEG: only decoded pixels survive (no EXIF). A throw inside onload would
 * leave the promise pending. */
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

/* An upload that could not be recorded would stay served via /www with Remove hidden: roll it back. */
function _rollbackUpload(path, cause) {
	return _removeServed(path).then(
		() => Promise.reject(cause),
		() => Promise.reject(new Error(String((cause && cause.message) || cause) + ' — '
			+ _('the uploaded file could not be removed either; it is still on the router.', 'footstrap')))
	);
}

/* ---- one upload, two assets ----
 * Both: `prepare` the bytes, POST, take the md5 as cache-bust token, write it to uci, paint. Bytes
 * land before the token, so a later failure rolls back. */
function assetAxis(o) {
	const upload = (file) => Promise.resolve()
		.then(() => o.prepare(file))
		.then((blob) => {
			const fd = new FormData();
			fd.append('sessionid', rpc.getSessionID());
			fd.append('filename', o.path);
			/* cgi-io writes 0600 and uhttpd 403s that; filemode makes it chmod 644 itself, inside its ACL check */
			fd.append('filemode', '644');
			fd.append('filedata', blob, o.filename);
			return fetch(L.env.cgi_base + '/cgi-upload',
				{ method: 'POST', body: fd, credentials: 'same-origin' })
				.then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
		})
		.then((reply) => {
			/* cgi-upload answers { name, size, checksum, sha256sum } or { failure: [code, msg] }; a failed
			 * chmod leaves the file in place, so only that message rolls back */
			if (reply && reply.message === 'Failed to chmod target file')
				return _rollbackUpload(o.path, new Error(MSG_UPLOAD_FAILED));
			if (!reply || reply.failure)
				return Promise.reject(new Error((reply && reply.failure && reply.failure[1])
					|| MSG_UPLOAD_FAILED));
			const tok = String(reply.checksum || '').toLowerCase();
			if (!axes.tokenOk(tok)) return Promise.reject(new Error(MSG_UPLOAD_FAILED));
			/* uci gets the token only: uploading is not making every device paint it */
			return axes.saveSettings({ [o.field]: tok })
				.catch((e) => _rollbackUpload(o.path, e))
				/* an upload never touches the Wallpaper axis: the dropdown alone sets it */
				.then(() => { o.apply(tok); return tok; });
		});

	/* Remove: delete the file, blank the token (the scoped ACL grants set/commit only), clear the
	 * url(). */
	const remove = () => _removeServed(o.path)
		.then(() => axes.saveSettings({ [o.field]: '' }))
		.then(() => { o.apply(''); });

	return { upload, remove };
}

/* The tile: no canvas step (it would return a raster); the parsed check stands in. */
const PATTERN = assetAxis({
	path: PAT_PATH, filename: 'pattern.svg', field: 'pattern',
	apply: (tok) => axes.pattern.apply(tok),
	prepare: (file) => {
		const isSvg = (/^image\/svg\+xml$/i).test(file.type || '') || (/\.svg$/i).test(file.name || '');
		if (!isSvg) return Promise.reject(new Error(MSG_PICK_SVG));
		if (file.size > PAT_MAX) return Promise.reject(new Error(_('That file is too large.', 'footstrap')));
		/* same message: what reaches the router is the bytes that were checked */
		const readErr = () => Promise.reject(new Error(_('That file could not be read.', 'footstrap')));
		return file.text().catch(readErr).then((text) => {
			const cleaned = _sanitizeSvg(text);
			if (cleaned.error) return Promise.reject(new Error(cleaned.error));
			/* Told once, whether or not the upload succeeds; `prepare()` has no channel back past
			 * its Blob. */
			if (cleaned.elements || cleaned.refs)
				ui.addNotification(null, E('p', {}, [ MSG_SANITIZED.format(cleaned.elements, cleaned.refs) ]), 'info');
			return new Blob([ cleaned.text ], { type: 'image/svg+xml' });
		});
	}
});

/* The photo: cgi-upload is L.ui.uploadFile's endpoint, authorised by the ACL for BG_PATH. */
const LOGIN_BG = assetAxis({
	path: BG_PATH, filename: 'login-bg', field: 'login_bg',
	apply: (tok) => axes.loginBg.apply(tok),
	prepare: (file) => {
		if (!(/^image\//).test(file.type || ''))
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
