(function(window, document) {
	var modalDiv = null,
	    tooltipDiv = null,
	    tooltipTimeout = null;

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


		/* Modal dialog */
		showModal: function(title, children) {
			var dlg = modalDiv.firstElementChild;

			while (dlg.firstChild)
				dlg.removeChild(dlg.firstChild);

			dlg.setAttribute('class', 'modal');
			dlg.appendChild(E('h4', {}, title));

			if (!Array.isArray(children))
				children = [ children ];

			for (var i = 0; i < children.length; i++)
				if (isElem(children[i]))
					dlg.appendChild(children[i]);
				else
					dlg.appendChild(document.createTextNode('' + children[i]));

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
		}
	};

	function LuCI(env) {
		this.env = env;

		modalDiv = document.body.appendChild(E('div', { id: 'modal_overlay' }, E('div', { class: 'modal' })));
		tooltipDiv = document.body.appendChild(E('div', { 'class': 'cbi-tooltip' }));

		document.addEventListener('mouseover', this.showTooltip.bind(this), true);
		document.addEventListener('mouseout', this.hideTooltip.bind(this), true);
		document.addEventListener('focus', this.showTooltip.bind(this), true);
		document.addEventListener('blur', this.hideTooltip.bind(this), true);
	}

	window.LuCI = LuCI;
})(window, document);
