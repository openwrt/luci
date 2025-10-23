#!/usr/bin/env ucode

'use strict';

import { access, popen, readfile, writefile, unlink } from 'fs';
import { cursor } from 'uci';

const uci = cursor();
// Keep in doubt about its usefulness
//const env_script_path = "/etc/profile.d/tailscale-env.sh";
//const ori_env_script_content = `#!/bin/sh
//# This script is managed by luci-app-tailscale-community.
//uci_get_state() { uci get tailscale.settings."$1" 2>/dev/null; }
//TS_MTU=$(uci_get_state daemon_mtu)
//if [ -n "$TS_MTU" ]; then export TS_DEBUG_MTU="$TS_MTU"; fi
//`;
//const env_script_content = replace(ori_env_script_content, /\r/g, '');

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

const methods = {};

methods.get_status = {
	call: function() {
		let data = {
			status: '',
			version: '',
			TUNMode: '',
			health: '',
			ipv4: "Not running",
			ipv6: null,
			domain_name: '',
			peers: []
		};
		if (access('/usr/sbin/tailscale')==true || access('/usr/bin/tailscale')==true){ }else{
			data.status = 'not_installed';
			return data;
		}

		let status_json_output = exec('tailscale status --json');
		let peer_map = {};
		if (status_json_output.code == 0 && length(status_json_output.stdout) > 0) {
			try {
				let status_data = json(join('',status_json_output.stdout));
				data.version = status_data.Version || 'Unknown';
				data.health = status_data.Health || '';
				data.TUNMode = status_data.TUN;
				if (status_data.BackendState == 'Running') { data.status =  'running'; }
				if (status_data.BackendState == 'NeedsLogin') { data.status =  'logout'; }

				data.ipv4 = status_data.Self.TailscaleIPs[0] || 'No IP assigned';
				data.ipv6 = status_data.Self.TailscaleIPs[1] || null;
				data.domain_name = status_data.CurrentTailnet.Name || '';

				// peers list
				for (let p in status_data.Peer) {
					p = status_data.Peer[p];
					peer_map[p.ID] = {
						ip: join('<br>', p.TailscaleIPs) || '',
						hostname: split(p.DNSName,'.')[0] || '',
						ostype: p.OS,
						online: p.Online,
						linkadress: (p.CurAddr=="") ? p.Relay : p.CurAddr,
						lastseen: p.LastSeen,
						tx: '',
						rx: ''
					};
				}
			} catch (e) { /* ignore */ }
		}

		for (let key in peer_map) {
			push(data.peers,peer_map[key]);
		}
		data.peers = peer_map;
		return data;
	}
};

methods.get_settings = {
	call: function() {
		let settings = {};
		uci.load('tailscale');
		let state_file_path = uci.get('tailscale', 'settings', 'state_file') || "/var/lib/tailscale/tailscaled.state";
		if (access(state_file_path)) {
			try {
				let state_content = readfile(state_file_path);
				if (state_content != null) {
					let state_data = json(state_content);
					let profiles_b64 = state_data._profiles;
					let profiles_data = json(b64dec(profiles_b64));
					let profiles_key = null;
					for (let key in profiles_data) {
						profiles_key = key;
						break;
					}
				profiles_key = 'profile-'+profiles_key;

				let status_data = json(b64dec(state_data[profiles_key]));
				if (status_data != null) {
					settings.accept_routes = status_data.RouteAll;
					settings.advertise_exit_node = status_data.AdvertiseExitNode;
					settings.advertise_routes = status_data.AdvertiseRoutes || [];
					settings.exit_node = status_data.ExitNodeID || "";
					settings.exit_node_allow_lan_access = status_data.ExitNodeAllowLANAccess;
					settings.shields_up = status_data.ShieldsUp;
					settings.ssh = status_data.RunSSH;
					settings.runwebclient = status_data.RunWebClient;
					settings.nosnat = status_data.NoSNAT;
					settings.fw_mode = split(uci.get('tailscale', 'settings', 'fw_mode'),' ')[0] || 'nftables';
				}
				}
			} catch (e) { /* ignore */ }
		}
		return settings;
	}
};

methods.set_settings = {
	args: { form_data: {} },
	call: function(request) {
		const form_data = request.args.form_data;
		if (form_data == null || length(form_data) == 0) {
			return { error: 'Missing or invalid form_data parameter. Please provide settings data.' };
		}
		let args = ['set'];

		push(args,'--accept-routes=' + (form_data.accept_routes == '1'));
		push(args,'--advertise-exit-node=' + (form_data.advertise_exit_node == '1'));
		push(args,'--exit-node-allow-lan-access=' + (form_data.exit_node_allow_lan_access == '1'));
		push(args,'--ssh=' + (form_data.ssh == '1'));
		push(args,'--shields-up=' + (form_data.shields_up == '1'));
		push(args,'--advertise-routes ' + (join(',',form_data.advertise_routes) || '\"\"'));
		push(args,'--exit-node ' + (form_data.exit_node || '\"\"'));
		push(args,'--hostname ' + (form_data.hostname || '\"\"'));

		let cmd_array = 'tailscale '+join(' ', args);
		let set_result = exec(cmd_array);
		if (set_result.code != 0) {
			return { error: 'Failed to apply node settings: ' + set_result.stderr };
		}

		uci.load('tailscale');
		for (let key in form_data) {
			uci.set('tailscale', 'settings', key, form_data[key]);
		}
		// process reduce memory https://github.com/GuNanOvO/openwrt-tailscale
		uci.set('tailscale', 'settings', 'fw_mode', form_data.fw_mode+(form_data.daemon_reduce_memory == '1' ? ' GOGC=10' : ''));

		uci.save('tailscale');
		uci.commit('tailscale');

		/*if (access(env_script_path)==false) {
			if (form_data.daemon_mtu != "") {
				try{ mkdir('/etc/profile.d'); } catch (e) { }
				writefile(env_script_path, env_script_content);
				exec('chmod 755 '+env_script_path);
				popen('/bin/sh -c /etc/init.d/tailscale restart &');
			}
		}else{
			if (form_data.daemon_mtu == "") { unlink(env_script_path); }
		}*/
		return { success: true };
	}
};

methods.do_login = {
	call: function() {
		let status=methods.get_status.call();
		if (status.status != 'logout') {
			return { error: 'Tailscale is already logged in and running.' };
		}

		let max_attempts = 15;
		let interval = 2000;

		for (let i = 0; i < max_attempts; i++) {
			let tresult = exec('tailscale status');
			for (let line in tresult.stdout) {
				let trline = trim(line);
				if (index(trline, 'login.tailscale.com') != -1) {
					let parts = split(trline, ' ');
					for (let part in parts) {
						if (index(part, 'login.tailscale.com') != -1) {
							return { url: part };
						}
					}
				}
			}
			popen('tailscale login&','r');
			sleep(interval);
		}
		return { error: 'Could not retrieve login URL from tailscale command.' };
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
					if (route.dst && route.dst != 'default' && route.scope == 'link' && index(route.dst,'.') != -1) {
						push(subnets,route.dst);
					}
				}
			}
			return { routes: subnets };
		}
		catch(e) {
			return { routes: '[]' };
		}
	}
};

return { 'tailscale': methods };
