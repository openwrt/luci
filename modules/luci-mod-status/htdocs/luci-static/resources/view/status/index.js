'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require network';
'require ui';

return view.extend({
	handleToggleSection: function(include, container, ev) {
		var btn = ev.currentTarget;

		include.hide = !include.hide;

		btn.setAttribute('data-style', include.hide ? 'active' : 'inactive');
		btn.setAttribute('class', include.hide ? 'label notice' : 'label');
		btn.firstChild.data = include.hide ? _('Show') : _('Hide');
		btn.blur();

		container.style.display = include.hide ? 'none' : 'block';

		if (include.hide) {
			localStorage.setItem(include.id, 'hide');
		} else {
			dom.content(container,
				E('p', {}, E('em', { 'class': 'spinning' },
					[ _('Collecting data...') ])
				)
			);

			localStorage.removeItem(include.id);
		}
	},

	invokeIncludesLoad: function(includes, first_load) {
		var tasks = [], has_load = false;

		for (var i = 0; i < includes.length; i++) {
			if (includes[i].hide && !first_load) {
				tasks.push(null);
				continue;
			}

			if (typeof(includes[i].load) == 'function') {
				tasks.push(includes[i].load().catch(L.bind(function() {
					this.failed = true;
				}, includes[i])));

				has_load = true;
			}
			else {
				tasks.push(null);
			}
		}

		return has_load ? Promise.all(tasks) : Promise.resolve(null);
	},

	poll_status: function(includes, containers, first_load) {
		return network.flushCache().then(L.bind(
			this.invokeIncludesLoad, this, includes, first_load
		)).then(function(results) {
			for (var i = 0; i < includes.length; i++) {
				var content = null;

				if (includes[i].hide && !first_load)
					continue;

				if (includes[i].failed)
					continue;

				if (typeof(includes[i].render) == 'function')
					content = includes[i].render(results ? results[i] : null);
				else if (includes[i].content != null)
					content = includes[i].content;

				if (typeof (includes[i].oneshot) == 'function') {
					includes[i].oneshot(results ? results[i] : null);
					includes[i].oneshot = null;
				}

				if (content != null) {
					containers[i].parentNode.style.display = '';
					containers[i].parentNode.classList.add('fade-in');

					if (!includes[i].hide)
						dom.content(containers[i], content);
				}
			}

			var ssi = document.querySelector('div.includes');
			if (ssi) {
				ssi.style.display = '';
				ssi.classList.add('fade-in');
			}
		});
	},

	load: function() {
		return L.resolveDefault(fs.list('/www' + L.resource('view/status/include')), []).then(function(entries) {
			return Promise.all(entries.filter(function(e) {
				return (e.type == 'file' && e.name.match(/\.js$/));
			}).map(function(e) {
				return 'view.status.include.' + e.name.replace(/\.js$/, '');
			}).sort().map(function(n) {
				return L.require(n);
			}));
		});
	},

	render: function(includes) {
		var rv = E([]), containers = [];

		for (var i = 0; i < includes.length; i++) {
			var title = null;

			if (includes[i].title != null)
				title = includes[i].title;
			else
				title = String(includes[i]).replace(/^\[ViewStatusInclude\d+_(.+)Class\]$/,
					function(m, n) { return n.replace(/(^|_)(.)/g,
						function(m, s, c) { return (s ? ' ' : '') + c.toUpperCase() })
					});

			includes[i].id = title;
			includes[i].hide = localStorage.getItem(includes[i].id) == 'hide';

			var container = E('div');

			rv.appendChild(E('div', { 'class': 'cbi-section', 'style': 'display: none' }, [
				E('div', { 'class': 'cbi-title' },[
					title != '' ? E('h3', title) : '',
					E('div', [
						E('span', {
							'class': includes[i].hide ? 'label notice' : 'label',
							'data-style': includes[i].hide ? 'active' : 'inactive',
							'data-indicator': 'poll-status',
							'data-clickable': 'true',
							'click': ui.createHandlerFn(this, 'handleToggleSection',
										    includes[i], container)
						}, [ _(includes[i].hide ? 'Show' : 'Hide') ])
					]),
				]),
				container
			]));

			containers.push(container);
		}

		return this.poll_status(includes, containers, true).then(L.bind(function() {
			return poll.add(L.bind(this.poll_status, this, includes, containers))
		}, this)).then(function() {
			return rv;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
