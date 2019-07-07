'use strict';
'require rpc';

return L.Class.extend({
	__init__: function() {
		this.state = {
			newidx:  0,
			values:  { },
			creates: { },
			changes: { },
			deletes: { },
			reorder: { }
		};

		this.loaded = {};
	},

	callLoad: rpc.declare({
		object: 'uci',
		method: 'get',
		params: [ 'config' ],
		expect: { values: { } }
	}),

	callOrder: rpc.declare({
		object: 'uci',
		method: 'order',
		params: [ 'config', 'sections' ]
	}),

	callAdd: rpc.declare({
		object: 'uci',
		method: 'add',
		params: [ 'config', 'type', 'name', 'values' ],
		expect: { section: '' }
	}),

	callSet: rpc.declare({
		object: 'uci',
		method: 'set',
		params: [ 'config', 'section', 'values' ]
	}),

	callDelete: rpc.declare({
		object: 'uci',
		method: 'delete',
		params: [ 'config', 'section', 'options' ]
	}),

	callApply: rpc.declare({
		object: 'uci',
		method: 'apply',
		params: [ 'timeout', 'rollback' ]
	}),

	callConfirm: rpc.declare({
		object: 'uci',
		method: 'confirm'
	}),

	createSID: function(conf) {
		var v = this.state.values,
		    n = this.state.creates,
		    sid;

		do {
			sid = "new%06x".format(Math.random() * 0xFFFFFF);
		} while ((n[conf] && n[conf][sid]) || (v[conf] && v[conf][sid]));

		return sid;
	},

	resolveSID: function(conf, sid) {
		if (typeof(sid) != 'string')
			return sid;

		var m = /^@([a-zA-Z0-9_-]+)\[(-?[0-9]+)\]$/.exec(sid);

		if (m) {
			var type = m[1],
			    pos = +m[2],
			    sections = this.sections(conf, type),
			    section = sections[pos >= 0 ? pos : sections.length + pos];

			return section ? section['.name'] : null;
		}

		return sid;
	},

	reorderSections: function() {
		var v = this.state.values,
		    n = this.state.creates,
		    r = this.state.reorder,
		    tasks = [];

		if (Object.keys(r).length === 0)
			return Promise.resolve();

		/*
		 gather all created and existing sections, sort them according
		 to their index value and issue an uci order call
		*/
		for (var c in r) {
			var o = [ ];

			if (n[c])
				for (var s in n[c])
					o.push(n[c][s]);

			for (var s in v[c])
				o.push(v[c][s]);

			if (o.length > 0) {
				o.sort(function(a, b) {
					return (a['.index'] - b['.index']);
				});

				var sids = [ ];

				for (var i = 0; i < o.length; i++)
					sids.push(o[i]['.name']);

				tasks.push(this.callOrder(c, sids));
			}
		}

		this.state.reorder = { };
		return Promise.all(tasks);
	},

	loadPackage: function(packageName) {
		if (this.loaded[packageName] == null)
			return (this.loaded[packageName] = this.callLoad(packageName));

		return Promise.resolve(this.loaded[packageName]);
	},

	load: function(packages) {
		var self = this,
		    pkgs = [ ],
		    tasks = [];

		if (!Array.isArray(packages))
			packages = [ packages ];

		for (var i = 0; i < packages.length; i++)
			if (!self.state.values[packages[i]]) {
				pkgs.push(packages[i]);
				tasks.push(self.loadPackage(packages[i]));
			}

		return Promise.all(tasks).then(function(responses) {
			for (var i = 0; i < responses.length; i++)
				self.state.values[pkgs[i]] = responses[i];

			if (responses.length)
				document.dispatchEvent(new CustomEvent('uci-loaded'));

			return pkgs;
		});
	},

	unload: function(packages) {
		if (!Array.isArray(packages))
			packages = [ packages ];

		for (var i = 0; i < packages.length; i++) {
			delete this.state.values[packages[i]];
			delete this.state.creates[packages[i]];
			delete this.state.changes[packages[i]];
			delete this.state.deletes[packages[i]];

			delete this.loaded[packages[i]];
		}
	},

	add: function(conf, type, name) {
		var n = this.state.creates,
		    sid = name || this.createSID(conf);

		if (!n[conf])
			n[conf] = { };

		n[conf][sid] = {
			'.type':      type,
			'.name':      sid,
			'.create':    name,
			'.anonymous': !name,
			'.index':     1000 + this.state.newidx++
		};

		return sid;
	},

	remove: function(conf, sid) {
		var n = this.state.creates,
		    c = this.state.changes,
		    d = this.state.deletes;

		/* requested deletion of a just created section */
		if (n[conf] && n[conf][sid]) {
			delete n[conf][sid];
		}
		else {
			if (c[conf])
				delete c[conf][sid];

			if (!d[conf])
				d[conf] = { };

			d[conf][sid] = true;
		}
	},

	sections: function(conf, type, cb) {
		var sa = [ ],
		    v = this.state.values[conf],
		    n = this.state.creates[conf],
		    c = this.state.changes[conf],
		    d = this.state.deletes[conf];

		if (!v)
			return sa;

		for (var s in v)
			if (!d || d[s] !== true)
				if (!type || v[s]['.type'] == type)
					sa.push(Object.assign({ }, v[s], c ? c[s] : undefined));

		if (n)
			for (var s in n)
				if (!type || n[s]['.type'] == type)
					sa.push(Object.assign({ }, n[s]));

		sa.sort(function(a, b) {
			return a['.index'] - b['.index'];
		});

		for (var i = 0; i < sa.length; i++)
			sa[i]['.index'] = i;

		if (typeof(cb) == 'function')
			for (var i = 0; i < sa.length; i++)
				cb.call(this, sa[i], sa[i]['.name']);

		return sa;
	},

	get: function(conf, sid, opt) {
		var v = this.state.values,
		    n = this.state.creates,
		    c = this.state.changes,
		    d = this.state.deletes;

		sid = this.resolveSID(conf, sid);

		if (sid == null)
			return null;

		/* requested option in a just created section */
		if (n[conf] && n[conf][sid]) {
			if (!n[conf])
				return undefined;

			if (opt == null)
				return n[conf][sid];

			return n[conf][sid][opt];
		}

		/* requested an option value */
		if (opt != null) {
			/* check whether option was deleted */
			if (d[conf] && d[conf][sid]) {
				if (d[conf][sid] === true)
					return undefined;

				for (var i = 0; i < d[conf][sid].length; i++)
					if (d[conf][sid][i] == opt)
						return undefined;
			}

			/* check whether option was changed */
			if (c[conf] && c[conf][sid] && c[conf][sid][opt] != null)
				return c[conf][sid][opt];

			/* return base value */
			if (v[conf] && v[conf][sid])
				return v[conf][sid][opt];

			return undefined;
		}

		/* requested an entire section */
		if (v[conf])
			return v[conf][sid];

		return undefined;
	},

	set: function(conf, sid, opt, val) {
		var v = this.state.values,
		    n = this.state.creates,
		    c = this.state.changes,
		    d = this.state.deletes;

		sid = this.resolveSID(conf, sid);

		if (sid == null || opt == null || opt.charAt(0) == '.')
			return;

		if (n[conf] && n[conf][sid]) {
			if (val != null)
				n[conf][sid][opt] = val;
			else
				delete n[conf][sid][opt];
		}
		else if (val != null && val !== '') {
			/* do not set within deleted section */
			if (d[conf] && d[conf][sid] === true)
				return;

			/* only set in existing sections */
			if (!v[conf] || !v[conf][sid])
				return;

			if (!c[conf])
				c[conf] = {};

			if (!c[conf][sid])
				c[conf][sid] = {};

			/* undelete option */
			if (d[conf] && d[conf][sid])
				d[conf][sid] = d[conf][sid].filter(function(o) { return o !== opt });

			c[conf][sid][opt] = val;
		}
		else {
			/* only delete in existing sections */
			if (!(v[conf] && v[conf][sid] && v[conf][sid].hasOwnProperty(opt)) &&
			    !(c[conf] && c[conf][sid] && c[conf][sid].hasOwnProperty(opt)))
			    return;

			if (!d[conf])
				d[conf] = { };

			if (!d[conf][sid])
				d[conf][sid] = [ ];

			if (d[conf][sid] !== true)
				d[conf][sid].push(opt);
		}
	},

	unset: function(conf, sid, opt) {
		return this.set(conf, sid, opt, null);
	},

	get_first: function(conf, type, opt) {
		var sid = null;

		this.sections(conf, type, function(s) {
			if (sid == null)
				sid = s['.name'];
		});

		return this.get(conf, sid, opt);
	},

	set_first: function(conf, type, opt, val) {
		var sid = null;

		this.sections(conf, type, function(s) {
			if (sid == null)
				sid = s['.name'];
		});

		return this.set(conf, sid, opt, val);
	},

	unset_first: function(conf, type, opt) {
		return this.set_first(conf, type, opt, null);
	},

	move: function(conf, sid1, sid2, after) {
		var sa = this.sections(conf),
		    s1 = null, s2 = null;

		sid1 = this.resolveSID(conf, sid1);
		sid2 = this.resolveSID(conf, sid2);

		for (var i = 0; i < sa.length; i++) {
			if (sa[i]['.name'] != sid1)
				continue;

			s1 = sa[i];
			sa.splice(i, 1);
			break;
		}

		if (s1 == null)
			return false;

		if (sid2 == null) {
			sa.push(s1);
		}
		else {
			for (var i = 0; i < sa.length; i++) {
				if (sa[i]['.name'] != sid2)
					continue;

				s2 = sa[i];
				sa.splice(i + !!after, 0, s1);
				break;
			}

			if (s2 == null)
				return false;
		}

		for (var i = 0; i < sa.length; i++)
			this.get(conf, sa[i]['.name'])['.index'] = i;

		this.state.reorder[conf] = true;

		return true;
	},

	save: function() {
		var v = this.state.values,
		    n = this.state.creates,
		    c = this.state.changes,
		    d = this.state.deletes,
		    r = this.state.reorder,
		    self = this,
		    snew = [ ],
		    pkgs = { },
		    tasks = [];

		if (n)
			for (var conf in n) {
				for (var sid in n[conf]) {
					var r = {
						config: conf,
						values: { }
					};

					for (var k in n[conf][sid]) {
						if (k == '.type')
							r.type = n[conf][sid][k];
						else if (k == '.create')
							r.name = n[conf][sid][k];
						else if (k.charAt(0) != '.')
							r.values[k] = n[conf][sid][k];
					}

					snew.push(n[conf][sid]);
					tasks.push(self.callAdd(r.config, r.type, r.name, r.values));
				}

				pkgs[conf] = true;
			}

		if (c)
			for (var conf in c) {
				for (var sid in c[conf])
					tasks.push(self.callSet(conf, sid, c[conf][sid]));

				pkgs[conf] = true;
			}

		if (d)
			for (var conf in d) {
				for (var sid in d[conf]) {
					var o = d[conf][sid];
					tasks.push(self.callDelete(conf, sid, (o === true) ? null : o));
				}

				pkgs[conf] = true;
			}

		if (r)
			for (var conf in r)
				pkgs[conf] = true;

		return Promise.all(tasks).then(function(responses) {
			/*
			 array "snew" holds references to the created uci sections,
			 use it to assign the returned names of the new sections
			*/
			for (var i = 0; i < snew.length; i++)
				snew[i]['.name'] = responses[i];

			return self.reorderSections();
		}).then(function() {
			pkgs = Object.keys(pkgs);

			self.unload(pkgs);

			return self.load(pkgs);
		});
	},

	apply: function(timeout) {
		var self = this,
		    date = new Date();

		if (typeof(timeout) != 'number' || timeout < 1)
			timeout = 10;

		return self.callApply(timeout, true).then(function(rv) {
			if (rv != 0)
				return Promise.reject(rv);

			var try_deadline = date.getTime() + 1000 * timeout;
			var try_confirm = function() {
				return self.callConfirm().then(function(rv) {
					if (rv != 0) {
						if (date.getTime() < try_deadline)
							window.setTimeout(try_confirm, 250);
						else
							return Promise.reject(rv);
					}

					return rv;
				});
			};

			window.setTimeout(try_confirm, 1000);
		});
	},

	changes: rpc.declare({
		object: 'uci',
		method: 'changes',
		expect: { changes: { } }
	})
});
