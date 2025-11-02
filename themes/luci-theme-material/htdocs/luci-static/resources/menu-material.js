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

		document.querySelector('.showSide')
			.addEventListener('click', ui.createHandlerFn(this, 'handleSidebarToggle'));

		document.querySelector('.darkMask')
			.addEventListener('click', ui.createHandlerFn(this, 'handleSidebarToggle'));
			
		document.querySelector(".main > .loading").style.opacity = '0';
		document.querySelector(".main > .loading").style.visibility = 'hidden';

		if (window.innerWidth <= 1152)
			document.querySelector('.main-left').style.width = '0';

		window.addEventListener('resize', this.handleSidebarToggle, true);
		
	},

	handleMenuExpand(ev) {
		const a = ev.target;
		const ul1 = a.parentNode;
		const ul2 = a.nextElementSibling;

		document.querySelectorAll('li.slide.active').forEach(function(li) {
			if (li !== a.parentNode || li == ul1) {
				li.classList.remove('active');
				li.childNodes[0].classList.remove('active');
			}

			if (li == ul1)
				return;
		});

		if (!ul2)
			return;

		if (ul2.parentNode.offsetLeft + ul2.offsetWidth <= ul1.offsetLeft + ul1.offsetWidth)
			ul2.classList.add('align-left');

		ul1.classList.add('active');
		a.classList.add('active');
		a.blur();

		ev.preventDefault();
		ev.stopPropagation();
	},

	renderMainMenu(tree, url, level) {
		const l = (level || 0) + 1;
		const ul = E('ul', { 'class': level ? 'slide-menu' : 'nav' });
		const children = ui.menu.getChildren(tree);

		if (children.length == 0 || l > 2)
			return E([]);

		children.forEach(child => {
			const submenu = this.renderMainMenu(child, url + '/' + child.name, l);
			const isActive = (L.env.dispatchpath[l] == child.name);
			const hasChildren = submenu.children.length;

			ul.appendChild(E('li', { 'class': (hasChildren ? 'slide' + (isActive ? ' active' : '') : (isActive ? ' active' : ''))}, [
				E('a', {
					'href': hasChildren ? '#' : L.url(url, child.name),
					'class': hasChildren ? 'menu' + (isActive ? ' active' : '') : '',
					'click': hasChildren ? ui.createHandlerFn(this, 'handleMenuExpand') : '',
					'data-title': hasChildren ? '' : _(child.title),
				}, [
					_(child.title)
				]),
				submenu
			]));
		});

		if (l == 1) {
			var container = document.querySelector('#mainmenu');

			container.appendChild(ul);
			container.style.display = '';
		}

		return ul;
	},

	renderModeMenu(tree) {
		const ul = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);

		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length
				? child.name === L.env.requestpath[0]
				: index === 0;

			ul.appendChild(E('li', {}, [
				E('a', {
					'href': L.url(child.name),
					'class': isActive ? 'active' : ''
				}, [ _(child.title) ])
			]));

			if (isActive)
				this.renderMainMenu(child, child.name);

			if (index > 0 && index < children.length)
				ul.appendChild(E('li', {'class': 'divider'}, [E('span')]))
		});

		if (children.length > 1)
			ul.parentElement.style.display = '';
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const l = (level || 0) + 1;
		const ul = E('ul', { 'class': 'tabs' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;

		if (children.length == 0)
			return E([]);

		children.forEach(child => {
			const isActive = (L.env.dispatchpath[l + 2] == child.name);
			const activeClass = isActive ? ' active' : '';
			const className = 'tabmenu-item-%s %s'.format(child.name, activeClass);

			ul.appendChild(E('li', { 'class': className }, [
				E('a', { 'href': L.url(url, child.name) }, [
					_(child.title)
				])
			]));

			if (isActive)
				activeNode = child;
		})

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			container.appendChild(this.renderTabMenu(activeNode, url + '/' + activeNode.name, l));

		return ul;
	},

	handleSidebarToggle(ev) {
		const width = window.innerWidth;
		const darkMask = document.querySelector('.darkMask');
		const mainRight = document.querySelector('.main-right');
		const mainLeft = document.querySelector('.main-left');
		let open = mainLeft.style.width == '';

		if (width > 1152 || ev.type == 'resize')
			open = true;
		
		darkMask.style.visibility = open ? '' : 'visible';
		darkMask.style.opacity = open ? '': 1;

		if (width <= 1152)
			mainLeft.style.width = open ? '0' : '';
		else
			mainLeft.style.width = ''

		mainLeft.style.visibility = open ? '' : 'visible';

		mainRight.style['overflow-y'] = open ? 'visible' : 'hidden';
	}
});
