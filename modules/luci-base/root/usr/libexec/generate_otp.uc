#!/usr/bin/ucode

// MIT License

// Copyright (c) 2024 Christian Marangi <ansuelsmth@gmail.com>

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { cursor } from 'uci';

function sToc(s) {
	return ord(s);
}

function cTos(c) {
	return chr(c);
}

const base32_encode_table = map([
	"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
	"M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X",
	"Y", "Z", "2", "3", "4", "5", "6", "7"
], sToc);

function strToBin(string)
{
	let res = [];

	for (i = 0; i < length(string); i++)
		res[i] = ord(string, i);

	return res;
}

function intToBin(int)
{
	let res = [];
	
	res[0] = (int >> 24) & 0xff;
	res[1] = (int >> 16) & 0xff;
	res[2] = (int >> 8) & 0xff;
	res[3] = int & 0xff;

	return res;
}

function binToStr(bin)
{
	return join("", map(bin, cTos));
}

function circular_shift(val, shift)
{
	return ((val << shift) | (val >> (32 - shift))) & 0xFFFFFFFF
}

function encode_base32(string)
{
	const binary_string = strToBin(string);

	let pos = 0;
	let pos_in_byte = 7;

	let consumed = 0;
	const to_consume = length(string) * 8;

	let out = [];
	let out_pos = 0;
	let out_pos_in_byte = 4;

	while (true) {
		let bit = (binary_string[pos] >> pos_in_byte) & 0x1;
		out[out_pos] |= bit << out_pos_in_byte;
		consumed++;

		if (consumed == to_consume)
			break;

		pos_in_byte--;
		if (pos_in_byte == -1) {
			pos_in_byte = 7;
			pos++;
		}

		out_pos_in_byte--;
		if (out_pos_in_byte == -1) {
			out_pos_in_byte = 4;
			out_pos++;
		}
	}

	for (i = 0; i <= out_pos; i++)
		out[i] = base32_encode_table[out[i]];

	for (i = 0; i < (8 - (out_pos + 1) % 8); i++)
		out[(out_pos + 1) + i] = ord("=");

	return binToStr(out);
}

function calculate_sha1(binary_string) {
	let len = length(binary_string);

	// Init primitives
	let h0 = 0x67452301;
	let h1 = 0xEFCDAB89;
	let h2 = 0x98BADCFE;
	let h3 = 0x10325476;
	let h4 = 0xC3D2E1F0;

	let padded_string = [];

	for (i=0; i < len; i++)
		padded_string[i] = binary_string[i];

	// Add 0x80 = 1 0000000
	padded_string[len++] = 0x80;

	// Pad of required zeros
	to_pad = 64 - ((len + 8) % 64);
	for (i = 0; i < to_pad; i++)
		padded_string[len++] = 0x0;

	// Add length 8 bytes (big endian)
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = length(binary_string) * 8;


	for (i = 0; i < len; i+=64) {
		let block = [];

		// Convert section to 16 32 bytes block
		for (i2 = 0, j = 0; i2 < 16; i2++, j+=4) {
			block[i2] = padded_string[i + j] << 24;
			block[i2] |= padded_string[i + j + 1] << 16;
			block[i2] |= padded_string[i + j + 2] << 8;
			block[i2] |= padded_string[i + j + 3];
		}

		// Expand to 80 bytes block
		for (j = 16; j < 80; j++)
			block[j] = circular_shift(block[j - 3] ^ block[j - 8] ^ block[j - 14] ^ block[j - 16], 1);

		// Init primitives for block
		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;

		for (j = 0; j < 80; j++) {
			let f = 0;
			let k = 0;

			// Setup reange constants
			if (j < 20) {
				f = (b & c) | ((~b) & d);
				k = 0x5A827999;
			} else if (j < 40) {
				f = b ^ c ^ d;
				k = 0x6ED9EBA1;
			} else if (j < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8F1BBCDC;
			} else {
				f = b ^ c ^ d;
				k = 0xCA62C1D6;
			}

			let temp = circular_shift(a, 5) + f + e + k + block[j] & 0xFFFFFFFF;
                        e = d;
                        d = c;
                        c = circular_shift(b, 30);
                        b = a;
                        a = temp;
		}

		// Update hash values
		h0 = (h0 + a) & 0xFFFFFFFF;
                h1 = (h1 + b) & 0xFFFFFFFF;
                h2 = (h2 + c) & 0xFFFFFFFF;
                h3 = (h3 + d) & 0xFFFFFFFF;
                h4 = (h4 + e) & 0xFFFFFFFF;
	}

	let sha1 = [];

	h0_binary = intToBin(h0);
	for (i = 0; i < length(h0_binary); i++)
		sha1[i] = h0_binary[i];

	h1_binary = intToBin(h1);
	for (i = 0; i < length(h1_binary); i++)
		sha1[i+4] = h1_binary[i];

	h2_binary = intToBin(h2);
	for (i = 0; i < length(h2_binary); i++)
		sha1[i+8] = h2_binary[i];

	h3_binary = intToBin(h3);
	for (i = 0; i < length(h3_binary); i++)
		sha1[i+12] = h3_binary[i];

	h4_binary = intToBin(h4);
	for (i = 0; i < length(h4_binary); i++)
		sha1[i+16] = h4_binary[i];

	return sha1;
}

