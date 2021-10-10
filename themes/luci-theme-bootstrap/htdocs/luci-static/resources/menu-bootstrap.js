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

	renderTabMenu: function(tree, url, level) {
		var container = document.querySelector('#tabmenu'),
		    ul = E('ul', { 'class': 'tabs' }),
		    children = ui.menu.getChildren(tree),
		    activeNode = null;

		for (var i = 0; i < children.length; i++) {
			var isActive = (L.env.dispatchpath[3 + (level || 0)] == children[i].name),
			    activeClass = isActive ? ' active' : '',
			    className = 'tabmenu-item-%s %s'.format(children[i].name, activeClass);

			ul.appendChild(E('li', { 'class': className }, [
				E('a', { 'href': L.url(url, children[i].name) }, [ _(children[i].title) ] )]));

			if (isActive)
				activeNode = children[i];
		}

		if (ul.children.length == 0)
			return E([]);

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			this.renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);

		return ul;
	},

	renderMainMenu: function(tree, url, level) {
		var ul = level ? E('ul', { 'class': 'dropdown-menu' }) : document.querySelector('#topmenu'),
		    children = ui.menu.getChildren(tree);

		if (children.length == 0 || level > 1)
			return E([]);

		for (var i = 0; i < children.length; i++) {
			var submenu = this.renderMainMenu(children[i], url + '/' + children[i].name, (level || 0) + 1),
			    subclass = (!level && submenu.firstElementChild) ? 'dropdown' : null,
			    linkclass = (!level && submenu.firstElementChild) ? 'menu' : null,
			    linkurl = submenu.firstElementChild ? '#' : L.url(url, children[i].name);

			var li = E('li', { 'class': subclass }, [
				E('a', { 'class': linkclass, 'href': linkurl }, [ _(children[i].title) ]),
				submenu
			]);

			ul.appendChild(li);
		}

		ul.style.display = '';

		return ul;
	},

	renderModeMenu: function(tree) {
		var ul = document.querySelector('#modemenu'),
		    children = ui.menu.getChildren(tree);

		for (var i = 0; i < children.length; i++) {
			var isActive = (L.env.requestpath.length ? children[i].name == L.env.requestpath[0] : i == 0);

			ul.appendChild(E('li', { 'class': isActive ? 'active' : null }, [
				E('a', { 'href': L.url(children[i].name) }, [ _(children[i].title) ])
			]));

			if (isActive)
				this.renderMainMenu(children[i], children[i].name);
		}

		if (ul.children.length > 1)
			ul.style.display = '';
	}
});
