'use strict';
'require baseclass';

function bytelen(x) {
	return new Blob([x]).size;
}

function arrayle(a, b) {
	if (!Array.isArray(a) || !Array.isArray(b))
		return false;

	for (let i = 0; i < a.length; i++)
		if (a[i] > b[i])
			return false;
		else if (a[i] < b[i])
			return true;

	return true;
}

const Validator = baseclass.extend({
	__name__: 'Validation',

	__init__(field, type, optional, vfunc, validatorFactory) {
		this.field = field;
		this.optional = optional;
		this.vfunc = vfunc;
		this.vstack = validatorFactory.compile(type);
		this.factory = validatorFactory;
	},

	assert(condition, message) {
		if (!condition) {
			this.field.classList.add('cbi-input-invalid');
			this.error = message;
			return false;
		}

		this.field.classList.remove('cbi-input-invalid');
		this.error = null;
		return true;
	},

	apply(name, value, args) {
		let func;

		if (typeof(name) === 'function')
			func = name;
		else if (typeof(this.factory.types[name]) === 'function')
			func = this.factory.types[name];
		else
			return false;

		if (value != null)
			this.value = value;

		return func.apply(this, args);
	},

	validate() {
		/* element is detached */
		if (!findParent(this.field, 'body') && !findParent(this.field, '[data-field]'))
			return true;

		this.field.classList.remove('cbi-input-invalid');
		this.value = (this.field.value != null) ? this.field.value : '';
		this.error = null;

		let valid;

		if (this.value.length === 0)
			valid = this.assert(this.optional, _('non-empty value'));
		else
			valid = this.vstack[0].apply(this, this.vstack[1]);

		if (valid !== true) {
			const message = _('Expecting: %s').format(this.error);
			this.field.setAttribute('data-tooltip', message);
			this.field.setAttribute('data-tooltip-style', 'error');
			this.field.dispatchEvent(new CustomEvent('validation-failure', {
				bubbles: true,
				detail: {
					message: message
				}
			}));
			return false;
		}

		if (typeof(this.vfunc) == 'function')
			valid = this.vfunc(this.value);

		if (valid !== true) {
			this.assert(false, valid);
			this.field.setAttribute('data-tooltip', valid);
			this.field.setAttribute('data-tooltip-style', 'error');
			this.field.dispatchEvent(new CustomEvent('validation-failure', {
				bubbles: true,
				detail: {
					message: valid
				}
			}));
			return false;
		}

		this.field.removeAttribute('data-tooltip');
		this.field.removeAttribute('data-tooltip-style');
		this.field.dispatchEvent(new CustomEvent('validation-success', { bubbles: true }));
		return true;
	},

});

