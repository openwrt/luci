#!/usr/bin/ucode

// Copyright (c) 2024 Christian Marangi <ansuelsmth@gmail.com>
// Copyright (c) 2026 tokiskai galaxy <moebest@outlook.jp>
import { cursor } from 'uci';

function cTos(c) {
	return chr(c);
}

function create_base32_decode_table() {
	let table = {};
	
	// A-Z -> 0-25
	for (let i = 0; i < 26; i++) {
		table[ord('A') + i] = i;
		table[ord('a') + i] = i;
	}
	
	// 2-7 -> 26-31
	for (let i = 0; i < 6; i++) {
		table[ord('2') + i] = 26 + i;
	}
	
	return table;
}

const base32_decode_table = create_base32_decode_table();

function strToBin(string)
{
	let res = [];
	for (let i = 0; i < length(string); i++)
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
	return ((val << shift) | (val >> (32 - shift))) & 0xFFFFFFFF;
}

function decode_base32(string)
{
	if (length(string) == 0)
		return [];
	
	// Remove padding and whitespace
	let clean = "";
	for (let i = 0; i < length(string); i++) {
		let c = substr(string, i, 1);
		if (c != "=" && c != " " && c != "\t" && c != "\n" && c != "\r") {
			clean = clean + c;
		}
	}
	
	if (length(clean) == 0)
		return [];
	
	let out = [];
	let buffer = 0;
	let bits_in_buffer = 0;
	
	for (let i = 0; i < length(clean); i++) {
		let char_code = ord(clean, i);
		
		let value = base32_decode_table[char_code];
		if (value === null || value === undefined) {
			continue;
		}
		
		buffer = (buffer << 5) | value;
		bits_in_buffer += 5;
		
		if (bits_in_buffer >= 8) {
			bits_in_buffer -= 8;
			push(out, (buffer >> bits_in_buffer) & 0xff);
		}
	}
	
	return out;
}

