#!/usr/bin/env ucode

'use strict';

import { access, popen, readfile, writefile, rename, unlink } from 'fs';
import { cursor } from 'uci';

const uci = cursor();

function exec(command) {
	let stdout_content = '';
	let p = popen(command, 'r');
	sleep(100);
	if (p == null) {
		return { code: -1, stdout: '', stderr: `Failed to execute: ${command}` };
	}
	for (let line = p.read('line'); length(line); line = p.read('line')) {
		stdout_content = stdout_content+line;
	}
	stdout_content = rtrim(stdout_content);
	stdout_content = split(stdout_content, '\n');

	let exit_code = p.close();
	let stderr_content = '';
	if (exit_code != 0) {
		stderr_content = stdout_content;
	}
	return { code: exit_code, stdout: stdout_content, stderr: stderr_content };
}

function shell_quote(s) {
	if (s == null || s == '') return "''";
	return "'" + replace(s, "'", "'\\''") + "'";
}

const methods = {};

methods.get_status = {
	call: function() {
		let data = {
			status: '',
			version: '',
			TUNMode: false,
			health: '',
			ipv4: "Not running",
			ipv6: "",
			domain_name: '',
			peers: {}
		};
		if (access('/usr/sbin/tailscale')==true || access('/usr/bin/tailscale')==true){ }else{
			data.status = 'not_installed';
			return data;
		}

		let status_json_output = exec('tailscale status --json');
		let peer_map = {};
		if (status_json_output.code == 0 && length(status_json_output.stdout) > 0) {
			try {
				let status_data = json(join('', status_json_output.stdout));
				data.version = status_data?.Version || 'Unknown';
				data.health = (status_data?.Health && length(status_data.Health) > 0) ? status_data.Health[0] : '';
				data.TUNMode = (status_data?.TUN == true);
				if (status_data?.BackendState == 'Running') { data.status = 'running'; }
				if (status_data?.BackendState == 'NeedsLogin') { data.status = 'logout'; }

				data.ipv4 = status_data?.Self?.TailscaleIPs?.[0] || 'No IP assigned';
				data.ipv6 = status_data?.Self?.TailscaleIPs?.[1] || '';
				data.domain_name = status_data?.CurrentTailnet?.Name || '';

				// peers list
				if (status_data?.Peer) {
					for (let p in status_data.Peer) {
						let peer = status_data.Peer[p];
						peer_map[peer.ID] = {
							ip: join('<br>', peer?.TailscaleIPs || []),
							hostname: split(peer?.DNSName || '', '.')[0] || peer?.HostName || '',
							ostype: peer?.OS || '',
							online: !!peer?.Online,
							linkadress: (!peer?.CurAddr) ? (peer?.Relay || '') : peer?.CurAddr,
							lastseen: peer?.LastSeen || '',
							exit_node: !!peer?.ExitNode,
							exit_node_option: !!peer?.ExitNodeOption,
							tx: peer?.TxBytes || 0,
							rx: peer?.RxBytes || 0
						};
					}
				}
			} catch (e) { /* ignore */ }
		}

		data.peers = peer_map;
		return data;
	}
};

methods.get_settings = {
	call: function() {
		let settings = {};
		uci.load('tailscale');
		let state_file_path = uci.get('tailscale', 'settings', 'state_file') || "/etc/tailscale/tailscaled.state";
		if (access(state_file_path)) {
			try {
				let state_content = readfile(state_file_path);
				if (state_content != null) {
					let state_data = json(state_content);
					let profiles_b64 = state_data?._profiles;
					if (!profiles_b64) return settings;

					let profiles_data = json(b64dec(profiles_b64));
					let profiles_key = null;
					for (let key in profiles_data) {
						profiles_key = key;
						break;
					}
				profiles_key = 'profile-'+profiles_key;

				let status_data = json(b64dec(state_data?.[profiles_key]));
				if (status_data != null) {
					settings.accept_routes = status_data?.RouteAll || false;
					settings.advertise_exit_node = status_data?.AdvertiseExitNode || false;
					settings.advertise_routes = status_data?.AdvertiseRoutes || [];
					settings.exit_node = status_data?.ExitNodeID || "";
					settings.exit_node_allow_lan_access = status_data?.ExitNodeAllowLANAccess || false;
					settings.shields_up = status_data?.ShieldsUp || false;
					settings.ssh = status_data?.RunSSH || false;
					settings.runwebclient = status_data?.RunWebClient || false;
					settings.nosnat = status_data?.NoSNAT || false;
					settings.dns_mode = uci.get('tailscale', 'settings', 'dns_mode') || 'disabled';
					settings.fw_mode = split(uci.get('tailscale', 'settings', 'fw_mode'),' ')[0] || 'nftables';
				}
				}
			} catch (e) { /* ignore */ }
		}
		return settings;
	}
};


