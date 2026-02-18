/*
	LuCI - Lua Configuration Interface

	Copyright 2008 Steven Barth <steven@midlink.org>
	Copyright 2008-2018 Jo-Philipp Wich <jo@mein.io>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
*/

/**
 * CBI (Configuration Bindings Interface) helper utilities and DOM helpers.
 *
 * Provides initialization for CBI UI elements, dependency handling,
 * validation wiring and miscellaneous helpers used by LuCI forms. Functions
 * defined here are registered as global `window.*` symbols.
 * @module LuCI.cbi
 */
const cbi_d = [];
const cbi_strings = { path: {}, label: {} };

/**
 * Read signed 8-bit integer from a byte array at the given offset.
 * @param {Array<number>} bytes - Byte array.
 * @param {number} off - Offset into the array.
 * @returns {number} Signed 8-bit value (returned as unsigned number).
 */
function s8(bytes, off) {
	const n = bytes[off];
	return (n > 0x7F) ? (n - 256) >>> 0 : n;
}

/**
 * Read unsigned 16-bit little-endian integer from a byte array at offset.
 * @param {Array<number>} bytes - Byte array.
 * @param {number} off - Offset into the array.
 * @returns {number} Unsigned 16-bit integer.
 */
function u16(bytes, off) {
	return ((bytes[off + 1] << 8) + bytes[off]) >>> 0;
}

/**
 * Compute a stable 32-bit-ish string hash used for translation keys.
 * Encodes UTF-8 surrogate pairs and mixes bytes into a hex hash string.
 * @param {string|null} s - Input string.
 * @returns {string|null} Hex hash string or null for empty input.
 */
function sfh(s) {
	if (s === null || s.length === 0)
		return null;

	const bytes = [];

	for (let i = 0; i < s.length; i++) {
		let ch = s.charCodeAt(i);

		// Handle surrogate pairs
		if (ch >= 0xD800 && ch <= 0xDBFF && i + 1 < s.length) {
			const next = s.charCodeAt(i + 1);
			if (next >= 0xDC00 && next <= 0xDFFF) {
				ch = 0x10000 + ((ch - 0xD800) << 10) + (next - 0xDC00);
				i++;
			}
		}

		if (ch <= 0x7F)
			bytes.push(ch);
		else if (ch <= 0x7FF)
			bytes.push(((ch >>>  6) & 0x1F) | 0xC0,
			           ( ch         & 0x3F) | 0x80);
		else if (ch <= 0xFFFF)
			bytes.push(((ch >>> 12) & 0x0F) | 0xE0,
			           ((ch >>>  6) & 0x3F) | 0x80,
			           ( ch         & 0x3F) | 0x80);
		else if (ch <= 0x10FFFF)
			bytes.push(((ch >>> 18) & 0x07) | 0xF0,
			           ((ch >>> 12) & 0x3F) | 0x80,
			           ((ch >>   6) & 0x3F) | 0x80,
			           ( ch         & 0x3F) | 0x80);
	}

	if (!bytes.length)
		return null;

	let hash = (bytes.length >>> 0);
	let len = (bytes.length >>> 2);
	let off = 0, tmp;

	while (len--) {
		hash += u16(bytes, off);
		tmp   = ((u16(bytes, off + 2) << 11) ^ hash) >>> 0;
		hash  = ((hash << 16) ^ tmp) >>> 0;
		hash += hash >>> 11;
		off  += 4;
	}

	switch ((bytes.length & 3) >>> 0) {
	case 3:
		hash += u16(bytes, off);
		hash  = (hash ^ (hash << 16)) >>> 0;
		hash  = (hash ^ (s8(bytes, off + 2) << 18)) >>> 0;
		hash += hash >>> 11;
		break;

	case 2:
		hash += u16(bytes, off);
		hash  = (hash ^ (hash << 11)) >>> 0;
		hash += hash >>> 17;
		break;

	case 1:
		hash += s8(bytes, off);
		hash  = (hash ^ (hash << 10)) >>> 0;
		hash += hash >>> 1;
		break;
	}

	hash  = (hash ^ (hash << 3)) >>> 0;
	hash += hash >>> 5;
	hash  = (hash ^ (hash << 4)) >>> 0;
	hash += hash >>> 17;
	hash  = (hash ^ (hash << 25)) >>> 0;
	hash += hash >>> 6;

	return (0x100000000 + hash).toString(16).slice(1);
}