function calculate_hmac_sha1(key, message) {
	const message_binary = strToBin(message);
	let binary_key = strToBin(key);

	if (length(key) > 64)
		binary_key = calculate_sha1(binary_key);

	for (i = 0; i < 64 - length(key); i++)
		binary_key[length(key)+i] = 0x0;

	let ko = [];
	for (i = 0; i < 64; i++)
		ko[i] = binary_key[i] ^ 0x36;

	for (i = 0; i < length(message); i++)
		ko[64+i] = message_binary[i];

	const sha1_ko = calculate_sha1(ko);

	ko = [];

	for (i = 0; i < 64; i++)
		ko[i] = binary_key[i] ^ 0x5c;

	for (i = 0; i < length(sha1_ko); i++)
		ko[64+i] = sha1_ko[i];

	const hmac = calculate_sha1(ko);

	return hmac;
}

function calculate_hotp(key, counter)
{
	const secret = encode_base32(key);
	const counter_bytes = [ 0x0, 0x0, 0x0, 0x0,
				(counter >> 24) & 0xff,
				(counter >> 16) & 0xff,
				(counter >> 8) & 0xff,
				counter & 0xff ];

	const digest = calculate_hmac_sha1(secret, binToStr(counter_bytes));

	const offset_bits = digest[19] & 0xf;

	let p = [];
	for (i = 0; i < 4; i++)
		p[i] = digest[offset_bits+i];

	const snum = (p[0] << 24 | p[1] << 16 | p[2] << 8 | p[3]) & 0x7fffffff;
	const otp = snum % 10 ** 6;

	return otp;
}

function get_otp(username)
{
	const ctx = cursor();

	let key = ctx.get('luci', username, 'key');
	if (!key) {
		printf("Missing key for user %s\n", username);
		exit(1);
	}

	let otp_type = ctx.get('luci', username, 'type');
	let counter = "";

	// Time-based OTP (require synced time with world)
	// 
	// Step is used to device epoch in n step and calculate
	// the counter
	if (otp_type == "totp") {
		let step = ctx.get('luci', username, 'step');
		if (!step) {
			printf("Missing step for user %s\n", username);
			exit(1);
		}

		counter = time()/step;
	// Counter-based OTP
	// 
	// OTP is calculated from the counter value. Each different
	// counter will generate a different password.
	} else if (otp_type == "hotp") {
		counter = ctx.get('luci', username, 'counter');
		if (!counter) {
			printf("Missing counter for user %s\n", username);
			exit(1);
		}
	} else {
		printf("Error Invalid OTP type\n");
		exit(1);
	}

	const otp = calculate_hotp(key, counter);

	// With HOTP increment saved counter since we just
	// generated a new OTP.
	if (otp_type == "hotp") {
		ctx.set('luci', username, 'counter', int(counter) + 1);
		ctx.commit('luci');
	}

	return otp;
}

printf("%s", get_otp("root"));
