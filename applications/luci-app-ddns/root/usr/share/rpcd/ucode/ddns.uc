#!/usr/bin/env ucode

'use strict';

import { readfile, mkstemp, open, popen, stat, glob } from 'fs';
import { init_list, init_index, init_enabled, init_action, conntrack_list, process_list } from 'luci.sys';
import { isnan } from 'math';
import { cursor } from 'uci';

const uci = cursor();
const ddns_log_path = '/var/log/ddns';
const ddns_package_path = '/usr/share/ddns';
const ddns_run_path = '/var/run/ddns';
const luci_helper = '/usr/lib/ddns/dynamic_dns_lucihelper.sh';
const srv_name    = 'ddns-scripts';
const opkg_info_path    = '/usr/lib/opkg/info';




function get_dateformat() {
	return uci.get('ddns', 'global', 'ddns_dateformat') || '%F %R';
}

function uptime() {
	return split(readfile('/proc/uptime', 256), ' ')?.[0];
}

function killcmd(procid, signal) {
	if (!signal) {
		signal = 0;
	}
	// by default, we simply re-nice a process to check it is running
	return system(`kill -${signal} ${procid}`);
}

function trimnonewline(input) {
	return replace(trim(input), /\n/g, '');
}

function get_date(seconds, format) {
	return trimnonewline( popen(`date -d @${seconds} "+${format}" 2>/dev/null`, 'r')?.read?.('line') );
}

// convert epoch date to given format
function epoch2date(epoch, format) {
	if (!format || length(format) < 2) {
			format = get_dateformat();
			// uci.unload('ddns'); //don't do this in uci.foreach loops
	}
	format = replace(format, /%n/g, '<br />'); // Replace '%n' with '<br />'
	format = replace(format, /%t/g, '    ');   // Replace '%t' with four spaces

	return get_date(epoch, format);
}

// function to calculate seconds from given interval and unit
function calc_seconds(interval, unit) {
	let parsedInterval = int(interval);
	if (isnan(parsedInterval)) {
		return null;
	}

	switch (unit) {
		case 'days':
			return parsedInterval * 86400;  // 60 sec * 60 min * 24 h
		case 'hours':
			return parsedInterval * 3600;   // 60 sec * 60 min
		case 'minutes':
			return parsedInterval * 60;     // 60 sec
		case 'seconds':
			return parsedInterval;
		default:
			return null;
	}
}