var plural_function = null;

/**
 * Trim whitespace and normalise internal whitespace sequences to single spaces.
 * @param {*} s - Value to convert to string and trim.
 * @returns {string} Trimmed and normalised string.
 */
function trimws(s) {
	return String(s).trim().replace(/[ \t\n]+/g, ' ');
}

/**
 * Lookup a translated string for the given message and optional context.
 * Falls back to the source string when no translation found.
 * @param {string} s - Source string.
 * @param {string} [c] - Optional translation context.
 * @returns {string} Translated string or original.
 */
function _(s, c) {
	var k = (c != null ? trimws(c) + '\u0001' : '') + trimws(s);
	return (window.TR && TR[sfh(k)]) || s;
}

/**
 * Plural-aware translation lookup.
 * @param {number} n - Quantity to evaluate plural form.
 * @param {string} s - Singular string.
 * @param {string} p - Plural string.
 * @param {string} [c] - Optional context.
 * @returns {string} Translated plural form or source string.
 */
function N_(n, s, p, c) {
	if (plural_function == null && window.TR)
		plural_function = new Function('n', (TR['00000000'] || 'plural=(n != 1);') + 'return +plural');

	var i = plural_function ? plural_function(n) : (n != 1),
	    k = (c != null ? trimws(c) + '\u0001' : '') + trimws(s) + '\u0002' + i.toString();

	return (window.TR && TR[sfh(k)]) || (i ? p : s);
}


/**
 * Register a dependency entry for a field.
 * @param {HTMLElement|string} field - Field element or its id.
 * @param {Object} dep - Dependency specification object.
 * @param {number} index - Order index of the dependent node.
 */
function cbi_d_add(field, dep, index) {
	var obj = (typeof(field) === 'string') ? document.getElementById(field) : field;
	if (obj) {
		var entry
		for (var i=0; i<cbi_d.length; i++) {
			if (cbi_d[i].id == obj.id) {
				entry = cbi_d[i];
				break;
			}
		}
		if (!entry) {
			entry = {
				"node": obj,
				"id": obj.id,
				"parent": obj.parentNode.id,
				"deps": [],
				"index": index
			};
			cbi_d.unshift(entry);
		}
		entry.deps.push(dep)
	}
}

/**
 * Check whether an input/select identified by target matches the given reference value.
 * @param {string} target - Element id or name to query.
 * @param {string} ref - Reference value to compare with.
 * @returns {boolean} True if the current value matches ref.
 */
function cbi_d_checkvalue(target, ref) {
	var value = null,
	    query = 'input[id="'+target+'"], input[name="'+target+'"], ' +
	            'select[id="'+target+'"], select[name="'+target+'"]';

	document.querySelectorAll(query).forEach(function(i) {
		if (value === null && ((i.type !== 'radio' && i.type !== 'checkbox') || i.checked === true))
			value = i.value;
	});

	return (((value !== null) ? value : "") == ref);
}

/**
 * Evaluate a list of dependency descriptors and return whether any match.
 * @param {Array<Object>} deps - Array of dependency objects to evaluate.
 * @returns {boolean} True when dependencies indicate the element should be shown.
 */
function cbi_d_check(deps) {
	var reverse;
	var def = false;
	for (var i=0; i<deps.length; i++) {
		var istat = true;
		reverse = false;
		for (var j in deps[i]) {
			if (j == "!reverse") {
				reverse = true;
			} else if (j == "!default") {
				def = true;
				istat = false;
			} else {
				istat = (istat && cbi_d_checkvalue(j, deps[i][j]))
			}
		}

		if (istat ^ reverse) {
			return true;
		}
	}
	return def;
}

