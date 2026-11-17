'use strict';

/* Read-only CrowdSec nftables monitor. History and index caches live in volatile /tmp. */
let fs = require('fs');
let HISTORY_FILE = '/tmp/crowdsec-monitor-history.json';
let INDEX_FILE = '/tmp/crowdsec-monitor-index.json';
let HISTORY_LIMIT = 240;
let SAMPLE_INTERVAL = 10;
/* Set names and sizes are rebuilt at most once per INDEX_TTL seconds. */
let INDEX_TTL = 90;

/* IPv4 and IPv6 bans live in separate nftables tables managed by the bouncer. */
let TABLES = [
	{ family: 'ip', table: 'crowdsec', prefix: 'crowdsec-blacklists-' },
	{ family: 'ip6', table: 'crowdsec6', prefix: 'crowdsec6-blacklists-' }
];

function number_or_zero(v) { return (type(v) == 'int' || type(v) == 'double') ? v : 0; }

function nft_json(args) {
	let p = fs.popen('/usr/sbin/nft -j ' + args, 'r');
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

function element_address(val) {
	if (type(val) == 'object') {
		/* Interval elements: keep only the plain prefix form. */
		if (!val.prefix) return null;
		return '' + val.prefix.addr + '/' + val.prefix.len;
	}
	return '' + val;
}

function get_elements(set) {
	let result = [];
	if (!set || type(set.elem) != 'array') return result;
	for (let item in set.elem) {
		let entry = item.elem;
		if (!entry || !entry.val) continue;
		let ip = element_address(entry.val);
		if (ip == null) continue;
		push(result, {
			ip: ip,
			expires_ms: number_or_zero(entry.expires),
			timeout_ms: number_or_zero(entry.timeout)
		});
	}
	return result;
}

/* Reads the elements of one set only, so a page never loads the whole table. */
function read_set_elements(set) {
	let raw = nft_json('list set ' + set.family + ' ' + set.table + ' ' + set.name);
	if (!raw || type(raw.nftables) != 'array') return [];
	for (let item in raw.nftables)
		if (item.set && item.set.name == set.name) return get_elements(item.set);
	return [];
}

/* Heavy step: parses the full table once, keeps only names and sizes, then frees it. */
function build_index() {
	let idx = { ts: time(), available: false, sets: [] };
	for (let t in TABLES) {
		let raw = nft_json('list table ' + t.family + ' ' + t.table);
		if (!raw || type(raw.nftables) != 'array') continue;
		idx.available = true;
		for (let item in raw.nftables) {
			if (item.set && item.set.name && index(item.set.name, t.prefix) == 0) {
				let name = item.set.name;
				push(idx.sets, {
					name: name,
					origin: substr(name, length(t.prefix)),
					family: t.family,
					table: t.table,
					count: type(item.set.elem) == 'array' ? length(item.set.elem) : 0
				});
			}
		}
		raw = null;
	}
	return idx;
}

function load_index() {
	let now = time();
	let saved = fs.readfile(INDEX_FILE);
	if (saved && saved != '') {
		try {
			let cached = json(saved);
			if (cached && type(cached.sets) == 'array' && now - number_or_zero(cached.ts) < INDEX_TTL)
				return cached;
		}
		catch (e) { /* Corrupt cache: rebuild below. */ }
	}
	let idx = build_index();
	let file = fs.open(INDEX_FILE, 'w');
	if (file) {
		try { file.write(sprintf("%J", idx)); }
		catch (e) { /* Keep serving live data if the cache cannot be written. */ }
		try { file.close(); }
		catch (e) { /* Ignore close errors. */ }
	}
	return idx;
}

/* Small calls: counters and chains are read separately, so summary stays light. */
function read_counters() {
	let counters = {};
	for (let t in TABLES) {
		let raw = nft_json('list counters table ' + t.family + ' ' + t.table);
		if (!raw || type(raw.nftables) != 'array') continue;
		for (let item in raw.nftables) {
			if (item.counter && item.counter.name) {
				let name = item.counter.name;
				if (!(name in counters)) counters[name] = { packets: 0, bytes: 0 };
				counters[name].packets += number_or_zero(item.counter.packets);
				counters[name].bytes += number_or_zero(item.counter.bytes);
			}
		}
	}
	return counters;
}

function read_chains() {
	let chains = { input: false, forward: false };
	let raw = nft_json('list chains');
	if (!raw || type(raw.nftables) != 'array') return chains;
	for (let t in TABLES)
		for (let item in raw.nftables)
			if (item.chain && item.chain.family == t.family && item.chain.table == t.table) {
				if (item.chain.hook == 'input') chains.input = true;
				if (item.chain.hook == 'forward') chains.forward = true;
			}
	return chains;
}

function update_history(counters, sets) {
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
		let processed = counters.processed ? number_or_zero(counters.processed.packets) : 0;
		let blocked = 0;
		for (let set in sets) {
			let counter = counters[set.name];
			if (counter) blocked += number_or_zero(counter.packets);
		}
		let delta_processed = last && processed >= number_or_zero(last.processed) ? processed - number_or_zero(last.processed) : 0;
		let delta_blocked = last && blocked >= number_or_zero(last.blocked) ? blocked - number_or_zero(last.blocked) : 0;
		let elapsed = last ? now - number_or_zero(last.ts) : SAMPLE_INTERVAL;
		let total_ips = 0;
		for (let set in sets) total_ips += number_or_zero(set.count);
		push(samples, {
			ts: now, processed: processed, blocked: blocked,
			ips: total_ips,
			processed_rate: elapsed > 0 ? delta_processed * 1.0 / elapsed : 0,
			blocked_rate: elapsed > 0 ? delta_blocked * 1.0 / elapsed : 0
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
	let idx = load_index();
	let counters = read_counters();
	let chains = read_chains();
	let sets = [];
	for (let set in idx.sets) {
		let counter = counters[set.name] || { packets: 0, bytes: 0 };
		push(sets, { name: set.name, origin: set.origin, family: set.family, count: set.count, packets: counter.packets, bytes: counter.bytes });
	}
	let history = idx.available ? update_history(counters, idx.sets) : { samples: [] };
	return {
		available: idx.available, bouncer_running: read_bouncer_state(),
		sets: sets, counters: counters, chains: chains,
		generated_at: time(), history: history.samples,
		lapi_sync: 'not_exposed_by_local_bouncer'
	};
}

function row(set, entry) {
	return { ip: entry.ip, origin: set.origin, expires_ms: entry.expires_ms, timeout_ms: entry.timeout_ms };
}

/* Returns the rows from global position `start`, reading only the sets that overlap the window. */
function page_rows(sets, start, page_size) {
	let rows = [], skipped = 0;
	for (let set in sets) {
		if (length(rows) >= page_size) break;
		let count = number_or_zero(set.count);
		if (skipped + count <= start) { skipped += count; continue; }
		let elements = read_set_elements(set);
		let from = start > skipped ? start - skipped : 0;
		for (let i = from; i < length(elements) && i < count && length(rows) < page_size; i++)
			push(rows, row(set, elements[i]));
		skipped += count;
	}
	return rows;
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
				/* Accept IPv4 and IPv6 literals: hex digits, colons and dots, up to 45 characters. */
				let invalid_search = length(search) > 45;
				for (let i = 0; i < length(search); i++)
					if (index('0123456789abcdef:.', lc(substr(search, i, 1))) == -1) invalid_search = true;
				if (invalid_search) search = '';
				else search = lc(search);

				let idx = load_index();
				let sets = [];
				for (let set in idx.sets)
					if (origin == '' || set.origin == origin) push(sets, set);

				let total = 0, rows = [];
				if (search == '') {
					/* Fast path: pages come from set sizes, so only the needed sets are read. */
					for (let set in sets) total += number_or_zero(set.count);
					rows = page_rows(sets, (page - 1) * page_size, page_size);
				}
				else {
					/* Search has no index shortcut, so it scans the selected sets. Slower, but rare. */
					let found = [];
					for (let set in sets)
						for (let entry in read_set_elements(set))
							if (index(entry.ip, search) != -1) push(found, row(set, entry));
					total = length(found);
					for (let i = (page - 1) * page_size; i < total && i < page * page_size; i++)
						push(rows, found[i]);
				}

				return {
					available: idx.available, page: page, page_size: page_size,
					total: total, pages: total ? int((total + page_size - 1) / page_size) : 0,
					rows: rows
				};
			}
		}
	}
};
