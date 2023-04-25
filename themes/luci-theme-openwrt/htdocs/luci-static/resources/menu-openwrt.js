'use strict';
'require baseclass';
'require ui';

return baseclass.extend({
	__init__: function() {
		ui.menu.load().then(L.bind(this.render, this));
	},

	render: function(tree) {
		var node = tree,
		    url = '';

		this.renderModeMenu(tree);

		if (L.env.dispatchpath.length >= 3) {
			for (var i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}
	},

	handleMenuExpand: function(ev) {
		var a = ev.target, ul1 = a.parentNode.parentNode, ul2 = a.nextElementSibling;

		document.querySelectorAll('ul.mainmenu.l1 > li.active').forEach(function(li) {
			if (li !== a.parentNode)
				li.classList.remove('active');
		});

		if (!ul2)
			return;

		if (ul2.parentNode.offsetLeft + ul2.offsetWidth <= ul1.offsetLeft + ul1.offsetWidth)
			ul2.classList.add('align-left');

		ul1.classList.add('active');
		a.parentNode.classList.add('active');
		a.blur();

		ev.preventDefault();
		ev.stopPropagation();
	},

	renderMainMenu: function(tree, url, level) {
		var l = (level || 0) + 1,
		    ul = E('ul', { 'class': 'mainmenu l%d'.format(l) }),
		    children = ui.menu.getChildren(tree);

		if (children.length == 0 || l > 2)
			return E([]);

		for (var i = 0; i < children.length; i++) {
			var isActive = (L.env.dispatchpath[l] == children[i].name),
			    activeClass = 'mainmenu-item-%s%s'.format(children[i].name, isActive ? ' selected' : '');

			ul.appendChild(E('li', { 'class': activeClass }, [
				E('a', {
					'href': L.url(url, children[i].name),
					'click': (l == 1) ? this.handleMenuExpand : null,
				}, [ _(children[i].title) ]),
				this.renderMainMenu(children[i], url + '/' + children[i].name, l)
			]));
		}

		if (l == 1) {
			var container = document.querySelector('#mainmenu');

			container.appendChild(ul);
			container.style.display = '';
		}

		return ul;
	},

	renderModeMenu: function(tree) {
		var ul = document.querySelector('#modemenu'),
		    children = ui.menu.getChildren(tree);

		for (var i = 0; i < children.length; i++) {
			var isActive = (L.env.requestpath.length ? children[i].name == L.env.requestpath[0] : i == 0);

			ul.appendChild(E('li', {}, [
				E('a', {
					'href': L.url(children[i].name),
					'class': isActive ? 'active' : null
				}, [ _(children[i].title) ])
			]));

			if (isActive)
				this.renderMainMenu(children[i], children[i].name);
		}

		if (ul.children.length > 1)
			ul.style.display = '';
	},

	renderTabMenu: function(tree, url, level) {
		var container = document.querySelector('#tabmenu'),
		    l = (level || 0) + 1,
		    ul = E('ul', { 'class': 'cbi-tabmenu' }),
		    children = ui.menu.getChildren(tree),
		    activeNode = null;

		if (children.length == 0)
			return E([]);

		for (var i = 0; i < children.length; i++) {
			var isActive = (L.env.dispatchpath[l + 2] == children[i].name),
			    activeClass = isActive ? ' cbi-tab' : '',
			    className = 'tabmenu-item-%s %s'.format(children[i].name, activeClass);

			ul.appendChild(E('li', { 'class': className }, [
				E('a', { 'href': L.url(url, children[i].name) }, [ _(children[i].title) ] )
			]));

			if (isActive)
				activeNode = children[i];
		}

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			container.appendChild(this.renderTabMenu(activeNode, url + '/' + activeNode.name, l));

		return ul;
	}
});
