'use strict';
'require view';
'require poll';
'require ui';
'require network';
'require view.dashboard.lib.charts as charts';
'require view.dashboard.lib.widgets as widgets';

document.querySelector('head').appendChild(E('link', {
	'rel': 'stylesheet',
	'type': 'text/css',
	'href': L.resource('view/dashboard/css/custom.css') + (L.env.resource_version ? '?v=' + L.env.resource_version : '')
}));

const ROWS = {
	cards: { max: 5, shortFirst: false },
	charts: { max: 3, shortFirst: true }
};

function invokeIncludesLoad(includes, layout) {
	const tasks = [];
	let has_load = false;

	for (let i = 0; i < includes.length; i++) {
		const declared = includes[i].widgets || [];

		includes[i].failed = false;
		includes[i].topologyEnabled = layout.charts.includes('topology');

		includes[i].skipped = (declared.length > 0 && !declared.some(widget => layout[widget.slot]?.includes(widget.id)));

		if (includes[i].skipped) {
			tasks.push(null);
		}
		else if (typeof(includes[i].load) == 'function') {
			tasks.push(includes[i].load().catch(function(e) {
				console.error(e);
				this.failed = true;
			}.bind(includes[i])));

			has_load = true;
		}
		else {
			tasks.push(null);
		}
	}

	return has_load ? Promise.all(tasks) : Promise.resolve(null);
}

function collectSections(includes, results, layout) {
	const sections = { cards: [], charts: [], tabs: [], extra: [] };
	const found = { cards: {}, charts: {}, tabs: {} };

	for (let i = 0; i < includes.length; i++) {
		let content = null;

		if (includes[i].failed || includes[i].skipped)
			continue;

		try {
			if (typeof(includes[i].render) == 'function')
				content = includes[i].render(results ? results[i] : null);
			else if (includes[i].content != null)
				content = includes[i].content;

			if (content == null)
				continue;

			if (content instanceof Node || Array.isArray(content)) {
				sections.extra.push(content);
				continue;
			}

			// Items may defer building their node or tab content until selected.
			// Includes without widget declarations keep their original behavior.
			for (const slot of widgets.slots)
				(content[slot] || (slot == 'cards' ? content.kpi : null) || []).forEach(item => {
					if (item instanceof Node)
						sections[slot].push(item);
					else if (includes[i].widgets == null)
						sections[slot].push((slot == 'tabs') ? item : item.node);
					else if (layout[slot].includes(item.id)) {
						found[slot][item.id] = slot === 'tabs' ? item
							: typeof(item.node) === 'function' ? item.node() : item.node;
					}
				});
		}
		catch (e) {
			console.error(e);
			includes[i].failed = true;
			continue;
		}
	}

	for (const slot of widgets.slots)
		sections[slot] = layout[slot].map(id => found[slot][id]).filter(item => item != null).concat(sections[slot]);

	return sections;
}

// Split n items into rows of at most max items, as evenly as possible.
function rowSizes(n, max, shortFirst) {
	const rows = Math.ceil(n / max);
	const base = Math.floor(n / rows);
	const extra = n % rows;
	const sizes = [];

	for (let i = 0; i < rows; i++)
		sizes.push(base + ((shortFirst ? i >= rows - extra : i < extra) ? 1 : 0));

	return sizes;
}

function fillRows(nodes, slot) {
	let i = 0;
	const regular = nodes.filter(node => {
		if (node.dataset.dashboardSpan != 'full')
			return true;
		node.style.setProperty('--dashboard-per-row', 1);
		return false;
	});

	rowSizes(regular.length, ROWS[slot].max, ROWS[slot].shortFirst).forEach(size => {
		for (let n = 0; n < size; n++)
			regular[i++].style.setProperty('--dashboard-per-row', size);
	});

	return nodes;
}

function updateShell(root, sections, containers) {
	const desired = [
		sections.cards.length ? containers.cards : null,
		sections.charts.length ? containers.charts : null,
		sections.tabs.length ? containers.tabs : null,
		sections.extra.length ? containers.extra : null
	].filter(Boolean);

	desired.forEach((node, i) => {
		if (root.children[i] !== node)
			root.insertBefore(node, root.children[i] || null);
	});

	while (root.children.length > desired.length)
		root.removeChild(root.lastChild);
}

