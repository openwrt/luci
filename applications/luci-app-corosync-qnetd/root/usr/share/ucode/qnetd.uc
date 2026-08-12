'use strict';

function value_after_colon(line) {
	let pos = index(line, ':');
	return pos >= 0 ? trim(substr(line, pos + 1)) : '';
}

export function parse_status(output) {
	let result = {
		address: null,
		tls: null,
		connected_clients: 0,
		connected_clusters: 0,
		max_clients: null,
		max_send_receive: null,
		raw: output || '',
		parse_error: false,
	};

	for (let line in split(output || '', '\n')) {
		let key = trim(line);
		if (match(key, /^QNetd address:/))
			result.address = value_after_colon(key);
		else if (match(key, /^TLS:/))
			result.tls = value_after_colon(key);
		else if (match(key, /^Connected clients:/))
			result.connected_clients = int(value_after_colon(key));
		else if (match(key, /^Connected clusters:/))
			result.connected_clusters = int(value_after_colon(key));
		else if (match(key, /^Maximum allowed clients:/))
			result.max_clients = int(value_after_colon(key));
		else if (match(key, /^Maximum send\/receive size:/))
			result.max_send_receive = value_after_colon(key);
	}

	result.parse_error = !!output && (!result.address || !result.tls);
	return result;
};

export function parse_clients(output) {
	let clusters = [];
	let cluster = null;
	let node = null;

	for (let rawline in split(output || '', '\n')) {
		let line = trim(rawline);
		let m;
		if ((m = match(line, /^Cluster "(.*)":$/))) {
			cluster = { name: m[1], algorithm: null, tie_breaker: null, nodes: [] };
			push(clusters, cluster);
			node = null;
		} else if (cluster && match(line, /^Algorithm:/)) {
			cluster.algorithm = value_after_colon(line);
		} else if (cluster && match(line, /^Tie-breaker:/)) {
			cluster.tie_breaker = value_after_colon(line);
		} else if (cluster && (m = match(line, /^Node ID ([0-9]+):$/))) {
			node = { node_id: int(m[1]) };
			push(cluster.nodes, node);
		} else if (node && match(line, /^Client address:/)) {
			node.client_address = value_after_colon(line);
		} else if (node && match(line, /^HB interval:/)) {
			node.heartbeat_interval = value_after_colon(line);
		} else if (node && match(line, /^Configuration version:/)) {
			node.configuration_version = value_after_colon(line);
		} else if (node && match(line, /^Configured node list:/)) {
			node.configured_nodes = value_after_colon(line);
		} else if (node && match(line, /^Membership node list:/)) {
			node.membership_nodes = value_after_colon(line);
		} else if (node && match(line, /^Ring ID:/)) {
			node.ring_id = value_after_colon(line);
		} else if (node && match(line, /^Heuristics:/)) {
			node.heuristics = value_after_colon(line);
		} else if (node && match(line, /^TLS active:/)) {
			node.tls = value_after_colon(line);
		} else if (node && match(line, /^Vote:/)) {
			node.vote = value_after_colon(line);
		}
	}

	return {
		clusters,
		raw: output || '',
		parse_error: !!output && !length(clusters),
	};
};
