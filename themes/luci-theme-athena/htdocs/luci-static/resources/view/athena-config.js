'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';
'require athena.ui as widgets';
const callGet = rpc.declare({ object: 'luci.athena', method: 'get', expect: { '': {} } });
const callInstall = rpc.declare({
	object: 'luci.athena',
	method: 'install',
	params: ['kind', 'token'],
	expect: { '': {} }
});
const callRemove = rpc.declare({
	object: 'luci.athena',
	method: 'remove',
	params: ['kind', 'name'],
	expect: { '': {} }
});
const callSelect = rpc.declare({
	object: 'luci.athena',
	method: 'select',
	params: ['name'],
	expect: { '': {} }
});
const base = '/luci-static/athena/branding/';
const nativeButton = (label, variant, handler, disabled) =>
	E(
		'button',
		{
			type: 'button',
			class: `button button--${variant} button--sm`,
			click: handler,
			disabled: disabled || null
		},
		label
	);
function checked(result) {
	if (result.result !== 0) throw new Error(result.error || _('Unknown error'));
	return result;
}
function errorMessage(error) {
	ui.addNotification(null, E('p', {}, error.message), 'error');
}
function token() {
	const data = new Uint8Array(16);
	crypto.getRandomValues(data);
	return [...data].map((value) => value.toString(16).padStart(2, '0')).join('');
}
return view.extend({
	load: function () {
		return Promise.all([uci.load('athena'), callGet(), ui.menu.load().catch(() => null)]);
	},
	render: function (data) {
		this.readonly = !L.hasViewPermission();
		this.assets = checked(data[1]);
		const system = data[2]?.children?.admin?.children?.system?.children;
		this.packagePath = ['package-manager', 'opkg', 'apk'].find(
			(name) => system?.[name]?.satisfied !== false && system?.[name]?.title
		);
		const map = new form.Map('athena', _('Athena Theme'), _('Manage appearance and login assets.'));
		const updates = map.section(form.NamedSection, 'global', 'global');
		updates.render = () => this.upgradeRoot;
		const section = map.section(form.NamedSection, 'global', 'global', _('Appearance'));
		let option = section.option(form.Value, 'primary', _('Primary color'));
		option.placeholder = '#1672ee';
		option.rmempty = false;
		option.validate = function (section, value) {
			return /^#[0-9a-f]{6}$/i.test(value) || _('Use a six-digit hex color, e.g. #1672ee');
		};
		option = section.option(
			form.ListValue,
			'default_mode',
			_('Default appearance'),
			_('Used until a mode is chosen manually. The top-right choice is remembered in this browser.')
		);
		option.value('system', _('Follow system'));
		option.value('dark', _('Dark mode'));
		option.value('light', _('Light mode'));
		option.default = 'system';
		option.rmempty = false;
		option = section.option(form.ListValue, 'login_style', _('Login layout'));
		option.value('classic', _('Split'));
		option.value('centered', _('Centered'));
		option.default = 'classic';
		option.rmempty = false;
		this.assetRoot = E('div', {}, []);
		this.renderAssets();
		this.upgradeRoot = E('div');
		this.renderUpgrade();
		return map.render().then((node) => E('div', {}, [node, this.assetRoot]));
	},
	renderUpgrade: function () {
		this.upgradeRoot.replaceChildren(
			widgets.card(E('h3', {}, _('Theme version')), [
				E('p', {}, _('Current version') + ': v' + this.assets.version),
				E('p', {}, _('Install and update this theme through the OpenWrt package manager.')),
				this.packagePath
					? E(
							'a',
							{
								class: 'button button--secondary button--sm',
								href: L.url('admin', 'system', this.packagePath)
							},
							_('Software')
						)
					: ''
			])
		);
	},
	update: function (result) {
		this.assets = checked(result);
		this.renderAssets();
	},
	act: function (button, work) {
		button.disabled = true;
		return Promise.resolve()
			.then(work)
			.then((result) => this.update(result))
			.catch(errorMessage)
			.finally(() => {
				if (button.isConnected) button.disabled = this.readonly;
			});
	},
	upload: function (kind, event) {
		const button = event.currentTarget;
		const id = token();
		button.disabled = true;
		return ui
			.uploadFile('/tmp/athena-upload-' + id + '.tmp', button)
			.then((file) => {
				if (!file) return;
				return callInstall(kind, id).then((result) => {
					this.update(result);
					ui.addNotification(
						null,
						E('p', {}, _('Asset updated. Reload the page to apply.')),
						'info'
					);
				});
			})
			.catch(errorMessage)
			.finally(() => {
				if (button.isConnected) button.disabled = this.readonly;
			});
	},
	remove: function (kind, name) {
		ui.showModal(_('Remove asset'), [
			E(
				'p',
				{},
				kind === 'background' ? _('Remove this background file?') : _('Restore the default icon?')
			),
			E('div', { class: 'right' }, [
				nativeButton(_('Cancel'), 'tertiary', ui.hideModal),
				nativeButton(_('Remove'), 'danger-soft', (event) =>
					this.act(event.currentTarget, () => callRemove(kind, name || '')).then(() =>
						ui.hideModal()
					)
				)
			])
		]);
	},
	renderAssets: function () {
		const value = this.assets;
		const readonly = this.readonly;
		const cards = [
			[
				'logo',
				_('Custom logo'),
				_('PNG, 16\u20131024 pixels, up to 1 MiB. Aspect ratio is preserved.')
			],
			['favicon', _('Browser icon'), _('Square PNG, 16\u20131024 pixels, up to 1 MiB.')]
		].map(([kind, title, description]) =>
			E('section', { class: 'athena-upload-card' }, [
				E('h3', {}, title),
				E('p', {}, description),
				E(
					'div',
					{ class: 'athena-icon-preview' },
					E('img', {
						src: value[kind] ? base + value[kind] : '/luci-static/athena/logo.svg',
						alt: title
					})
				),
				E('div', { class: 'athena-upload-actions' }, [
					nativeButton(_('Upload PNG'), 'primary', (event) => this.upload(kind, event), readonly),
					nativeButton(
						_('Reset'),
						'secondary',
						() => this.remove(kind, ''),
						readonly || !value[kind]
					)
				])
			])
		);
		const rows = (value.files || []).map((file) => {
			const selected = value.background === file.name;
			const video = /\.(mp4|webm)$/.test(file.name);
			return E('tr', { class: 'tr' }, [
				E(
					'td',
					{ class: 'td' },
					video
						? E('span', {}, 'VIDEO')
						: E('img', { class: 'athena-file-preview', src: base + file.name, alt: '' })
				),
				E('td', { class: 'td' }, [
					E('span', {}, file.name.slice(0, 15) + '…' + file.name.slice(file.name.lastIndexOf('.'))),
					selected ? E('small', { class: 'athena-file-active' }, _('In use')) : ''
				]),
				E('td', { class: 'td' }, `${(file.size / 1048576).toFixed(2)} MiB`),
				E(
					'td',
					{ class: 'td cbi-section-actions' },
					E('div', { class: 'button-group button-group--sm' }, [
						nativeButton(
							selected ? _('Selected') : _('Use'),
							'secondary',
							(event) => this.act(event.currentTarget, () => callSelect(file.name)),
							readonly || selected
						),
						nativeButton(
							_('Delete'),
							'danger-soft',
							() => this.remove('background', file.name),
							readonly
						)
					])
				)
			]);
		});
		if (!rows.length)
			rows.push(
				E(
					'tr',
					{ class: 'tr placeholder' },
					E('td', { class: 'td', colspan: 4 }, _('No backgrounds uploaded.'))
				)
			);
		const table = E('table', { class: 'table', 'aria-label': _('Background files') }, [
			E(
				'tr',
				{ class: 'tr table-titles' },
				[_('Preview'), _('File'), _('Size'), _('Actions')].map((label) =>
					E('th', { class: 'th' }, label)
				)
			),
			...rows
		]);
		const background = widgets.card(E('h3', {}, _('Backgrounds')), [
			E(
				'p',
				{},
				_('Local login background. JPG, PNG, GIF, WebP, MP4 or WebM, up to 20 MiB per file.')
			),
			E('div', { class: 'athena-upload-actions' }, [
				nativeButton(
					_('Upload background'),
					'primary',
					(event) => this.upload('background', event),
					readonly
				),
				E(
					'span',
					{ class: 'athena-metric-detail' },
					_('Available space:') + ' ' + (value.available / 1048576).toFixed(1) + ' MiB'
				)
			]),
			table
		]);
		this.assetRoot.replaceChildren(E('div', { class: 'athena-config-grid' }, cards), background);
	}
});
