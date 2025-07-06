'use strict';
'require form';
'require fs';
'require uci';
'require dockerman.common as dm2';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
Based on Docker Lua by lisaac <https://github.com/lisaac/luci-app-dockerman>
LICENSE: GPLv2.0
*/

/**
 * Returns a Set of image IDs in use by containers
 * @param {Array} containers - Array of container objects
 * @returns {Set<string>} Set of image IDs
 */
function getImagesInUseByContainers(containers) {
	const inUse = new Set();
	for (const c of containers || []) {
		if (c.ImageID) inUse.add(c.ImageID);
		else if (c.Image) inUse.add(c.Image);
	}
	return inUse;
}

/**
 * Returns a Set of network IDs in use by containers
 * @param {Array} containers - Array of container objects
 * @returns {Set<string>} Set of network IDs
 */
function getNetworksInUseByContainers(containers) {
	const inUse = new Set();
	for (const c of containers || []) {
		const networks = c.NetworkSettings?.Networks;
		if (networks && typeof networks === 'object') {
			for (const netName in networks) {
				const net = networks[netName];
				if (net.NetworkID) inUse.add(net.NetworkID);
				else if (netName) inUse.add(netName);
			}
		}
	}
	return inUse;
}

/**
 * Returns a Set of volume mountpoints in use by containers
 * @param {Array} containers - Array of container objects
 * @returns {Set<string>} Set of volume names or mountpoints
 */
function getVolumesInUseByContainers(containers) {
	const inUse = new Set();
	for (const c of containers || []) {
		const mounts = c.Mounts;
		if (Array.isArray(mounts)) {
			for (const m of mounts) {
				if (m.Type === 'volume' && m.Name) inUse.add(m.Name);
			}
		}
	}
	return inUse;
}


