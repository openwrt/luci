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
		if (!findParent(this.field, 'form'))
			return true;

		this.field.classList.remove('cbi-input-invalid');
		this.value = matchesElem(this.field, 'select') ? this.field.options[this.field.selectedIndex].value : this.field.value;
		this.error = null;

		var valid;

		if (this.value.length === 0)
			valid = this.assert(this.optional, _('non-empty value'));
		else
			valid = this.vstack[0].apply(this, this.vstack[1]);

		if (!valid) {
			this.field.setAttribute('data-tooltip', _('Expecting %s').format(this.error));
			this.field.setAttribute('data-tooltip-style', 'error');
			this.field.dispatchEvent(new CustomEvent('validation-failure', { bubbles: true }));
		}
		else {
			this.field.removeAttribute('data-tooltip');
			this.field.removeAttribute('data-tooltip-style');
			this.field.dispatchEvent(new CustomEvent('validation-success', { bubbles: true }));
		}

		return valid;
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

				var input = sibling.querySelector('[data-type]'),
				    values = input ? (input.getAttribute('data-is-list') ? input.value.match(/[^ \t]+/g) : [ input.value ]) : null;

				if (values !== null && values.indexOf(ctx.value) !== -1)
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
		}
	}
};

function CBIValidator(field, type, optional)
{
	this.field = field;
	this.optional = optional;
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
		var choices = JSON.parse(node.getAttribute('data-choices'));
		var options = {};

		for (var j = 0; j < choices[0].length; j++)
			options[choices[0][j]] = choices[1][j];

		var def = (node.getAttribute('data-optional') === 'true')
			? node.placeholder || '' : null;

		cbi_combobox_init(node, options, def,
		                  node.getAttribute('data-manual'));
	}

	nodes = document.querySelectorAll('[data-dynlist]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var choices = JSON.parse(node.getAttribute('data-dynlist'));
		var options = null;

		if (choices[0] && choices[0].length) {
			options = {};

			for (var j = 0; j < choices[0].length; j++)
				options[choices[0][j]] = choices[1][j];
		}

		cbi_dynlist_init(node, choices[2], choices[3], options);
	}

	nodes = document.querySelectorAll('[data-type]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		cbi_validate_field(node, node.getAttribute('data-optional') === 'true',
		                   node.getAttribute('data-type'));
	}

	document.querySelectorAll('.cbi-dropdown').forEach(cbi_dropdown_init);
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

	cbi_d_update();
}

