'use strict';
'require form';
'require fs';
'require ui';
'require dockerman.common as dm2';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
Based on Docker Lua by lisaac <https://github.com/lisaac/luci-app-dockerman>
LICENSE: GPLv2.0
*/

/* API v1.52

POST /containers/create no longer supports configuring a container-wide MAC
address via the container's Config.MacAddress field. A container's MAC address
can now only be configured via endpoint settings when connecting to a network.

*/

return dm2.dv.extend({
	load() {
		const requestPath = L.env.requestpath;
		const duplicateId = requestPath[requestPath.length-1];
		const isDuplicate = requestPath[requestPath.length-2] === 'duplicate' && duplicateId;

		const promises = [
			dm2.image_list().then(images => {
				return images.body || [];
			}),
			dm2.network_list().then(networks => {
				return networks.body || [];
			}),
			dm2.volume_list().then(volumes => {
				return volumes.body?.Volumes || [];
			}),
			dm2.docker_info().then(info => {
				const numcpus = info.body?.NCPU || 1.0;
				const memory = info.body?.MemTotal || 2**10;
				return {numcpus: numcpus, memory: memory};
			}),
		];

		if (isDuplicate) {
			promises.push(
				dm2.container_inspect({ id: duplicateId }).then(container => {
					this.duplicateContainer = container.body || {};
					this.isDuplicate = true;
				})
			);
		}

		return Promise.all(promises);
	},

	render([image_list, network_list, volume_list, cpus_mem]) {
		this.volumes = volume_list;
		const view = this; // Capture the view context

		// Load duplicate container config if available
		let containerData = {container: {}};
		let pageTitle = _('Create new docker container');

		if (this.isDuplicate && this.duplicateContainer) {
			pageTitle = _('Duplicate/Edit Container: %s').format(this.duplicateContainer.Name?.substring(1) || '');
			const resolveImageId = (imageRef) => {
				if (!imageRef) return null;
				const match = (image_list || []).find(img => img.Id === imageRef || (Array.isArray(img.RepoTags) && img.RepoTags.includes(imageRef)));
				return match?.Id || null;
			};
			const c = this.duplicateContainer;
			const hostConfig = c.HostConfig || {};
			const resolvedImage = resolveImageId(c.Image) || resolveImageId(c.Config?.Image) || c.Image || c.Config?.Image || '';
			const builtInNetworks = new Set(['none', 'bridge', 'host']);
			const [netnames, nets] = Object.entries(c.NetworkSettings?.Networks || {});

			containerData.container = {
				name: c.Name?.substring(1) || '',
				interactive: c.Config?.AttachStdin ? 1 : 0,
				tty: c.Config?.Tty ? 1 : 0,
				image: resolvedImage,
				privileged: hostConfig.Privileged ? 1 : 0,
				restart_policy: hostConfig.RestartPolicy?.Name || 'unless-stopped',
				network: (() => {
					return (netnames && (netnames.length > 0)) ? netnames[0] : '';
				})(),
				ipv4: (() => {
					if (builtInNetworks.has(netnames[0])) return '';
					return (nets && (nets.length > 0)) ? nets[0]?.IPAddress || '' : '';
				})(),
				ipv6: (() => {
					if (builtInNetworks.has(netnames[0])) return '';
					return (nets && (nets.length > 0)) ? nets[0]?.GlobalIPv6Address || '' : '';
				})(),
				ipv6_lla: (() => {
					if (builtInNetworks.has(netnames[0])) return '';
					return (nets && (nets.length > 0)) ? nets[0]?.LinkLocalIPv6Address || '' : '';
				})(),
				link: hostConfig.Links || [],
				dns: hostConfig.Dns || [],
				user: c.Config?.User || '',
				env: c.Config?.Env || [],
				volume: (hostConfig.Mounts || c.Mounts || []).map(m => {
					let source;
					const destination = m.Destination || m.Target || '';
					let opts = '';
					if (m.Type === 'image') {
						source = '@image';
						if (m.ImageOptions && m.ImageOptions.Subpath)
							opts = 'subpath=' + m.ImageOptions.Subpath;
					} else if (m.Type === 'tmpfs') {
						source = '@tmpfs';
						const tmpOpts = [];
						if (m.TmpfsOptions) {
							if (m.TmpfsOptions.SizeBytes) tmpOpts.push('size=' + m.TmpfsOptions.SizeBytes);
							if (m.TmpfsOptions.Mode) tmpOpts.push('mode=' + m.TmpfsOptions.Mode);
							if (Array.isArray(m.TmpfsOptions.Options)) {
								for (const o of m.TmpfsOptions.Options) {
									if (Array.isArray(o) && o.length === 2) tmpOpts.push(`${o[0]}=${o[1]}`);
									else if (Array.isArray(o) && o.length === 1) tmpOpts.push(o[0]);
								}
							}
						}
						opts = tmpOpts.join(',');
					} else if (m.Type === 'volume') {
						source = m.Source || '';
						// opts = m.Mode || '';
					} else {
						source = m.Source || '';
						opts = m.Mode || '';
					}
					return source + ':' + destination + (opts ? ':' + opts : '');
				}),
				publish: (() => {
					const ports = [];
					for (const [containerPort, bindings] of Object.entries(hostConfig.PortBindings || {})) {
						if (Array.isArray(bindings) && bindings.length > 0 && bindings[0]?.HostPort) {
							const hostPort = bindings[0].HostPort;
							ports.push(hostPort + ':' + containerPort);
						}
					}
					return ports;
				})(),
				command: c.Config?.Cmd ? c.Config?.Cmd.join(' ') : '',
				hostname: c.Config?.Hostname || '',
				publish_all: hostConfig.PublishAllPorts ? 1 : 0,
				device: (hostConfig.Devices || []).map(d => d.PathOnHost + ':' + d.PathInContainer + (d.CgroupPermissions ? ':' + d.CgroupPermissions : '')),
				tmpfs: (() => {
					const list = [];
					if (hostConfig.Tmpfs && typeof hostConfig.Tmpfs === 'object') {
						for (const [path, opts] of Object.entries(hostConfig.Tmpfs)) {
							list.push(path + (opts ? ':' + opts : ''));
						}
					}
					return list;
				})(),
				sysctl: (() => {
					const list = [];
					if (hostConfig.Sysctls && typeof hostConfig.Sysctls === 'object') {
						for (const [key, value] of Object.entries(hostConfig.Sysctls)) {
							list.push(key + ':' + value);
						}
					}
					return list;
				})(),
				cap_add: hostConfig.CapAdd || [],
				cpus: hostConfig.NanoCPUs ? (hostConfig.NanoCPUs / (10 ** 9)).toFixed(3) : '',
				cpu_shares: hostConfig.CpuShares || '',
				cpu_period: hostConfig.CpuPeriod || '',
				cpu_quota: hostConfig.CpuQuota || '',
				memory: hostConfig.Memory || '',
				memory_reservation: hostConfig.MemoryReservation || '',
				blkio_weight: hostConfig.BlkioWeight || '',
				log_opt: (() => {
					const list = [];
					const logConfig = hostConfig.LogConfig?.Config;
					if (logConfig && typeof logConfig === 'object') {
						for (const [key, value] of Object.entries(logConfig)) {
							list.push(key + '=' + value);
						}
					}
					return list;
				})(),
			};
		}

		// stuff JSONMap with container config
		const m = new form.JSONMap(containerData, _('Docker - Containers'));
		m.submit = true;
		m.reset = true;

		let s = m.section(form.NamedSection, 'container', pageTitle);
		s.anonymous = true;
		s.nodescriptions = true;
		s.addremove = false;

		let o;

		o = s.option(form.Value, 'name', _('Container Name'),
			_('Name of the container that can be selected during container creation'));
		o.rmempty = true;

		o = s.option(form.Flag, 'interactive', _('Interactive (-i)'));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = 0;

		o = s.option(form.Flag, 'tty', _('TTY (-t)'));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = 0;

		o = s.option(form.ListValue, 'image', _('Docker Image'));
		o.rmempty = true;
		for (const image of image_list) {
			o.value(image.Id, image?.RepoTags?.[0]);
		}

		o = s.option(form.Flag, 'pull', _('Always pull image first'));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = 0;

		o = s.option(form.Flag, 'privileged', _('Privileged'));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = 0;

		o = s.option(form.ListValue, 'restart_policy', _('Restart Policy'));
		o.rmempty = true;
		o.default = 'unless-stopped';
		o.value('no', _('No'));
		o.value('unless-stopped', _('Unless stopped'));
		o.value('always', _('Always'));
		o.value('on-failure', _('On failure'));

		o = s.option(form.ListValue, 'network', _('Networks'));
		o.rmempty = true;
		this.buildNetworkListValues(network_list, o);

		function not_with_a_docker_net(section_id, value) {
			if (!value || value === "") return true;
			const builtInNetworks = new Set(['none', 'bridge', 'host']);
			let dnet = this.section.getOption('network').getUIElement(section_id).getValue();
			const disallowed = builtInNetworks.has(dnet);
			if (disallowed) return _('Only for user-defined networks');
		};

		o = s.option(form.Value, 'ipv4', _('IPv4 Address'));
		o.rmempty = true;
		o.datatype = 'ip4addr';
		o.validate = not_with_a_docker_net;

		o = s.option(form.Value, 'ipv6', _('IPv6 Address'));
		o.rmempty = true;
		o.datatype = 'ip6addr';
		o.validate = not_with_a_docker_net;

		o = s.option(form.Value, 'ipv6_lla', _('IPv6 Link-Local Address'));
		o.rmempty = true;
		o.datatype = 'ip6ll';
		o.validate = not_with_a_docker_net;

		o = s.option(form.DynamicList, 'link', _('Links with other containers'));
		o.rmempty = true;
		o.placeholder='container_name:alias';

		o = s.option(form.DynamicList, 'dns', _('Set custom DNS servers'));
		o.rmempty = true;
		o.placeholder='8.8.8.8';

		o = s.option(form.Value, 'user', _('User(-u)'),
			_('The user that commands are run as inside the container. (format: name|uid[:group|gid])'));
		o.rmempty = true;
		o.placeholder='1000:1000';

		o = s.option(form.DynamicList, 'env', _('Environmental Variable(-e)'),
			_('Set environment variables inside the container'));
		o.rmempty = true;
		o.placeholder='TZ=Europe/Paris';

		o = s.option(form.DummyValue, 'volume', _('Mount(--mount)'),
			_('Bind mount a volume'));
		o.rmempty = true;
		o.cfgvalue = () => {
			const c_volumes = view.map.data.get('json', 'container', 'volume') || [];

			const showVolumeModal = (index, initialEntry) => {
				let typeSelect, bindPicker, bindSourceField, volumeNameInput, volumeSourceField, pathInput, pathField, optionsDropdown, optionsField, subpathInput;
				let tmpfsSizeInput, tmpfsModeInput, tmpfsOptsInput, tmpfsSizeField, tmpfsModeField, tmpfsOptsField;
				const isEdit = index !== null;
				const modalTitle = isEdit ? _('Edit Mount') : _('Add Mount');

					// Parse existing entry if editing and infer type from volumes list, image, or tmpfs
					let initialType = 'bind', initialSource = '', initialPath = '', initialOptions = '';
					if (isEdit && initialEntry) {
						const parts = (typeof initialEntry === 'string' ? initialEntry : '').split(':');
						initialSource = parts[0] || '';
						initialPath = parts[1] || '';
						initialOptions = parts[2] || '';
						// Infer type: tmpfs, volume, image, else bind
						const isTmpfs = (initialSource === '@tmpfs');
						const isVolume = (volume_list || []).some(v => v.Name === initialSource || v.Id === initialSource);
						const isImage = (initialSource === '@image');
						initialType = isTmpfs ? 'tmpfs' : (isVolume ? 'volume' : (isImage ? 'image' : 'bind'));
				}

				const existingOptions = (typeof initialOptions === 'string' ? initialOptions : '').split(',').map(o => o.trim()).filter(Boolean);

				// Type-specific options for dropdowns
				const bindOptions = {
					'ro': _('Read-only (ro)'),
					'rw': _('Read-write (rw)'),
					'private': _('Propagation: private'),
					'rprivate': _('Propagation: rprivate'),
					'shared': _('Propagation: shared'),
					'rshared': _('Propagation: rshared'),
					'slave': _('Propagation: slave'),
					'rslave': _('Propagation: rslave')
				};

				const volumeOptions = {
					// 'ro': _('Read-only (ro)'),
					// 'rw': _('Read-write (rw)'),
					'nocopy': _('No copy (nocopy)')
				};

				const getOptionsForType = (type) => type === 'bind' ? bindOptions : volumeOptions;

				const namesListId = 'volname-list-' + Math.random().toString(36).substr(2, 9);

				// Create dropdown for options - updates based on type
				optionsDropdown = new ui.Dropdown(existingOptions, getOptionsForType(initialType), {
					id: 'mount-options-' + Math.random().toString(36).substr(2, 9),
					multiple: true,
					optional: true,
					display_items: 2,
					placeholder: _('Select options...')
				});

				const createField = (label, input) => {
					return E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, label),
						E('div', { 'class': 'cbi-value-field' }, Array.isArray(input) ? input : [input])
					]);
				};

				// Type select
				const typeOptions = [
					E('option', { value: 'bind' }, _('Bind (host directory)')),
					E('option', { value: 'volume' }, _('Volume (named)')),
					E('option', { value: 'image' }, _('Image (from image)')),
					E('option', { value: 'tmpfs' }, _('Tmpfs'))
				];
				typeSelect = E('select', { 'class': 'cbi-input-select' }, typeOptions);
				typeSelect.value = initialType;

				// Bind directory picker using ui.FileUpload
				bindPicker = new ui.FileUpload(initialType === 'bind' ? initialSource : '', {
					browser: false,
					directory_select: true,
					directory_create: false,
					enable_upload: false,
					enable_remove: false,
					enable_download: false,
					root_directory: '/',
					show_hidden: true
				});

				// Volume name input with datalist
				volumeNameInput = E('input', {
					'type': 'text',
					'class': 'cbi-input-text',
					'placeholder': _('Enter volume name or pick existing'),
					'list': namesListId,
					'value': initialType === 'volume' ? initialSource : ''
				});
				volumeSourceField = createField(_('Volume Name'), [
					E('div', { 'style': 'position: relative;' }, [
						volumeNameInput,
						E('span', { 'style': 'pointer-events: none;' }, '▼')
					]),
					E('datalist', { 'id': namesListId }, [
						...volume_list.map(vol => E('option', { 'value': vol.Name }, vol.Name))
					])
				]);

				// Tmpfs inputs - pre-populate if editing
				let tmpfsSizeVal = '', tmpfsModeVal = '', tmpfsOptsVal = '';
				if (initialType === 'tmpfs' && existingOptions.length) {
					const rest = [];
					existingOptions.forEach(o => {
						if (o.startsWith('size=')) tmpfsSizeVal = o.slice('size='.length);
						else if (o.startsWith('mode=')) tmpfsModeVal = view.modeToRwx(o.slice('mode='.length));
						else rest.push(o);
					});
					tmpfsOptsVal = rest.join(',');
				}

				tmpfsSizeField = createField(_('Size'),
					tmpfsSizeInput = E('input', {
						'class': 'cbi-input-text',
						'placeholder': '128m',
						'value': tmpfsSizeVal
					})
				);
				tmpfsModeField = createField(_('Mode'),
					tmpfsModeInput = E('input', {
						'class': 'cbi-input-text',
						'placeholder': 'rwxr-xr-x or 1770',
						'value': tmpfsModeVal
					})
				);
				tmpfsOptsField = createField(_('tmpfs Options'),
					tmpfsOptsInput = E('input', {
						'type': 'text',
						'class': 'cbi-input-text',
						'placeholder': 'nr_blocks=blocks,...',
						'value': tmpfsOptsVal
					})
				);

				// Render bindPicker and show modal
				Promise.resolve(bindPicker.render()).then(bindPickerNode => {
					bindSourceField = createField(_('Host Directory'), bindPickerNode);

					const updateOptions = (selectedType) => {
						optionsField.querySelector('.cbi-value-field').innerHTML = '';
						if (selectedType === 'image') {
							// For image mounts, show a Subpath text input (only option)
							subpathInput = E('input', {
								'type': 'text',
								'class': 'cbi-input-text',
								'placeholder': _('/path/in/image'),
								'value': (initialType === 'image' && existingOptions.find(o => o.startsWith('subpath='))) ? existingOptions.find(o => o.startsWith('subpath=')).slice('subpath='.length) : ''
							});
							optionsField.querySelector('.cbi-value-title').textContent = _('Subpath');
							optionsField.querySelector('.cbi-value-field').appendChild(subpathInput);
						} else if (selectedType === 'tmpfs') {
							// Tmpfs fields are shown as main fields, hide options field
							optionsField.style.display = 'none';
						} else {
							optionsField.querySelector('.cbi-value-title').textContent = _('Options');
							// Recreate dropdown with new options
							const currentValue = optionsDropdown.getValue();
							optionsDropdown = new ui.Dropdown(currentValue, getOptionsForType(selectedType), {
								id: 'mount-options-' + Math.random().toString(36).substr(2, 9),
								multiple: true,
								optional: true,
								display_items: 2,
								placeholder: _('Select options...')
							});
							optionsField.querySelector('.cbi-value-field').appendChild(optionsDropdown.render());
							optionsField.style.display = '';
						}
					};

					const toggleSources = () => {
						const isBind = typeSelect.value === 'bind';
						const isVolume = typeSelect.value === 'volume';
						const isImage = typeSelect.value === 'image';
						const isTmpfs = typeSelect.value === 'tmpfs';
						bindSourceField.style.display = isBind ? '' : 'none';
						volumeSourceField.style.display = isVolume ? '' : 'none';
						pathField.style.display = isImage ? 'none' : '';
						tmpfsSizeField.style.display = isTmpfs ? '' : 'none';
						tmpfsModeField.style.display = isTmpfs ? '' : 'none';
						tmpfsOptsField.style.display = isTmpfs ? '' : 'none';
						updateOptions(typeSelect.value);
					};

					optionsField = createField(_('Options'), optionsDropdown.render());

					ui.showModal(modalTitle, [
						createField(_('Type'), typeSelect),
						bindSourceField,
						volumeSourceField,
						pathField = createField(_('Mount Path'),
							pathInput = E('input', {
								'type': 'text',
								'class': 'cbi-input-text',
								'placeholder': _('/mnt/path'),
								'value': initialPath
							})
						),
						tmpfsSizeField,
						tmpfsModeField,
						tmpfsOptsField,
						optionsField,
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'cbi-button',
								'click': ui.hideModal
							}, [_('Cancel')]),
							' ',
							E('button', {
								'class': 'cbi-button cbi-button-positive',
								'click': ui.createHandlerFn(view, () => {
									const selectedType = typeSelect.value;
									const sourcePath = selectedType === 'bind'
										? (bindPicker.getValue() || '').trim()
										: (selectedType === 'volume'
											? (volumeNameInput.value || '').trim()
											: (selectedType === 'tmpfs' ? '@tmpfs' : '@image'));
									const subpathVal = (selectedType === 'image') ? (subpathInput?.value || '').trim() : '';
									const mountPath = (selectedType === 'image') ? subpathVal : pathInput.value.trim();
									let selectedOptions;
									if (selectedType === 'image') {
										selectedOptions = subpathVal ? ('subpath=' + subpathVal) : '';
									} else if (selectedType === 'tmpfs') {
										const opts = [];
										const sizeValRaw = (tmpfsSizeInput?.value || '').trim();
										const modeValRaw = (tmpfsModeInput?.value || '').trim();
										const extraVal = (tmpfsOptsInput?.value || '').trim();
										const parsedSize = sizeValRaw ? view.parseMemory(sizeValRaw) : undefined;
										const parsedMode = view.rwxToMode(modeValRaw);
										if (parsedSize) opts.push('size=' + parsedSize);
										else if (sizeValRaw) opts.push('size=' + sizeValRaw); // fallback if parse fails
										if (parsedMode !== undefined) opts.push('mode=' + parsedMode);
										if (extraVal) opts.push(...extraVal.split(',').map(o => o.trim()).filter(Boolean));
										selectedOptions = opts.join(',');
									} else {
										selectedOptions = optionsDropdown.getValue().join(',');
									}

									if (!sourcePath) {
										ui.addTimeLimitedNotification(null, [_('Please choose a directory or enter a volume name')], 3000, 'warning');
										return;
									}

									if (selectedType !== 'image' && !mountPath) {
										ui.addTimeLimitedNotification(null, [_('Please enter a mount path')], 3000, 'warning');
										return;
									}
									if (selectedType === 'image' && !subpathVal) {
										ui.addTimeLimitedNotification(null, [_('Please enter a subpath')], 3000, 'warning');
										return;
									}
									if (selectedType === 'tmpfs' && !mountPath) {
										ui.addTimeLimitedNotification(null, [_('Please enter a mount path')], 3000, 'warning');
										return;
									}

									ui.hideModal();

									const currentVolumes = view.map.data.get('json', 'container', 'volume') || [];
									const volumeEntry = selectedOptions ? (sourcePath + ':' + mountPath + ':' + selectedOptions) : (sourcePath + ':' + mountPath);
									let updatedVolumes;
									if (isEdit) {
										updatedVolumes = [...currentVolumes];
										updatedVolumes[index] = volumeEntry;
									} else {
										updatedVolumes = Array.isArray(currentVolumes) ? [...currentVolumes, volumeEntry] : [volumeEntry];
									}
									view.map.data.set('json', 'container', 'volume', updatedVolumes);

									return view.map.render();
								})
							}, [isEdit ? _('Update') : _('Add')])
						])
					]);

					toggleSources();
					typeSelect.addEventListener('change', toggleSources);
				});
			};


			return E('div', { 'class': 'cbi-dynlist' }, [
				...(c_volumes.length > 0 ? c_volumes.map((v, idx) => E('div', {
					'class': 'cbi-dynlist-item',
					'style': 'display: flex; justify-content: space-between; align-items: center; padding: 8px 5px; margin-bottom: 8px; gap: 10px;'
				}, [
					E('span', {
						'style': 'cursor: pointer; flex: 1;',
						'click': ui.createHandlerFn(view, () => {
							showVolumeModal(idx, v);
						})
					}, v),
					E('button', {
						'style': 'padding: 5px; color: #c44;',
						'class': 'cbi-button-negative remove',
						'title': _('Delete this volume mount'),
						'click': ui.createHandlerFn(view, () => {
							const currentVolumes = view.map.data.get('json', 'container', 'volume') || [];
							const updatedVolumes = currentVolumes.filter((_, i) => i !== idx);
							view.map.data.set('json', 'container', 'volume', updatedVolumes);
							return view.map.render();
						})
					}, ['✕'])
				])) : [E('div', { 'style': 'padding: 5px; color: #999;' }, _('No volumes available'))]),
				E('button', {
					'class': 'cbi-button',
					'click': ui.createHandlerFn(view, () => {
						showVolumeModal(null, null);
					})
				}, [_('Add Mount')])
			]);
		};
		o.rmempty = true;

		o = s.option(form.DynamicList, 'publish', _('Exposed Ports(-p)'),
			_("Publish container's port(s) to the host"));
		o.rmempty = true;
		o.placeholder='2200:22/tcp';

		o = s.option(form.Value, 'command', _('Run command'));
		o.rmempty = true;
		o.placeholder='/bin/sh init.sh';

		o = s.option(form.Flag, 'advanced', _('Advanced'));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = 0;

		o = s.option(form.Value, 'hostname', _('Host Name'),
			_('The hostname to use for the container'));
		o.rmempty = true;
		o.placeholder='/bin/sh init.sh';
		o.depends('advanced', 1);

		o = s.option(form.Flag, 'publish_all', _('Exposed All Ports(-P)'),
			_("Allocates an ephemeral host port for all of a container's exposed ports"));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = 0;
		o.depends('advanced', 1);

		o = s.option(form.DynamicList, 'device', _('Device(--device)'),
			_('Add host device to the container'));
		o.rmempty = true;
		o.placeholder='/dev/sda:/dev/xvdc:rwm';
		o.depends('advanced', 1);

		o = s.option(form.DynamicList, 'tmpfs', _('Tmpfs(--tmpfs)'),
			_('Mount tmpfs directory'));
		o.rmempty = true;
		o.placeholder='/run:rw,noexec,nosuid,size=65536k';
		o.depends('advanced', 1);

		o = s.option(form.DynamicList, 'sysctl', _('Sysctl(--sysctl)'),
			_('Sysctls (kernel parameters) options'));
		o.rmempty = true;
		o.placeholder='net.ipv4.ip_forward=1';
		o.depends('advanced', 1);

		o = s.option(form.DynamicList, 'cap_add', _('CAP-ADD(--cap-add)'),
			_('A list of kernel capabilities to add to the container'));
		o.rmempty = true;
		o.placeholder='NET_ADMIN';
		o.depends('advanced', 1);

		o = s.option(form.Value, 'cpus', _('CPUs'),
			_('Number of CPUs. Number is a fractional number. 0.000 means no limit'));
		o.rmempty = true;
		o.placeholder='1.5';
		o.datatype = 'ufloat';
		o.depends('advanced', 1);
		o.validate = function(section_id, value) {
			if (!value) return true;
			if (value > cpus_mem.numcpus) return _(`Only ${cpus_mem.numcpus} CPUs available`);
			return true;
		};

		o = s.option(form.Value, 'cpu_period', _('CPU Period'),
			_('The length of a CPU period in microseconds'));
		o.rmempty = true;
		o.datatype = 'or(and(uinteger,min(1000),max(1000000)),"0")';
		o.depends('advanced', 1);

		o = s.option(form.Value, 'cpu_quota', _('CPU Quota'),
			_('Microseconds of CPU time that the container can get in a CPU period'));
		o.rmempty = true;
		o.datatype = 'uinteger';
		o.depends('advanced', 1);

		o = s.option(form.Value, 'cpu_shares', _('CPU Shares Weight'),
			_('CPU shares relative weight, if 0 is set, the system will ignore the value and use the default of 1024'));
		o.rmempty = true;
		o.placeholder='1024';
		o.datatype = 'uinteger';
		o.depends('advanced', 1);

		o = s.option(form.Value, 'memory', _('Memory'),
			_('Memory limit (format: <number>[<unit>]). Number is a positive integer. Unit can be one of b, k, m, or g. Minimum is 4M'));
		o.rmempty = true;
		o.placeholder = '128m';
		o.depends('advanced', 1);
		o.write = function(section_id, value) {
			if (!value || value == 0) return 0;
			this.map.data.data[section_id].memory = view.parseMemory(value);;
			return view.parseMemory(value);
		};
		o.validate = function(section_id, value) {
			if (!value) return true;
			if (value > view.memory) return _(`Only ${view.memory} bytes available`);
			return true;
		};

		o = s.option(form.Value, 'memory_reservation', _('Memory Reservation'));
		o.depends('advanced', 1);
		o.placeholder = '128m';
		o.cfgvalue = (sid, val) => {
			const res = view.map.data.data[sid].memory_reservation;
			return res ? '%1024.2m'.format(res) : 0;
		};
		o.write = function(section_id, value) {
			if (!value || value == 0) return 0;
			this.map.data.data[section_id].memory_reservation = view.parseMemory(value);;
			return view.parseMemory(value);
		};

		o = s.option(form.Value, 'blkio_weight', _('Block IO Weight'),
			_('Block IO weight (relative weight) accepts a weight value between 10 and 1000.'));
		o.rmempty = true;
		o.placeholder='500';
		o.datatype = 'and(uinteger,min(10),max(1000))';
		o.depends('advanced', 1);

		o = s.option(form.DynamicList, 'log_opt', _('Log driver options'),
			_('The logging configuration for this container'));
		o.rmempty = true;
		o.placeholder='max-size=1m';
		o.depends('advanced', 1);


		this.map = m;

		return m.render();

	},

	handleSave(ev) {
		ev?.preventDefault();
		const view = this; // Capture the view context
		const map = this.map;
		if (!map)
			return Promise.reject(new Error(_('Form is not ready yet.')));

		const listToKv = view.listToKv;

		const toBool = (val) => (val === 1 || val === '1' || val === true);
		const toInt = (val) => val ? Number.parseInt(val) : undefined;
		const toFloat = (val) => val ? Number.parseFloat(val) : undefined;

		return map.parse()
			.then(() => {
				const get = (opt) => map.data.get('json', 'container', opt);
				const name = get('name');
				// const pull = toBool(get('pull'));
				const network = get('network');
				const publish = get('publish');
				const command = get('command');
				// const publish_all = toBool(get('publish_all'));
				const device = get('device');
				const tmpfs = get('tmpfs');
				const sysctl = get('sysctl');
				const log_opt = get('log_opt');

				const createBody = {
					Hostname: get('hostname'),
					User: get('user'),
					AttachStdin: toBool(get('interactive')),
					Tty: toBool(get('tty')),
					OpenStdin: toBool(get('interactive')),
					Env: get('env'),
					Cmd: command ? command.split(' ') : null,
					Image: get('image'),
					HostConfig: {
						CpuShares: toInt(get('cpu_shares')),
						Memory: toInt(get('memory')),
						MemoryReservation: toInt(get('memory_reservation')),
						BlkioWeight: toInt(get('blkio_weight')),
						CapAdd: get('cap_add'),
						CpuPeriod: toInt(get('cpu_period')),
						CpuQuota: toInt(get('cpu_quota')),
						NanoCPUs: toFloat(get('cpus')) * (10 ** 9),
						Devices: device ? device
							.filter(d => d && typeof d === 'string' && d.trim().length > 0)
							.map(d => {
							const parts = d.split(':');
							return {
								PathOnHost: parts[0],
								PathInContainer: parts[1] || parts[0],
								CgroupPermissions: parts[2] || 'rwm'
							};
						}) : undefined,
						LogConfig: log_opt ? {
							Type: 'json-file',
							Config: listToKv(log_opt)
						} : undefined,
						NetworkMode: network,
						PortBindings: publish ? Object.fromEntries(
							(Array.isArray(publish) ? publish : [publish])
							.filter(p => p && typeof p === 'string' && p.trim().length > 0)
							.map(p => {
								const m = p.match(/^(\d+):(\d+)\/(tcp|udp)$/);
								if (m) return [`${m[2]}/${m[3]}`, [{ HostPort: m[1] }]];
								return null;
							}).filter(Boolean)
						) : undefined,
						Mounts: undefined,
						Links: get('link'),
						Privileged: toBool(get('privileged')),
						PublishAllPorts: toBool(get('publish_all')),
						RestartPolicy: { Name: get('restart_policy') },
						Dns: get('dns'),
						Tmpfs: tmpfs ? Object.fromEntries(
							(Array.isArray(tmpfs) ? tmpfs : [tmpfs])
							.filter(t => t && typeof t === 'string' && t.trim().length > 0)
							.map(t => {
								const parts = t.split(':');
								return [parts[0], parts[1] || ''];
							})
						) : undefined,
						Sysctls: sysctl ? listToKv(sysctl) : undefined,
					},
					NetworkingConfig: {
						EndpointsConfig: { [network]: { IPAMConfig: { IPv4Address: get('ipv4') || null, IPv6Address: get('ipv6') || null } } },
					}
				};

				// Parse volume entries and populate Mounts
				const volumeEntries = get('volume') || [];
				const volumeNames = new Set((view.volumes || []).map(v => v.Name));
				const volumeIds = new Set((view.volumes || []).map(v => v.Id));
				const mounts = [];
				for (const entry of volumeEntries) {
					let e = typeof entry === 'string' ? entry : '';
					let f = e.split(':')?.map(e => e && e.trim() || '');
					let source = f[0];
					let target = f[1];
					let options = f[2];

					if (!options) options = '';

					// Validate source and target are not empty
					if (!source || !target) {
						console.warn('Invalid volume entry (empty source or target):', entry);
						continue;
					}

					// Infer type: '@image' => image; '@tmpfs' => tmpfs; volume by name/id; else bind
					let type = 'bind';
					if (source === '@image') {
						type = 'image';
					} else if (source === '@tmpfs') {
						type = 'tmpfs';
					} else if (volumeNames.has(source) || volumeIds.has(source)) {
						type = 'volume';
					}

					const mount = {
						Type: type,
						Source: source,
						Target: target,
						ReadOnly: options.split(',').includes('ro')
					};

					// Add type-specific options
					if (type === 'bind') {
						const bindOptions = {};
						const propagation = options.split(',').find(opt => 
							['rprivate', 'private', 'rshared', 'shared', 'rslave', 'slave'].includes(opt)
						);
						if (propagation) bindOptions.Propagation = propagation;
						if (Object.keys(bindOptions).length > 0) mount.BindOptions = bindOptions;
					} else if (type === 'volume') {
						const volumeOptions = {};
						if (options.includes('nocopy')) volumeOptions.NoCopy = true;
						if (Object.keys(volumeOptions).length > 0) mount.VolumeOptions = volumeOptions;
					} else if (type === 'image') {
						const imageOptions = {};
						const subpathOpt = options.split(',').find(opt => opt.startsWith('subpath='));
						if (subpathOpt) imageOptions.Subpath = subpathOpt.slice('subpath='.length);
						if (Object.keys(imageOptions).length > 0) mount.ImageOptions = imageOptions;
						// Image source is implied by selected container image
						mount.Source = createBody.Image;
					} else if (type === 'tmpfs') {
						const tmpfsOptions = {};
						const optsList = options.split(',').map(o => o.trim()).filter(Boolean);
						for (const opt of optsList) {
							if (opt.startsWith('size=')) tmpfsOptions.SizeBytes = toInt(opt.slice('size='.length));
							else if (opt.startsWith('mode=')) tmpfsOptions.Mode = toInt(opt.slice('mode='.length));
							else {
								if (!tmpfsOptions.Options) tmpfsOptions.Options = [];
								const kv = opt.split('=');
								if (kv.length === 2) tmpfsOptions.Options.push([kv[0], kv[1]]);
								else if (kv.length === 1) tmpfsOptions.Options.push([kv[0]]);
							}
						}
						mount.Source = '';
						if (Object.keys(tmpfsOptions).length > 0) mount.TmpfsOptions = tmpfsOptions;
					}

					mounts.push(mount);
				}
				createBody.HostConfig.Mounts = mounts.length > 0 ? mounts : undefined;

				// Clean up undefined values
				Object.keys(createBody.HostConfig).forEach(key => {
					if (createBody.HostConfig[key] === undefined)
						delete createBody.HostConfig[key];
				});

				if (!name)
					return Promise.reject(new Error(_('No name specified.')));

				return { name, createBody };
			})
			.then(({ name, createBody }) => view.executeDockerAction(
				dm2.container_create,
				{ query: { name: name }, body: createBody },
				_('Create container'),
				{
					showOutput: false,
					showSuccess: false,
					onSuccess: (response) => {
						const isDuplicate = view.isDuplicate && view.duplicateContainer;
						const msgTitle = isDuplicate ? _('Container duplicated') : _('Container created');
						const msgText = isDuplicate ? 
							_('New container duplicated from ') + view.duplicateContainer.Name?.substring(1) : 
							_('New container has been created.');

						if (response?.body?.Warnings) {
							view.showNotification(msgTitle + _(' with warnings'), response?.body?.Warning || msgText, 5000, 'warning');
						} else {
							view.showNotification(msgTitle, msgText, 4000, 'success');
						}
						window.location.href = `${this.dockerman_url}/containers`;
					}
				}
			))
			.catch((err) => {
				view.showNotification(_('Create container failed'), err?.message || String(err), 7000, 'error');
				return false;
			});
	},

	handleSaveApply: null,
	handleReset: null,

});
