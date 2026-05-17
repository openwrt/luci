'use strict';
'require baseclass';

/**
 * @namespace LuCI.validation
 * @memberof LuCI
 */

/**
 * @class validation
 * @memberof LuCI
 * @hideconstructor
 * @classdesc
 *
 * The LuCI validation class provides functions to perform validation
 * on user input within various [form]{@link LuCI.form} input fields.
 *
 * To import the class, use `'require validation'`. To import it in
 * external JavaScript, use `L.require("validation").then(...)`.
 * 
 * Note: it is not required to import this class in forms for use: it is
 * imported by {@link LuCI.ui ui} where {@link LuCI.form form} elements
 * are defined.
 *
 * A typical validation is instantiated by first constructing a
 * {@link LuCI.form} element and
 * by adding a [datatype]{@link LuCI.form.AbstractValue#datatype} to the
 * element properties.
 *
 * @example
 *
 * 'use strict';
 * ...
 *
 * let m, s, o;
 *
 * ...
 *
 * o = s.option(form.Value, 'some_value', 'A value element');
 * o.datatype = 'ipaddr';
 *
 * ...
 *
 * @example <caption>A validator stub can be instantiated so:</caption>
 *
 * const stubValidator = {
 * 	factory: validation,
 * 	apply: function(type, value, args) {
 * 		if (value != null)
 * 			this.value = value;
 *
 * 		return validation.types[type].apply(this, args);
 * 	},
 * 	assert: function(condition) {
 * 		return !!condition;
 * 	}
 * };
 *
 * @example <caption>and later used so in a custom `o.validate` function:</caption>
 *
 * ...
 * stubValidator.apply('ipaddr', m4 ? m4[1] : m6[1])
 * ...
 *
 * @example <caption> One can also add validators to HTML UI elements via
 * {@link LuCI.ui#addValidator}: </caption>
 *
 * ...
 * 	s.renderSectionAdd = function(extra_class) {
 * 	var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
 * 			nameEl = el.querySelector('.cbi-section-create-name');
 * 		ui.addValidator(nameEl, 'uciname', true, function(v) {
 * 			let sections = [
 * 				...uci.sections('config', 'section_type1'),
 * 				...uci.sections('config', 'section_type2'),
 * 			];
 * 			if (sections.find(function(s) {
 * 				return s['.name'] == v;
 * 			})) {
 * 				return _('This may not share the same name as other section type1 or section type2.');
 * 			}
 * 			if (v.length > 15) return _('Name length shall not exceed 15 characters');
 * 			return true;
 * 		}, 'blur', 'keyup');
 * 		return el;
 * 	};
 * ...
 *
 */

/**
 * Return byte length of a string using Blob (UTF-8 byte count).
 *
 * @memberof LuCI.validation
 * @param {string} x - Input string.
 * @returns {number} Byte length of the string.
 */
function bytelen(x) {
	return new Blob([x]).size;
}

/**
 * Compare two arrays element-wise: return true if `a < b` in lexicographic
 * element comparison.
 *
 * @memberof LuCI.validation
 * @param {Array<number>} a - First array.
 * @param {Array<number>} b - Second array.
 * @returns {boolean} True if arrays compare as `a < b`, false otherwise.
 */
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

/**
 * @class Validator
 * @classdesc
 * 
 * @memberof LuCI.validation
 * @param {string} field - the UI field to validate.
 * @param {string} type - type of validator.
 * @param {boolean} optional - set the validation result as optional.
 * @param {vfunc} function - validation function.
 * @param {ValidatorFactory} validatorFactory - a ValidatorFactory instance.
 * @returns {Validator} a Validator instance.
 */
