/*
	LuCI - Lua Configuration Interface

	Copyright 2008 Steven Barth <steven@midlink.org>
	Copyright 2008-2018 Jo-Philipp Wich <jo@mein.io>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
*/

var cbi_d = [];
var cbi_strings = { path: {}, label: {} };

function s8(bytes, off) {
	var n = bytes[off];
	return (n > 0x7F) ? (n - 256) >>> 0 : n;
}

function u16(bytes, off) {
	return ((bytes[off + 1] << 8) + bytes[off]) >>> 0;
}

function sfh(s) {
	if (s === null || s.length === 0)
		return null;

	var bytes = [];

	for (var i = 0; i < s.length; i++) {
		var ch = s.charCodeAt(i);

		if (ch <= 0x7F)
			bytes.push(ch);
		else if (ch <= 0x7FF)
			bytes.push(((ch >>>  6) & 0x1F) | 0xC0,
			           ( ch         & 0x3F) | 0x80);
		else if (ch <= 0xFFFF)
			bytes.push(((ch >>> 12) & 0x0F) | 0xE0,
			           ((ch >>>  6) & 0x3F) | 0x80,
			           ( ch         & 0x3F) | 0x80);
		else if (code <= 0x10FFFF)
			bytes.push(((ch >>> 18) & 0x07) | 0xF0,
			           ((ch >>> 12) & 0x3F) | 0x80,
			           ((ch >>   6) & 0x3F) | 0x80,
			           ( ch         & 0x3F) | 0x80);
	}

	if (!bytes.length)
		return null;

	var hash = (bytes.length >>> 0),
	    len = (bytes.length >>> 2),
	    off = 0, tmp;

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

	return (0x100000000 + hash).toString(16).substr(1);
}

function _(s) {
	return (window.TR && TR[sfh(s)]) || s;
}

function Int(x) {
	return (/^-?\d+$/.test(x) ? +x : NaN);
}

function Dec(x) {
	return (/^-?\d+(?:\.\d+)?$/.test(x) ? +x : NaN);
}

function IPv4(x) {
	if (!x.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/))
		return null;

	if (RegExp.$1 > 255 || RegExp.$2 > 255 || RegExp.$3 > 255 || RegExp.$4 > 255)
		return null;

	return [ +RegExp.$1, +RegExp.$2, +RegExp.$3, +RegExp.$4 ];
}

function IPv6(x) {
	if (x.match(/^([a-fA-F0-9:]+):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)) {
		var v6 = RegExp.$1, v4 = IPv4(RegExp.$2);

		if (!v4)
			return null;

		x = v6 + ':' + (v4[0] * 256 + v4[1]).toString(16)
		       + ':' + (v4[2] * 256 + v4[3]).toString(16);
	}

	if (!x.match(/^[a-fA-F0-9:]+$/))
		return null;

	var prefix_suffix = x.split(/::/);

	if (prefix_suffix.length > 2)
		return null;

	var prefix = (prefix_suffix[0] || '0').split(/:/);
	var suffix = prefix_suffix.length > 1 ? (prefix_suffix[1] || '0').split(/:/) : [];

	if (suffix.length ? (prefix.length + suffix.length > 7)
	                  : ((prefix_suffix.length < 2 && prefix.length < 8) || prefix.length > 8))
		return null;

	var i, word;
	var words = [];

	for (i = 0, word = parseInt(prefix[0], 16); i < prefix.length; word = parseInt(prefix[++i], 16))
		if (prefix[i].length <= 4 && !isNaN(word) && word <= 0xFFFF)
			words.push(word);
		else
			return null;

	for (i = 0; i < (8 - prefix.length - suffix.length); i++)
		words.push(0);

	for (i = 0, word = parseInt(suffix[0], 16); i < suffix.length; word = parseInt(suffix[++i], 16))
		if (suffix[i].length <= 4 && !isNaN(word) && word <= 0xFFFF)
			words.push(word);
		else
			return null;

	return words;
}