/**
 * Update DOM nodes based on registered dependencies, showing or hiding
 * nodes and restoring their order when dependency state changes.
 */
function cbi_d_update() {
	var state = false;
	for (var i=0; i<cbi_d.length; i++) {
		var entry = cbi_d[i];
		var node  = document.getElementById(entry.id);
		var parent = document.getElementById(entry.parent);

		if (node && node.parentNode && !cbi_d_check(entry.deps)) {
			node.parentNode.removeChild(node);
			state = true;
		}
		else if (parent && (!node || !node.parentNode) && cbi_d_check(entry.deps)) {
			var next = undefined;

			for (next = parent.firstChild; next; next = next.nextSibling) {
				if (next.getAttribute && parseInt(next.getAttribute('data-index'), 10) > entry.index)
					break;
			}

			if (!next)
				parent.appendChild(entry.node);
			else
				parent.insertBefore(entry.node, next);

			state = true;
		}

		// hide optionals widget if no choices remaining
		if (parent && parent.parentNode && parent.getAttribute('data-optionals'))
			parent.parentNode.style.display = (parent.options.length <= 1) ? 'none' : '';
	}

	if (entry && entry.parent)
		cbi_tag_last(parent);

	if (state)
		cbi_d_update();
	else if (parent)
		parent.dispatchEvent(new CustomEvent('dependency-update', { bubbles: true }));
}

/**
 * Initialize CBI widgets and wire up dependency and validation handlers.
 * Walks the DOM looking for CBI-specific data attributes and replaces
 * placeholders with interactive widgets.
 */
function cbi_init() {
	let nodes;

	document.querySelectorAll('.cbi-dropdown').forEach(function(node) {
		cbi_dropdown_init(node);
		node.addEventListener('cbi-dropdown-change', cbi_d_update);
	});

	nodes = document.querySelectorAll('[data-strings]');

	for (let n of nodes) {
		const str = JSON.parse(n.getAttribute('data-strings'));
		for (let key in str) {
			for (let key2 in str[key]) {
				const dst = cbi_strings[key] || (cbi_strings[key] = { });
				dst[key2] = str[key][key2];
			}
		}
	}

	nodes = document.querySelectorAll('[data-depends]');

	for (let n of nodes) {
		const index = parseInt(n.getAttribute('data-index'), 10);
		const depends = JSON.parse(n.getAttribute('data-depends'));
		if (!isNaN(index) && depends.length > 0) {
			for (let a of depends)
				cbi_d_add(n, depends[a], index);
		}
	}

	nodes = document.querySelectorAll('[data-update]');

	for (let n of nodes) {
		const events = n.getAttribute('data-update').split(' ');
		for (let ev of events)
			n.addEventListener(ev, cbi_d_update);
	}

	nodes = document.querySelectorAll('[data-choices]');

	for (let node of nodes) {
		const choices = JSON.parse(node.getAttribute('data-choices'));
		const options = {};

		for (let j = 0; j < choices[0].length; j++)
			options[choices[0][j]] = choices[1][j];

		const def = (node.getAttribute('data-optional') === 'true')
			? node.placeholder || '' : null;

		const cb = new L.ui.Combobox(node.value, options, {
			name: node.getAttribute('name'),
			sort: choices[0],
			select_placeholder: def || _('-- Please choose --'),
			custom_placeholder: node.getAttribute('data-manual') || _('-- custom --')
		});

		const n = cb.render();
		n.addEventListener('cbi-dropdown-change', cbi_d_update);
		node.parentNode.replaceChild(n, node);
	}

	nodes = document.querySelectorAll('[data-dynlist]');

	for (let node of nodes) {
		const choices = JSON.parse(node.getAttribute('data-dynlist'));
		const values = JSON.parse(node.getAttribute('data-values') || '[]');
		let options = null;

		if (choices[0] && choices[0].length) {
			options = {};

			for (let j = 0; j < choices[0].length; j++)
				options[choices[0][j]] = choices[1][j];
		}

		let dl = new L.ui.DynamicList(values, options, {
			name: node.getAttribute('data-prefix'),
			sort: choices[0],
			datatype: choices[2],
			optional: choices[3],
			placeholder: node.getAttribute('data-placeholder')
		});

		let n = dl.render();
		n.addEventListener('cbi-dynlist-change', cbi_d_update);
		node.parentNode.replaceChild(n, node);
	}

	nodes = document.querySelectorAll('[data-type]');

	for (let node of nodes) {
		cbi_validate_field(node, node.getAttribute('data-optional') === 'true',
		                   node.getAttribute('data-type'));
	}

	document.querySelectorAll('.cbi-tooltip:not(:empty)').forEach(function(s) {
		s.parentNode.classList.add('cbi-tooltip-container');
	});

	document.querySelectorAll('.cbi-section-remove > input[name^="cbi.rts"]').forEach(function(i) {
		let handler = function(ev) {
			var bits = this.name.split(/\./),
			    section = document.getElementById('cbi-' + bits[2] + '-' + bits[3]);

		    section.style.opacity = (ev.type === 'mouseover') ? 0.5 : '';
		};

		i.addEventListener('mouseover', handler);
		i.addEventListener('mouseout', handler);
	});

	var tasks = [];

	document.querySelectorAll('[data-ui-widget]').forEach(function(node) {
		const args = JSON.parse(node.getAttribute('data-ui-widget') || '[]');
		const widget = new (Function.prototype.bind.apply(L.ui[args[0]], args));
		const markup = widget.render();

		tasks.push(Promise.resolve(markup).then(function(markup) {
			markup.addEventListener('widget-change', cbi_d_update);
			node.parentNode.replaceChild(markup, node);
		}));
	});

	Promise.all(tasks).then(cbi_d_update);
}

