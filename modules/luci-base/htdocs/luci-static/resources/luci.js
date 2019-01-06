(function(window, document, undefined) {
	/* Object.assign polyfill for IE */
	if (typeof Object.assign !== 'function') {
		Object.defineProperty(Object, 'assign', {
			value: function assign(target, varArgs) {
				if (target == null)
					throw new TypeError('Cannot convert undefined or null to object');

				var to = Object(target);

				for (var index = 1; index < arguments.length; index++)
					if (arguments[index] != null)
						for (var nextKey in arguments[index])
							if (Object.prototype.hasOwnProperty.call(arguments[index], nextKey))
								to[nextKey] = arguments[index][nextKey];

				return to;
			},
			writable: true,
			configurable: true
		});
	}

	/*
	 * Class declaration and inheritance helper
	 */

	var toCamelCase = function(s) {
		return s.replace(/(?:^|[\. -])(.)/g, function(m0, m1) { return m1.toUpperCase() });
	};

	var superContext = null, Class = Object.assign(function() {}, {
		extend: function(properties) {
			var props = {
				__base__: { value: this.prototype },
				__name__: { value: properties.__name__ || 'anonymous' }
			};

			var ClassConstructor = function() {
				if (!(this instanceof ClassConstructor))
					throw new TypeError('Constructor must not be called without "new"');

				if (Object.getPrototypeOf(this).hasOwnProperty('__init__')) {
					if (typeof(this.__init__) != 'function')
						throw new TypeError('Class __init__ member is not a function');

					this.__init__.apply(this, arguments)
				}
				else {
					this.super('__init__', arguments);
				}
			};

			for (var key in properties)
				if (!props[key] && properties.hasOwnProperty(key))
					props[key] = { value: properties[key], writable: true };

			ClassConstructor.prototype = Object.create(this.prototype, props);
			ClassConstructor.prototype.constructor = ClassConstructor;
			Object.assign(ClassConstructor, this);
			ClassConstructor.displayName = toCamelCase(props.__name__.value + 'Class');

			return ClassConstructor;
		},

		singleton: function(properties /*, ... */) {
			return Class.extend(properties)
				.instantiate(Class.prototype.varargs(arguments, 1));
		},

		instantiate: function(args) {
			return new (Function.prototype.bind.apply(this,
				Class.prototype.varargs(args, 0, null)))();
		},

		call: function(self, method) {
			if (typeof(this.prototype[method]) != 'function')
				throw new ReferenceError(method + ' is not defined in class');

			return this.prototype[method].apply(self, self.varargs(arguments, 1));
		},

		isSubclass: function(_class) {
			return (_class != null &&
			        typeof(_class) == 'function' &&
			        _class.prototype instanceof this);
		},

		prototype: {
			varargs: function(args, offset /*, ... */) {
				return Array.prototype.slice.call(arguments, 2)
					.concat(Array.prototype.slice.call(args, offset));
			},

			super: function(key, callArgs) {
				for (superContext = Object.getPrototypeOf(superContext ||
				                                          Object.getPrototypeOf(this));
				     superContext && !superContext.hasOwnProperty(key);
				     superContext = Object.getPrototypeOf(superContext)) { }

				if (!superContext)
					return null;

				var res = superContext[key];

				if (arguments.length > 1) {
					if (typeof(res) != 'function')
						throw new ReferenceError(key + ' is not a function in base class');

					if (typeof(callArgs) != 'object')
						callArgs = this.varargs(arguments, 1);

					res = res.apply(this, callArgs);
				}

				superContext = null;

				return res;
			},

			toString: function() {
				var s = '[' + this.constructor.displayName + ']', f = true;
				for (var k in this) {
					if (this.hasOwnProperty(k)) {
						s += (f ? ' {\n' : '') + '  ' + k + ': ' + typeof(this[k]) + '\n';
						f = false;
					}
				}
				return s + (f ? '' : '}');
			}
		}
	});

	var modalDiv = null,
	    tooltipDiv = null,
	    tooltipTimeout = null,
	    dummyElem = null,
	    domParser = null;

	LuCI.prototype = {
		/* URL construction helpers */
		path: function(prefix, parts) {
			var url = [ prefix || '' ];

			for (var i = 0; i < parts.length; i++)
				if (/^(?:[a-zA-Z0-9_.%,;-]+\/)*[a-zA-Z0-9_.%,;-]+$/.test(parts[i]))
					url.push('/', parts[i]);

			if (url.length === 1)
				url.push('/');

			return url.join('');
		},

		url: function() {
			return this.path(this.env.scriptname, arguments);
		},

		resource: function() {
			return this.path(this.env.resource, arguments);
		},

		location: function() {
			return this.path(this.env.scriptname, this.env.requestpath);
		},


		/* HTTP resource fetching */
		get: function(url, args, cb) {
			return this.poll(0, url, args, cb, false);
		},

		post: function(url, args, cb) {
			return this.poll(0, url, args, cb, true);
		},

		poll: function(interval, url, args, cb, post) {
			var data = post ? { token: this.env.token } : null;

			if (!/^(?:\/|\S+:\/\/)/.test(url))
				url = this.url(url);

			if (typeof(args) === 'object' && args !== null) {
				data = data || {};

				for (var key in args)
					if (args.hasOwnProperty(key))
						switch (typeof(args[key])) {
						case 'string':
						case 'number':
						case 'boolean':
							data[key] = args[key];
							break;

						case 'object':
							data[key] = JSON.stringify(args[key]);
							break;
						}
			}

			if (interval > 0)
				return XHR.poll(interval, url, data, cb, post);
			else if (post)
				return XHR.post(url, data, cb);
			else
				return XHR.get(url, data, cb);
		},

		stop: function(entry) { XHR.stop(entry) },
		halt: function() { XHR.halt() },
		run: function() { XHR.run() },


		/* Modal dialog */
		showModal: function(title, children) {
			var dlg = modalDiv.firstElementChild;

			dlg.setAttribute('class', 'modal');

			this.dom.content(dlg, this.dom.create('h4', {}, title));
			this.dom.append(dlg, children);

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
						children.push(this.dom.elem(sep) ? sep.cloneNode(true) : sep);
				}
			}

			this.dom.content(node, children);

			return node;
		},

		Class: Class
	};

	/* Tabs */
	LuCI.prototype.tabs = {
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
			if (!Array.isArray(panes) || panes.length === 0)
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
						L.tabs.setActiveTabId(groupId, index);
					}
					else {
						pane.setAttribute('data-tab-active', 'false');
					}

					index++;
				}
			});
		}
	};

	/* DOM manipulation */
	LuCI.prototype.dom = {
		elem: function(e) {
			return (typeof(e) === 'object' && e !== null && 'nodeType' in e);
		},

		parse: function(s) {
			var elem;

			try {
				domParser = domParser || new DOMParser();
				elem = domParser.parseFromString(s, 'text/html').body.firstChild;
			}
			catch(e) {}

			if (!elem) {
				try {
					dummyElem = dummyElem || document.createElement('div');
					dummyElem.innerHTML = s;
					elem = dummyElem.firstChild;
				}
				catch (e) {}
			}

			return elem || null;
		},

		matches: function(node, selector) {
			var m = this.elem(node) ? node.matches || node.msMatchesSelector : null;
			return m ? m.call(node, selector) : false;
		},

		parent: function(node, selector) {
			if (this.elem(node) && node.closest)
				return node.closest(selector);

			while (this.elem(node))
				if (this.matches(node, selector))
					return node;
				else
					node = node.parentNode;

			return null;
		},

		append: function(node, children) {
			if (!this.elem(node))
				return null;

			if (Array.isArray(children)) {
				for (var i = 0; i < children.length; i++)
					if (this.elem(children[i]))
						node.appendChild(children[i]);
					else if (children !== null && children !== undefined)
						node.appendChild(document.createTextNode('' + children[i]));

				return node.lastChild;
			}
			else if (typeof(children) === 'function') {
				return this.append(node, children(node));
			}
			else if (this.elem(children)) {
				return node.appendChild(children);
			}
			else if (children !== null && children !== undefined) {
				node.innerHTML = '' + children;
				return node.lastChild;
			}

			return null;
		},

		content: function(node, children) {
			if (!this.elem(node))
				return null;

			while (node.firstChild)
				node.removeChild(node.firstChild);

			return this.append(node, children);
		},

		attr: function(node, key, val) {
			if (!this.elem(node))
				return null;

			var attr = null;

			if (typeof(key) === 'object' && key !== null)
				attr = key;
			else if (typeof(key) === 'string')
				attr = {}, attr[key] = val;

			for (key in attr) {
				if (!attr.hasOwnProperty(key) || attr[key] === null || attr[key] === undefined)
					continue;

				switch (typeof(attr[key])) {
				case 'function':
					node.addEventListener(key, attr[key]);
					break;

				case 'object':
					node.setAttribute(key, JSON.stringify(attr[key]));
					break;

				default:
					node.setAttribute(key, attr[key]);
				}
			}
		},

		create: function() {
			var html = arguments[0],
			    attr = (arguments[1] instanceof Object && !Array.isArray(arguments[1])) ? arguments[1] : null,
			    data = attr ? arguments[2] : arguments[1],
			    elem;

			if (this.elem(html))
				elem = html;
			else if (html.charCodeAt(0) === 60)
				elem = this.parse(html);
			else
				elem = document.createElement(html);

			if (!elem)
				return null;

			this.attr(elem, attr);
			this.append(elem, data);

			return elem;
		}
	};

	/* Setup */
	LuCI.prototype.setupDOM = function(ev) {
		this.tabs.init();
	};

	function LuCI(env) {
		this.env = env;

		modalDiv = document.body.appendChild(
			this.dom.create('div', { id: 'modal_overlay' },
				this.dom.create('div', { class: 'modal', role: 'dialog', 'aria-modal': true })));

		tooltipDiv = document.body.appendChild(this.dom.create('div', { class: 'cbi-tooltip' }));

		document.addEventListener('mouseover', this.showTooltip.bind(this), true);
		document.addEventListener('mouseout', this.hideTooltip.bind(this), true);
		document.addEventListener('focus', this.showTooltip.bind(this), true);
		document.addEventListener('blur', this.hideTooltip.bind(this), true);

		document.addEventListener('DOMContentLoaded', this.setupDOM.bind(this));
	}

	window.LuCI = LuCI;
})(window, document);
