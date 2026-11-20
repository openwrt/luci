#!/usr/bin/ucode

// Copyright (c) 2024 Christian Marangi <ansuelsmth@gmail.com>
// Copyright (c) 2026 tokiskai galaxy <moebest@outlook.jp>
import { cursor } from 'uci';
import { sha1 } from 'digest';
import { pack } from 'struct';

const base32_decode_table = (function() {
	let t = {};
	for (let i = 0; i < 26; i++) { t[ord('A') + i] = i; t[ord('a') + i] = i; }
	for (let i = 0; i < 6; i++) { t[ord('2') + i] = 26 + i; }
	return t;
})();

function decode_base32_to_bin(string) {
	let clean = replace(string, /[\s=]/g, "");
	if (length(clean) == 0) return null;

	let bin = "";
	let buffer = 0;
	let bits = 0;

	for (let i = 0; i < length(clean); i++) {
		let val = base32_decode_table[ord(clean, i)];
		if (val === null || val === undefined) continue;

		buffer = (buffer << 5) | val;
		bits += 5;

		if (bits >= 8) {
			bits -= 8;
			bin += chr((buffer >> bits) & 0xff);
		}
	}
	return bin;
}

function calculate_hmac_sha1(key, message) {
	const blocksize = 64;
	if (length(key) > blocksize) key = hexdec(sha1(key));
	while (length(key) < blocksize) key += chr(0);

	let o_key_pad = "", i_key_pad = "";
	for (let i = 0; i < blocksize; i++) {
		let k = ord(key, i);
		o_key_pad += chr(k ^ 0x5c);
		i_key_pad += chr(k ^ 0x36);
	}
	let inner_hash = hexdec(sha1(i_key_pad + message));
	return sha1(o_key_pad + inner_hash);
}

function calculate_otp(secret_base32, counter_int) {
	let secret_bin = decode_base32_to_bin(secret_base32);
	if (!secret_bin) return null;

	let counter_bin = pack(">Q", counter_int);

	let hmac_hex = calculate_hmac_sha1(secret_bin, counter_bin);

	let offset = int(substr(hmac_hex, 38, 2), 16) & 0xf;
	let binary_code = int(substr(hmac_hex, offset * 2, 8), 16) & 0x7fffffff;

	return sprintf("%06d", binary_code % 1000000);
}

let username = ARGV[0];
let no_increment = false;
let custom_time = null;
let plugin_uuid = null;

for (let i = 1; i < length(ARGV); i++) {
	let arg = ARGV[i];
	if (arg == '--no-increment') {
		no_increment = true;
	} else if (substr(arg, 0, 7) == '--time=') {
		let time_str = substr(arg, 7);
		if (match(time_str, /^[0-9]+$/)) {
			custom_time = int(time_str);
			if (custom_time < 946684800 || custom_time > 4102444800) custom_time = null;
		}
	} else if (substr(arg, 0, 9) == '--plugin=') {
		let uuid_str = substr(arg, 9);
		if (match(uuid_str, /^[0-9a-fA-F]{32}$/)) plugin_uuid = uuid_str;
	}
}

if (!username || username == '') exit(1);

let ctx = cursor();
let otp_type, secret, counter, step;

if (plugin_uuid) {
	otp_type = ctx.get('luci_plugins', plugin_uuid, 'type_' + username) || 'totp';
	secret = ctx.get('luci_plugins', plugin_uuid, 'key_' + username);
	counter = int(ctx.get('luci_plugins', plugin_uuid, 'counter_' + username) || '0');
	step = int(ctx.get('luci_plugins', plugin_uuid, 'step_' + username) || '30');
} else {
	otp_type = ctx.get('2fa', username, 'type') || 'totp';
	secret = ctx.get('2fa', username, 'key');
	counter = int(ctx.get('2fa', username, 'counter') || '0');
	step = int(ctx.get('2fa', username, 'step') || '30');
}

if (!secret) exit(1);

let otp;
if (otp_type == 'hotp') {
	otp = calculate_otp(secret, counter);
	if (!no_increment && otp) {
		if (plugin_uuid) {
			ctx.set('luci_plugins', plugin_uuid, 'counter_' + username, '' + (counter + 1));
			ctx.commit('luci_plugins');
		} else {
			ctx.set('2fa', username, 'counter', '' + (counter + 1));
			ctx.commit('2fa');
		}
	}
} else {
	let timestamp = (custom_time != null) ? custom_time : time();
	otp = calculate_otp(secret, int(timestamp / step));
}

if (otp) print(otp); else exit(1);