/**
 * Run all validators associated with a form and optionally show an error.
 * @param {HTMLFormElement} form - Form element containing validators.
 * @param {string} [errmsg] - Message to show when validation fails.
 * @returns {boolean} True when form is valid.
 */
function cbi_validate_form(form, errmsg)
{
	/* if triggered by a section removal or addition, don't validate */
	if (form.cbi_state == 'add-section' || form.cbi_state == 'del-section')
		return true;

	if (form.cbi_validators) {
		for (let fv of form.cbi_validators) {
			const validator = fv;

			if (!validator() && errmsg) {
				alert(errmsg);
				return false;
			}
		}
	}

	return true;
}

/**
 * Enable/disable a named-section add button depending on input value.
 * @param {HTMLInputElement} input - Input that contains the new section name.
 */
function cbi_validate_named_section_add(input)
{
	var button = input.parentNode.parentNode.querySelector('.cbi-button-add');
	button.disabled = input.value === '';
}

/**
 * Trigger a delayed form validation (used to allow UI state to settle).
 * @param {HTMLFormElement} form - Form to validate after a short delay.
 * @returns {boolean} Always returns true.
 */
function cbi_validate_reset(form)
{
	window.setTimeout(
		function() { cbi_validate_form(form, null) }, 100
	);

	return true;
}

/**
 * Attach a validator to a field and wire validation events.
 * @param {HTMLElement|string} cbid - Element or element id to validate.
 * @param {boolean} optional - Whether an empty value is allowed.
 * @param {string} type - Validator type expression (passed to L.validation).
 */
function cbi_validate_field(cbid, optional, type)
{
	var field = isElem(cbid) ? cbid : document.getElementById(cbid);
	var validatorFn;

	try {
		var cbiValidator = L.validation.create(field, type, optional);
		validatorFn = cbiValidator.validate.bind(cbiValidator);
	}
	catch(e) {
		validatorFn = null;
	};

	if (validatorFn !== null) {
		var form = findParent(field, 'form');

		if (!form.cbi_validators)
			form.cbi_validators = [ ];

		form.cbi_validators.push(validatorFn);

		field.addEventListener("blur",  validatorFn);
		field.addEventListener("keyup", validatorFn);
		field.addEventListener("cbi-dropdown-change", validatorFn);

		if (matchesElem(field, 'select')) {
			field.addEventListener("change", validatorFn);
			field.addEventListener("click",  validatorFn);
		}

		validatorFn();
	}
}

