(function(window, document, undefined) {
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
		},

		hideTooltip: function(ev) {
			if (ev.target === tooltipDiv || ev.relatedTarget === tooltipDiv)
				return;

			if (tooltipTimeout !== null) {
				window.clearTimeout(tooltipTimeout);
				tooltipTimeout = null;
			}

			tooltipDiv.style.opacity = 0;
			tooltipTimeout = window.setTimeout(function() { tooltipDiv.removeAttribute('style'); }, 250);
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
	}

	window.LuCI = LuCI;
})(window, document);
