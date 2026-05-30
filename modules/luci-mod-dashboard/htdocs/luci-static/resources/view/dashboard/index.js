'use strict';
'require view';
'require dom';
'require poll';
'require fs';
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
			tasks.push(includes[i].load().catch(L.bind(() => {
				this.failed = true;
			}, includes[i])));

			has_load = true;
		}
		else {
			tasks.push(null);
		}
	}

	return has_load ? Promise.all(tasks) : Promise.resolve(null);
}

function startPolling(includes, containers) {
	const step = () => {
		return network.flushCache().then(() => {
			return invokeIncludesLoad(includes);
		}).then(results => {
			for (let i = 0; i < includes.length; i++) {
				let content = null;

				if (includes[i].failed)
					continue;

				if (typeof(includes[i].render) == 'function')
					content = includes[i].render(results ? results[i] : null);
				else if (includes[i].content != null)
					content = includes[i].content;

				if (content != null) {

					if (i > 1) {
						dom.append(containers[1], content);
					} else {
						containers[i].parentNode.style.display = '';
						containers[i].parentNode.classList.add('fade-in');
						containers[i].parentNode.classList.add('Dashboard');
						dom.content(containers[i], content);
					}
				}
			}

			const ssi = document.querySelector('div.includes');
			if (ssi) {
				ssi.style.display = '';
				ssi.classList.add('fade-in');
			}
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
		const rv = E([]);
		const containers = [];

		for (let i = 0; i < includes.length - 1; i++) {

			const container = E('div', { 'class': 'section-content' });

			rv.appendChild(E('div', { 'class': 'cbi-section-' + i, 'style': 'display:none' }, [
				container
			]));

			containers.push(container);
		}

		return startPolling(includes, containers).then(() => {
			return rv;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
