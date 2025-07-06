'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require rpc';
'require view';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
LICENSE: GPLv2.0
*/

// docker df endpoint can take a while to resolve everything on *big* docker setups
// L.env.timeout = 40;

// Start docker API RPC methods

// If you define new declarations here, remember to export them at the bottom.
const container_changes = rpc.declare({
	object: 'docker.container',
	method: 'changes',
	params: { id: '' },
});

const container_create = rpc.declare({
	object: 'docker.container',
	method: 'create',
	params: { query: { }, body: { } },
});

/* We don't use rpcd for export functions, use controller instead
const container_export = rpc.declare({
	object: 'docker.container',
	method: 'export',
	params: { id: '' },
});
*/

const container_info_archive = rpc.declare({
	object: 'docker.container',
	method: 'info_archive',
	params: { id: '', query: { path: '/' } },
});

const container_inspect = rpc.declare({
	object: 'docker.container',
	method: 'inspect',
	params: { id: '', query: { } },
});

const container_kill = rpc.declare({
	object: 'docker.container',
	method: 'kill',
	params: { id: '', query: { } },
});

const container_list = rpc.declare({
	object: 'docker.container',
	method: 'list',
	params: { query: { } },
});

const container_logs = rpc.declare({
	object: 'docker.container',
	method: 'logs',
	params: { id: '', query: { } },
});

const container_pause = rpc.declare({
	object: 'docker.container',
	method: 'pause',
	params: { id: '' },
});

const container_prune = rpc.declare({
	object: 'docker.container',
	method: 'prune',
	params: { query: { } },
});

const container_remove = rpc.declare({
	object: 'docker.container',
	method: 'remove',
	params: { id: '', query: { } },
});

const container_rename = rpc.declare({
	object: 'docker.container',
	method: 'rename',
	params: { id: '', query: { } },
});

const container_restart = rpc.declare({
	object: 'docker.container',
	method: 'restart',
	params: { id: '', query: { } },
});

const container_start = rpc.declare({
	object: 'docker.container',
	method: 'start',
	params: { id: '', query: { } },
});

const container_stats = rpc.declare({
	object: 'docker.container',
	method: 'stats',
	params: { id: '', query: { 'stream': false, 'one-shot': true } },
});

const container_stop = rpc.declare({
	object: 'docker.container',
	method: 'stop',
	params: { id: '', query: { } },
});

const container_top = rpc.declare({
	object: 'docker.container',
	method: 'top',
	params: { id: '', query: { 'ps_args': '' } },
});

const container_unpause = rpc.declare({
	object: 'docker.container',
	method: 'unpause',
	params: { id: '' },
});

const container_update = rpc.declare({
	object: 'docker.container',
	method: 'update',
	params: { id: '', body: { } },
});

const container_ttyd_start = rpc.declare({
	object: 'docker.container',
	method: 'ttyd_start',
	params: { id: '', cmd: '/bin/sh', port: 7682, uid: '' },
});

// Data Usage
const docker_df = rpc.declare({
	object: 'docker',
	method: 'df',
});

const docker_events = rpc.declare({
	object: 'docker',
	method: 'events',
	params: { query: { since: '', until: '', filters: '' } }
});

const docker_info = rpc.declare({
	object: 'docker',
	method: 'info',
});

const docker_version = rpc.declare({
	object: 'docker',
	method: 'version',
});

/* We don't use rpcd for import/build functions, use controller instead
const image_build = rpc.declare({
	object: 'docker.image',
	method: 'build',
	params: { query: { }, headers: { } },
});
*/

const image_create = rpc.declare({
	object: 'docker.image',
	method: 'create',
	params: { query: { }, headers: { } },
});

/* We don't use rpcd for export functions, use controller instead
const image_get = rpc.declare({
	object: 'docker.image',
	method: 'get',
	params: { id: '', query: { } },
});
*/

const image_history = rpc.declare({
	object: 'docker.image',
	method: 'history',
	params: { id: '' },
});

const image_inspect = rpc.declare({
	object: 'docker.image',
	method: 'inspect',
	params: { id: '' },
});

const image_list = rpc.declare({
	object: 'docker.image',
	method: 'list',
});

const image_prune = rpc.declare({
	object: 'docker.image',
	method: 'prune',
	params: { query: { } },
});

const image_push = rpc.declare({
	object: 'docker.image',
	method: 'push',
	params: { name: '', query: { }, headers: { } },
});

const image_remove = rpc.declare({
	object: 'docker.image',
	method: 'remove',
	params: { id: '', query: { } },
});

const image_tag = rpc.declare({
	object: 'docker.image',
	method: 'tag',
	params: { id: '', query: { } },
});

const network_connect = rpc.declare({
	object: 'docker.network',
	method: 'connect',
	params: { id: '', body: {} },
});

const network_create = rpc.declare({
	object: 'docker.network',
	method: 'create',
	params: { body: {} },
});

const network_disconnect = rpc.declare({
	object: 'docker.network',
	method: 'disconnect',
	params: { id: '', body: {} },
});

const network_inspect = rpc.declare({
	object: 'docker.network',
	method: 'inspect',
	params: { id: '' },
});

