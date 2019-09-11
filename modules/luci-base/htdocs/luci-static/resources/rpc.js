'use strict';

var rpcRequestID = 1,
    rpcSessionID = L.env.sessionid || '00000000000000000000000000000000',
    rpcBaseURL = L.url('admin/ubus'),
    rpcInterceptorFns = [];

return L.Class.extend({
	call: function(req, cb) {
		var q = '';

		if (Array.isArray(req)) {
			if (req.length == 0)
				return Promise.resolve([]);

			for (var i = 0; i < req.length; i++)
				q += '%s%s.%s'.format(
					q ? ';' : '/',
					req[i].params[1],
					req[i].params[2]
				);
		}
		else {
			q += '/%s.%s'.format(req.params[1], req.params[2]);
		}

		return L.Request.post(rpcBaseURL + q, req, {
			timeout: (L.env.rpctimeout || 5) * 1000,
			credentials: true
		}).then(cb);
	},

	handleListReply: function(req, msg) {
		var list = msg.result;

		/* verify message frame */
		if (typeof(msg) != 'object' || msg.jsonrpc != '2.0' || !msg.id || !Array.isArray(list))
			list = [ ];

		req.resolve(list);
	},

	parseCallReply: function(req, res) {
		var msg = null;

		try {
			if (!res.ok)
				L.raise('RPCError', 'RPC call to %s/%s failed with HTTP error %d: %s',
					req.object, req.method, res.status, res.statusText || '?');

			msg = res.json();
		}
		catch (e) {
			return req.reject(e);
		}

		/*
		 * The interceptor args are intentionally swapped.
		 * Response is passed as first arg to align with Request class interceptors
		 */
		Promise.all(rpcInterceptorFns.map(function(fn) { return fn(msg, req) }))
			.then(this.handleCallReply.bind(this, req, msg))
			.catch(req.reject);
	},

	handleCallReply: function(req, msg) {
		var type = Object.prototype.toString,
		    ret = null;

		try {
			/* verify message frame */
			if (!L.isObject(msg) || msg.jsonrpc != '2.0')
				L.raise('RPCError', 'RPC call to %s/%s returned invalid message frame',
					req.object, req.method);

			/* check error condition */
			if (L.isObject(msg.error) && msg.error.code && msg.error.message)
				L.raise('RPCError', 'RPC call to %s/%s failed with error %d: %s',
					req.object, req.method, msg.error.code, msg.error.message || '?');
		}
		catch (e) {
			return req.reject(e);
		}

		if (Array.isArray(msg.result)) {
			ret = (msg.result.length > 1) ? msg.result[1] : msg.result[0];
		}

		if (req.expect) {
			for (var key in req.expect) {
				if (ret != null && key != '')
					ret = ret[key];

				if (ret == null || type.call(ret) != type.call(req.expect[key]))
					ret = req.expect[key];

				break;
			}
		}

		/* apply filter */
		if (typeof(req.filter) == 'function') {
			req.priv[0] = ret;
			req.priv[1] = req.params;
			ret = req.filter.apply(this, req.priv);
		}

		req.resolve(ret);
	},

	list: function() {
		var msg = {
			jsonrpc: '2.0',
			id:      rpcRequestID++,
			method:  'list',
			params:  arguments.length ? this.varargs(arguments) : undefined
		};

		return this.call(msg, this.handleListReply);
	},

	declare: function(options) {
		return Function.prototype.bind.call(function(rpc, options) {
			var args = this.varargs(arguments, 2);
			return new Promise(function(resolveFn, rejectFn) {
				/* build parameter object */
				var p_off = 0;
				var params = { };
				if (Array.isArray(options.params))
					for (p_off = 0; p_off < options.params.length; p_off++)
						params[options.params[p_off]] = args[p_off];

				/* all remaining arguments are private args */
				var priv = [ undefined, undefined ];
				for (; p_off < args.length; p_off++)
					priv.push(args[p_off]);

				/* store request info */
				var req = {
					expect:  options.expect,
					filter:  options.filter,
					resolve: resolveFn,
					reject:  rejectFn,
					params:  params,
					priv:    priv,
					object:  options.object,
					method:  options.method
				};

				/* build message object */
				var msg = {
					jsonrpc: '2.0',
					id:      rpcRequestID++,
					method:  'call',
					params:  [
						rpcSessionID,
						options.object,
						options.method,
						params
					]
				};

				/* call rpc */
				rpc.call(msg, rpc.parseCallReply.bind(rpc, req));
			});
		}, this, this, options);
	},

	getSessionID: function() {
		return rpcSessionID;
	},

	setSessionID: function(sid) {
		rpcSessionID = sid;
	},

	getBaseURL: function() {
		return rpcBaseURL;
	},

	setBaseURL: function(url) {
		rpcBaseURL = url;
	},

	getStatusText: function(statusCode) {
		switch (statusCode) {
		case 0: return _('Command OK');
		case 1: return _('Invalid command');
		case 2: return _('Invalid argument');
		case 3: return _('Method not found');
		case 4: return _('Resource not found');
		case 5: return _('No data received');
		case 6: return _('Permission denied');
		case 7: return _('Request timeout');
		case 8: return _('Not supported');
		case 9: return _('Unspecified error');
		case 10: return _('Connection lost');
		default: return _('Unknown error code');
		}
	},

	addInterceptor: function(interceptorFn) {
		if (typeof(interceptorFn) == 'function')
			rpcInterceptorFns.push(interceptorFn);
		return interceptorFn;
	},

	removeInterceptor: function(interceptorFn) {
		var oldlen = rpcInterceptorFns.length, i = oldlen;
		while (i--)
			if (rpcInterceptorFns[i] === interceptorFn)
				rpcInterceptorFns.splice(i, 1);
		return (rpcInterceptorFns.length < oldlen);
	}
});