methods.do_login = {
	args: { form_data: {} },
	call: function(request) {
		const form_data = request.args.form_data;
		let loginargs = [];
		if (form_data == null || length(form_data) == 0) {
			return { error: 'Missing or invalid form_data parameter. Please provide login data.' };
		}

		let status=methods.get_status.call();
		if (status.status != 'logout') {
			return { error: 'Tailscale is already logged in and running.' };
		}
		// --- 1. Prepare and Run Login Command (Once) ---
		const loginserver = trim(form_data.loginserver) || '';
		const loginserver_authkey = trim(form_data.loginserver_authkey) || '';

		if (loginserver!='') {
			push(loginargs,'--login-server '+shell_quote(loginserver));
			if (loginserver_authkey!='') {
				push(loginargs,'--auth-key '+shell_quote(loginserver_authkey));
			}
		}

		// Run the command in the background using /bin/sh -c to handle the '&' correctly
		let login_cmd = 'tailscale login '+join(' ', loginargs);
		popen('/bin/sh -c ' + shell_quote(login_cmd + ' &'), 'r');

		// --- 2. Loop to Check Status for URL ---
		let max_attempts = 15;
		let interval = 2000;

		for (let i = 0; i < max_attempts; i++) {
			let tresult = exec('tailscale status');
			for (let line in tresult.stdout) {
				let trline = trim(line);
				if (index(trline, 'http') != -1) {
					let parts = split(trline, ' ');
					for (let part in parts) {
						if (index(part, 'http') != -1) {
							return { success: true, url: part };
						}
					}
				}
			}
			sleep(interval);
		}
		return { error: 'Could not retrieve login URL from tailscale command after 30 seconds.' };
	}
};

methods.do_logout = {
	call: function() {
		let status=methods.get_status.call();
		if (status.status != 'running') {
			return { error: 'Tailscale is not running. Cannot perform logout.' };
		}

		let logout_result = exec('tailscale logout');
		if (logout_result.code != 0) {
			return { error: 'Failed to logout: ' + logout_result.stderr };
		}
		return { success: true, message: 'Logged out.' };
	}
};

methods.get_subroutes = {
	call: function() {
		try {
			let cmd = 'ip -j route';
			let result = exec(cmd);
			let subnets = [];

			if (result.code == 0 && length(result.stdout) > 0) {
				let routes_json = json(join('',result.stdout));

				for (let route in routes_json) {
					// We need to filter out local subnets
					// 1. 'dst' (target address) is not' default' (default gateway)
					// 2. 'scope' is' link' (indicating directly connected network)
					// 3. It is an IPv4 address (simple judgment: including'.')
					if (route?.dst && route.dst != 'default' && route?.scope == 'link' && index(route.dst,'.') != -1) {
						push(subnets,route.dst);
					}
				}
			}
			return { routes: subnets };
		}
		catch(e) {
			return { routes: [] };
		}
	}
};

