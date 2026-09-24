'use strict';
'require view';
'require poll';
'require ui';
'require network';
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
						const value = (slot == 'tabs') ? item.content : item.node;
						const node = (typeof(value) == 'function') ? value() : value;

						found[slot][item.id] = (slot == 'tabs') ? Object.assign({}, item, { content: node }) : node;
					}
				});
		}
		catch (e) {
			console.error(e);
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

	rowSizes(nodes.length, ROWS[slot].max, ROWS[slot].shortFirst).forEach(size => {
		for (let n = 0; n < size; n++)
			nodes[i++].style.setProperty('--dashboard-per-row', size);
	});

	return nodes;
}

function renderSections(sections, keep) {
	const nodes = [];

	if (sections.cards.length)
		nodes.push(E('div', { 'class': 'dashboard-kpi-row' }, fillRows(sections.cards, 'cards')));

	if (sections.charts.length)
		nodes.push(E('div', { 'class': 'dashboard-charts' }, fillRows(sections.charts, 'charts')));

	if (keep)
		nodes.push(keep);
	else if (sections.tabs.length)
		nodes.push(E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-map-tabbed' }, sections.tabs.map(tab => E('div', {
				'class': 'cbi-section',
				'data-tab': tab.id,
				'data-tab-title': (tab.count != null) ? '%s (%d)'.format(tab.title, tab.count) : tab.title
			}, tab.content)))
		]));

	if (sections.extra.length)
		nodes.push(E('div', {}, sections.extra));

	return nodes;
}

function saveChartScroll(root) {
	const positions = {};

	root.querySelectorAll('[data-chart]').forEach(node => {
		if (node.dataset.chart)
			positions[node.dataset.chart] = node.scrollLeft;
	});

	return positions;
}

function restoreChartScroll(root, positions) {
	root.querySelectorAll('[data-chart]').forEach(node => {
		if (positions[node.dataset.chart])
			node.scrollLeft = positions[node.dataset.chart];
	});
}

function startPolling(includes, layout, root, form) {
	let loading = null;

	const showForm = () => {
		loading ??= L.require('view.dashboard.lib.layout')
			.then(layoutForm => layoutForm.render(includes))
			.then(node => L.dom.content(form, node));
	};

	const step = () => {
		return network.flushCache().then(() => {
			return invokeIncludesLoad(includes, layout);
		}).then(results => {
			const positions = saveChartScroll(root);

			const sections = collectSections(includes, results, layout);

			if (form)
				sections.tabs.push({ id: 'layout', title: _('Layout'), content: form });

			// The tabs are left alone while the layout form is looked at,
			// for a redraw not to take away what is being edited.
			const tabs = root.querySelector(':scope > .cbi-map');
			const keep = (tabs && tabs.querySelector('[data-tab="layout"][data-tab-active="true"]')) ? tabs : null;
			let before = keep;

			Array.from(root.childNodes).filter(node => node !== keep).forEach(node => root.removeChild(node));

			renderSections(sections, keep).forEach(node => {
				if (node === keep)
					before = null;
				else
					root.insertBefore(node, before);
			});

			const group = keep ? null : root.querySelector('.cbi-map-tabbed');
			if (group) {
				if (form)
					form.parentNode.addEventListener('cbi-tab-active', showForm);

				ui.tabs.initTabGroup(group.childNodes);
			}

			restoreChartScroll(root, positions);
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

		const form = L.hasViewPermission() ? E('div', {}, [ E('em', { 'class': 'spinning' }, [ _('Loading view…') ]) ]) : null;

		return startPolling(includes, layout, root, form).then(() => root);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
