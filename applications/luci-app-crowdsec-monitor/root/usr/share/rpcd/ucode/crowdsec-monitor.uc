 'use strict';

/* Read-only CrowdSec nftables monitor. History is stored in volatile /tmp. */
let fs = require('fs');
let HISTORY_FILE = '/tmp/crowdsec-monitor-history.json';
let HISTORY_LIMIT = 240;
let SAMPLE_INTERVAL = 10;

function read_nft_table() {
	let p = fs.popen('/usr/sbin/nft -j list table ip crowdsec', 'r');
	if (!p) return null;
	let output = p.read('all');
	p.close();
	if (!output || output == '') return null;
	try { return json(output); }
	catch (e) { return null; }
}

function read_bouncer_state() {
	let p = fs.popen('/bin/busybox pidof cs-firewall-bouncer', 'r');
	if (!p) return false;
	let output = p.read('all');
	p.close();
	return output != null && trim(output) != '';
}

function get_elements(set) {
	let result = [];
	if (!set || type(set.elem) != 'array') return result;
	for (let item in set.elem) {
		let entry = item.elem;
		if (!entry || !entry.val) continue;
		push(result, {
			ip: '' + entry.val,
			expires_ms: (type(entry.expires) == 'int' || type(entry.expires) == 'double') ? entry.expires : 0,
			timeout_ms: (type(entry.timeout) == 'int' || type(entry.timeout) == 'double') ? entry.timeout : 0
		});
	}
	return result;
}

function collect_data() {
	let raw = read_nft_table();
	let result = {
		available: false, bouncer_running: read_bouncer_state(), sets: [],
		counters: {}, chains: { input: false, forward: false }, generated_at: time()
	};
	if (!raw || type(raw.nftables) != 'array') return result;
	result.available = true;
	for (let item in raw.nftables) {
		if (item.counter && item.counter.name)
			result.counters[item.counter.name] = { packets: item.counter.packets || 0, bytes: item.counter.bytes || 0 };
		if (item.chain && item.chain.name == 'crowdsec-chain-input') result.chains.input = true;
		if (item.chain && item.chain.name == 'crowdsec-chain-forward') result.chains.forward = true;
		if (item.set && item.set.name && item.set.name != 'crowdsec-blacklists') {
			let name = item.set.name;
			if (index(name, 'crowdsec-blacklists-') != 0) continue;
			let elements = get_elements(item.set);
			push(result.sets, { name: name, origin: substr(name, length('crowdsec-blacklists-')), count: length(elements), elements: elements });
		}
	}
	return result;
}

function number_or_zero(v) { return (type(v) == 'int' || type(v) == 'double') ? v : 0; }

function update_history(data) {
	let now = time();
	let history = { samples: [] };
	let saved = fs.readfile(HISTORY_FILE);
	if (saved && saved != '') {
		try {
			let parsed = json(saved);
			if (parsed && type(parsed.samples) == 'array') history = parsed;
		}
		catch (e) { history = { samples: [] }; }
	}
	let samples = history.samples;
	let last = length(samples) ? samples[length(samples) - 1] : null;
	if (!last || now - number_or_zero(last.ts) >= SAMPLE_INTERVAL) {
		let processed = data.counters.processed ? number_or_zero(data.counters.processed.packets) : 0;
		let blocked = 0;
		for (let set in data.sets) {
			let counter = data.counters[set.name];
			if (counter) blocked += number_or_zero(counter.packets);
		}
		let delta_processed = last && processed >= number_or_zero(last.processed) ? processed - number_or_zero(last.processed) : 0;
		let delta_blocked = last && blocked >= number_or_zero(last.blocked) ? blocked - number_or_zero(last.blocked) : 0;
		let elapsed = last ? now - number_or_zero(last.ts) : SAMPLE_INTERVAL;
		let total_ips = 0;
		for (let set in data.sets) total_ips += number_or_zero(set.count);
		push(samples, {
			ts: now, processed: processed, blocked: blocked,
			ips: total_ips,
			processed_rate: elapsed > 0 ? delta_processed / elapsed : 0,
			blocked_rate: elapsed > 0 ? delta_blocked / elapsed : 0
		});
		while (length(samples) > HISTORY_LIMIT) shift(samples);
		history.samples = samples;
		/* Ucode json() parses JSON; sprintf("%J", ...) serializes objects. */
		let file = fs.open(HISTORY_FILE, 'w');
		if (file) {
			try { file.write(sprintf("%J", history)); }
			catch (e) { /* Keep the live monitor available if history cannot be saved. */ }
			try { file.close(); }
			catch (e) { /* Ignore close errors; summary data remains available. */ }
		}
	}
	return history;
}

function summary() {
	let data = collect_data();
	let sets = [];
	for (let set in data.sets) {
		let counter = data.counters[set.name] || { packets: 0, bytes: 0 };
		push(sets, { name: set.name, origin: set.origin, count: set.count, packets: counter.packets, bytes: counter.bytes });
	}
	let history = data.available ? update_history(data) : { samples: [] };
	return {
		available: data.available, bouncer_running: data.bouncer_running,
		sets: sets, counters: data.counters, chains: data.chains,
		generated_at: data.generated_at, history: history.samples,
		lapi_sync: 'not_exposed_by_local_bouncer'
	};
}

return {
	crowdsec_monitor: {
		summary: { call: function() { return summary(); } },
		list: {
			args: { origin: '', page: 1, page_size: 50, search: '' },
			call: function(request) {
				let args = request.args || {};
				let origin = args.origin || '';
				let search = args.search || '';
				let page = int(args.page || 1), page_size = int(args.page_size || 50);
				if (page < 1) page = 1;
				if (page_size < 1) page_size = 50;
				if (page_size > 100) page_size = 100;
				let invalid_search = length(search) > 39;
				for (let i = 0; i < length(search); i++)
					if (index('0123456789.', substr(search, i, 1)) == -1) invalid_search = true;
				if (invalid_search) search = '';
				let data = collect_data(), found = [];
				for (let set in data.sets) {
					if (origin != '' && set.origin != origin) continue;
					for (let entry in set.elements) {
						if (search != '' && index(entry.ip, search) == -1) continue;
						push(found, { ip: entry.ip, origin: set.origin, expires_ms: entry.expires_ms, timeout_ms: entry.timeout_ms });
					}
				}
				let total = length(found), start = (page - 1) * page_size, rows = [];
				for (let i = start; i < total && i < start + page_size; i++) push(rows, found[i]);
				return { available: data.available, page: page, page_size: page_size, total: total, pages: total ? int((total + page_size - 1) / page_size) : 0, rows: rows };
			}
		}
	}
};
