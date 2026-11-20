#!/usr/bin/env ucode

'use strict';

import { parse_clients, parse_status } from 'qnetd';

function assert_equal(actual, expected, message) {
	if (actual != expected) {
		warn(`FAIL: ${message}: expected ${expected}, got ${actual}\n`);
		exit(1);
	}
};

let status = parse_status(
	'QNetd address:\t\t\t*:5403\n' +
	'TLS:\t\t\t\tSupported (client certificate required)\n' +
	'Connected clients:\t\t2\n' +
	'Connected clusters:\t\t1\n' +
	'Maximum send/receive size:\t32768/32768 bytes\n');

assert_equal(status.address, '*:5403', 'server address');
assert_equal(status.connected_clients, 2, 'connected client count');
assert_equal(status.connected_clusters, 1, 'connected cluster count');
assert_equal(status.parse_error, false, 'status parse flag');

let clients = parse_clients(
	'Cluster "example":\n' +
	'    Algorithm:\t\tLMS\n' +
	'    Tie-breaker:\tNode with lowest node ID\n' +
	'    Node ID 1:\n' +
	'        Client address:\t\t192.0.2.10:50000\n' +
	'        HB interval:\t\t8000ms\n' +
	'        Configured node list:\t1, 2, 3\n' +
	'        Ring ID:\t\t1.a00000000021b40\n' +
	'        Membership node list:\t1, 2, 3\n' +
	'        TLS active:\t\tYes (client certificate verified)\n' +
	'        Vote:\t\t\tNo change (ACK)\n');

assert_equal(length(clients.clusters), 1, 'cluster count');
assert_equal(clients.clusters[0].name, 'example', 'cluster name');
assert_equal(clients.clusters[0].algorithm, 'LMS', 'algorithm');
assert_equal(clients.clusters[0].nodes[0].node_id, 1, 'node ID');
assert_equal(clients.clusters[0].nodes[0].tls, 'Yes (client certificate verified)', 'TLS state');
assert_equal(clients.parse_error, false, 'client parse flag');

print('parser tests passed\n');
