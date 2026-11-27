import { readfile } from 'fs';

const source = readfile(ARGV[0]);
const start = index(source, 'function reconfigured(');
const end = index(source, 'function installConfig(');
const load = loadstring('return function(command) {\n' +
	substr(source, start, end - start) + '\nreturn restoreService;\n};')();

function simulate(was_running, replies) {
	let calls = 0;
	const restore = load(cmd => {
		const next = replies[calls++];
		if (!next || index(cmd, next[0]) < 0) die('Unexpected service command: ' + cmd);
		return next[1];
	});
	const restored = restore(was_running);
	if (calls != length(replies)) die('Not all expected service commands were called');
	return restored;
}

const applied = { ok: true, text: 'Reading configuration\nReconfigured' };
const failed = { ok: false, text: '' };
const ok = { ok: true, text: '' };
if (!simulate(true, [['birdc configure', applied], ['birdc show status', ok]]))
	die('Running BIRD was not verified after rollback');
if (!simulate(true, [['birdc configure', { ok: true, text: 'Reconfiguration in progress' }],
                     ['Daemon is up and running', ok]]))
	die('Asynchronous reconfiguration was not verified');
if (!simulate(true, [['birdc configure', { ok: true, text: 'Reconfiguration already in progress, queueing new config' }],
                     ['Daemon is up and running', ok]]))
	die('A queued reconfiguration was not verified');
if (simulate(true, [['birdc configure', { ok: true, text: 'Reconfiguration in progress' }],
                    ['Daemon is up and running', failed]]))
	die('An unfinished asynchronous reconfiguration was treated as restored');
if (simulate(true, [['birdc configure', { ok: true, text: 'Configuration error' }]]))
	die('Rejected reconfiguration was treated as successful');
if (simulate(true, [['birdc configure', applied], ['birdc show status', failed]]))
	die('Unreachable BIRD was treated as restored');
if (!simulate(false, [['bird stop', ok], ['bird running', failed], ['birdc show status', failed]]))
	die('The previous stopped state was not verified');
if (simulate(false, [['bird stop', failed], ['bird running', ok]]))
	die('Running BIRD was mistaken for a restored stopped state');
print('Rollback service verification passed\n');
