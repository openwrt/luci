(function(window, document, undefined) {
	'use strict';

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

	/* Promise.finally polyfill */
	if (typeof Promise.prototype.finally !== 'function') {
		Promise.prototype.finally = function(fn) {
			var onFinally = function(cb) {
				return Promise.resolve(fn.call(this)).then(cb);
			};

			return this.then(
				function(result) { return onFinally.call(this, function() { return result }) },
				function(reason) { return onFinally.call(this, function() { return Promise.reject(reason) }) }
			);
		};
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


	/*
	 * HTTP Request helper
	 */

	var Headers = Class.extend({
		__name__: 'LuCI.XHR.Headers',
		__init__: function(xhr) {
			var hdrs = this.headers = {};
			xhr.getAllResponseHeaders().split(/\r\n/).forEach(function(line) {
				var m = /^([^:]+):(.*)$/.exec(line);
				if (m != null)
					hdrs[m[1].trim().toLowerCase()] = m[2].trim();
			});
		},

		has: function(name) {
			return this.headers.hasOwnProperty(String(name).toLowerCase());
		},

		get: function(name) {
			var key = String(name).toLowerCase();
			return this.headers.hasOwnProperty(key) ? this.headers[key] : null;
		}
	});

	var Response = Class.extend({
		__name__: 'LuCI.XHR.Response',
		__init__: function(xhr, url, duration, headers, content) {
			this.ok = (xhr.status >= 200 && xhr.status <= 299);
			this.status = xhr.status;
			this.statusText = xhr.statusText;
			this.headers = (headers != null) ? headers : new Headers(xhr);
			this.duration = duration;
			this.url = url;
			this.xhr = xhr;

			if (content != null && typeof(content) == 'object') {
				this.responseJSON = content;
				this.responseText = null;
			}
			else if (content != null) {
				this.responseJSON = null;
				this.responseText = String(content);
			}
			else {
				this.responseJSON = null;
				this.responseText = xhr.responseText;
			}
		},

		clone: function(content) {
			var copy = new Response(this.xhr, this.url, this.duration, this.headers, content);

			copy.ok = this.ok;
			copy.status = this.status;
			copy.statusText = this.statusText;

			return copy;
		},

		json: function() {
			if (this.responseJSON == null)
				this.responseJSON = JSON.parse(this.responseText);

			return this.responseJSON;
		},

		text: function() {
			if (this.responseText == null && this.responseJSON != null)
				this.responseText = JSON.stringify(this.responseJSON);

			return this.responseText;
		}
	});


	var requestQueue = [];

	function isQueueableRequest(opt) {
		if (!classes.rpc)
			return false;

		if (opt.method != 'POST' || typeof(opt.content) != 'object')
			return false;

		if (opt.nobatch === true)
			return false;

		var rpcBaseURL = Request.expandURL(classes.rpc.getBaseURL());

		return (rpcBaseURL != null && opt.url.indexOf(rpcBaseURL) == 0);
	}

	function flushRequestQueue() {
		if (!requestQueue.length)
			return;

		var reqopt = Object.assign({}, requestQueue[0][0], { content: [], nobatch: true }),
		    batch = [];

		for (var i = 0; i < requestQueue.length; i++) {
			batch[i] = requestQueue[i];
			reqopt.content[i] = batch[i][0].content;
		}

		requestQueue.length = 0;

		Request.request(rpcBaseURL, reqopt).then(function(reply) {
			var json = null, req = null;

			try { json = reply.json() }
			catch(e) { }

			while ((req = batch.shift()) != null)
				if (Array.isArray(json) && json.length)
					req[2].call(reqopt, reply.clone(json.shift()));
				else
					req[1].call(reqopt, new Error('No related RPC reply'));
		}).catch(function(error) {
			var req = null;

			while ((req = batch.shift()) != null)
				req[1].call(reqopt, error);
		});
	}

	var Request = Class.singleton({
		__name__: 'LuCI.Request',

		interceptors: [],

		expandURL: function(url) {
			if (!/^(?:[^/]+:)?\/\//.test(url))
				url = location.protocol + '//' + location.host + url;

			return url;
		},

		request: function(target, options) {
			var state = { xhr: new XMLHttpRequest(), url: this.expandURL(target), start: Date.now() },
			    opt = Object.assign({}, options, state),
			    content = null,
			    contenttype = null,
			    callback = this.handleReadyStateChange;

			return new Promise(function(resolveFn, rejectFn) {
				opt.xhr.onreadystatechange = callback.bind(opt, resolveFn, rejectFn);
				opt.method = String(opt.method || 'GET').toUpperCase();

				if ('query' in opt) {
					var q = (opt.query != null) ? Object.keys(opt.query).map(function(k) {
						if (opt.query[k] != null) {
							var v = (typeof(opt.query[k]) == 'object')
								? JSON.stringify(opt.query[k])
								: String(opt.query[k]);

							return '%s=%s'.format(encodeURIComponent(k), encodeURIComponent(v));
						}
						else {
							return encodeURIComponent(k);
						}
					}).join('&') : '';

					if (q !== '') {
						switch (opt.method) {
						case 'GET':
						case 'HEAD':
						case 'OPTIONS':
							opt.url += ((/\?/).test(opt.url) ? '&' : '?') + q;
							break;

						default:
							if (content == null) {
								content = q;
								contenttype = 'application/x-www-form-urlencoded';
							}
						}
					}
				}

				if (!opt.cache)
					opt.url += ((/\?/).test(opt.url) ? '&' : '?') + (new Date()).getTime();

				if (isQueueableRequest(opt)) {
					requestQueue.push([opt, rejectFn, resolveFn]);
					requestAnimationFrame(flushRequestQueue);
					return;
				}

				if ('username' in opt && 'password' in opt)
					opt.xhr.open(opt.method, opt.url, true, opt.username, opt.password);
				else
					opt.xhr.open(opt.method, opt.url, true);

				opt.xhr.responseType = 'text';

				if ('overrideMimeType' in opt.xhr)
					opt.xhr.overrideMimeType('application/octet-stream');

				if ('timeout' in opt)
					opt.xhr.timeout = +opt.timeout;

				if ('credentials' in opt)
					opt.xhr.withCredentials = !!opt.credentials;

				if (opt.content != null) {
					switch (typeof(opt.content)) {
					case 'function':
						content = opt.content(xhr);
						break;

					case 'object':
						if (!(opt.content instanceof FormData)) {
							content = JSON.stringify(opt.content);
							contenttype = 'application/json';
						}
						else {
							content = opt.content;
						}
						break;

					default:
						content = String(opt.content);
					}
				}

				if ('headers' in opt)
					for (var header in opt.headers)
						if (opt.headers.hasOwnProperty(header)) {
							if (header.toLowerCase() != 'content-type')
								opt.xhr.setRequestHeader(header, opt.headers[header]);
							else
								contenttype = opt.headers[header];
						}

				if ('progress' in opt && 'upload' in opt.xhr)
					opt.xhr.upload.addEventListener('progress', opt.progress);

				if (contenttype != null)
					opt.xhr.setRequestHeader('Content-Type', contenttype);

				try {
					opt.xhr.send(content);
				}
				catch (e) {
					rejectFn.call(opt, e);
				}
			});
		},

		handleReadyStateChange: function(resolveFn, rejectFn, ev) {
			var xhr = this.xhr;

			if (xhr.readyState !== 4)
				return;

			if (xhr.status === 0 && xhr.statusText === '') {
				rejectFn.call(this, new Error('XHR request aborted by browser'));
			}
			else {
				var response = new Response(
					xhr, xhr.responseURL || this.url, Date.now() - this.start);

				Promise.all(Request.interceptors.map(function(fn) { return fn(response) }))
					.then(resolveFn.bind(this, response))
					.catch(rejectFn.bind(this));
			}
		},

		get: function(url, options) {
			return this.request(url, Object.assign({ method: 'GET' }, options));
		},

		post: function(url, data, options) {
			return this.request(url, Object.assign({ method: 'POST', content: data }, options));
		},

		addInterceptor: function(interceptorFn) {
			if (typeof(interceptorFn) == 'function')
				this.interceptors.push(interceptorFn);
			return interceptorFn;
		},

		removeInterceptor: function(interceptorFn) {
			var oldlen = this.interceptors.length, i = oldlen;
			while (i--)
				if (this.interceptors[i] === interceptorFn)
					this.interceptors.splice(i, 1);
			return (this.interceptors.length < oldlen);
		},

		poll: {
			add: function(interval, url, options, callback) {
				if (isNaN(interval) || interval <= 0)
					throw new TypeError('Invalid poll interval');

				var ival = interval >>> 0,
				    opts = Object.assign({}, options, { timeout: ival * 1000 - 5 });

				return Poll.add(function() {
					return Request.request(url, options).then(function(res) {
						if (!Poll.active())
							return;

						try {
							callback(res, res.json(), res.duration);
						}
						catch (err) {
							callback(res, null, res.duration);
						}
					});
				}, ival);
			},

			remove: function(entry) { return Poll.remove(entry) },
			start: function() { return Poll.start() },
			stop: function() { return Poll.stop() },
			active: function() { return Poll.active() }
		}
	});

	var Poll = Class.singleton({
		__name__: 'LuCI.Poll',

		queue: [],

		add: function(fn, interval) {
			if (interval == null || interval <= 0)
				interval = window.L ? window.L.env.pollinterval : null;

			if (isNaN(interval) || typeof(fn) != 'function')
				throw new TypeError('Invalid argument to LuCI.Poll.add()');

			for (var i = 0; i < this.queue.length; i++)
				if (this.queue[i].fn === fn)
					return false;

			var e = {
				r: true,
				i: interval >>> 0,
				fn: fn
			};

			this.queue.push(e);

			if (this.tick != null && !this.active())
				this.start();

			return true;
		},

		remove: function(fn) {
			if (typeof(fn) != 'function')
				throw new TypeError('Invalid argument to LuCI.Poll.remove()');

			var len = this.queue.length;

			for (var i = len; i > 0; i--)
				if (this.queue[i-1].fn === fn)
					this.queue.splice(i-1, 1);

			if (!this.queue.length && this.stop())
				this.tick = 0;

			return (this.queue.length != len);
		},

		start: function() {
			if (this.active())
				return false;

			this.tick = 0;

			if (this.queue.length) {
				this.timer = window.setInterval(this.step, 1000);
				this.step();
				document.dispatchEvent(new CustomEvent('poll-start'));
			}

			return true;
		},

		stop: function() {
			if (!this.active())
				return false;

			document.dispatchEvent(new CustomEvent('poll-stop'));
			window.clearInterval(this.timer);
			delete this.timer;
			delete this.tick;
			return true;
		},

		step: function() {
			for (var i = 0, e = null; (e = Poll.queue[i]) != null; i++) {
				if ((Poll.tick % e.i) != 0)
					continue;

				if (!e.r)
					continue;

				e.r = false;

				Promise.resolve(e.fn()).finally((function() { this.r = true }).bind(e));
			}

			Poll.tick = (Poll.tick + 1) % Math.pow(2, 32);
		},

		active: function() {
			return (this.timer != null);
		}
	});


	var dummyElem = null,
	    domParser = null,
	    originalCBIInit = null,
	    rpcBaseURL = null,
	    sysFeatures = null,
	    classes = {};

	var LuCI = Class.extend({
		__name__: 'LuCI',
		__init__: function(env) {

			document.querySelectorAll('script[src*="/luci.js"]').forEach(function(s) {
				if (env.base_url == null || env.base_url == '')
					env.base_url = s.getAttribute('src').replace(/\/luci\.js(?:\?v=[^?]+)?$/, '');
			});

			if (env.base_url == null)
				this.error('InternalError', 'Cannot find url of luci.js');

			Object.assign(this.env, env);

			document.addEventListener('poll-start', function(ev) {
				document.querySelectorAll('[id^="xhr_poll_status"]').forEach(function(e) {
					e.style.display = (e.id == 'xhr_poll_status_off') ? 'none' : '';
				});
			});

			document.addEventListener('poll-stop', function(ev) {
				document.querySelectorAll('[id^="xhr_poll_status"]').forEach(function(e) {
					e.style.display = (e.id == 'xhr_poll_status_on') ? 'none' : '';
				});
			});

			var domReady = new Promise(function(resolveFn, rejectFn) {
				document.addEventListener('DOMContentLoaded', resolveFn);
			});

			Promise.all([
				domReady,
				this.require('ui'),
				this.require('rpc'),
				this.require('form'),
				this.probeRPCBaseURL()
			]).then(this.setupDOM.bind(this)).catch(this.error);

			originalCBIInit = window.cbi_init;
			window.cbi_init = function() {};
		},

		raise: function(type, fmt /*, ...*/) {
			var e = null,
			    msg = fmt ? String.prototype.format.apply(fmt, this.varargs(arguments, 2)) : null,
			    stack = null;

			if (type instanceof Error) {
				e = type;
				stack = (e.stack || '').split(/\n/);

				if (msg)
					e.message = msg + ': ' + e.message;
			}
			else {
				e = new (window[type || 'Error'] || Error)(msg || 'Unspecified error');
				e.name = type || 'Error';
			}

			if (window.console && console.debug)
				console.debug(e);

			throw e;
		},

		error: function(type, fmt /*, ...*/) {
			try {
				L.raise.apply(L, Array.prototype.slice.call(arguments));
			}
			catch (e) {
				var stack = (e.stack || '').split(/\n/).map(function(frame) {
					frame = frame.replace(/(.*?)@(.+):(\d+):(\d+)/g, 'at $1 ($2:$3:$4)').trim();
					return frame ? '  ' + frame : '';
				});

				if (!/^  at /.test(stack[0]))
					stack.shift();

				if (/\braise /.test(stack[0]))
					stack.shift();

				if (/\berror /.test(stack[0]))
					stack.shift();

				stack = stack.length ? '\n' + stack.join('\n') : '';

				if (L.ui)
					L.ui.showModal(e.name || _('Runtime error'),
						E('pre', { 'class': 'alert-message error' }, e.message + stack));
				else
					L.dom.content(document.querySelector('#maincontent'),
						E('pre', { 'class': 'alert-message error' }, e + stack));

				throw e;
			}
		},

		bind: function(fn, self /*, ... */) {
			return Function.prototype.bind.apply(fn, this.varargs(arguments, 2, self));
		},

		/* Class require */
		require: function(name, from) {
			var L = this, url = null, from = from || [];

			/* Class already loaded */
			if (classes[name] != null) {
				/* Circular dependency */
				if (from.indexOf(name) != -1)
					L.raise('DependencyError',
						'Circular dependency: class "%s" depends on "%s"',
						name, from.join('" which depends on "'));

				return classes[name];
			}

			url = '%s/%s.js'.format(L.env.base_url, name.replace(/\./g, '/'));
			from = [ name ].concat(from);

			var compileClass = function(res) {
				if (!res.ok)
					L.raise('NetworkError',
						'HTTP error %d while loading class file "%s"', res.status, url);

				var source = res.text(),
				    requirematch = /^require[ \t]+(\S+)(?:[ \t]+as[ \t]+([a-zA-Z_]\S*))?$/,
				    strictmatch = /^use[ \t]+strict$/,
				    depends = [],
				    args = '';

				/* find require statements in source */
				for (var i = 0, off = -1, quote = -1, esc = false; i < source.length; i++) {
					var chr = source.charCodeAt(i);

					if (esc) {
						esc = false;
					}
					else if (chr == 92) {
						esc = true;
					}
					else if (chr == quote) {
						var s = source.substring(off, i),
						    m = requirematch.exec(s);

						if (m) {
							var dep = m[1], as = m[2] || dep.replace(/[^a-zA-Z0-9_]/g, '_');
							depends.push(L.require(dep, from));
							args += ', ' + as;
						}
						else if (!strictmatch.exec(s)) {
							break;
						}

						off = -1;
						quote = -1;
					}
					else if (quote == -1 && (chr == 34 || chr == 39)) {
						off = i + 1;
						quote = chr;
					}
				}

				/* load dependencies and instantiate class */
				return Promise.all(depends).then(function(instances) {
					var _factory, _class;

					try {
						_factory = eval(
							'(function(window, document, L%s) { %s })\n\n//# sourceURL=%s\n'
								.format(args, source, res.url));
					}
					catch (error) {
						L.raise('SyntaxError', '%s\n  in %s:%s',
							error.message, res.url, error.lineNumber || '?');
					}

					_factory.displayName = toCamelCase(name + 'ClassFactory');
					_class = _factory.apply(_factory, [window, document, L].concat(instances));

					if (!Class.isSubclass(_class))
					    L.error('TypeError', '"%s" factory yields invalid constructor', name);

					if (_class.displayName == 'AnonymousClass')
						_class.displayName = toCamelCase(name + 'Class');

					var ptr = Object.getPrototypeOf(L),
					    parts = name.split(/\./),
					    instance = new _class();

					for (var i = 0; ptr && i < parts.length - 1; i++)
						ptr = ptr[parts[i]];

					if (ptr)
						ptr[parts[i]] = instance;

					classes[name] = instance;

					return instance;
				});
			};

			/* Request class file */
			classes[name] = Request.get(url, { cache: true }).then(compileClass);

			return classes[name];
		},

		/* DOM setup */
		probeRPCBaseURL: function() {
			if (rpcBaseURL == null) {
				try {
					rpcBaseURL = window.sessionStorage.getItem('rpcBaseURL');
				}
				catch (e) { }
			}

			if (rpcBaseURL == null) {
				var rpcFallbackURL = this.url('admin/ubus');

				rpcBaseURL = Request.get('/ubus/').then(function(res) {
					return (rpcBaseURL = (res.status == 400) ? '/ubus/' : rpcFallbackURL);
				}, function() {
					return (rpcBaseURL = rpcFallbackURL);
				}).then(function(url) {
					try {
						window.sessionStorage.setItem('rpcBaseURL', url);
					}
					catch (e) { }

					return url;
				});
			}

			return Promise.resolve(rpcBaseURL);
		},

		probeSystemFeatures: function() {
			if (sysFeatures == null) {
				try {
					sysFeatures = JSON.parse(window.sessionStorage.getItem('sysFeatures'));
				}
				catch (e) {}
			}

			if (!this.isObject(sysFeatures)) {
				sysFeatures = classes.rpc.declare({
					object: 'luci',
					method: 'getFeatures',
					expect: { '': {} }
				})().then(function(features) {
					try {
						window.sessionStorage.setItem('sysFeatures', JSON.stringify(features));
					}
					catch (e) {}

					sysFeatures = features;

					return features;
				});
			}

			return Promise.resolve(sysFeatures);
		},

		hasSystemFeature: function() {
			var ft = sysFeatures[arguments[0]];

			if (arguments.length == 2)
				return this.isObject(ft) ? ft[arguments[1]] : null;

			return (ft != null && ft != false);
		},

		setupDOM: function(res) {
			var domEv = res[0],
			    uiClass = res[1],
			    rpcClass = res[2],
			    formClass = res[3],
			    rpcBaseURL = res[4];

			rpcClass.setBaseURL(rpcBaseURL);

			Request.addInterceptor(function(res) {
				if (res.status != 403 || res.headers.get('X-LuCI-Login-Required') != 'yes')
					return;

				Poll.stop();

				L.ui.showModal(_('Session expired'), [
					E('div', { class: 'alert-message warning' },
						_('A new login is required since the authentication session expired.')),
					E('div', { class: 'right' },
						E('div', {
							class: 'btn primary',
							click: function() {
								var loc = window.location;
								window.location = loc.protocol + '//' + loc.host + loc.pathname + loc.search;
							}
						}, _('To login…')))
				]);

				throw 'Session expired';
			});

			return this.probeSystemFeatures().finally(this.initDOM);
		},

		initDOM: function() {
			originalCBIInit();
			Poll.start();
			document.dispatchEvent(new CustomEvent('luci-loaded'));
		},

		env: {},

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


		/* Data helpers */
		isObject: function(val) {
			return (val != null && typeof(val) == 'object');
		},

		sortedKeys: function(obj, key, sortmode) {
			if (obj == null || typeof(obj) != 'object')
				return [];

			return Object.keys(obj).map(function(e) {
				var v = (key != null) ? obj[e][key] : e;

				switch (sortmode) {
				case 'addr':
					v = (v != null) ? v.replace(/(?:^|[.:])([0-9a-fA-F]{1,4})/g,
						function(m0, m1) { return ('000' + m1.toLowerCase()).substr(-4) }) : null;
					break;

				case 'num':
					v = (v != null) ? +v : null;
					break;
				}

				return [ e, v ];
			}).filter(function(e) {
				return (e[1] != null);
			}).sort(function(a, b) {
				return (a[1] > b[1]);
			}).map(function(e) {
				return e[0];
			});
		},

		toArray: function(val) {
			if (val == null)
				return [];
			else if (Array.isArray(val))
				return val;
			else if (typeof(val) == 'object')
				return [ val ];

			var s = String(val).trim();

			if (s == '')
				return [];

			return s.split(/\s+/);
		},


		/* HTTP resource fetching */
		get: function(url, args, cb) {
			return this.poll(null, url, args, cb, false);
		},

		post: function(url, args, cb) {
			return this.poll(null, url, args, cb, true);
		},

		poll: function(interval, url, args, cb, post) {
			if (interval !== null && interval <= 0)
				interval = this.env.pollinterval;

			var data = post ? { token: this.env.token } : null,
			    method = post ? 'POST' : 'GET';

			if (!/^(?:\/|\S+:\/\/)/.test(url))
				url = this.url(url);

			if (args != null)
				data = Object.assign(data || {}, args);

			if (interval !== null)
				return Request.poll.add(interval, url, { method: method, query: data }, cb);
			else
				return Request.request(url, { method: method, query: data })
					.then(function(res) {
						var json = null;
						if (/^application\/json\b/.test(res.headers.get('Content-Type')))
							try { json = res.json() } catch(e) {}
						cb(res.xhr, json, res.duration);
					});
		},

		stop: function(entry) { return Poll.remove(entry) },
		halt: function() { return Poll.stop() },
		run: function() { return Poll.start() },

		/* DOM manipulation */
		dom: Class.singleton({
			__name__: 'LuCI.DOM',

			elem: function(e) {
				return (e != null && typeof(e) == 'object' && 'nodeType' in e);
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

				var dataNodes = node.querySelectorAll('[data-idref]');

				for (var i = 0; i < dataNodes.length; i++)
					delete this.registry[dataNodes[i].getAttribute('data-idref')];

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
					if (!attr.hasOwnProperty(key) || attr[key] == null)
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
				    attr = arguments[1],
				    data = arguments[2],
				    elem;

				if (!(attr instanceof Object) || Array.isArray(attr))
					data = attr, attr = null;

				if (Array.isArray(html)) {
					elem = document.createDocumentFragment();
					for (var i = 0; i < html.length; i++)
						elem.appendChild(this.create(html[i]));
				}
				else if (this.elem(html)) {
					elem = html;
				}
				else if (html.charCodeAt(0) === 60) {
					elem = this.parse(html);
				}
				else {
					elem = document.createElement(html);
				}

				if (!elem)
					return null;

				this.attr(elem, attr);
				this.append(elem, data);

				return elem;
			},

			registry: {},

			data: function(node, key, val) {
				var id = node.getAttribute('data-idref');

				/* clear all data */
				if (arguments.length > 1 && key == null) {
					if (id != null) {
						node.removeAttribute('data-idref');
						val = this.registry[id]
						delete this.registry[id];
						return val;
					}

					return null;
				}

				/* clear a key */
				else if (arguments.length > 2 && key != null && val == null) {
					if (id != null) {
						val = this.registry[id][key];
						delete this.registry[id][key];
						return val;
					}

					return null;
				}

				/* set a key */
				else if (arguments.length > 2 && key != null && val != null) {
					if (id == null) {
						do { id = Math.floor(Math.random() * 0xffffffff).toString(16) }
						while (this.registry.hasOwnProperty(id));

						node.setAttribute('data-idref', id);
						this.registry[id] = {};
					}

					return (this.registry[id][key] = val);
				}

				/* get all data */
				else if (arguments.length == 1) {
					if (id != null)
						return this.registry[id];

					return null;
				}

				/* get a key */
				else if (arguments.length == 2) {
					if (id != null)
						return this.registry[id][key];
				}

				return null;
			},

			bindClassInstance: function(node, inst) {
				if (!(inst instanceof Class))
					L.error('TypeError', 'Argument must be a class instance');

				return this.data(node, '_class', inst);
			},

			findClassInstance: function(node) {
				var inst = null;

				do {
					inst = this.data(node, '_class');
					node = node.parentNode;
				}
				while (!(inst instanceof Class) && node != null);

				return inst;
			},

			callClassMethod: function(node, method /*, ... */) {
				var inst = this.findClassInstance(node);

				if (inst == null || typeof(inst[method]) != 'function')
					return null;

				return inst[method].apply(inst, inst.varargs(arguments, 2));
			},

			isEmpty: function(node, ignoreFn) {
				for (var child = node.firstElementChild; child != null; child = child.nextElementSibling)
					if (!child.classList.contains('hidden') && (!ignoreFn || !ignoreFn(child)))
						return false;

				return true;
			}
		}),

		Poll: Poll,
		Class: Class,
		Request: Request,

		view: Class.extend({
			__name__: 'LuCI.View',

			__init__: function() {
				var vp = document.getElementById('view');

				L.dom.content(vp, E('div', { 'class': 'spinning' }, _('Loading view…')));

				return Promise.resolve(this.load())
					.then(L.bind(this.render, this))
					.then(L.bind(function(nodes) {
						var vp = document.getElementById('view');

						L.dom.content(vp, nodes);
						L.dom.append(vp, this.addFooter());
					}, this)).catch(L.error);
			},

			load: function() {},
			render: function() {},

			handleSave: function(ev) {
				var tasks = [];

				document.getElementById('maincontent')
					.querySelectorAll('.cbi-map').forEach(function(map) {
						tasks.push(L.dom.callClassMethod(map, 'save'));
					});

				return Promise.all(tasks);
			},

			handleSaveApply: function(ev) {
				return this.handleSave(ev).then(function() {
					L.ui.changes.apply(true);
				});
			},

			handleReset: function(ev) {
				var tasks = [];

				document.getElementById('maincontent')
					.querySelectorAll('.cbi-map').forEach(function(map) {
						tasks.push(L.dom.callClassMethod(map, 'reset'));
					});

				return Promise.all(tasks);
			},

			addFooter: function() {
				var footer = E([]),
				    mc = document.getElementById('maincontent');

				if (mc.querySelector('.cbi-map')) {
					footer.appendChild(E('div', { 'class': 'cbi-page-actions' }, [
						E('button', {
							'class': 'cbi-button cbi-button-apply',
							'click': L.ui.createHandlerFn(this, 'handleSaveApply')
						}, _('Save & Apply')), ' ',
						E('button', {
							'class': 'cbi-button cbi-button-save',
							'click': L.ui.createHandlerFn(this, 'handleSave')
						}, _('Save')), ' ',
						E('button', {
							'class': 'cbi-button cbi-button-reset',
							'click': L.ui.createHandlerFn(this, 'handleReset')
						}, _('Reset'))
					]));
				}

				return footer;
			}
		})
	});

	var XHR = Class.extend({
		__name__: 'LuCI.XHR',
		__init__: function() {
			if (window.console && console.debug)
				console.debug('Direct use XHR() is deprecated, please use L.Request instead');
		},

		_response: function(cb, res, json, duration) {
			if (this.active)
				cb(res, json, duration);
			delete this.active;
		},

		get: function(url, data, callback, timeout) {
			this.active = true;
			L.get(url, data, this._response.bind(this, callback), timeout);
		},

		post: function(url, data, callback, timeout) {
			this.active = true;
			L.post(url, data, this._response.bind(this, callback), timeout);
		},

		cancel: function() { delete this.active },
		busy: function() { return (this.active === true) },
		abort: function() {},
		send_form: function() { L.error('InternalError', 'Not implemented') },
	});

	XHR.get = function() { return window.L.get.apply(window.L, arguments) };
	XHR.post = function() { return window.L.post.apply(window.L, arguments) };
	XHR.poll = function() { return window.L.poll.apply(window.L, arguments) };
	XHR.stop = Request.poll.remove.bind(Request.poll);
	XHR.halt = Request.poll.stop.bind(Request.poll);
	XHR.run = Request.poll.start.bind(Request.poll);
	XHR.running = Request.poll.active.bind(Request.poll);

	window.XHR = XHR;
	window.LuCI = LuCI;
})(window, document);