function cbi_combobox_init(id, values, def, man) {
	var obj = (typeof(id) === 'string') ? document.getElementById(id) : id;
	var sb = E('div', {
		'name': obj.name,
		'class': 'cbi-dropdown',
		'display-items': 5,
		'optional': obj.getAttribute('data-optional'),
		'placeholder': _('-- Please choose --'),
		'data-type': obj.getAttribute('data-type'),
		'data-optional': obj.getAttribute('data-optional')
	}, [ E('ul') ]);

	if (!(obj.value in values) && obj.value.length) {
		sb.lastElementChild.appendChild(E('li', {
			'data-value': obj.value,
			'selected': ''
		}, obj.value.length ? obj.value : (def || _('-- Please choose --'))));
	}

	for (var i in values) {
		sb.lastElementChild.appendChild(E('li', {
			'data-value': i,
			'selected': (i == obj.value) ? '' : null
		}, values[i]));
	}

	sb.lastElementChild.appendChild(E('li', { 'data-value': '-' }, [
		E('input', {
			'type': 'text',
			'class': 'create-item-input',
			'data-type': obj.getAttribute('data-type'),
			'data-optional': true,
			'placeholder': (man || _('-- custom --'))
		})
	]));

	sb.value = obj.value;
	obj.parentNode.replaceChild(sb, obj);
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

CBIDynamicList = {
	addItem: function(dl, value, text, flash) {
		var exists = false,
		    new_item = E('div', { 'class': flash ? 'item flash' : 'item', 'tabindex': 0 }, [
				E('span', {}, text || value),
				E('input', {
					'type': 'hidden',
					'name': dl.getAttribute('data-prefix'),
					'value': value })]);

		dl.querySelectorAll('.item, .add-item').forEach(function(item) {
			if (exists)
				return;

			var hidden = item.querySelector('input[type="hidden"]');

			if (hidden && hidden.value === value)
				exists = true;
			else if (!hidden || hidden.value >= value)
				exists = !!item.parentNode.insertBefore(new_item, item);
		});

		cbi_d_update();
	},

	removeItem: function(dl, item) {
		var sb = dl.querySelector('.cbi-dropdown');
		if (sb) {
			var value = item.querySelector('input[type="hidden"]').value;

			sb.querySelectorAll('ul > li').forEach(function(li) {
				if (li.getAttribute('data-value') === value)
					li.removeAttribute('unselectable');
			});
		}

		item.parentNode.removeChild(item);
		cbi_d_update();
	},

	handleClick: function(ev) {
		var dl = ev.currentTarget,
		    item = findParent(ev.target, '.item');

		if (item) {
			this.removeItem(dl, item);
		}
		else if (matchesElem(ev.target, '.cbi-button-add')) {
			var input = ev.target.previousElementSibling;
			if (input.value.length && !input.classList.contains('cbi-input-invalid')) {
				this.addItem(dl, input.value, null, true);
				input.value = '';
			}
		}
	},

	handleDropdownChange: function(ev) {
		var dl = ev.currentTarget,
		    sbIn = ev.detail.instance,
		    sbEl = ev.detail.element,
		    sbVal = ev.detail.value;

		if (sbVal === null)
			return;

		sbIn.setValues(sbEl, null);
		sbVal.element.setAttribute('unselectable', '');

		this.addItem(dl, sbVal.value, sbVal.text, true);
	},

	handleKeydown: function(ev) {
		var dl = ev.currentTarget,
		    item = findParent(ev.target, '.item');

		if (item) {
			switch (ev.keyCode) {
			case 8: /* backspace */
				if (item.previousElementSibling)
					item.previousElementSibling.focus();

				this.removeItem(dl, item);
				break;

			case 46: /* delete */
				if (item.nextElementSibling) {
					if (item.nextElementSibling.classList.contains('item'))
						item.nextElementSibling.focus();
					else
						item.nextElementSibling.firstElementChild.focus();
				}

				this.removeItem(dl, item);
				break;
			}
		}
		else if (matchesElem(ev.target, '.cbi-input-text')) {
			switch (ev.keyCode) {
			case 13: /* enter */
				if (ev.target.value.length && !ev.target.classList.contains('cbi-input-invalid')) {
					this.addItem(dl, ev.target.value, null, true);
					ev.target.value = '';
					ev.target.blur();
					ev.target.focus();
				}

				ev.preventDefault();
				break;
			}
		}
	}
};

function cbi_dynlist_init(dl, datatype, optional, choices)
{
	if (!(this instanceof cbi_dynlist_init))
		return new cbi_dynlist_init(dl, datatype, optional, choices);

	dl.classList.add('cbi-dynlist');
	dl.appendChild(E('div', { 'class': 'add-item' }, E('input', {
		'type': 'text',
		'name': 'cbi.dynlist.' + dl.getAttribute('data-prefix'),
		'class': 'cbi-input-text',
		'placeholder': dl.getAttribute('data-placeholder'),
		'data-type': datatype,
		'data-optional': true
	})));

	if (choices)
		cbi_combobox_init(dl.lastElementChild.lastElementChild, choices, '', _('-- custom --'));
	else
		dl.lastElementChild.appendChild(E('div', { 'class': 'cbi-button cbi-button-add' }, '+'));

	dl.addEventListener('click', this.handleClick.bind(this));
	dl.addEventListener('keydown', this.handleKeydown.bind(this));
	dl.addEventListener('cbi-dropdown-change', this.handleDropdownChange.bind(this));

	try {
		var values = JSON.parse(dl.getAttribute('data-values') || '[]');

		if (typeof(values) === 'object' && Array.isArray(values))
			for (var i = 0; i < values.length; i++)
				this.addItem(dl, values[i], choices ? choices[values[i]] : null);
	}
	catch (e) {}
}

cbi_dynlist_init.prototype = CBIDynamicList;


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

CBIDropdown = {
	openDropdown: function(sb) {
		var st = window.getComputedStyle(sb, null),
		    ul = sb.querySelector('ul'),
		    li = ul.querySelectorAll('li'),
		    fl = findParent(sb, '.cbi-value-field'),
		    sel = ul.querySelector('[selected]'),
		    rect = sb.getBoundingClientRect(),
		    items = Math.min(this.dropdown_items, li.length);

		document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
			s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
		});

		sb.setAttribute('open', '');

		var pv = ul.cloneNode(true);
		    pv.classList.add('preview');

		if (fl)
			fl.classList.add('cbi-dropdown-open');

		if ('ontouchstart' in window) {
			var vpWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
			    vpHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
			    scrollFrom = window.pageYOffset,
			    scrollTo = scrollFrom + rect.top - vpHeight * 0.5,
			    start = null;

			ul.style.top = sb.offsetHeight + 'px';
			ul.style.left = -rect.left + 'px';
			ul.style.right = (rect.right - vpWidth) + 'px';
			ul.style.maxHeight = (vpHeight * 0.5) + 'px';
			ul.style.WebkitOverflowScrolling = 'touch';

			var scrollStep = function(timestamp) {
				if (!start) {
					start = timestamp;
					ul.scrollTop = sel ? Math.max(sel.offsetTop - sel.offsetHeight, 0) : 0;
				}

				var duration = Math.max(timestamp - start, 1);
				if (duration < 100) {
					document.body.scrollTop = scrollFrom + (scrollTo - scrollFrom) * (duration / 100);
					window.requestAnimationFrame(scrollStep);
				}
				else {
					document.body.scrollTop = scrollTo;
				}
			};

			window.requestAnimationFrame(scrollStep);
		}
		else {
			ul.style.maxHeight = '1px';
			ul.style.top = ul.style.bottom = '';

			window.requestAnimationFrame(function() {
				var height = items * li[Math.max(0, li.length - 2)].offsetHeight;

				ul.scrollTop = sel ? Math.max(sel.offsetTop - sel.offsetHeight, 0) : 0;
				ul.style[((rect.top + rect.height + height) > window.innerHeight) ? 'bottom' : 'top'] = rect.height + 'px';
				ul.style.maxHeight = height + 'px';
			});
		}

		ul.querySelectorAll('[selected] input[type="checkbox"]').forEach(function(c) {
			c.checked = true;
		});

		ul.classList.add('dropdown');

		sb.insertBefore(pv, ul.nextElementSibling);

		li.forEach(function(l) {
			l.setAttribute('tabindex', 0);
		});

		sb.lastElementChild.setAttribute('tabindex', 0);

		this.setFocus(sb, sel || li[0], true);
	},

	closeDropdown: function(sb, no_focus) {
		if (!sb.hasAttribute('open'))
			return;

		var pv = sb.querySelector('ul.preview'),
		    ul = sb.querySelector('ul.dropdown'),
		    li = ul.querySelectorAll('li'),
		    fl = findParent(sb, '.cbi-value-field');

		li.forEach(function(l) { l.removeAttribute('tabindex'); });
		sb.lastElementChild.removeAttribute('tabindex');

		sb.removeChild(pv);
		sb.removeAttribute('open');
		sb.style.width = sb.style.height = '';

		ul.classList.remove('dropdown');
		ul.style.top = ul.style.bottom = ul.style.maxHeight = '';

		if (fl)
			fl.classList.remove('cbi-dropdown-open');

		if (!no_focus)
			this.setFocus(sb, sb);

		this.saveValues(sb, ul);
	},

	toggleItem: function(sb, li, force_state) {
		if (li.hasAttribute('unselectable'))
			return;

		if (this.multi) {
			var cbox = li.querySelector('input[type="checkbox"]'),
			    items = li.parentNode.querySelectorAll('li'),
			    label = sb.querySelector('ul.preview'),
			    sel = li.parentNode.querySelectorAll('[selected]').length,
			    more = sb.querySelector('.more'),
			    ndisplay = this.display_items,
			    n = 0;

			if (li.hasAttribute('selected')) {
				if (force_state !== true) {
					if (sel > 1 || this.optional) {
						li.removeAttribute('selected');
						cbox.checked = cbox.disabled = false;
						sel--;
					}
					else {
						cbox.disabled = true;
					}
				}
			}
			else {
				if (force_state !== false) {
					li.setAttribute('selected', '');
					cbox.checked = true;
					cbox.disabled = false;
					sel++;
				}
			}

			while (label.firstElementChild)
				label.removeChild(label.firstElementChild);

			for (var i = 0; i < items.length; i++) {
				items[i].removeAttribute('display');
				if (items[i].hasAttribute('selected')) {
					if (ndisplay-- > 0) {
						items[i].setAttribute('display', n++);
						label.appendChild(items[i].cloneNode(true));
					}
					var c = items[i].querySelector('input[type="checkbox"]');
					if (c)
						c.disabled = (sel == 1 && !this.optional);
				}
			}

			if (ndisplay < 0)
				sb.setAttribute('more', '');
			else
				sb.removeAttribute('more');

			if (ndisplay === this.display_items)
				sb.setAttribute('empty', '');
			else
				sb.removeAttribute('empty');

			more.innerHTML = (ndisplay === this.display_items) ? this.placeholder : '···';
		}
		else {
			var sel = li.parentNode.querySelector('[selected]');
			if (sel) {
				sel.removeAttribute('display');
				sel.removeAttribute('selected');
			}

			li.setAttribute('display', 0);
			li.setAttribute('selected', '');

			this.closeDropdown(sb, true);
		}

		this.saveValues(sb, li.parentNode);
	},

	transformItem: function(sb, li) {
		var cbox = E('form', {}, E('input', { type: 'checkbox', tabindex: -1, onclick: 'event.preventDefault()' })),
		    label = E('label');

		while (li.firstChild)
			label.appendChild(li.firstChild);

		li.appendChild(cbox);
		li.appendChild(label);
	},

	saveValues: function(sb, ul) {
		var sel = ul.querySelectorAll('li[selected]'),
		    div = sb.lastElementChild,
		    strval = '',
		    values = [];

		while (div.lastElementChild)
			div.removeChild(div.lastElementChild);

		sel.forEach(function (s) {
			if (s.hasAttribute('placeholder'))
				return;

			var v = {
				text: s.innerText,
				value: s.hasAttribute('data-value') ? s.getAttribute('data-value') : s.innerText,
				element: s
			};

			div.appendChild(E('input', {
				type: 'hidden',
				name: s.hasAttribute('name') ? s.getAttribute('name') : (sb.getAttribute('name') || ''),
				value: v.value
			}));

			values.push(v);

			strval += strval.length ? ' ' + v.value : v.value;
		});

		var detail = {
			instance: this,
			element: sb
		};

		if (this.multi)
			detail.values = values;
		else
			detail.value = values.length ? values[0] : null;

		sb.value = strval;

		sb.dispatchEvent(new CustomEvent('cbi-dropdown-change', {
			bubbles: true,
			detail: detail
		}));

		cbi_d_update();
	},

	setValues: function(sb, values) {
		var ul = sb.querySelector('ul');

		if (this.multi) {
			ul.querySelectorAll('li[data-value]').forEach(function(li) {
				if (values === null || !(li.getAttribute('data-value') in values))
					this.toggleItem(sb, li, false);
				else
					this.toggleItem(sb, li, true);
			});
		}
		else {
			var ph = ul.querySelector('li[placeholder]');
			if (ph)
				this.toggleItem(sb, ph);

			ul.querySelectorAll('li[data-value]').forEach(function(li) {
				if (values !== null && (li.getAttribute('data-value') in values))
					this.toggleItem(sb, li);
			});
		}
	},

	setFocus: function(sb, elem, scroll) {
		if (sb && sb.hasAttribute && sb.hasAttribute('locked-in'))
			return;

		if (sb.target && findParent(sb.target, 'ul.dropdown'))
			return;

		document.querySelectorAll('.focus').forEach(function(e) {
			if (!matchesElem(e, 'input')) {
				e.classList.remove('focus');
				e.blur();
			}
		});

		if (elem) {
			elem.focus();
			elem.classList.add('focus');

			if (scroll)
				elem.parentNode.scrollTop = elem.offsetTop - elem.parentNode.offsetTop;
		}
	},

	createItems: function(sb, value) {
		var sbox = this,
		    val = (value || '').trim(),
		    ul = sb.querySelector('ul');

		if (!sbox.multi)
			val = val.length ? [ val ] : [];
		else
			val = val.length ? val.split(/\s+/) : [];

		val.forEach(function(item) {
			var new_item = null;

			ul.childNodes.forEach(function(li) {
				if (li.getAttribute && li.getAttribute('data-value') === item)
					new_item = li;
			});

			if (!new_item) {
				var markup,
				    tpl = sb.querySelector(sbox.template);

				if (tpl)
					markup = (tpl.textContent || tpl.innerHTML || tpl.firstChild.data).replace(/^<!--|-->$/, '').trim();
				else
					markup = '<li data-value="{{value}}">{{value}}</li>';

				new_item = E(markup.replace(/{{value}}/g, item));

				if (sbox.multi) {
					sbox.transformItem(sb, new_item);
				}
				else {
					var old = ul.querySelector('li[created]');
					if (old)
						ul.removeChild(old);

					new_item.setAttribute('created', '');
				}

				new_item = ul.insertBefore(new_item, ul.lastElementChild);
			}

			sbox.toggleItem(sb, new_item, true);
			sbox.setFocus(sb, new_item, true);
		});
	},

	closeAllDropdowns: function() {
		document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
			s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
		});
	},

	handleClick: function(ev) {
		var sb = ev.currentTarget;

		if (!sb.hasAttribute('open')) {
			if (!matchesElem(ev.target, 'input'))
				this.openDropdown(sb);
		}
		else {
			var li = findParent(ev.target, 'li');
			if (li && li.parentNode.classList.contains('dropdown'))
				this.toggleItem(sb, li);
			else if (li && li.parentNode.classList.contains('preview'))
				this.closeDropdown(sb);
		}

		ev.preventDefault();
		ev.stopPropagation();
	},

	handleKeydown: function(ev) {
		var sb = ev.currentTarget;

		if (matchesElem(ev.target, 'input'))
			return;

		if (!sb.hasAttribute('open')) {
			switch (ev.keyCode) {
			case 37:
			case 38:
			case 39:
			case 40:
				this.openDropdown(sb);
				ev.preventDefault();
			}
		}
		else {
			var active = findParent(document.activeElement, 'li');

			switch (ev.keyCode) {
			case 27:
				this.closeDropdown(sb);
				break;

			case 13:
				if (active) {
					if (!active.hasAttribute('selected'))
						this.toggleItem(sb, active);
					this.closeDropdown(sb);
					ev.preventDefault();
				}
				break;

			case 32:
				if (active) {
					this.toggleItem(sb, active);
					ev.preventDefault();
				}
				break;

			case 38:
				if (active && active.previousElementSibling) {
					this.setFocus(sb, active.previousElementSibling);
					ev.preventDefault();
				}
				break;

			case 40:
				if (active && active.nextElementSibling) {
					this.setFocus(sb, active.nextElementSibling);
					ev.preventDefault();
				}
				break;
			}
		}
	},

	handleDropdownClose: function(ev) {
		var sb = ev.currentTarget;

		this.closeDropdown(sb, true);
	},

	handleDropdownSelect: function(ev) {
		var sb = ev.currentTarget,
		    li = findParent(ev.target, 'li');

		if (!li)
			return;

		this.toggleItem(sb, li);
		this.closeDropdown(sb, true);
	},

	handleMouseover: function(ev) {
		var sb = ev.currentTarget;

		if (!sb.hasAttribute('open'))
			return;

		var li = findParent(ev.target, 'li');

		if (li && li.parentNode.classList.contains('dropdown'))
			this.setFocus(sb, li);
	},

	handleFocus: function(ev) {
		var sb = ev.currentTarget;

		document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
			if (s !== sb || sb.hasAttribute('open'))
				s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
		});
	},

	handleCanaryFocus: function(ev) {
		this.closeDropdown(ev.currentTarget.parentNode);
	},

	handleCreateKeydown: function(ev) {
		var input = ev.currentTarget,
		    sb = findParent(input, '.cbi-dropdown');

		switch (ev.keyCode) {
		case 13:
			ev.preventDefault();

			if (input.classList.contains('cbi-input-invalid'))
				return;

			this.createItems(sb, input.value);
			input.value = '';
			input.blur();
			break;
		}
	},

	handleCreateFocus: function(ev) {
		var input = ev.currentTarget,
		    cbox = findParent(input, 'li').querySelector('input[type="checkbox"]'),
		    sb = findParent(input, '.cbi-dropdown');

		if (cbox)
			cbox.checked = true;

		sb.setAttribute('locked-in', '');
	},

	handleCreateBlur: function(ev) {
		var input = ev.currentTarget,
		    cbox = findParent(input, 'li').querySelector('input[type="checkbox"]'),
		    sb = findParent(input, '.cbi-dropdown');

		if (cbox)
			cbox.checked = false;

		sb.removeAttribute('locked-in');
	},

	handleCreateClick: function(ev) {
		ev.currentTarget.querySelector(this.create).focus();
	}
};

