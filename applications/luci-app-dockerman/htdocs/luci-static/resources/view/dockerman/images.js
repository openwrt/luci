'use strict';
'require form';
'require fs';
'require poll';
'require ui';
'require dockerman.common as dm2';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
Based on Docker Lua by lisaac <https://github.com/lisaac/luci-app-dockerman>
LICENSE: GPLv2.0
*/


return dm2.dv.extend({
	load() {
		return Promise.all([
			dm2.image_list(),
			dm2.container_list({query: {all: true}}),
		])
	},

	render([images, containers]) {
		if (images?.code !== 200) {
			return E('div', {}, [ images.body.message ]);
		}

		let image_list = this.getImagesTable(images.body);
		let container_list = containers.body;
		const view = this; // Capture the view context
		view.selectedImages = {};

		let s, o;
		const m = new form.JSONMap({image: image_list, pull: {}, push: {}, build: {}, import: {}, prune: {}},
			_('Docker - Images'),
			_('On this page all images are displayed that are available on the system and with which a container can be created.'));
		m.submit = false;
		m.reset = false;

		let pollPending = null;
		let imgSec = null;
		const calculateSizeTotal = () => {
			return Array.isArray(image_list) ? image_list.map(c => c?.Size).reduce((acc, e) => acc + e, 0) : 0;
		};

		const refresh = () => {
			if (pollPending) return pollPending;
			pollPending = view.load().then(([images2, containers2]) => {
				image_list = view.getImagesTable(images2.body);
				container_list = containers2.body;
				m.data = new m.data.constructor({ image: image_list, pull: {}, push: {}, build: {}, import: {}, prune: {} });

				const size_total = calculateSizeTotal();
				if (imgSec) {
					imgSec.footer = [
						'',
						`${_('Total')} ${image_list.length}`,
						'',
						`${'%1024mB'.format(size_total)}`,
					];
				}

				return m.render();
			}).catch((err) => { console.warn(err) }).finally(() => { pollPending = null });
			return pollPending;
		};

		// Pull image

		s = m.section(form.TableSection, 'pull',  dm2.Types['image'].sub['pull'].i18n,
			_('By entering a valid image name with the corresponding version, the docker image can be downloaded from the configured registry.'));
		s.anonymous = true;
		s.addremove = false;

		const splitImageTag = (value) => {
			const input = String(value || '').trim();
			if (!input || input.includes(' ')) return { name: '', tag: 'latest' };

			const lastSlash = input.lastIndexOf('/');
			const lastColon = input.lastIndexOf(':');
			if (lastColon > lastSlash) {
				return {
					name: input.slice(0, lastColon) || input,
					tag: input.slice(lastColon + 1) || 'latest'
				};
			}

			return { name: input, tag: 'latest' };
		};

		let tagOpt = s.option(form.Value, '_image_tag_name');
		tagOpt.placeholder = "[registry.io[:443]/]foobar/product:latest";

		o = s.option(form.Button, '_pull');
		o.inputtitle = `${dm2.Types['image'].sub['pull'].i18n} ${dm2.Types['image'].sub['pull'].e}`; // _('Pull') + ' ☁️⬇️'
		o.inputstyle = 'add';
		o.onclick = L.bind(function(ev, btn) {
			const raw = tagOpt.formvalue('pull') || '';
			const input = String(raw).trim();
			if (!input) {
				ui.addTimeLimitedNotification(dm2.Types['image'].sub['pull'].i18n, _('Please enter an image tag'), 4000, 'warning');
				return false;
			}

			const { name, tag: ver } = splitImageTag(input);

			return this.super('handleXHRTransfer', [{
				q_params: { query: { fromImage: name, tag: ver } },
				commandCPath: `/images/create`,
				commandDPath: `/images/create`,
				commandTitle: dm2.Types['image'].sub['pull'].i18n,
				successMessage: _('Image create completed'),
				onUpdate: (msg) => {
					try {
						if(msg.error)
							ui.addTimeLimitedNotification(dm2.ActionTypes['build'].i18n, msg.error, 7000, 'error');

						const output = JSON.stringify(msg, null, 2) + '\n';
						view.insertOutput(output);
					} catch {

					}
				},
				onSuccess: () => refresh(),
				noFileUpload: true,
			}]);

			// return view.executeDockerAction(
			// 	dm2.image_create,
			// 	{ query: { fromImage: name, tag: ver } },
			// 	dm2.Types['image'].sub['pull'].i18n,
			// 	{
			// 		showOutput: true,
			// 		successMessage: _('Image create completed')
			// 	}
			// );
		}, this);

		// Push image

		s = m.section(form.TableSection, 'push',  dm2.Types['image'].sub['push'].i18n,
			_('Push an image to a registry. Select an image tag from all available tags on the system.'));
		s.anonymous = true;
		s.addremove = false;

		// Build a list of all available tags across all images
		const allImageTags = [];
		for (const image of image_list) {
			const tags = Array.isArray(image.RepoTags) ? image.RepoTags : [];
			for (const tag of tags) {
				if (tag && tag !== '<none>:<none>') {
					allImageTags.push(tag);
				}
			}
		}

		let pushTagOpt = s.option(form.Value, '_image_tag_push');
		pushTagOpt.placeholder = _('Select image tag');
		if (allImageTags.length === 0) {
			pushTagOpt.value('', _('No image tags available'));
		} else {
			// Add all unique tags to the dropdown
			const uniqueTags = [...new Set(allImageTags)].sort();
			for (const tag of uniqueTags) {
				pushTagOpt.value(tag, tag);
			}
		}

		o = s.option(form.Button, '_push');
		o.inputtitle = `${dm2.Types['image'].sub['push'].i18n} ${dm2.Types['image'].sub['push'].e}`; // _('Push') + ' ☁️⬆️'
		o.inputstyle = 'add';
		o.onclick = L.bind(function(ev, btn) {
			const selected = pushTagOpt.formvalue('push') || '';
			if (!selected) {
				ui.addTimeLimitedNotification(dm2.Types['image'].sub['push'].i18n, _('Please select an image tag to push'), 4000, 'warning');
				return false;
			}

			const { name, tag: ver } = splitImageTag(selected);

			return this.super('handleXHRTransfer', [{
				// Pass name in q_params to trigger building X-Registry-Auth header
				q_params: { name: name, query: { tag: ver } },
				commandCPath: `/images/push/${name}`,
				commandDPath: `/images/${name}/push`,
				commandTitle: dm2.Types['image'].sub['push'].i18n,
				successMessage: _('Image push completed'),
				onSuccess: () => refresh(),
				noFileUpload: true,
			}]);

			// return view.executeDockerAction(
			// 	dm2.image_push,
			// 	{ name: name, query: { tag: ver} },
			// 	dm2.Types['image'].sub['push'].i18n,
			// 	{
			// 		showOutput: true,
			// 		successMessage: _('Image push completed')
			// 	}
			// );
		}, this);


		s = m.section(form.TableSection, 'build',  dm2.ActionTypes['build'].i18n,
			_('Build an image.') + ' ' + _('git repositories require git installed on the docker host.'));
		s.anonymous = true;
		s.addremove = false;

		let buildOpt = s.option(form.Value, '_image_build_uri');
		buildOpt.placeholder = "https://host/foo/bar.git | https://host/foobar.tar";

		let buildTagOpt = s.option(form.Value, '_image_build_tag');
		buildTagOpt.placeholder = 'repository:tag';

		o = s.option(form.Button, '_build');
		o.inputtitle = `${dm2.ActionTypes['build'].i18n} ${dm2.ActionTypes['build'].e}`; // _('Build') + ' 🏗️'
		o.inputstyle = 'add';
		o.onclick = L.bind(function(ev, btn) {
			const uri = buildOpt.formvalue('build') || '';
			const t = buildTagOpt.formvalue('build') || '';

			const q_params = { q: encodeURIComponent('false'), t: t };
			if (uri) q_params.remote = encodeURIComponent(uri);

			return this.super('handleXHRTransfer', [{
				q_params: { query: q_params },
				commandCPath: '/images/build',
				commandDPath: '/build',
				commandTitle: dm2.ActionTypes['build'].i18n,
				successMessage: _('Image loaded successfully'),
				onUpdate: (msg) => {
					try {
						if(msg.error)
							ui.addTimeLimitedNotification(dm2.ActionTypes['build'].i18n, msg.error, 7000, 'error');

						const output = JSON.stringify(msg, null, 2) + '\n';
						view.insertOutput(output);
					} catch {

					}
				},
				onSuccess: () => refresh(),
				noFileUpload: !!uri,
			}]);
		}, this);

		o = s.option(form.Button, '_delete_cache', null);
		o.inputtitle = `${dm2.ActionTypes['clean'].i18n} ${dm2.ActionTypes['clean'].e}`;
		o.inputstyle = 'negative';
		o.onclick = L.bind(function(ev, btn) {
			return this.super('handleXHRTransfer', [{
				q_params: { query: { all: 'true' } },
				commandCPath: '/images/build/prune',
				commandDPath: '/build/prune',
				commandTitle: dm2.Types['builder'].sub['prune'].i18n,
				successMessage: _('Cleaned build cache'),
				onUpdate: (msg) => {
					try {
						if(msg.error)
							ui.addTimeLimitedNotification(dm2.ActionTypes['clean'].i18n, msg.error, 7000, 'error');

						const output = JSON.stringify(msg, null, 2) + '\n';
						view.insertOutput(output);
					} catch {

					}
				},
				noFileUpload: true,
			}]);
		}, this);

		// Import image

		s = m.section(form.TableSection, 'import', dm2.Types['image'].sub['import'].i18n,
			_('Download a valid remote image tar.'));
		s.addremove = false;
		s.anonymous = true;

		let imgsrc = s.option(form.Value, '_image_source');
		imgsrc.placeholder = 'https://host/image.tar';

		let tagimpOpt = s.option(form.Value, '_import_image_tag_name');
		tagimpOpt.placeholder = 'repository:tag';

		let importBtn = s.option(form.Button, '_import');
		importBtn.inputtitle = `${dm2.Types['image'].sub['import'].i18n} ${dm2.Types['image'].sub['import'].e}` //_('Import') + ' ➡️';
		importBtn.inputstyle = 'add';
		importBtn.onclick = L.bind(function(ev, btn) {
			const rawtag = tagimpOpt.formvalue('import') || '';
			const input = String(rawtag).trim();
			if (!input) {
				ui.addTimeLimitedNotification(dm2.Types['image'].sub['import'].i18n, _('Please enter an image repo tag'), 4000, 'warning');
				return false;
			}
			const rawremote = imgsrc.formvalue('import') || '';
			let remote = String(rawremote).trim();
			if (!remote) {
				ui.addTimeLimitedNotification(dm2.Types['image'].sub['import'].i18n, _('Please enter an image source'), 4000, 'warning');
				return false;
			}

			const { name, tag: ver } = splitImageTag(input);

			return this.super('handleXHRTransfer', [{
				q_params: { query: { fromSrc: remote, repo: ver } },
				commandCPath: '/images/create',
				commandDPath: '/images/create',
				commandTitle: dm2.Types['image'].sub['create'].i18n,
				onUpdate: (msg) => {
					try {
						if(msg.error)
							ui.addTimeLimitedNotification(dm2.Types['image'].sub['create'].i18n, msg.error, 7000, 'error');

						const output = JSON.stringify(msg, null, 2) + '\n';
						view.insertOutput(output);
					} catch {

					}
				},
				onSuccess: () => refresh(),
				noFileUpload: true,
			}]);

			// return view.executeDockerAction(
			// 	dm2.image_create,
			// 	{ query: { fromSrc: remote, repo: ver } },
			// 	dm2.Types['image'].sub['import'].i18n,
			// 	{
			// 		showOutput: true,
			// 		successMessage: _('Image create started/completed')
			// 	}
			// );
		}, this);


		s = m.section(form.TableSection, 'prune', _('Images overview'), );
		s.addremove = false;
		s.anonymous = true;

		const prune = s.option(form.Button, '_prune', null);
		prune.inputtitle = `${dm2.ActionTypes['prune'].i18n} ${dm2.ActionTypes['prune'].e}`;
		prune.inputstyle = 'negative';
		prune.onclick = L.bind(function(ev, btn) {

			return this.super('handleXHRTransfer', [{
				q_params: {  },
				commandCPath: '/images/prune',
				commandDPath: '/images/prune',
				commandTitle: dm2.ActionTypes['prune'].i18n,
				onUpdate: (msg) => {
					try {
						if(msg.error)
							ui.addTimeLimitedNotification(dm2.ActionTypes['prune'].i18n, msg.error, 7000, 'error');

						const output = JSON.stringify(msg, null, 2) + '\n';
						view.insertOutput(output);
					} catch {

					}
				},
				onSuccess: () => refresh(),
				noFileUpload: true,
			}]);

			// return view.executeDockerAction(
			// 	dm2.image_prune,
			// 	{ query: { filters: '' } },
			// 	dm2.ActionTypes['prune'].i18n,
			// 	{
			// 		showOutput: true,
			// 		successMessage: _('started/completed'),
			//		onSuccess: () => refresh(),
			// 	}
			// );
		}, this);

		o = s.option(form.Button, '_export', null);
		o.inputtitle = `${dm2.ActionTypes['save'].i18n} ${dm2.ActionTypes['save'].e}`;
		o.inputstyle = 'cbi-button-positive';
		o.onclick = L.bind(function(ev, btn) {
			ev.preventDefault();

			const selected = Object.keys(view.selectedImages).filter(k => view.selectedImages[k]);
			if (!selected.length) {
				ui.addTimeLimitedNotification(_('Export'), _('No images selected'), 3000, 'warning');
				return;
			}

			// Get tags or IDs for selected images
			const names = selected.map(sid => {
				const image = s.map.data.data[sid];
				const tag = image?.RepoTags?.[0];
				return tag || image?.Id?.substr(12);
			});

			// http.uc does not yet handle parameter arrays, so /images/get needs access to the URL params
			window.location.href = `${view.dockerman_url}/images/get?${names.map(e => `names=${e}`).join('&')}`;

		}, this);

		const size_total = calculateSizeTotal();

		imgSec = m.section(form.TableSection, 'image');
		imgSec.anonymous = true;
		imgSec.nodescriptions = true;
		imgSec.addremove = true;
		imgSec.sortable = true;
		imgSec.filterrow = true;
		imgSec.addbtntitle = `${dm2.ActionTypes['upload'].i18n} ${dm2.ActionTypes['upload'].e}`;
		imgSec.footer = [
			'',
			`${_('Total')} ${image_list.length}`,
			'',
			`${'%1024mB'.format(size_total)}`,
		];

		imgSec.handleAdd = function(sid, ev) {
			return view.handleFileUpload();
		};

		imgSec.handleGet = function(image, ev) {
			const tag = image.RepoTags?.[0];
			const name = tag || image.Id.substr(12);

			// Direct HTTP download - avoid RPC
			window.location.href = `${view.dockerman_url}/images/get/${name}`;
			return true;
		};

		imgSec.handleRemove = function(sid, image, force=false, ev) {
			return view.executeDockerAction(
				dm2.image_remove,
				{ id: image.Id, query: { force: force } },
				dm2.ActionTypes['remove'].i18n,
				{
					showOutput: true,
					onSuccess: () => {
						delete this.map.data.data[sid];
						return this.super('handleRemove', [ev]);
					}
				}
			);
		};

		imgSec.handleInspect = function(image, ev) {
			return view.executeDockerAction(
				dm2.image_inspect,
				{ id: image.Id },
				dm2.ActionTypes['inspect'].i18n,
				{ showOutput: true, showSuccess: false }
			);
		};

		imgSec.handleHistory = function(image, ev) {
			return view.executeDockerAction(
				dm2.image_history,
				{ id: image.Id },
				dm2.ActionTypes['history'].i18n,
				{ showOutput: true, showSuccess: false }
			);
		};

		imgSec.renderRowActions = function (sid) {
			const image = this.map.data.data[sid];
			const btns = [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'title': dm2.ActionTypes['inspect'].i18n,
					'click': ui.createHandlerFn(this, this.handleInspect, image),
				}, [dm2.ActionTypes['inspect'].e]),
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'title': dm2.ActionTypes['history'].i18n,
					'click': ui.createHandlerFn(this, this.handleHistory, image),
				}, [dm2.ActionTypes['history'].e]),
				E('button', {
					'class': 'cbi-button cbi-button-positive save',
					'title': dm2.ActionTypes['save'].i18n,
					'click': ui.createHandlerFn(this, this.handleGet, image),
				}, [dm2.ActionTypes['save'].e]),
				E('div', {
					'style': 'width: 20px',
					// Some safety margin for mis-clicks
				}, [' ']),
				E('button', {
					'class': 'cbi-button cbi-button-negative remove',
					'title': dm2.ActionTypes['remove'].i18n,
					'click': ui.createHandlerFn(this, this.handleRemove, sid, image, false),
					'disabled': image?._disable_delete,
				}, [dm2.ActionTypes['remove'].e]),
				E('button', {
					'class': 'cbi-button cbi-button-negative important remove',
					'title': dm2.ActionTypes['force_remove'].i18n,
					'click': ui.createHandlerFn(this, this.handleRemove, sid, image, true),
					'disabled': image?._disable_delete,
				}, [dm2.ActionTypes['force_remove'].e]),
			];
			return E('td', { 'class': 'td middle cbi-section-actions' }, E('div', btns));
		};

		o = imgSec.option(form.Flag, '_selected');
		o.onchange = function(ev, sid, value) {
			if (value == 1) {
				view.selectedImages[sid] = value;
			}
			else {
				delete view.selectedImages[sid];
			}
			return;
		}

		o = imgSec.option(form.DummyValue, 'RepoTags', dm2.Types['image'].sub['tag'].e);
		o.cfgvalue = function(sid) {
			const image = this.map.data.data[sid];
			const tags = Array.isArray(image?.RepoTags) ? image.RepoTags : [];

			if (tags.length === 0 || (tags.length === 1 && tags[0] === '<none>:<none>'))
				return '<none>';

			const tagLinks = tags.map(tag => {
				if (tag === '<none>:<none>')
					return E('span', {}, tag);

				/* last tag - don't link it - last tag removal == delete */
				if (tags.length === 1)
					return tag;

				return E('a', {
					'href': '#',
					'title': _('Click to remove this tag'),
					'click': ui.createHandlerFn(view, (tag, imageId, ev) => {

						ev.preventDefault();
						ui.showModal(_('Remove tag'), [
							E('p', {}, _('Do you want to remove the tag "%s"?').format(tag)),
							E('div', { 'class': 'right' }, [
								E('button', {
									'class': 'cbi-button',
									'click': ui.hideModal
								}, '↩'),
								' ',
								E('button', {
									'class': 'cbi-button cbi-button-negative',
									'click': ui.createHandlerFn(view, () => {
										ui.hideModal();

										return view.executeDockerAction(
											dm2.image_remove,
											{ id: tag, query: { noprune: 'true' } },
											dm2.Types['image'].sub['untag'].i18n,
											{
												showOutput: true,
												successMessage: _('Tag removed successfully'),
												successDuration: 4000,
												onSuccess: () => refresh(),
											}
										);
									})
								}, dm2.Types['image'].sub['untag'].e)
							])
						]);
					}, tag, image.Id)
				}, tag);
			});

			// Join with commas and spaces
			const content = [];
			for (const [i, tag] of tagLinks.entries()) {
				if (i > 0) content.push(', ');
				content.push(tag);
			}

			return E('span', {}, content);
		};

		o = imgSec.option(form.DummyValue, 'Containers', _('Containers'));
		o.cfgvalue = function(sid) {
			const imageId = this.map.data.data[sid].Id;
			// Collect all matching container name links for this image
			const anchors = container_list.reduce((acc, container) => {
				if (container?.ImageID !== imageId) return acc;
				for (const name of container?.Names || [])
					acc.push(E('a', { href: `container/${container.Id}` }, [ name.substring(1) ]));
				return acc;
			}, []);

			// Interleave separators
			if (!anchors.length) return E('div', {});
			const content = [];
			for (let i = 0; i < anchors.length; i++) {
				if (i) content.push(' | ');
				content.push(anchors[i]);
			}

			return E('div', {}, content);
		};

		o = imgSec.option(form.DummyValue, 'Size', _('Size'));
		o.cfgvalue = function(sid) {
			const s = this.map.data.data[sid].Size;
			return '%1024mB'.format(s);
		};
		imgSec.option(form.DummyValue, 'Created', _('Created'));
		o = imgSec.option(form.DummyValue, '_id', _('ID'));

		/* Remember: we load a JSONMap - so uci config is non-existent for these
		elements, so we must pull from this.map.data, otherwise o.load returns nothing */
		o.cfgvalue = function(sid) {
			const image = this.map.data.data[sid];
			const shortId = image?._id || '';
			const fullId = image?.Id || '';

			return E('a', {
				'href': '#',
				'style': 'font-family: monospace',
				'title': _('Click to add a new tag to this image'),
				'click': ui.createHandlerFn(view, function(imageId, ev) {
					ev.preventDefault();

					let repoInput, tagInput;
					ui.showModal(_('New tag'), [
						E('p', {}, _('Enter a new tag for image %s:').format(imageId.slice(7, 19))),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('Repository')),
							E('div', { 'class': 'cbi-value-field' }, [
								repoInput = E('input', {
									'type': 'text',
									'class': 'cbi-input-text',
									'placeholder': '[registry.io[:443]/]myrepo/myimage'
								})
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('Tag')),
							E('div', { 'class': 'cbi-value-field' }, [
								tagInput = E('input', {
									'type': 'text',
									'class': 'cbi-input-text',
									'placeholder': 'latest',
									'value': 'latest'
								})
							])
						]),
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'cbi-button',
								'click': ui.hideModal
							}, ['↩']),
							' ',
							E('button', {
								'class': 'cbi-button cbi-button-positive',
								'click': ui.createHandlerFn(view, () => {
									const repo = repoInput.value.trim();
									const tag = tagInput.value.trim() || 'latest';

									if (!repo) {
										ui.addTimeLimitedNotification(null, [_('Repository cannot be empty')], 3000, 'warning');
										return;
									}

									ui.hideModal();

									return view.executeDockerAction(
										dm2.image_tag,
										{ id: imageId, query: { repo: repo, tag: tag } },
										dm2.Types['image'].sub['tag'].i18n,
										{
											showOutput: true,
											successMessage: _('Tag added successfully'),
											successDuration: 4000,
											onSuccess: () => refresh(),
										}
									);
								})
							}, [dm2.Types['image'].sub['tag'].e])
						])
					]);
				}, fullId)
			}, shortId);
		};

		this.insertOutputFrame(s, m);

		poll.add(L.bind(() => { refresh(); }, this), 10);

		return m.render();
	},

	handleFileUpload() {
		// const uploadUrl = `?quiet=${encodeURIComponent('false')}`;

		return this.super('handleXHRTransfer', [{
			q_params: { query: { quiet: 'false' } },
			commandCPath: `/images/load`,
			commandDPath: `/images/load`,
			commandTitle: _('Uploading…'),
			commandMessage: _('Uploading image…'),
			successMessage: _('Image loaded successfully'),
			defaultPath: '/tmp'
		}]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	getImagesTable(images) {
		const data = [];

		for (const image of images) {
			// Just push plain data objects without UCI metadata
			data.push({
				...image,
				_disable_delete: null,
				_id: (image.Id || '').substring(7, 20),
				Created: this.buildTimeString(image.Created) || '',
			});
		}

		return data;
	},

});