methods.setup_firewall = {
	call: function() {
		try {
			uci.load('tailscale');

			uci.load('network');
			uci.load('firewall');

			let changed_network = false;
			let changed_firewall = false;
			let run_id = 0;

			// 1. config Network Interface
			let net_ts = uci.get('network', 'tailscale');
			if (net_ts == null) {
				uci.set('network', 'tailscale', 'interface');
				uci.set('network', 'tailscale', 'proto', 'none');
				uci.set('network', 'tailscale', 'device', 'tailscale0');
				changed_network = true;
			} else {
				let current_dev = uci.get('network', 'tailscale', 'device');
				if (current_dev != 'tailscale0') {
					uci.set('network', 'tailscale', 'device', 'tailscale0');
					changed_network = true;
				}
			}

			// 2. config Firewall Zone
			let ts_zone_section = null;
			let fwd_lan_to_ts = false;
			let fwd_ts_to_lan = false;

			uci.foreach('firewall', 'zone', function(s) {
				if (s['name'] == 'tailscale')
				ts_zone_section = s['.name'];
				});
				uci.foreach('firewall', 'forwarding', function(s) {
					if (s['src'] == 'lan' && s['dest'] == 'tailscale') fwd_lan_to_ts = true;
					if (s['src'] == 'tailscale' && s['dest'] == 'lan') fwd_ts_to_lan = true;
				});

			if (ts_zone_section == null) {
				let zid = uci.add('firewall', 'zone');
				uci.set('firewall', zid, 'name', 'tailscale');
				uci.set('firewall', zid, 'input', 'ACCEPT');
				uci.set('firewall', zid, 'output', 'ACCEPT');
				uci.set('firewall', zid, 'forward', 'ACCEPT');
				uci.set('firewall', zid, 'masq', '1');
				uci.set('firewall', zid, 'mtu_fix', '1');
				uci.set('firewall', zid, 'network', ['tailscale']);
				changed_firewall = true;
			} else {
				let nets = uci.get('firewall', ts_zone_section, 'network');
				let net_list = [];
				let has_ts_net = false;

				if (type(nets) == 'array') {
					net_list = nets;
				} else if (type(nets) == 'string') {
					net_list = [nets];
				}

				// check if 'tailscale' is already in the list
				for (let n in net_list) {
					if (n == 'tailscale') {
						has_ts_net = true;
						break;
					}
				}

				if (!has_ts_net) {
					push(net_list, 'tailscale');
					uci.set('firewall', ts_zone_section, 'network', net_list);
					changed_firewall = true;
				}
			}

			// 3. config Forwarding
			if (!fwd_lan_to_ts) {
				let fid = uci.add('firewall', 'forwarding');
				uci.set('firewall', fid, 'src', 'lan');
				uci.set('firewall', fid, 'dest', 'tailscale');
				changed_firewall = true;
			}

			if (!fwd_ts_to_lan) {
				let fid = uci.add('firewall', 'forwarding');
				uci.set('firewall', fid, 'src', 'tailscale');
				uci.set('firewall', fid, 'dest', 'lan');
				changed_firewall = true;
			}

			// Exit node requires WAN <- tailscale forwarding
			let fwd_ts_to_wan = false;
			uci.foreach('firewall', 'forwarding', function(s) {
				if (s['src'] == 'tailscale' && s['dest'] == 'wan') fwd_ts_to_wan = true;
			});

			if (!fwd_ts_to_wan) {
				let fid = uci.add('firewall', 'forwarding');
				uci.set('firewall', fid, 'src', 'tailscale');
				uci.set('firewall', fid, 'dest', 'wan');
				changed_firewall = true;
			}

			// 4. save and hand the reload to a background worker
			//
			// Reloading network/firewall synchronously here was the reason the
			// button failed through a reverse proxy: the reload tears down the
			// connection carrying this very request. The worker records its
			// progress in /var/run/tailscale-fwsetup.status and the UI polls it.
			if (changed_network) {
				uci.save('network');
				uci.commit('network');
			}

			if (changed_firewall) {
				uci.save('firewall');
				uci.commit('firewall');
			}

			if (changed_network || changed_firewall) {
				if (!access('/usr/libexec/tailscale-setup-firewall')) {
					return { error: 'Firewall worker /usr/libexec/tailscale-setup-firewall is missing. Reinstall the package.' };
				}

				// The run id ties the polled result to this request, and the
				// queued state replaces any previous result before the worker
				// gets a chance to overwrite it. Without both, a poll arriving
				// while the worker is still starting would read the previous
				// run's "done" and report success for work that has not run.
				// clock() returns [seconds, nanoseconds], not milliseconds, so
				// fold it explicitly. Two clicks within the same second still
				// get distinct ids; the temp file name carries the id as well,
				// so concurrent writers cannot clobber each other's queued
				// state through a shared fixed path.
				let now = clock();
				run_id = now[0] * 1000 + int(now[1] / 1000000);
				let tmp = '/var/run/tailscale-fwsetup.status.tmp.' + run_id;
				let st = writefile(tmp, 'queued\nstart\n\n' + run_id + '\n');
				if (st == null || rename(tmp, '/var/run/tailscale-fwsetup.status') == null) {
					// Without a writable status file the poll can never see a
					// result, so say so instead of letting the UI wait it out.
					// Drop the temp file we may have created, so a failed run
					// leaves no stray state behind for the next poll.
					unlink(tmp);
					return { error: 'Cannot write the firewall status file in /var/run. The configuration was committed but not applied.' };
				}

				// The background shell exits immediately, so its status only
				// tells us whether sh itself started. Anything the worker
				// reports afterwards lands in the status file.
				let spawn = exec('/bin/sh -c ' + shell_quote('/usr/libexec/tailscale-setup-firewall ' + run_id + ' >/dev/null 2>&1 &'));
				if (spawn.code != 0) {
					return { error: 'Failed to start the firewall worker: ' + join('\n', spawn.stdout) };
				}
			}

			return {
				success: true,
				changed_network: changed_network,
				changed_firewall: changed_firewall,
				job: (changed_network || changed_firewall) ? 'running' : 'idle',
				run_id: run_id,
				message: (changed_network || changed_firewall) ? 'Configuration committed, reloading network and firewall in the background.' : 'Tailscale firewall/interface already configured.'
			};

		} catch (e) {
			return { error: 'Exception in setup_firewall: ' + e + '\nStack: ' + (e.stacktrace || '') };
		}
	}
};

