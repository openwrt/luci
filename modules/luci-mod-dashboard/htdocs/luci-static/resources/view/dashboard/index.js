'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';
'require network';

document.querySelector('head').appendChild(E('link', {
	'rel': 'stylesheet',
	'type': 'text/css',
	'href': L.resource('view/dashboard/css/custom.css')
}));

function invokeIncludesLoad(includes) {
	const tasks = [];
	let has_load = false;

	for (let i = 0; i < includes.length; i++) {
		if (typeof(includes[i].load) == 'function') {
			tasks.push(includes[i].load().catch(function() {
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

function collectSections(includes, results) {
	const sections = { kpi: [], charts: [], tabs: [], extra: [] };

	for (let i = 0; i < includes.length; i++) {
		let content = null;

		if (includes[i].failed)
			continue;

		try {
			if (typeof(includes[i].render) == 'function')
				content = includes[i].render(results ? results[i] : null);
			else if (includes[i].content != null)
				content = includes[i].content;
		}
		catch (e) {
			console.error(e);
			continue;
		}

		if (content == null)
			continue;

		if (content instanceof Node || Array.isArray(content)) {
			sections.extra.push(content);
			continue;
		}

		for (const key of [ 'kpi', 'charts', 'tabs' ])
			(content[key] || []).forEach(item => sections[key].push(item));
	}

	return sections;
}

function renderSections(sections) {
	const nodes = [];

	if (sections.kpi.length)
		nodes.push(E('div', { 'class': 'dashboard-kpi-row' }, sections.kpi));

	if (sections.charts.length)
		nodes.push(E('div', { 'class': 'dashboard-charts' }, sections.charts));

	if (sections.tabs.length)
		nodes.push(E('div', { 'class': 'dashboard-card dashboard-tabs', 'data-section-id': 'dashboard' }, [
			E('div', { 'class': 'dashboard-tab-group' }, sections.tabs.map(tab => E('div', {
				'data-tab': tab.id,
				'data-tab-title': (tab.count != null) ? '%s (%d)'.format(tab.title, tab.count) : tab.title
			}, tab.content)))
		]));

	if (sections.extra.length)
		nodes.push(E('div', { 'class': 'dashboard-extra' }, sections.extra));

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

function startPolling(includes, root) {
	const step = () => {
		return network.flushCache().then(() => {
			return invokeIncludesLoad(includes);
		}).then(results => {
			const positions = saveChartScroll(root);

			dom.content(root, renderSections(collectSections(includes, results)));

			const group = root.querySelector('.dashboard-tab-group');
			if (group)
				ui.tabs.initTabGroup(group.childNodes);

			restoreChartScroll(root, positions);
			root.classList.add('fade-in');
		});
	};

	return step().then(() => {
		poll.add(step);
	});
}

return view.extend({
	load() {
		return L.resolveDefault(fs.list('/www' + L.resource('view/dashboard/include')), []).then(entries => {
			return Promise.all(entries.filter(e => {
				return (e.type == 'file' && e.name.match(/\.js$/));
			}).map(e => {
				return 'view.dashboard.include.' + e.name.replace(/\.js$/, '');
			}).sort().map(n => {
				return L.require(n);
			}));
		});
	},

	render(includes) {
		const root = E('div', { 'class': 'Dashboard' });

		return startPolling(includes, root).then(() => {
			return root;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
