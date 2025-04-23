'use strict';
'require baseclass';
'require ui';

return baseclass.extend({
	__init__() {
		ui.menu.load().then(L.bind(this.render, this));
	},

	render(tree) {
		let node = tree;
		let url = '';

		this.renderModeMenu(node);

		if (L.env.dispatchpath.length >= 3) {
			for (var i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}

		document.querySelector('#menubar > .navigation')
			.addEventListener('click', ui.createHandlerFn(this, 'handleSidebarToggle'));
	},

	handleMenuExpand(ev) {
		const a = ev.target;
		const ul1 = a.parentNode.parentNode;
		const ul2 = a.nextElementSibling;

		document.querySelectorAll('ul.mainmenu.l1 > li.active').forEach(li => {
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

	renderMainMenu(tree, url, level) {
		const l = (level || 0) + 1;
		const ul = E('ul', { 'class': 'mainmenu l%d'.format(l) });
		const children = ui.menu.getChildren(tree);

		if (children.length == 0 || l > 2)
			return E([]);

		children.forEach(child => {
			const isActive = (L.env.dispatchpath[l] == child.name);
			const activeClass = 'mainmenu-item-%s%s'.format(child.name, isActive ? ' selected' : '');

			ul.appendChild(E('li', { 'class': activeClass }, [
				E('a', {
					'href': L.url(url, child.name),
					'click': (l == 1) ? ui.createHandlerFn(this, 'handleMenuExpand') : ''
				}, [
					_(child.title)
				]),
				this.renderMainMenu(child, url + '/' + child.name, l)
			]));
		});

		if (l == 1)
			document.querySelector('#mainmenu').appendChild(E('div', [ ul ]));

		return ul;
	},

	renderModeMenu(tree) {
		const menu = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);

		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length
				? child.name === L.env.requestpath[0]
				: index === 0;

			if (index > 0)
				menu.appendChild(E([], ['\u00a0|\u00a0']));

			menu.appendChild(E('div', { 'class': isActive ? 'active' : '' }, [
				E('a', { href: L.url(child.name) }, [
					_(child.title)
				])
			]));

			if (isActive)
				this.renderMainMenu(child, child.name);
		});

		if (menu.children.length > 1)
			menu.style.display = '';
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const l = (level || 0) + 1;
		const ul = E('ul', { 'class': 'cbi-tabmenu' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;

		if (children.length == 0)
			return E([]);

		children.forEach(child => {
			const isActive = (L.env.dispatchpath[l + 2] == child.name);
			const activeClass = isActive ? ' cbi-tab' : '';
			const className = 'tabmenu-item-%s %s'.format(child.name, activeClass);

			ul.appendChild(E('li', { 'class': className }, [
				E('a', { 'href': L.url(url, child.name) }, [
					_(child.title)
				])
			]));

			if (isActive)
				activeNode = child;
		});

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			container.appendChild(this.renderTabMenu(activeNode, url + '/' + activeNode.name, l));

		return ul;
	},

	handleSidebarToggle(ev) {
		const btn = ev.currentTarget;
		const bar = document.querySelector('#mainmenu');

		if (btn.classList.contains('active')) {
			btn.classList.remove('active');
			bar.classList.remove('active');
		}
		else {
			btn.classList.add('active');
			bar.classList.add('active');
		}
	}
});
