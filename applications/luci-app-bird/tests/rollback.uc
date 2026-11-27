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

const install_end = index(source, 'function saveCandidate(');
const loadInstall = loadstring(
	'return function(command, system, writefile, rename, revision, config) {\n' +
	substr(source, start, install_end - start) + '\nreturn installConfig;\n};')();

function simulateInstall(activate, replies, boot_action, boot_status) {
	let commands = 0;
	let system_calls = 0;
	let installs = 0;
	const install = loadInstall(cmd => {
		const next = replies[commands++];
		if (!next || index(cmd, next[0]) < 0) die('Unexpected service command: ' + cmd);
		return next[1];
	}, cmd => {
		const expected = system_calls++ == 0 ? '/usr/sbin/bird -p -c staged >/dev/null 2>&1' :
			'/etc/init.d/bird ' + boot_action + ' >/dev/null 2>&1';
		if (cmd != expected) die('Unexpected system command: ' + cmd);
		return system_calls == 1 ? 0 : boot_status;
	}, (path, contents) => length(contents), (from, to) => {
		if (from != 'staged' || to != 'config') die('Unexpected configuration rename');
		installs++;
		return true;
	}, () => 'original-revision', 'config');
	const result = install('staged', 'backup', 'candidate', 'original', 'original-revision', false, activate);
	if (!result.ok || result.boot_enabled != (boot_status == 0) || installs != 1 ||
	    commands != length(replies) || system_calls != 2)
		die('Unexpected configuration installation result');
}

simulateInstall(false, [['birdc show status', failed], ['bird running', failed]], 'enabled', 1);
simulateInstall(false, [['birdc show status', failed], ['bird running', failed]], 'enabled', 0);
simulateInstall(false, [['birdc show status', ok], ['birdc configure', applied],
                         ['Daemon is up and running', ok]], 'enabled', 1);
simulateInstall(false, [['birdc show status', failed], ['bird running', ok],
                         ['birdc configure', applied], ['Daemon is up and running', ok]], 'enabled', 0);
simulateInstall(true, [['birdc show status', failed], ['bird start', ok],
                        ['Daemon is up and running', ok]], 'enable', 0);
print('Configuration installation service policy passed\n');
