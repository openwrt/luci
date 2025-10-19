#!/usr/bin/env ucode

'use strict';

import { access, popen, readfile, writefile, unlink } from 'fs';
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

const methods = {};

methods.get_status = {
    call: function() {
        let data = {
            status: '',
            version: '',
            TUNMode: '',
            ipv4: "Not running",
            ipv6: null,
            domain_name: '',
            peers: []
        };
        if (access('/usr/sbin/tailscale')==true || access('/usr/bin/tailscale')==true){
        }else{
            data.status = 'not_installed';
            return data;
        }
        let ip_output = exec('tailscale ip');
        if (ip_output.code == 0 && length(ip_output.stdout) > 0) {
            data.ipv4 = ip_output.stdout[0];
            data.ipv6 = ip_output.stdout[1];
        }
        let status_json_output = exec('tailscale status --json');
        let peer_map = {};
        if (status_json_output.code == 0 && length(status_json_output.stdout) > 0) {
            try {
                let status_data = json(join('',status_json_output.stdout));
                data.version = status_data.Version || 'Unknown';
                data.TUNMode = status_data.TUN;
                if (status_data.BackendState == 'Running') {
                    data.status =  'running';
                }
            } catch (e) { /* ignore */ }
        }
        let status_plain_output = exec('tailscale status');
        if (length(status_plain_output.stdout) > 0) {
            for (let line in status_plain_output.stdout) {
                let parts = trim(line);
                if (index(parts, 'Logged') != -1) {
                    data.status='logout';
                    break;
                    }
                parts = split(parts, /\s+/);
                if (parts[0] == '#' ){break;}
                if (length(parts) >= 5) {
                    let ip = parts[0];
                    let hostname = parts[1];
                    let ostype = parts[3];
                    let status = rtrim(parts[4],';');
                    peer_map[hostname] = {
                        ip: ip,
                        hostname: hostname,
                        ostype: ostype,
                        status: status,
                        linkadress: '',
                        tx: '',
                        rx: ''
                    };
                    if (status=='active') {
                        let idx = index(parts,'direct');
                        if (idx == -1){
                            idx = index(parts,'relay');
                        }
                        if(index(parts,'tx') != -1) {
                            peer_map[hostname].linkadress = trim(rtrim(parts[idx+1],','),'\"') ||'';
                            let tx_index = index(parts,'tx');
                            peer_map[hostname].tx = rtrim(parts[tx_index+1],',') || '';
                            peer_map[hostname].rx = rtrim(parts[tx_index+3],',') || '';
                        }
                    }
                }
            }
        }
        for (let key in peer_map) {
            push(data.peers,peer_map[key]);
        }
        data.peers = peer_map;
        uci.load('tailscale');
        let state_file_path = uci.get('tailscale', 'settings', 'state_file') || "/var/lib/tailscale/tailscaled.state";
        if (access(state_file_path)) {
            try {
                let state_content = readfile(state_file_path);
                if (state_content) {
                    let state_data = json(state_content);
                    let profiles_b64 = state_data._profiles;
                    let profiles_data = json(b64dec(profiles_b64));
                    let profiles_key = null;
                    for (let key in profiles_data) {
                        profiles_key = key;
                        break;
                    }
                    data.domain_name = profiles_data[profiles_key].NetworkProfile.DomainName||"NXDOMAIN";
                }
            } catch (e) { /* ignore */ }
        }
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
        uci.save('tailscale');
        uci.commit('tailscale');

        let new_mtu = form_data.daemon_mtu || "";
        let new_reduce_mem = form_data.daemon_reduce_memory || "0";
        if (new_mtu != null || new_mtu != '0' || new_reduce_mem != 0) {
            try{mkdir('/etc/profile.d');} catch (e) { }
            const env_script_path = "/etc/profile.d/tailscale-env.sh";
            const env_script_content = `#!/bin/sh
# This script is managed by luci-app-tailscale-community.
uci_get_state() { uci get tailscale.settings."$1" 2>/dev/null; }
if [ "$(uci_get_state daemon_reduce_memory)" = "1" ]; then export GOGC=10; fi
TS_MTU=$(uci_get_state daemon_mtu)
if [ -n "$TS_MTU" ]; then export TS_DEBUG_MTU="$TS_MTU"; fi
`;
            const clean_env_script_content = replace(env_script_content, /\r/g, '');
            if (new_mtu !== "" || new_reduce_mem === "1") {
                writefile(env_script_path, clean_env_script_content);
                exec('chmod 755 '+env_script_path);
            } else {
                unlink(env_script_path);
            }
            popen('/bin/sh -c /etc/init.d/tailscale restart &');
        }
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
        let cmd = `ip -4 addr show | awk '!/ lo$|tailscale/ && /inet/ { split($2,c,"/");split(c[1],o,"."); p=c[2]; i=0; for(k=1;k<=4;k++) i=or(lshift(i,8),o[k]); m=lshift(4294967295,32-p); n=and(i,m); print rshift(n,24)"."and(rshift(n,16),255)"."and(rshift(n,8),255)"."and(n,255)"/"p }'`;
        let routes =  exec(cmd);
        return { routes: routes.stdout };
    }
};

return { 'tailscale': methods };