function updateCharts(container, chartNodes) {
	const scrollPositions = {};
	container.querySelectorAll('[data-chart]').forEach(el => {
		if (el.dataset.chart)
			scrollPositions[el.dataset.chart] = el.scrollLeft;
	});

	charts.updateNodes(container, fillRows(chartNodes, 'charts'));

	container.querySelectorAll('[data-chart]').forEach(el => {
		if (el.dataset.chart && scrollPositions[el.dataset.chart] != null)
			el.scrollLeft = scrollPositions[el.dataset.chart];
	});
}

// A hidden tab retains only its newest pending render, not a DOM per sample.
const pendingTabs = new WeakMap();

function renderPendingTab(pane) {
	const tab = pendingTabs.get(pane);
	if (!tab || pane.dataset.tabActive !== 'true')
		return;
	pendingTabs.delete(pane);
	try {
		const content = tab.content();
		if (pane.childNodes.length !== 1 || pane.firstChild !== content)
			L.dom.content(pane, content);
	}
	catch (e) {
		console.error(e);
		L.dom.content(pane, E('em', {}, _('Details unavailable.')));
	}
}

function updateTabs(tabMap, tabGroup, items, form) {
	const menu = tabMap.querySelector('.cbi-tabmenu');
	const existingPanes = Array.from(tabGroup.children);
	const existingIds = existingPanes.map(pane => pane.dataset.tab);
	const itemIds = items.map(tab => tab.id);

	const changed = !tabGroup.hasAttribute('data-initialized') ||
		existingIds.length !== itemIds.length ||
		existingIds.some((id, i) => id !== itemIds[i]);

	if (changed) {
		if (menu)
			menu.remove();
		tabGroup.removeAttribute('data-initialized');

		const activePane = existingPanes.find(p => p.getAttribute('data-tab-active') === 'true');
		const activeId = activePane ? activePane.dataset.tab : null;

		while (tabGroup.firstChild)
			tabGroup.removeChild(tabGroup.firstChild);

		items.forEach(tab => {
			// LuCI hides empty panes; keep a placeholder until first activation.
			const pane = (tab.id === 'layout' && form) ? form : E('div', {
				'class': 'cbi-section dashboard-detail',
				'id': 'dashboard-detail-' + tab.id,
				'data-tab': tab.id,
				'data-tab-title': (tab.count != null) ? '%s (%d)'.format(tab.title, tab.count) : tab.title
			}, typeof(tab.content) === 'function' ? E('em', {}, _('Loading view…')) : tab.content);

			if (typeof(tab.content) === 'function')
				pendingTabs.set(pane, tab);
			if (tab.id !== 'layout')
				pane.addEventListener('cbi-tab-active', () => renderPendingTab(pane));

			if (tab.id === activeId)
				pane.setAttribute('data-tab-active', 'true');

			tabGroup.appendChild(pane);
		});

		ui.tabs.initTabGroup(tabGroup.childNodes);
	}
	else {
		items.forEach(tab => {
			const pane = tabGroup.querySelector(':scope > [data-tab="' + tab.id + '"]');
			if (!pane)
				return;

			const newTitle = (tab.count != null) ? '%s (%d)'.format(tab.title, tab.count) : tab.title;
			if (pane.dataset.tabTitle !== newTitle) {
				pane.dataset.tabTitle = newTitle;
				const link = menu ? menu.querySelector('li[data-tab="' + tab.id + '"] > a') : null;
				if (link && link.textContent !== newTitle)
					link.textContent = newTitle;
			}

			if (tab.id === 'layout')
				return;

			if (typeof(tab.content) === 'function') {
				pendingTabs.set(pane, tab);
				renderPendingTab(pane);
			}
			else if (tab.content && (pane.childNodes.length !== 1 || pane.firstChild !== tab.content)) {
				pendingTabs.delete(pane);
				L.dom.content(pane, tab.content);
			}
		});
	}
}