function cbi_dropdown_init(sb) {
	if (!(this instanceof cbi_dropdown_init))
		return new cbi_dropdown_init(sb);

	this.multi = sb.hasAttribute('multiple');
	this.optional = sb.hasAttribute('optional');
	this.placeholder = sb.getAttribute('placeholder') || '---';
	this.display_items = parseInt(sb.getAttribute('display-items') || 3);
	this.dropdown_items = parseInt(sb.getAttribute('dropdown-items') || 5);
	this.create = sb.getAttribute('item-create') || '.create-item-input';
	this.template = sb.getAttribute('item-template') || 'script[type="item-template"]';

	var ul = sb.querySelector('ul'),
	    more = sb.appendChild(E('span', { class: 'more', tabindex: -1 }, '···')),
	    open = sb.appendChild(E('span', { class: 'open', tabindex: -1 }, '▾')),
	    canary = sb.appendChild(E('div')),
	    create = sb.querySelector(this.create),
	    ndisplay = this.display_items,
	    n = 0;

	if (this.multi) {
		var items = ul.querySelectorAll('li');

		for (var i = 0; i < items.length; i++) {
			this.transformItem(sb, items[i]);

			if (items[i].hasAttribute('selected') && ndisplay-- > 0)
				items[i].setAttribute('display', n++);
		}
	}
	else {
		if (this.optional && !ul.querySelector('li[data-value=""]')) {
			var placeholder = E('li', { placeholder: '' }, this.placeholder);
			ul.firstChild ? ul.insertBefore(placeholder, ul.firstChild) : ul.appendChild(placeholder);
		}

		var items = ul.querySelectorAll('li'),
		    sel = sb.querySelectorAll('[selected]');

		sel.forEach(function(s) {
			s.removeAttribute('selected');
		});

		var s = sel[0] || items[0];
		if (s) {
			s.setAttribute('selected', '');
			s.setAttribute('display', n++);
		}

		ndisplay--;
	}

	this.saveValues(sb, ul);

	ul.setAttribute('tabindex', -1);
	sb.setAttribute('tabindex', 0);

	if (ndisplay < 0)
		sb.setAttribute('more', '')
	else
		sb.removeAttribute('more');

	if (ndisplay === this.display_items)
		sb.setAttribute('empty', '')
	else
		sb.removeAttribute('empty');

	more.innerHTML = (ndisplay === this.display_items) ? this.placeholder : '···';


	sb.addEventListener('click', this.handleClick.bind(this));
	sb.addEventListener('keydown', this.handleKeydown.bind(this));
	sb.addEventListener('cbi-dropdown-close', this.handleDropdownClose.bind(this));
	sb.addEventListener('cbi-dropdown-select', this.handleDropdownSelect.bind(this));

	if ('ontouchstart' in window) {
		sb.addEventListener('touchstart', function(ev) { ev.stopPropagation(); });
		window.addEventListener('touchstart', this.closeAllDropdowns);
	}
	else {
		sb.addEventListener('mouseover', this.handleMouseover.bind(this));
		sb.addEventListener('focus', this.handleFocus.bind(this));

		canary.addEventListener('focus', this.handleCanaryFocus.bind(this));

		window.addEventListener('mouseover', this.setFocus);
		window.addEventListener('click', this.closeAllDropdowns);
	}

	if (create) {
		create.addEventListener('keydown', this.handleCreateKeydown.bind(this));
		create.addEventListener('focus', this.handleCreateFocus.bind(this));
		create.addEventListener('blur', this.handleCreateBlur.bind(this));

		var li = findParent(create, 'li');

		li.setAttribute('unselectable', '');
		li.addEventListener('click', this.handleCreateClick.bind(this));
	}
}

cbi_dropdown_init.prototype = CBIDropdown;

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