var CBIValidatorPrototype = {
	apply: function(name, value, args) {
		var func;

		if (typeof(name) === 'function')
			func = name;
		else if (typeof(this.types[name]) === 'function')
			func = this.types[name];
		else
			return false;

		if (value !== undefined && value !== null)
			this.value = value;

		return func.apply(this, args);
	},

	assert: function(condition, message) {
		if (!condition) {
			this.field.classList.add('cbi-input-invalid');
			this.error = message;
			return false;
		}

		this.field.classList.remove('cbi-input-invalid');
		this.error = null;
		return true;
	},

	compile: function(code) {
		var pos = 0;
		var esc = false;
		var depth = 0;
		var stack = [ ];

		code += ',';

		for (var i = 0; i < code.length; i++) {
			if (esc) {
				esc = false;
				continue;
			}

			switch (code.charCodeAt(i))
			{
			case 92:
				esc = true;
				break;

			case 40:
			case 44:
				if (depth <= 0) {
					if (pos < i) {
						var label = code.substring(pos, i);
							label = label.replace(/\\(.)/g, '$1');
							label = label.replace(/^[ \t]+/g, '');
							label = label.replace(/[ \t]+$/g, '');

						if (label && !isNaN(label)) {
							stack.push(parseFloat(label));
						}
						else if (label.match(/^(['"]).*\1$/)) {
							stack.push(label.replace(/^(['"])(.*)\1$/, '$2'));
						}
						else if (typeof this.types[label] == 'function') {
							stack.push(this.types[label]);
							stack.push(null);
						}
						else {
							throw "Syntax error, unhandled token '"+label+"'";
						}
					}

					pos = i+1;
				}

				depth += (code.charCodeAt(i) == 40);
				break;

			case 41:
				if (--depth <= 0) {
					if (typeof stack[stack.length-2] != 'function')
						throw "Syntax error, argument list follows non-function";

					stack[stack.length-1] = this.compile(code.substring(pos, i));
					pos = i+1;
				}

				break;
			}
		}

		return stack;
	},

	validate: function() {
		/* element is detached */
		if (!findParent(this.field, 'body') && !findParent(this.field, '[data-field]'))
			return true;

		this.field.classList.remove('cbi-input-invalid');
		this.value = (this.field.value != null) ? this.field.value : '';
		this.error = null;

		var valid;

		if (this.value.length === 0)
			valid = this.assert(this.optional, _('non-empty value'));
		else
			valid = this.vstack[0].apply(this, this.vstack[1]);

		if (valid !== true) {
			this.field.setAttribute('data-tooltip', _('Expecting %s').format(this.error));
			this.field.setAttribute('data-tooltip-style', 'error');
			this.field.dispatchEvent(new CustomEvent('validation-failure', { bubbles: true }));
			return false;
		}

		if (typeof(this.vfunc) == 'function')
			valid = this.vfunc(this.value);

		if (valid !== true) {
			this.assert(false, valid);
			this.field.setAttribute('data-tooltip', valid);
			this.field.setAttribute('data-tooltip-style', 'error');
			this.field.dispatchEvent(new CustomEvent('validation-failure', { bubbles: true }));
			return false;
		}

		this.field.removeAttribute('data-tooltip');
		this.field.removeAttribute('data-tooltip-style');
		this.field.dispatchEvent(new CustomEvent('validation-success', { bubbles: true }));
		return true;
	},

	types: {
		integer: function() {
			return this.assert(Int(this.value) !== NaN, _('valid integer value'));
		},

		uinteger: function() {
			return this.assert(Int(this.value) >= 0, _('positive integer value'));
		},

		float: function() {
			return this.assert(Dec(this.value) !== NaN, _('valid decimal value'));
		},

		ufloat: function() {
			return this.assert(Dec(this.value) >= 0, _('positive decimal value'));
		},

		ipaddr: function(nomask) {
			return this.assert(this.apply('ip4addr', null, [nomask]) || this.apply('ip6addr', null, [nomask]),
				nomask ? _('valid IP address') : _('valid IP address or prefix'));
		},

		ip4addr: function(nomask) {
			var re = nomask ? /^(\d+\.\d+\.\d+\.\d+)$/ : /^(\d+\.\d+\.\d+\.\d+)(?:\/(\d+\.\d+\.\d+\.\d+)|\/(\d{1,2}))?$/,
			    m = this.value.match(re);

			return this.assert(m && IPv4(m[1]) && (m[2] ? IPv4(m[2]) : (m[3] ? this.apply('ip4prefix', m[3]) : true)),
				nomask ? _('valid IPv4 address') : _('valid IPv4 address or network'));
		},

		ip6addr: function(nomask) {
			var re = nomask ? /^([0-9a-fA-F:.]+)$/ : /^([0-9a-fA-F:.]+)(?:\/(\d{1,3}))?$/,
			    m = this.value.match(re);

			return this.assert(m && IPv6(m[1]) && (m[2] ? this.apply('ip6prefix', m[2]) : true),
				nomask ? _('valid IPv6 address') : _('valid IPv6 address or prefix'));
		},

		ip4prefix: function() {
			return this.assert(!isNaN(this.value) && this.value >= 0 && this.value <= 32,
				_('valid IPv4 prefix value (0-32)'));
		},

		ip6prefix: function() {
			return this.assert(!isNaN(this.value) && this.value >= 0 && this.value <= 128,
				_('valid IPv6 prefix value (0-128)'));
		},

		cidr: function() {
			return this.assert(this.apply('cidr4') || this.apply('cidr6'), _('valid IPv4 or IPv6 CIDR'));
		},

		cidr4: function() {
			var m = this.value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
			return this.assert(m && IPv4(m[1]) && this.apply('ip4prefix', m[2]), _('valid IPv4 CIDR'));
		},

		cidr6: function() {
			var m = this.value.match(/^([0-9a-fA-F:.]+)\/(\d{1,3})$/);
			return this.assert(m && IPv6(m[1]) && this.apply('ip6prefix', m[2]), _('valid IPv6 CIDR'));
		},

		ipnet4: function() {
			var m = this.value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
			return this.assert(m && IPv4(m[1]) && IPv4(m[2]), _('IPv4 network in address/netmask notation'));
		},

		ipnet6: function() {
			var m = this.value.match(/^([0-9a-fA-F:.]+)\/([0-9a-fA-F:.]+)$/);
			return this.assert(m && IPv6(m[1]) && IPv6(m[2]), _('IPv6 network in address/netmask notation'));
		},

		ip6hostid: function() {
			if (this.value == "eui64" || this.value == "random")
				return true;

			var v6 = IPv6(this.value);
			return this.assert(!(!v6 || v6[0] || v6[1] || v6[2] || v6[3]), _('valid IPv6 host id'));
		},

		ipmask: function() {
			return this.assert(this.apply('ipmask4') || this.apply('ipmask6'),
				_('valid network in address/netmask notation'));
		},

		ipmask4: function() {
			return this.assert(this.apply('cidr4') || this.apply('ipnet4') || this.apply('ip4addr'),
				_('valid IPv4 network'));
		},

		ipmask6: function() {
			return this.assert(this.apply('cidr6') || this.apply('ipnet6') || this.apply('ip6addr'),
				_('valid IPv6 network'));
		},

		port: function() {
			var p = Int(this.value);
			return this.assert(p >= 0 && p <= 65535, _('valid port value'));
		},

		portrange: function() {
			if (this.value.match(/^(\d+)-(\d+)$/)) {
				var p1 = +RegExp.$1;
				var p2 = +RegExp.$2;
				return this.assert(p1 <= p2 && p2 <= 65535,
					_('valid port or port range (port1-port2)'));
			}

			return this.assert(this.apply('port'), _('valid port or port range (port1-port2)'));
		},

		macaddr: function() {
			return this.assert(this.value.match(/^([a-fA-F0-9]{2}:){5}[a-fA-F0-9]{2}$/) != null,
				_('valid MAC address'));
		},

		host: function(ipv4only) {
			return this.assert(this.apply('hostname') || this.apply(ipv4only == 1 ? 'ip4addr' : 'ipaddr'),
				_('valid hostname or IP address'));
		},

		hostname: function(strict) {
			if (this.value.length <= 253)
				return this.assert(
					(this.value.match(/^[a-zA-Z0-9_]+$/) != null ||
						(this.value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_\-.]*[a-zA-Z0-9]$/) &&
						 this.value.match(/[^0-9.]/))) &&
					(!strict || !this.value.match(/^_/)),
					_('valid hostname'));

			return this.assert(false, _('valid hostname'));
		},

		network: function() {
			return this.assert(this.apply('uciname') || this.apply('host'),
				_('valid UCI identifier, hostname or IP address'));
		},

		hostport: function(ipv4only) {
			var hp = this.value.split(/:/);
			return this.assert(hp.length == 2 && this.apply('host', hp[0], [ipv4only]) && this.apply('port', hp[1]),
				_('valid host:port'));
		},

		ip4addrport: function() {
			var hp = this.value.split(/:/);
			return this.assert(hp.length == 2 && this.apply('ip4addr', hp[0], [true]) && this.apply('port', hp[1]),
				_('valid IPv4 address:port'));
		},

		ipaddrport: function(bracket) {
			var m4 = this.value.match(/^([^\[\]:]+):(\d+)$/),
			    m6 = this.value.match((bracket == 1) ? /^\[(.+)\]:(\d+)$/ : /^([^\[\]]+):(\d+)$/);

			if (m4)
				return this.assert(this.apply('ip4addr', m4[1], [true]) && this.apply('port', m4[2]),
					_('valid address:port'));

			return this.assert(m6 && this.apply('ip6addr', m6[1], [true]) && this.apply('port', m6[2]),
				_('valid address:port'));
		},

		wpakey: function() {
			var v = this.value;

			if (v.length == 64)
				return this.assert(v.match(/^[a-fA-F0-9]{64}$/), _('valid hexadecimal WPA key'));

			return this.assert((v.length >= 8) && (v.length <= 63), _('key between 8 and 63 characters'));
		},

		wepkey: function() {
			var v = this.value;

			if (v.substr(0, 2) === 's:')
				v = v.substr(2);

			if ((v.length == 10) || (v.length == 26))
				return this.assert(v.match(/^[a-fA-F0-9]{10,26}$/), _('valid hexadecimal WEP key'));

			return this.assert((v.length === 5) || (v.length === 13), _('key with either 5 or 13 characters'));
		},

		uciname: function() {
			return this.assert(this.value.match(/^[a-zA-Z0-9_]+$/), _('valid UCI identifier'));
		},

		range: function(min, max) {
			var val = Dec(this.value);
			return this.assert(val >= +min && val <= +max, _('value between %f and %f').format(min, max));
		},

		min: function(min) {
			return this.assert(Dec(this.value) >= +min, _('value greater or equal to %f').format(min));
		},

		max: function(max) {
			return this.assert(Dec(this.value) <= +max, _('value smaller or equal to %f').format(max));
		},

		rangelength: function(min, max) {
			var val = '' + this.value;
			return this.assert((val.length >= +min) && (val.length <= +max),
				_('value between %d and %d characters').format(min, max));
		},

		minlength: function(min) {
			return this.assert((''+this.value).length >= +min,
				_('value with at least %d characters').format(min));
		},

		maxlength: function(max) {
			return this.assert((''+this.value).length <= +max,
				_('value with at most %d characters').format(max));
		},

		or: function() {
			var errors = [];

			for (var i = 0; i < arguments.length; i += 2) {
				if (typeof arguments[i] != 'function') {
					if (arguments[i] == this.value)
						return this.assert(true);
					errors.push('"%s"'.format(arguments[i]));
					i--;
				}
				else if (arguments[i].apply(this, arguments[i+1])) {
					return this.assert(true);
				}
				else {
					errors.push(this.error);
				}
			}

			return this.assert(false, _('one of:\n - %s'.format(errors.join('\n - '))));
		},

		and: function() {
			for (var i = 0; i < arguments.length; i += 2) {
				if (typeof arguments[i] != 'function') {
					if (arguments[i] != this.value)
						return this.assert(false, '"%s"'.format(arguments[i]));
					i--;
				}
				else if (!arguments[i].apply(this, arguments[i+1])) {
					return this.assert(false, this.error);
				}
			}

			return this.assert(true);
		},

		neg: function() {
			return this.apply('or', this.value.replace(/^[ \t]*![ \t]*/, ''), arguments);
		},

		list: function(subvalidator, subargs) {
			this.field.setAttribute('data-is-list', 'true');

			var tokens = this.value.match(/[^ \t]+/g);
			for (var i = 0; i < tokens.length; i++)
				if (!this.apply(subvalidator, tokens[i], subargs))
					return this.assert(false, this.error);

			return this.assert(true);
		},

		phonedigit: function() {
			return this.assert(this.value.match(/^[0-9\*#!\.]+$/),
				_('valid phone digit (0-9, "*", "#", "!" or ".")'));
		},

		timehhmmss: function() {
			return this.assert(this.value.match(/^[0-6][0-9]:[0-6][0-9]:[0-6][0-9]$/),
				_('valid time (HH:MM:SS)'));
		},

		dateyyyymmdd: function() {
			if (this.value.match(/^(\d\d\d\d)-(\d\d)-(\d\d)/)) {
				var year  = +RegExp.$1,
				    month = +RegExp.$2,
				    day   = +RegExp.$3,
				    days_in_month = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

				function is_leap_year(year) {
					return ((!(year % 4) && (year % 100)) || !(year % 400));
				}

				function get_days_in_month(month, year) {
					return (month === 2 && is_leap_year(year)) ? 29 : days_in_month[month - 1];
				}

				/* Firewall rules in the past don't make sense */
				return this.assert(year >= 2015 && month && month <= 12 && day && day <= get_days_in_month(month, year),
					_('valid date (YYYY-MM-DD)'));

			}

			return this.assert(false, _('valid date (YYYY-MM-DD)'));
		},

		unique: function(subvalidator, subargs) {
			var ctx = this,
				option = findParent(ctx.field, '[data-type][data-name]'),
			    section = findParent(option, '.cbi-section'),
			    query = '[data-type="%s"][data-name="%s"]'.format(option.getAttribute('data-type'), option.getAttribute('data-name')),
			    unique = true;

			section.querySelectorAll(query).forEach(function(sibling) {
				if (sibling === option)
					return;

				var values = L.dom.callClassMethod(sibling.querySelector('[data-idref]'), 'getValue');

				if (!Array.isArray(values) && sibling.querySelector('[data-is-list]'))
					values = String(values || '').match(/[^ \t]+/g) || [];
				else if (!Array.isArray(values))
					values = (values != null) ? [ values ] : [];

				if (values.indexOf(ctx.value) != -1)
					unique = false;
			});

			if (!unique)
				return this.assert(false, _('unique value'));

			if (typeof(subvalidator) === 'function')
				return this.apply(subvalidator, undefined, subargs);

			return this.assert(true);
		},

		hexstring: function() {
			return this.assert(this.value.match(/^([a-f0-9][a-f0-9]|[A-F0-9][A-F0-9])+$/),
				_('hexadecimal encoded value'));
		},

		string: function() {
			return true;
		}
	}
};

function CBIValidator(field, type, optional, vfunc)
{
	this.field = field;
	this.optional = optional;
	this.vfunc = vfunc;
	this.vstack = this.compile(type);
}

CBIValidator.prototype = CBIValidatorPrototype;


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

function cbi_init() {
	var nodes;

	document.querySelectorAll('.cbi-dropdown').forEach(function(node) {
		cbi_dropdown_init(node);
		node.addEventListener('cbi-dropdown-change', cbi_d_update);
	});

	nodes = document.querySelectorAll('[data-strings]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var str = JSON.parse(node.getAttribute('data-strings'));
		for (var key in str) {
			for (var key2 in str[key]) {
				var dst = cbi_strings[key] || (cbi_strings[key] = { });
				    dst[key2] = str[key][key2];
			}
		}
	}

	nodes = document.querySelectorAll('[data-depends]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var index = parseInt(node.getAttribute('data-index'), 10);
		var depends = JSON.parse(node.getAttribute('data-depends'));
		if (!isNaN(index) && depends.length > 0) {
			for (var alt = 0; alt < depends.length; alt++)
				cbi_d_add(node, depends[alt], index);
		}
	}

	nodes = document.querySelectorAll('[data-update]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var events = node.getAttribute('data-update').split(' ');
		for (var j = 0, event; (event = events[j]) !== undefined; j++)
			node.addEventListener(event, cbi_d_update);
	}

	nodes = document.querySelectorAll('[data-choices]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var choices = JSON.parse(node.getAttribute('data-choices')),
		    options = {};

		for (var j = 0; j < choices[0].length; j++)
			options[choices[0][j]] = choices[1][j];

		var def = (node.getAttribute('data-optional') === 'true')
			? node.placeholder || '' : null;

		var cb = new L.ui.Combobox(node.value, options, {
			name: node.getAttribute('name'),
			sort: choices[0],
			select_placeholder: def || _('-- Please choose --'),
			custom_placeholder: node.getAttribute('data-manual') || _('-- custom --')
		});

		var n = cb.render();
		n.addEventListener('cbi-dropdown-change', cbi_d_update);
		node.parentNode.replaceChild(n, node);
	}

	nodes = document.querySelectorAll('[data-dynlist]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var choices = JSON.parse(node.getAttribute('data-dynlist')),
		    values = JSON.parse(node.getAttribute('data-values') || '[]'),
		    options = null;

		if (choices[0] && choices[0].length) {
			options = {};

			for (var j = 0; j < choices[0].length; j++)
				options[choices[0][j]] = choices[1][j];
		}

		var dl = new L.ui.DynamicList(values, options, {
			name: node.getAttribute('data-prefix'),
			sort: choices[0],
			datatype: choices[2],
			optional: choices[3],
			placeholder: node.getAttribute('data-placeholder')
		});

		var n = dl.render();
		n.addEventListener('cbi-dynlist-change', cbi_d_update);
		node.parentNode.replaceChild(n, node);
	}

	nodes = document.querySelectorAll('[data-type]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		cbi_validate_field(node, node.getAttribute('data-optional') === 'true',
		                   node.getAttribute('data-type'));
	}

	document.querySelectorAll('[data-browser]').forEach(cbi_browser_init);

	document.querySelectorAll('.cbi-tooltip:not(:empty)').forEach(function(s) {
		s.parentNode.classList.add('cbi-tooltip-container');
	});

	document.querySelectorAll('.cbi-section-remove > input[name^="cbi.rts"]').forEach(function(i) {
		var handler = function(ev) {
			var bits = this.name.split(/\./),
			    section = document.getElementById('cbi-' + bits[2] + '-' + bits[3]);

		    section.style.opacity = (ev.type === 'mouseover') ? 0.5 : '';
		};

		i.addEventListener('mouseover', handler);
		i.addEventListener('mouseout', handler);
	});

	document.querySelectorAll('[data-ui-widget]').forEach(function(node) {
		var args = JSON.parse(node.getAttribute('data-ui-widget') || '[]'),
		    widget = new (Function.prototype.bind.apply(L.ui[args[0]], args)),
		    markup = widget.render();

		markup.addEventListener('widget-change', cbi_d_update);
		node.parentNode.replaceChild(markup, node);
	});

	cbi_d_update();
}

function cbi_filebrowser(id, defpath) {
	var field   = L.dom.elem(id) ? id : document.getElementById(id);
	var browser = window.open(
		cbi_strings.path.browser + (field.value || defpath || '') + '?field=' + field.id,
		"luci_filebrowser", "width=300,height=400,left=100,top=200,scrollbars=yes"
	);

	browser.focus();
}

function cbi_browser_init(field)
{
	field.parentNode.insertBefore(
		E('img', {
			'src': L.resource('cbi/folder.gif'),
			'class': 'cbi-image-button',
			'click': function(ev) {
				cbi_filebrowser(field, field.getAttribute('data-browser'));
				ev.preventDefault();
			}
		}), field.nextSibling);
}

function cbi_validate_form(form, errmsg)
{
	/* if triggered by a section removal or addition, don't validate */
	if (form.cbi_state == 'add-section' || form.cbi_state == 'del-section')
		return true;

	if (form.cbi_validators) {
		for (var i = 0; i < form.cbi_validators.length; i++) {
			var validator = form.cbi_validators[i];

			if (!validator() && errmsg) {
				alert(errmsg);
				return false;
			}
		}
	}

	return true;
}

function cbi_validate_reset(form)
{
	window.setTimeout(
		function() { cbi_validate_form(form, null) }, 100
	);

	return true;
}

function cbi_validate_field(cbid, optional, type)
{
	var field = isElem(cbid) ? cbid : document.getElementById(cbid);
	var validatorFn;

	try {
		var cbiValidator = new CBIValidator(field, type, optional);
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

			if (/-([^\-]+)$/.test(node.id))
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

function cbi_tag_last(container)
{
	var last;

	for (var i = 0; i < container.childNodes.length; i++) {
		var c = container.childNodes[i];
		if (matchesElem(c, 'div')) {
			c.classList.remove('cbi-value-last');
			last = c;
		}
	}

	if (last)
		last.classList.add('cbi-value-last');
}

function cbi_submit(elem, name, value, action)
{
	var form = elem.form || findParent(elem, 'form');

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

String.prototype.format = function()
{
	if (!RegExp)
		return;

	var html_esc = [/&/g, '&#38;', /"/g, '&#34;', /'/g, '&#39;', /</g, '&#60;', />/g, '&#62;'];
	var quot_esc = [/"/g, '&#34;', /'/g, '&#39;'];

	function esc(s, r) {
		if (typeof(s) !== 'string' && !(s instanceof String))
			return '';

		for (var i = 0; i < r.length; i += 2)
			s = s.replace(r[i], r[i+1]);

		return s;
	}

	var str = this;
	var out = '';
	var re = /^(([^%]*)%('.|0|\x20)?(-)?(\d+)?(\.\d+)?(%|b|c|d|u|f|o|s|x|X|q|h|j|t|m))/;
	var a = b = [], numSubstitutions = 0, numMatches = 0;

	while (a = re.exec(str)) {
		var m = a[1];
		var leftpart = a[2], pPad = a[3], pJustify = a[4], pMinLength = a[5];
		var pPrecision = a[6], pType = a[7];

		numMatches++;

		if (pType == '%') {
			subst = '%';
		}
		else {
			if (numSubstitutions < arguments.length) {
				var param = arguments[numSubstitutions++];

				var pad = '';
				if (pPad && pPad.substr(0,1) == "'")
					pad = leftpart.substr(1,1);
				else if (pPad)
					pad = pPad;
				else
					pad = ' ';

				var justifyRight = true;
				if (pJustify && pJustify === "-")
					justifyRight = false;

				var minLength = -1;
				if (pMinLength)
					minLength = +pMinLength;

				var precision = -1;
				if (pPrecision && pType == 'f')
					precision = +pPrecision.substring(1);

				var subst = param;

				switch(pType) {
					case 'b':
						subst = (+param || 0).toString(2);
						break;

					case 'c':
						subst = String.fromCharCode(+param || 0);
						break;

					case 'd':
						subst = ~~(+param || 0);
						break;

					case 'u':
						subst = ~~Math.abs(+param || 0);
						break;

					case 'f':
						subst = (precision > -1)
							? ((+param || 0.0)).toFixed(precision)
							: (+param || 0.0);
						break;

					case 'o':
						subst = (+param || 0).toString(8);
						break;

					case 's':
						subst = param;
						break;

					case 'x':
						subst = ('' + (+param || 0).toString(16)).toLowerCase();
						break;

					case 'X':
						subst = ('' + (+param || 0).toString(16)).toUpperCase();
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

						if (ts > 60) {
							tm = Math.floor(ts / 60);
							ts = (ts % 60);
						}

						if (tm > 60) {
							th = Math.floor(tm / 60);
							tm = (tm % 60);
						}

						if (th > 24) {
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

						subst = (i ? val.toFixed(pr) : val) + units[i];
						pMinLength = null;
						break;
				}
			}
		}

		if (pMinLength) {
			subst = subst.toString();
			for (var i = subst.length; i < pMinLength; i++)
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

String.prototype.nobr = function()
{
	return this.replace(/[\s\n]+/g, '&#160;');
}

String.format = function()
{
	var a = [ ];

	for (var i = 1; i < arguments.length; i++)
		a.push(arguments[i]);

	return ''.format.apply(arguments[0], a);
}

String.nobr = function()
{
	var a = [ ];

	for (var i = 1; i < arguments.length; i++)
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


function isElem(e) { return L.dom.elem(e) }
function toElem(s) { return L.dom.parse(s) }
function matchesElem(node, selector) { return L.dom.matches(node, selector) }
function findParent(node, selector) { return L.dom.parent(node, selector) }
function E() { return L.dom.create.apply(L.dom, arguments) }

if (typeof(window.CustomEvent) !== 'function') {
	function CustomEvent(event, params) {
		params = params || { bubbles: false, cancelable: false, detail: undefined };
		var evt = document.createEvent('CustomEvent');
		    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
		return evt;
	}

	CustomEvent.prototype = window.Event.prototype;
	window.CustomEvent = CustomEvent;
}

function cbi_dropdown_init(sb) {
	var dl = new L.ui.Dropdown(sb, null, { name: sb.getAttribute('name') });
	return dl.bind(sb);
}

function cbi_update_table(table, data, placeholder) {
	var target = isElem(table) ? table : document.querySelector(table);

	if (!isElem(target))
		return;

	target.querySelectorAll('.tr.table-titles, .cbi-section-table-titles').forEach(function(thead) {
		var titles = [];

		thead.querySelectorAll('.th').forEach(function(th) {
			titles.push(th);
		});

		if (Array.isArray(data)) {
			var n = 0, rows = target.querySelectorAll('.tr');

			data.forEach(function(row) {
				var trow = E('div', { 'class': 'tr' });

				for (var i = 0; i < titles.length; i++) {
					var text = (titles[i].innerText || '').trim();
					var td = trow.appendChild(E('div', {
						'class': titles[i].className,
						'data-title': (text !== '') ? text : null
					}, row[i] || ''));

					td.classList.remove('th');
					td.classList.add('td');
				}

				trow.classList.add('cbi-rowstyle-%d'.format((n++ % 2) ? 2 : 1));

				if (rows[n])
					target.replaceChild(trow, rows[n]);
				else
					target.appendChild(trow);
			});

			while (rows[++n])
				target.removeChild(rows[n]);

			if (placeholder && target.firstElementChild === target.lastElementChild) {
				var trow = target.appendChild(E('div', { 'class': 'tr placeholder' }));
				var td = trow.appendChild(E('div', { 'class': titles[0].className }, placeholder));

				td.classList.remove('th');
				td.classList.add('td');
			}
		}
		else {
			thead.parentNode.style.display = 'none';

			thead.parentNode.querySelectorAll('.tr, .cbi-section-table-row').forEach(function(trow) {
				if (trow !== thead) {
					var n = 0;
					trow.querySelectorAll('.th, .td').forEach(function(td) {
						if (n < titles.length) {
							var text = (titles[n++].innerText || '').trim();
							if (text !== '')
								td.setAttribute('data-title', text);
						}
					});
				}
			});

			thead.parentNode.style.display = '';
		}
	});
}

function showModal(title, children)
{
	return L.showModal(title, children);
}

function hideModal()
{
	return L.hideModal();
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

	document.querySelectorAll('.table').forEach(cbi_update_table);
});
