// LXC management endpoint
// Copyright 2026 Paul Donald <newtwen+github@gmail.com>
// Licensed to the public under the Apache License 2.0.
// Built against the lxc API v6
'use strict';

import * as fs from 'fs';
import { cursor } from 'uci';
import { connect } from 'ubus';
const ctx = cursor();
const LXC_URL  = ctx.get('lxc', 'lxc', 'url');

function statfs(path) {
	let p = fs.popen('df -kP ' + path);
	p.read('line');               // header
	let line = p.read('line');    // data line
	p.close();

	if (!line) return null;
	let cols = split(trim(line), /\s+/);
	// return {
	// 	filesystem: cols[0],
	// 	blocks_kb: int(cols[1],10),
	// 	used_kb:    int(cols[2],10),
	// 	avail_kb:   int(cols[3],10),
	// 	used_pct:   cols[4],
	// 	mount:      cols.slice(5).join(' ')
	// };
	return int(cols[3],10);
}

const LXCController = {

	lxc_get_downloadable: function() {
		let target = this.lxc_get_arch_target(LXC_URL);
		let templates = [];
		let content = fs.popen(`sh /usr/share/lxc/templates/lxc-download --list --server ${LXC_URL} 2>/dev/null`, 'r').read('all');
		content = split(content, '\n');
		for (let line in content) {
			let arr = match(line, /^(\S+)\s+(\S+)\s+(\S+)\s+default\s+(\S+)\s*$/);
			if(length(arr) < 3) continue;
			let dist = trim(arr[1]);
			let version = trim(arr[2]);
			let dist_target = trim(arr[3]);
			if (dist && version && dist_target && dist_target == target) 
				push(templates, `${ dist }:${ version }`);
		}
		// content.close();

		http.prepare_content('application/json');
		http.write_json(templates);
	},

	lxc_create: function(lxc_name, lxc_template) {
		http.prepare_content('text/plain');
		let path = this.lxc_get_config_path();
		if (!path) return;
		let arr = match(lxc_template, /^(.+):(.+)$/);
		let lxc_dist = arr[1], lxc_release = arr[2];

		system(`/usr/bin/lxc-create --quiet --name ${lxc_name} --bdev best --template download -- --dist ${lxc_dist} --release ${lxc_release} --arch ${this.lxc_get_arch_target(LXC_URL)} --server ${LXC_URL}`);

		while (fs.access(path + lxc_name + '/partial')) {
			sleep(1000);
		}

		http.write('0');
	},

	lxc_action: function(lxc_action, lxc_name) {
		let ubus = connect();
		let data = ubus.call('lxc', lxc_action, { name: lxc_name });

		http.prepare_content('application/json');
		http.write_json(data ? data : '');
	},

	lxc_get_config_path: function() {
		let content = fs.readfile('/etc/lxc/lxc.conf');
		let ret = match(content, /^\s*lxc.lxcpath\s*=\s*(\S*)/);
		if (ret && length(ret) == 2) {
			if (fs.access(ret[1])) {
				let min_space = int(ctx.get('lxc', 'lxc', 'min_space')) || 100000;
				let free_space = statfs(ret[1]);
				if (free_space && free_space >= min_space) {
					let min_temp = int(ctx.get('lxc', 'lxc', 'min_temp')) || 100000;
					let free_temp = statfs('/tmp');
					if (free_temp && free_temp >= min_temp)
						return ret[1] + '/';
					else
						return 'lxc error: not enough temporary space (< ' + min_temp + ' KB)';
				}
				else
					return 'lxc error: not enough space (< ' + min_space + ' KB)';
			}
			else
				return 'lxc error: directory not found';
		}
		else
			return 'lxc error: config path is empty';
	},

	lxc_configuration_get: function(lxc_name) {
		let content = fs.readfile(this.lxc_get_config_path() + lxc_name + '/config');

		http.prepare_content('text/plain');
		http.write(content);
	},

	lxc_configuration_set: function(lxc_name) {
		http.prepare_content('text/plain');

		let lxc_configuration = http.formvalue('lxc_conf');
		lxc_configuration = http.urldecode(lxc_configuration, true);
		if (!lxc_configuration) {
			return 'lxc error: config formvalue is empty';
		}

		fs.writefile(this.lxc_get_config_path() + lxc_name + '/config', lxc_configuration);

		http.write('0');
	},

	lxc_get_arch_target: function(url) {
		let target = split(fs.popen('uname -m', 'r').read('line'), '\n');
		if (url && match(url, /images.linuxcontainers.org/)) {
			let target_map = {
				armv5:  'armel',
				armv6:  'armel',
				armv7:  'armhf',
				armv8:  'arm64',
				aarch64:'arm64',
				i686 :  'i386',
				x86_64: 'amd64',
			};
			for (let k, v in target_map) {
				if (target[0] == k) {
					return v;
				}
			}
		}
		return target[0];
	},
};

// Export all handlers with automatic error wrapping
let controller = LXCController;
let exports = {};
for (let k, v in controller) {
	if (type(v) == 'function')
		exports[k] = v;
}

return exports;