/**
 * Move a table row up or down within a section and update the storage field.
 * @param {HTMLElement} elem - Element inside the row that triggers the swap.
 * @param {boolean} up - If true, move the row up; otherwise move down.
 * @param {string} store - ID of the hidden input used to store the order.
 * @returns {boolean} Always returns false to cancel default action.
 */
function cbi_row_swap(elem, up, store)
{
	var tr = findParent(elem.parentNode, '.cbi-section-table-row');

	if (!tr)
		return false;

	tr.classList.remove('flash');

	if (up) {
		var prev = tr.previousElementSibling;

		if (prev && prev.classList.contains('cbi-section-table-row'))
			tr.parentNode.insertBefore(tr, prev);
		else
			return;
	}
	else {
		var next = tr.nextElementSibling ? tr.nextElementSibling.nextElementSibling : null;

		if (next && next.classList.contains('cbi-section-table-row'))
			tr.parentNode.insertBefore(tr, next);
		else if (!next)
			tr.parentNode.appendChild(tr);
		else
			return;
	}

	var ids = [ ];

	for (var i = 0, n = 0; i < tr.parentNode.childNodes.length; i++) {
		var node = tr.parentNode.childNodes[i];
		if (node.classList && node.classList.contains('cbi-section-table-row')) {
			node.classList.remove('cbi-rowstyle-1');
			node.classList.remove('cbi-rowstyle-2');
			node.classList.add((n++ % 2) ? 'cbi-rowstyle-2' : 'cbi-rowstyle-1');

			if (/-([^-]+)$/.test(node.id))
				ids.push(RegExp.$1);
		}
	}

	var input = document.getElementById(store);
	if (input)
		input.value = ids.join(' ');

	window.scrollTo(0, tr.offsetTop);
	void tr.offsetWidth;
	tr.classList.add('flash');

	return false;
}

/**
 * Mark the last visible value container child with class `cbi-value-last`.
 * @param {HTMLElement} container - Parent container element.
 */
function cbi_tag_last(container)
{
	let last;

	for (let cn of container.childNodes) {
		var c = cn;
		if (matchesElem(c, 'div')) {
			c.classList.remove('cbi-value-last');
			last = c;
		}
	}

	if (last)
		last.classList.add('cbi-value-last');
}

/**
 * Submit a form, optionally adding a hidden input to pass a name/value pair.
 * @param {HTMLElement} elem - Element inside the form or an element with a form.
 * @param {string} [name] - Name of hidden input to include, if any.
 * @param {string} [value] - Value for the hidden input (defaults to '1').
 * @param {string} [action] - Optional form action URL override.
 * @returns {boolean} True on successful submit, false when no form found.
 */
function cbi_submit(elem, name, value, action)
{
	const form = elem.form || findParent(elem, 'form');

	if (!form)
		return false;

	if (action)
		form.action = action;

	if (name) {
		var hidden = form.querySelector('input[type="hidden"][name="%s"]'.format(name)) ||
			E('input', { type: 'hidden', name: name });

		hidden.value = value || '1';
		form.appendChild(hidden);
	}

	form.submit();
	return true;
}

/**
 * @external String
 */

/**
 * Format a string using positional arguments.
 * @function format
 * @memberof external:String.prototype
 * @param {...string} args
 * @returns {string}
 */