const Validator = baseclass.extend(/** @lends LuCI.validation.Validator.prototype */ {
	__name__: 'Validation',

	__init__(field, type, optional, vfunc, validatorFactory) {
		this.field = field;
		this.optional = optional;
		this.vfunc = vfunc;
		this.vstack = validatorFactory.compile(type);
		this.factory = validatorFactory;
	},

	/**
	 * Assert a condition and update field error state.
	 * 
	 * @param {boolean} condition - Condition that must be true.
	 * @param {string} message - Error message when assertion fails.
	 * @returns {boolean} True when assertion is true, false otherwise.
	 */
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

	/**
	 * Apply a validation function by name or directly via function reference.
	 * If a name is provided it resolves it via the factory's registered `types`.
	 * 
	 * @param {string|function} name - Validator name or function.
	 * @param {*} value - Value to validate (optional; defaults to field value).
	 * @param {Array} args - Arguments passed to the validator function.
	 * @returns {*} Validator result.
	 */
	apply(name, value, args) {
		let func;

		if (typeof(name) === 'function')
			func = name;
		else if (typeof(this.factory.types[name]) === 'function')
			func = this.factory.types[name];
		else
			return false;

		if (value != null && value != undefined)
			this.value = value;

		return func.apply(this, args);
	},

	/**
	 * Validate the associated field value using the compiled validator stack
	 * and any additional validators provided at construction time.
	 * Emits 'validation-failure' or 'validation-success' CustomEvents on the field.
	 * 
	 * @returns {boolean} True if validation succeeds, false otherwise.
	 */
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

		if (typeof(this.vfunc) == 'function') {
			valid = this.vfunc(this.value);
		} else if (Array.isArray(this.vfunc)) {
			/* Execute validation functions serially */
			for (let val of this.vfunc) {
				if (typeof(val) == 'function') {
					valid = val(this.value);
					if (valid !== true)
						break;
				}
			}
		}

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

/**
 * @classdesc
 * Factory to create Validator instances and compile validation expressions.
 * 
 * @memberof LuCI.validation
 * @class ValidatorFactory
 * @hideconstructor
 */
const ValidatorFactory = baseclass.extend(/** @lends LuCI.validation.ValidatorFactory.prototype */ {
	__name__: 'ValidatorFactory',


	/**
	 * Compile a validator expression string into an internal stack representation.
	 *
	 * @param {string} field field name
	 * @param {string} type validator type
	 * @param {boolean} optional whether the field is optional
	 * @param {string} vfunc a validator function
	 * @returns {Validator} Compiled token stack used by validators.
	 */
	create(field, type, optional, vfunc) {
		return new Validator(field, type, optional, vfunc, this);
	},

	/**
	 * Compile a validator expression string into an internal stack representation.
	 *
	 * @param {string} code - Validator expression string (e.g. `or(ipaddr,port)`).
	 * @returns {Array} Compiled token stack used by validators.
	 */
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

			// Skip over quoted strings so commas inside quotes don't split tokens
			case 34: // "
			case 39: { // '\''
				const quote = code.charCodeAt(i);
				let j = i + 1;
				for (; j < code.length; j++) {
					if (code.charCodeAt(j) === 92) { j++; continue; }
					if (code.charCodeAt(j) === quote) { i = j; break; }
				}
				break;
			}

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

	/**
	 * Parse an integer string. Returns NaN when not a valid integer.
	 * @param {string} x
	 * @returns {number} Integer or NaN
	 */
	parseInteger(x) {
		return (/^-?\d+$/.test(x) ? +x : NaN);
	},

	/**
	 * Parse a decimal number string. Returns NaN when not a valid number.
	 * @param {string} x
	 * @returns {number} Decimal number or NaN
	 */
	parseDecimal(x) {
		return (/^-?\d+(?:\.\d+)?$/.test(x) ? +x : NaN);
	},

	/**
	 * Parse IPv4 address into an array of 4 octets or return null on failure.
	 * @param {string} x - IPv4 address string
	 * @returns {Array<number>|null} Array of 4 octets or null.
	 */
	parseIPv4(x) {
		if (!x.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/))
			return null;

		if (RegExp.$1 > 255 || RegExp.$2 > 255 || RegExp.$3 > 255 || RegExp.$4 > 255)
			return null;

		return [ +RegExp.$1, +RegExp.$2, +RegExp.$3, +RegExp.$4 ];
	},

	/**
	 * Parse IPv6 address into an array of 8 16-bit words or return null on failure.
	 * Supports IPv4-embedded IPv6 (::ffff:a.b.c.d) and zero-compression.
	 * @param {string} x - IPv6 address string
	 * @returns {Array<number>|null} Array of 8 16-bit words or null.
	 */
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

	/**
	 * Collection of type handlers.
	 * Each function consumes `this.value` and returns `this.assert` to report errors.
	 *
	 * All functions return the result of {@link LuCI.validation.Validator#assert assert()}.
	 * @namespace types
	 * @memberof LuCI.validation.ValidatorFactory
	 */
	types:  /** @lends LuCI.validation.ValidatorFactory#types */  {
		/**
		 * Assert a signed integer value (+/-).
		 * @function LuCI.validation.ValidatorFactory.types#integer
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		integer() {
			return this.assert(!isNaN(this.factory.parseInteger(this.value)), _('valid integer value'));
		},

		/**
		 * Assert an unsigned integer value (+).
		 * @function LuCI.validation.ValidatorFactory.types#uinteger
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		uinteger() {
			return this.assert(this.factory.parseInteger(this.value) >= 0, _('positive integer value'));
		},

		/**
		 * Assert a signed float value (+/-).
		 * @function LuCI.validation.ValidatorFactory.types#float
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		float() {
			return this.assert(!isNaN(this.factory.parseDecimal(this.value)), _('valid decimal value'));
		},

		/**
		 * Assert an unsigned float value (+).
		 * @function LuCI.validation.ValidatorFactory.types#ufloat
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ufloat() {
			return this.assert(this.factory.parseDecimal(this.value) >= 0, _('positive decimal value'));
		},

		/**
		 * Assert an IPv4/6 address.
		 * @function LuCI.validation.ValidatorFactory.types#ipaddr
		 * @param {string} [nomask] reject a `/x` netmask.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ipaddr(nomask) {
			return this.assert(this.apply('ip4addr', null, [nomask]) || this.apply('ip6addr', null, [nomask]),
				nomask ? _('valid IP address') : _('valid IP address or prefix'));
		},

		/**
		 * Assert an IPv4 address.
		 * @function LuCI.validation.ValidatorFactory.types#ip4addr
		 * @param {string} [nomask] reject a `/x` netmask.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip4addr(nomask) {
			const re = nomask ? /^(\d+\.\d+\.\d+\.\d+)$/ : /^(\d+\.\d+\.\d+\.\d+)(?:\/(\d+\.\d+\.\d+\.\d+)|\/(\d{1,2}))?$/;
			const m = this.value.match(re);

			return this.assert(m && this.factory.parseIPv4(m[1]) && (m[2] ? this.factory.parseIPv4(m[2]) : (m[3] ? this.apply('ip4prefix', m[3]) : true)),
				nomask ? _('valid IPv4 address') : _('valid IPv4 address or network'));
		},

		/**
		 * Assert an IPv6 address.
		 * @function LuCI.validation.ValidatorFactory.types#ip6addr
		 * @param {string} [nomask] reject a `/x` netmask.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip6addr(nomask) {
			const re = nomask ? /^([0-9a-fA-F:.]+)$/ : /^([0-9a-fA-F:.]+)(?:\/(\d{1,3}))?$/;
			const m = this.value.match(re);

			return this.assert(m && this.factory.parseIPv6(m[1]) && (m[2] ? this.apply('ip6prefix', m[2]) : true),
				nomask ? _('valid IPv6 address') : _('valid IPv6 address or prefix'));
		},

		/**
		 * Assert an IPv6 Link Local address.
		 * @function LuCI.validation.ValidatorFactory.types#ip6ll
		 * @param {string} [nomask] reject a `/x` netmask.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip6ll(nomask) {
			/* fe80::/10  -> 0xfe80 .. 0xfebf */
			const x = parseInt(this.value, 16) | 0;
			const isll = (((x & 0xffc0) ^ 0xfe80) === 0);

			return this.assert(isll && this.apply('ip6addr', nomask),
				_('valid IPv6 Link Local address'));
		},

		/**
		 * Assert an IPv6 UL address.
		 * @function LuCI.validation.ValidatorFactory.types#ip6ula
		 * @param {string} [nomask] reject a `/x` netmask.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip6ula(nomask) {
			/* fd00::/8  -> 0xfd00 .. 0xfdff */
			const x = parseInt(this.value, 16) | 0;
			const isula = (((x & 0xfe00) ^ 0xfc00) === 0);

			return this.assert(isula && this.apply('ip6addr', nomask),
				_('valid IPv6 ULA address'));
		},

		/**
		 * Assert an IPv4 prefix.
		 * @function LuCI.validation.ValidatorFactory.types#ip4prefix
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip4prefix() {
			return this.assert(!isNaN(this.value) && this.value >= 0 && this.value <= 32,
				_('valid IPv4 prefix value (0-32)'));
		},

		/**
		 * Assert an IPv6 prefix.
		 * @function LuCI.validation.ValidatorFactory.types#ip6prefix
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip6prefix() {
			return this.assert(!isNaN(this.value) && this.value >= 0 && this.value <= 128,
				_('valid IPv6 prefix value (0-128)'));
		},

		/**
		 * Assert a IPv4/6 CIDR.
		 * @function LuCI.validation.ValidatorFactory.types#cidr
		 * @param {boolean} [negative] allow netmask forms with `/-...` to mark
		 * negation of the range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		cidr(negative) {
			return this.assert(this.apply('cidr4', null, [negative]) || this.apply('cidr6', null, [negative]),
				_('valid IPv4 or IPv6 CIDR'));
		},

		/**
		 * Assert a IPv4 CIDR.
		 * @function LuCI.validation.ValidatorFactory.types#cidr4
		 * @param {boolean} [negative] allow netmask forms with `/-...`.
		 * E.g. `192.0.2.1/-24` to mark negation of the range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		cidr4(negative) {
			const m = this.value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(-)?(\d{1,2})$/);
			return this.assert(m && this.factory.parseIPv4(m[1]) && (negative || !m[2]) && this.apply('ip4prefix', m[3]),
				_('valid IPv4 CIDR'));
		},

		/**
		 * Assert a IPv6 CIDR.
		 * @function LuCI.validation.ValidatorFactory.types#cidr6
		 * @param {boolean} [negative] allow netmask forms with `/-...`.
		 * E.g. `2001:db8:dead:beef::/-64` to mark negation of the range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		cidr6(negative) {
			const m = this.value.match(/^([0-9a-fA-F:.]+)\/(-)?(\d{1,3})$/);
			return this.assert(m && this.factory.parseIPv6(m[1]) && (negative || !m[2]) && this.apply('ip6prefix', m[3]),
				_('valid IPv6 CIDR'));
		},

		/**
		 * Assert an IPv4 network in address/netmask notation. E.g.
		 * `192.0.2.1/255.255.255.0`
		 * @function LuCI.validation.ValidatorFactory.types#ipnet4
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ipnet4() {
			const m = this.value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
			return this.assert(m && this.factory.parseIPv4(m[1]) && this.factory.parseIPv4(m[2]), _('IPv4 network in address/netmask notation'));
		},

		/**
		 * Assert an IPv6 network in address/netmask notation. E.g.
		 * `2001:db8:dead:beef::0001/ffff:ffff:ffff:ffff::`
		 * @function LuCI.validation.ValidatorFactory.types#ipnet6
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ipnet6() {
			const m = this.value.match(/^([0-9a-fA-F:.]+)\/([0-9a-fA-F:.]+)$/);
			return this.assert(m && this.factory.parseIPv6(m[1]) && this.factory.parseIPv6(m[2]), _('IPv6 network in address/netmask notation'));
		},

		/**
		 * Assert a IPv6 host ID.
		 * @function LuCI.validation.ValidatorFactory.types#ip6hostid
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip6hostid() {
			if (this.value == "eui64" || this.value == "random")
				return true;

			const v6 = this.factory.parseIPv6(this.value);
			return this.assert(!(!v6 || v6[0] || v6[1] || v6[2] || v6[3]), _('valid IPv6 host id'));
		},

		/**
		 * Assert an IPv4/6 network in address/netmask (CIDR or mask) notation.
		 * @function LuCI.validation.ValidatorFactory.types#ipmask
		 * @param {boolean} [negative] allow netmask forms with `/-...` to mark
		 * negation of the range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ipmask(negative) {
			return this.assert(this.apply('ipmask4', null, [negative]) || this.apply('ipmask6', null, [negative]),
				_('valid network in address/netmask notation'));
		},

		/**
		 * Assert an IPv4 network in address/netmask (CIDR or mask) notation.
		 * @function LuCI.validation.ValidatorFactory.types#ipmask4
		 * @param {boolean} [negative] allow netmask forms with `/-...` to mark
		 * negation of the range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ipmask4(negative) {
			return this.assert(this.apply('cidr4', null, [negative]) || this.apply('ipnet4') || this.apply('ip4addr'),
				_('valid IPv4 network'));
		},

		/**
		 * Assert an IPv6 network in address/netmask (CIDR or mask) notation.
		 * @function LuCI.validation.ValidatorFactory.types#ipmask6
		 * @param {boolean} [negative] allow netmask forms with `/-...` to mark
		 * negation of the range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ipmask6(negative) {
			return this.assert(this.apply('cidr6', null, [negative]) || this.apply('ipnet6') || this.apply('ip6addr'),
				_('valid IPv6 network'));
		},

		/**
		 * Assert a valid IPv4/6 address range.
		 * @function LuCI.validation.ValidatorFactory.types#iprange
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		iprange() {
			return this.assert(this.apply('iprange4', null, []) || this.apply('iprange6', null, []),
				_('valid IP address range'));
		},

		/**
		 * Assert a valid IPv4 address range. E.g.
		 * `192.0.2.1-192.0.2.254`.
		 * @function LuCI.validation.ValidatorFactory.types#iprange4
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		iprange4() {
			const m = this.value.split('-');
			return this.assert(m.length == 2 && arrayle(this.factory.parseIPv4(m[0]), this.factory.parseIPv4(m[1])),
				_('valid IPv4 address range'));
		},

		/**
		 * Assert a valid IPv6 address range. E.g.
		 * `2001:db8:0f00:0000::-2001:db8:0f00:0000:ffff:ffff:ffff:ffff`.
		 * @function LuCI.validation.ValidatorFactory.types#iprange6
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		iprange6() {
			const m = this.value.split('-');
			return this.assert(m.length == 2 && arrayle(this.factory.parseIPv6(m[0]), this.factory.parseIPv6(m[1])),
				_('valid IPv6 address range'));
		},

		/**
		 * Assert a valid port value where `0 <= port <= 65535`.
		 * @function LuCI.validation.ValidatorFactory.types#port
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		port() {
			const p = this.factory.parseInteger(this.value);
			return this.assert(p >= 0 && p <= 65535, _('valid port value'));
		},

		/**
		 * Assert a valid port or port range (port1-port2) where both ports are
		 * positive integers, `port1 <= port2` and `port2 <= 65535` (`2^16 - 1`).
		 * @function LuCI.validation.ValidatorFactory.types#portrange
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		portrange() {
			if (this.value.match(/^(\d+)-(\d+)$/)) {
				const p1 = +RegExp.$1;
				const p2 = +RegExp.$2;
				return this.assert(p1 <= p2 && p2 <= 65535,
					_('valid port or port range (port1-port2)'));
			}

			return this.assert(this.apply('port'), _('valid port or port range (port1-port2)'));
		},

		/**
		 * Assert a valid (multicast) MAC address.
		 * @function LuCI.validation.ValidatorFactory.types#macaddr
		 * @param {boolean} [multicast] enforce a multicast MAC address.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		macaddr(multicast) {
			const m = this.value.match(/^([a-fA-F0-9]{2}):([a-fA-F0-9]{2}:){4}[a-fA-F0-9]{2}$/);
			return this.assert(m != null && !(+m[1] & 1) == !multicast,
				multicast ? _('valid multicast MAC address') : _('valid MAC address'));
		},

		/**
		 * Assert a valid hostname or IP address.
		 * @function LuCI.validation.ValidatorFactory.types#host
		 * @param {boolean} [ipv4only] enforce IPv4 IPs only.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		host(ipv4only) {
			return this.assert(this.apply('hostname') || this.apply(ipv4only == 1 ? 'ip4addr' : 'ipaddr', null, ['nomask']),
				_('valid hostname or IP address'));
		},

		/**
		 * Validate hostname according to common rules.
		 * @function LuCI.validation.ValidatorFactory.types#hostname
		 * @param {boolean} [strict] reject leading underscores.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
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

		/**
		 * Assert a valid UCI identifier, hostname or IP address range.
		 * @function LuCI.validation.ValidatorFactory.types#network
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		network() {
			return this.assert(this.apply('uciname') || this.apply('hostname') || this.apply('ip4addr') || this.apply('ip6addr'),
				_('valid UCI identifier, hostname or IP address range'));
		},

		/**
		 * Assert a valid host:port.
		 * @function LuCI.validation.ValidatorFactory.types#hostport
		 * @param {boolean} [ipv4only] restrict to IPv4 IPs only.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		hostport(ipv4only) {
			const hp = this.value.split(/:/);
			return this.assert(hp.length == 2 && this.apply('host', hp[0], [ipv4only]) && this.apply('port', hp[1]),
				_('valid host:port'));
		},

		/**
		 * Assert a valid IPv4 address:port. E.g.
		 * `192.0.2.10:80`
		 * @function LuCI.validation.ValidatorFactory.types#ip4addrport
		 * @param {boolean} [ipv4only] restrict to IPv4 IPs only.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ip4addrport() {
			const hp = this.value.split(/:/);
			return this.assert(hp.length == 2 && this.apply('ip4addr', hp[0], [true]) && this.apply('port', hp[1]),
				_('valid IPv4 address:port'));
		},

		/**
		 * Assert a valid IPv4/6 address:port. E.g.
		 * `192.0.2.10:80` or `[2001:db8:f00d:cafe::1]:8080`
		 * @function LuCI.validation.ValidatorFactory.types#ipaddrport
		 * @param {boolean} [bracket] mandate bracketed [IPv6] URI form IPs.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ipaddrport(bracket) {
			const m4 = this.value.match(/^([^[\]:]+):(\d+)$/);
			const m6 = this.value.match((bracket == 1) ? /^\[(.+)\]:(\d+)$/ : /^([^[\]]+):(\d+)$/);

			if (m4)
				return this.assert(this.apply('ip4addr', m4[1], [true]) && this.apply('port', m4[2]),
					_('valid address:port'));

			return this.assert(m6 && this.apply('ip6addr', m6[1], [true]) && this.apply('port', m6[2]),
				_('valid address:port'));
		},

		/**
		 * Define a string separator `sep` for use in [tuple]{@link
		 * LuCI.validation.ValidatorFactory.types#tuple}.
		 * @function LuCI.validation.ValidatorFactory.types#sep
		 * @param {string} str define the separator string
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		sep(str) {
			return this.apply('string', str);
		},

		/**
		 * Tuple validator: accepts 1-N tokens separated by a given separator
		 * {@link LuCI.validation.ValidatorFactory.types#sep sep}
		 * (whitespace by default if {@link LuCI.validation.ValidatorFactory.types#sep sep}
		 * is omitted) which will be validated against the 1-N types.
		 *
		 * This differs from {@link LuCI.validation.ValidatorFactory.types#and and}
		 * by first splitting the input and applying each validator function
		 * sequentially on the resulting array of the split string, whereby the
		 * first type applies to the first value element, the second to the
		 * second, and so on, to define a concrete order.
		 *
		 * {@link LuCI.validation.ValidatorFactory.types#sep sep}
		 * can appear at any position in the list.
		 *
		 * @example
		 *
		 * tuple(ipaddr,port) // "192.0.2.1 88"
		 *
		 * tuple(host,port,sep(',')) // "taurus,8000"
		 *
		 * tuple(port,port,port,sep('-')) // "33-45-78"
		 *
		 * @function LuCI.validation.ValidatorFactory.types#tuple
		 * @param {...function} types {@link LuCI.validation.ValidatorFactory.types
		 * types validation functions}
		 * @param {string} [sep()] function to define split separator string.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		tuple() {
			const argsraw = Array.prototype.slice.call(arguments);
			let sep = null;

			// Build list of (validator, validatorArgs) pairs
			const types = [];
			for (let i = 0; i < argsraw.length; i += 2)
				types.push([ argsraw[i], argsraw[i+1] ]);

			// Determine the separator, if provided
			if (types.length) {
				for (let t of types) {
					if (t[0] === this.factory.types['sep']) {
						const e = types.pop();
						if (Array.isArray(e[1]) && e[1].length > 0)
							sep = e[1][0];
					}
				}
			}

			const raw = (this.value || '');
			let tokens = (sep == null) ? raw.split(/\s+/) : raw.split(sep).map(s => s.trim());

			if (tokens.length != types.length) {
				const getName = (t) => {
					if (typeof t === 'function') {
						for (const k in this.factory.types)
							if (this.factory.types[k] === t)
								return k;
						return _('value');
					}
					return _('value');
				};

				const expectedTypes = types.map(t => getName(t[0])).join(sep == null ? ' ' : sep);
				const sepDesc = sep == null ? _('whitespace') : `"${sep}"`;
				const msg_multi = _('%s; %d tokens separated by %s').format(expectedTypes, types.length, sepDesc);
				const msg_single = _('%s').format(expectedTypes, types.length, sepDesc);
				return this.assert(false, (types.length > 1) ? msg_multi : msg_single);
			}

			for (let i = 0; i < tokens.length; i++) {
				if (!this.apply(types[i][0], tokens[i], types[i][1]))
					return this.assert(false, this.error);
			}

			return this.assert(true);
		},

		/**
		 * Assert a valid (hexadecimal) WPA key of `8 <= length <= 63`, or hex if `length == 64`.
		 * @function LuCI.validation.ValidatorFactory.types#wpakey
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		wpakey() {
			const v = this.value;

			if (v.length == 64)
				return this.assert(v.match(/^[a-fA-F0-9]{64}$/), _('valid hexadecimal WPA key'));

			return this.assert((v.length >= 8) && (v.length <= 63), _('key between 8 and 63 characters'));
		},

		/**
		 * Assert a valid (hexadecimal) WEP key.
		 * @function LuCI.validation.ValidatorFactory.types#wepkey
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		wepkey() {
			let v = this.value;

			if (v.substr(0, 2) === 's:')
				v = v.substr(2);

			if ((v.length == 10) || (v.length == 26))
				return this.assert(v.match(/^[a-fA-F0-9]{10,26}$/), _('valid hexadecimal WEP key'));

			return this.assert((v.length === 5) || (v.length === 13), _('key with either 5 or 13 characters'));
		},

		/**
		 * Assert a valid UCI identifier: `[a-zA-Z0-9_]+`.
		 * @function LuCI.validation.ValidatorFactory.types#uciname
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		uciname() {
			return this.assert(this.value.match(/^[a-zA-Z0-9_]+$/), _('valid UCI identifier'));
		},

		/**
		 * Assert a valid fw4 zone name UCI identifier: `[a-zA-Z_][a-zA-Z0-9_]+`
		 * @function LuCI.validation.ValidatorFactory.types#ucifw4zonename
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		ucifw4zonename() {
			return this.assert(this.value.match(/^[a-zA-Z_][a-zA-Z0-9_]+$/), _('valid fw4 zone name UCI identifier'));
		},

		/**
		 * Assert a valid network device name between 1 and 15 characters not
		 * containing ":", "/", "%" or spaces.
		 * @function LuCI.validation.ValidatorFactory.types#netdevname
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		netdevname() {
			const v = this.value;

			if (v == '.' || v == '..')
				return this.assert(false, _('valid network device name, not "." or ".."'));

			return this.assert(v.match(/^[^:/%\s]{1,15}$/), _('valid network device name between 1 and 15 characters not containing ":", "/", "%" or spaces'));
		},

		/**
		 * Assert a decimal value between `min` and `max`.
		 * @example
		 *range(-253, 253) // assert a value between -253 and +253
		 *
		 *'range(%u,%u)'.format(min_vid, feat.vid_option ? 4094 : num_vlans - 1);
		 * // assert values calculated at runtime for VLAN IDs.
		 * @function LuCI.validation.ValidatorFactory.types#range
		 * @param {string} min set start of range.
		 * @param {string} max set end of range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		range(min, max) {
			const val = this.factory.parseDecimal(this.value);
			return this.assert(val >= +min && val <= +max, _('value between %f and %f').format(min, max));
		},

		/**
		 * Assert a decimal value greater or equal to `min`.
		 * @function LuCI.validation.ValidatorFactory.types#min
		 * @param {string} min set start of range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		min(min) {
			return this.assert(this.factory.parseDecimal(this.value) >= +min, _('value greater or equal to %f').format(min));
		},

		/**
		 * Assert a decimal value lesser or equal to `max`.
		 * @function LuCI.validation.ValidatorFactory.types#max
		 * @param {string} max set end of range.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		max(max) {
			return this.assert(this.factory.parseDecimal(this.value) <= +max, _('value smaller or equal to %f').format(max));
		},

		/**
		 * Assert a string of [bytelen]{@link LuCI.validation.bytelen} length `len` characters.
		 * @function LuCI.validation.ValidatorFactory.types#length
		 * @param {string} len set the length.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		length(len) {
			return this.assert(bytelen(this.value) == +len,
				_('value with %d characters').format(len));
		},

		/**
		 * Assert a string value of [bytelen]{@link LuCI.validation.bytelen} length between `min` and `max` characters.
		 * @function LuCI.validation.ValidatorFactory.types#rangelength
		 * @param {string} min set the min length.
		 * @param {string} max set the max length.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		rangelength(min, max) {
			const len = bytelen(this.value);
			return this.assert((len >= +min) && (len <= +max),
				_('value between %d and %d characters').format(min, max));
		},

		/**
		 * Assert a value of [bytelen]{@link LuCI.validation.bytelen} with at least `min` characters.
		 * @function LuCI.validation.ValidatorFactory.types#minlength
		 * @param {string} min set the min length.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		minlength(min) {
			return this.assert(bytelen(this.value) >= +min,
				_('value with at least %d characters').format(min));
		},

		/**
		 * Assert a value of [bytelen]{@link LuCI.validation.bytelen} with at
		 * most `max` characters.
		 * @function LuCI.validation.ValidatorFactory.types#maxlength
		 * @param {string} max set the max length.
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		maxlength(max) {
			return this.assert(bytelen(this.value) <= +max,
				_('value with at most %d characters').format(max));
		},

		/**
		 * Logical OR `||` to build a more complex expression. Allows multiple
		 * types within a single field.
		 *
		 * See also {@link LuCI.validation.ValidatorFactory.types#and and}
		 * @function LuCI.validation.ValidatorFactory.types#or
		 * @param {string} ...args other [types validation functions]{@link
		 * LuCI.validation.ValidatorFactory.types}
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 * @example
		 * or([ipmask("true")]{@link
		 * LuCI.validation.ValidatorFactory.types#ipmask},[iprange]{@link
		 * LuCI.validation.ValidatorFactory.types#iprange})
		 */
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

		/**
		 * Logical AND `&&` to build more complex expressions. Enforces all
		 * types on the input string.
		 *
		 *
		 * See also {@link LuCI.validation.ValidatorFactory.types#or or}
		 * @function LuCI.validation.ValidatorFactory.types#and
		 * @param {string} ...args  other [types validation functions]{@link
		 * LuCI.validation.ValidatorFactory.types}
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 * @example
		 *
		 * and([minlength(3)]{@link
		 * LuCI.validation.ValidatorFactory.types#minlength},[maxlength(20)]{@link
		 * LuCI.validation.ValidatorFactory.types#maxlength})
		 */
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

		/**
		 * Assert any type, optionally preceded by `!`.
		 *
		 * Example:`list(neg(macaddr))` mandates a list of MAC values, which may
		 * also be prefixed with a single `!`; the MAC strings are validated
		 * after `!` are removed from all entries.
		 *```
		 * 01:02:03:04:05:06
		 * !01:02:03:04:05:07
		 * 01:02:03:04:05:08
		 *```
		 * @function LuCI.validation.ValidatorFactory.types#neg
		 * @param {string} ...args other [types validation functions]{@link
		 * LuCI.validation.ValidatorFactory.types}
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		neg() {
			this.value = this.value.replace(/^[ \t]*![ \t]*/, '');

			if (arguments[0].apply(this, arguments[1]))
				return this.assert(true);

			return this.assert(false, _('Potential negation of: %s').format(this.error));
		},

		/**
		 * Assert a list of a type. 
		 *
		 * @function LuCI.validation.ValidatorFactory.types#list
		 * @param {string} subvalidator other [types validation functions]{@link
		 * LuCI.validation.ValidatorFactory.types}
		 * @param {string} subargs arguments to pass to the `subvalidator`
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 * @example
		 * list(string)
		 */
		list(subvalidator, subargs) {
			this.field.setAttribute('data-is-list', 'true');

			const tokens = this.value.match(/[^ \t]+/g);
			for (let i = 0; i < tokens.length; i++)
				if (!this.apply(subvalidator, tokens[i], subargs))
					return this.assert(false, this.error);

			return this.assert(true);
		},

		/**
		 * Assert a valid phone number dial string: `[0-9*#!.]+`.
		 * @function LuCI.validation.ValidatorFactory.types#phonedigit
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		phonedigit() {
			return this.assert(this.value.match(/^[0-9*#!.]+$/),
				_('valid phone digit (0-9, "*", "#", "!" or ".")'));
		},

		/**
		 * Assert a string of the form `HH:MM:SS`.
		 * @function LuCI.validation.ValidatorFactory.types#timehhmmss
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		timehhmmss() {
			return this.assert(this.value.match(/^(?:[01]\d|2[0-3]):[0-5]\d:(?:[0-5]\d|60)$/),
				_('valid time (HH:MM:SS)'));
		},

		/**
		 * Assert a string of the form `YYYY-MM-DD`.
		 * @function LuCI.validation.ValidatorFactory.types#dateyyyymmdd
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
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

		/**
		 * Assert unique values among lists.
		 * @function LuCI.validation.ValidatorFactory.types#unique
		 * @param {string} subvalidator other [types validation functions]{@link
		 * LuCI.validation.ValidatorFactory.types}
		 * @param {string} subargs arguments to subvalidators
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
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

		/**
		 * Assert a hexadecimal string.
		 * @example
		 * FFFE // valid
		 * FFF  // invalid
		 * @function LuCI.validation.ValidatorFactory.types#hexstring
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		hexstring() {
			return this.assert(this.value.match(/^([a-fA-F0-9]{2})+$/i),
				_('hexadecimal encoded value'));
		},

		/**
		 * Assert a string type, optionally matching `param`.
		 * @function LuCI.validation.ValidatorFactory.types#string
		 * @param {string} [param] define an optional exact string
		 * @returns {@link LuCI.validation.Validator#assert assert()} {boolean}
		 */
		string(param) {
			if (param === null || param === undefined)
				return true;
			return this.assert(this.value === param, _('string: "%s"').format(param));
		},

		/**
		 * Assert a directory string. This is a hold-over from Lua to maintain
		 * compatibility and is a stub function.
		 * @function LuCI.validation.ValidatorFactory.types#directory
		 * @returns {boolean} Always returns true.
		 */
		directory() {
			return true;
		},

		/**
		 * Assert a file string. This is a hold-over from Lua to maintain
		 * compatibility and is a stub function.
		 * @function LuCI.validation.ValidatorFactory.types#file
		 * @returns {boolean} Always returns true.
		 */
		file() {
			return true;
		},

		/**
		 * Assert a device string. This is a hold-over from Lua to maintain
		 * compatibility and is a stub function.
		 * @function LuCI.validation.ValidatorFactory.types#device
		 * @returns {boolean} Always returns true.
		 */
		device() {
			return true;
		}
	}
});

return ValidatorFactory;
