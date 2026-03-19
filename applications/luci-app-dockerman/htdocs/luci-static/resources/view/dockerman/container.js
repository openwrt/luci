'use strict';
'require form';
'require fs';
'require poll';
'require uci';
'require ui';
'require dockerman.common as dm2';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
Based on Docker Lua by lisaac <https://github.com/lisaac/luci-app-dockerman>
LICENSE: GPLv2.0
*/

const dummy_stats = {"read":"2026-01-08T22:57:31.547920715Z","pids_stats":{"current":3},"networks":{"eth0":{"rx_bytes":5338,"rx_dropped":0,"rx_errors":0,"rx_packets":36,"tx_bytes":648,"tx_dropped":0,"tx_errors":0,"tx_packets":8},"eth5":{"rx_bytes":4641,"rx_dropped":0,"rx_errors":0,"rx_packets":26,"tx_bytes":690,"tx_dropped":0,"tx_errors":0,"tx_packets":9}},"memory_stats":{"stats":{"total_pgmajfault":0,"cache":0,"mapped_file":0,"total_inactive_file":0,"pgpgout":414,"rss":6537216,"total_mapped_file":0,"writeback":0,"unevictable":0,"pgpgin":477,"total_unevictable":0,"pgmajfault":0,"total_rss":6537216,"total_rss_huge":6291456,"total_writeback":0,"total_inactive_anon":0,"rss_huge":6291456,"hierarchical_memory_limit":67108864,"total_pgfault":964,"total_active_file":0,"active_anon":6537216,"total_active_anon":6537216,"total_pgpgout":414,"total_cache":0,"inactive_anon":0,"active_file":0,"pgfault":964,"inactive_file":0,"total_pgpgin":477},"max_usage":6651904,"usage":6537216,"failcnt":0,"limit":67108864},"blkio_stats":{},"cpu_stats":{"cpu_usage":{"percpu_usage":[8646879,24472255,36438778,30657443],"usage_in_usermode":50000000,"total_usage":100215355,"usage_in_kernelmode":30000000},"system_cpu_usage":739306590000000,"online_cpus":4,"throttling_data":{"periods":0,"throttled_periods":0,"throttled_time":0}},"precpu_stats":{"cpu_usage":{"percpu_usage":[8646879,24350896,36438778,30657443],"usage_in_usermode":50000000,"total_usage":100093996,"usage_in_kernelmode":30000000},"system_cpu_usage":9492140000000,"online_cpus":4,"throttling_data":{"periods":0,"throttled_periods":0,"throttled_time":0}}};
const dummy_ps = {"Titles":["UID","PID","PPID","C","STIME","TTY","TIME","CMD"],"Processes":[["root","13642","882","0","17:03","pts/0","00:00:00","/bin/bash"],["root","13735","13642","0","17:06","pts/0","00:00:00","sleep 10"]]};
const dummy_changes = [{"Path":"/dev","Kind":0},{"Path":"/dev/kmsg","Kind":1},{"Path":"/test","Kind":1}];

// https://docs.docker.com/reference/api/engine/version/v1.47/#tag/Container/operation/ContainerStats
// Helper function to calculate memory usage percentage
function calculateMemoryUsage(stats) {
	if (!stats || !stats.memory_stats) return null;
	const mem = stats.memory_stats;
	if (!mem.usage || !mem.limit) return null;

	// used_memory = memory_stats.usage - memory_stats.stats.cache
	const cache = mem.stats?.cache || 0;
	const used_memory = mem.usage - cache;
	const available_memory = mem.limit;

	// Memory usage % = (used_memory / available_memory) * 100.0
	const percentage = (used_memory / available_memory) * 100.0;

	return {
		percentage: percentage,
		used: used_memory,
		limit: available_memory
	};
}

// Helper function to calculate CPU usage percentage
// Pass previousStats if Docker API doesn't provide complete precpu_stats
function calculateCPUUsage(stats, previousStats) {
	if (!stats || !stats.cpu_stats) return null;
	const cpu = stats.cpu_stats;

	// Try to use precpu_stats from API first, fall back to our stored previous stats
	let precpu = stats.precpu_stats;

	// If precpu_stats is incomplete, use our manually stored previous stats
	if (!precpu || !precpu.system_cpu_usage) {
		if (previousStats && previousStats.cpu_stats) {
			// console.log('Using manually stored previous CPU stats');
			precpu = previousStats.cpu_stats;
		} else {
			// console.log('No previous CPU stats available yet - waiting for next cycle');
			return null;
		}
	}

	// If we don't have both cpu_stats and precpu_stats, return null
	if (!cpu.cpu_usage || !precpu || !precpu.cpu_usage) {
		// console.log('CPU stats incomplete:', { 
		// 	hasCpu: !!cpu.cpu_usage, 
		// 	hasPrecpu: !!precpu,
		// 	hasPrecpuUsage: !!(precpu && precpu.cpu_usage)
		// });
		return null;
	}

	// Validate we have the required fields
	const validationChecks = {
		'cpu.cpu_usage.total_usage': typeof cpu.cpu_usage.total_usage,
		'precpu.cpu_usage.total_usage': typeof precpu.cpu_usage.total_usage,
		'cpu.system_cpu_usage': typeof cpu.system_cpu_usage,
		'precpu.system_cpu_usage': typeof precpu.system_cpu_usage,
		'cpu_values': {
			cpu_total: cpu.cpu_usage.total_usage,
			precpu_total: precpu.cpu_usage.total_usage,
			cpu_system: cpu.system_cpu_usage,
			precpu_system: precpu.system_cpu_usage
		}
	};

	// Check if we have valid numeric values for all required fields
	// Note: precpu_stats may be empty/undefined on first stats call
	if (typeof cpu.cpu_usage.total_usage !== 'number' || 
		typeof precpu.cpu_usage.total_usage !== 'number' ||
		typeof cpu.system_cpu_usage !== 'number' ||
		typeof precpu.system_cpu_usage !== 'number') {
		// console.log('CPU stats incomplete - waiting for valid precpu data:', validationChecks);
		return null;
	}

	// Also check if precpu data is essentially zero (first call scenario)
	if (precpu.cpu_usage.total_usage === 0 || precpu.system_cpu_usage === 0) {
		// console.log('CPU precpu stats are zero - waiting for next stats cycle');
		return null;
	}

	// cpu_delta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage
	const cpu_delta = cpu.cpu_usage.total_usage - precpu.cpu_usage.total_usage;

	// system_cpu_delta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage
	const system_cpu_delta = cpu.system_cpu_usage - precpu.system_cpu_usage;

	// Validate deltas
	if (system_cpu_delta <= 0 || cpu_delta < 0) {
		// console.warn('Invalid CPU deltas:', { 
		// 	cpu_delta, 
		// 	system_cpu_delta,
		// 	cpu_total: cpu.cpu_usage.total_usage,
		// 	precpu_total: precpu.cpu_usage.total_usage,
		// 	system: cpu.system_cpu_usage,
		// 	presystem: precpu.system_cpu_usage
		// });
		return null;
	}

	// number_cpus = length(cpu_stats.cpu_usage.percpu_usage) or cpu_stats.online_cpus
	const number_cpus = cpu.online_cpus || (cpu.cpu_usage.percpu_usage?.length || 1);

	// CPU usage % = (cpu_delta / system_cpu_delta) * number_cpus * 100.0
	const percentage = (cpu_delta / system_cpu_delta) * number_cpus * 100.0;

	// console.log('CPU calculation:', { 
	// 	cpu_delta, 
	// 	system_cpu_delta, 
	// 	number_cpus, 
	// 	percentage: percentage.toFixed(2) + '%'
	// });

	return {
		percentage: percentage,
		number_cpus: number_cpus
	};
}

// Helper function to create a progress bar
function createProgressBar(label, percentage, used, total) {
	const clampedPercentage = Math.min(Math.max(percentage || 0, 0), 100);
	const color = clampedPercentage > 90 ? '#d9534f' : (clampedPercentage > 70 ? '#f0ad4e' : '#5cb85c');

	return E('div', { 'style': 'margin: 10px 0;' }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; margin-bottom: 5px;' }, [
			E('span', { 'style': 'font-weight: bold;' }, label),
			E('span', {}, used && total ? `${used} / ${total}` : `${clampedPercentage.toFixed(2)}%`)
		]),
		E('div', { 
			'style': 'width: 100%; height: 20px; background-color: #e9ecef; border-radius: 4px; overflow: hidden;'
		}, [
			E('div', {
				'style': `width: ${clampedPercentage}%; height: 100%; background-color: ${color}; transition: width 0.3s ease;`
			})
		])
	]);
}


const ChangeTypes = Object.freeze({
	0: 'Modified',
	1: 'Added',
	2: 'Deleted',
});