String.prototype.format = function()
{
	if (!RegExp)
		return;

	const html_esc = [/&/g, '&#38;', /"/g, '&#34;', /'/g, '&#39;', /</g, '&#60;', />/g, '&#62;'];
	const quot_esc = [/"/g, '&#34;', /'/g, '&#39;'];

	/**
	 * Escape a string.
	 * @private
	 * @function esc
	 * @param {string} s
	 * @param {string} r
	 * @returns {string}
	 */
	function esc(s, r) {
		const t = typeof(s);

		if (s == null || t === 'object' || t === 'function')
			return '';

		if (t !== 'string')
			s = String(s);

		for (let i = 0; i < r.length; i += 2)
			s = s.replace(r[i], r[i+1]);

		return s;
	}

	let str = this;
	let subst, n, pad;
	let out = '';
	const re = /^(([^%]*)%('.|0|\x20)?(-)?(\d+)?(\.\d+)?(%|b|c|d|u|f|o|s|x|X|q|h|j|t|m))/;
	let a = [], numSubstitutions = 0;

	while ((a = re.exec(str)) !== null) {
		const m = a[1];
		let leftpart = a[2], pPad = a[3], pJustify = a[4], pMinLength = a[5];
		let pPrecision = a[6], pType = a[7];
		let precision;

		if (pType == '%') {
			subst = '%';
		}
		else {
			if (numSubstitutions < arguments.length) {
				let param = arguments[numSubstitutions++];

				pad = '';
				if (pPad && pPad.substr(0,1) == "'")
					pad = pPad.substr(1,1);
				else if (pPad)
					pad = pPad;
				else
					pad = ' ';

				precision = -1;
				if (pPrecision && pType == 'f')
					precision = +pPrecision.substring(1);

				subst = param;

				switch(pType) {
					case 'b':
						subst = Math.floor(+param || 0).toString(2);
						break;

					case 'c':
						subst = String.fromCharCode(+param || 0);
						break;

					case 'd':
						subst = Math.floor(+param || 0).toFixed(0);
						break;

					case 'u':
						n = +param || 0;
						subst = Math.floor((n < 0) ? 0x100000000 + n : n).toFixed(0);
						break;

					case 'f':
						subst = (precision > -1)
							? ((+param || 0.0)).toFixed(precision)
							: (+param || 0.0);
						break;

					case 'o':
						subst = Math.floor(+param || 0).toString(8);
						break;

					case 's':
						subst = param;
						break;

					case 'x':
						subst = Math.floor(+param || 0).toString(16).toLowerCase();
						break;

					case 'X':
						subst = Math.floor(+param || 0).toString(16).toUpperCase();
						break;

					case 'h':
						subst = esc(param, html_esc);
						break;

					case 'q':
						subst = esc(param, quot_esc);
						break;

					case 't':
						var td = 0;
						var th = 0;
						var tm = 0;
						var ts = (param || 0);

						if (ts > 59) {
							tm = Math.floor(ts / 60);
							ts = (ts % 60);
						}

						if (tm > 59) {
							th = Math.floor(tm / 60);
							tm = (tm % 60);
						}

						if (th > 23) {
							td = Math.floor(th / 24);
							th = (th % 24);
						}

						subst = (td > 0)
							? String.format('%dd %dh %dm %ds', td, th, tm, ts)
							: String.format('%dh %dm %ds', th, tm, ts);

						break;

					case 'm':
						var mf = pMinLength ? +pMinLength : 1000;
						var pr = pPrecision ? ~~(10 * +('0' + pPrecision)) : 2;

						var i = 0;
						var val = (+param || 0);
						var units = [ ' ', ' K', ' M', ' G', ' T', ' P', ' E' ];

						for (i = 0; (i < units.length) && (val > mf); i++)
							val /= mf;

						if (i)
							subst = val.toFixed(pr) + units[i] + (mf == 1024 ? 'i' : '');
						else
							subst = val + ' ';

						pMinLength = null;
						break;
				}
			}
		}

		if (pMinLength) {
			subst = subst.toString();
			for (let i = subst.length; i < pMinLength; i++)
				if (pJustify == '-')
					subst = subst + ' ';
				else
					subst = pad + subst;
		}

		out += leftpart + subst;
		str = str.substr(m.length);
	}

	return out + str;
}

/**
 * Format a string using positional arguments.
 * @function nobr
 * @memberof external:String.prototype
 * @param {...string} args
 * @returns {string}
 */
String.prototype.nobr = function()
{
	return this.replace(/[\s\n]+/g, '&#160;');
}

/**
 * Format a string using positional arguments.
 * @function format
 * @memberof external:String
 * @param {...string} args
 * @returns {string}
 */
String.format = function()
{
	const a = [ ];

	for (let i = 1; i < arguments.length; i++) {
		a.push(arguments[i]);
	}

	return ''.format.apply(arguments[0], a);
}

/**
 * Format a string using positional arguments.
 * @function nobr
 * @memberof external:String
 * @param {...string} args
 * @returns {string}
 */
String.nobr = function()
{
	const a = [ ];

	for (let i = 1; i < arguments.length; i++)
		a.push(arguments[i]);

	return ''.nobr.apply(arguments[0], a);
}

if (window.NodeList && !NodeList.prototype.forEach) {
	NodeList.prototype.forEach = function (callback, thisArg) {
		thisArg = thisArg || window;
		for (var i = 0; i < this.length; i++) {
			callback.call(thisArg, this[i], i, this);
		}
	};
}

if (!window.requestAnimationFrame) {
	window.requestAnimationFrame = function(f) {
		window.setTimeout(function() {
			f(new Date().getTime())
		}, 1000/30);
	};
}


/**
 * Return the element for input which may be an element or an id.
 * @param {Element|string} e - Element or id.
 * @returns {HTMLElement|null}
 */
function isElem(e) { return L.dom.elem(e) }

/**
 * Test whether node matches a CSS selector.
 * @param {Node} node - Node to test.
 * @param {string} selector - CSS selector.
 * @returns {boolean}
 */
function matchesElem(node, selector) { return L.dom.matches(node, selector) }

/**
 * Find the parent matching selector from node upwards.
 * @param {Node} node - Starting node.
 * @param {string} selector - CSS selector to match ancestor.
 * @returns {HTMLElement|null}
 */
function findParent(node, selector) { return L.dom.parent(node, selector) }

/**
 * Create DOM elements using {@link L.dom.create} helper (convenience wrapper).
 * @returns {HTMLElement}
 */
function E() { return L.dom.create.apply(L.dom, arguments) }

/**
 * Initialize a dropdown element into an {@link L.ui.Dropdown} instance and bind it.
 * If already bound, this is a no-op.
 * @param {HTMLElement} sb - The select element to convert.
 * @returns {L.ui.Dropdown|undefined} Dropdown instance or undefined when already bound.
 */
function cbi_dropdown_init(sb) {
	if (sb && L.dom.findClassInstance(sb) instanceof L.ui.Dropdown)
		return;

	const dl = new L.ui.Dropdown(sb, null, { name: sb.getAttribute('name') });
	return dl.bind(sb);
}

/**
 * Update or initialize a table UI widget with new data.
 * @param {HTMLElement|string} table - Table element or selector.
 * @param {...Node[]} data - Data to update the table with.
 * @param {string} [placeholder] - Placeholder text when empty.
 */
function cbi_update_table(table, data, placeholder) {
	const target = isElem(table) ? table : document.querySelector(table);

	if (!isElem(target))
		return;

	let t = L.dom.findClassInstance(target);

	if (!(t instanceof L.ui.Table)) {
		t = new L.ui.Table(target);
		L.dom.bindClassInstance(target, t);
	}

	t.update(data, placeholder);
}


document.addEventListener('DOMContentLoaded', function() {
	document.addEventListener('validation-failure', function(ev) {
		if (ev.target === document.activeElement)
			L.showTooltip(ev);
	});

	document.addEventListener('validation-success', function(ev) {
		if (ev.target === document.activeElement)
			L.hideTooltip(ev);
	});

	L.require('ui').then(function(ui) {
		document.querySelectorAll('.table').forEach(cbi_update_table);
	});
});
