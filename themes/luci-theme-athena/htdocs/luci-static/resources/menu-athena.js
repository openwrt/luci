'use strict';
'require baseclass';
'require ui';
'require rpc';
'require poll';
'require session';
'require athena.ui as widgets';

const icon = (name) => widgets.icon(name);
const makeButton = (label, variant, click, iconName) =>
	E(
		'button',
		{
			type: 'button',
			class: `button button--${variant || 'ghost'} button--sm`,
			click: click
		},
		[iconName ? icon(iconName) : '', label || '']
	);
function currentPath() {
	const parts = location.pathname.split('/').filter(Boolean);
	const index = parts.indexOf('admin');
	const requested = index >= 0 ? parts.slice(index).join('/') : '';
	const dispatched = (L.env.dispatchpath || []).join('/');
	return !requested || dispatched.startsWith(requested + '/') ? dispatched : requested;
}
function active(path, candidate) {
	return path === candidate || path.startsWith(candidate + '/');
}
function flat(nodes) {
	return nodes.flatMap((node) => (node.children.length ? flat(node.children) : [node]));
}
function statusSvg(tag, attrs = {}, children = []) {
	const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
	node.append(...children);
	return node;
}
function statusFrame(name, label, kind, art) {
	return E(
		'section',
		{
			class: `athena-metric athena-metric--display athena-metric--${kind}`,
			'data-metric': name,
			role: 'group',
			'aria-label': label
		},
		[
			...art,
			E('div', { class: 'athena-status-rim', 'aria-hidden': 'true' }),
			E('div', { class: 'athena-metric-label' }, label)
		]
	);
}
function statusDisplay(name, label, kind, art) {
	const node = statusFrame(name, label, kind, art);
	node.append(
		E('output', { class: 'athena-metric-value', 'aria-live': 'off' }, [
			E('span', { class: 'athena-status-digits' }, '—'),
			E('span', { class: 'athena-status-unit' }, '%')
		]),
		E('div', { class: 'athena-metric-detail' }, '—')
	);
	return node;
}
function statusInternet(name, label) {
	const svg = statusSvg,
		node = statusFrame(name, label, 'internet', [
			E('div', { class: 'athena-dial-wash', 'aria-hidden': 'true' }),
			svg(
				'svg',
				{
					class: 'athena-status-graphic',
					viewBox: '0 0 440 458',
					'aria-hidden': 'true',
					focusable: 'false'
				},
				[
					...[60, 78, 98].map((r, index) =>
						svg('circle', {
							cx: 220,
							cy: 185,
							r,
							fill: 'none',
							stroke: 'currentColor',
							'stroke-width': 1,
							'stroke-opacity': 0.18 - index * 0.055
						})
					)
				]
			),
			E('div', { class: 'athena-internet-icon', 'aria-hidden': 'true' }, icon('network'))
		]);
	node.append(
		E('div', { class: 'athena-metric-value' }, '—'),
		E('div', { class: 'athena-metric-detail' }, 'WAN · —'),
		E('div', { class: 'athena-internet-meta' }, [
			E('span', { id: 'athena-uptime' }, [
				E('span', { class: 'athena-uptime-prefix' }, _('Uptime') + ' '),
				E('span', { class: 'athena-uptime-value' }, '—')
			]),
			E('span', { id: 'athena-last-update' })
		])
	);
	return node;
}
function updateDisplay(node, percent, detail) {
	const available = Number.isFinite(percent),
		value = available ? String(Math.max(0, Math.round(percent))) : '—';
	const digits = node.querySelector('.athena-status-digits');
	if (digits.textContent !== value) digits.textContent = value;
	node.dataset.statusDigits = String(value.length);
	node.setAttribute(
		'aria-label',
		`${node.querySelector('.athena-metric-label').textContent} ${value}% · ${detail}`
	);
	const note = node.querySelector('.athena-metric-detail');
	if (note.textContent !== detail) note.textContent = detail;
	return available ? Math.max(0, Math.min(1, percent / 100)) : 0;
}
// Read-only status dial inspired by Pin UI; no adjustment handlers or runtime.
function statusDial(name, label) {
	const svg = statusSvg;
	const gradient = `athena-dial-needle-${name}`;
	const ticks = Array.from({ length: 96 }, (_, index) =>
		svg('line', {
			x1: 220,
			x2: 220,
			y1: 156,
			y2: index % 4 ? 144 : 138,
			'stroke-width': index % 4 ? 1.2 : 1.8,
			transform: `rotate(${-115 + (index / 95) * 230} 220 322)`
		})
	);
	return statusDisplay(name, label, 'dial', [
		E('div', { class: 'athena-dial-wash', 'aria-hidden': 'true' }),
		svg(
			'svg',
			{
				class: 'athena-status-graphic',
				viewBox: '0 0 440 458',
				'aria-hidden': 'true',
				focusable: 'false'
			},
			[
				svg('defs', {}, [
					svg('linearGradient', { id: gradient, x1: 0, y1: 0, x2: 0, y2: 1 }, [
						svg('stop', { offset: 0, 'stop-color': 'currentColor' }),
						svg('stop', { offset: 1, 'stop-color': 'currentColor', 'stop-opacity': 0.08 })
					])
				]),
				svg('g', { class: 'athena-dial-ticks', 'stroke-linecap': 'round' }, ticks),
				svg('g', { class: 'athena-dial-needle' }, [
					svg('rect', { x: 219, y: 140, width: 2, height: 100, rx: 1, fill: `url(#${gradient})` })
				])
			]
		)
	]);
}
function updateDial(node, percent, detail) {
	const ratio = updateDisplay(node, percent, detail);
	node.querySelector('.athena-dial-needle').style.transform = `rotate(${-115 + ratio * 230}deg)`;
	for (const [index, line] of [...node.querySelector('.athena-dial-ticks').children].entries()) {
		const angle = -115 + (index / 95) * 230,
			edge = 1 - Math.pow(Math.abs(angle) / 120, 4);
		line.style.opacity = String((index / 95 <= ratio ? 0.85 : 0.15) * edge);
	}
	const stops = [0, 0.22, 0.39, 0.6, 1];
	const colors = [
		['#1d4ed8', '#3b82f6', '#bfdbfe'],
		['#0e7490', '#22d3ee', '#a5f3fc'],
		['#c2410c', '#f59e0b', '#fde68a'],
		['#e01e0b', '#ff6410', '#ffc24a'],
		['#b3071f', '#ff3d1a', '#ffb347']
	];
	const to = Math.max(
			1,
			stops.findIndex((stop) => stop >= ratio)
		),
		from = to - 1,
		blend = (ratio - stops[from]) / (stops[to] - stops[from]);
	for (let color = 0; color < 3; color++) {
		const a = colors[from][color],
			b = colors[to][color];
		const channels = [1, 3, 5].map((offset) =>
			Math.round(
				parseInt(a.slice(offset, offset + 2), 16) * (1 - blend) +
					parseInt(b.slice(offset, offset + 2), 16) * blend
			)
		);
		node.style.setProperty(`--athena-dial-c${color + 1}`, `rgb(${channels.join(' ')})`);
	}
}
function liquidWavePath(amplitude) {
	return `M-440 0 Q-385 ${-amplitude} -330 0 T-220 0 T-110 0 T0 0 T110 0 T220 0 T330 0 T440 0 T550 0 T660 0 T770 0 T880 0 V1800 H-440Z`;
}
function statusLiquid(name, label) {
	const svg = statusSvg,
		gradient = `athena-liquid-${name}`;
	const wave = liquidWavePath(14);
	const layer = (back) =>
		svg('g', { class: `athena-liquid-wave${back ? ' athena-liquid-wave--back' : ''}` }, [
			svg('path', {
				class: 'athena-liquid-surface',
				d: wave,
				fill: back ? '#68cfff' : `url(#${gradient})`,
				stroke: back ? 'none' : '#9ae5ff',
				'stroke-width': 1.5
			})
		]);
	const node = statusDisplay(name, label, 'liquid', [
		svg(
			'svg',
			{
				class: 'athena-status-graphic athena-liquid-graphic',
				viewBox: '0 0 440 458',
				'aria-hidden': 'true',
				focusable: 'false'
			},
			[
				svg('defs', {}, [
					svg(
						'linearGradient',
						{ id: gradient, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 458 },
						[
							svg('stop', { offset: 0, 'stop-color': '#62c9ff' }),
							svg('stop', { offset: 0.45, 'stop-color': '#187ded' }),
							svg('stop', { offset: 1, 'stop-color': '#064baf' })
						]
					)
				]),
				svg('g', { class: 'athena-liquid-level' }, [
					svg('g', { class: 'athena-liquid-tilt' }, [layer(true), layer(false)])
				])
			]
		)
	]);
	node.setAttribute('role', 'button');
	node.setAttribute('tabindex', '0');
	liquidMotion(node);
	return node;
}
function liquidMotion(node) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	let frame = 0,
		last = 0,
		angle = 0,
		velocity = 0,
		energy = 0,
		width = 0;
	const surfaces = [...node.querySelectorAll('.athena-liquid-surface')];
	const paint = () => {
		node.style.setProperty('--athena-liquid-tilt', `${angle.toFixed(3)}deg`);
		const path = liquidWavePath(+(14 * (1 + energy)).toFixed(3));
		for (const surface of surfaces)
			if (surface.getAttribute('d') !== path) surface.setAttribute('d', path);
	};
	const reset = () => {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
		last = 0;
		angle = 0;
		velocity = 0;
		energy = 0;
		paint();
	};
	const tick = (now) => {
		if (!node.isConnected || document.hidden || reduced.matches) {
			reset();
			return;
		}
		const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
		last = now;
		velocity += (-angle * 52 - velocity * 6) * dt;
		angle = Math.max(-9, Math.min(9, angle + velocity * dt));
		energy *= Math.exp(-1.8 * dt);
		paint();
		if (Math.abs(angle) < 0.015 && Math.abs(velocity) < 0.04 && energy < 0.005) {
			reset();
			return;
		}
		frame = requestAnimationFrame(tick);
	};
	const stir = (strength = 1, direction = 1) => {
		if (reduced.matches || document.hidden) return;
		velocity = Math.max(-100, Math.min(100, velocity + direction * 75 * strength));
		energy = Math.min(2.8, energy + strength * 1.7);
		if (!frame) frame = requestAnimationFrame(tick);
	};
	node.addEventListener('click', (event) =>
		stir(
			1,
			event.clientX > node.getBoundingClientRect().left + node.getBoundingClientRect().width / 2
				? 1
				: -1
		)
	);
	node.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			stir();
		}
	});
	const observer = new ResizeObserver((entries) => {
		const next = entries[0]?.contentRect.width || 0;
		if (width && next && Math.abs(next - width) > 0.5)
			stir(Math.min(1.5, 0.4 + (Math.abs(next - width) / width) * 4), next > width ? 1 : -1);
		if (next) width = next;
	});
	observer.observe(node);
	const visibility = () => {
		node.dataset.liquidPaused = String(document.hidden || reduced.matches);
		if (document.hidden || reduced.matches) reset();
	};
	document.addEventListener('visibilitychange', visibility);
	reduced.addEventListener('change', visibility);
	visibility();
}
function updateLiquid(node, percent, detail) {
	const ratio = updateDisplay(node, percent, detail);
	node.querySelector('.athena-liquid-level').style.transform =
		`translateY(${((1 - ratio) * 458).toFixed(2)}px)`;
	node.dataset.liquidHigh = String(ratio >= 0.54);
	node.dataset.liquidFull = String(ratio >= 0.85);
	node.dataset.liquidEmpty = String(ratio === 0);
}
return baseclass.extend({
	__init__: function () {
		widgets.init();
		this.renderShell();
		session.setLocalData('menu', null);
		ui.menu.menu = null;
		ui.menu
			.load()
			.then((tree) => this.renderMenu(tree))
			.catch((error) => {
				console.error('Athena menu:', error);
			});
		const board = rpc.declare({ object: 'system', method: 'board', expect: { '': {} } });
		const info = rpc.declare({ object: 'system', method: 'info', expect: { '': {} } });
		const interfaces = rpc.declare({
			object: 'network.interface',
			method: 'dump',
			expect: { interface: [] }
		});
		const overview = ['admin', 'admin-status', 'admin-status-overview'].includes(
			document.body.dataset.page
		);
		if (overview) {
			this.renderSummary();
			let running = null;
			const refresh = () => {
				if (running) return running;
				running = Promise.all([board(), info(), interfaces()])
					.then((values) => {
						this.updateSummary(...values);
						this.setVersion(values[0]);
					})
					.catch((error) => {
						console.error('Athena status:', error);
					})
					.finally(() => {
						running = null;
					});
				return running;
			};
			this.refreshButton.addEventListener('click', () => {
				const started = performance.now();
				this.refreshButton.disabled = true;
				this.refreshButton.dataset.pending = 'true';
				refresh().finally(() =>
					setTimeout(
						() => {
							this.refreshButton.disabled = false;
							delete this.refreshButton.dataset.pending;
						},
						Math.max(0, 700 - (performance.now() - started))
					)
				);
			});
			poll.add(() => (document.hidden ? Promise.resolve() : refresh()), 10);
			refresh();
		} else
			board()
				.then((value) => this.setVersion(value))
				.catch(() => {});
	},
	setVersion: function (board) {
		const label = document.getElementById('athena-version');
		if (label?.querySelector('strong'))
			label.querySelector('strong').textContent = board.release?.version || '—';
	},
	renderShell: function () {
		const sidebar = document.getElementById('athena-sidebar');
		const topbar = document.getElementById('athena-topbar');
		if (!sidebar || !topbar) return;
		let collapsed = false;
		try {
			collapsed = localStorage.getItem('athena-sidebar-collapsed') === 'true';
		} catch (e) {}
		const media = window.matchMedia('(max-width: 1024px)');
		const update = () => {
			const rail = collapsed && !media.matches;
			document.body.classList.toggle('athena-collapsed', rail);
			document.body.classList.remove('athena-drawer-open');
			for (const group of document.querySelectorAll('.athena-nav-group')) {
				const trigger = group.querySelector('.athena-nav-trigger'),
					list = group.querySelector('.athena-submenu');
				list.hidden = rail || !trigger.classList.contains('active');
				trigger.setAttribute('aria-expanded', String(!list.hidden));
			}
		};
		update();
		media.addEventListener('change', update);
		const toggle = () => {
			if (media.matches) document.body.classList.toggle('athena-drawer-open');
			else {
				collapsed = !collapsed;
				update();
				try {
					localStorage.setItem('athena-sidebar-collapsed', String(collapsed));
				} catch (e) {}
			}
		};
		const menu = makeButton('', 'ghost', toggle, 'menu');
		menu.id = 'athena-menu-toggle';
		menu.classList.add('button--icon-only');
		menu.setAttribute('aria-label', _('Toggle navigation'));
		menu.setAttribute('aria-controls', 'athena-sidebar');
		this.breadcrumb = E('div', { class: 'athena-breadcrumb', 'aria-label': _('Page location') }, [
			icon('home'),
			E('span', {}, _('Console')),
			icon('chevron'),
			E('strong', {}, 'OpenWrt')
		]);
		this.searchInput = E('input', {
			class: 'input',
			type: 'search',
			placeholder: _('Search settings\u2026'),
			'aria-label': _('Search settings'),
			input: () => this.search()
		});
		this.searchResults = E('div', {
			class: 'athena-popup dropdown__popover athena-search-results',
			hidden: true,
			role: 'listbox',
			'aria-label': _('Search results')
		});
		const modes = document.getElementById('athena-mode-controls');
		if (modes) modes.hidden = false;
		topbar.append(
			E('div', { class: 'athena-topbar-left' }, [menu, this.breadcrumb]),
			E('div', { class: 'athena-topbar-right' }, [
				E('div', { class: 'athena-search athena-popup-host' }, [
					this.searchInput,
					this.searchResults
				]),
				document.getElementById('indicators'),
				modes
			])
		);
		const close = makeButton(
			'',
			'tertiary',
			() => document.body.classList.remove('athena-drawer-open'),
			'close'
		);
		close.classList.add('athena-drawer-close', 'button--icon-only');
		close.setAttribute('aria-label', _('Close navigation'));
		sidebar.append(close);
		document
			.getElementById('athena-backdrop')
			.addEventListener('click', () => document.body.classList.remove('athena-drawer-open'));
		document.addEventListener('keydown', (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
				event.preventDefault();
				toggle();
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				this.searchInput.focus();
			}
			if (event.key === 'Escape') {
				document.body.classList.remove('athena-drawer-open');
				this.searchResults.hidden = true;
				document.querySelectorAll('.athena-account-menu').forEach((node) => (node.hidden = true));
			}
		});
		document.addEventListener('click', (event) => {
			if (!event.target.closest('.athena-popup-host')) {
				this.searchResults.hidden = true;
				document.querySelectorAll('.athena-account-menu').forEach((node) => (node.hidden = true));
			}
		});
		document.dispatchEvent(new Event('athena:mode-controls'));
		widgets.scrollShadow(document.getElementById('athena-sidebar-scroll'), 'vertical');
	},
	renderMenu: function (tree) {
		const mode = (L.env.requestpath || [])[0] || 'admin';
		const root = tree.children?.[mode];
		const current = currentPath();
		const convert = (node, parts) => ({
			name: node.name,
			title: _(node.title || node.name),
			path: parts.join('/'),
			url: L.url.apply(L, parts),
			children: ui.menu.getChildren(node).map((child) => convert(child, parts.concat(child.name)))
		});
		this.nodes = root
			? ui.menu.getChildren(root).map((node) => convert(node, [mode, node.name]))
			: [];
		const nav = document.getElementById('athena-nav');
		if (!nav) return;
		const overview = ['admin', 'admin-status', 'admin-status-overview'].includes(
			document.body.dataset.page
		);
		nav.replaceChildren(
			E(
				'li',
				{},
				E(
					'a',
					{
						class: 'athena-home' + (overview ? ' active' : ''),
						href: L.url('admin/status/overview'),
						'aria-label': _('Network overview'),
						'aria-current': overview ? 'page' : null
					},
					[icon('home'), E('span', {}, _('Network overview'))]
				)
			)
		);
		const icons = {
			status: 'status',
			system: 'system',
			services: 'services',
			network: 'network',
			vpn: 'vpn',
			statistics: 'statistics'
		};
		for (const node of this.nodes.filter((node) => node.name !== 'logout')) {
			const children = node.children.filter((child) => !child.path.endsWith('/status/overview'));
			const expanded = !overview && active(current, node.path);
			const opened = expanded && !document.body.classList.contains('athena-collapsed');
			const list = E(
				'ul',
				{ class: 'athena-submenu', hidden: !opened || null, id: 'athena-nav-' + node.name },
				(children.length ? children : [node]).map((child) =>
					E(
						'li',
						{},
						E(
							'a',
							{ href: child.url, 'aria-current': active(current, child.path) ? 'page' : null },
							child.title
						)
					)
				)
			);
			const trigger = E(
				'button',
				{
					type: 'button',
					class: 'athena-nav-trigger' + (expanded ? ' active' : ''),
					'aria-label': node.title,
					'aria-expanded': String(opened),
					'aria-controls': list.id,
					click: () => {
						list.hidden = !list.hidden;
						trigger.setAttribute('aria-expanded', String(!list.hidden));
					}
				},
				[icon(icons[node.name] || 'status'), E('span', {}, node.title), icon('chevron')]
			);
			const group = E('li', { class: 'athena-nav-group' }, [trigger, list]);
			group.addEventListener('focusin', () => {
				if (document.body.classList.contains('athena-collapsed')) {
					list.hidden = false;
					trigger.setAttribute('aria-expanded', 'true');
				}
			});
			group.addEventListener('mouseenter', () => {
				if (document.body.classList.contains('athena-collapsed')) {
					list.hidden = false;
					trigger.setAttribute('aria-expanded', 'true');
				}
			});
			group.addEventListener('mouseleave', () => {
				if (document.body.classList.contains('athena-collapsed')) {
					list.hidden = true;
					trigger.setAttribute('aria-expanded', 'false');
				}
			});
			group.addEventListener('focusout', (event) => {
				if (
					document.body.classList.contains('athena-collapsed') &&
					!group.contains(event.relatedTarget)
				) {
					list.hidden = true;
					trigger.setAttribute('aria-expanded', 'false');
				}
			});
			nav.append(group);
		}
		const section = this.nodes.find((node) => active(current, node.path));
		const leaf = flat(this.nodes)
			.filter((node) => active(current, node.path))
			.sort((a, b) => b.path.length - a.path.length)[0];
		this.breadcrumb?.replaceChildren(
			icon('home'),
			E('span', {}, section?.title || _('Console')),
			icon('chevron'),
			E(
				'strong',
				{},
				overview
					? _('Network overview')
					: leaf?.title || document.querySelector('#maincontent h2')?.textContent || 'OpenWrt'
			)
		);
		const account = document.getElementById('athena-account');
		const username = document.body.dataset.username || 'root';
		const popup = E(
			'div',
			{
				class: 'athena-popup dropdown__popover athena-account-menu',
				hidden: true,
				id: 'athena-account-menu'
			},
			[
				E('a', { href: L.url('admin/system/admin') }, _('Account management')),
				E('a', { href: L.url('admin/system/system') }, _('System settings'))
			]
		);
		const user = makeButton('', 'ghost', () => {
			popup.hidden = !popup.hidden;
			user.setAttribute('aria-expanded', String(!popup.hidden));
		});
		user.setAttribute('aria-label', _('Account menu'));
		user.setAttribute('aria-expanded', 'false');
		user.append(
			E('span', { class: 'athena-avatar' }, username.slice(0, 1).toUpperCase()),
			E('span', { class: 'athena-account-label' }, username)
		);
		account.replaceChildren(
			user,
			E(
				'a',
				{
					class: 'button button--tertiary button--sm',
					href: this.nodes.find((node) => node.name === 'logout')?.url || L.url('admin/logout'),
					'aria-label': _('Log out')
				},
				[icon('logout'), E('span', { class: 'athena-account-label' }, _('Log out'))]
			),
			popup
		);
		let node = tree,
			parts = [];
		const dispatch = L.env.dispatchpath || [];
		for (let i = 0; i < Math.min(3, dispatch.length) && node; i++) {
			node = node.children?.[dispatch[i]];
			parts.push(dispatch[i]);
		}
		if (node && dispatch.length >= 3) this.renderTabMenu(node, parts.join('/'));
	},
	renderTabMenu: function (node, path) {
		const children = ui.menu.getChildren(node);
		if (!children.length) return;
		const current = currentPath();
		const menu = E(
			'ul',
			{ class: 'tabs' },
			children.map((child) =>
				E(
					'li',
					{ class: active(current, path + '/' + child.name) ? 'active' : '' },
					E(
						'a',
						{ href: L.url.apply(L, path.split('/').concat(child.name)) },
						_(child.title || child.name)
					)
				)
			)
		);
		const target = document.getElementById('tabmenu');
		if (target) {
			target.replaceChildren(menu);
			target.hidden = false;
		}
	},
	search: function () {
		const query = this.searchInput.value.trim().toLocaleLowerCase();
		const results = query
			? flat(this.nodes || [])
					.filter(
						(node) => node.name !== 'logout' && node.title.toLocaleLowerCase().includes(query)
					)
					.slice(0, 8)
			: [];
		this.searchResults.replaceChildren(
			...results.map((node) => E('a', { href: node.url, role: 'option' }, node.title))
		);
		this.searchResults.hidden = !query;
		if (query && !results.length) this.searchResults.append(E('p', {}, _('No matching settings')));
	},
	renderSummary: function () {
		const root = document.getElementById('athena-summary');
		if (!root) return;
		this.refreshButton = makeButton(_('Refresh'), 'tertiary', null, 'refresh');
		this.refreshButton.classList.add('athena-refresh');
		root.append(
			E('div', { class: 'athena-summary-heading' }, [
				E('div', {}, [
					E('p', { class: 'athena-metric-detail' }, _('Device management')),
					E('h1', {}, _('Network overview')),
					E('p', {}, _('Your device and connections, at a glance.'))
				]),
				this.refreshButton
			])
		);
		const definitions = [
			['internet', _('Internet')],
			['load', _('System load')],
			['memory', _('Memory')],
			['storage', _('Storage')]
		];
		root.append(
			E(
				'div',
				{ class: 'athena-metrics' },
				definitions.map(([name, label]) =>
					['load', 'memory'].includes(name)
						? statusDial(name, label)
						: name === 'storage'
							? statusLiquid(name, label)
							: statusInternet(name, label)
				)
			)
		);
	},
	updateSummary: function (board, info, interfaces) {
		const wan = interfaces.find((node) => node.interface === 'wan');
		const memory = info.memory || {};
		const used = Math.max(0, (memory.total || 0) - (memory.available ?? memory.free ?? 0));
		const root = info.root || {};
		const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);
		const cores = Number(document.getElementById('athena-summary')?.dataset.cpuCount) || 0;
		const load = Number.isFinite(info.load?.[0]) ? info.load[0] / 65536 : null;
		const loadDetail =
			load == null
				? _('Waiting for load data')
				: _('1 min average') +
					' ' +
					load.toFixed(2) +
					(cores ? ` · ${cores}${' ' + _('cores')}` : '');
		const values = {
			internet: [
				wan?.up ? _('Connected') : _('Disconnected'),
				'WAN · ' + (wan?.['ipv4-address']?.[0]?.address || '—')
			],
			load: [cores && load != null ? (load / cores) * 100 : null, loadDetail],
			memory: [
				memory.total ? Math.min(100, (used / memory.total) * 100) : null,
				memory.total
					? `${Math.round(used / 1048576)} MiB / ${Math.round(memory.total / 1048576)} MiB`
					: _('Waiting for memory data')
			],
			storage: [
				root.total ? percent(root.used, root.total) : null,
				root.total
					? `${((root.used || 0) / 1024).toFixed(1)} MiB / ${(root.total / 1024).toFixed(1)} MiB`
					: _('Waiting for storage data')
			]
		};
		for (const [name, [value, detail]] of Object.entries(values)) {
			const node = document.querySelector(`[data-metric="${name}"]`);
			if (!node) continue;
			if (name === 'internet') node.dataset.connected = String(!!wan?.up);
			if (node.classList.contains('athena-metric--dial')) {
				updateDial(node, value, detail);
				continue;
			}
			if (node.classList.contains('athena-metric--liquid')) {
				updateLiquid(node, value, detail);
				continue;
			}
			if (node.querySelector('.athena-metric-value').textContent !== value)
				node.querySelector('.athena-metric-value').textContent = value;
			if (node.querySelector('.athena-metric-detail').textContent !== detail)
				node.querySelector('.athena-metric-detail').textContent = detail;
		}
		const minutes = Math.floor((info.uptime || 0) / 60),
			hours = Math.floor(minutes / 60);
		document.querySelector('.athena-uptime-value').textContent =
			`${hours}${_('h') + ' '}${minutes % 60}${_('m')}`;
		document.getElementById('athena-last-update').textContent =
			_('Updated') +
			' ' +
			new Date().toLocaleTimeString(document.documentElement.lang, { hour12: false });
	}
});