const network_list = rpc.declare({
	object: 'docker.network',
	method: 'list',
});

const network_prune = rpc.declare({
	object: 'docker.network',
	method: 'prune',
	params: { query: { } },
});

const network_remove = rpc.declare({
	object: 'docker.network',
	method: 'remove',
	params: { id: '' },
});

const volume_create = rpc.declare({
	object: 'docker.volume',
	method: 'create',
	params: { opts: {} },
});

const volume_inspect = rpc.declare({
	object: 'docker.volume',
	method: 'inspect',
	params: { id: '' },
});

const volume_list = rpc.declare({
	object: 'docker.volume',
	method: 'list',
});

const volume_prune = rpc.declare({
	object: 'docker.volume',
	method: 'prune',
	params: { query: { } },
});

const volume_remove = rpc.declare({
	object: 'docker.volume',
	method: 'remove',
	params: { id: '', query: { } },
});

// End docker API RPC methods

const callMountPoints = rpc.declare({
	object: 'luci',
	method: 'getMountPoints',
	expect: { result: [] }
});


const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
});

// End generic API methods


const builder = Object.freeze({
	prune: {e: '✂️', i18n: _('prune')},
});


const container = Object.freeze({
	attach: {e: '🔌', i18n: _('attach')},
	commit: {e: '🎯', i18n: _('commit')},
	copy: {e: '📃➡️📃', i18n: _('copy')},
	create: {e: '➕', i18n: _('create')},
	destroy: {e: '💥', i18n: _('destroy')},
	detach: {e: '❌🔌', i18n: _('detach')},
	die: {e: '🪦', i18n: _('die')},
	exec_create: {e: '➕', i18n: _('exec_create')},
	exec_detach: {e: '❌🔌', i18n: _('exec_detach')},
	exec_start: {e: '▶️', i18n: _('exec_start')},
	exec_die: {e: '🪦', i18n: _('exec_die')},
	export: {e: '📤⬇️', i18n: _('export')},
	health_status: {e: '🩺⚕️', i18n: _('health_status')},
	kill: {e: '☠️', i18n: _('kill')},
	oom: {e: '0️⃣🧠', i18n: _('oom')},
	pause: {e: '⏸️', i18n: _('pause')},
	rename: {e: '✍️', i18n: _('rename')},
	resize: {e: '↔️', i18n: _('resize')},
	restart: {e: '🔄', i18n: _('restart')},
	start: {e: '▶️', i18n: _('start')},
	stop: {e: '⏹️', i18n: _('stop')},
	top: {e: '🔝', i18n: _('top')},
	unpause: {e: '⏯️', i18n: _('unpause')},
	update: {e: '✏️', i18n: _('update')},
	prune: {e: '✂️', i18n: _('prune')},
});


const daemon = Object.freeze({
	reload: {e: '🔄', i18n: _('reload')},
});


const image = Object.freeze({
	create: {e: '➕', i18n: _('create')},
	delete: {e: '❌', i18n: _('delete')},
	import: {e: '➡️', i18n: _('Import')},
	load: {e: '⬆️', i18n: _('load')},
	pull: {e: '☁️⬇️', i18n: _('Pull')},
	push: {e: '☁️⬆️', i18n: _('Push')},
	save: {e: '💾', i18n: _('save')},
	tag: {e: '🏷️', i18n: _('tag')},
	untag: {e: '❌🏷️', i18n: _('untag')},
	prune: {e: '✂️', i18n: _('prune')},
});


const network = Object.freeze({
	create: {e: '➕', i18n: _('create')},
	connect: {e: '🔗', i18n: _('connect')},
	disconnect: {e: '⛓️‍💥', i18n: _('disconnect')},
	destroy: {e: '💥', i18n: _('destroy')},
	update: {e: '✏️', i18n: _('update')},
	remove: {e: '❌', i18n: _('remove')},
	prune: {e: '✂️', i18n: _('prune')},
});


const volume = Object.freeze({
	create: {e: '➕', i18n: _('create')},
	mount: {e: '⬆️', i18n: _('mount')},
	unmount: {e: '⬇️', i18n: _('unmount')},
	destroy: {e: '💥', i18n: _('destroy')},
	prune: {e: '✂️', i18n: _('prune')},
});


const CURTypes = Object.freeze({
	create: {e: '➕', i18n: _('create')},
	update: {e: '✏️', i18n: _('update')},
	remove: {e: '❌', i18n: _('remove')},
});


const config = CURTypes;
const node = CURTypes;
const secret = CURTypes;
const service = CURTypes;


const Types = Object.freeze({
	builder: {e: '🛠️', i18n: _('builder'), sub: builder},
	config: {e: '⚙️', i18n: _('config'), sub: config},
	container: {e: '🐳', i18n: _('container'), sub: container},
	daemon: {e: '🔁', i18n: _('daemon'), sub: daemon},
	image: {e: '🌄', i18n: _('image'), sub: image},
	network: {e: '모', i18n: _('network'), sub: network },
	node: {e: '✳️', i18n: _('node'), sub: node },
	plugin: {e: '🔌', i18n: _('plugin') },
	secret: {e: '🔐', i18n: _('secret'), sub: secret },
	service: {e: '🛎️', i18n: _('service'), sub: service },
	volume: {e: '💿', i18n: _('volume'), sub: volume},
});


