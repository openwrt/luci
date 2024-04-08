/**
 * @class LuCI
 * @classdesc
 *
 * This is the LuCI base class. It is automatically instantiated and
 * accessible using the global `L` variable.
 *
 * @param {Object} env
 * The environment settings to use for the LuCI runtime.
 */

((window, document, undefined) => {
	'use strict';

	const env = {};

	/*
	 * Class declaration and inheritance helper
	 */

	const toCamelCase = s => s.replace(/(?:^|[\. -])(.)/g, (m0, m1) => m1.toUpperCase());

	/**
	 * @class baseclass
	 * @hideconstructor
	 * @memberof LuCI
	 * @classdesc
	 *
	 * `LuCI.baseclass` is the abstract base class all LuCI classes inherit from.
	 *
	 * It provides simple means to create subclasses of given classes and
	 * implements prototypal inheritance.
	 */
	const superContext = {};

	let classIndex = 0;

	const Class = Object.assign(function() {}, {
		/**
		 * Extends this base class with the properties described in
		 * `properties` and returns a new subclassed Class instance
		 *
		 * @memberof LuCI.baseclass
		 *
		 * @param {Object<string, *>} properties
		 * An object describing the properties to add to the new
		 * subclass.
		 *
		 * @returns {LuCI.baseclass}
		 * Returns a new LuCI.baseclass subclassed from this class, extended
		 * by the given properties and with its prototype set to this base
		 * class to enable inheritance. The resulting value represents a
		 * class constructor and can be instantiated with `new`.
		 */
		extend(properties) {
			const props = {
				__id__: { value: classIndex },
				__base__: { value: this.prototype },
				__name__: { value: properties.__name__ ?? `anonymous${classIndex++}` }
			};

			const ClassConstructor = function() {
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

			for (const key in properties)
				if (!props[key] && properties.hasOwnProperty(key))
					props[key] = { value: properties[key], writable: true };

			ClassConstructor.prototype = Object.create(this.prototype, props);
			ClassConstructor.prototype.constructor = ClassConstructor;
			Object.assign(ClassConstructor, this);
			ClassConstructor.displayName = toCamelCase(`${props.__name__.value}Class`);

			return ClassConstructor;
		},

		/**
		 * Extends this base class with the properties described in
		 * `properties`, instantiates the resulting subclass using
		 * the additional optional arguments passed to this function
		 * and returns the resulting subclassed Class instance.
		 *
		 * This function serves as a convenience shortcut for
		 * {@link LuCI.baseclass.extend Class.extend()} and subsequent
		 * `new`.
		 *
		 * @memberof LuCI.baseclass
		 *
		 * @param {Object<string, *>} properties
		 * An object describing the properties to add to the new
		 * subclass.
		 *
		 * @param {...*} [new_args]
		 * Specifies arguments to be passed to the subclass constructor
		 * as-is in order to instantiate the new subclass.
		 *
		 * @returns {LuCI.baseclass}
		 * Returns a new LuCI.baseclass instance extended by the given
		 * properties with its prototype set to this base class to
		 * enable inheritance.
		 */
		singleton(properties, ...new_args) {
			return Class.extend(properties).instantiate(new_args);
		},

		/**
		 * Calls the class constructor using `new` with the given argument
		 * array being passed as variadic parameters to the constructor.
		 *
		 * @memberof LuCI.baseclass
		 *
		 * @param {Array<*>} params
		 * An array of arbitrary values which will be passed as arguments
		 * to the constructor function.
		 *
		 * @returns {LuCI.baseclass}
		 * Returns a new LuCI.baseclass instance extended by the given
		 * properties with its prototype set to this base class to
		 * enable inheritance.
		 */
		instantiate(args) {
			return new (Function.prototype.bind.call(this, null, ...args))();
		},

		/* unused */
		call(self, method, ...args) {
			if (typeof(this.prototype[method]) != 'function')
				throw new ReferenceError(`${method} is not defined in class`);

			return this.prototype[method].call(self, method, ...args);
		},

		/**
		 * Checks whether the given class value is a subclass of this class.
		 *
		 * @memberof LuCI.baseclass
		 *
		 * @param {LuCI.baseclass} classValue
		 * The class object to test.
		 *
		 * @returns {boolean}
		 * Returns `true` when the given `classValue` is a subclass of this
		 * class or `false` if the given value is not a valid class or not
		 * a subclass of this class'.
		 */
		isSubclass(classValue) {
			return (typeof(classValue) == 'function' && classValue.prototype instanceof this);
		},

		prototype: {
			/**
			 * Extract all values from the given argument array beginning from
			 * `offset` and prepend any further given optional parameters to
			 * the beginning of the resulting array copy.
			 *
			 * @memberof LuCI.baseclass
			 * @instance
			 *
			 * @param {Array<*>} args
			 * The array to extract the values from.
			 *
			 * @param {number} offset
			 * The offset from which to extract the values. An offset of `0`
			 * would copy all values till the end.
			 *
			 * @param {...*} [extra_args]
			 * Extra arguments to add to prepend to the resulting array.
			 *
			 * @returns {Array<*>}
			 * Returns a new array consisting of the optional extra arguments
			 * and the values extracted from the `args` array beginning with
			 * `offset`.
			 */
			varargs(args, offset, ...extra_args) {
				return extra_args.concat(Array.prototype.slice.call(args, offset));
			},

			/**
			 * Walks up the parent class chain and looks for a class member
			 * called `key` in any of the parent classes this class inherits
			 * from. Returns the member value of the superclass or calls the
			 * member as function and returns its return value when the
			 * optional `callArgs` array is given.
			 *
			 * This function has two signatures and is sensitive to the
			 * amount of arguments passed to it:
			 *  - `super('key')` -
			 *	Returns the value of `key` when found within one of the
			 *	parent classes.
			 *  - `super('key', ['arg1', 'arg2'])` -
			 *	Calls the `key()` method with parameters `arg1` and `arg2`
			 *	when found within one of the parent classes.
			 *
			 * @memberof LuCI.baseclass
			 * @instance
			 *
			 * @param {string} key
			 * The name of the superclass member to retrieve.
			 *
			 * @param {Array<*>} [callArgs]
			 * An optional array of function call parameters to use. When
			 * this parameter is specified, the found member value is called
			 * as function using the values of this array as arguments.
			 *
			 * @throws {ReferenceError}
			 * Throws a `ReferenceError` when `callArgs` are specified and
			 * the found member named by `key` is not a function value.
			 *
			 * @returns {*|null}
			 * Returns the value of the found member or the return value of
			 * the call to the found method. Returns `null` when no member
			 * was found in the parent class chain or when the call to the
			 * superclass method returned `null`.
			 */
			super(key, ...callArgs) {
				if (key == null)
					return null;

				const slotIdx = `${this.__id__}.${key}`;
				const symStack = superContext[slotIdx];
				let protoCtx = null;

				for (protoCtx = Object.getPrototypeOf(symStack ? symStack[0] : Object.getPrototypeOf(this));
					 protoCtx != null && !protoCtx.hasOwnProperty(key);
					 protoCtx = Object.getPrototypeOf(protoCtx)) {}

				if (protoCtx == null)
					return null;

				let res = protoCtx[key];

				if (callArgs.length > 0) {
					if (typeof(res) != 'function')
						throw new ReferenceError(`${key} is not a function in base class`);

					if (Array.isArray(callArgs[0]) || LuCI.prototype.isArguments(callArgs[0]))
						callArgs = callArgs[0];

					if (symStack)
						symStack.unshift(protoCtx);
					else
						superContext[slotIdx] = [ protoCtx ];

					res = res.apply(this, callArgs);

					if (symStack && symStack.length > 1)
						symStack.shift(protoCtx);
					else
						delete superContext[slotIdx];
				}

				return res;
			},

			/**
			 * Returns a string representation of this class.
			 *
			 * @returns {string}
			 * Returns a string representation of this class containing the
			 * constructor functions `displayName` and describing the class
			 * members and their respective types.
			 */
			toString() {
				let s = `[${this.constructor.displayName}]`, f = true;
				for (const k in this) {
					if (this.hasOwnProperty(k)) {
						s += `${f ? ' {\n' : ''}  ${k}: ${typeof(this[k])}\n`;
						f = false;
					}
				}
				return s + (f ? '' : '}');
			}
		}
	});


	/**
	 * @class headers
	 * @memberof LuCI
	 * @hideconstructor
	 * @classdesc
	 *
	 * The `Headers` class is an internal utility class exposed in HTTP
	 * response objects using the `response.headers` property.
	 */
	const Headers = Class.extend(/** @lends LuCI.headers.prototype */ {
		__name__: 'LuCI.headers',
		__init__(xhr) {
			const hdrs = this.headers = {};
			xhr.getAllResponseHeaders().split(/\r\n/).forEach(line => {
				const m = /^([^:]+):(.*)$/.exec(line);
				if (m != null)
					hdrs[m[1].trim().toLowerCase()] = m[2].trim();
			});
		},

		/**
		 * Checks whether the given header name is present.
		 * Note: Header-Names are case-insensitive.
		 *
		 * @instance
		 * @memberof LuCI.headers
		 * @param {string} name
		 * The header name to check
		 *
		 * @returns {boolean}
		 * Returns `true` if the header name is present, `false` otherwise
		 */
		has(name) {
			return this.headers.hasOwnProperty(String(name).toLowerCase());
		},

		/**
		 * Returns the value of the given header name.
		 * Note: Header-Names are case-insensitive.
		 *
		 * @instance
		 * @memberof LuCI.headers
		 * @param {string} name
		 * The header name to read
		 *
		 * @returns {string|null}
		 * The value of the given header name or `null` if the header isn't present.
		 */
		get(name) {
			const key = String(name).toLowerCase();
			return this.headers.hasOwnProperty(key) ? this.headers[key] : null;
		}
	});

	/**
	 * @class response
	 * @memberof LuCI
	 * @hideconstructor
	 * @classdesc
	 *
	 * The `Response` class is an internal utility class representing HTTP responses.
	 */
	const Response = Class.extend({
		__name__: 'LuCI.response',
		__init__(xhr, url, duration, headers, content) {
			/**
			 * Describes whether the response is successful (status codes `200..299`) or not
			 * @instance
			 * @memberof LuCI.response
			 * @name ok
			 * @type {boolean}
			 */
			this.ok = (xhr.status >= 200 && xhr.status <= 299);

			/**
			 * The numeric HTTP status code of the response
			 * @instance
			 * @memberof LuCI.response
			 * @name status
			 * @type {number}
			 */
			this.status = xhr.status;

			/**
			 * The HTTP status description message of the response
			 * @instance
			 * @memberof LuCI.response
			 * @name statusText
			 * @type {string}
			 */
			this.statusText = xhr.statusText;

			/**
			 * The HTTP headers of the response
			 * @instance
			 * @memberof LuCI.response
			 * @name headers
			 * @type {LuCI.headers}
			 */
			this.headers = (headers != null) ? headers : new Headers(xhr);

			/**
			 * The total duration of the HTTP request in milliseconds
			 * @instance
			 * @memberof LuCI.response
			 * @name duration
			 * @type {number}
			 */
			this.duration = duration;

			/**
			 * The final URL of the request, i.e. after following redirects.
			 * @instance
			 * @memberof LuCI.response
			 * @name url
			 * @type {string}
			 */
			this.url = url;

			/* privates */
			this.xhr = xhr;

			if (content instanceof Blob) {
				this.responseBlob = content;
				this.responseJSON = null;
				this.responseText = null;
			}
			else if (content != null && typeof(content) == 'object') {
				this.responseBlob = null;
				this.responseJSON = content;
				this.responseText = null;
			}
			else if (content != null) {
				this.responseBlob = null;
				this.responseJSON = null;
				this.responseText = String(content);
			}
			else {
				this.responseJSON = null;

				if (xhr.responseType == 'blob') {
					this.responseBlob = xhr.response;
					this.responseText = null;
				}
				else {
					this.responseBlob = null;
					this.responseText = xhr.responseText;
				}
			}
		},

		/**
		 * Clones the given response object, optionally overriding the content
		 * of the cloned instance.
		 *
		 * @instance
		 * @memberof LuCI.response
		 * @param {*} [content]
		 * Override the content of the cloned response. Object values will be
		 * treated as JSON response data, all other types will be converted
		 * using `String()` and treated as response text.
		 *
		 * @returns {LuCI.response}
		 * The cloned `Response` instance.
		 */
		clone(content) {
			const copy = new Response(this.xhr, this.url, this.duration, this.headers, content);

			copy.ok = this.ok;
			copy.status = this.status;
			copy.statusText = this.statusText;

			return copy;
		},

		/**
		 * Access the response content as JSON data.
		 *
		 * @instance
		 * @memberof LuCI.response
		 * @throws {SyntaxError}
		 * Throws `SyntaxError` if the content isn't valid JSON.
		 *
		 * @returns {*}
		 * The parsed JSON data.
		 */
		json() {
			if (this.responseJSON == null)
				this.responseJSON = JSON.parse(this.responseText);

			return this.responseJSON;
		},

		/**
		 * Access the response content as string.
		 *
		 * @instance
		 * @memberof LuCI.response
		 * @returns {string}
		 * The response content.
		 */
		text() {
			if (this.responseText == null && this.responseJSON != null)
				this.responseText = JSON.stringify(this.responseJSON);

			return this.responseText;
		},

		/**
		 * Access the response content as blob.
		 *
		 * @instance
		 * @memberof LuCI.response
		 * @returns {Blob}
		 * The response content as blob.
		 */
		blob() {
			return this.responseBlob;
		}
	});


	const requestQueue = [];

	function isQueueableRequest(opt) {
		if (!classes.rpc)
			return false;

		if (opt.method != 'POST' || typeof(opt.content) != 'object')
			return false;

		if (opt.nobatch === true)
			return false;

		const rpcBaseURL = Request.expandURL(classes.rpc.getBaseURL());

		return (rpcBaseURL != null && opt.url.indexOf(rpcBaseURL) == 0);
	}

	function flushRequestQueue() {
		if (!requestQueue.length)
			return;

		const reqopt = Object.assign({}, requestQueue[0][0], { content: [], nobatch: true }), batch = [];

		for (let i = 0; i < requestQueue.length; i++) {
			batch[i] = requestQueue[i];
			reqopt.content[i] = batch[i][0].content;
		}

		requestQueue.length = 0;

		Request.request(rpcBaseURL, reqopt).then(reply => {
			let json = null, req = null;

			try { json = reply.json() }
			catch(e) { }

			while ((req = batch.shift()) != null)
				if (Array.isArray(json) && json.length)
					req[2].call(reqopt, reply.clone(json.shift()));
				else
					req[1].call(reqopt, new Error('No related RPC reply'));
		}).catch(error => {
			let req = null;

			while ((req = batch.shift()) != null)
				req[1].call(reqopt, error);
		});
	}

	/**
	 * @class request
	 * @memberof LuCI
	 * @hideconstructor
	 * @classdesc
	 *
	 * The `Request` class allows initiating HTTP requests and provides utilities
	 * for dealing with responses.
	 */
	const Request = Class.singleton(/** @lends LuCI.request.prototype */ {
		__name__: 'LuCI.request',

		interceptors: [],

		/**
		 * Turn the given relative URL into an absolute URL if necessary.
		 *
		 * @instance
		 * @memberof LuCI.request
		 * @param {string} url
		 * The URL to convert.
		 *
		 * @returns {string}
		 * The absolute URL derived from the given one, or the original URL
		 * if it already was absolute.
		 */
		expandURL(url) {
			if (!/^(?:[^/]+:)?\/\//.test(url))
				url = `${location.protocol}//${location.host}${url}`;

			return url;
		},

		/**
		 * @typedef {Object} RequestOptions
		 * @memberof LuCI.request
		 *
		 * @property {string} [method=GET]
		 * The HTTP method to use, e.g. `GET` or `POST`.
		 *
		 * @property {Object<string, Object|string>} [query]
		 * Query string data to append to the URL. Non-string values of the
		 * given object will be converted to JSON.
		 *
		 * @property {boolean} [cache=false]
		 * Specifies whether the HTTP response may be retrieved from cache.
		 *
		 * @property {string} [username]
		 * Provides a username for HTTP basic authentication.
		 *
		 * @property {string} [password]
		 * Provides a password for HTTP basic authentication.
		 *
		 * @property {number} [timeout]
		 * Specifies the request timeout in milliseconds.
		 *
		 * @property {boolean} [credentials=false]
		 * Whether to include credentials such as cookies in the request.
		 *
		 * @property {string} [responseType=text]
		 * Overrides the request response type. Valid values or `text` to
		 * interpret the response as UTF-8 string or `blob` to handle the
		 * response as binary `Blob` data.
		 *
		 * @property {*} [content]
		 * Specifies the HTTP message body to send along with the request.
		 * If the value is a function, it is invoked and the return value
		 * used as content, if it is a FormData instance, it is used as-is,
		 * if it is an object, it will be converted to JSON, in all other
		 * cases it is converted to a string.
		 *
		 * @property {Object<string, string>} [header]
		 * Specifies HTTP headers to set for the request.
		 *
		 * @property {function} [progress]
		 * An optional request callback function which receives ProgressEvent
		 * instances as sole argument during the HTTP request transfer.
		 */

		/**
		 * Initiate an HTTP request to the given target.
		 *
		 * @instance
		 * @memberof LuCI.request
		 * @param {string} target
		 * The URL to request.
		 *
		 * @param {LuCI.request.RequestOptions} [options]
		 * Additional options to configure the request.
		 *
		 * @returns {Promise<LuCI.response>}
		 * The resulting HTTP response.
		 */
		request(target, options) {
			return Promise.resolve(target).then(url => {
				const state = { xhr: new XMLHttpRequest(), url: this.expandURL(url), start: Date.now() };
				const opt = Object.assign({}, options, state);
				let content = null;
				let contenttype = null;
				const callback = this.handleReadyStateChange;

				return new Promise((resolveFn, rejectFn) => {
					opt.xhr.onreadystatechange = callback.bind(opt, resolveFn, rejectFn);
					opt.method = String(opt.method ?? 'GET').toUpperCase();

					if ('query' in opt) {
						const q = (opt.query != null) ? Object.keys(opt.query).map(k => {
							if (opt.query[k] != null) {
								const v = (typeof(opt.query[k]) == 'object')
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

					opt.xhr.responseType = opt.responseType ?? 'text';

					if ('overrideMimeType' in opt.xhr)
						opt.xhr.overrideMimeType('application/octet-stream');

					if ('timeout' in opt)
						opt.xhr.timeout = +opt.timeout;

					if ('credentials' in opt)
						opt.xhr.withCredentials = !!opt.credentials;

					if (opt.content != null) {
						switch (typeof(opt.content)) {
						case 'function':
							content = opt.content(opt.xhr);
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
						for (const header in opt.headers)
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
			});
		},

		handleReadyStateChange(resolveFn, rejectFn, ev) {
			const xhr = this.xhr, duration = Date.now() - this.start;

			if (xhr.readyState !== 4)
				return;

			if (xhr.status === 0 && xhr.statusText === '') {
				if (duration >= this.timeout)
					rejectFn.call(this, new Error('XHR request timed out'));
				else
					rejectFn.call(this, new Error('XHR request aborted by browser'));
			}
			else {
				const response = new Response(
					xhr, xhr.responseURL ?? this.url, duration);

				Promise.all(Request.interceptors.map(fn => fn(response)))
					.then(resolveFn.bind(this, response))
					.catch(rejectFn.bind(this));
			}
		},

		/**
		 * Initiate an HTTP GET request to the given target.
		 *
		 * @instance
		 * @memberof LuCI.request
		 * @param {string} url
		 * The URL to request.
		 *
		 * @param {LuCI.request.RequestOptions} [options]
		 * Additional options to configure the request.
		 *
		 * @returns {Promise<LuCI.response>}
		 * The resulting HTTP response.
		 */
		get(url, options) {
			return this.request(url, Object.assign({ method: 'GET' }, options));
		},

		/**
		 * Initiate an HTTP POST request to the given target.
		 *
		 * @instance
		 * @memberof LuCI.request
		 * @param {string} url
		 * The URL to request.
		 *
		 * @param {*} [data]
		 * The request data to send, see {@link LuCI.request.RequestOptions} for details.
		 *
		 * @param {LuCI.request.RequestOptions} [options]
		 * Additional options to configure the request.
		 *
		 * @returns {Promise<LuCI.response>}
		 * The resulting HTTP response.
		 */
		post(url, data, options) {
			return this.request(url, Object.assign({ method: 'POST', content: data }, options));
		},

		/**
		 * Interceptor functions are invoked whenever an HTTP reply is received, in the order
		 * these functions have been registered.
		 * @callback LuCI.request.interceptorFn
		 * @param {LuCI.response} res
		 * The HTTP response object
		 */

		/**
		 * Register an HTTP response interceptor function. Interceptor
		 * functions are useful to perform default actions on incoming HTTP
		 * responses, such as checking for expired authentication or for
		 * implementing request retries before returning a failure.
		 *
		 * @instance
		 * @memberof LuCI.request
		 * @param {LuCI.request.interceptorFn} interceptorFn
		 * The interceptor function to register.
		 *
		 * @returns {LuCI.request.interceptorFn}
		 * The registered function.
		 */
		addInterceptor(interceptorFn) {
			if (typeof(interceptorFn) == 'function')
				this.interceptors.push(interceptorFn);
			return interceptorFn;
		},

		/**
		 * Remove an HTTP response interceptor function. The passed function
		 * value must be the very same value that was used to register the
		 * function.
		 *
		 * @instance
		 * @memberof LuCI.request
		 * @param {LuCI.request.interceptorFn} interceptorFn
		 * The interceptor function to remove.
		 *
		 * @returns {boolean}
		 * Returns `true` if any function has been removed, else `false`.
		 */
		removeInterceptor(interceptorFn) {
			const oldlen = this.interceptors.length;
			let i = oldlen;
			while (i--)
				if (this.interceptors[i] === interceptorFn)
					this.interceptors.splice(i, 1);
			return (this.interceptors.length < oldlen);
		},

		/**
		 * @class
		 * @memberof LuCI.request
		 * @hideconstructor
		 * @classdesc
		 *
		 * The `Request.poll` class provides some convenience wrappers around
		 * {@link LuCI.poll} mainly to simplify registering repeating HTTP
		 * request calls as polling functions.
		 */
		poll: {
			/**
			 * The callback function is invoked whenever an HTTP reply to a
			 * polled request is received or when the polled request timed
			 * out.
			 *
			 * @callback LuCI.request.poll~callbackFn
			 * @param {LuCI.response} res
			 * The HTTP response object.
			 *
			 * @param {*} data
			 * The response JSON if the response could be parsed as such,
			 * else `null`.
			 *
			 * @param {number} duration
			 * The total duration of the request in milliseconds.
			 */

			/**
			 * Register a repeating HTTP request with an optional callback
			 * to invoke whenever a response for the request is received.
			 *
			 * @instance
			 * @memberof LuCI.request.poll
			 * @param {number} interval
			 * The poll interval in seconds.
			 *
			 * @param {string} url
			 * The URL to request on each poll.
			 *
			 * @param {LuCI.request.RequestOptions} [options]
			 * Additional options to configure the request.
			 *
			 * @param {LuCI.request.poll~callbackFn} [callback]
			 * {@link LuCI.request.poll~callbackFn Callback} function to
			 * invoke for each HTTP reply.
			 *
			 * @throws {TypeError}
			 * Throws `TypeError` when an invalid interval was passed.
			 *
			 * @returns {function}
			 * Returns the internally created poll function.
			 */
			add(interval, url, options, callback) {
				if (isNaN(interval) || interval <= 0)
					throw new TypeError('Invalid poll interval');

				const ival = interval >>> 0, opts = Object.assign({}, options, { timeout: ival * 1000 - 5 });

				const fn = () => Request.request(url, opts).then(res => {
					if (!Poll.active())
						return;

					let res_json = null;
					try {
						res_json = res.json();
					}
					catch (err) {}

					callback(res, res_json, res.duration);
				});

				return (Poll.add(fn, ival) ? fn : null);
			},

			/**
			 * Remove a polling request that has been previously added using `add()`.
			 * This function is essentially a wrapper around
			 * {@link LuCI.poll.remove LuCI.poll.remove()}.
			 *
			 * @instance
			 * @memberof LuCI.request.poll
			 * @param {function} entry
			 * The poll function returned by {@link LuCI.request.poll#add add()}.
			 *
			 * @returns {boolean}
			 * Returns `true` if any function has been removed, else `false`.
			 */
			remove(entry) { return Poll.remove(entry) },

			/**
			  * Alias for {@link LuCI.poll.start LuCI.poll.start()}.
			  *
			  * @instance
			  * @memberof LuCI.request.poll
			  */
			start() { return Poll.start() },

			/**
			  * Alias for {@link LuCI.poll.stop LuCI.poll.stop()}.
			  *
			  * @instance
			  * @memberof LuCI.request.poll
			  */
			stop() { return Poll.stop() },

			/**
			  * Alias for {@link LuCI.poll.active LuCI.poll.active()}.
			  *
			  * @instance
			  * @memberof LuCI.request.poll
			  */
			active() { return Poll.active() }
		}
	});

	/**
	 * @class poll
	 * @memberof LuCI
	 * @hideconstructor
	 * @classdesc
	 *
	 * The `Poll` class allows registering and unregistering poll actions,
	 * as well as starting, stopping and querying the state of the polling
	 * loop.
	 */
	const Poll = Class.singleton(/** @lends LuCI.poll.prototype */ {
		__name__: 'LuCI.poll',

		queue: [],

		/**
		 * Add a new operation to the polling loop. If the polling loop is not
		 * already started at this point, it will be implicitly started.
		 *
		 * @instance
		 * @memberof LuCI.poll
		 * @param {function} fn
		 * The function to invoke on each poll interval.
		 *
		 * @param {number} interval
		 * The poll interval in seconds.
		 *
		 * @throws {TypeError}
		 * Throws `TypeError` when an invalid interval was passed.
		 *
		 * @returns {boolean}
		 * Returns `true` if the function has been added or `false` if it
		 * already is registered.
		 */
		add(fn, interval) {
			if (interval == null || interval <= 0)
				interval = env.pollinterval || null;

			if (isNaN(interval) || typeof(fn) != 'function')
				throw new TypeError('Invalid argument to LuCI.poll.add()');

			for (let i = 0; i < this.queue.length; i++)
				if (this.queue[i].fn === fn)
					return false;

			const e = {
				r: true,
				i: interval >>> 0,
				fn
			};

			this.queue.push(e);

			if (this.tick != null && !this.active())
				this.start();

			return true;
		},

		/**
		 * Remove an operation from the polling loop. If no further operations
		 * are registered, the polling loop is implicitly stopped.
		 *
		 * @instance
		 * @memberof LuCI.poll
		 * @param {function} fn
		 * The function to remove.
		 *
		 * @throws {TypeError}
		 * Throws `TypeError` when the given argument isn't a function.
		 *
		 * @returns {boolean}
		 * Returns `true` if the function has been removed or `false` if it
		 * wasn't found.
		 */
		remove(fn) {
			if (typeof(fn) != 'function')
				throw new TypeError('Invalid argument to LuCI.poll.remove()');

			const len = this.queue.length;

			for (let i = len; i > 0; i--)
				if (this.queue[i-1].fn === fn)
					this.queue.splice(i-1, 1);

			if (!this.queue.length && this.stop())
				this.tick = 0;

			return (this.queue.length != len);
		},

		/**
		 * (Re)start the polling loop. Dispatches a custom `poll-start` event
		 * to the `document` object upon successful start.
		 *
		 * @instance
		 * @memberof LuCI.poll
		 * @returns {boolean}
		 * Returns `true` if polling has been started (or if no functions
		 * where registered) or `false` when the polling loop already runs.
		 */
		start() {
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

		/**
		 * Stop the polling loop. Dispatches a custom `poll-stop` event
		 * to the `document` object upon successful stop.
		 *
		 * @instance
		 * @memberof LuCI.poll
		 * @returns {boolean}
		 * Returns `true` if polling has been stopped or `false` if it didn't
		 * run to begin with.
		 */
		stop() {
			if (!this.active())
				return false;

			document.dispatchEvent(new CustomEvent('poll-stop'));
			window.clearInterval(this.timer);
			delete this.timer;
			delete this.tick;
			return true;
		},

		/* private */
		step() {
			for (let i = 0, e = null; (e = Poll.queue[i]) != null; i++) {
				if ((Poll.tick % e.i) != 0)
					continue;

				if (!e.r)
					continue;

				e.r = false;

				Promise.resolve(e.fn()).finally((function() { this.r = true }).bind(e));
			}

			Poll.tick = (Poll.tick + 1) % Math.pow(2, 32);
		},

		/**
		 * Test whether the polling loop is running.
		 *
		 * @instance
		 * @memberof LuCI.poll
		 * @returns {boolean} - Returns `true` if polling is active, else `false`.
		 */
		active() {
			return (this.timer != null);
		}
	});

	/**
	 * @class dom
	 * @memberof LuCI
	 * @hideconstructor
	 * @classdesc
	 *
	 * The `dom` class provides convenience method for creating and
	 * manipulating DOM elements.
	 *
	 * To import the class in views, use `'require dom'`, to import it in
	 * external JavaScript, use `L.require("dom").then(...)`.
	 */
	const DOM = Class.singleton(/** @lends LuCI.dom.prototype */ {
		__name__: 'LuCI.dom',

		/**
		 * Tests whether the given argument is a valid DOM `Node`.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {*} e
		 * The value to test.
		 *
		 * @returns {boolean}
		 * Returns `true` if the value is a DOM `Node`, else `false`.
		 */
		elem(e) {
			return (e != null && typeof(e) == 'object' && 'nodeType' in e);
		},

		/**
		 * Parses a given string as HTML and returns the first child node.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {string} s
		 * A string containing an HTML fragment to parse. Note that only
		 * the first result of the resulting structure is returned, so an
		 * input value of `<div>foo</div> <div>bar</div>` will only return
		 * the first `div` element node.
		 *
		 * @returns {Node}
		 * Returns the first DOM `Node` extracted from the HTML fragment or
		 * `null` on parsing failures or if no element could be found.
		 */
		parse(s) {
			try {
				return domParser.parseFromString(s, 'text/html').body.firstChild;
			}
			catch(e) {
				return null;
			}
		},

		/**
		 * Tests whether a given `Node` matches the given query selector.
		 *
		 * This function is a convenience wrapper around the standard
		 * `Node.matches("selector")` function with the added benefit that
		 * the `node` argument may be a non-`Node` value, in which case
		 * this function simply returns `false`.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {*} node
		 * The `Node` argument to test the selector against.
		 *
		 * @param {string} [selector]
		 * The query selector expression to test against the given node.
		 *
		 * @returns {boolean}
		 * Returns `true` if the given node matches the specified selector
		 * or `false` when the node argument is no valid DOM `Node` or the
		 * selector didn't match.
		 */
		matches(node, selector) {
			const m = this.elem(node) ? (node.matches ?? node.msMatchesSelector) : null;
			return m ? m.call(node, selector) : false;
		},

		/**
		 * Returns the closest parent node that matches the given query
		 * selector expression.
		 *
		 * This function is a convenience wrapper around the standard
		 * `Node.closest("selector")` function with the added benefit that
		 * the `node` argument may be a non-`Node` value, in which case
		 * this function simply returns `null`.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {*} node
		 * The `Node` argument to find the closest parent for.
		 *
		 * @param {string} [selector]
		 * The query selector expression to test against each parent.
		 *
		 * @returns {Node|null}
		 * Returns the closest parent node matching the selector or
		 * `null` when the node argument is no valid DOM `Node` or the
		 * selector didn't match any parent.
		 */
		parent(node, selector) {
			if (this.elem(node) && node.closest)
				return node.closest(selector);

			while (this.elem(node))
				if (this.matches(node, selector))
					return node;
				else
					node = node.parentNode;

			return null;
		},

		/**
		 * Appends the given children data to the given node.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {*} node
		 * The `Node` argument to append the children to.
		 *
		 * @param {*} [children]
		 * The children to append to the given node.
		 *
		 * When `children` is an array, then each item of the array
		 * will be either appended as child element or text node,
		 * depending on whether the item is a DOM `Node` instance or
		 * some other non-`null` value. Non-`Node`, non-`null` values
		 * will be converted to strings first before being passed as
		 * argument to `createTextNode()`.
		 *
		 * When `children` is a function, it will be invoked with
		 * the passed `node` argument as sole parameter and the `append`
		 * function will be invoked again, with the given `node` argument
		 * as first and the return value of the `children` function as
		 * second parameter.
		 *
		 * When `children` is a DOM `Node` instance, it will be
		 * appended to the given `node`.
		 *
		 * When `children` is any other non-`null` value, it will be
		 * converted to a string and appended to the `innerHTML` property
		 * of the given `node`.
		 *
		 * @returns {Node|null}
		 * Returns the last children `Node` appended to the node or `null`
		 * if either the `node` argument was no valid DOM `node` or if the
		 * `children` was `null` or didn't result in further DOM nodes.
		 */
		append(node, children) {
			if (!this.elem(node))
				return null;

			if (Array.isArray(children)) {
				for (let i = 0; i < children.length; i++)
					if (this.elem(children[i]))
						node.appendChild(children[i]);
					else if (children !== null && children !== undefined)
						node.appendChild(document.createTextNode(`${children[i]}`));

				return node.lastChild;
			}
			else if (typeof(children) === 'function') {
				return this.append(node, children(node));
			}
			else if (this.elem(children)) {
				return node.appendChild(children);
			}
			else if (children !== null && children !== undefined) {
				node.innerHTML = `${children}`;
				return node.lastChild;
			}

			return null;
		},

		/**
		 * Replaces the content of the given node with the given children.
		 *
		 * This function first removes any children of the given DOM
		 * `Node` and then adds the given children following the
		 * rules outlined below.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {*} node
		 * The `Node` argument to replace the children of.
		 *
		 * @param {*} [children]
		 * The children to replace into the given node.
		 *
		 * When `children` is an array, then each item of the array
		 * will be either appended as child element or text node,
		 * depending on whether the item is a DOM `Node` instance or
		 * some other non-`null` value. Non-`Node`, non-`null` values
		 * will be converted to strings first before being passed as
		 * argument to `createTextNode()`.
		 *
		 * When `children` is a function, it will be invoked with
		 * the passed `node` argument as sole parameter and the `append`
		 * function will be invoked again, with the given `node` argument
		 * as first and the return value of the `children` function as
		 * second parameter.
		 *
		 * When `children` is a DOM `Node` instance, it will be
		 * appended to the given `node`.
		 *
		 * When `children` is any other non-`null` value, it will be
		 * converted to a string and appended to the `innerHTML` property
		 * of the given `node`.
		 *
		 * @returns {Node|null}
		 * Returns the last children `Node` appended to the node or `null`
		 * if either the `node` argument was no valid DOM `node` or if the
		 * `children` was `null` or didn't result in further DOM nodes.
		 */
		content(node, children) {
			if (!this.elem(node))
				return null;

			const dataNodes = node.querySelectorAll('[data-idref]');

			for (let i = 0; i < dataNodes.length; i++)
				delete this.registry[dataNodes[i].getAttribute('data-idref')];

			while (node.firstChild)
				node.removeChild(node.firstChild);

			return this.append(node, children);
		},

		/**
		 * Sets attributes or registers event listeners on element nodes.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {*} node
		 * The `Node` argument to set the attributes or add the event
		 * listeners for. When the given `node` value is not a valid
		 * DOM `Node`, the function returns and does nothing.
		 *
		 * @param {string|Object<string, *>} key
		 * Specifies either the attribute or event handler name to use,
		 * or an object containing multiple key, value pairs which are
		 * each added to the node as either attribute or event handler,
		 * depending on the respective value.
		 *
		 * @param {*} [val]
		 * Specifies the attribute value or event handler function to add.
		 * If the `key` parameter is an `Object`, this parameter will be
		 * ignored.
		 *
		 * When `val` is of type function, it will be registered as event
		 * handler on the given `node` with the `key` parameter being the
		 * event name.
		 *
		 * When `val` is of type object, it will be serialized as JSON and
		 * added as attribute to the given `node`, using the given `key`
		 * as attribute name.
		 *
		 * When `val` is of any other type, it will be added as attribute
		 * to the given `node` as-is, with the underlying `setAttribute()`
		 * call implicitly turning it into a string.
		 */
		attr(node, key, val) {
			if (!this.elem(node))
				return null;

			let attr = null;

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

		/**
		 * Creates a new DOM `Node` from the given `html`, `attr` and
		 * `data` parameters.
		 *
		 * This function has multiple signatures, it can be either invoked
		 * in the form `create(html[, attr[, data]])` or in the form
		 * `create(html[, data])`. The used variant is determined from the
		 * type of the second argument.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {*} html
		 * Describes the node to create.
		 *
		 * When the value of `html` is of type array, a `DocumentFragment`
		 * node is created and each item of the array is first converted
		 * to a DOM `Node` by passing it through `create()` and then added
		 * as child to the fragment.
		 *
		 * When the value of `html` is a DOM `Node` instance, no new
		 * element will be created but the node will be used as-is.
		 *
		 * When the value of `html` is a string starting with `<`, it will
		 * be passed to `dom.parse()` and the resulting value is used.
		 *
		 * When the value of `html` is any other string, it will be passed
		 * to `document.createElement()` for creating a new DOM `Node` of
		 * the given name.
		 *
		 * @param {Object<string, *>} [attr]
		 * Specifies an Object of key, value pairs to set as attributes
		 * or event handlers on the created node. Refer to
		 * {@link LuCI.dom#attr dom.attr()} for details.
		 *
		 * @param {*} [data]
		 * Specifies children to append to the newly created element.
		 * Refer to {@link LuCI.dom#append dom.append()} for details.
		 *
		 * @throws {InvalidCharacterError}
		 * Throws an `InvalidCharacterError` when the given `html`
		 * argument contained malformed markup (such as not escaped
		 * `&` characters in XHTML mode) or when the given node name
		 * in `html` contains characters which are not legal in DOM
		 * element names, such as spaces.
		 *
		 * @returns {Node}
		 * Returns the newly created `Node`.
		 */
		create() {
			const html = arguments[0];
			let attr = arguments[1];
			let data = arguments[2];
			let elem;

			if (!(attr instanceof Object) || Array.isArray(attr))
				data = attr, attr = null;

			if (Array.isArray(html)) {
				elem = document.createDocumentFragment();
				for (let i = 0; i < html.length; i++)
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

		/**
		 * Attaches or detaches arbitrary data to and from a DOM `Node`.
		 *
		 * This function is useful to attach non-string values or runtime
		 * data that is not serializable to DOM nodes. To decouple data
		 * from the DOM, values are not added directly to nodes, but
		 * inserted into a registry instead which is then referenced by a
		 * string key stored as `data-idref` attribute in the node.
		 *
		 * This function has multiple signatures and is sensitive to the
		 * number of arguments passed to it.
		 *
		 *  - `dom.data(node)` -
		 *	 Fetches all data associated with the given node.
		 *  - `dom.data(node, key)` -
		 *	 Fetches a specific key associated with the given node.
		 *  - `dom.data(node, key, val)` -
		 *	 Sets a specific key to the given value associated with the
		 *	 given node.
		 *  - `dom.data(node, null)` -
		 *	 Clears any data associated with the node.
		 *  - `dom.data(node, key, null)` -
		 *	 Clears the given key associated with the node.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {Node} node
		 * The DOM `Node` instance to set or retrieve the data for.
		 *
		 * @param {string|null} [key]
		 * This is either a string specifying the key to retrieve, or
		 * `null` to unset the entire node data.
		 *
		 * @param {*|null} [val]
		 * This is either a non-`null` value to set for a given key or
		 * `null` to remove the given `key` from the specified node.
		 *
		 * @returns {*}
		 * Returns the get or set value, or `null` when no value could
		 * be found.
		 */
		data(node, key, val) {
			if (!node?.getAttribute)
				return null;

			let id = node.getAttribute('data-idref');

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

		/**
		 * Binds the given class instance ot the specified DOM `Node`.
		 *
		 * This function uses the `dom.data()` facility to attach the
		 * passed instance of a Class to a node. This is needed for
		 * complex widget elements or similar where the corresponding
		 * class instance responsible for the element must be retrieved
		 * from DOM nodes obtained by `querySelector()` or similar means.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {Node} node
		 * The DOM `Node` instance to bind the class to.
		 *
		 * @param {Class} inst
		 * The Class instance to bind to the node.
		 *
		 * @throws {TypeError}
		 * Throws a `TypeError` when the given instance argument isn't
		 * a valid Class instance.
		 *
		 * @returns {Class}
		 * Returns the bound class instance.
		 */
		bindClassInstance(node, inst) {
			if (!(inst instanceof Class))
				LuCI.prototype.error('TypeError', 'Argument must be a class instance');

			return this.data(node, '_class', inst);
		},

		/**
		 * Finds a bound class instance on the given node itself or the
		 * first bound instance on its closest parent node.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {Node} node
		 * The DOM `Node` instance to start from.
		 *
		 * @returns {Class|null}
		 * Returns the founds class instance if any or `null` if no bound
		 * class could be found on the node itself or any of its parents.
		 */
		findClassInstance(node) {
			let inst = null;

			do {
				inst = this.data(node, '_class');
				node = node.parentNode;
			}
			while (!(inst instanceof Class) && node != null);

			return inst;
		},

		/**
		 * Finds a bound class instance on the given node itself or the
		 * first bound instance on its closest parent node and invokes
		 * the specified method name on the found class instance.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {Node} node
		 * The DOM `Node` instance to start from.
		 *
		 * @param {string} method
		 * The name of the method to invoke on the found class instance.
		 *
		 * @param {...*} params
		 * Additional arguments to pass to the invoked method as-is.
		 *
		 * @returns {*|null}
		 * Returns the return value of the invoked method if a class
		 * instance and method has been found. Returns `null` if either
		 * no bound class instance could be found, or if the found
		 * instance didn't have the requested `method`.
		 */
		callClassMethod(node, method, ...args) {
			const inst = this.findClassInstance(node);

			if (typeof(inst?.[method]) != 'function')
				return null;

			return inst[method].call(inst, ...args);
		},

		/**
		 * The ignore callback function is invoked by `isEmpty()` for each
		 * child node to decide whether to ignore a child node or not.
		 *
		 * When this function returns `false`, the node passed to it is
		 * ignored, else not.
		 *
		 * @callback LuCI.dom~ignoreCallbackFn
		 * @param {Node} node
		 * The child node to test.
		 *
		 * @returns {boolean}
		 * Boolean indicating whether to ignore the node or not.
		 */

		/**
		 * Tests whether a given DOM `Node` instance is empty or appears
		 * empty.
		 *
		 * Any element child nodes which have the CSS class `hidden` set
		 * or for which the optionally passed `ignoreFn` callback function
		 * returns `false` are ignored.
		 *
		 * @instance
		 * @memberof LuCI.dom
		 * @param {Node} node
		 * The DOM `Node` instance to test.
		 *
		 * @param {LuCI.dom~ignoreCallbackFn} [ignoreFn]
		 * Specifies an optional function which is invoked for each child
		 * node to decide whether the child node should be ignored or not.
		 *
		 * @returns {boolean}
		 * Returns `true` if the node does not have any children or if
		 * any children node either has a `hidden` CSS class or a `false`
		 * result when testing it using the given `ignoreFn`.
		 */
		isEmpty(node, ignoreFn) {
			for (let child = node?.firstElementChild; child != null; child = child.nextElementSibling)
				if (!child.classList.contains('hidden') && !ignoreFn?.(child))
					return false;

			return true;
		}
	});

	/**
	 * @class session
	 * @memberof LuCI
	 * @hideconstructor
	 * @classdesc
	 *
	 * The `session` class provides various session related functionality.
	 */
	const Session = Class.singleton(/** @lends LuCI.session.prototype */ {
		__name__: 'LuCI.session',

		/**
		 * Retrieve the current session ID.
		 *
		 * @returns {string}
		 * Returns the current session ID.
		 */
		getID() {
			return env.sessionid ?? '00000000000000000000000000000000';
		},

		/**
		 * Retrieve the current session token.
		 *
		 * @returns {string|null}
		 * Returns the current session token or `null` if not logged in.
		 */
		getToken() {
			return env.token ?? null;
		},

		/**
		 * Retrieve data from the local session storage.
		 *
		 * @param {string} [key]
		 * The key to retrieve from the session data store. If omitted, all
		 * session data will be returned.
		 *
		 * @returns {*}
		 * Returns the stored session data or `null` if the given key wasn't
		 * found.
		 */
		getLocalData(key) {
			try {
				const sid = this.getID();
				const item = 'luci-session-store';
				let data = JSON.parse(window.sessionStorage.getItem(item));

				if (!LuCI.prototype.isObject(data) || !data.hasOwnProperty(sid)) {
					data = {};
					data[sid] = {};
				}

				if (key != null)
					return data[sid].hasOwnProperty(key) ? data[sid][key] : null;

				return data[sid];
			}
			catch (e) {
				return (key != null) ? null : {};
			}
		},

		/**
		 * Set data in the local session storage.
		 *
		 * @param {string} key
		 * The key to set in the session data store.
		 *
		 * @param {*} value
		 * The value to store. It will be internally converted to JSON before
		 * being put in the session store.
		 *
		 * @returns {boolean}
		 * Returns `true` if the data could be stored or `false` on error.
		 */
		setLocalData(key, value) {
			if (key == null)
				return false;

			try {
				const sid = this.getID();
				const item = 'luci-session-store';
				let data = JSON.parse(window.sessionStorage.getItem(item));

				if (!LuCI.prototype.isObject(data) || !data.hasOwnProperty(sid)) {
					data = {};
					data[sid] = {};
				}

				if (value != null)
					data[sid][key] = value;
				else
					delete data[sid][key];

				window.sessionStorage.setItem(item, JSON.stringify(data));

				return true;
			}
			catch (e) {
				return false;
			}
		}
	});

	/**
	 * @class view
	 * @memberof LuCI
	 * @hideconstructor
	 * @classdesc
	 *
	 * The `view` class forms the basis of views and provides a standard
	 * set of methods to inherit from.
	 */
	const View = Class.extend(/** @lends LuCI.view.prototype */ {
		__name__: 'LuCI.view',

		__init__() {
			const vp = document.getElementById('view');

			DOM.content(vp, E('div', { 'class': 'spinning' }, _('Loading view…')));

			return Promise.resolve(this.load())
				.then(function (...args) {
					if (L.loaded) {
						return Promise.resolve(...args);
					} else {
						return new Promise(function (resolve) {
							document.addEventListener('luci-loaded', resolve.bind(null, ...args), { once: true });
						});
					}
				})
				.then(LuCI.prototype.bind(this.render, this))
				.then(LuCI.prototype.bind(function(nodes) {
					const vp = document.getElementById('view');

					DOM.content(vp, nodes);
					DOM.append(vp, this.addFooter());
				}, this)).catch(LuCI.prototype.error);
		},

		/**
		 * The load function is invoked before the view is rendered.
		 *
		 * The invocation of this function is wrapped by
		 * `Promise.resolve()` so it may return Promises if needed.
		 *
		 * The return value of the function (or the resolved values
		 * of the promise returned by it) will be passed as first
		 * argument to `render()`.
		 *
		 * This function is supposed to be overwritten by subclasses,
		 * the default implementation does nothing.
		 *
		 * @instance
		 * @abstract
		 * @memberof LuCI.view
		 *
		 * @returns {*|Promise<*>}
		 * May return any value or a Promise resolving to any value.
		 */
		load() {},

		/**
		 * The render function is invoked after the
		 * {@link LuCI.view#load load()} function and responsible
		 * for setting up the view contents. It must return a DOM
		 * `Node` or `DocumentFragment` holding the contents to
		 * insert into the view area.
		 *
		 * The invocation of this function is wrapped by
		 * `Promise.resolve()` so it may return Promises if needed.
		 *
		 * The return value of the function (or the resolved values
		 * of the promise returned by it) will be inserted into the
		 * main content area using
		 * {@link LuCI.dom#append dom.append()}.
		 *
		 * This function is supposed to be overwritten by subclasses,
		 * the default implementation does nothing.
		 *
		 * @instance
		 * @abstract
		 * @memberof LuCI.view
		 * @param {*|null} load_results
		 * This function will receive the return value of the
		 * {@link LuCI.view#load view.load()} function as first
		 * argument.
		 *
		 * @returns {Node|Promise<Node>}
		 * Should return a DOM `Node` value or a `Promise` resolving
		 * to a `Node` value.
		 */
		render() {},

		/**
		 * The handleSave function is invoked when the user clicks
		 * the `Save` button in the page action footer.
		 *
		 * The default implementation should be sufficient for most
		 * views using {@link form#Map form.Map()} based forms - it
		 * will iterate all forms present in the view and invoke
		 * the {@link form#Map#save Map.save()} method on each form.
		 *
		 * Views not using `Map` instances or requiring other special
		 * logic should overwrite `handleSave()` with a custom
		 * implementation.
		 *
		 * To disable the `Save` page footer button, views extending
		 * this base class should overwrite the `handleSave` function
		 * with `null`.
		 *
		 * The invocation of this function is wrapped by
		 * `Promise.resolve()` so it may return Promises if needed.
		 *
		 * @instance
		 * @memberof LuCI.view
		 * @param {Event} ev
		 * The DOM event that triggered the function.
		 *
		 * @returns {*|Promise<*>}
		 * Any return values of this function are discarded, but
		 * passed through `Promise.resolve()` to ensure that any
		 * returned promise runs to completion before the button
		 * is re-enabled.
		 */
		handleSave(ev) {
			const tasks = [];

			document.getElementById('maincontent')
				.querySelectorAll('.cbi-map').forEach(map => {
					tasks.push(DOM.callClassMethod(map, 'save'));
				});

			return Promise.all(tasks);
		},

		/**
		 * The handleSaveApply function is invoked when the user clicks
		 * the `Save & Apply` button in the page action footer.
		 *
		 * The default implementation should be sufficient for most
		 * views using {@link form#Map form.Map()} based forms - it
		 * will first invoke
		 * {@link LuCI.view.handleSave view.handleSave()} and then
		 * call {@link ui#changes#apply ui.changes.apply()} to start the
		 * modal config apply and page reload flow.
		 *
		 * Views not using `Map` instances or requiring other special
		 * logic should overwrite `handleSaveApply()` with a custom
		 * implementation.
		 *
		 * To disable the `Save & Apply` page footer button, views
		 * extending this base class should overwrite the
		 * `handleSaveApply` function with `null`.
		 *
		 * The invocation of this function is wrapped by
		 * `Promise.resolve()` so it may return Promises if needed.
		 *
		 * @instance
		 * @memberof LuCI.view
		 * @param {Event} ev
		 * The DOM event that triggered the function.
		 *
		 * @returns {*|Promise<*>}
		 * Any return values of this function are discarded, but
		 * passed through `Promise.resolve()` to ensure that any
		 * returned promise runs to completion before the button
		 * is re-enabled.
		 */
		handleSaveApply(ev, mode) {
			return this.handleSave(ev).then(() => {
				classes.ui.changes.apply(mode == '0');
			});
		},

		/**
		 * The handleReset function is invoked when the user clicks
		 * the `Reset` button in the page action footer.
		 *
		 * The default implementation should be sufficient for most
		 * views using {@link form#Map form.Map()} based forms - it
		 * will iterate all forms present in the view and invoke
		 * the {@link form#Map#save Map.reset()} method on each form.
		 *
		 * Views not using `Map` instances or requiring other special
		 * logic should overwrite `handleReset()` with a custom
		 * implementation.
		 *
		 * To disable the `Reset` page footer button, views extending
		 * this base class should overwrite the `handleReset` function
		 * with `null`.
		 *
		 * The invocation of this function is wrapped by
		 * `Promise.resolve()` so it may return Promises if needed.
		 *
		 * @instance
		 * @memberof LuCI.view
		 * @param {Event} ev
		 * The DOM event that triggered the function.
		 *
		 * @returns {*|Promise<*>}
		 * Any return values of this function are discarded, but
		 * passed through `Promise.resolve()` to ensure that any
		 * returned promise runs to completion before the button
		 * is re-enabled.
		 */
		handleReset(ev) {
			const tasks = [];

			document.getElementById('maincontent')
				.querySelectorAll('.cbi-map').forEach(map => {
					tasks.push(DOM.callClassMethod(map, 'reset'));
				});

			return Promise.all(tasks);
		},

		/**
		 * Renders a standard page action footer if any of the
		 * `handleSave()`, `handleSaveApply()` or `handleReset()`
		 * functions are defined.
		 *
		 * The default implementation should be sufficient for most
		 * views - it will render a standard page footer with action
		 * buttons labeled `Save`, `Save & Apply` and `Reset`
		 * triggering the `handleSave()`, `handleSaveApply()` and
		 * `handleReset()` functions respectively.
		 *
		 * When any of these `handle*()` functions is overwritten
		 * with `null` by a view extending this class, the
		 * corresponding button will not be rendered.
		 *
		 * @instance
		 * @memberof LuCI.view
		 * @returns {DocumentFragment}
		 * Returns a `DocumentFragment` containing the footer bar
		 * with buttons for each corresponding `handle*()` action
		 * or an empty `DocumentFragment` if all three `handle*()`
		 * methods are overwritten with `null`.
		 */
		addFooter() {
			const footer = E([]);
			const vp = document.getElementById('view');
			let hasmap = false;
			let readonly = true;

			vp.querySelectorAll('.cbi-map').forEach(map => {
				const m = DOM.findClassInstance(map);
				if (m) {
					hasmap = true;

					if (!m.readonly)
						readonly = false;
				}
			});

			if (!hasmap)
				readonly = !LuCI.prototype.hasViewPermission();

			const saveApplyBtn = this.handleSaveApply ? new classes.ui.ComboButton('0', {
				0: [ _('Save & Apply') ],
				1: [ _('Apply unchecked') ]
			}, {
				classes: {
					0: 'btn cbi-button cbi-button-apply important',
					1: 'btn cbi-button cbi-button-negative important'
				},
				click: classes.ui.createHandlerFn(this, 'handleSaveApply'),
				disabled: readonly || null
			}).render() : E([]);

			if (this.handleSaveApply || this.handleSave || this.handleReset) {
				footer.appendChild(E('div', { 'class': 'cbi-page-actions' }, [
					saveApplyBtn, ' ',
					this.handleSave ? E('button', {
						'class': 'cbi-button cbi-button-save',
						'click': classes.ui.createHandlerFn(this, 'handleSave'),
						'disabled': readonly || null
					}, [ _('Save') ]) : '', ' ',
					this.handleReset ? E('button', {
						'class': 'cbi-button cbi-button-reset',
						'click': classes.ui.createHandlerFn(this, 'handleReset'),
						'disabled': readonly || null
					}, [ _('Reset') ]) : ''
				]));
			}

			return footer;
		}
	});


	const domParser = new DOMParser();
	let originalCBIInit = null;
	let rpcBaseURL = null;
	let sysFeatures = null;
	let preloadClasses = null;

	/* "preload" builtin classes to make the available via require */
	const classes = {
		baseclass: Class,
		dom: DOM,
		poll: Poll,
		request: Request,
		session: Session,
		view: View
	};

	const naturalCompare = new Intl.Collator(undefined, { numeric: true }).compare;

	const LuCI = Class.extend(/** @lends LuCI.prototype */ {
		__name__: 'LuCI',
		__init__(setenv) {

			document.querySelectorAll('script[src*="/luci.js"]').forEach(s => {
				if (setenv.base_url == null || setenv.base_url == '') {
					const m = (s.getAttribute('src') ?? '').match(/^(.*)\/luci\.js(?:\?v=([^?]+))?$/);
					if (m) {
						setenv.base_url = m[1];
						setenv.resource_version = m[2];
					}
				}
			});

			if (setenv.base_url == null)
				this.error('InternalError', 'Cannot find url of luci.js');

			setenv.cgi_base = setenv.scriptname.replace(/\/[^\/]+$/, '');

			Object.assign(env, setenv);

			const domReady = new Promise((resolveFn, rejectFn) => {
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
			window.cbi_init = () => {};
		},

		/**
		 * Captures the current stack trace and throws an error of the
		 * specified type as a new exception. Also logs the exception as
		 * error to the debug console if it is available.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {Error|string} [type=Error]
		 * Either a string specifying the type of the error to throw or an
		 * existing `Error` instance to copy.
		 *
		 * @param {string} [fmt=Unspecified error]
		 * A format string which is used to form the error message, together
		 * with all subsequent optional arguments.
		 *
		 * @param {...*} [args]
		 * Zero or more variable arguments to the supplied format string.
		 *
		 * @throws {Error}
		 * Throws the created error object with the captured stack trace
		 * appended to the message and the type set to the given type
		 * argument or copied from the given error instance.
		 */
		raise(type, fmt, ...args) {
			let e = null;
			const msg = fmt ? String.prototype.format.call(fmt, ...args) : null;
			const stack = [];

			if (type instanceof Error) {
				e = type;

				if (msg)
					e.message = `${msg}: ${e.message}`;
			}
			else {
				try { throw new Error('stacktrace') }
				catch (e2) { stack.push(...(e2.stack ?? '').split(/\n/)) }

				e = new (window[type ?? 'Error'] ?? Error)(msg ?? 'Unspecified error');
				e.name = type ?? 'Error';
			}

			for (let i = 0; i < stack.length; i++) {
				const frame = stack[i].replace(/(.*?)@(.+):(\d+):(\d+)/g, 'at $1 ($2:$3:$4)').trim();
				stack[i] = frame ? `  ${frame}` : '';
			}

			if (!/^  at /.test(stack[0]))
				stack.shift();

			if (/\braise /.test(stack[0]))
				stack.shift();

			if (/\berror /.test(stack[0]))
				stack.shift();

			if (stack.length)
				e.message += `\n${stack.join('\n')}`;

			if (window.console && console.debug)
				console.debug(e);

			throw e;
		},

		/**
		 * A wrapper around {@link LuCI#raise raise()} which also renders
		 * the error either as modal overlay when `ui.js` is already loaded
		 * or directly into the view body.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {Error|string} [type=Error]
		 * Either a string specifying the type of the error to throw or an
		 * existing `Error` instance to copy.
		 *
		 * @param {string} [fmt=Unspecified error]
		 * A format string which is used to form the error message, together
		 * with all subsequent optional arguments.
		 *
		 * @param {...*} [args]
		 * Zero or more variable arguments to the supplied format string.
		 *
		 * @throws {Error}
		 * Throws the created error object with the captured stack trace
		 * appended to the message and the type set to the given type
		 * argument or copied from the given error instance.
		 */
		error(type, fmt /*, ...*/) {
			try {
				LuCI.prototype.raise.apply(LuCI.prototype,
					Array.prototype.slice.call(arguments));
			}
			catch (e) {
				if (!e.reported) {
					if (classes.ui)
						classes.ui.addNotification(e.name || _('Runtime error'),
							E('pre', {}, e.message), 'danger');
					else
						DOM.content(document.querySelector('#maincontent'),
							E('pre', { 'class': 'alert-message error' }, e.message));

					e.reported = true;
				}

				throw e;
			}
		},

		/**
		 * Return a bound function using the given `self` as `this` context
		 * and any further arguments as parameters to the bound function.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {function} fn
		 * The function to bind.
		 *
		 * @param {*} self
		 * The value to bind as `this` context to the specified function.
		 *
		 * @param {...*} [args]
		 * Zero or more variable arguments which are bound to the function
		 * as parameters.
		 *
		 * @returns {function}
		 * Returns the bound function.
		 */
		bind(fn, self, ...args) {
			return Function.prototype.bind.call(fn, self, ...args);
		},

		/**
		 * Load an additional LuCI JavaScript class and its dependencies,
		 * instantiate it and return the resulting class instance. Each
		 * class is only loaded once. Subsequent attempts to load the same
		 * class will return the already instantiated class.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {string} name
		 * The name of the class to load in dotted notation. Dots will
		 * be replaced by spaces and joined with the runtime-determined
		 * base URL of LuCI.js to form an absolute URL to load the class
		 * file from.
		 *
		 * @throws {DependencyError}
		 * Throws a `DependencyError` when the class to load includes
		 * circular dependencies.
		 *
		 * @throws {NetworkError}
		 * Throws `NetworkError` when the underlying {@link LuCI.request}
		 * call failed.
		 *
		 * @throws {SyntaxError}
		 * Throws `SyntaxError` when the loaded class file code cannot
		 * be interpreted by `eval`.
		 *
		 * @throws {TypeError}
		 * Throws `TypeError` when the class file could be loaded and
		 * interpreted, but when invoking its code did not yield a valid
		 * class instance.
		 *
		 * @returns {Promise<LuCI.baseclass>}
		 * Returns the instantiated class.
		 */
		require(name, from = []) {
			const L = this;
			let url = null;

			/* Class already loaded */
			if (classes[name] != null) {
				/* Circular dependency */
				if (from.indexOf(name) != -1)
					LuCI.prototype.raise('DependencyError',
						'Circular dependency: class "%s" depends on "%s"',
						name, from.join('" which depends on "'));

				return Promise.resolve(classes[name]);
			}

			url = '%s/%s.js%s'.format(env.base_url, name.replace(/\./g, '/'), (env.resource_version ? `?v=${env.resource_version}` : ''));
			from = [ name ].concat(from);

			const compileClass = res => {
				if (!res.ok)
					LuCI.prototype.raise('NetworkError',
						'HTTP error %d while loading class file "%s"', res.status, url);

				const source = res.text();
				const requirematch = /^require[ \t]+(\S+)(?:[ \t]+as[ \t]+([a-zA-Z_]\S*))?$/;
				const strictmatch = /^use[ \t]+strict$/;
				const depends = [];
				let args = '';

				/* find require statements in source */
				for (let i = 0, off = -1, prev = -1, quote = -1, comment = -1, esc = false; i < source.length; i++) {
					const chr = source.charCodeAt(i);

					if (esc) {
						esc = false;
					}
					else if (comment != -1) {
						if ((comment == 47 && chr == 10) || (comment == 42 && prev == 42 && chr == 47))
							comment = -1;
					}
					else if ((chr == 42 || chr == 47) && prev == 47) {
						comment = chr;
					}
					else if (chr == 92) {
						esc = true;
					}
					else if (chr == quote) {
						const s = source.substring(off, i), m = requirematch.exec(s);

						if (m) {
							const dep = m[1], as = m[2] || dep.replace(/[^a-zA-Z0-9_]/g, '_');
							depends.push(LuCI.prototype.require(dep, from));
							args += `, ${as}`;
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

					prev = chr;
				}

				/* load dependencies and instantiate class */
				return Promise.all(depends).then(instances => {
					let _factory, _class;

					try {
						_factory = eval(
							'(function(window, document, L%s) { %s })\n\n//# sourceURL=%s\n'
								.format(args, source, res.url));
					}
					catch (error) {
						LuCI.prototype.raise('SyntaxError', '%s\n  in %s:%s',
							error.message, res.url, error.lineNumber ?? '?');
					}

					_factory.displayName = toCamelCase(`${name}ClassFactory`);
					_class = _factory.apply(_factory, [window, document, L].concat(instances));

					if (!Class.isSubclass(_class))
						LuCI.prototype.error('TypeError', '"%s" factory yields invalid constructor', name);

					if (_class.displayName == 'AnonymousClass')
						_class.displayName = toCamelCase(`${name}Class`);

					let ptr = Object.getPrototypeOf(L);
					let idx = 0;
					const parts = name.split(/\./);
					const instance = new _class();

					while (ptr && idx < parts.length - 1)
						ptr = ptr[parts[idx++]];

					if (ptr)
						ptr[parts[idx]] = instance;

					classes[name] = instance;

					return instance;
				});
			};

			/* Request class file */
			classes[name] = Request.get(url, { cache: true }).then(compileClass);

			return classes[name];
		},

		/* DOM setup */
		probeRPCBaseURL() {
			if (rpcBaseURL == null)
				rpcBaseURL = Session.getLocalData('rpcBaseURL');

			if (rpcBaseURL == null) {
				const msg = {
					jsonrpc: '2.0',
					id:	  'init',
					method:  'list',
					params:  undefined
				};
				const rpcFallbackURL = this.url('admin/ubus');

				rpcBaseURL = Request.post(env.ubuspath, msg, { nobatch: true }).then(res => rpcBaseURL = res.status == 200 ? env.ubuspath : rpcFallbackURL, () => rpcBaseURL = rpcFallbackURL).then(url => {
					Session.setLocalData('rpcBaseURL', url);
					return url;
				});
			}

			return Promise.resolve(rpcBaseURL);
		},

		probeSystemFeatures() {
			if (sysFeatures == null)
				sysFeatures = Session.getLocalData('features');

			if (!this.isObject(sysFeatures)) {
				sysFeatures = classes.rpc.declare({
					object: 'luci',
					method: 'getFeatures',
					expect: { '': {} }
				})().then(features => {
					Session.setLocalData('features', features);
					sysFeatures = features;

					return features;
				});
			}

			return Promise.resolve(sysFeatures);
		},

		probePreloadClasses() {
			if (preloadClasses == null)
				preloadClasses = Session.getLocalData('preload');

			if (!Array.isArray(preloadClasses)) {
				preloadClasses = this.resolveDefault(classes.rpc.declare({
					object: 'file',
					method: 'list',
					params: [ 'path' ],
					expect: { 'entries': [] }
				})(this.fspath(this.resource('preload'))), []).then(entries => {
					const classes = [];

					for (let i = 0; i < entries.length; i++) {
						if (entries[i].type != 'file')
							continue;

						const m = entries[i].name.match(/(.+)\.js$/);

						if (m)
							classes.push('preload.%s'.format(m[1]));
					}

					Session.setLocalData('preload', classes);
					preloadClasses = classes;

					return classes;
				});
			}

			return Promise.resolve(preloadClasses);
		},

		/**
		 * Test whether a particular system feature is available, such as
		 * hostapd SAE support or an installed firewall. The features are
		 * queried once at the beginning of the LuCI session and cached in
		 * `SessionStorage` throughout the lifetime of the associated tab or
		 * browser window.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {string} feature
		 * The feature to test. For detailed list of known feature flags,
		 * see `/modules/luci-base/root/usr/share/rpcd/ucode/luci`.
		 *
		 * @param {string} [subfeature]
		 * Some feature classes like `hostapd` provide sub-feature flags,
		 * such as `sae` or `11w` support. The `subfeature` argument can
		 * be used to query these.
		 *
		 * @return {boolean|null}
		 * Return `true` if the queried feature (and sub-feature) is available
		 * or `false` if the requested feature isn't present or known.
		 * Return `null` when a sub-feature was queried for a feature which
		 * has no sub-features.
		 */
		hasSystemFeature() {
			const ft = sysFeatures[arguments[0]];

			if (arguments.length == 2)
				return this.isObject(ft) ? ft[arguments[1]] : null;

			return (ft != null && ft != false);
		},

		/* private */
		notifySessionExpiry() {
			Poll.stop();

			classes.ui.showModal(_('Session expired'), [
				E('div', { class: 'alert-message warning' },
					_('A new login is required since the authentication session expired.')),
				E('div', { class: 'right' },
					E('div', {
						class: 'btn primary',
						click() {
							const loc = window.location;
							window.location = `${loc.protocol}//${loc.host}${loc.pathname}${loc.search}`;
						}
					}, _('Log in…')))
			]);

			LuCI.prototype.raise('SessionError', 'Login session is expired');
		},

		/* private */
		setupDOM(res) {
			const domEv = res[0], uiClass = res[1], rpcClass = res[2], formClass = res[3], rpcBaseURL = res[4];

			rpcClass.setBaseURL(rpcBaseURL);

			rpcClass.addInterceptor((msg, req) => {
				if (!LuCI.prototype.isObject(msg) ||
					!LuCI.prototype.isObject(msg.error) ||
					msg.error.code != -32002)
					return;

				if (!LuCI.prototype.isObject(req) ||
					(req.object == 'session' && req.method == 'access'))
					return;

				return rpcClass.declare({
					'object': 'session',
					'method': 'access',
					'params': [ 'scope', 'object', 'function' ],
					'expect': { access: true }
				})('uci', 'luci', 'read').catch(LuCI.prototype.notifySessionExpiry);
			});

			Request.addInterceptor(res => {
				let isDenied = false;

				if (res.status == 403 && res.headers.get('X-LuCI-Login-Required') == 'yes')
					isDenied = true;

				if (!isDenied)
					return;

				LuCI.prototype.notifySessionExpiry();
			});

			document.addEventListener('poll-start', ev => {
				uiClass.showIndicator('poll-status', _('Refreshing'), ev => {
					Request.poll.active() ? Request.poll.stop() : Request.poll.start();
				});
			});

			document.addEventListener('poll-stop', ev => {
				uiClass.showIndicator('poll-status', _('Paused'), null, 'inactive');
			});

			return Promise.all([
				this.probeSystemFeatures(),
				this.probePreloadClasses()
			]).finally(LuCI.prototype.bind(function() {
				const tasks = [];

				if (Array.isArray(preloadClasses))
					for (let i = 0; i < preloadClasses.length; i++)
						tasks.push(this.require(preloadClasses[i]));

				return Promise.all(tasks);
			}, this)).finally(this.initDOM);
		},

		/* private */
		initDOM() {
			originalCBIInit();
			Poll.start();
			L.loaded = true;
			document.dispatchEvent(new CustomEvent('luci-loaded'));
		},

		loaded: false,

		/**
		 * The `env` object holds environment settings used by LuCI, such
		 * as request timeouts, base URLs etc.
		 *
		 * @instance
		 * @memberof LuCI
		 */
		env,

		/**
		 * Construct an absolute filesystem path relative to the server
		 * document root.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {...string} [parts]
		 * An array of parts to join into a path.
		 *
		 * @return {string}
		 * Return the joined path.
		 */
		fspath() /* ... */{
			let path = env.documentroot;

			for (let i = 0; i < arguments.length; i++)
				path += `/${arguments[i]}`;

			const p = path.replace(/\/+$/, '').replace(/\/+/g, '/').split(/\//), res = [];

			for (let i = 0; i < p.length; i++)
				if (p[i] == '..')
					res.pop();
				else if (p[i] != '.')
					res.push(p[i]);

			return res.join('/');
		},

		/**
		 * Construct a relative URL path from the given prefix and parts.
		 * The resulting URL is guaranteed to contain only the characters
		 * `a-z`, `A-Z`, `0-9`, `_`, `.`, `%`, `,`, `;`, and `-` as well
		 * as `/` for the path separator. Suffixing '?x=y&foo=bar' URI
		 * parameters also limited to the aforementioned characters is
		 * permissible.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {string} [prefix]
		 * The prefix to join the given parts with. If the `prefix` is
		 * omitted, it defaults to an empty string.
		 *
		 * @param {...string} [parts]
		 * An array of parts to join into a URL path. Parts may contain
		 * slashes and any of the other characters mentioned above.
		 *
		 * @return {string}
		 * Return the joined URL path.
		 */
		path(prefix = '', parts) {
			const url = [ prefix ];

			for (let i = 0; i < parts.length; i++){				
				const part = parts[i];
				if (Array.isArray(part))
					url.push(this.path('', part));
				else
					if (/^(?:[a-zA-Z0-9_.%,;-]+\/)*[a-zA-Z0-9_.%,;-]+$/.test(part) || /^\?[a-zA-Z0-9_.%=&;-]+$/.test(part))
						url.push(part.startsWith('?') ? part : '/' + part);
			}

			if (url.length === 1)
				url.push('/');

			return url.join('');
		},

		/**
		 * Construct a URL with path relative to the script path of the server
		 * side LuCI application (usually `/cgi-bin/luci`).
		 *
		 * The resulting URL is guaranteed to contain only the characters
		 * `a-z`, `A-Z`, `0-9`, `_`, `.`, `%`, `,`, `;`, and `-` as well
		 * as `/` for the path separator. Suffixing '?x=y&foo=bar' URI
		 * parameters also limited to the aforementioned characters is
		 * permissible.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {...string} [parts]
		 * An array of parts to join into a URL path. Parts may contain
		 * slashes and any of the other characters mentioned above.
		 *
		 * @return {string}
		 * Returns the resulting URL path.
		 */
		url() {
			return this.path(env.scriptname, arguments);
		},

		/**
		 * Construct a URL path relative to the global static resource path
		 * of the LuCI ui (usually `/luci-static/resources`).
		 *
		 * The resulting URL is guaranteed to contain only the characters
		 * `a-z`, `A-Z`, `0-9`, `_`, `.`, `%`, `,`, `;`, and `-` as well
		 * as `/` for the path separator. Suffixing '?x=y&foo=bar' URI
		 * parameters also limited to the aforementioned characters is
		 * permissible.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {...string} [parts]
		 * An array of parts to join into a URL path. Parts may contain
		 * slashes and any of the other characters mentioned above.
		 *
		 * @return {string}
		 * Returns the resulting URL path.
		 */
		resource() {
			return this.path(env.resource, arguments);
		},

		/**
		 * Construct a URL path relative to the media resource path of the
		 * LuCI ui (usually `/luci-static/$theme_name`).
		 *
		 * The resulting URL is guaranteed to contain only the characters
		 * `a-z`, `A-Z`, `0-9`, `_`, `.`, `%`, `,`, `;`, and `-` as well
		 * as `/` for the path separator. Suffixing '?x=y&foo=bar' URI
		 * parameters also limited to the aforementioned characters is
		 * permissible.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {...string} [parts]
		 * An array of parts to join into a URL path. Parts may contain
		 * slashes and any of the other characters mentioned above.
		 *
		 * @return {string}
		 * Returns the resulting URL path.
		 */
		media() {
			return this.path(env.media, arguments);
		},

		/**
		 * Return the complete URL path to the current view.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @return {string}
		 * Returns the URL path to the current view.
		 */
		location() {
			return this.path(env.scriptname, env.requestpath);
		},


		/**
		 * Tests whether the passed argument is a JavaScript object.
		 * This function is meant to be an object counterpart to the
		 * standard `Array.isArray()` function.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {*} [val]
		 * The value to test
		 *
		 * @return {boolean}
		 * Returns `true` if the given value is of type object and
		 * not `null`, else returns `false`.
		 */
		isObject(val) {
			return (val != null && typeof(val) == 'object');
		},

		/**
		 * Tests whether the passed argument is a function arguments object.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {*} [val]
		 * The value to test
		 *
		 * @return {boolean}
		 * Returns `true` if the given value is a function arguments object,
		 * else returns `false`.
		 */
		isArguments(val) {
			return (Object.prototype.toString.call(val) == '[object Arguments]');
		},

		/**
		 * Return an array of sorted object keys, optionally sorted by
		 * a different key or a different sorting mode.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {object} obj
		 * The object to extract the keys from. If the given value is
		 * not an object, the function will return an empty array.
		 *
		 * @param {string|null} [key]
		 * Specifies the key to order by. This is mainly useful for
		 * nested objects of objects or objects of arrays when sorting
		 * shall not be performed by the primary object keys but by
		 * some other key pointing to a value within the nested values.
		 *
		 * @param {"addr"|"num"} [sortmode]
		 * Can be either `addr` or `num` to override the natural
		 * lexicographic sorting with a sorting suitable for IP/MAC style
		 * addresses or numeric values respectively.
		 *
		 * @return {string[]}
		 * Returns an array containing the sorted keys of the given object.
		 */
		sortedKeys(obj, key, sortmode) {
			if (obj == null || typeof(obj) != 'object')
				return [];

			return Object.keys(obj).map(e => {
				let v = (key != null) ? obj[e][key] : e;

				switch (sortmode) {
				case 'addr':
					v = (v != null) ? v.replace(/(?:^|[.:])([0-9a-fA-F]{1,4})/g,
						(m0, m1) => (`000${m1.toLowerCase()}`).substr(-4)) : null;
					break;

				case 'num':
					v = (v != null) ? +v : null;
					break;
				}

				return [ e, v ];
			}).filter(e => e[1] != null).sort((a, b) => naturalCompare(a[1], b[1])).map(e => e[0]);
		},

		/**
		 * Compares two values numerically and returns -1, 0 or 1 depending
		 * on whether the first value is smaller, equal to or larger than the
		 * second one respectively.
		 *
		 * This function is meant to be used as comparator function for
		 * Array.sort().
		 *
		 * @type {function}
		 *
		 * @param {*} a
		 * The first value
		 *
		 * @param {*} b
		 * The second value.
		 *
		 * @return {number}
		 * Returns -1 if the first value is smaller than the second one.
		 * Returns 0 if both values are equal.
		 * Returns 1 if the first value is larger than the second one.
		 */
		naturalCompare,

		/**
		 * Converts the given value to an array using toArray() if needed,
		 * performs a numerical sort using naturalCompare() and returns the
		 * result. If the input already is an array, no copy is being made
		 * and the sorting is performed in-place.
		 *
		 * @see toArray
		 * @see naturalCompare
		 *
		 * @param {*} val
		 * The input value to sort (and convert to an array if needed).
		 *
		 * @return {Array<*>}
		 * Returns the resulting, numerically sorted array.
		 */
		sortedArray(val) {
			return this.toArray(val).sort(naturalCompare);
		},

		/**
		 * Converts the given value to an array. If the given value is of
		 * type array, it is returned as-is, values of type object are
		 * returned as one-element array containing the object, empty
		 * strings and `null` values are returned as empty array, all other
		 * values are converted using `String()`, trimmed, split on white
		 * space and returned as array.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {*} val
		 * The value to convert into an array.
		 *
		 * @return {Array<*>}
		 * Returns the resulting array.
		 */
		toArray(val) {
			if (val == null)
				return [];
			else if (Array.isArray(val))
				return val;
			else if (typeof(val) == 'object')
				return [ val ];

			const s = String(val).trim();

			if (s == '')
				return [];

			return s.split(/\s+/);
		},

		/**
		 * Returns a promise resolving with either the given value or with
		 * the given default in case the input value is a rejecting promise.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {*} value
		 * The value to resolve the promise with.
		 *
		 * @param {*} defvalue
		 * The default value to resolve the promise with in case the given
		 * input value is a rejecting promise.
		 *
		 * @returns {Promise<*>}
		 * Returns a new promise resolving either to the given input value or
		 * to the given default value on error.
		 */
		resolveDefault(value, defvalue) {
			return Promise.resolve(value).catch(() => defvalue);
		},

		/**
		 * The request callback function is invoked whenever an HTTP
		 * reply to a request made using the `L.get()`, `L.post()` or
		 * `L.poll()` function is timed out or received successfully.
		 *
		 * @instance
		 * @memberof LuCI
		 *
		 * @callback LuCI.requestCallbackFn
		 * @param {XMLHTTPRequest} xhr
		 * The XMLHTTPRequest instance used to make the request.
		 *
		 * @param {*} data
		 * The response JSON if the response could be parsed as such,
		 * else `null`.
		 *
		 * @param {number} duration
		 * The total duration of the request in milliseconds.
		 */

		/**
		 * Issues a GET request to the given url and invokes the specified
		 * callback function. The function is a wrapper around
		 * {@link LuCI.request#request Request.request()}.
		 *
		 * @deprecated
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {string} url
		 * The URL to request.
		 *
		 * @param {Object<string, string>} [args]
		 * Additional query string arguments to append to the URL.
		 *
		 * @param {LuCI.requestCallbackFn} cb
		 * The callback function to invoke when the request finishes.
		 *
		 * @return {Promise<null>}
		 * Returns a promise resolving to `null` when concluded.
		 */
		get(url, args, cb) {
			return this.poll(null, url, args, cb, false);
		},

		/**
		 * Issues a POST request to the given url and invokes the specified
		 * callback function. The function is a wrapper around
		 * {@link LuCI.request#request Request.request()}. The request is
		 * sent using `application/x-www-form-urlencoded` encoding and will
		 * contain a field `token` with the current value of `LuCI.env.token`
		 * by default.
		 *
		 * @deprecated
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {string} url
		 * The URL to request.
		 *
		 * @param {Object<string, string>} [args]
		 * Additional post arguments to append to the request body.
		 *
		 * @param {LuCI.requestCallbackFn} cb
		 * The callback function to invoke when the request finishes.
		 *
		 * @return {Promise<null>}
		 * Returns a promise resolving to `null` when concluded.
		 */
		post(url, args, cb) {
			return this.poll(null, url, args, cb, true);
		},

		/**
		 * Register a polling HTTP request that invokes the specified
		 * callback function. The function is a wrapper around
		 * {@link LuCI.request.poll#add Request.poll.add()}.
		 *
		 * @deprecated
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {number} interval
		 * The poll interval to use. If set to a value less than or equal
		 * to `0`, it will default to the global poll interval configured
		 * in `LuCI.env.pollinterval`.
		 *
		 * @param {string} url
		 * The URL to request.
		 *
		 * @param {Object<string, string>} [args]
		 * Specifies additional arguments for the request. For GET requests,
		 * the arguments are appended to the URL as query string, for POST
		 * requests, they'll be added to the request body.
		 *
		 * @param {LuCI.requestCallbackFn} cb
		 * The callback function to invoke whenever a request finishes.
		 *
		 * @param {boolean} [post=false]
		 * When set to `false` or not specified, poll requests will be made
		 * using the GET method. When set to `true`, POST requests will be
		 * issued. In case of POST requests, the request body will contain
		 * an argument `token` with the current value of `LuCI.env.token` by
		 * default, regardless of the parameters specified with `args`.
		 *
		 * @return {function}
		 * Returns the internally created function that has been passed to
		 * {@link LuCI.request.poll#add Request.poll.add()}. This value can
		 * be passed to {@link LuCI.poll.remove Poll.remove()} to remove the
		 * polling request.
		 */
		poll(interval, url, args, cb, post) {
			if (interval !== null && interval <= 0)
				interval = env.pollinterval;

			const data = Object.assign(post ? { token: env.token } : {}, args);
			const method = post ? 'POST' : 'GET';

			if (!/^(?:\/|\S+:\/\/)/.test(url))
				url = this.url(url);

			if (interval !== null)
				return Request.poll.add(interval, url, { method, query: data }, cb);
			else
				return Request.request(url, { method, query: data })
					.then(res => {
						let json = null;
						if (/^application\/json\b/.test(res.headers.get('Content-Type')))
							try { json = res.json() } catch(e) {}
						cb(res.xhr, json, res.duration);
					});
		},

		/**
		 * Check whether a view has sufficient permissions.
		 *
		 * @return {boolean|null}
		 * Returns `null` if the current session has no permission at all to
		 * load resources required by the view. Returns `false` if readonly
		 * permissions are granted or `true` if at least one required ACL
		 * group is granted with write permissions.
		 */
		hasViewPermission() {
			if (!this.isObject(env.nodespec) || !env.nodespec.satisfied)
				return null;

			return !env.nodespec.readonly;
		},

		/**
		 * Deprecated wrapper around {@link LuCI.poll.remove Poll.remove()}.
		 *
		 * @deprecated
		 * @instance
		 * @memberof LuCI
		 *
		 * @param {function} entry
		 * The polling function to remove.
		 *
		 * @return {boolean}
		 * Returns `true` when the function has been removed or `false` if
		 * it could not be found.
		 */
		stop(entry) { return Poll.remove(entry) },

		/**
		 * Deprecated wrapper around {@link LuCI.poll.stop Poll.stop()}.
		 *
		 * @deprecated
		 * @instance
		 * @memberof LuCI
		 *
		 * @return {boolean}
		 * Returns `true` when the polling loop has been stopped or `false`
		 * when it didn't run to begin with.
		 */
		halt() { return Poll.stop() },

		/**
		 * Deprecated wrapper around {@link LuCI.poll.start Poll.start()}.
		 *
		 * @deprecated
		 * @instance
		 * @memberof LuCI
		 *
		 * @return {boolean}
		 * Returns `true` when the polling loop has been started or `false`
		 * when it was already running.
		 */
		run() { return Poll.start() },

		/**
		 * Legacy `L.dom` class alias. New view code should use `'require dom';`
		 * to request the `LuCI.dom` class.
		 *
		 * @instance
		 * @memberof LuCI
		 * @deprecated
		 */
		dom: DOM,

		/**
		 * Legacy `L.view` class alias. New view code should use `'require view';`
		 * to request the `LuCI.view` class.
		 *
		 * @instance
		 * @memberof LuCI
		 * @deprecated
		 */
		view: View,

		/**
		 * Legacy `L.Poll` class alias. New view code should use `'require poll';`
		 * to request the `LuCI.poll` class.
		 *
		 * @instance
		 * @memberof LuCI
		 * @deprecated
		 */
		Poll,

		/**
		 * Legacy `L.Request` class alias. New view code should use `'require request';`
		 * to request the `LuCI.request` class.
		 *
		 * @instance
		 * @memberof LuCI
		 * @deprecated
		 */
		Request,

		/**
		 * Legacy `L.Class` class alias. New view code should use `'require baseclass';`
		 * to request the `LuCI.baseclass` class.
		 *
		 * @instance
		 * @memberof LuCI
		 * @deprecated
		 */
		Class
	});

	/**
	 * @class xhr
	 * @memberof LuCI
	 * @deprecated
	 * @classdesc
	 *
	 * The `LuCI.xhr` class is a legacy compatibility shim for the
	 * functionality formerly provided by `xhr.js`. It is registered as global
	 * `window.XHR` symbol for compatibility with legacy code.
	 *
	 * New code should use {@link LuCI.request} instead to implement HTTP
	 * request handling.
	 */
	const XHR = Class.extend(/** @lends LuCI.xhr.prototype */ {
		__name__: 'LuCI.xhr',
		__init__() {
			if (window.console && console.debug)
				console.debug('Direct use XHR() is deprecated, please use L.Request instead');
		},

		_response(cb, res, json, duration) {
			if (this.active)
				cb(res, json, duration);
			delete this.active;
		},

		/**
		 * This function is a legacy wrapper around
		 * {@link LuCI#get LuCI.get()}.
		 *
		 * @instance
		 * @deprecated
		 * @memberof LuCI.xhr
		 *
		 * @param {string} url
		 * The URL to request
		 *
		 * @param {Object} [data]
		 * Additional query string data
		 *
		 * @param {LuCI.requestCallbackFn} [callback]
		 * Callback function to invoke on completion
		 *
		 * @param {number} [timeout]
		 * Request timeout to use
		 *
		 * @return {Promise<null>}
		 */
		get(url, data, callback, timeout) {
			this.active = true;
			LuCI.prototype.get(url, data, this._response.bind(this, callback), timeout);
		},

		/**
		 * This function is a legacy wrapper around
		 * {@link LuCI#post LuCI.post()}.
		 *
		 * @instance
		 * @deprecated
		 * @memberof LuCI.xhr
		 *
		 * @param {string} url
		 * The URL to request
		 *
		 * @param {Object} [data]
		 * Additional data to append to the request body.
		 *
		 * @param {LuCI.requestCallbackFn} [callback]
		 * Callback function to invoke on completion
		 *
		 * @param {number} [timeout]
		 * Request timeout to use
		 *
		 * @return {Promise<null>}
		 */
		post(url, data, callback, timeout) {
			this.active = true;
			LuCI.prototype.post(url, data, this._response.bind(this, callback), timeout);
		},

		/**
		 * Cancels a running request.
		 *
		 * This function does not actually cancel the underlying
		 * `XMLHTTPRequest` request but it sets a flag which prevents the
		 * invocation of the callback function when the request eventually
		 * finishes or timed out.
		 *
		 * @instance
		 * @deprecated
		 * @memberof LuCI.xhr
		 */
		cancel() { delete this.active },

		/**
		 * Checks the running state of the request.
		 *
		 * @instance
		 * @deprecated
		 * @memberof LuCI.xhr
		 *
		 * @returns {boolean}
		 * Returns `true` if the request is still running or `false` if it
		 * already completed.
		 */
		busy() { return (this.active === true) },

		/**
		 * Ignored for backwards compatibility.
		 *
		 * This function does nothing.
		 *
		 * @instance
		 * @deprecated
		 * @memberof LuCI.xhr
		 */
		abort() {},

		/**
		 * Existing for backwards compatibility.
		 *
		 * This function simply throws an `InternalError` when invoked.
		 *
		 * @instance
		 * @deprecated
		 * @memberof LuCI.xhr
		 *
		 * @throws {InternalError}
		 * Throws an `InternalError` with the message `Not implemented`
		 * when invoked.
		 */
		send_form() { LuCI.prototype.error('InternalError', 'Not implemented') },
	});

	XHR.get = (...args) => LuCI.prototype.get.call(LuCI.prototype, ...args);
	XHR.post = (...args) => LuCI.prototype.post.call(LuCI.prototype, ...args);
	XHR.poll = (...args) => LuCI.prototype.poll.call(LuCI.prototype, ...args);
	XHR.stop = Request.poll.remove.bind(Request.poll);
	XHR.halt = Request.poll.stop.bind(Request.poll);
	XHR.run = Request.poll.start.bind(Request.poll);
	XHR.running = Request.poll.active.bind(Request.poll);

	window.XHR = XHR;
	window.LuCI = LuCI;
})(window, document);
