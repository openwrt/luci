'use strict';

var rpcRequestRegistry = {},
    rpcRequestBatch = null,
    rpcRequestID = 1,
    rpcSessionID = L.env.sessionid || '00000000000000000000000000000000',
    rpcBaseURL = L.url('admin/ubus');

return L.Class.extend({
	call: function(req, cbFn) {
		var cb = cbFn.bind(this, req),
		    q = '';

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

	handleCallReply: function(reqs, res) {
		var type = Object.prototype.toString,
		    data = [],
		    msg = null;

		if (!res.ok)
			L.error('RPCError', 'RPC call failed with HTTP error %d: %s',
				res.status, res.statusText || '?');

		msg = res.json();

		if (!Array.isArray(reqs)) {
			msg = [ msg ];
			reqs = [ reqs ];
		}

		for (var i = 0; i < msg.length; i++) {
			/* fetch related request info */
			var req = rpcRequestRegistry[reqs[i].id];
			if (typeof(req) != 'object')
				throw 'No related request for JSON response';

			/* fetch response attribute and verify returned type */
			var ret = undefined;

			/* verify message frame */
			if (typeof(msg[i]) == 'object' && msg[i].jsonrpc == '2.0') {
				if (typeof(msg[i].error) == 'object' && msg[i].error.code && msg[i].error.message)
					req.reject(new Error('RPC call failed with error %d: %s'
						.format(msg[i].error.code, msg[i].error.message || '?')));
				else if (Array.isArray(msg[i].result) && msg[i].result[0] == 0)
					ret = (msg[i].result.length > 1) ? msg[i].result[1] : msg[i].result[0];
			}
			else {
				req.reject(new Error('Invalid message frame received'));
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

			/* store response data */
			if (typeof(req.index) == 'number')
				data[req.index] = ret;
			else
				data = ret;

			/* delete request object */
			delete rpcRequestRegistry[reqs[i].id];
		}

		return Promise.resolve(data);
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

	batch: function() {
		if (!Array.isArray(rpcRequestBatch))
			rpcRequestBatch = [ ];
	},

	flush: function() {
		if (!Array.isArray(rpcRequestBatch))
			return Promise.resolve([]);

		var req = rpcRequestBatch;
		rpcRequestBatch = null;

		/* call rpc */
		return this.call(req, this.handleCallReply);
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
				var req = rpcRequestRegistry[rpcRequestID] = {
					expect:  options.expect,
					filter:  options.filter,
					resolve: resolveFn,
					reject:  rejectFn,
					params:  params,
					priv:    priv
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

				/* when a batch is in progress then store index in request data
				 * and push message object onto the stack */
				if (Array.isArray(rpcRequestBatch))
					req.index = rpcRequestBatch.push(msg) - 1;

				/* call rpc */
				else
					rpc.call(msg, rpc.handleCallReply);
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
	}
});
