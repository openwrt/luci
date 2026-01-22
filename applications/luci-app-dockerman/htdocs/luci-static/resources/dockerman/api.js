'use strict';
'require rpc';
'require uci';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
LICENSE: GPLv2.0
*/

const callNetworkInterfaceDump = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { 'interface': [] }
});


let dockerHosts = null;
let dockerHost = null;
let localIPv4 = null;
let localIPv6 = null;
let js_api_available = false;


// Load both UCI config and network interfaces in parallel
const loadPromise = Promise.all([
	callNetworkInterfaceDump(),
	uci.load('dockerd'),
]).then(([interfaceData]) => {

	const lan_device = uci.get('dockerd', 'globals', '_luci_lan') || 'lan';

	// Find local IPs from network interfaces
	if (interfaceData) {
		interfaceData.forEach(iface => {
			// console.log(iface.up)
			if (!iface.up || iface.interface !== lan_device) return;

			// Get IPv4 address
			if (!localIPv4 && iface['ipv4-address']) {
				const addr4 = iface['ipv4-address'].find(a => 
					a.address && !a.address.startsWith('127.')
				);
				if (addr4) localIPv4 = addr4.address;
			}

			// Get IPv6 address
			if (!localIPv6) {
				// Try ipv6-address array first
				if (iface['ipv6-address']) {
					const addr6 = iface['ipv6-address'].find(a =>
						a.address && a.address !== '::1' && !a.address.startsWith('fe80:')
					);
					if (addr6) localIPv6 = addr6.address;
				}

				// Try ipv6-prefix-assignment if no address found
				if (!localIPv6 && iface['ipv6-prefix-assignment']) {
					const prefix = iface['ipv6-prefix-assignment'].find(p =>
						p['local-address'] && p['local-address'].address
					);
					if (prefix) localIPv6 = prefix['local-address'].address;
				}
			}
		});
	}

	dockerHosts = uci.get_first('dockerd', 'globals', 'hosts');

	// Find and convert first tcp:// or tcp6:// host
	const hostsList = Array.isArray(dockerHosts) ? dockerHosts : [];
	const dh = hostsList.find(h => h 
		&& (h.startsWith('tcp://')
			|| h.startsWith('tcp6://')
			|| h.startsWith('inet6://')
			|| h.startsWith('http://')
			|| h.startsWith('https://')
			));

	if (dh) {
		const isTcp6 = dh.startsWith('tcp6://');
		const protocol = dh.includes(':2376') ? 'https://' : 'http://';
		dockerHost = dh.replace(/^(tcp|inet)6?:\/\//, protocol);

		// Replace 0.0.0.0 or :: with appropriate local IP
		if (localIPv6) {
			dockerHost = dockerHost.replace(/\[::1?\]/, `[${localIPv6}]`);
			// dockerHost = dockerHost.replace(/::/, localIPv6);
		} 

		if (localIPv4) {
			dockerHost = dockerHost.replace(/0\.0\.0\.0/, localIPv4);
		}

		console.log('Docker configured to use JS API to:', dockerHost);
	}

	return dockerHost;
});


// Helper to process NDJSON or line-delimited JSON chunks
function processLines(buffer, onChunk) {
	const lines = buffer.split('\n');
	buffer = lines.pop() || '';
	for (const line of lines) {
		if (line.trim()) {
			try {
				const json = JSON.parse(line);
				onChunk(json);
			} catch (e) {
				onChunk({ raw: line });
			}
		}
	}
	return buffer;
}


function call_docker(method, path, options = {}) {
	return loadPromise.then(() => {
		const headers = { ...(options.headers || {}) };
		const payload = options.payload || null;
		const query = options.query || null;
		const host = dockerHost;
		const onChunk = options.onChunk || null; // Optional callback for streaming NDJSON
		const api_ver = uci.get('dockerd', 'globals', 'api_version') || '';
		const api_ver_str = api_ver ? `/${version}` : '';


		if (!host) {
			return Promise.reject(new Error('Docker host not configured'));
		}

		// Check if WebSocket upgrade is requested
		const isWebSocketUpgrade = headers['Connection']?.toLowerCase() === 'upgrade' || 
									headers['connection']?.toLowerCase() === 'upgrade';

		if (isWebSocketUpgrade) {
			return createWebSocketConnection(host, path, query);
		}

		// Build URL
		let url = `${host}${api_ver_str}${path}`;
		if (query) {
			const params = new URLSearchParams();
			for (const key in query) {
				if (query[key] != null) {
					params.append(key, query[key]);
				}
			}

			// dockerd does not like encoded params here.
			const queryString = params.toString();
			if (queryString) {
				url += `?${queryString}`;
			}
		}

		// Build fetch options
		const fetchOptions = {
			method,
			headers: {
				...headers  // Always include custom headers
			},
		};

		if (payload) {
			fetchOptions.body = JSON.stringify(payload);
			if (!fetchOptions.headers['Content-Type']) {
				fetchOptions.headers['Content-Type'] = 'application/json';
			}
		}

		// Make the request
		return fetch(url, fetchOptions)
			.then(response => {
				// If streaming callback provided, use streaming response
				if (onChunk) {
					const reader = response.body?.getReader();
					const decoder = new TextDecoder();
					let buffer = '';

					return new Promise((resolve) => {
						const processStream = async () => {
							try {
								while (true) {
									const { done, value } = await reader.read();
									
									if (done) {
										// Process any remaining data in buffer
										buffer = processLines(buffer, onChunk);
										break;
									}
									// Decode chunk and add to buffer
									buffer += decoder.decode(value, { stream: true });
									// Use generic processor for NDJSON/line chunks
									buffer = processLines(buffer, onChunk);
								}

								// Return final response
								resolve({
									code: response.status,
									headers: response.headers
								});
							} catch (err) {
								console.error('Streaming error:', err);
								throw err;
							}
						};

						processStream();
					});
				}

				// Normal buffered response
				if (response?.status >= 304) {
					console.error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const headersObj = {};
				for (const [key, value] of response.headers.entries()) {
					headersObj[key] = value;
				}

				return response.text().then(text => {
					const safeText = (typeof text === 'string') ? text : '';
					let parsed = safeText || text;
					const contentType = response.headers.get('content-type') || '';

					// Try normal JSON parse first
					try {
						parsed = JSON.parse(text);
					} catch (err) {
						// If the payload is newline-delimited JSON (Docker events), split and parse each line
						if (['application/json',
							'application/x-ndjson',
							'application/json-seq'].includes(contentType) || safeText.includes('\n')) {
							const lines = safeText.split(/\r?\n/).filter(Boolean);
							try {
								parsed = lines.map(l => JSON.parse(l));
							} catch (err2) {
								// Fall back to raw text if parsing fails
								parsed = text;
							}
						}
					}

					return {
						code: response.status,
						body: parsed,
						headers: headersObj,
					};
				});
			})
			.catch(error => {
				console.error('Docker API error:', error);
			});
	});
}

function createWebSocketConnection(host, path, query) {
	return new Promise((resolve, reject) => {
		try {
			// Convert http/https to ws/wss
			const wsHost = host
				.replace(/^https:/, 'wss:')
				.replace(/^http:/, 'ws:');

			// Build WebSocket URL
			let wsUrl = `${wsHost}${path}`;
			if (query) {
				const params = new URLSearchParams();
				for (const key in query) {
					if (query[key] != null) {
						params.append(key, query[key]);
					}
				}
				const queryString = params.toString();
				if (queryString) {
					wsUrl += `?${queryString}`;
				}
			}

			console.log('Opening WebSocket connection to:', wsUrl);

			const ws = new WebSocket(wsUrl);
			let resolved = false;

			// Handle connection open
			ws.onopen = () => {
				console.log('WebSocket connected');
				if (!resolved) {
					resolved = true;
					// Return a Response-like object with WebSocket support
					resolve({
						ok: true,
						status: 200,
						statusText: 'OK',
						headers: new Map(),
						body: ws,
						ws: ws,
						// Add helper for sending messages
						send: (data) => {
							if (ws.readyState === WebSocket.OPEN) {
								ws.send(data);
							}
						},
						// Add helper for receiving messages as async iterator
						async *[Symbol.asyncIterator]() {
							while (ws.readyState === WebSocket.OPEN) {
								yield new Promise((res, rej) => {
									const messageHandler = (event) => {
										ws.removeEventListener('message', messageHandler);
										ws.removeEventListener('error', errorHandler);
										res(event.data);
									};
									const errorHandler = (error) => {
										ws.removeEventListener('message', messageHandler);
										ws.removeEventListener('error', errorHandler);
										rej(error);
									};
									ws.addEventListener('message', messageHandler);
									ws.addEventListener('error', errorHandler);
								});
							}
						}
					});
				}
			};

			// Handle connection error
			ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				if (!resolved) {
					resolved = true;
					reject(new Error(`WebSocket connection failed: ${error.message || 'Unknown error'}`));
				}
			};

			// Handle close (including handshake failures)
			ws.onclose = (event) => {
				console.log('WebSocket closed');
				if (!resolved) {
					resolved = true;
					reject(new Error(`WebSocket closed before open (${event?.code || 'unknown'})`));
				}
			};

		} catch (error) {
			reject(error);
		}
	});
}


const core_methods = {
	version: { call: () => call_docker('GET', '/version') },
	info:    { call: () => call_docker('GET', '/info') },
	ping:    { call: () => call_docker('GET', '/_ping') },
	df:      { call: () => call_docker('GET', '/system/df') },
	events:  { args: { query: { 'since': '', 'until': `${Date.now()}`, 'filters': '' } }, call: (request) => call_docker('GET', '/events', { query: request?.query, onChunk: request?.onChunk }) },
};


const exec_methods = {
	start:   { args: { id: '', body: '' }, call: (request) => call_docker('POST', `/exec/${request?.id}/start`, { payload: request?.body }) },
	resize:  { args: { id: '', query: { 'h': 0, 'w': 0 } }, call: (request) => call_docker('POST', `/exec/${request?.id}/resize`, { query: request?.query }) },
	inspect: { args: { id: '' }, call: (request) => call_docker('GET', `/exec/${request?.id}/json`) },
};


const container_methods = {
	list:    { args: { query: { 'all': false, 'limit': false, 'size': false, 'filters': '' } }, call: (request) => call_docker('GET', '/containers/json', { query: request?.query }) },
	create:  { args: { query: { 'name': '', 'platform': '' }, body: {} }, call: (request) => call_docker('POST', '/containers/create', { query: request?.query, payload: request?.body }) },
	inspect: { args: { id: '', query: { 'size': false } }, call: (request) => call_docker('GET', `/containers/${request?.id}/json`, { query: request?.query }) },
	top:     { args: { id: '', query: { 'ps_args': '' } }, call: (request) => call_docker('GET', `/containers/${request?.id}/top`, { query: request?.query }) },
	logs:    { args: { id: '', query: {} }, call: (request) => call_docker('GET', `/containers/${request?.id}/logs`, { query: request?.query, onChunk: request?.onChunk }) },
	changes: { args: { id: '' }, call: (request) => call_docker('GET', `/containers/${request?.id}/changes`) },
	export:  { args: { id: '' }, call: (request) => call_docker('GET', `/containers/${request?.id}/export`) },
	stats:   { args: { id: '', query: { 'stream': false, 'one-shot': false } }, call: (request) => call_docker('GET', `/containers/${request?.id}/stats`, { query: request?.query }) },
	resize:  { args: { id: '', query: { 'h': 0, 'w': 0 } }, call: (request) => call_docker('POST', `/containers/${request?.id}/resize`, { query: request?.query }) },
	start:   { args: { id: '', query: { 'detachKeys': '' } }, call: (request) => call_docker('POST', `/containers/${request?.id}/start`, { query: request?.query }) },
	stop:    { args: { id: '', query: { 'signal': '', 't': 0 } }, call: (request) => call_docker('POST', `/containers/${request?.id}/stop`, { query: request?.query }) },
	restart: { args: { id: '', query: { 'signal': '', 't': 0 } }, call: (request) => call_docker('POST', `/containers/${request?.id}/restart`, { query: request?.query }) },
	kill:    { args: { id: '', query: { 'signal': '' } }, call: (request) => call_docker('POST', `/containers/${request?.id}/kill`, { query: request?.query }) },
	update:  { args: { id: '', body: {} }, call: (request) => call_docker('POST', `/containers/${request?.id}/update`, { payload: request?.body }) },
	rename:  { args: { id: '', query: { 'name': '' } }, call: (request) => call_docker('POST', `/containers/${request?.id}/rename`, { query: request?.query }) },
	pause:   { args: { id: '' }, call: (request) => call_docker('POST', `/containers/${request?.id}/pause`) },
	unpause: { args: { id: '' }, call: (request) => call_docker('POST', `/containers/${request?.id}/unpause`) },
	// attach
	// attach websocket
	attach_ws: { args: { id: '' }, call: (request) => call_docker('GET', `/containers/${request?.id}/attach/ws`, { query: request?.query, headers: { 'Connection': 'Upgrade' } }) },
	// wait
	remove:  { args: { id: '', query: { 'v': false, 'force': false, 'link': false } }, call: (request) => call_docker('DELETE', `/containers/${request?.id}`, { query: request?.query }) },
	// archive info
	info_archive: { args: { id: '', query: { 'path': '' } }, call: (request) => call_docker('HEAD', `/containers/${request?.id}/archive`, { query: request?.query }) },
	// archive get
	get_archive:  { args: { id: '', query: { 'path': '' } }, call: (request) => call_docker('GET', `/containers/${request?.id}/archive`, { query: request?.query }) },
	// archive extract
	put_archive:  { args: { id: '', query: { 'path': '', 'noOverwriteDirNonDir': '', 'copyUIDGID': '' }, body: '' }, call: (request) => call_docker('PUT', `/containers/${request?.id}/archive`, { query: request?.query, payload: request?.body }) },
	exec:    { args: { id: '', opts: {} }, call: (request) => call_docker('POST', `/containers/${request?.id}/exec`, { payload: request?.opts }) },
	prune:   { args: { query: { 'filters': '' } }, call: (request) => call_docker('POST', '/containers/prune', { query: request?.query }) },

	// Not a docker command - but a local command to invoke ttyd so our browser can open websocket to docker
	// ttyd_start: { args: { id: '', cmd: '/bin/sh', port: 7682, uid: '' }, call: (request) => run_ttyd(request) },

};


const image_methods = {
	list:    { args: { query: { 'all': false, 'digests': false, 'shared-size': false, 'manifests': false, 'filters': '' } }, call: (request) => call_docker('GET', '/images/json', { query: request?.query }) },
	build:  { args: { query: { '': '' }, headers: {}, onChunk: null }, call: (request) => call_docker('POST', '/build', { query: request?.query, headers: request?.headers, onChunk: request?.onChunk }) },
	build_prune:  { args: { query: { '': '' }, headers: {}, onChunk: null }, call: (request) => call_docker('POST', '/build/prune', { query: request?.query, headers: request?.headers, onChunk: request?.onChunk }) },
	create:  { args: { query: { '': '' }, headers: {}, onChunk: null }, call: (request) => call_docker('POST', '/images/create', { query: request?.query, headers: request?.headers, onChunk: request?.onChunk }) },
	inspect: { args: { id: '' }, call: (request) => call_docker('GET', `/images/${request?.id}/json`) },
	history: { args: { id: '' }, call: (request) => call_docker('GET', `/images/${request?.id}/history`) },
	push:    { args: { name: '', query: { tag: '', platform: '' }, headers: {}, onChunk: null }, call: (request) => call_docker('POST', `/images/${request?.name}/push`, { query: request?.query, headers: request?.headers, onChunk: request?.onChunk }) },
	tag:     { args: { id: '', query: { 'repo': '', 'tag': '' } }, call: (request) => call_docker('POST', `/images/${request?.id}/tag`, { query: request?.query }) },
	remove:  { args: { id: '', query: { 'force': false, 'noprune': false }, onChunk: null }, call: (request) => call_docker('DELETE', `/images/${request?.id}`, { query: request?.query, onChunk: request?.onChunk }) },
	search:  { args: { query: { 'term': '', 'limit': 0, 'filters': '' } }, call: (request) => call_docker('GET', '/images/search', { query: request?.query }) },
	prune:   { args: { query: { 'filters': '' }, onChunk: null }, call: (request) => call_docker('POST', '/images/prune', { query: request?.query, onChunk: request?.onChunk }) },
	// create/commit
	get:     { args: { id: '', onChunk: null }, call: (request) => call_docker('GET', `/images/${request?.id}/get`, { onChunk: request?.onChunk }) },
	// get == export several
	load:    { args: { query: { 'quiet': false }, onChunk: null }, call: (request) => call_docker('POST', '/images/load', { query: request?.query, onChunk: request?.onChunk }) },
};


const network_methods = {
	list:    { args: { query: { 'filters': '' } }, call: (request) => call_docker('GET', '/networks', { query: request?.query }) },
	inspect: { args: { id: '', query: { 'verbose': false, 'scope': '' } }, call: (request) => call_docker('GET', `/networks/${request?.id}`, { query: request?.query }) },
	remove:  { args: { id: '' }, call: (request) => call_docker('DELETE', `/networks/${request?.id}`) },
	create:  { args: { body: {} }, call: (request) => call_docker('POST', '/networks/create', { payload: request?.body }) },
	connect: { args: { id: '', body: {} }, call: (request) => call_docker('POST', `/networks/${request?.id}/connect`, { payload: request?.body }) },
	disconnect: { args: { id: '', body: {} }, call: (request) => call_docker('POST', `/networks/${request?.id}/disconnect`, { payload: request?.body }) },
	prune:   { args: { query: { 'filters': '' } }, call: (request) => call_docker('POST', '/networks/prune', { query: request?.query }) },
};


const volume_methods = {
	list:    { args: { query: { 'filters': '' } }, call: (request) => call_docker('GET', '/volumes', { query: request?.query }) },
	create:  { args: { opts: {} }, call: (request) => call_docker('POST', '/volumes/create', { payload: request?.opts }) },
	inspect: { args: { id: '' }, call: (request) => call_docker('GET', `/volumes/${request?.id}`) },
	update:  { args: { id: '', query: { 'version': 0 }, spec: {} }, call: (request) => call_docker('PUT', `/volumes/${request?.id}`, { query: request?.query, payload: request?.spec }) },
	remove:  { args: { id: '', query: { 'force': false } }, call: (request) => call_docker('DELETE', `/volumes/${request?.id}`, { query: request?.query }) },
	prune:   { args: { query: { 'filters': '' } }, call: (request) => call_docker('POST', '/volumes/prune', { query: request?.query }) },
};


// const methods = {
// 	'docker': core_methods, 
// 	'docker.container': container_methods,
// 	'docker.exec': exec_methods,
// 	'docker.image': image_methods,
// 	'docker.network': network_methods,
// 	'docker.volume': volume_methods,
// };


// Determine JS API availability after core methods are ready
const apiAvailabilityPromise = loadPromise.then(() => {
	if (!dockerHost) {
		js_api_available = false;
		return [js_api_available, dockerHost];
	}

	return core_methods.ping.call()
		.then(res => {
			// ping returns raw 'OK' text; treat any truthy/OK as success
			const body = res?.body;
			js_api_available = body === 'OK';
			return [js_api_available, dockerHost];
		})
		.catch(error => {
			console.warn('JS API unavailable (likely CORS or network):', error?.message || error);
			js_api_available = false;
			return [js_api_available, dockerHost];
		});
});


return L.Class.extend({
	js_api_available: () => apiAvailabilityPromise.then(() => [js_api_available, dockerHost]),
	container_attach_ws: container_methods.attach_ws.call,
	container_changes: container_methods.changes.call,
	container_create: container_methods.create.call,
	// container_export: container_export, // use controller instead
	container_info_archive: container_methods.info_archive.call,
	container_inspect: container_methods.inspect.call,
	container_kill: container_methods.kill.call,
	container_list: container_methods.list.call,
	container_logs: container_methods.logs.call,
	container_pause: container_methods.pause.call,
	container_prune: container_methods.prune.call,
	container_remove: container_methods.remove.call,
	container_rename: container_methods.rename.call,
	container_restart: container_methods.restart.call,
	container_start: container_methods.start.call,
	container_stats: container_methods.stats.call,
	container_stop: container_methods.stop.call,
	container_top: container_methods.top.call,
	// container_ttyd_start: container_methods.ttyd_start.call,
	container_unpause: container_methods.unpause.call,
	container_update: container_methods.update.call,
	docker_version: core_methods.version.call,
	docker_info: core_methods.info.call,
	docker_ping: core_methods.ping.call,
	docker_df: core_methods.df.call,
	docker_events: core_methods.events.call,
	image_build: image_methods.build.call,
	image_create: image_methods.create.call,
	image_history: image_methods.history.call,
	image_inspect: image_methods.inspect.call,
	image_list: image_methods.list.call,
	image_prune: image_methods.prune.call,
	image_push: image_methods.push.call,
	image_remove: image_methods.remove.call,
	image_tag: image_methods.tag.call,
	network_connect: network_methods.connect.call,
	network_create: network_methods.create.call,
	network_disconnect: network_methods.disconnect.call,
	network_inspect: network_methods.inspect.call,
	network_list: network_methods.list.call,
	network_prune: network_methods.prune.call,
	network_remove: network_methods.remove.call,
	volume_create: volume_methods.create.call,
	volume_inspect: volume_methods.inspect.call,
	volume_list: volume_methods.list.call,
	volume_prune: volume_methods.prune.call,
	volume_remove: volume_methods.remove.call,

});

