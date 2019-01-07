var modalDiv = null,
    tooltipDiv = null,
    tooltipTimeout = null;

return L.Class.extend({
	__init__: function() {
		modalDiv = document.body.appendChild(
			L.dom.create('div', { id: 'modal_overlay' },
				L.dom.create('div', { class: 'modal', role: 'dialog', 'aria-modal': true })));

		tooltipDiv = document.body.appendChild(
			L.dom.create('div', { class: 'cbi-tooltip' }));

		/* setup old aliases */
		L.showModal = this.showModal;
		L.hideModal = this.hideModal;
		L.showTooltip = this.showTooltip;
		L.hideTooltip = this.hideTooltip;
		L.itemlist = this.itemlist;

		document.addEventListener('mouseover', this.showTooltip.bind(this), true);
		document.addEventListener('mouseout', this.hideTooltip.bind(this), true);
		document.addEventListener('focus', this.showTooltip.bind(this), true);
		document.addEventListener('blur', this.hideTooltip.bind(this), true);

		document.addEventListener('luci-loaded', this.tabs.init.bind(this.tabs));
	},

	/* Modal dialog */
	showModal: function(title, children) {
		var dlg = modalDiv.firstElementChild;

		dlg.setAttribute('class', 'modal');

		L.dom.content(dlg, L.dom.create('h4', {}, title));
		L.dom.append(dlg, children);

		document.body.classList.add('modal-overlay-active');

		return dlg;
	},

	hideModal: function() {
		document.body.classList.remove('modal-overlay-active');
	},

	/* Tooltip */
	showTooltip: function(ev) {
		var target = findParent(ev.target, '[data-tooltip]');

		if (!target)
			return;

		if (tooltipTimeout !== null) {
			window.clearTimeout(tooltipTimeout);
			tooltipTimeout = null;
		}

		var rect = target.getBoundingClientRect(),
		    x = rect.left              + window.pageXOffset,
		    y = rect.top + rect.height + window.pageYOffset;

		tooltipDiv.className = 'cbi-tooltip';
		tooltipDiv.innerHTML = '▲ ';
		tooltipDiv.firstChild.data += target.getAttribute('data-tooltip');

		if (target.hasAttribute('data-tooltip-style'))
			tooltipDiv.classList.add(target.getAttribute('data-tooltip-style'));

		if ((y + tooltipDiv.offsetHeight) > (window.innerHeight + window.pageYOffset)) {
			y -= (tooltipDiv.offsetHeight + target.offsetHeight);
			tooltipDiv.firstChild.data = '▼ ' + tooltipDiv.firstChild.data.substr(2);
		}

		tooltipDiv.style.top = y + 'px';
		tooltipDiv.style.left = x + 'px';
		tooltipDiv.style.opacity = 1;

		tooltipDiv.dispatchEvent(new CustomEvent('tooltip-open', {
			bubbles: true,
			detail: { target: target }
		}));
	},

	hideTooltip: function(ev) {
		if (ev.target === tooltipDiv || ev.relatedTarget === tooltipDiv ||
		    tooltipDiv.contains(ev.target) || tooltipDiv.contains(ev.relatedTarget))
			return;

		if (tooltipTimeout !== null) {
			window.clearTimeout(tooltipTimeout);
			tooltipTimeout = null;
		}

		tooltipDiv.style.opacity = 0;
		tooltipTimeout = window.setTimeout(function() { tooltipDiv.removeAttribute('style'); }, 250);

		tooltipDiv.dispatchEvent(new CustomEvent('tooltip-close', { bubbles: true }));
	},

	/* Widget helper */
	itemlist: function(node, items, separators) {
		var children = [];

		if (!Array.isArray(separators))
			separators = [ separators || E('br') ];

		for (var i = 0; i < items.length; i += 2) {
			if (items[i+1] !== null && items[i+1] !== undefined) {
				var sep = separators[(i/2) % separators.length],
				    cld = [];

				children.push(E('span', { class: 'nowrap' }, [
					items[i] ? E('strong', items[i] + ': ') : '',
					items[i+1]
				]));

				if ((i+2) < items.length)
					children.push(L.dom.elem(sep) ? sep.cloneNode(true) : sep);
			}
		}

		L.dom.content(node, children);

		return node;
	},

	/* Tabs */
	tabs: L.Class.singleton({
		init: function() {
			var groups = [], prevGroup = null, currGroup = null;

			document.querySelectorAll('[data-tab]').forEach(function(tab) {
				var parent = tab.parentNode;

				if (!parent.hasAttribute('data-tab-group'))
					parent.setAttribute('data-tab-group', groups.length);

				currGroup = +parent.getAttribute('data-tab-group');

				if (currGroup !== prevGroup) {
					prevGroup = currGroup;

					if (!groups[currGroup])
						groups[currGroup] = [];
				}

				groups[currGroup].push(tab);
			});

			for (var i = 0; i < groups.length; i++)
				this.initTabGroup(groups[i]);

			document.addEventListener('dependency-update', this.updateTabs.bind(this));

			this.updateTabs();

			if (!groups.length)
				this.setActiveTabId(-1, -1);
		},

		initTabGroup: function(panes) {
			if (typeof(panes) != 'object' || !('length' in panes) || panes.length === 0)
				return;

			var menu = E('ul', { 'class': 'cbi-tabmenu' }),
			    group = panes[0].parentNode,
			    groupId = +group.getAttribute('data-tab-group'),
			    selected = null;

			for (var i = 0, pane; pane = panes[i]; i++) {
				var name = pane.getAttribute('data-tab'),
				    title = pane.getAttribute('data-tab-title'),
				    active = pane.getAttribute('data-tab-active') === 'true';

				menu.appendChild(E('li', {
					'class': active ? 'cbi-tab' : 'cbi-tab-disabled',
					'data-tab': name
				}, E('a', {
					'href': '#',
					'click': this.switchTab.bind(this)
				}, title)));

				if (active)
					selected = i;
			}

			group.parentNode.insertBefore(menu, group);

			if (selected === null) {
				selected = this.getActiveTabId(groupId);

				if (selected < 0 || selected >= panes.length)
					selected = 0;

				menu.childNodes[selected].classList.add('cbi-tab');
				menu.childNodes[selected].classList.remove('cbi-tab-disabled');
				panes[selected].setAttribute('data-tab-active', 'true');

				this.setActiveTabId(groupId, selected);
			}
		},

		getActiveTabState: function() {
			var page = document.body.getAttribute('data-page');

			try {
				var val = JSON.parse(window.sessionStorage.getItem('tab'));
				if (val.page === page && Array.isArray(val.groups))
					return val;
			}
			catch(e) {}

			window.sessionStorage.removeItem('tab');
			return { page: page, groups: [] };
		},

		getActiveTabId: function(groupId) {
			return +this.getActiveTabState().groups[groupId] || 0;
		},

		setActiveTabId: function(groupId, tabIndex) {
			try {
				var state = this.getActiveTabState();
				    state.groups[groupId] = tabIndex;

			    window.sessionStorage.setItem('tab', JSON.stringify(state));
			}
			catch (e) { return false; }

			return true;
		},

		updateTabs: function(ev) {
			document.querySelectorAll('[data-tab-title]').forEach(function(pane) {
				var menu = pane.parentNode.previousElementSibling,
				    tab = menu.querySelector('[data-tab="%s"]'.format(pane.getAttribute('data-tab'))),
				    n_errors = pane.querySelectorAll('.cbi-input-invalid').length;

				if (!pane.firstElementChild) {
					tab.style.display = 'none';
					tab.classList.remove('flash');
				}
				else if (tab.style.display === 'none') {
					tab.style.display = '';
					requestAnimationFrame(function() { tab.classList.add('flash') });
				}

				if (n_errors) {
					tab.setAttribute('data-errors', n_errors);
					tab.setAttribute('data-tooltip', _('%d invalid field(s)').format(n_errors));
					tab.setAttribute('data-tooltip-style', 'error');
				}
				else {
					tab.removeAttribute('data-errors');
					tab.removeAttribute('data-tooltip');
				}
			});
		},

		switchTab: function(ev) {
			var tab = ev.target.parentNode,
			    name = tab.getAttribute('data-tab'),
			    menu = tab.parentNode,
			    group = menu.nextElementSibling,
			    groupId = +group.getAttribute('data-tab-group'),
			    index = 0;

			ev.preventDefault();

			if (!tab.classList.contains('cbi-tab-disabled'))
				return;

			menu.querySelectorAll('[data-tab]').forEach(function(tab) {
				tab.classList.remove('cbi-tab');
				tab.classList.remove('cbi-tab-disabled');
				tab.classList.add(
					tab.getAttribute('data-tab') === name ? 'cbi-tab' : 'cbi-tab-disabled');
			});

			group.childNodes.forEach(function(pane) {
				if (L.dom.matches(pane, '[data-tab]')) {
					if (pane.getAttribute('data-tab') === name) {
						pane.setAttribute('data-tab-active', 'true');
						L.ui.tabs.setActiveTabId(groupId, index);
					}
					else {
						pane.setAttribute('data-tab-active', 'false');
					}

					index++;
				}
			});
		}
	})
});