// Record that the user asked to disable the service.
//
// The actual stop happens in /etc/init.d/tailscale-settings on the reload
// trigger, which runs right after rpcd commits and *before* it arms the LuCI
// rollback timer. Stopping here would not survive a rollback: rpcd restores
// the config files but never restarts a daemon it did not stop, so the user
// would end up with service_enabled=1 and a dead tunnel. The request file is
// dropped by the reload handler as soon as the config says enabled again.
methods.set_service_enabled = {
	args: { enabled: '' },
	call: function(request) {
		let enabled = request?.args?.enabled;
		if (enabled != '0' && enabled != '1') {
			return { error: 'Invalid enabled value, expected 0 or 1.' };
		}

		if (enabled == '1') {
			let r = exec('rm -f /var/run/tailscale-settings/disable-requested');
			if (r.code != 0) {
				return { error: 'Failed to clear the disable request: ' + join('\n', r.stdout) };
			}
			return { success: true, armed: false };
		}

		// No daemon probe here: get_status shells out to 'tailscale status'
		// and would delay the apply for nothing. A request armed on a box
		// without the tailscale package is simply ignored by the reload
		// handler, which bails out when the init script is missing.
		let r = exec('mkdir -p /var/run/tailscale-settings && touch /var/run/tailscale-settings/disable-requested');
		if (r.code != 0) {
			return { error: 'Failed to arm the disable request: ' + join('\n', r.stdout) };
		}

		return { success: true, armed: true };
	}
};

// Result of the last background firewall setup job.
//
// Read here rather than in the browser so the ACL needs no file rights: the
// ucode plugin runs as root and rpcd only enforces path ACLs on the file
// ubus object.
methods.get_firewall_status = {
	call: function() {
		let path = '/var/run/tailscale-fwsetup.status';
		if (!access(path)) {
			return { success: true, state: 'idle', step: '', message: '', run_id: 0 };
		}
		try {
			let raw = readfile(path);
			if (raw == null) {
				return { success: true, state: 'idle', step: '', message: '', run_id: 0 };
			}
			let lines = split(rtrim(raw, '\n'), '\n');
			return {
				success: true,
				state: lines[0] || 'unknown',
				step: lines[1] || '',
				message: lines[2] || '',
				// the run id is always the last line, so a message that somehow
				// still contains a newline cannot shift it into line 3
				run_id: int(lines[length(lines) - 1]) || 0
			};
		} catch (e) {
			return { success: true, state: 'unknown', step: '', message: 'Unreadable job state: ' + e, run_id: 0 };
		}
	}
};

methods.get_logs = {
	args: { lines: 200 },
	call: function(request) {
		let lines = int(request?.args?.lines) || 200;
		if (lines < 1) lines = 200;
		if (lines > 1000) lines = 1000;
		// Filter first, then take the tail: logread -l would only hand the last
		// N lines of every daemon to grep, so a busy box hides the tailscale
		// records entirely and the log page claims there is nothing to show.
		let cmd = 'logread 2>/dev/null | grep -i -E "tailscale" | tail -n ' + lines;
		let result = exec(cmd);
		if (result.code == 0) {
			return { success: true, logs: result.stdout };
		}
		return { success: false, logs: [], error: join(' ', result.stderr) };
	}
};

return { 'tailscale': methods };