function startPolling(includes, layout, root, form) {
	let loading = null;

	const showForm = () => {
		loading ??= L.require('view.dashboard.lib.layout')
			.then(layoutForm => layoutForm.render(includes))
			.then(node => L.dom.content(form, node));
	};

	if (form)
		form.addEventListener('cbi-tab-active', showForm);

	const cardsContainer = E('div', { 'class': 'dashboard-kpi-row' });
	const chartsContainer = E('div', { 'class': 'dashboard-charts' });
	const tabGroup = E('div', { 'class': 'cbi-map-tabbed' });
	const tabMap = E('div', { 'class': 'cbi-map' }, [ tabGroup ]);
	const extraContainer = E('div', {});

	const containers = {
		cards: cardsContainer,
		charts: chartsContainer,
		tabs: tabMap,
		extra: extraContainer
	};
	const headerOffset = () => {
		const header = document.querySelector('header');
		return header && [ 'fixed', 'sticky' ].includes(getComputedStyle(header).position)
			? Math.max(0, header.getBoundingClientRect().bottom) : 0;
	};
	// Themes may scroll the content pane instead of the browser window.
	// Resolve it only on navigation, never in the polling loop.
	const scrollFrame = target => {
		for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
			if ((/^(auto|scroll)$/).test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
				const rect = parent.getBoundingClientRect();
				return { node: parent, top: Math.max(headerOffset(), rect.top), bottom: Math.min(window.innerHeight, rect.bottom) };
			}
		}
		return { node: window, top: headerOffset(), bottom: window.innerHeight };
	};
	const scrollToTarget = (frame, top) => {
		const offset = frame.node === window ? window.scrollY : frame.node.scrollTop;
		frame.node.scrollTo({ top: Math.max(0, offset + top - frame.top - 16), behavior: 'auto' });
	};
	const topologyTarget = ({ network, client }) => Array.from(root.querySelectorAll('[data-dashboard-overview] [data-dashboard-network]'))
		.find(link => (link.dataset.dashboardNetwork || null) === (network || null) &&
			(link.dataset.dashboardClient || null) === (client || null));
	const showTopology = location => {
		const overview = root.querySelector('[data-dashboard-overview]');
		if (!overview)
			return;
		overview.dispatchEvent(new CustomEvent('dashboard-topology-reveal', { detail: location || {} }));
		const target = topologyTarget(location) || overview.querySelector('.dashboard-topology-node[aria-current="true"]');
		if (target?.isConnected)
			target.focus({ preventScroll: true });
		const frame = scrollFrame(target?.isConnected ? target : overview);
		const overviewRect = overview.getBoundingClientRect();
		const targetRect = target?.isConnected ? target.getBoundingClientRect() : null;
		// Preserve the overview context only when the requested node fits below it.
		const fits = !targetRect || targetRect.bottom - overviewRect.top <= frame.bottom - frame.top - 32;
		scrollToTarget(frame, fits ? overviewRect.top : targetRect.top);
	};
	root.addEventListener('dashboard-client-selection', ev => {
		const location = {
			tab: 'wifi', network: ev.detail.network || null,
			client: ev.detail.client ? String(ev.detail.client).toUpperCase() : null
		};
		root.querySelectorAll('[data-dashboard-overview]').forEach(overview => {
			overview.dispatchEvent(new CustomEvent('dashboard-topology-selection', { detail: location }));
		});
	});

	// Widgets declare destinations; the shell owns native LuCI tab activation.
	// Use the tab's own click handler so its state and events stay in sync.
	root.addEventListener('click', ev => {
		const locator = ev.target.closest('[data-dashboard-locate]');
		if (locator && root.contains(locator)) {
			ev.preventDefault();
			const location = {
				tab: 'wifi', network: locator.dataset.dashboardNetwork || null,
				client: String(locator.dataset.dashboardLocate).toUpperCase()
			};
			const owner = includes.find(include => include.widgets?.some(widget => widget.slot == 'tabs' && widget.id == 'wifi'));
			owner?.selectClient?.(location);
			showTopology(location);
			return;
		}
		const source = ev.target.closest('[data-dashboard-tab]');
		if (!source || !root.contains(source))
			return;
		ev.preventDefault();
		const id = source.dataset.dashboardTab;
		const tab = Array.from(tabMap.querySelectorAll('.cbi-tabmenu > li'))
			.find(node => node.dataset.tab == id)?.querySelector('a');
		const pane = Array.from(tabGroup.children).find(node => node.dataset.tab == id);
		if (!tab || !pane)
			return;
		const destination = {
			network: source.dataset.dashboardNetwork || null,
			client: source.dataset.dashboardClient ? source.dataset.dashboardClient.toUpperCase() : null,
			section: source.dataset.dashboardSection || null
		};
		if (id !== 'wifi')
			source.closest('[data-dashboard-overview]')?.dispatchEvent(new CustomEvent('dashboard-topology-selection', {
				detail: Object.assign({ tab: id }, destination)
			}));
		tab.click();
		const owner = includes.find(include => include.widgets?.some(widget => widget.slot == 'tabs' && widget.id == id));
		const destinationNode = owner?.navigate?.(destination);
		const section = Array.from(pane.querySelectorAll('[data-dashboard-section]'))
			.find(node => node.dataset.dashboardSection == source.dataset.dashboardSection);
		const row = (destination.client || destination.network) ? Array.from(pane.querySelectorAll('[data-dashboard-client-row]'))
			.find(node => (!destination.client || node.dataset.dashboardClientRow === destination.client) &&
				(!destination.network || node.dataset.dashboardNetwork === destination.network)) : null;
		const target = destinationNode || row || section || pane;
		target.tabIndex = -1;
		target.focus({ preventScroll: true });
		// Keep the tab bar in view when the section fits; on a narrow screen,
		// scroll straight to the requested list instead of stopping at cards.
		const frame = scrollFrame(target);
		const menu = tabMap.querySelector('.cbi-tabmenu');
		// Keep the active destination visible in horizontally scrolling themes.
		const menuRect = menu.getBoundingClientRect();
		const tabRect = tab.parentElement.getBoundingClientRect();
		if (tabRect.left < menuRect.left || tabRect.right > menuRect.right)
			menu.scrollLeft += tabRect.left - menuRect.left - (menu.clientWidth - tabRect.width) / 2;
		const menuTop = menu.getBoundingClientRect().top;
		const rect = target.getBoundingClientRect();
		const fits = rect.bottom - menuTop <= frame.bottom - frame.top - 32;
		const top = (destinationNode || row || section) && !fits ? rect.top : menuTop;
		scrollToTarget(frame, top);
	});

	const step = () => {
		return network.flushCache().then(() => {
			return invokeIncludesLoad(includes, layout);
		}).then(results => {
			const sections = collectSections(includes, results, layout);
			const consumers = includes.filter(include => !include.failed && !include.skipped && include.updateTopology);
			if (consumers.length) {
				const wifiSource = includes.find(include => include.topologySource === 'wifi');
				const snapshot = {
					wifiSupported: !!wifiSource,
					wifi: (wifiSource && !wifiSource.failed && !wifiSource.skipped) ? wifiSource.getTopologyData() : null
				};
				consumers.forEach(include => include.updateTopology(snapshot));
			}

			if (form)
				sections.tabs.push({ id: 'layout', title: _('Settings'), content: [] });

			updateShell(root, sections, containers);

			if (sections.cards.length)
				charts.updateNodes(cardsContainer, fillRows(sections.cards, 'cards'));

			if (sections.charts.length)
				updateCharts(chartsContainer, sections.charts);

			if (sections.tabs.length)
				updateTabs(tabMap, tabGroup, sections.tabs, form);

			root.querySelectorAll('[data-dashboard-tab]').forEach(link => {
				const available = sections.tabs.some(tab => tab.id == link.dataset.dashboardTab);
				link.disabled = !available;
				link.title = available ? '' : _('Details unavailable.');
			});

			if (sections.extra.length)
				L.dom.content(extraContainer, sections.extra);

			root.classList.add('fade-in');
		});
	};

	return step().then(() => {
		poll.add(step);

		// Only resume what was stopped here, not a poll the user has paused.
		let paused = false;

		document.addEventListener('visibilitychange', () => {
			if (document.hidden)
				paused = poll.stop();
			else if (paused)
				paused = !poll.start();
		});
	});
}

return view.extend({
	load() {
		return widgets.load().then(includes => {
			return widgets.layout(includes).then(layout => [ includes, layout ]);
		});
	},

	render([ includes, layout ]) {
		const root = E('div', { 'class': 'Dashboard' });

		document.addEventListener('uci-applied', () => window.location.reload());

		const form = L.hasViewPermission() ? E('div', { 'class': 'cbi-section', 'data-tab': 'layout', 'data-tab-title': _('Settings') }, [ E('em', { 'class': 'spinning' }, [ _('Loading view…') ]) ]) : null;

		return startPolling(includes, layout, root, form).then(() => root);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