function calculate_sha1(binary_string) {
	let len = length(binary_string);

	let h0 = 0x67452301;
	let h1 = 0xEFCDAB89;
	let h2 = 0x98BADCFE;
	let h3 = 0x10325476;
	let h4 = 0xC3D2E1F0;

	let padded_string = [];

	for (let i = 0; i < len; i++)
		padded_string[i] = binary_string[i];

	padded_string[len++] = 0x80;

	let to_pad = 64 - ((len + 8) % 64);
	for (let i = 0; i < to_pad; i++)
		padded_string[len++] = 0x0;

	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = 0x0;
	padded_string[len++] = length(binary_string) * 8;

	for (let i = 0; i < len; i += 64) {
		let block = [];

		for (let i2 = 0, j = 0; i2 < 16; i2++, j += 4) {
			block[i2] = padded_string[i + j] << 24;
			block[i2] |= padded_string[i + j + 1] << 16;
			block[i2] |= padded_string[i + j + 2] << 8;
			block[i2] |= padded_string[i + j + 3];
		}

		for (let j = 16; j < 80; j++)
			block[j] = circular_shift(block[j - 3] ^ block[j - 8] ^ block[j - 14] ^ block[j - 16], 1);

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;

		for (let j = 0; j < 80; j++) {
			let f = 0;
			let k = 0;

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

		h0 = (h0 + a) & 0xFFFFFFFF;
		h1 = (h1 + b) & 0xFFFFFFFF;
		h2 = (h2 + c) & 0xFFFFFFFF;
		h3 = (h3 + d) & 0xFFFFFFFF;
		h4 = (h4 + e) & 0xFFFFFFFF;
	}

	let sha1 = [];

	let h0_binary = intToBin(h0);
	for (let i = 0; i < length(h0_binary); i++)
		sha1[i] = h0_binary[i];

	let h1_binary = intToBin(h1);
	for (let i = 0; i < length(h1_binary); i++)
		sha1[i+4] = h1_binary[i];

	let h2_binary = intToBin(h2);
	for (let i = 0; i < length(h2_binary); i++)
		sha1[i+8] = h2_binary[i];

	let h3_binary = intToBin(h3);
	for (let i = 0; i < length(h3_binary); i++)
		sha1[i+12] = h3_binary[i];

	let h4_binary = intToBin(h4);
	for (let i = 0; i < length(h4_binary); i++)
		sha1[i+16] = h4_binary[i];

	return sha1;
}

function calculate_hmac_sha1(key, message) {
	const message_binary = strToBin(message);
	let binary_key = strToBin(key);

	if (length(key) > 64)
		binary_key = calculate_sha1(binary_key);

	for (let i = 0; i < 64 - length(key); i++)
		binary_key[length(key)+i] = 0x0;

	let ko = [];
	for (let i = 0; i < 64; i++)
		ko[i] = binary_key[i] ^ 0x36;

	for (let i = 0; i < length(message); i++)
		ko[64+i] = message_binary[i];

	const sha1_ko = calculate_sha1(ko);

	ko = [];

	for (let i = 0; i < 64; i++)
		ko[i] = binary_key[i] ^ 0x5c;

	for (let i = 0; i < length(sha1_ko); i++)
		ko[64+i] = sha1_ko[i];

	const hmac = calculate_sha1(ko);

	return hmac;
}

function generate_totp(secret, timestamp, step) {
	// Decode the Base32 secret key
	let secret_binary = decode_base32(secret);
	
	if (length(secret_binary) == 0)
		return null;
	
	// Calculate counter from timestamp
	let counter = int(timestamp / step);
	
	// Convert counter to 8-byte array (big-endian)
	let counter_bytes = [
		0x0, 0x0, 0x0, 0x0,
		(counter >> 24) & 0xff,
		(counter >> 16) & 0xff,
		(counter >> 8) & 0xff,
		counter & 0xff
	];
	
	// Calculate HMAC-SHA1
	let digest = calculate_hmac_sha1(binToStr(secret_binary), binToStr(counter_bytes));
	
	// Dynamic truncation
	let offset = digest[19] & 0xf;
	let binary_code = (digest[offset] << 24) | 
	                  (digest[offset + 1] << 16) |
	                  (digest[offset + 2] << 8) |
	                  digest[offset + 3];
	
	// Remove sign bit
	binary_code = binary_code & 0x7fffffff;
	
	// Generate 6-digit OTP
	let otp = binary_code % 1000000;
	
	return sprintf("%06d", otp);
}

function generate_hotp(secret, counter) {
	// Decode the Base32 secret key
	let secret_binary = decode_base32(secret);
	
	if (length(secret_binary) == 0)
		return null;
	
	// Convert counter to 8-byte array (big-endian)
	let counter_bytes = [
		(counter >> 56) & 0xff,
		(counter >> 48) & 0xff,
		(counter >> 40) & 0xff,
		(counter >> 32) & 0xff,
		(counter >> 24) & 0xff,
		(counter >> 16) & 0xff,
		(counter >> 8) & 0xff,
		counter & 0xff
	];
	
	// Calculate HMAC-SHA1
	let digest = calculate_hmac_sha1(binToStr(secret_binary), binToStr(counter_bytes));
	
	// Dynamic truncation
	let offset = digest[19] & 0xf;
	let binary_code = (digest[offset] << 24) | 
	                  (digest[offset + 1] << 16) |
	                  (digest[offset + 2] << 8) |
	                  digest[offset + 3];
	
	// Remove sign bit
	binary_code = binary_code & 0x7fffffff;
	
	// Generate 6-digit OTP
	let otp = binary_code % 1000000;
	
	return sprintf("%06d", otp);
}

// Main execution
let username = ARGV[0];
// Parse optional flags from remaining arguments
let no_increment = false;
let custom_time = null;

for (let i = 1; i < length(ARGV); i++) {
	let arg = ARGV[i];
	if (arg == '--no-increment') {
		no_increment = true;
	} else if (substr(arg, 0, 7) == '--time=') {
		let time_str = substr(arg, 7);
		// Validate that time is numeric only (security: prevent injection)
		if (match(time_str, /^[0-9]+$/)) {
			custom_time = int(time_str);
			// Validate reasonable time range (after year 2000, before year 2100)
			if (custom_time < 946684800 || custom_time > 4102444800) {
				custom_time = null;  // Invalid time, use default
			}
		}
	}
}

if (!username || username == '') {
	exit(1);
}

let ctx = cursor();

// Get user configuration
let otp_type = ctx.get('2fa', username, 'type') || 'totp';
let secret = ctx.get('2fa', username, 'key');

if (!secret || secret == '') {
	exit(1);
}

let otp;

if (otp_type == 'hotp') {
	// HOTP mode
	let counter = int(ctx.get('2fa', username, 'counter') || '0');
	otp = generate_hotp(secret, counter);
	
	// Only increment counter if not in verification mode
	if (!no_increment) {
		ctx.set('2fa', username, 'counter', '' + (counter + 1));
		ctx.commit('2fa');
	}
} else {
	// TOTP mode (default)
	let step = int(ctx.get('2fa', username, 'step') || '30');
	// Use custom time if provided (for verification with time window tolerance)
	let timestamp = (custom_time != null) ? custom_time : time();
	otp = generate_totp(secret, timestamp, step);
}

if (otp)
	print(otp);
else
	exit(1);