const ActionTypes = Object.freeze({
	build: {e: '🏗️', i18n: _('Build')},
	clean: {e: '🧹', i18n: _('Clean')},
	create: {e: '🪄➕', i18n: _('Create')},
	edit: {e: '✏️', i18n: _('Edit')},
	force_remove: {e: '❌', i18n: _('Force remove')},
	history: {e: '🪶📜', i18n: _('History')},
	inspect: {e: '🔎', i18n: _('Inspect') },
	remove: {e: '❌', i18n: _('Remove')},
	save: {e: '⬇️', i18n: _('Save locally')},
	upload: {e: '⬆️', i18n: _('Upload')},
	prune: {e: '✂️', i18n: _('Prune')},
});


const ignored_headers = ['cache-control', 'connection', 'content-length', 'content-type', 'pragma',
	'Components', 'Platform'];

const dv = view.extend({
	outputText: '', // Initialize output text

	get dockerman_url() {
		return L.url('admin/services/dockerman');
	},

	parseHeaders(headers, array) {
		for(const [k, v] of Object.entries(headers)) {
			if (ignored_headers.includes(k)) continue;
			array.push({entry: k, value: v});
		}
	},

	parseBody(body, array) {
		for(const [k, v] of Object.entries(body)) {
			if (ignored_headers.includes(k)) continue;
			if (!v) continue;
			array.push({entry: k, value: (typeof v !== 'string') ? JSON.stringify(v) : v});
		}
	},

	rwxToMode(val) {
		if (!val) return undefined;
		const raw = String(val).trim();
		if (/^[0-7]+$/.test(raw)) return parseInt(raw, 8);
		const normalized = raw.replace(/[^rwx-]/gi, '').padEnd(9, '-').slice(0, 9);
		const chunkToNum = (chunk) => (
			(chunk[0] === 'r' ? 4 : 0) +
			(chunk[1] === 'w' ? 2 : 0) +
			(chunk[2] === 'x' ? 1 : 0)
		);
		const owner = chunkToNum(normalized.slice(0, 3));
		const group = chunkToNum(normalized.slice(3, 6));
		const other = chunkToNum(normalized.slice(6, 9));
		return (owner << 6) + (group << 3) + other;
	},

	modeToRwx(mode) {
		const perms = mode & 0o777; // extract permission bits

		const toRwx = n => 
			((n & 4) ? 'r' : '-') +
			((n & 2) ? 'w' : '-') +
			((n & 1) ? 'x' : '-');

		const owner = toRwx((perms >> 6) & 0b111);
		const group = toRwx((perms >> 3) & 0b111);
		const world = toRwx(perms & 0b111);

		return `${owner}${group}${world}`;
	},

	parseMemory(value) {
		if (!value) return 0;
		const rex = /^([0-9.]+) *([bkmgt])?i? *[Bb]?/i;
		let [, amount, unit] = rex.exec(value.toLowerCase());
		amount = amount ? Number.parseFloat(amount) : 0;
		switch (unit) {
		default: break;
		case 'k': amount *= (2 ** 10); break;
		case 'm': amount *= (2 ** 20); break;
		case 'g': amount *= (2 ** 30); break;
		case 't': amount *= (2 ** 40); break;
		case 'p': amount *= (2 ** 50); break;
		}
		return amount;
	},

	listToKv: (list) => {
		const kv = {};
		const items = Array.isArray(list) ? list : (list != null ? [list] : []);
		items.forEach((entry) => {
			if (typeof entry !== 'string')
				return;

			const pos = entry.indexOf('=');
			if (pos <= 0)
				return;

			const key = entry.slice(0, pos);
			const val = entry.slice(pos + 1);
			if (key)
				kv[key] = val;
		});
		return kv;
	},

	objectToText(object) {
		let result = '';
		if (!object || typeof object !== 'object') return result;
		if (Object.keys(object).length === 0) return result;
		for (const [k, v] of Object.entries(object))
			result += `${!result ? '' : ', '}${k}: ${typeof v === 'object' ? this.objectToText(v) : v}`
		return result;
	},

	objectCfgValueTT(sid) {
		const val = this.data?.[sid] ?? this.map.data.get(this.map.config, sid, this.option);
		return (val != null && typeof val === 'object') ? dv.prototype.objectToText.call(dv.prototype, val) : val;
	},

	insertOutputFrame(s, m) {
		const frame = E('div', {
				'class': 'cbi-section'
			}, [
				E('h3', {}, _('Operational Output')),
				E('textarea', {
					'readonly': true,
					'rows': 30,
					'style': 'width: 100%; font-family: monospace;',
					'id': 'inspect-output-text'
				}, this.outputText)
			]);
		if (!m) return frame;
		// Output section, for inspect results
		s = m.section(form.NamedSection, null, 'inspect');
		s.anonymous = true;
		s.render = L.bind(() => {
			return frame;
		}, this);
	},

	insertOutput(text) {
		// send text to the output text-area and scroll to bottom
		this.outputText = text;
		const textarea = document.getElementById('inspect-output-text');
		if (textarea) {
			textarea.value = this.outputText;
			textarea.scrollTop = textarea.scrollHeight;
		}
	},

	buildTimeString(unixtime) {
		return new Date(unixtime * 1000).toLocaleDateString([], {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	},

	buildNetworkListValues(networks, option) {
		for (const network of networks) {
			let name = `${network?.Name}`;
			name += network?.Driver ? ` | ${network?.Driver}` : '';
			name += network?.IPAM?.Config?.[0] ? ` | ${network?.IPAM?.Config?.[0]?.Subnet}` : '';
			name += network?.IPAM?.Config?.[1] ? ` | ${network?.IPAM?.Config?.[1]?.Subnet}` : '';
			option.value(network?.Name, name);
		}
	},

	getContainerStatus(this_container) {
		if (!this_container?.State)
			return 'unknown';
		const state = this_container.State;
		if (state.Status === 'paused')
			return 'paused';
		else if (state.Running && !state.Restarting)
			return 'running';
		else if (state.Running && state.Restarting)
			return 'restarting';
		return 'stopped';
	},

	getImageFirstTag(image_list, image_id) {
		const imageArray = Array.isArray(image_list) ? image_list : [];
		const imageInfo = imageArray.find(img => img?.Id === image_id);
		const imageName = imageInfo && Array.isArray(imageInfo.RepoTags) 
			? imageInfo.RepoTags[0] 
			: 'unknown';
		return imageName;
	},

	parseNetworkLinksForContainer(networks, containerNetworks, name_links) {
		const links = [];

		if (!Array.isArray(containerNetworks)) {
			if (containerNetworks && typeof containerNetworks === 'object')
				containerNetworks = Object.values(containerNetworks);
		}

		for (const cNet of containerNetworks) {
			const network = networks.find(n => 
				n.Name === cNet.Name || 
				n.Id === cNet?.NetworkID ||
				n.Id === cNet.Name
			);

			if (network) {
				links.push(E('a', {
					href: `${this.dockerman_url}/network/${network.Id}`,
					title: network.Id,
					style: 'white-space: nowrap;'
				}, [name_links ? network.Name : network.Id.slice(0,12)]));
			}
		}

		if (!links.length)
			return '-';

		// Join with pipes
		const out = [];
		for (let i = 0; i < links.length; i++) {
			out.push(links[i]);
			if (i < links.length - 1)
				out.push(' | ');
		}

		return E('div', {}, out);
	},

	parseContainerLinksForNetwork(network, containers) {
		// Find all containers connected to this network
		const containerLinks = [];
		for (const cont of containers) {
			let isConnected = false;
			if (cont.NetworkSettings?.Networks?.[network?.Name]) {
				isConnected = true;
			}
			else
			if (cont.NetworkSettings?.Networks?.[network?.Id]) {
				isConnected = true;
			}

			if (isConnected) {
				const containerName = cont.Names?.[0]?.replace(/^\//, '') || cont.Id?.substring(0, 12);
				const containerId = cont.Id;

				containerLinks.push(E('a', {
					href: `${this.dockerman_url}/container/${containerId}`,
					title: containerId,
					style: 'white-space: nowrap;'
				}, [containerName]));
			}
		}

		if (!containerLinks.length)
			return '-';

		// Join with pipes
		const out = [];
		for (let i = 0; i < containerLinks.length; i++) {
			out.push(containerLinks[i]);
			if (i < containerLinks.length - 1)
				out.push(' | ');
		}

		return E('div', {}, out);
	},

	statusColor(status) {
		const s = (status || '').toLowerCase();
		if (s === 'running') return '#2ecc71'; // green
		if (s === 'paused') return '#f39c12'; // orange
		if (s === 'restarting') return '#f39c12'; // orange
		return '#d9534f'; // red for stopped/other
	},

	wrapStatusText(text, status, extraStyle = '') {
		const color = this.statusColor(status);
		return E('span', { style: `color:${color};${extraStyle || ''}` }, [text]);
	},

	/**
	 * Show a notification to the user with standardized formatting
	 * @param {string} title - The title of the notification (will be translated if needed)
	 * @param {string|Array<string>} message - Message(s) to display
	 * @param {number} [duration=5000] - Duration in milliseconds
	 * @param {string} [type='info'] - Type: 'success', 'info', 'warning', 'error'
	 */
	showNotification(title, message, duration = 5000, type = 'info') {
		const messages = Array.isArray(message) ? message : [message];
		ui.addTimeLimitedNotification(title, messages, duration, type);
	},

	/**
	 * Normalize a registry host address by stripping scheme and path
	 * @param {string} address - The registry address to normalize
	 * @returns {string|null} - Normalized hostname or null
	 */
	normalizeRegistryHost(address) {
		if (!address) return null;

		let addr = String(address).trim();
		// make exception for legacy Docker Hub registry https://index.docker.io/v1/
		if (addr.includes('index.docker.io'))
			return addr.toLowerCase();
		else {
			addr = addr.replace(/^[a-z]+:\/\//i, '');
			addr = addr.split('/')[0];
			addr = addr.replace(/\/$/, '');
		}
		if (!addr) return null;
		return addr.toLowerCase();
	},

	/**
	 * Ensure registry address has https:// scheme
	 * @param {string} address - The registry address
	 * @param {string} hostFallback - Fallback host if address is empty
	 * @returns {string|null} - Address with scheme or null
	 */
	ensureRegistryScheme(address, hostFallback) {
		const addr = String(address || '').trim() || hostFallback;
		if (!addr) return null;
		return /^https?:\/\//i.test(addr) ? addr : `https://${addr}`;
	},

	/**
	 * Encode auth object to base64
	 * @param {Object} obj - Object with username, password, serveraddress
	 * @returns {string|null} - Base64 encoded JSON or null on failure
	 */
	encodeBase64Json(obj) {
		const json = JSON.stringify(obj);
		try {
			return btoa(json);
		} catch (err) {
			try {
				return btoa(unescape(encodeURIComponent(json)));
			} catch (err2) {
				console.warn('Failed to encode registry auth', err2?.message || err2);
				return null;
			}
		}
	},

	/**
	 * Extract registry host from image tag
	 * @param {string} tag - The image tag
	 * @returns {string|null} - Registry hostname or null
	 */
	extractRegistryHostFromImage(tag) {
		if (!tag) return null;

		let ref = String(tag).trim();
		ref = ref.replace(/^[a-z]+:\/\//i, '');

		const slashIdx = ref.indexOf('/');
		const candidate = slashIdx === -1 ? ref : ref.slice(0, slashIdx);
		if (!candidate) return null;

		const hasDot = candidate.includes('.');
		const hasPort = /:[0-9]+$/.test(candidate);
		const isLocal = candidate === 'localhost' || candidate.startsWith('localhost:');
		if (!hasDot && !hasPort && !isLocal) return null;

		return candidate.toLowerCase();
	},

	/**
	 * Resolve registry credentials and build auth header
	 * @param {string} imageRef - The image reference
	 * @param {Map} registryAuthMap - Map of registry host to credentials
	 * @returns {string|null} - Base64 encoded auth string or null
	 */
	resolveRegistryAuth(imageRef, registryAuthMap) {
		const host = this.extractRegistryHostFromImage(imageRef);
		if (!host) return null;

		const creds = registryAuthMap.get(host);
		if (!creds?.username || !creds?.password) return null;

		return this.encodeBase64Json({
			username: creds.username,
			password: creds.password,
			serveraddress: this.ensureRegistryScheme(creds.serveraddress, host)
		});
	},

	/**
	 * Load registry auth credentials from UCI config
	 * @returns {Promise<Map>} - Promise resolving to Map of registry host to credentials
	 */
	loadRegistryAuthMap() {
		return new Promise((resolve) => {
			// Load UCI and extract auth sections
			const authMap = new Map();
			L.resolveDefault(uci.load('dockerd'), {}).then(() => {
				uci.sections('dockerd', 'auth', (section) => {
					const serverRaw = section?.serveraddress;
					const host = this.normalizeRegistryHost(serverRaw);
					if (!host) return;

					const username = section?.username || section?.user;
					const password = section?.token || section?.password;
					if (!username || !password) return;

					authMap.set(host, {
						username,
						password,
						serveraddress: serverRaw || host,
					});
				});
				resolve(authMap);
			}).catch(() => {
				// If loading fails, return empty map
				resolve(authMap);
			});
		});
	},

	/**
	 * Handle Docker API response with unified error checking and user feedback
	 * @param {Object} response - The Docker API response object
	 * @param {string} actionName - Name of the action (e.g., 'Start', 'Remove')
	 * @param {Object} [options={}] - Optional configuration
	 * @param {boolean} [options.showOutput=true] - Whether to insert JSON output
	 * @param {boolean} [options.showSuccess=true] - Whether to show success notification
	 * @param {string} [options.successMessage] - Custom success message
	 * @param {number} [options.successDuration=4000] - Success notification duration
	 * @param {number} [options.errorDuration=7000] - Error notification duration
	 * @param {Function} [options.onSuccess] - Callback on success
	 * @param {Function} [options.onError] - Callback on error
	 * @param {Object} [options.specialCases] - Map of status codes to handlers {304: {message: '...', type: 'notice'}}
	 * @returns {boolean} - true if successful, false otherwise
	 */
	handleDockerResponse(response, actionName, options = {}) {
		const {
			showOutput = true,
			showSuccess = true,
			successMessage = _('OK'),
			successDuration = 4000,
			errorDuration = 7000,
			onSuccess = null,
			onError = null,
			specialCases = {}
		} = options;

		// Handle special status codes first (e.g., 304 Not Modified)
		if (specialCases[response?.code]) {
			const special = specialCases[response.code];
			this.showNotification(
				actionName,
				special.message || _('No changes needed'),
				special.duration || 5000,
				special.type || 'notice'
			);
			if (onSuccess) onSuccess(response);
			return true;
		}

		// Insert output if requested
		if (showOutput && response?.body != null) {
			const outputText = response?.body !== "" 
				? (Array.isArray(response.body) || typeof response.body === 'object' 
					? JSON.stringify(response.body, null, 2) + '\n' 
					: String(response.body) + '\n')
				: `${response?.code} ${_('OK')}\n`;
			this.insertOutput(outputText);
		}

		// Check for errors (HTTP status >= 304)
		if (response?.code >= 304) {
			this.showNotification(
				actionName,
				response?.body?.message || _('Operation failed'),
				errorDuration,
				'warning'
			);
			if (onError) onError(response);
			return false;
		}

		// Success case
		if (showSuccess) {
			this.showNotification(actionName, successMessage, successDuration, 'success');
		}
		if (onSuccess) onSuccess(response);
		return true;
	},

	async getRegistryAuth(params, actionName) {
		// Extract registry candidate from params
		let registryCandidate = null;
		if (params?.query?.fromImage) {
			registryCandidate = params.query.fromImage;
		} else if (params?.query?.tag) {
			registryCandidate = params.query.tag;
		}

		if (params?.name && actionName === Types['image'].sub['push'].i18n) {
			registryCandidate = params.name;
		}

		// Try to load and inject registry auth if we have a registry candidate
		if (registryCandidate) {
			try {
				const authMap = await this.loadRegistryAuthMap();
				const auth = this.resolveRegistryAuth(registryCandidate, authMap);
				if (auth) {
					if (!params.headers) {
						params.headers = {};
					}
					params.headers['X-Registry-Auth'] = auth;
				}
			} catch (err) {
				// If auth loading fails, proceed without auth
			}
		}

		return params;
	},

	/**
	 * Execute a Docker API action with consistent error handling and user feedback
	 * Automatically adds X-Registry-Auth header for push/pull operations if credentials exist
	 * @param {Function} apiMethod - The Docker API method to call
	 * @param {Object} params - Parameters to pass to the API method
	 * @param {string} actionName - Display name for the action
	 * @param {Object} [options={}] - Options for handleDockerResponse
	 * @returns {Promise<boolean>} - Promise that resolves to true/false based on success
	 */
	async executeDockerAction(apiMethod, params, actionName, options = {}) {
		try {
			params = await this.getRegistryAuth(params, actionName);

			// Execute the API call
			const response = await apiMethod(params);
			return this.handleDockerResponse(response, actionName, options);

		} catch (err) {
			this.showNotification(
				actionName,
				err?.message || String(err) || _('Unexpected error'),
				options.errorDuration || 7000,
				'error'
			);
			if (options.onError) options.onError(err);
			return false;
		}
	},

	/**
	 * Flexible file/URI transfer with progress tracking and API preference
	 * @param {Object} options - Upload configuration
	 * @param {string} [options.method] - method to use: POST, PUT, etc
	 * @param {string} [options.commandCPath] - controller API endpoint path (e.g. '/images/load')
	 * @param {string} [options.commandDPath] - docker API endpoint path (e.g. '/images/load')
	 * @param {string} [options.commandTitle] - Title for the command modal
	 * @param {string} [options.commandMessage] - Message shown during command
	 * @param {string} [options.successMessage] - Message on successful command
	 * @param {string} [options.pathElementId] - Optional ID of element containing command path
	 * @param {string} [options.defaultPath='/'] - Default path if pathElementId is not provided
	 * @param {Function} [options.getFormData] - Optional function to customize FormData (receives file, path)
	 * @param {Function} [options.onUpdate] - Optional function to report status progress fed back
	 * @param {boolean} [options.noFileUpload] - If true, only a URI is uploaded (no file)
	 */
	async handleXHRTransfer(options = {}) {
		const {
			q_params = {},
			method = 'POST',
			commandCPath = null,
			commandDPath = null,
			commandTitle = null, //_('Uploading…'),
			commandMessage = null, //_('Uploading file…'),
			successMessage = _('Successful'),
			showProgress = true,
			pathElementId = null,
			defaultPath = '/',
			getFormData = null,
			onUpdate = null,
			noFileUpload = false,
		} = options;

		const view = this;
		let commandPath = defaultPath;
		let params = await this.getRegistryAuth(q_params, commandTitle);

		// Get path from element if specified
		if (pathElementId) {
			commandPath = document.getElementById(pathElementId)?.value || defaultPath;
			if (!commandPath || commandPath === '') {
				this.showNotification(_('Error'), _('Please specify a path'), 5000, 'error');
				return;
			}
		}

		// Build query string if params provided
		let query_str = '';
		if (params.query) {
			let parts = [];
			for (let [key, value] of Object.entries(params.query)) {
				if (key != null && value != '') {
					if (Array.isArray(value)) {
						value.map(e => parts.push(`${key}=${e}`));
						continue;
					}
					parts.push(`${key}=${value}`);
				}
			}
			if (parts.length)
				query_str = '?' + parts.join('&');
		}

		// Prefer JS API if available, else fallback to controller
		let destUrl = `${this.dockerman_url}${commandCPath}${query_str}`;
		let useRawFile = false;

		// Show progress dialog with progress bar element
		let progressBar = E('div', { 
			'style': 'width:0%; background-color: #0066cc; height: 20px; border-radius: 3px; transition: width 0.3s ease;' 
		});
		let msgTxt = E('p', {}, commandMessage);
		let msgTitle = E('h4', {}, commandTitle);
		let progressText = E('p', {}, '0%');

		if (showProgress) {
			ui.showModal(msgTitle, [
				msgTxt,
				progressText,
				E('div', { 
					'class': 'cbi-progressbar', 
					'style': 'margin: 10px 0; background-color: #e0e0e0; border-radius: 3px; overflow: hidden;' 
				}, progressBar)
			]);
		}

		const xhr = new XMLHttpRequest();
		xhr.timeout = 0;

		// Track upload progress
		xhr.upload.addEventListener('progress', (e) => {
			if (e.lengthComputable) {
				const percentComplete = Math.round((e.loaded / e.total) * 100);
				progressBar.style.width = percentComplete + '%';
				progressText.textContent = percentComplete + '%';
			}
		});

		// Track progressive response progress
		let lastIndex = 0;
		let title = _('Progress');
		xhr.onprogress = (upd) => {
			const chunk = xhr.responseText.slice(lastIndex);
			lastIndex = xhr.responseText.length;
			const lines = chunk.split('\n').filter(Boolean);
			for (const line of lines) {
				try {
					const msg = JSON.parse(line);
					const percentComplete = Math.round((msg?.progressDetail?.current / msg?.progressDetail?.total) * 100) || 0;
					if (msg.stream && msg.stream != '\n')
						msgTxt.innerHTML = ansiToHtml(msg?.stream);
					if (msg.status)
						msgTitle.innerHTML = msg?.status
					progressBar.style.width = percentComplete + '%';
					progressText.textContent = percentComplete + '%';
					if (onUpdate) onUpdate(msg);
				} catch (e) {}
			}
		};

		xhr.addEventListener('load', () => {
			ui.hideModal();
			if (xhr.status >= 200 && xhr.status < 300) {
				view.showNotification(
					_('Command successful'),
					successMessage,
					4000,
					'success'
				);
			} else {
				let errorMsg = xhr.responseText || `HTTP ${xhr.status}`;
				try {
					const json = JSON.parse(xhr.responseText);
					errorMsg = json.error || errorMsg;
				} catch (e) {}
				view.showNotification(
					_('Command failed'),
					errorMsg,
					7000,
					'error'
				);
			}
		});

		xhr.addEventListener('error', () => {
			ui.hideModal();
			view.showNotification(
				_('Command failed'),
				_('Network error'),
				7000,
				'error'
			);
		});

		xhr.addEventListener('abort', () => {
			ui.hideModal();
			view.showNotification(
				_('Command cancelled'),
				'',
				5000,
				'warning'
			);
		});

		if (noFileUpload) {
			this.handleURLOnlyForm(xhr, method, params, destUrl);
		} else {
			this.handleFileUploadForm(xhr, method, getFormData, destUrl, commandPath, useRawFile);
		}
	},


	handleURLOnlyForm(xhr, method, params, destUrl) {
		const formData = new FormData();
		formData.append('token', L.env.token);
		// if (params.name)
		// 	formData.append('name', params.name);

		xhr.open(method, destUrl);
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		if (params.headers)
			for (let [hdr_name, hdr_value] of Object.entries(params.headers)) {
				xhr.setRequestHeader(hdr_name, hdr_value);
				// smuggle in the X-Registry-Auth header in the form data
				formData.append(hdr_name, hdr_value);
			}
		destUrl.includes(L.env.scriptname) ? xhr.send(formData) : xhr.send();
	},


	handleFileUploadForm(xhr, method, getFormData, destUrl, commandPath, useRawFile) {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.style.display = 'none';

		fileInput.onchange = (ev) => {
			const files = ev.target?.files;
			if (!files || files.length === 0) {
				ui.hideModal();
				return;
			}
			const file = files[0];

			// Create FormData with file
			let formData;
			if (getFormData) {
				formData = getFormData(file, commandPath);
			} else {
				formData = new FormData();
				/* 'token' is necessary when "post": true is defined for image load endpoint */
				formData.append('token', L.env.token);
				formData.append('upload-name', file.name);
				formData.append('upload-archive', file);
			}

			xhr.open(method, destUrl);
			xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
			
			if (useRawFile) {
				xhr.setRequestHeader('Content-Type', 'application/x-tar');
				xhr.send(file);
			} else {
				xhr.send(formData);
			}
		};

		fileInput.oncancel = (ev) => {
			ui.hideModal();
			return;
		}

		// Trigger file picker
		document.body.appendChild(fileInput);
		fileInput.click();
		document.body.removeChild(fileInput);
	},
});

// ANSI color code converter to HTML
const ansiToHtml = function(text) {
	if (!text) return '';

	// First, strip out terminal control sequences that aren't color codes
	// These include cursor positioning, screen clearing, etc.
	text = text
		// Strip CSI sequences (cursor movement, screen clearing, etc.)
		.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, (match) => {
			// Keep only SGR (Select Graphic Rendition) sequences ending in 'm'
			if (match.endsWith('m')) {
				return match;
			}
			// Strip everything else (cursor positioning, screen clearing, etc.)
			return '';
		})
		// Strip OSC sequences (window title, etc.)
		.replace(/\x1B\][^\x07]*\x07/g, '')
		// Strip other escape sequences
		.replace(/\x1B[><=]/g, '')
		// Strip bell character
		.replace(/\x07/g, '');

	// ANSI color codes mapping
	const ansiColorMap = {
		'30': '#000000', // Black
		'31': '#FF5555', // Red
		'32': '#55FF55', // Green
		'33': '#FFFF55', // Yellow
		'34': '#5555FF', // Blue
		'35': '#FF55FF', // Magenta
		'36': '#55FFFF', // Cyan
		'37': '#FFFFFF', // White
		'90': '#555555', // Bright Black
		'91': '#FF8787', // Bright Red
		'92': '#87FF87', // Bright Green
		'93': '#FFFF87', // Bright Yellow
		'94': '#8787FF', // Bright Blue
		'95': '#FF87FF', // Bright Magenta
		'96': '#87FFFF', // Bright Cyan
		'97': '#FFFFFF', // Bright White
	};

	// Escape HTML special characters
	const escapeHtml = (str) => {
		const map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return str.replace(/[&<>"']/g, m => map[m]);
	};

	// Split by ANSI escape sequences and process
	const ansiRegex = /\x1B\[([\d;]*)m/g;
	let html = '';
	let currentStyle = {};
	let lastIndex = 0;
	let match;
	let textBuffer = '';

	// Helper to flush current text with current style
	const flushText = () => {
		if (textBuffer) {
			const escaped = escapeHtml(textBuffer);
			if (Object.keys(currentStyle).length > 0) {
				let styleStr = '';
				if (currentStyle.color) {
					styleStr += `color: ${currentStyle.color};`;
				}
				if (currentStyle.bgColor) {
					styleStr += `background-color: ${currentStyle.bgColor};`;
				}
				if (currentStyle.bold) {
					styleStr += 'font-weight: bold;';
				}
				if (currentStyle.italic) {
					styleStr += 'font-style: italic;';
				}
				if (currentStyle.underline) {
					styleStr += 'text-decoration: underline;';
				}
				if (styleStr) {
					html += `<span style="${styleStr}">${escaped}</span>`;
				} else {
					html += escaped;
				}
			} else {
				html += escaped;
			}
			textBuffer = '';
		}
	};

	while ((match = ansiRegex.exec(text)) !== null) {
		// Add text before this escape sequence
		if (match.index > lastIndex) {
			textBuffer += text.substring(lastIndex, match.index);
		}

		// Flush current text with old style before changing style
		flushText();

		const codes = match[1] ? match[1].split(';').map(Number) : [0];

		for (const code of codes) {
			if (code === 0) {
				// Reset all styles
				currentStyle = {};
			} else if (code === 1) {
				// Bold
				currentStyle.bold = true;
			} else if (code === 3) {
				// Italic
				currentStyle.italic = true;
			} else if (code === 4) {
				// Underline
				currentStyle.underline = true;
			} else if (code >= 30 && code <= 37) {
				// Standard foreground color
				currentStyle.color = ansiColorMap[code];
			} else if (code >= 90 && code <= 97) {
				// Bright foreground color
				currentStyle.color = ansiColorMap[code];
			} else if (code >= 40 && code <= 47) {
				// Background color
				currentStyle.bgColor = ansiColorMap[code - 10];
			}
		}

		lastIndex = match.index + match[0].length;
	}

	// Add any remaining text
	if (lastIndex < text.length) {
		textBuffer += text.substring(lastIndex);
	}
	flushText();

	// Convert newlines and carriage returns to <br/>
	html = html.replace(/\r\n/g, '<br/>').replace(/\r/g, '<br/>').replace(/\n/g, '<br/>');

	return html;
};

return L.Class.extend({
	Types: Types,
	ActionTypes: ActionTypes,
	ansiToHtml: ansiToHtml,
	callMountPoints: callMountPoints,
	callRcInit: callRcInit,
	dv: dv,
	container_changes: container_changes,
	container_create: container_create,
	// container_export: container_export, // use controller instead
	container_info_archive: container_info_archive,
	container_inspect: container_inspect,
	container_kill: container_kill,
	container_list: container_list,
	container_logs: container_logs,
	container_pause: container_pause,
	container_prune: container_prune,
	container_remove: container_remove,
	container_rename: container_rename,
	container_restart: container_restart,
	container_start: container_start,
	container_stats: container_stats,
	container_stop: container_stop,
	container_top: container_top,
	container_ttyd_start: container_ttyd_start,
	container_unpause: container_unpause,
	container_update: container_update,
	docker_df: docker_df,
	docker_events: docker_events,
	docker_info: docker_info,
	docker_version: docker_version,
	// image_build: image_build, // use controller instead
	image_create: image_create,
	// image_get: image_get, // use controller instead
	image_history: image_history,
	image_inspect: image_inspect,
	image_list: image_list,
	image_prune: image_prune,
	image_push: image_push,
	image_remove: image_remove,
	image_tag: image_tag,
	network_connect: network_connect,
	network_create: network_create,
	network_disconnect: network_disconnect,
	network_inspect: network_inspect,
	network_list: network_list,
	network_prune: network_prune,
	network_remove: network_remove,
	volume_create: volume_create,
	volume_inspect: volume_inspect,
	volume_list: volume_list,
	volume_prune: volume_prune,
	volume_remove: volume_remove,
});
