'use strict';

var s = [0x0000, 0x0000, 0x0000, 0x0000];

/**
 * Multiply two 64-bit values represented as arrays of four 16-bit words.
 *
 * Arrays use little-endian word order (least-significant 16-bit word first).
 * The result is truncated to the lower 64 bits and returned as a 4-element
 * array of 16-bit words.
 *
 * @param {Array<number>} a - Multiplicand (4 × 16-bit words, little-endian)
 * @param {Array<number>} b - Multiplier  (4 × 16-bit words, little-endian)
 * @returns {Array<number>} Product as 4 × 16-bit words (little-endian)
 */
function mul(a, b) {
	var r = [0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000];

	for (var j = 0; j < 4; j++) {
		var k = 0;
		for (var i = 0; i < 4; i++) {
			var t = a[i] * b[j] + r[i+j] + k;
			r[i+j] = t & 0xffff;
			k = t >>> 16;
		}
		r[j+4] = k;
	}

	r.length = 4;

	return r;
}

/**
 * Add a small integer to a 64-bit value represented as four 16-bit words.
 *
 * Treats `a` as a little-endian 64-bit value (4 × 16-bit words). Adds the
 * integer `n` to the least-significant word and propagates carry across
 * subsequent 16-bit words. The result is truncated to 64 bits and returned
 * as a 4-element array of 16-bit words (little-endian).
 *
 * @param {Array<number>} a - Addend as 4 × 16-bit words (little-endian)
 * @param {number} n - Value to add (integer carry)
 * @returns {Array<number>} Sum as 4 × 16-bit words (little-endian)
 */
function add(a, n) {
	var r = [0x0000, 0x0000, 0x0000, 0x0000],
	    k = n;

	for (var i = 0; i < 4; i++) {
		var t = a[i] + k;
		r[i] = t & 0xffff;
		k = t >>> 16;
	}

	return r;
}

/**
 * Shift a 64-bit value (4 × 16-bit words, little-endian) right by `n` bits.
 *
 * The input array is treated as little-endian 16-bit words. Bits shifted out
 * on the right are discarded; the returned array contains the lower 64-bit
 * result after the logical right shift.
 *
 * @param {Array<number>} a - Source value as 4 × 16-bit words (little-endian)
 * @param {number} n - Number of bits to shift right (non-negative integer)
 * @returns {Array<number>} Shifted value as 4 × 16-bit words (little-endian)
 */
function shr(a, n) {
	var r = [a[0], a[1], a[2], a[3], 0x0000],
	    i = 4,
	    k = 0;

	for (; n > 16; n -= 16, i--)
		for (var j = 0; j < 4; j++)
			r[j] = r[j+1];

	for (; i > 0; i--) {
		var s = r[i-1];
		r[i-1] = (s >>> n) | k;
		k = ((s & ((1 << n) - 1)) << (16 - n));
	}

	r.length = 4;

	return r;
}

return L.Class.extend({
	/**
	 * Seed the PRNG state.
	 *
	 * The seed is treated as a 32-bit integer; the lower 16 bits are stored
	 * in `s[0]`, the upper 16 bits in `s[1]`. `s[2]` and `s[3]` are zeroed.
	 *
	 * @param {number} n - Seed value (32-bit integer)
	 * @returns {void}
	 */
	seed: function(n) {
		n = (n - 1)|0;
		s[0] = n & 0xffff;
		s[1] = n >>> 16;
		s[2] = 0;
		s[3] = 0;
	},

	/**
	 * Produce the next PRNG 32-bit integer.
	 *
	 * Advances the internal state and returns a 32-bit pseudo-random integer
	 * derived from the current state.
	 *
	 * @returns {number} 32-bit pseudo-random integer (JS number)
	 */
	int: function() {
		s = mul(s, [0x7f2d, 0x4c95, 0xf42d, 0x5851]);
		s = add(s, 1);

		var r = shr(s, 33);
		return (r[1] << 16) | r[0];
	},

	/**
	 * Return a pseudo-random value.
	 *
	 * Overloads:
	 * - get() -> number in [0, 1]
	 * - get(upper) -> integer in [1, upper]
	 * - get(lower, upper) -> integer in [lower, upper]
	 *
	 * @param {number} [lower=0] - Lower bound (when two args supplied)
	 * @param {number} [upper=0] - Upper bound (when one or two args supplied)
	 * @returns {number} Random value (float in [0,1] or integer in requested range)
	 */
	get: function() {
		var r = (this.int() % 0x7fffffff) / 0x7fffffff, l, u;

		switch (arguments.length) {
		case 0:
			return r;

		case 1:
			l = 1;
			u = arguments[0]|0;
			break;

		case 2:
			l = arguments[0]|0;
			u = arguments[1]|0;
			break;
		}

		return Math.floor(r * (u - l + 1)) + l;
	},

	/**
	 * Derive a deterministic hex color from an input string.
	 *
	 * The color is produced by seeding the PRNG from a string-derived
	 * hash and producing RGB components. Returns a `#rrggbb` hex string.
	 *
	 * @param {string} string - Input string used to derive the color
	 * @returns {string} Hex color string in `#rrggbb` format
	 */
	derive_color: function(string) {
		this.seed(parseInt(sfh(string), 16));

		var r = this.get(128),
		    g = this.get(128),
		    min = 0,
		    max = 128;

		if ((r + g) < 128)
			min = 128 - r - g;
		else
			max = 255 - r - g;

		var b = min + Math.floor(this.get() * (max - min));

		return '#%02x%02x%02x'.format(0xff - r, 0xff - g, 0xff - b);
	}
});