const methods = {
	get_services_log: {
		args: { service_name: 'service_name' },
		call: function(request) {
			let result = 'File not found or empty';
			
			// Get the log directory. Fall back to '/var/log/ddns' if not found
			let logdir = uci.get('ddns', 'global', 'ddns_logdir') || ddns_log_path;

			// Fall back to default logdir with insecure path
			if (match(logdir, /\.\.\//)) {
				logdir = ddns_log_path;
			}

			// Check if service_name is provided and log file exists
			if (request.args && request.args.service_name && stat(`${logdir}/${request.args.service_name}.log`)?.type == 'file' ) {
				result = readfile(`${logdir}/${request.args.service_name}.log`);
			}

			uci.unload();
			return { result: result };
		}
	},
	
	get_services_status: {
		call: function() {
			const rundir = uci.get('ddns', 'global', 'ddns_rundir') || ddns_run_path;
			// const dateFormat = get_dateformat();
			let res = {};

			uci.foreach('ddns', 'service', function(s) {
				/* uci.foreach danger zone: if you inadvertently call uci.unload('ddns')
				anywhere in this foreach loop, you will produce some spectacular undefined behaviour */
				let ip, lastUpdate, nextUpdate;
				const section = s['.name'];
				if (section == '.anonymous')
					return;

				if (stat(`${rundir}/${section}.ip`)?.type == 'file') {
					ip = readfile(`${rundir}/${section}.ip`);
				} else {
					const dnsServer = s['dns_server'] || '';
					const forceIpVersion = int(s['force_ipversion'] || 0);
					const forceDnsTcp = int(s['force_dnstcp'] || 0);
					// const isGlue = int(s['is_glue'] || 0);
					const useIpv6 = int(s['use_ipv6'] || 0);
					const lookupHost = s['lookup_host'] || '_nolookup_';
					let command = [luci_helper];

					if (useIpv6 == 1) push(command, '-6');
					if (forceIpVersion == 1) push(command, '-f');
					if (forceDnsTcp == 1) push(command, '-t');
					// if (isGlue == 1) push(command, '-g');

					push(command, '-l', lookupHost);
					push(command, '-S', section);
					if (length(dnsServer) > 0) push(command, '-d', dnsServer);
					push(command, '-- get_registered_ip');

					const result = system(`${join(' ', command)}`);
				}

				lastUpdate = int(readfile(`${rundir}/${section}.update`) || 0);

				let pid = int(readfile(`${rundir}/${section}.pid`) || 0);

				// if killcmd succeeds (0) to re-nice the process, we do not assume the pid is dead
				if (pid > 0 && killcmd(pid)) {
					pid = 0;
				}

				let _uptime = int(uptime());

				const forcedUpdateInterval = calc_seconds(
					int(s['force_interval']) || 72,
					s['force_unit'] || 'hours'
				);

				const checkInterval = calc_seconds(
					int(s['check_interval']) || 10,
					s['check_unit'] || 'minutes'
				);

				let convertedLastUpdate;
				if (lastUpdate > 0) {
					const epoch = time() - _uptime + lastUpdate;
					convertedLastUpdate = epoch2date(epoch);
					// convertedLastUpdate = get_date(epoch, dateFormat);
					nextUpdate = epoch2date(epoch + forcedUpdateInterval + checkInterval);
					// nextUpdate = get_date(epoch + forcedUpdateInterval + checkInterval, dateFormat);
				}

				if (pid > 0 && (lastUpdate + forcedUpdateInterval + checkInterval - _uptime) <= 0) {
					nextUpdate = 'Verify';
				} else if (forcedUpdateInterval === 0) {
					nextUpdate = 'Run once';
				} else if (pid == 0 && s['enabled'] == '0') {
					nextUpdate = 'Disabled';
				} else if (pid == 0 && s['enabled'] != '0') {
					nextUpdate = 'Stopped';
				}

				res[section] = {
					ip: ip ? replace(ip, '\n', '') : null,
					last_update: lastUpdate !== 0 ? convertedLastUpdate : null,
					next_update: nextUpdate || null,
					pid: pid || null,
				};
			});

			uci.unload('ddns');
			return res;
		}
	},

	get_ddns_state: {
		call: function() {
			// const dateFormat = get_dateformat();

			const services_mtime = stat(ddns_package_path + '/list')?.mtime;
			// uci.unload('ddns');
			let res = {};
			let ver, control;

			if (stat(opkg_info_path + `/${srv_name}.control`)?.type == 'file') {
				control = readfile(opkg_info_path + `/${srv_name}.control`);
			}

			for (let line in split(control, '\n')) {
				ver = match(line, /^Version: (.+)$/)?.[1];
				if ( ver && length(ver) > 0 )
					break;
			}

			ver = ver || trimnonewline(popen(`${luci_helper} -V | awk {'print $2'}`, 'r')?.read?.('line'));

			res['_version'] = ver;
			res['_enabled'] = init_enabled('ddns');
			// res['_curr_dateformat'] = get_date(time(), dateFormat);
			res['_curr_dateformat'] = epoch2date(time());
			res['_services_list'] = (services_mtime && epoch2date(services_mtime)) || 'NO_LIST';

			uci.unload('ddns');
			return res;
		}
	},

	get_env: {
		call: function () {
			let res = {};
			let cache = {};

			const hasCommand = (command) => {
				if (system(`command -v ${command}`) == 0)
					return true;
				else
					return false;
			};

			const hasWget = () => hasCommand('wget');

			const hasWgetSsl = () => {
				if (cache['has_wgetssl']) return cache['has_wgetssl'];
				const result = hasWget() && system(`wget 2>&1 | grep -iqF 'https'`) == 0 ? true: false;
				cache['has_wgetssl'] = result;
				return result;
			};

			const hasGNUWgetSsl = () => {
				if (cache['has_gnuwgetssl']) return cache['has_gnuwgetssl'];
				const result = hasWget() && system(`wget -V 2>&1 | grep -iqF '+https'`) == 0 ? true: false;
				cache['has_gnuwgetssl'] = result;
				return result;
			};

			const hasCurl = () => {
				if (cache['has_curl']) return cache['has_curl'];
				const result = hasCommand('curl');
				cache['has_curl'] = result;
				return result;
			};

			const hasCurlSsl = () => {
				return system(`curl -V 2>&1 | grep -qF 'https'`) == 0 ? true: false;
			};

			const hasFetch = () => {
				if (cache['has_fetch']) return cache['has_fetch'];
				const result = hasCommand('uclient-fetch');
				cache['has_fetch'] = result;
				return result;
			};

			const hasFetchSsl = () => {
				return stat('/lib/libustream-ssl.so') == 0 ? true: false;
			};

			const hasCurlPxy = () => {
				return system(`grep -i 'all_proxy' /usr/lib/libcurl.so*`) == 0 ? true: false;
			};

			const hasBbwget = () => {
				return system(`wget -V 2>&1 | grep -iqF 'busybox'`) == 0 ? true: false;
			};


			res['has_wget'] = hasWget();
			res['has_curl'] = hasCurl();

			res['has_ssl'] = hasGNUWgetSsl()|| hasWgetSsl() || hasCurlSsl() || (hasFetch() && hasFetchSsl());
			res['has_proxy'] = hasGNUWgetSsl() || hasWgetSsl() || hasCurlPxy() || hasFetch() || hasBbwget();
			res['has_forceip'] = hasGNUWgetSsl() || hasWgetSsl() || hasCurl() || hasFetch();
			res['has_bindnet'] = hasCurl() || hasGNUWgetSsl();

			const hasBindHost = () => {
				if (cache['has_bindhost']) return cache['has_bindhost'];
				const commands = ['host', 'khost', 'drill'];
				for (let command in commands) {
					if (hasCommand(command)) {
						cache['has_bindhost'] = true;
						return true;
					}
				}

				cache['has_bindhost'] = false;
				return false;
			};

			res['has_bindhost'] = cache['has_bindhost'] || hasBindHost();

			const hasHostIp = () => {
				return hasCommand('hostip');
			};

			const hasNslookup = () => {
				return hasCommand('nslookup');
			};

			res['has_dnsserver'] = cache['has_bindhost'] || hasNslookup() || hasHostIp() || hasBindHost();

			const checkCerts = () => {
				let present = false;
				for (let cert in glob('/etc/ssl/certs/*.crt', '/etc/ssl/certs/*.pem')) {
					if (cert != null)
						present = true;
				}
				return present;
			};

			res['has_cacerts'] = checkCerts();

			res['has_ipv6'] = (stat('/proc/net/ipv6_route')?.type == 'file' && 
				(stat('/usr/sbin/ip6tables')?.type == 'file' || stat('/usr/sbin/nft')?.type == 'file'));

			return res;
		}
	}
};

return { 'luci.ddns': methods };