const ValidatorFactory = baseclass.extend({
	__name__: 'ValidatorFactory',

	create(field, type, optional, vfunc) {
		return new Validator(field, type, optional, vfunc, this);
	},

	compile(code) {
		let pos = 0;
		let esc = false;
		let depth = 0;
		const stack = [ ];

		code += ',';

		for (let i = 0; i < code.length; i++) {
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
						let label = code.substring(pos, i);
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
							L.raise('SyntaxError', 'Unhandled token "%s"', label);
						}
					}

					pos = i+1;
				}

				depth += (code.charCodeAt(i) == 40);
				break;

			case 41:
				if (--depth <= 0) {
					if (typeof stack[stack.length-2] != 'function')
						L.raise('SyntaxError', 'Argument list follows non-function');

					stack[stack.length-1] = this.compile(code.substring(pos, i));
					pos = i+1;
				}

				break;
			}
		}

		return stack;
	},

	parseInteger(x) {
		return (/^-?\d+$/.test(x) ? +x : NaN);
	},

	parseDecimal(x) {
		return (/^-?\d+(?:\.\d+)?$/.test(x) ? +x : NaN);
	},

	parseIPv4(x) {
		if (!x.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/))
			return null;

		if (RegExp.$1 > 255 || RegExp.$2 > 255 || RegExp.$3 > 255 || RegExp.$4 > 255)
			return null;

		return [ +RegExp.$1, +RegExp.$2, +RegExp.$3, +RegExp.$4 ];
	},

	parseIPv6(x) {
		if (x.match(/^([a-fA-F0-9:]+):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)) {
			const v6 = RegExp.$1;
			const v4 = this.parseIPv4(RegExp.$2);

			if (!v4)
				return null;

			x = `${v6}:${(v4[0] * 256 + v4[1]).toString(16)}:${(v4[2] * 256 + v4[3]).toString(16)}`;
		}

		if (!x.match(/^[a-fA-F0-9:]+$/))
			return null;

		const prefix_suffix = x.split(/::/);

		if (prefix_suffix.length > 2)
			return null;

		const prefix = (prefix_suffix[0] || '0').split(/:/);
		const suffix = prefix_suffix.length > 1 ? (prefix_suffix[1] || '0').split(/:/) : [];

		if (suffix.length ? (prefix.length + suffix.length > 7)
			              : ((prefix_suffix.length < 2 && prefix.length < 8) || prefix.length > 8))
			return null;

		let i;
		let word;
		const words = [];

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
	},

	types: {
		integer() {
			return this.assert(!isNaN(this.factory.parseInteger(this.value)), _('valid integer value'));
		},

		uinteger() {
			return this.assert(this.factory.parseInteger(this.value) >= 0, _('positive integer value'));
		},

		float() {
			return this.assert(!isNaN(this.factory.parseDecimal(this.value)), _('valid decimal value'));
		},

		ufloat() {
			return this.assert(this.factory.parseDecimal(this.value) >= 0, _('positive decimal value'));
		},

		ipaddr(nomask) {
			return this.assert(this.apply('ip4addr', null, [nomask]) || this.apply('ip6addr', null, [nomask]),
				nomask ? _('valid IP address') : _('valid IP address or prefix'));
		},

		ip4addr(nomask) {
			const re = nomask ? /^(\d+\.\d+\.\d+\.\d+)$/ : /^(\d+\.\d+\.\d+\.\d+)(?:\/(\d+\.\d+\.\d+\.\d+)|\/(\d{1,2}))?$/;
			const m = this.value.match(re);

			return this.assert(m && this.factory.parseIPv4(m[1]) && (m[2] ? this.factory.parseIPv4(m[2]) : (m[3] ? this.apply('ip4prefix', m[3]) : true)),
				nomask ? _('valid IPv4 address') : _('valid IPv4 address or network'));
		},

		ip6addr(nomask) {
			const re = nomask ? /^([0-9a-fA-F:.]+)$/ : /^([0-9a-fA-F:.]+)(?:\/(\d{1,3}))?$/;
			const m = this.value.match(re);

			return this.assert(m && this.factory.parseIPv6(m[1]) && (m[2] ? this.apply('ip6prefix', m[2]) : true),
				nomask ? _('valid IPv6 address') : _('valid IPv6 address or prefix'));
		},

		ip4prefix() {
			return this.assert(!isNaN(this.value) && this.value >= 0 && this.value <= 32,
				_('valid IPv4 prefix value (0-32)'));
		},

		ip6prefix() {
			return this.assert(!isNaN(this.value) && this.value >= 0 && this.value <= 128,
				_('valid IPv6 prefix value (0-128)'));
		},

		cidr(negative) {
			return this.assert(this.apply('cidr4', null, [negative]) || this.apply('cidr6', null, [negative]),
				_('valid IPv4 or IPv6 CIDR'));
		},

		cidr4(negative) {
			const m = this.value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(-)?(\d{1,2})$/);
			return this.assert(m && this.factory.parseIPv4(m[1]) && (negative || !m[2]) && this.apply('ip4prefix', m[3]),
				_('valid IPv4 CIDR'));
		},

		cidr6(negative) {
			const m = this.value.match(/^([0-9a-fA-F:.]+)\/(-)?(\d{1,3})$/);
			return this.assert(m && this.factory.parseIPv6(m[1]) && (negative || !m[2]) && this.apply('ip6prefix', m[3]),
				_('valid IPv6 CIDR'));
		},

		ipnet4() {
			const m = this.value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
			return this.assert(m && this.factory.parseIPv4(m[1]) && this.factory.parseIPv4(m[2]), _('IPv4 network in address/netmask notation'));
		},

		ipnet6() {
			const m = this.value.match(/^([0-9a-fA-F:.]+)\/([0-9a-fA-F:.]+)$/);
			return this.assert(m && this.factory.parseIPv6(m[1]) && this.factory.parseIPv6(m[2]), _('IPv6 network in address/netmask notation'));
		},

		ip6hostid() {
			if (this.value == "eui64" || this.value == "random")
				return true;

			const v6 = this.factory.parseIPv6(this.value);
			return this.assert(!(!v6 || v6[0] || v6[1] || v6[2] || v6[3]), _('valid IPv6 host id'));
		},

		ipmask(negative) {
			return this.assert(this.apply('ipmask4', null, [negative]) || this.apply('ipmask6', null, [negative]),
				_('valid network in address/netmask notation'));
		},

		ipmask4(negative) {
			return this.assert(this.apply('cidr4', null, [negative]) || this.apply('ipnet4') || this.apply('ip4addr'),
				_('valid IPv4 network'));
		},

		ipmask6(negative) {
			return this.assert(this.apply('cidr6', null, [negative]) || this.apply('ipnet6') || this.apply('ip6addr'),
				_('valid IPv6 network'));
		},

		iprange(negative) {
			return this.assert(this.apply('iprange4', null, [negative]) || this.apply('iprange6', null, [negative]),
				_('valid IP address range'));
		},

		iprange4(negative) {
			const m = this.value.split('-');
			return this.assert(m.length == 2 && arrayle(this.factory.parseIPv4(m[0]), this.factory.parseIPv4(m[1])),
				_('valid IPv4 address range'));
		},

		iprange6(negative) {
			const m = this.value.split('-');
			return this.assert(m.length == 2 && arrayle(this.factory.parseIPv6(m[0]), this.factory.parseIPv6(m[1])),
				_('valid IPv6 address range'));
		},

		port() {
			const p = this.factory.parseInteger(this.value);
			return this.assert(p >= 0 && p <= 65535, _('valid port value'));
		},

		portrange() {
			if (this.value.match(/^(\d+)-(\d+)$/)) {
				const p1 = +RegExp.$1;
				const p2 = +RegExp.$2;
				return this.assert(p1 <= p2 && p2 <= 65535,
					_('valid port or port range (port1-port2)'));
			}

			return this.assert(this.apply('port'), _('valid port or port range (port1-port2)'));
		},

		macaddr(multicast) {
			const m = this.value.match(/^([a-fA-F0-9]{2}):([a-fA-F0-9]{2}:){4}[a-fA-F0-9]{2}$/);
			return this.assert(m != null && !(+m[1] & 1) == !multicast,
				multicast ? _('valid multicast MAC address') : _('valid MAC address'));
		},

		host(ipv4only) {
			return this.assert(this.apply('hostname') || this.apply(ipv4only == 1 ? 'ip4addr' : 'ipaddr', null, ['nomask']),
				_('valid hostname or IP address'));
		},

		hostname(strict) {
			if (this.value.length <= 253)
				return this.assert(
					(this.value.match(/^[a-zA-Z0-9_]+$/) != null ||
						(this.value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_\-.]*[a-zA-Z0-9]\.?$/) &&
						 this.value.match(/[^0-9.]/))) &&
					(!strict || !this.value.match(/^_/)),
					_('valid hostname'));

			return this.assert(false, _('valid hostname'));
		},

		network() {
			return this.assert(this.apply('uciname') || this.apply('hostname') || this.apply('ip4addr') || this.apply('ip6addr'),
				_('valid UCI identifier, hostname or IP address range'));
		},

		hostport(ipv4only) {
			const hp = this.value.split(/:/);
			return this.assert(hp.length == 2 && this.apply('host', hp[0], [ipv4only]) && this.apply('port', hp[1]),
				_('valid host:port'));
		},

		ip4addrport() {
			const hp = this.value.split(/:/);
			return this.assert(hp.length == 2 && this.apply('ip4addr', hp[0], [true]) && this.apply('port', hp[1]),
				_('valid IPv4 address:port'));
		},

		ipaddrport(bracket) {
			const m4 = this.value.match(/^([^\[\]:]+):(\d+)$/);
			const m6 = this.value.match((bracket == 1) ? /^\[(.+)\]:(\d+)$/ : /^([^\[\]]+):(\d+)$/);

			if (m4)
				return this.assert(this.apply('ip4addr', m4[1], [true]) && this.apply('port', m4[2]),
					_('valid address:port'));

			return this.assert(m6 && this.apply('ip6addr', m6[1], [true]) && this.apply('port', m6[2]),
				_('valid address:port'));
		},

		wpakey() {
			const v = this.value;

			if (v.length == 64)
				return this.assert(v.match(/^[a-fA-F0-9]{64}$/), _('valid hexadecimal WPA key'));

			return this.assert((v.length >= 8) && (v.length <= 63), _('key between 8 and 63 characters'));
		},

		wepkey() {
			let v = this.value;

			if (v.substr(0, 2) === 's:')
				v = v.substr(2);

			if ((v.length == 10) || (v.length == 26))
				return this.assert(v.match(/^[a-fA-F0-9]{10,26}$/), _('valid hexadecimal WEP key'));

			return this.assert((v.length === 5) || (v.length === 13), _('key with either 5 or 13 characters'));
		},

		uciname() {
			return this.assert(this.value.match(/^[a-zA-Z0-9_]+$/), _('valid UCI identifier'));
		},

		netdevname() {
			const v = this.value;

			if (v == '.' || v == '..')
				return this.assert(false, _('valid network device name, not "." or ".."'));

			return this.assert(v.match(/^[^:\/%\s]{1,15}$/), _('valid network device name between 1 and 15 characters not containing ":", "/", "%" or spaces'));
		},

		range(min, max) {
			const val = this.factory.parseDecimal(this.value);
			return this.assert(val >= +min && val <= +max, _('value between %f and %f').format(min, max));
		},

		min(min) {
			return this.assert(this.factory.parseDecimal(this.value) >= +min, _('value greater or equal to %f').format(min));
		},

		max(max) {
			return this.assert(this.factory.parseDecimal(this.value) <= +max, _('value smaller or equal to %f').format(max));
		},

		length(len) {
			return this.assert(bytelen(this.value) == +len,
				_('value with %d characters').format(len));
		},

		rangelength(min, max) {
			const len = bytelen(this.value);
			return this.assert((len >= +min) && (len <= +max),
				_('value between %d and %d characters').format(min, max));
		},

		minlength(min) {
			return this.assert(bytelen(this.value) >= +min,
				_('value with at least %d characters').format(min));
		},

		maxlength(max) {
			return this.assert(bytelen(this.value) <= +max,
				_('value with at most %d characters').format(max));
		},

		or() {
			const errors = [];

			for (let i = 0; i < arguments.length; i += 2) {
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

			const t = _('One of the following: %s');

			return this.assert(false, t.format(`\n - ${errors.join('\n - ')}`));
		},

		and() {
			for (let i = 0; i < arguments.length; i += 2) {
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

		neg() {
			this.value = this.value.replace(/^[ \t]*![ \t]*/, '');

			if (arguments[0].apply(this, arguments[1]))
				return this.assert(true);

			return this.assert(false, _('Potential negation of: %s').format(this.error));
		},

		list(subvalidator, subargs) {
			this.field.setAttribute('data-is-list', 'true');

			const tokens = this.value.match(/[^ \t]+/g);
			for (let i = 0; i < tokens.length; i++)
				if (!this.apply(subvalidator, tokens[i], subargs))
					return this.assert(false, this.error);

			return this.assert(true);
		},

		phonedigit() {
			return this.assert(this.value.match(/^[0-9\*#!\.]+$/),
				_('valid phone digit (0-9, "*", "#", "!" or ".")'));
		},

		timehhmmss() {
			return this.assert(this.value.match(/^(?:[01]\d|2[0-3]):[0-5]\d:(?:[0-5]\d|60)$/),
				_('valid time (HH:MM:SS)'));
		},

		dateyyyymmdd() {
			if (this.value.match(/^(\d\d\d\d)-(\d\d)-(\d\d)/)) {
				const year  = +RegExp.$1;
				const month = +RegExp.$2;
				const day   = +RegExp.$3;
				const days_in_month = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

				const is_leap_year = year => (!(year % 4) && (year % 100)) || !(year % 400);
				const get_days_in_month = (month, year) => (month === 2 && is_leap_year(year)) ? 29 : days_in_month[month - 1];

				/* Firewall rules in the past don't make sense */
				return this.assert(year >= 2015 && month && month <= 12 && day && day <= get_days_in_month(month, year),
					_('valid date (YYYY-MM-DD)'));
			}

			return this.assert(false, _('valid date (YYYY-MM-DD)'));
		},

		unique(subvalidator, subargs) {
			const ctx = this;
			const option = findParent(ctx.field, '[data-widget][data-name]');
			const section = findParent(option, '.cbi-section');
			const query = '[data-widget="%s"][data-name="%s"]'.format(option.getAttribute('data-widget'), option.getAttribute('data-name'));
			let unique = true;

			section.querySelectorAll(query).forEach(sibling => {
				if (sibling === option)
					return;

				const input = sibling.querySelector('[data-type]');
				const values = input ? (input.getAttribute('data-is-list') ? input.value.match(/[^ \t]+/g) : [ input.value ]) : null;

				if (values !== null && values.indexOf(ctx.value) !== -1)
					unique = false;
			});

			if (!unique)
				return this.assert(false, _('unique value'));

			if (typeof(subvalidator) === 'function')
				return this.apply(subvalidator, null, subargs);

			return this.assert(true);
		},

		hexstring() {
			return this.assert(this.value.match(/^([a-fA-F0-9]{2})+$/i),
				_('hexadecimal encoded value'));
		},

		string() {
			return true;
		},

		directory() {
			return true;
		},

		file() {
			return true;
		},

		device() {
			return true;
		}
	}
});

return ValidatorFactory;