return dm2.dv.extend({
	load() {
		const now = Math.floor(Date.now() / 1000);

		return Promise.all([
			dm2.docker_version(),
			dm2.docker_info(),
			// dm2.docker_df(), // takes > 20 seconds on large docker environments
			dm2.container_list().then(r => r.body || []),
			dm2.image_list().then(r => r.body || []),
			dm2.network_list().then(r => r.body || []),
			dm2.volume_list().then(r => r.body || []),
			dm2.callMountPoints(),
		]);
	},

	handleAction(name, action, ev) {
		return dm2.callRcInit(name, action).then(function(ret) {
			if (ret)
				throw _('Command failed');

			return true;
		}).catch(function(e) {
			L.ui.addTimeLimitedNotification(null, E('p', _('Failed to execute "/etc/init.d/%s %s" action: %s').format(name, action, e)), 5000, 'warning');
		});
	},

	render([version_response,
			info_response,
			// df_response,
			container_list,
			image_list,
			network_list,
			volume_list,
			mounts,
		]) {
		const version_headers = [];
		const version_body = [];
		const info_body = [];
		// const df_body = [];
		const docker_ep = uci.get('dockerd', 'globals', 'hosts');
		let isLocal = false;
		if (!docker_ep || docker_ep.length === 0 || docker_ep.map(e => e.includes('.sock')).filter(Boolean).length == 1)
			isLocal = true;

		if (info_response?.code !== 200) {
			return E('div', {}, [ info_response?.body?.message ]);
		}

		this.parseHeaders(version_response.headers, version_headers);
		this.parseBody(version_response.body, version_body);
		this.parseBody(info_response.body, info_body);
		// this.parseBody(df_response.body, df_body);
		const view = this;
		const info = info_response.body;

		this.concount = info?.Containers || 0;
		this.conactivecount = info?.ContainersRunning || 0;

		/* Because the df function that reconciles Volumes, Networks and Containers
		is slow on large and busy dockerd endpoints, we do it here manually. It's fast. */
		this.imgcount = image_list.length;
		this.imgactivecount = getImagesInUseByContainers(container_list)?.size || 0;

		this.netcount = network_list.length;
		this.netactivecount = getNetworksInUseByContainers(container_list)?.size || 0;

		this.volcount = volume_list?.Volumes?.length;
		this.volactivecount = getVolumesInUseByContainers(container_list)?.size || 0;

		this.freespace = isLocal ? mounts.find(m => m.mount === info?.DockerRootDir)?.avail || 0 : 0;
		if (isLocal && this.freespace !== 0)
			this.freespace = '(' + '%1024.2m'.format(this.freespace) + ' ' + _('Available') + ')';

		const mainContainer = E('div', { 'class': 'cbi-map' });

		// Add heading and description first
		mainContainer.appendChild(E('h2', { 'class': 'section-title' }, [_('Docker - Overview')]));
		mainContainer.appendChild(E('div', { 'class': 'cbi-map-descr' }, [
			_('An overview with the relevant data is displayed here with which the LuCI docker client is connected.'),
			E('br'),
			E('a', { href: 'https://github.com/openwrt/luci/blob/master/applications/luci-app-dockerman/README.md' }, ['README'])
		]));

		if (isLocal)
			mainContainer.appendChild(E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px;' }, [
					E('button', { 'class': 'btn cbi-button-action neutral', 'click': () => this.handleAction('dockerd', 'restart') }, _('Restart', 'daemon restart action')),
					E('button', { 'class': 'btn cbi-button-action negative', 'click': () => this.handleAction('dockerd', 'stop') }, _('Stop', 'daemon stop action')),
				])
			]));

		// Create the info table
		const summaryTable = new L.ui.Table(
			[_('Info'), ''],
			{ id: 'containers-table', style: 'width: 100%; table-layout: auto;' },
			[]
		);

		summaryTable.update([
			[ _('Docker Version'), version_response.body.Version ],
			[ _('Api Version'), version_response.body.ApiVersion ],
			[ _('CPUs'), info_response.body.NCPU ],
			[ _('Total Memory'), '%1024.2m'.format(info_response.body.MemTotal) ],
			[ _('Docker Root Dir'), `${info_response.body.DockerRootDir} ${ (isLocal && this.freespace) ? this.freespace : '' }` ],
			[ _('Index Server Address'), info_response.body.IndexServerAddress ],
			[ _('Registry Mirrors'), info_response.body.RegistryConfig?.Mirrors || '-' ],
		]);

		// Wrap the table in a cbi-section
		mainContainer.appendChild(E('div', { 'class': 'cbi-section' }, [
			summaryTable.render()
		]));


		// Create a container div with grid layout for the status badges
		let statusContainer = E('div', { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-bottom: 20px;' }, [
			this.overviewBadge(`${this.dockerman_url}/containers`,
				E('img', {
					src: L.resource('dockerman/containers.svg'),
					style: 'width: 80px; height: 80px;'
				}, []),
				_('Containers'),
				_('Total: '),
				view.concount,
				_('Running: '),
				view.conactivecount),
			this.overviewBadge(`${this.dockerman_url}/images`,
				E('img', {
					src: L.resource('dockerman/images.svg'),
					style: 'width: 80px; height: 80px;'
				}, []),
				_('Images'),
				_('Total: '),
				view.imgcount,
				view.imgactivecount ? _('In Use: ') : '',
				view.imgactivecount ? view.imgactivecount : ''),
			this.overviewBadge(`${this.dockerman_url}/networks`,
				E('img', {
					src: L.resource('dockerman/networks.svg'),
					style: 'width: 80px; height: 80px;'
				}, []),
				_('Networks'),
				_('Total: '),
				view.netcount,
				view.netactivecount ? _('In Use: ') : '',
				view.netactivecount ? view.netactivecount : ''),
			this.overviewBadge(`${this.dockerman_url}/volumes`,
				E('img', {
					src: L.resource('dockerman/volumes.svg'),
					style: 'width: 80px; height: 80px;'
				}, []),
				_('Volumes'),
				_('Total: '),
				view.volcount,
				view.volactivecount ? _('In Use: ') : '',
				view.volactivecount ? view.volactivecount : ''),
		]);

		// Add badges section
		mainContainer.appendChild(statusContainer);

		const m = new form.JSONMap({
			// df: df_body,
			vb: version_body,
			ib: info_body
		});
		m.readonly = true;
		m.tabbed = false;

		let s, o, v;

		// Add Version and Environment tables
		s = m.section(form.TableSection, 'vb', _('Version'));
		s.anonymous = true;

		o = s.option(form.DummyValue, 'entry', _('Name'));
		o = s.option(form.DummyValue, 'value', _('Value'));

		s = m.section(form.TableSection, 'ib', _('Environment'));
		s.anonymous = true;
		s.filterrow = true;

		o = s.option(form.DummyValue, 'entry', _('Entry'));
		o = s.option(form.DummyValue, 'value', _('Value'));

		// Render the form sections and append them
		return m.render()
			.then(fe => {
				mainContainer.appendChild(fe);
				return mainContainer;
			});
	},

	overviewBadge(url, resource_div, caption, total_caption, total_count, active_caption, active_count) {
		return E('a', { href: url, style: 'text-decoration: none; cursor: pointer;', title: _('Go to relevant configuration page') }, [
				E('div', { style: 'border: 1px solid #ddd; border-radius: 5px; padding: 15px; min-height: 120px; display: flex; align-items: center;' }, [
					E('div', { style: 'flex: 0 0 auto; margin-right: 15px;' }, [
						resource_div,
					]),
					E('div', { style: 'flex: 1;' }, [
						E('div', { style: 'font-size: 20px; font-weight: bold; color: #333; margin-bottom: 8px;' }, caption),
						E('div', { style: 'font-size: 16px; margin: 4px 0;' }, [
							E('span', { style: 'color: #666; margin-right: 10px;' }, [total_caption, E('strong', { style: 'color: #0066cc;' }, total_count)])
						]),
						E('div', { style: 'font-size: 16px; margin: 4px 0;' }, [
							E('span', { style: 'color: #666;' }, [active_caption, E('strong', { style: 'color: #28a745;' }, active_count)])
						])
					])
				])
			])

	}
});