return dm2.dv.extend({
	load() {
		const requestPath = L.env.requestpath;
		const containerId = requestPath[requestPath.length-1] || '';
		this.psArgs = uci.get('dockerd', 'globals', 'ps_flags') || '-ww';

		// First load container info to check state
		return dm2.container_inspect({id: containerId})
			.then(container => {
				if (container.code !== 200) window.location.href = `${this.dockerman_url}/containers`;
				const this_container = container.body || {};

				// Now load other resources, conditionally calling stats/ps/changes only if running
				const isRunning = this_container.State?.Status === 'running';

				return Promise.all([
					this_container,
					dm2.image_list().then(images => {
						return Array.isArray(images.body) ? images.body : [];
					}),
					dm2.network_list().then(networks => {
						return Array.isArray(networks.body) ? networks.body : [];
					}),
					dm2.docker_info().then(info => {
						const numcpus = info.body?.NCPU || 1.0;
						const memory = info.body?.MemTotal || 2**10;
						return {numcpus: numcpus, memory: memory};
					}),
					isRunning ? dm2.container_top({ id: containerId, query: { 'ps_args': this.psArgs || '-ww' } })
						.then(res => {
							if (res?.code < 300 && res.body) return res.body;
							else return dummy_ps;
						})
						.catch(() => {}) : Promise.resolve(),
					isRunning ? dm2.container_stats({ id: containerId, query: { 'stream': false, 'one-shot': true } })
						.then(res => {
							if (res?.code < 300 && res.body) return res.body;
							else return dummy_stats;
						})
						.catch(() => {}) : Promise.resolve(),
					dm2.container_changes({ id: containerId })
						.then(res => {
							if (res?.code < 300 && Array.isArray(res.body)) return res.body;
							else return dummy_changes;
						})
						.catch(() => {}),
				]);
			});
	},

	buildList(array, mapper) {
		if (!Array.isArray(array)) return [];
		const out = [];
		for (const item of array) {
			const mapped = mapper(item);
			if (mapped || mapped === 0)
				out.push(mapped);
		}
		return out;
	},

	buildListFromObject(obj, mapper) {
		if (!obj || typeof obj !== 'object') return [];
		const out = [];
		for (const [k, v] of Object.entries(obj)) {
			const mapped = mapper(k, v);
			if (mapped || mapped === 0)
				out.push(mapped);
		}
		return out;
	},

	getMountsList(this_container) {
		return this.buildList(this_container?.Mounts, (mount) => {
			if (!mount?.Type || !mount?.Destination) return null;
			let entry = `${mount.Type}:${mount.Source}:${mount.Destination}`;
			if (mount.Mode) entry += `:${mount.Mode}`;
			return entry;
		});
	},

	getPortsList(this_container) {
		const portBindings = this_container?.HostConfig?.PortBindings;
		if (!portBindings || typeof portBindings !== 'object') return [];
		const ports = [];
		for (const [containerPort, bindings] of Object.entries(portBindings)) {
			if (Array.isArray(bindings) && bindings.length > 0 && bindings[0]?.HostPort) {
				ports.push(`${bindings[0].HostPort}:${containerPort}`);
			}
		}
		return ports;
	},

	getEnvList(this_container) {
		return this_container?.Config?.Env || [];
	},

	getDevicesList(this_container) {
		return this.buildList(this_container?.HostConfig?.Devices, (device) => {
			if (!device?.PathOnHost || !device?.PathInContainer) return null;
			let entry = `${device.PathOnHost}:${device.PathInContainer}`;
			if (device.CgroupPermissions) entry += `:${device.CgroupPermissions}`;
			return entry;
		});
	},

	getTmpfsList(this_container) {
		return this.buildListFromObject(this_container?.HostConfig?.Tmpfs, (path, opts) => `${path}${opts ? ':' + opts : ''}`);
	},

	getDnsList(this_container) {
		return this_container?.HostConfig?.Dns || [];
	},

	getSysctlList(this_container) {
		return this.buildListFromObject(this_container?.HostConfig?.Sysctls, (key, value) => `${key}:${value}`);
	},

	getCapAddList(this_container) {
		return this_container?.HostConfig?.CapAdd || [];
	},

	getLogOptList(this_container) {
		return this.buildListFromObject(this_container?.HostConfig?.LogConfig?.Config, (key, value) => `${key}=${value}`);
	},

	getCNetworksArray(c_networks, networks) {
		if (!c_networks || typeof c_networks !== 'object') return [];
		const data = [];

		for (const [name, net] of Object.entries(c_networks)) {
			const network = networks.find(n => n.Name === name || n.Id === name);
			const netid = !net?.NetworkID ? network?.Id : net?.NetworkID;

			/* Even if netid is null, proceed: perhaps the network was deleted. If we
			display it, the user can disconnect it. */
			data.push({
				...net,
				_shortId: netid?.substring(0,12) ||  '',
				Name: name,
				NetworkID: netid,
				DNSNames: net?.DNSNames || '',
				IPv4Address: net?.IPAMConfig?.IPv4Address || '',
				IPv6Address: net?.IPAMConfig?.IPv6Address || '',
			});
		}

		return data;
	},

	render([this_container, images, networks, cpus_mem, ps_top, stats_data, changes_data]) {
		const view = this;
		const containerName = this_container.Name?.substring(1) || this_container.Id || '';
		const containerIdShort = (this_container.Id || '').substring(0, 12);
		const c_networks = this_container.NetworkSettings?.Networks || {};

		// Create main container with action buttons
		const mainContainer = E('div', {});

		const containerStatus = this.getContainerStatus(this_container);

		// Add title and description
		const header = E('div', { 'class': 'cbi-page' }, [
			E('h2', {}, _('Docker - Container')),
			E('p', { 'style': 'margin: 10px 0; display: flex; gap: 6px; align-items: center;' }, [
				this.wrapStatusText(containerName, containerStatus, 'font-weight:600;'),
				E('span', { 'style': 'color:#666;' }, `(${containerIdShort})`)
			]),
			E('p', { 'style': 'color: #666;' }, _('Manage and view container configuration'))
		]);
		mainContainer.appendChild(header);

		// Add action buttons section
		const buttonSection = E('div', { 'class': 'cbi-section', 'style': 'margin-bottom: 20px;' });
		const buttonContainer = E('div', { 'style': 'display: flex; gap: 10px; flex-wrap: wrap;' });

		// Start button
		if (containerStatus !== 'running') {
			const startBtn = E('button', {
				'class': 'cbi-button cbi-button-apply',
				'click': (ev) => this.executeAction(ev, 'start', this_container.Id)
			}, [_('Start')]);
			buttonContainer.appendChild(startBtn);
		}

		// Restart button
		if (containerStatus === 'running') {
			const restartBtn = E('button', {
				'class': 'cbi-button cbi-button-reload',
				'click': (ev) => this.executeAction(ev, 'restart', this_container.Id)
			}, [_('Restart')]);
			buttonContainer.appendChild(restartBtn);
		}

		// Stop button
		if (containerStatus === 'running' || containerStatus === 'paused') {
			const stopBtn = E('button', {
				'class': 'cbi-button cbi-button-reset',
				'click': (ev) => this.executeAction(ev, 'stop', this_container.Id)
			}, [_('Stop')]);
			buttonContainer.appendChild(stopBtn);
		}

		// Kill button
		if (containerStatus === 'running') {
			const killBtn = E('button', {
				'class': 'cbi-button',
				'style': 'background-color: #dc3545;',
				'click': (ev) => this.executeAction(ev, 'kill', this_container.Id)
			}, [_('Kill')]);
			buttonContainer.appendChild(killBtn);
		}

		// Pause/Unpause button
		if (containerStatus === 'running' || containerStatus === 'paused') {
			const isPausedNow = this.container?.State?.Paused === true;
			const pauseBtn = E('button', {
				'class': 'cbi-button',
				'id': 'pause-button',
				'click': (ev) => {
					const currentStatus = this.getContainerStatus(this_container);
					this.executeAction(ev, (currentStatus === 'paused' ? 'unpause' : 'pause'), this_container.Id);
				}
			}, [isPausedNow ? _('Unpause') : _('Pause')]);
			buttonContainer.appendChild(pauseBtn);
		}

		// Duplicate button
		const duplicateBtn = E('button', {
			'class': 'cbi-button cbi-button-add',
			'click': (ev) => {
				ev.preventDefault();
				window.location.href = `${this.dockerman_url}/container_new/duplicate/${this_container.Id}`;
			}
		}, [_('Duplicate/Edit')]);
		buttonContainer.appendChild(duplicateBtn);

		// Export button
		const exportBtn = E('button', {
			'class': 'cbi-button cbi-button-reload',
			'click': (ev) => {
				ev.preventDefault();
				window.location.href = `${this.dockerman_url}/container/export/${this_container.Id}`;
			}
		}, [_('Export')]);
		buttonContainer.appendChild(exportBtn);

		// Remove button
		const removeBtn = E('button', {
			'class': 'cbi-button cbi-button-remove',
			'click': (ev) => this.executeAction(ev, 'remove', this_container.Id),
		}, [_('Remove')]);
		buttonContainer.appendChild(removeBtn);

		// Back button
		const backBtn = E('button', {
			'class': 'cbi-button',
			'click': () => window.location.href = `${this.dockerman_url}/containers`,
		}, [_('Back to Containers')]);
		buttonContainer.appendChild(backBtn);

		buttonSection.appendChild(buttonContainer);
		mainContainer.appendChild(buttonSection);


		const m = new form.JSONMap({
			cont: this_container,
			nets: this.getCNetworksArray(c_networks, networks),
			hostcfg: this_container.HostConfig || {},
		}, null);
		m.submit = false;
		m.reset = false;

		let s = m.section(form.NamedSection, 'cont', null, _('Container detail'));
		s.anonymous = true;
		s.nodescriptions = true;
		s.addremove = false;

		let o, ss;

		s.tab('info', _('Info'));

		o = s.taboption('info', form.Value, 'Name', _('Name'));

		o = s.taboption('info', form.DummyValue, 'Id', _('ID'));

		o = s.taboption('info', form.DummyValue, 'Image', _('Image'));
		o.cfgvalue = (sid) => this.getImageFirstTag(images, this.map.data.data[sid].Image);

		o = s.taboption('info', form.DummyValue, 'Image', _('Image ID'));

		o = s.taboption('info', form.DummyValue, 'status', _('Status'));
		o.cfgvalue = (sid) => this.map.data.data[sid].State?.Status || '';

		o = s.taboption('info', form.DummyValue, 'Created', _('Created'));

		o = s.taboption('info', form.DummyValue, 'started', _('Finish Time'));
		o.cfgvalue = () => {
			if (this_container.State?.Running)
				return this_container.State?.StartedAt || '-';
			return this_container.State?.FinishedAt || '-';
		};

		o = s.taboption('info', form.DummyValue, 'healthy', _('Health Status'));
		o.cfgvalue = () => this_container.State?.Health?.Status || '-';

		o = s.taboption('info', form.DummyValue, 'user', _('User'));
		o.cfgvalue = () => this_container.Config?.User || '-';

		o = s.taboption('info', form.ListValue, 'restart_policy', _('Restart Policy'));
		o.cfgvalue = () => this_container.HostConfig?.RestartPolicy?.Name || '-';
		o.value('no', _('No'));
		o.value('unless-stopped', _('Unless stopped'));
		o.value('always', _('Always'));
		o.value('on-failure', _('On failure'));

		o = s.taboption('info', form.DummyValue, 'hostname', _('Host Name'));
		o.cfgvalue = () => this_container.Config?.Hostname || '-';

		o = s.taboption('info', form.DummyValue, 'command', _('Command'));
		o.cfgvalue = () => {
			const cmd = this_container.Config?.Cmd;
			if (Array.isArray(cmd))
				return cmd.join(' ');
			return cmd || '-';
		};

		o = s.taboption('info', form.DummyValue, 'env', _('Env'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const env = this.getEnvList(this_container);
			return env.length > 0 ? env.join('<br />') : '-';
		};

		o = s.taboption('info', form.DummyValue, 'ports', _('Ports'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const ports = view.getPortsList(this_container);
			return ports.length > 0 ? ports.join('<br />') : '-';
		};

		o = s.taboption('info', form.DummyValue, 'links', _('Links'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const links = this_container.HostConfig?.Links;
			return Array.isArray(links) && links.length > 0 ? links.join('<br />') : '-';
		};

		o = s.taboption('info', form.DummyValue, 'devices', _('Devices'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const devices = this.getDevicesList(this_container);
			return devices.length > 0 ? devices.join('<br />') : '-';
		};

		o = s.taboption('info', form.DummyValue, 'tmpfs', _('Tmpfs Directories'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const tmpfs = this.getTmpfsList(this_container);
			return tmpfs.length > 0 ? tmpfs.join('<br />') : '-';
		};

		o = s.taboption('info', form.DummyValue, 'dns', _('DNS'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const dns = view.getDnsList(this_container);
			return dns.length > 0 ? dns.join('<br />') : '-';
		};

		o = s.taboption('info', form.DummyValue, 'sysctl', _('Sysctl Settings'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const sysctl = this.getSysctlList(this_container);
			return sysctl.length > 0 ? sysctl.join('<br />') : '-';
		};

		o = s.taboption('info', form.DummyValue, 'mounts', _('Mounts/Binds'));
		o.rawhtml = true;
		o.cfgvalue = () => {
			const mounts = view.getMountsList(this_container);
			return mounts.length > 0 ? mounts.join('<br />') : '-';
		};

		// NETWORKS TAB
		s.tab('network', _('Networks'));

		o = s.taboption('network', form.SectionValue, '__net__', form.TableSection, 'nets', null);
		ss = o.subsection;
		ss.anonymous = true;
		ss.nodescriptions = true;
		ss.addremove = true;
		ss.addbtntitle = _('Connect') + ' 🔗';
		ss.delbtntitle = _('Disconnect') + ' ⛓️‍💥';

		o = ss.option(form.DummyValue, 'Name', _('Name'));

		o = ss.option(form.DummyValue, '_shortId', _('ID'));
		o.cfgvalue = function(section_id, value) {
			const name_links = false;
			const nets = this.map.data.data[section_id] || {};
			return view.parseNetworkLinksForContainer(networks, (Array.isArray(nets) ? nets : [nets]), name_links);
		};

		o = ss.option(form.DummyValue, 'IPv4Address', _('IPv4 Address'));

		o = ss.option(form.DummyValue, 'IPv6Address', _('IPv6 Address'));

		o = ss.option(form.DummyValue, 'GlobalIPv6Address', _('Global IPv6 Address'));

		o = ss.option(form.DummyValue, 'MacAddress', _('MAC Address'));

		o = ss.option(form.DummyValue, 'Gateway', _('Gateway'));

		o = ss.option(form.DummyValue, 'IPv6Gateway', _('IPv6 Gateway'));

		o = ss.option(form.DummyValue, 'DNSNames', _('DNS Names'));

		ss.handleAdd = function(ev) {
			ev.preventDefault();
			view.executeNetworkAction('connect', null, null, this_container);
		};

		ss.handleRemove = function(section_id, ev) {
			const network = this.map.data.data[section_id];
			ev.preventDefault();
			delete this.map.data.data[section_id];
			this.super('handleRemove', [ev]);
			view.executeNetworkAction('disconnect', (network.NetworkID || network.Name), network.Name, this_container);
		};



		s.tab('resources', _('Resources'));

		o = s.taboption('resources', form.SectionValue, '__hcfg__', form.TypedSection, 'hostcfg', null);
		ss = o.subsection;
		ss.anonymous = true;
		ss.nodescriptions = false;
		ss.addremove = false;

		o = ss.option(form.Value, 'NanoCpus', _('CPUs'));
		o.cfgvalue = (sid) => view.map.data.data[sid].NanoCpus / (10**9);
		o.placeholder='1.5';
		o.datatype = 'ufloat';
		o.validate = function(section_id, value) {
			if (!value) return true;
			if (value > cpus_mem.numcpus) return _(`Only ${cpus_mem.numcpus} CPUs available`);
			return true;
		};

		o = ss.option(form.Value, 'CpuPeriod', _('CPU Period (microseconds)'));
		o.datatype = 'or(and(uinteger,min(1000),max(1000000)),"0")';

		o = ss.option(form.Value, 'CpuQuota', _('CPU Quota (microseconds)'));
		o.datatype = 'uinteger';

		o = ss.option(form.Value, 'CpuShares', _('CPU Shares Weight'));
		o.placeholder='1024';
		o.datatype = 'uinteger';

		o = ss.option(form.Value, 'Memory', _('Memory Limit'));
		o.cfgvalue = (sid, val) => {
			const mem = view.map.data.data[sid].Memory;
			return mem ? '%1024.2m'.format(mem) : 0;
		};
		o.write = function(sid, val) {
			if (!val || val == 0) return 0;
			this.map.data.data[sid].Memory = view.parseMemory(val);
			return view.parseMemory(val) || 0;
		};
		o.validate = function(sid, value) {
			if (!value) return true;
			if (value > view.memory) return _(`Only ${view.memory} bytes available`);
			return true;
		};

		o = ss.option(form.Value, 'MemorySwap', _('Memory + Swap'));
		o.cfgvalue = (sid, val) => {
			const swap = this.map.data.data[sid].MemorySwap;
			return swap ? '%1024.2m'.format(swap) : 0;
		};
		o.write = function(sid, val) {
			if (!val || val == 0) return 0;
			this.map.data.data[sid].MemorySwap = view.parseMemory(val);
			return view.parseMemory(val) || 0;
		};

		o = ss.option(form.Value, 'MemoryReservation', _('Memory Reservation'));
		o.cfgvalue = (sid, val) => {
			const res = this.map.data.data[sid].MemoryReservation;
			return res ? '%1024.2m'.format(res) : 0;
		};
		o.write = function(sid, val) {
			if (!val || val == 0) return 0;
			this.map.data.data[sid].MemoryReservation = view.parseMemory(val);
			return view.parseMemory(val) || 0;
		};

		o = ss.option(form.Flag, 'OomKillDisable', _('OOM Kill Disable'));

		o = ss.option(form.Value, 'BlkioWeight', _('Block IO Weight'));
		o.datatype = 'and(uinteger,min(0),max(1000)';

		o = ss.option(form.DummyValue, 'Privileged', _('Privileged Mode'));
		o.cfgvalue = (sid, val) => this.map.data.data[sid]?.Privileged ? _('Yes') : _('No');

		o = ss.option(form.DummyValue, 'CapAdd', _('Added Capabilities'));
		o.cfgvalue = (sid, val) => {
			const caps = this.map.data.data[sid]?.CapAdd;
			return Array.isArray(caps) && caps.length > 0 ? caps.join(', ') : '-';
		};

		o = ss.option(form.DummyValue, 'CapDrop', _('Dropped Capabilities'));
		o.cfgvalue = (sid, val) => {
			const caps = this.map.data.data[sid]?.CapDrop;
			return Array.isArray(caps) && caps.length > 0 ? caps.join(', ') : '-';
		};

		o = ss.option(form.DummyValue, 'LogDriver', _('Log Driver'));
		o.cfgvalue = (sid) => this.map.data.data[sid].LogConfig?.Type || '-';

		o = ss.option(form.DummyValue, 'log_opt', _('Log Options'));
		o.cfgvalue = () => {
			const opts = this.getLogOptList(this_container);
			return opts.length > 0 ? opts.join('<br />') : '-';
		};

		// STATS TAB
		s.tab('stats', _('Stats'));

		function updateStats(stats_data) {
			const status = view.getContainerStatus(this_container);

			if (status !== 'running') {
				// If we already have UI elements, clear/update them
				if (view.statsTable) {
					const progressBarsSection = document.getElementById('stats-progress-bars');
					if (progressBarsSection) {
						progressBarsSection.innerHTML = '';
						progressBarsSection.appendChild(E('p', {}, _('Container is not running') + ' (' + _('Status') + ': ' + status + ')'));
					}
					try { view.statsTable.update([]); } catch (e) {}
				}

				return E('div', { 'class': 'cbi-section' }, [
					E('p', {}, [
						_('Container is not running') + ' (' + _('Status') + ': ' + status + ')'
					])
				]);
			}

			const stats = stats_data || dummy_stats;

			// Calculate usage percentages
			const memUsage = calculateMemoryUsage(stats);
			const cpuUsage = calculateCPUUsage(stats, view.previousCpuStats);

			// Store current stats for next calculation
			view.previousCpuStats = stats;

			// Prepare rows
			const rows = [
				[_('PID Stats'), view.objectToText(stats.pids_stats)],
				[_('Net Stats'), view.objectToText(stats.networks)],
				[_('Mem Stats'), view.objectToText(stats.memory_stats)],
				[_('BlkIO Stats'), view.objectToText(stats.blkio_stats)],
				[_('CPU Stats'), view.objectToText(stats.cpu_stats)],
				[_('Per CPU Stats'), view.objectToText(stats.precpu_stats)]
			];

			// If table already exists (polling update), update in-place
			if (view.statsTable) {
				try {
					view.statsTable.update(rows);
				} catch (e) { console.error('Failed to update stats table', e); }

				// Update progress bars
				const progressBarsSection = document.getElementById('stats-progress-bars');
				if (progressBarsSection) {
					progressBarsSection.innerHTML = '';
					progressBarsSection.appendChild(E('h3', {}, _('Resource Usage')));
					progressBarsSection.appendChild(
						memUsage ? createProgressBar(
							_('Memory Usage'),
							memUsage.percentage,
							'%1024.2m'.format(memUsage.used),
							'%1024.2m'.format(memUsage.limit)
						) : E('div', {}, _('Memory usage data unavailable'))
					);
					progressBarsSection.appendChild(
						cpuUsage ? createProgressBar(
							_('CPU Usage') + ` (${cpuUsage.number_cpus} CPUs)`,
							cpuUsage.percentage,
							null,
							null
						) : E('div', {}, _('CPU usage data unavailable'))
					);
				}

				// Update raw JSON field
				const statsField = document.getElementById('raw-stats-field');
				if (statsField) statsField.textContent = JSON.stringify(stats, null, 2);

				return true;
			}

			// Create progress bars section (initial render)
			const progressBarsSection = E('div', { 
				'class': 'cbi-section',
				'id': 'stats-progress-bars',
				'style': 'margin-bottom: 20px;'
			}, [
				E('h3', {}, _('Resource Usage')),
				memUsage ? createProgressBar(
					_('Memory Usage'),
					memUsage.percentage,
					'%1024.2m'.format(memUsage.used),
					'%1024.2m'.format(memUsage.limit)
				) : E('div', {}, _('Memory usage data unavailable')),
				cpuUsage ? createProgressBar(
					_('CPU Usage') + ` (${cpuUsage.number_cpus} CPUs)`,
					cpuUsage.percentage,
					null,
					null
				) : E('div', {}, _('CPU usage data unavailable'))
			]);

			const statsTable = new L.ui.Table(
				[_('Metric'), _('Value')],
				{ id: 'stats-table' },
				E('em', [_('No statistics available')])
			);

			// Store table reference for poll updates
			view.statsTable = statsTable;

			// Initial data
			statsTable.update(rows);

			return E('div', { 'class': 'cbi-section' }, [
				progressBarsSection,
				statsTable.render(),
				E('h3', { 'style': 'margin-top: 20px;' }, _('Raw JSON')),
				E('pre', { 
					style: 'overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;', 
					id: 'raw-stats-field' 
				}, JSON.stringify(stats, null, 2))
			]);
		};

		// Create custom table for stats using L.ui.Table
		o = s.taboption('stats', form.DummyValue, '_stats_table', _('Container Statistics'));
		o.render = L.bind(() => { return updateStats(stats_data)}, this);

		// PROCESS TAB
		s.tab('ps', _('Processes'));

		// Create custom table for processes using L.ui.Table
		o = s.taboption('ps', form.DummyValue, '_ps_table', _('Running Processes'));
		o.render = L.bind(() => {
			const status = this.getContainerStatus(this_container);

			if (status !== 'running') {
				return E('div', { 'class': 'cbi-section' }, [
					E('p', {}, [
						_('Container is not running') + ' (' + _('Status') + ': ' + status + ')'
					])
				]);
			}

			// Use titles from the loaded data, or fallback to default
			const titles = (ps_top && ps_top.Titles) ? ps_top.Titles : 
				[_('PID'), _('USER'), _('VSZ'), _('STAT'), _('COMMAND')];

			// Store raw titles (without translation) for comparison in poll
			this.psTitles = titles;

			const psTable = new L.ui.Table(
				titles.map(t => _(t)),
				{ id: 'ps-table' },
				E('em', [_('No processes running')])
			);

			// Store table reference and titles for poll updates
			this.psTable = psTable;
			this.psTitles = titles;

			// Initial data from dummy_ps
			if (ps_top && ps_top.Processes) {
				psTable.update(ps_top.Processes);
			}

			return E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'margin-bottom: 10px;' }, [
					E('label', { 'for': 'ps-flags-input', 'style': 'margin-right: 8px;' }, _('ps flags:')),
					E('input', {
						id: 'ps-flags-input',
						'class': 'cbi-input-text',
						'type': 'text',
						'value': this.psArgs || '-ww',
						'placeholder': '-ww',
						'style': 'width: 200px;',
						'input': (ev) => { this.psArgs = ev.target.value || '-ww'; }
					})
				]),
				psTable.render(),
				E('h3', { 'style': 'margin-top: 20px;' }, _('Raw JSON')),
				E('pre', { 
					style: 'overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;', 
					id: 'raw-ps-field' 
				}, JSON.stringify(ps_top || dummy_ps, null, 2))
			]);
		}, this);

		// CHANGES TAB
		s.tab('changes', _('Changes'));

		// Create custom table for changes using L.ui.Table
		o = s.taboption('changes', form.DummyValue, '_changes_table', _('Filesystem Changes'));
		o.render = L.bind(() => {
			const changesTable = new L.ui.Table(
				[_('Kind'), _('Path')],
				{ id: 'changes-table' },
				E('em', [_('No filesystem changes detected')])
			);

			// Store table reference for poll updates
			this.changesTable = changesTable;

			// Initial data
			const rows = (changes_data || dummy_changes).map(change => [
				ChangeTypes[change?.Kind] || change?.Kind,
				change?.Path
			]);
			changesTable.update(rows);

			return E('div', { 'class': 'cbi-section' }, [
				changesTable.render(),
				E('h3', { 'style': 'margin-top: 20px;' }, _('Raw JSON')),
				E('pre', { 
					style: 'overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;', 
					id: 'raw-changes-field' 
				}, JSON.stringify(changes_data || dummy_changes, null, 2))
			]);
		}, this);



		// FILE TAB
		s.tab('file', _('File'));
		let fileDiv = null;

		o = s.taboption('file', form.DummyValue, 'json', '_file');
		o.cfgvalue = (sid, val) => '/';
		o.render = L.bind(() => {
			if (fileDiv) {
				return fileDiv;
			}

			fileDiv = E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'margin-bottom: 10px;' }, [
					E('label', { 'style': 'margin-right: 10px;' }, _('Path:')),
					E('input', {
						'type': 'text',
						'id': 'file-path',
						'class': 'cbi-input-text',
						'value': '/',
						'style': 'width: 200px;'
					}),
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'style': 'margin-left: 10px;',
						'click': () => this.handleFileUpload(this_container.Id),
					}, _('Upload') + ' ⬆️'),
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'style': 'margin-left: 5px;',
						'click': () => this.handleFileDownload(this_container.Id),
					}, _('Download') + ' ⬇️'),
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'style': 'margin-left: 5px;',
						'click': () => this.handleInfoArchive(this_container.Id),
					}, _('Inspect') + ' 🔎'),
				]),
				E('textarea', {
					'id': 'container-file-text',
					'readonly': true,
					'rows': '5',
					'style': 'width: 100%; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #ccc;'
				}, '')
			]);

			return fileDiv;
		}, this);


		// INSPECT TAB
		s.tab('inspect', _('Inspect'));
		let inspectDiv = null;

		o = s.taboption('inspect', form.Button, 'json', _('Container Inspect'));
		o.render = L.bind(() => {
			if (inspectDiv) {
				return inspectDiv;
			}

			inspectDiv = E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'margin-bottom: 10px;' }, [
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'style': 'margin-left: 5px;',
						'click': () => dm2.container_inspect({ id: this_container.Id }).then(response => {
							const output = document.getElementById('container-inspect-output');
							output.textContent = JSON.stringify(response.body, null, 2);
							return;
						}),
					}, _('Inspect') + ' 🔎'),
				]),
			]);

			return inspectDiv;
		}, this);

		o = s.taboption('inspect', form.DummyValue, 'json');
		o.cfgvalue = () => E('pre', { style: 'overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;',
			id: 'container-inspect-output' }, 
			JSON.stringify(this_container, null, 2));


		// TERMINAL TAB
		s.tab('console', _('Console'));

		o = s.taboption('console', form.DummyValue, 'console_controls', _('Console Connection'));
		o.render = L.bind(() => {
			const status = this.getContainerStatus(this_container);
			const isRunning = status === 'running';

			if (!isRunning) {
				return E('div', { 'class': 'alert-message warning' },
					_('Container is not running. Cannot connect to console.'));
			}

			const consoleDiv = E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'margin-bottom: 15px;' }, [
					E('label', { 'style': 'margin-right: 10px;' }, _('Command:')),
					E('span', { 'id': 'console-command-wrapper' }, [
						new ui.Combobox('/bin/sh', [
							'/bin/ash',
							'/bin/bash',
						], {id: 'console-command' }).render()
					]),
					E('label', { 'style': 'margin-right: 10px; margin-left: 20px;' }, _('User(-u)')),
					E('input', {
						'type': 'text',
						'id': 'console-uid',
						'class': 'cbi-input-text',
						'placeholder': 'e.g., root or user id',
						'style': 'width: 150px; margin-right: 10px;'
					}),
					E('label', { 'style': 'margin-right: 10px; margin-left: 20px;' }, _('Port:')),
					E('input', {
						'type': 'number',
						'id': 'console-port',
						'class': 'cbi-input-text',
						'value': '7682',
						'min': '1024',
						'max': '65535',
						'style': 'width: 100px; margin-right: 10px;'
					}),
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'id': 'console-connect-btn',
						'click': () => this.connectConsole(this_container.Id)
					}, _('Connect')),
				]),
				E('div', {
					'id': 'console-frame-container',
					'style': 'display: none; margin-top: 15px;'
				}, [
					E('div', { 'style': 'margin-bottom: 10px;' }, [
						E('button', {
							'class': 'cbi-button cbi-button-negative',
							'click': () => this.disconnectConsole()
						}, _('Disconnect')),
						E('span', {
							'id': 'console-status',
							'style': 'margin-left: 10px; font-style: italic;'
						}, _('Connected to container console'))
					]),
					E('iframe', {
						'id': 'ttyd-frame',
						'class': 'xterm',
						'src': '',
						'style': 'width: 100%; height: 600px; border: 1px solid #ccc; border-radius: 3px;'
					})
				])
			]);

			return consoleDiv;
		}, this);

		// WEBSOCKET TAB
		s.tab('wsconsole', _('WebSocket'));

		dm2.js_api_ready.then(([apiAvailable, host]) => {
			// Wait for JS API availability check to complete
			// Check if JS API is available
			if (!apiAvailable) {
				return;
			}

			o = s.taboption('wsconsole', form.DummyValue, 'wsconsole_controls', _('WebSocket Console'));
			o.render = L.bind(function() {
				const status = this.getContainerStatus();
				const isRunning = status === 'running';

				if (!isRunning) {
					return E('div', { 'class': 'alert-message warning' },
						_('Container is not running. Cannot connect to WebSocket console.'));
				}
				const wsDiv = E('div', { 'class': 'cbi-section' }, [
					E('div', { 'style': 'margin-bottom: 10px;' }, [
						E('label', { 'style': 'margin-right: 10px;' }, _('Streams:')),
						E('label', { 'style': 'margin-right: 6px;' }, [
							E('input', { 'type': 'checkbox', 'id': 'ws-stdin', 'checked': 'checked', 'style': 'margin-right: 4px;' }),
							_('Stdin')
						]),
						E('label', { 'style': 'margin-right: 6px;' }, [
							E('input', { 'type': 'checkbox', 'id': 'ws-stdout', 'checked': 'checked', 'style': 'margin-right: 4px;' }),
							_('Stdout')
						]),
						E('label', { 'style': 'margin-right: 6px;' }, [
							E('input', { 'type': 'checkbox', 'id': 'ws-stderr', 'style': 'margin-right: 4px;' }),
							_('Stderr')
						]),
						E('label', { 'style': 'margin-right: 6px;' }, [
							E('input', { 'type': 'checkbox', 'id': 'ws-logs', 'style': 'margin-right: 4px;' }),
							_('Include logs')
						]),
						E('button', {
							'class': 'cbi-button cbi-button-positive',
							'id': 'ws-connect-btn',
							'click': () => this.connectWebsocketConsole()
						}, _('Connect')),
						E('button', {
							'class': 'cbi-button cbi-button-neutral',
							'click': () => this.disconnectWebsocketConsole(),
							'style': 'margin-left: 6px;'
						}, _('Disconnect')),
						E('span', { 'id': 'ws-console-status', 'style': 'margin-left: 10px; color: #666;' }, _('Disconnected')),
					]),
					E('div', {
						'id': 'ws-console-output',
						'style': 'height: 320px; border: 1px solid #ccc; border-radius: 3px; padding: 8px; background:#111; color:#0f0; font-family: monospace; overflow: auto; white-space: pre-wrap;'
					}, ''),
					E('div', { 'style': 'margin-top: 10px; display: flex; gap: 6px;' }, [
						E('textarea', {
							'id': 'ws-console-input',
							'rows': '3',
							'placeholder': _('Type command here... (Ctrl+D to detach)'),
							'style': 'flex: 1; padding: 6px; font-family: monospace; resize: vertical;',
							'keydown': (ev) => {
								if (ev.key === 'Enter' && !ev.shiftKey) {
									ev.preventDefault();
									this.sendWebsocketInput();
								} else if (ev.key === 'd' && ev.ctrlKey) {
									ev.preventDefault();
									this.sendWebsocketDetach();
								}
							}
						}),
						E('button', {
							'class': 'cbi-button cbi-button-positive',
							'click': () => this.sendWebsocketInput()
						}, _('Send'))
					])
				]);

				return wsDiv;
			}, this);
		});

		// LOGS TAB
		s.tab('logs', _('Logs'));
		let logsDiv = null;
		let logsLoaded = false;

		o = s.taboption('logs', form.DummyValue, 'log_controls', _('Log Controls'));
		o.render = L.bind(() => {
			if (logsDiv) {
				return logsDiv;
			}

			logsDiv = E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'margin-bottom: 10px;' }, [
					E('label', { 'style': 'margin-right: 10px;' }, _('Lines to show:')),
					E('input', {
						'type': 'number',
						'id': 'log-lines',
						'class': 'cbi-input-text',
						'value': '100',
						'min': '1',
						'style': 'width: 80px;'
					}),
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'style': 'margin-left: 10px;',
						'click': () => this.loadLogs(this_container.Id)
					}, _('Load Logs')),
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'style': 'margin-left: 5px;',
						'click': () => this.clearLogs()
					}, _('Clear')),
				]),
				E('div', {
					'id': 'container-logs-text',
					'style': 'width: 100%; font-family: monospace; padding: 10px; border: 1px solid #ccc; overflow: auto;',
					'innerHTML': ''
				})
			]);

			return logsDiv;
		}, this);

		o = s.taboption('logs', form.DummyValue, 'log_display', _('Container Logs'));
		o.render = L.bind(() => {
			// Auto-load logs when tab is first accessed
			if (!logsLoaded) {
				logsLoaded = true;
				this.loadLogs();
			}
			return E('div');
		}, this);

		this.map = m;

		// Render the form and add buttons above it
		return m.render()
			.then(fe => {
				mainContainer.appendChild(fe);

				poll.add(L.bind(() => {
					if (this.getContainerStatus(this_container) !== 'running')
						return Promise.resolve();

					return dm2.container_changes({ id: this_container.Id })
						.then(L.bind(function(res) {
							if (res.code < 300 && Array.isArray(res.body)) {
								// Update changes table using L.ui.Table.update()
								if (this.changesTable) {
									const rows = res.body.map(change => change ? [
										ChangeTypes[change?.Kind] || change?.Kind,
										change?.Path
									] : []);
									this.changesTable.update(rows);
								}

								// Update the raw JSON field
								const changesField = document.getElementById('raw-changes-field');
								if (changesField) {
									changesField.textContent = JSON.stringify(res.body, null, 2);
								}
							}
						}, this))
						.catch(err => {
							console.error('Failed to poll container changes', err);
							return null;
						});
				}, this), 5);

				// Auto-refresh Stats table every 5 seconds (if container is running)
				poll.add(L.bind(() => {
					if (this.getContainerStatus(this_container) !== 'running')
						return Promise.resolve();

					return dm2.container_stats({ id: this_container.Id, query: { 'stream': false, 'one-shot': true } })
						.then(L.bind(function(res) {
							if (res.code < 300 && res.body) {
								return updateStats(res.body);
							}
						}, this))
						.catch(err => {
							console.error('Failed to poll container stats', err);
							return null;
						});
				}, this), 5);

				// Auto-refresh PS table every 5 seconds (if container is running)
				poll.add(L.bind(() => {
					if (this.getContainerStatus(this_container) !== 'running')
						return Promise.resolve();

					return dm2.container_top({ id: this_container.Id, query: { 'ps_args': this.psArgs || '-ww' } })
						.then(L.bind(function(res) {
							if (res.code < 300 && res.body && res.body.Processes) {
								// Check if titles changed - if so, rebuild the table
								if (res.body.Titles && JSON.stringify(res.body.Titles) !== JSON.stringify(this.psTitles)) {
									// Titles changed, need to recreate table
									this.psTitles = res.body.Titles;
									const psTableEl = document.getElementById('ps-table');
									if (psTableEl && psTableEl.parentNode) {
										const newTable = new L.ui.Table(
											res.body.Titles.map(t => _(t)),
											{ id: 'ps-table' },
											E('em', [_('No processes running')])
										);
										newTable.update(res.body.Processes);
										this.psTable = newTable;
										psTableEl.parentNode.replaceChild(newTable.render(), psTableEl);
									}
								} else if (this.psTable) {
									// Titles same, just update data
									this.psTable.update(res.body.Processes);
								}

								// Update raw JSON field
								const psField = document.getElementById('raw-ps-field');
								if (psField) {
									psField.textContent = JSON.stringify(res.body, null, 2);
								}
							}
						}, this))
						.catch(err => {
								console.error('Failed to poll container processes', err);
								return null;
							});
				}, this), 5);

				return mainContainer;
			});
	},

	handleSave(ev) {
		ev?.preventDefault();

		const map = this.map;
		if (!map)
			return Promise.reject(new Error(_('Form is not ready yet.')));

		// const listToKv = view.listToKv;

		const get = (opt) => map.data.get('json', 'cont', opt);
		// const getn = (opt) => map.data.get('json', 'nets', opt);
		const gethc = (opt) => map.data.get('json', 'hostcfg', opt);
		const toBool = (val) => (val === 1 || val === '1' || val === true);
		const toInt = (val) => val ? Number.parseInt(val) : undefined;
		// const toFloat = (val) => val ? Number.parseFloat(val) : undefined;

		// First: update properties
		map.parse()
			.then(() => {
				const this_container = map.data.get('json', 'cont');
				const id = this_container?.Id;
				/* In the container edit context, there are not many items we
				can change - duplicate the container */
				const createBody = {

					CpuShares: toInt(gethc('CpuShares')),
					Memory: toInt(gethc('Memory')),
					MemorySwap: toInt(gethc('MemorySwap')),
					MemoryReservation: toInt(gethc('MemoryReservation')),
					BlkioWeight: toInt(gethc('blkio_weight')),

					CpuPeriod: toInt(gethc('CpuPeriod')),
					CpuQuota: toInt(gethc('CpuQuota')),
					NanoCPUs: toInt(gethc('NanoCpus') * (10 ** 9)), // unit: 10^-9, input: float
					OomKillDisable: toBool(gethc('OomKillDisable')),

					RestartPolicy: { Name: get('restart_policy') || this_container.HostConfig?.RestartPolicy?.Name },

				};

				return { id, createBody };
			})
			.then(({ id, createBody }) => dm2.container_update({ id: id, body: createBody}))
			.then((response) => {
				if (response?.code >= 300) {
					ui.addTimeLimitedNotification(_('Container update failed'), [response?.body?.message || _('Unknown error')], 7000, 'warning');
					return false;
				}

				const msgTitle = _('Updated');
				if (response?.body?.Warnings)
					ui.addTimeLimitedNotification(msgTitle + _(' with warnings'), [response?.body?.Warnings], 5000);
				else
					ui.addTimeLimitedNotification(msgTitle, [ _('OK') ], 4000, 'info');

				if (get('Name') === null)
					setTimeout(() => window.location.href = `${this.dockerman_url}/containers`, 1000);

				return true;
			})
			.catch((err) => {
				ui.addTimeLimitedNotification(_('Container update failed'), [err?.message || err], 7000, 'warning');
				return false;
			});

		// Then: update name (separate operation)
		return map.parse()
			.then(() => {
				const this_container = map.data.get('json', 'cont');
				const name = this_container.Name || get('Name');
				const id = this_container.Id || get('Id');

				return { id, name };
			})
			.then(({ id, name }) => dm2.container_rename({ id: id, query: { name: name } }))
			.then((response) => {
				this.handleDockerResponse(response, _('Container rename'), {
					showOutput: false,
					showSuccess: false
				});

				return setTimeout(() => window.location.href = `${this.dockerman_url}/containers`, 1000);
			})
			.catch((err) => {
				this.showNotification(_('Container rename failed'), err?.message || String(err), 7000, 'error');
				return false;
			});
	},

	connectWebsocketConsole() {
		const connectBtn = document.getElementById('ws-connect-btn');
		const statusEl = document.getElementById('ws-console-status');
		const outputEl = document.getElementById('ws-console-output');
		const view = this;

		if (connectBtn) connectBtn.disabled = true;
		if (statusEl) statusEl.textContent = _('Connecting…');

		// Clear the output buffer when connecting anew
		if (outputEl) outputEl.innerHTML = '';

		// Initialize input buffer
		this.consoleInputBuffer = '';

		// Tear down any previous hijack or websocket without user-facing noise
		if (this.hijackController) {
			try { this.hijackController.abort(); } catch (e) {}
			this.hijackController = null;
		}
		if (this.consoleWs) {
			try {
				this.consoleWs.onclose = null;
				this.consoleWs.onerror = null;
				this.consoleWs.onmessage = null;
				this.consoleWs.close();
			} catch (e) {}
			this.consoleWs = null;
		}

		const stdin = document.getElementById('ws-stdin')?.checked ? '1' : '0';
		const stdout = document.getElementById('ws-stdout')?.checked ? '1' : '0';
		const stderr = document.getElementById('ws-stderr')?.checked ? '1' : '0';
		const logs = document.getElementById('ws-logs')?.checked ? '1' : '0';
		const stream = '1';

		const params = {
			stdin: stdin,
			stdout: stdout,
			stderr: stderr,
			logs: logs,
			stream: stream,
			detachKeys: 'ctrl-d',
		}

		dm2.container_attach_ws({ id: this.container.Id, query: params })
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Get the WebSocket connection
			const ws = response.ws || response.body;
			let opened = false;

			if (!ws || ws.readyState === undefined) {
				throw new Error('No WebSocket connection');
			}

			// Expect binary frames from Docker hijack; decode as UTF-8 text
			ws.binaryType = 'arraybuffer';

			// Set up WebSocket message handler
			ws.onmessage = (event) => {
				try {
					const renderAndAppend = (t) => {
						if (outputEl && t) {
							outputEl.innerHTML += dm2.ansiToHtml(t);
							outputEl.scrollTop = outputEl.scrollHeight;
						}
					};

					let text = '';
					const data = event.data;

					if (typeof data === 'string') {
						text = data;
					} else if (data instanceof ArrayBuffer) {
						text = new TextDecoder('utf-8').decode(new Uint8Array(data));
					} else if (data instanceof Blob) {
						// Fallback for Blob frames
						const reader = new FileReader();
						reader.onload = () => {
							const buf = reader.result;
							const t = new TextDecoder('utf-8').decode(new Uint8Array(buf));
							renderAndAppend(t);
						};
						reader.readAsArrayBuffer(data);
						return;
					}

					renderAndAppend(text);
				} catch (e) {
					console.error('Error processing message:', e);
				}
			};

			// Set up WebSocket error handler
			ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				if (statusEl) statusEl.textContent = _('Error');
				view.showNotification(_('Error'), _('WebSocket error'), 7000, 'error');
				if (ws === view.consoleWs) {
					view.consoleWs = null;
				}
			};

			// Set up WebSocket close handler
			ws.onclose = (evt) => {
				if (!opened) return; // Suppress close noise from previous/failed sockets
				if (statusEl) statusEl.textContent = _('Disconnected');
				if (connectBtn) connectBtn.disabled = false;
				if (ws === view.consoleWs) {
					view.consoleWs = null;
				}
				const code = evt?.code;
				const reason = evt?.reason;
				view.showNotification(_('Info'), _('Console connection closed') + (code ? ` (code: ${code}${reason ? ', ' + reason : ''})` : ''), 3000, 'info');
			};

			ws.onopen = () => {
				opened = true;
				if (statusEl) statusEl.textContent = _('Connected');
				if (connectBtn) connectBtn.disabled = false;
				view.showNotification(_('Success'), _('Console connected'), 3000, 'info');

				// Store WebSocket reference so it doesn't get garbage collected
				view.consoleWs = ws;
			};

			// If already open (promise resolved after onopen), set state immediately
			if (ws.readyState === WebSocket.OPEN) {
				opened = true;
				view.consoleWs = ws;
				if (statusEl) statusEl.textContent = _('Connected');
				if (connectBtn) connectBtn.disabled = false;
			}
		})
		.catch(err => {
			if (err.name === 'AbortError') {
				if (statusEl) statusEl.textContent = _('Disconnected');
			} else {
				if (statusEl) statusEl.textContent = _('Error');
				view.showNotification(_('Error'), err?.message || String(err), 7000, 'error');
			}
			if (connectBtn) connectBtn.disabled = false;
			view.hijackController = null;
		});
	},

	disconnectWebsocketConsole() {
		const statusEl = document.getElementById('ws-console-status');
		const connectBtn = document.getElementById('ws-connect-btn');

		if (this.hijackController) {
			this.hijackController.abort();
			this.hijackController = null;
		}

		if (statusEl) statusEl.textContent = _('Disconnected');
		if (connectBtn) connectBtn.disabled = false;
		this.showNotification(_('Info'), _('Console disconnected'), 3000, 'info');
	},

	sendWebsocketInput() {
		const inputEl = document.getElementById('ws-console-input');
		if (!inputEl) return;

		const text = inputEl.value || '';

		// Check if WebSocket is actually connected
		if (this.consoleWs && this.consoleWs.readyState === WebSocket.OPEN) {
			try {
				const payload = text.endsWith('\n') ? text : `${text}\n`;
				this.consoleWs.send(payload);
				inputEl.value = '';
			} catch (e) {
				console.error('Error sending:', e);
				this.showNotification(_('Error'), _('Failed to send data'), 5000, 'error');
			}
		} else {
			this.showNotification(_('Error'), _('Console is not connected'), 5000, 'error');
		}
	},

	sendWebsocketDetach() {
		// Send ctrl-d (ASCII 4, EOT) to detach
		if (this.consoleWs && this.consoleWs.readyState === WebSocket.OPEN) {
			try {
				this.consoleWs.send('\x04');
				this.showNotification(_('Info'), _('Detach signal sent (Ctrl+D)'), 3000, 'info');
			} catch (e) {
				console.error('Error sending detach:', e);
				this.showNotification(_('Error'), _('Failed to send detach signal'), 5000, 'error');
			}
		} else {
			this.showNotification(_('Error'), _('Console is not connected'), 5000, 'error');
		}
	},

	handleFileUpload(container_id) {
		const path = document.getElementById('file-path')?.value || '/';

		const q_params = { path: encodeURIComponent(path) };

		return this.super('handleXHRTransfer', [{
			q_params: { query: q_params },
			method: 'PUT',
			commandCPath: `/container/archive/put/${container_id}/`,
			commandDPath: `/containers/${container_id}/archive`,
			commandTitle: _('Uploading…'),
			commandMessage: _('Uploading file to container…'),
			successMessage: _('File uploaded to') + ': ' + path,
			pathElementId: 'file-path',
			defaultPath: '/'
		}]);
	},

	handleFileDownload(container_id) {
		const path = document.getElementById('file-path')?.value || '/';
		const view = this;

		if (!path || path === '') {
			this.showNotification(_('Error'), _('Please specify a path'), 5000, 'error');
			return;
		}

		// Direct HTTP download bypassing RPC buffering
		window.location.href = `${this.dockerman_url}/container/archive/get/${container_id}` + `/?path=${encodeURIComponent(path)}`;
		return;
	},

	handleInfoArchive(container_id) {
		const path = document.getElementById('file-path')?.value || '/';
		const fileTextarea = document.getElementById('container-file-text');

		if (!fileTextarea) return;

		return dm2.container_info_archive({ id: container_id, query: { path: path } })
			.then((response) => {
				if (response?.code >= 300) {
					fileTextarea.value = _('Path error') + '\n' + (response?.body?.message || _('Unknown error'));
					this.showNotification(_('Error'), [response?.body?.message || _('Path error')], 7000, 'error');
					return false;
				}

				// check response?.headers?.entries?.length in case fetch API is used 
				if (!response.headers || response?.headers?.entries?.length == 0) return true;

				let fileInfo;
				try {
					fileInfo = JSON.parse(atob(response?.headers?.get?.('x-docker-container-path-stat') || response?.headers?.['x-docker-container-path-stat']));
					fileTextarea.value = 
						`name: ${fileInfo?.name}\n` +
						`size: ${fileInfo?.size}\n` +
						`mode: ${this.modeToRwx(fileInfo?.mode)}\n` +
						`mtime: ${fileInfo?.mtime}\n` +
						`linkTarget: ${fileInfo?.linkTarget}\n`;
				} catch {
					this.showNotification(_('Missing header or CORS interfering'), ['X-Docker-Container-Path-Stat'], 5000, 'notice');
				}

				return true;
			})
			.catch((err) => {
				const errorMsg = err?.message || String(err) || _('Path error');
				fileTextarea.value = _('Path error') + '\n' + errorMsg;
				this.showNotification(_('Error'), [errorMsg], 7000, 'error');
				return false;
			});
	},

	loadLogs(container_id) {
		const lines = parseInt(document.getElementById('log-lines')?.value || '100');
		const logsDiv = document.getElementById('container-logs-text');

		if (!logsDiv) return;

		logsDiv.innerHTML = '<em style="color: #999;">' + _('Loading logs…') + '</em>';

		return dm2.container_logs({ id: container_id, query: { tail: lines, stdout: true, stderr: true } })
			.then((response) => {
				if (response?.code >= 300) {
					logsDiv.innerHTML = '<span style="color: #ff5555;">' + _('Error loading logs:') + '</span><br/>' + 
						(response?.body?.message || _('Unknown error'));
					this.showNotification(_('Error'), response?.body?.message || _('Failed to load logs'), 7000, 'error');
					return false;
				}

				const logText = response?.body || _('No logs available');
				// Convert ANSI codes to HTML and set innerHTML
				logsDiv.innerHTML = dm2.ansiToHtml(logText);
				logsDiv.scrollTop = logsDiv.scrollHeight;
				return true;
			})
			.catch((err) => {
				const errorMsg = err?.message || String(err) || _('Failed to load logs');
				logsDiv.innerHTML = '<span style="color: #ff5555;">' + _('Error loading logs:') + '</span><br/>' + errorMsg;
				this.showNotification(_('Error'), errorMsg, 7000, 'error');
				return false;
			});
	},

	clearLogs() {
		const logsDiv = document.getElementById('container-logs-text');
		if (logsDiv) {
			logsDiv.innerHTML = '';
		}
	},

	connectConsole(container_id) {
		const commandWrapper = document.getElementById('console-command');
		const selectedItem = commandWrapper?.querySelector('li[selected]');
		const command = selectedItem?.textContent?.trim() || '/bin/sh';
		const uid = document.getElementById('console-uid')?.value || '';
		const port = parseInt(document.getElementById('console-port')?.value || '7682');
		const view = this;

		const connectBtn = document.getElementById('console-connect-btn');
		if (connectBtn) connectBtn.disabled = true;

		// Call RPC to start ttyd
		return dm2.container_ttyd_start({
			id: container_id,
			cmd: command,
			port: port,
			uid: uid
		})
		.then((response) => {
			if (connectBtn) connectBtn.disabled = false;

			if (response?.code >= 300) {
				const errorMsg = response?.body?.error || response?.body?.message || _('Failed to start console');
				view.showNotification(_('Error'), errorMsg, 7000, 'error');
				return false;
			}

			// Show iframe and set source
			const frameContainer = document.getElementById('console-frame-container');
			if (frameContainer) {
				frameContainer.style.display = 'block';
				const ttydFrame = document.getElementById('ttyd-frame');
				if (ttydFrame) {
					// Wait for ttyd to fully start and be ready for connections
					// Use a retry pattern to handle timing variations
					const waitForTtydReady = (attempt = 0, maxAttempts = 5, initialDelay = 500) => {
						const delay = initialDelay + (attempt * 200); // Increase delay on retries

						setTimeout(() => {
							const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
							const ttydUrl = `${protocol}://${window.location.hostname}:${port}`;

							// Test connection with a simple HEAD request
							fetch(ttydUrl, { method: 'HEAD', mode: 'no-cors' })
								.then(() => {
									// Connection successful, load the iframe
									ttydFrame.src = ttydUrl;
								})
								.catch(() => {
									// Connection failed, retry if we haven't exceeded max attempts
									if (attempt < maxAttempts - 1) {
										waitForTtydReady(attempt + 1, maxAttempts, initialDelay);
									} else {
										// Max retries exceeded, load iframe anyway
										ttydFrame.src = ttydUrl;
										view.showNotification(_('Warning'), _('TTYd may still be starting up'), 5000, 'warning');
									}
								});
						}, delay);
					};

					waitForTtydReady();
				}
			}

			view.showNotification(_('Success'), _('Console connected'), 3000, 'info');
			return true;
		})
		.catch((err) => {
			if (connectBtn) connectBtn.disabled = false;
			const errorMsg = err?.message || String(err) || _('Failed to connect to console');
			view.showNotification(_('Error'), errorMsg, 7000, 'error');
			return false;
		});
	},

	disconnectConsole() {
		const frameContainer = document.getElementById('console-frame-container');
		if (frameContainer) {
			frameContainer.style.display = 'none';
			const ttydFrame = document.getElementById('ttyd-frame');
			if (ttydFrame) {
				ttydFrame.src = '';
			}
		}

		this.showNotification(_('Info'), _('Console disconnected'), 3000, 'info');
	},

	executeAction(ev, action, container_id) {
		ev?.preventDefault();

		const actionMap = Object.freeze({
			'start': _('Start'),
			'restart': _('Restart'),
			'stop': _('Stop'),
			'kill': _('Kill'),
			'pause': _('Pause'),
			'unpause': _('Unpause'),
			'remove': _('Remove'),
		});

		const actionLabel = actionMap[action] || action;

		// Confirm removal
		if (action === 'remove') {
			if (!confirm(_('Remove container?'))) {
				return;
			}
		}

		const view = this;
		const methodName = 'container_' + action;
		const method = dm2[methodName];

		if (!method) {
			view.showNotification(_('Error'), _('Action unavailable: ') + action, 7000, 'error');
			return;
		}

		view.executeDockerAction(
			method,
			{ id: container_id, query: {} },
			actionLabel,
			{
				showOutput: false,
				showSuccess: true,
				successMessage: actionLabel + _(' completed'),
				successDuration: 5000,
				onSuccess: () => {
					if (action === 'remove') {
						setTimeout(() => window.location.href = `${this.dockerman_url}/containers`, 1000);
					} else {
						setTimeout(() => location.reload(), 1000);
					}
				}
			}
		);
	},

	executeNetworkAction(action, networkID, networkName, this_container) {
		const view = this;

		if (action === 'disconnect') {
			if (!confirm(_('Disconnect network "%s" from container?').format(networkName))) {
				return;
			}

			view.executeDockerAction(
				dm2.network_disconnect,
				{
					id: networkID,
					body: { Container: view.containerId, Force: false }
				},
				_('Disconnect network'),
				{
					showOutput: false,
					showSuccess: true,
					successMessage: _('Network disconnected'),
					successDuration: 5000,
					onSuccess: () => {
						setTimeout(() => location.reload(), 1000);
					}
				}
			);
		} else if (action === 'connect') {
			const newNetworks = this.networks.filter(n => !Object.keys(this_container.NetworkSettings?.Networks || {}).includes(n.Name));

			if (newNetworks.length === 0) {
				view.showNotification(_('Info'), _('No additional networks available to connect'), 5000, 'info');
				return;
			}

			// Create modal dialog for selecting network
			const networkSelect = E('select', { 
				'id': 'network-select',
				'class': 'cbi-input-select',
				'style': 'width:100%; margin-top:10px;'
			}, newNetworks.map(n => {
				const subnet0 = n?.IPAM?.Config?.[0]?.Subnet;
				const subnet1 = n?.IPAM?.Config?.[1]?.Subnet;
				return E('option', { 'value': n.Id }, [`${n.Name}${n?.Driver ? ' | ' + n.Driver : ''}${subnet0 ? ' | ' + subnet0 : ''}${subnet1 ? ' | ' + subnet1 : ''}`]);
			}));

			const ip4Input = E('input', {
				'type': 'text',
				'id': 'network-ip',
				'class': 'cbi-input-text',
				'placeholder': 'e.g., 172.18.0.5',
				'style': 'width:100%; margin-top:5px;'
			});

			const ip6Input = E('input', {
				'type': 'text',
				'id': 'network-ip',
				'class': 'cbi-input-text',
				'placeholder': 'e.g., 2001:db8:1::1',
				'style': 'width:100%; margin-top:5px;'
			});

			const modalBody = E('div', { 'class': 'cbi-section' }, [
				E('p', {}, _('Select network to connect:')),
				networkSelect,
				E('label', { 'style': 'display:block; margin-top:10px;' }, _('IP Address (optional):')),
				ip4Input,
				ip6Input,
			]);

			ui.showModal(_('Connect Network'), [
				modalBody,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'click': ui.hideModal
					}, _('Cancel')),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'click': () => {
							const selectedNetwork = networkSelect.value;
							const ip4Address = ip4Input.value || '';
							// const ip6Address = ip6Input.value || '';

							if (!selectedNetwork) {
								view.showNotification(_('Error'), [_('No network selected')], 5000, 'error');
								return;
							}

							ui.hideModal();

							const body = { Container: view.containerId };
							body.EndpointConfig = { IPAMConfig: { IPv4Address: ip4Address } }; //, IPv6Address: ip6Address || null

							view.executeDockerAction(
								dm2.network_connect,
								{ id: selectedNetwork, body: body },
								_('Connect network'),
								{
									showOutput: false,
									showSuccess: true,
									successMessage: _('Network connected'),
									successDuration: 5000,
									onSuccess: () => {
										setTimeout(() => location.reload(), 1000);
									}
								}
							);
						}
					}, _('Connect'))
				])
			]);
		}
	},

	// handleSave: null,
	handleSaveApply: null,
	handleReset: null,

});
