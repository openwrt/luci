'use strict';
'require baseclass';
'require fs';
'require uci';
'require tools.prng as random';

function subst(str, val) {
	return str.replace(/%(H|pn|pi|dt|di|ds)/g, function(m, p1) {
		switch (p1) {
		case 'H':  return val.host   || '';
		case 'pn': return val.plugin || '';
		case 'pi': return val.pinst  || '';
		case 'dt': return val.dtype  || '';
		case 'di': return val.dinst  || '';
		case 'ds': return val.dsrc   || '';
		}
	});
}

const i18n = L.Class.singleton({
	title(host, plugin, pinst, dtype, dinst, user_title) {
		const title = user_title || 'p=%s/pi=%s/dt=%s/di=%s'.format(
			plugin,
			pinst || '(nil)',
			dtype || '(nil)',
			dinst || '(nil)'
		);

		return subst(title, {
			host: host,
			plugin: plugin,
			pinst: pinst,
			dtype: dtype,
			dinst: dinst
		});
	},

	label(host, plugin, pinst, dtype, dinst, user_label) {
		const label = user_label || 'dt=%s/%di=%s'.format(
			dtype || '(nil)',
			dinst || '(nil)'
		);

		return subst(label, {
			host: host,
			plugin: plugin,
			pinst: pinst,
			dtype: dtype,
			dinst: dinst
		});
	},

	ds(host, source) {
		const label = source.title || 'dt=%s/di=%s/ds=%s'.format(
			source.type     || '(nil)',
			source.instance || '(nil)',
			source.ds       || '(nil)'
		);

		return subst(label, {
			host: host,
			dtype: source.type,
			dinst: source.instance,
			dsrc: source.ds
		}).replace(/:/g, '\\:');
	}
});

const colors = L.Class.singleton({
	fromString(s) {
		if (typeof(s) != 'string' || !s.match(/^[0-9a-fA-F]{6}$/))
			return null;

		return [
			parseInt(s.substring(0, 2), 16),
			parseInt(s.substring(2, 4), 16),
			parseInt(s.substring(4, 6), 16)
		];
	},

	asString(c) {
		if (!Array.isArray(c) || c.length != 3)
			return null;

		return '%02x%02x%02x'.format(c[0], c[1], c[2]);
	},

	defined(i) {
		const t = [
			[230, 25, 75],
			[245, 130, 48],
			[255, 225, 25],
			[60, 180, 75],
			[70, 240, 240],
			[0, 130, 200],
			[0, 0, 128],
			[170, 110, 40]
		];

		return this.asString(t[i % t.length]);
	},

	random() {
		const r = random.get(255);
		const g = random.get(255);
		let min = 0, max = 255;

		if (r + g < 255)
			min = 255 - r - g;
		else
			max = 511 - r - g;

		const b = min + Math.floor(random.get() * (max - min));

		return [ r, g, b ];
	},

	faded(fg, bg, alpha) {
		fg = this.fromString(fg) || (this.asString(fg) ? fg : null);
		bg = this.fromString(bg) || (this.asString(bg) ? bg : [255, 255, 255]);
		alpha = !isNaN(alpha) ? +alpha : 0.25;

		if (!fg)
			return null;

		return [
			(alpha * fg[0]) + ((1.0 - alpha) * bg[0]),
			(alpha * fg[1]) + ((1.0 - alpha) * bg[1]),
			(alpha * fg[2]) + ((1.0 - alpha) * bg[2])
		];
	}
});

let rrdtree = {};
let graphdefs = {};

return baseclass.extend({
	__init__() {
		this.opts = {};
	},

	load() {
		return Promise.all([
			L.resolveDefault(fs.list('/www' + L.resource('statistics/rrdtool/definitions')), []),
			fs.trimmed('/proc/sys/kernel/hostname'),
			uci.load('luci_statistics')
		]).then(L.bind(function([definitions, hostname]) {
			this.opts.host      = uci.get('luci_statistics', 'collectd', 'Hostname')        || hostname;
			this.opts.timespan  = uci.get('luci_statistics', 'rrdtool', 'default_timespan') || 3600;
			this.opts.width     = uci.get('luci_statistics', 'rrdtool', 'image_width')      || 600;
			this.opts.height    = uci.get('luci_statistics', 'rrdtool', 'image_height')     || 150;
			this.opts.rrdpath   = (uci.get('luci_statistics', 'collectd_rrdtool', 'DataDir') || '/tmp/rrd').replace(/\/$/, '');
			this.opts.rrasingle = (uci.get('luci_statistics', 'collectd_rrdtool', 'RRASingle') == '1');
			this.opts.rramax    = (uci.get('luci_statistics', 'collectd_rrdtool', 'RRAMax') == '1');

			graphdefs = {};

			const tasks = [ this.scan() ];

			for (let def of definitions) {
				const m = def.name.match(/^(.+)\.js$/);

				if (def.type != 'file' || m == null)
					continue;

				tasks.push(L.require('statistics.rrdtool.definitions.' + m[1]).then(L.bind(function(name, def) {
					graphdefs[name] = def;
				}, this, m[1])));
			}

			return Promise.all(tasks);
		}, this));
	},

	ls() {
		const dir = this.opts.rrdpath;

		return L.resolveDefault(fs.list(dir), []).then(function(entries) {
			const tasks = [];

			for (let entr of entries) {
				if (entr.type != 'directory')
					continue;

				tasks.push(L.resolveDefault(fs.list(dir + '/' + entr.name), []).then(L.bind(function(entries) {
					const tasks = [];

					for (let entrj of entries) {
						if (entrj.type != 'directory')
							continue;

						tasks.push(L.resolveDefault(fs.list(dir + '/' + this.name + '/' + entrj.name), []).then(L.bind(function(entries) {
							return Object.assign(this, {
								entries: entries.filter(function(e) {
									return e.type == 'file' && e.name.match(/\.rrd$/);
								})
							});
						}, entrj)));
					}

					return Promise.all(tasks).then(L.bind(function(entries) {
						return Object.assign(this, {
							entries: entries
						});
					}, this));
				}, entr)));
			}

			return Promise.all(tasks);
		});
	},

	scan() {
		return this.ls().then(L.bind(function(entries) {
			rrdtree = {};

			for (let entr of entries) {
				const hostInstance = entr.name;

				rrdtree[hostInstance] = rrdtree[hostInstance] || {};

				for (let jentr of entr.entries) {
					const m = jentr.name.match(/^([^-]+)(?:-(.+))?$/);

					if (!m)
						continue;

					const pluginName = m[1];
					const pluginInstance = m[2] || '';

					rrdtree[hostInstance][pluginName] = rrdtree[hostInstance][pluginName] || {};
					rrdtree[hostInstance][pluginName][pluginInstance] = rrdtree[hostInstance][pluginName][pluginInstance] || {};

					for (let kentr of jentr.entries) {
						const m = kentr.name.match(/^([^-]+)(?:-(.+))?\.rrd$/);

						if (!m)
							continue;

						const dataType = m[1];
						const dataInstance = m[2] || '';

						rrdtree[hostInstance][pluginName][pluginInstance][dataType] = rrdtree[hostInstance][pluginName][pluginInstance][dataType] || [];
						rrdtree[hostInstance][pluginName][pluginInstance][dataType].push(dataInstance);
					}
				}
			}
		}, this));
	},

	hostInstances() {
		return Object.keys(rrdtree).sort();
	},

	pluginNames(hostInstance) {
		return Object.keys(rrdtree[hostInstance] || {}).sort();
	},

	pluginInstances(hostInstance, pluginName) {
		return Object.keys((rrdtree[hostInstance] || {})[pluginName] || {}).sort(function(a, b) {
			const x = a.match(/^(\d+)\b/);
			const y = b.match(/^(\d+)\b/);

			if (!x != !y)
				return !x - !y;
			else if (x && y && x[0] != y[0])
				return +x[0] - +y[0];
			else
				return a > b;
		});
	},

	dataTypes(hostInstance, pluginName, pluginInstance) {
		return Object.keys(((rrdtree[hostInstance] || {})[pluginName] || {})[pluginInstance] || {}).sort();
	},

	dataInstances(hostInstance, pluginName, pluginInstance, dataType) {
		return ((((rrdtree[hostInstance] || {})[pluginName] || {})[pluginInstance] || {})[dataType] || []).sort();
	},

	pluginTitle(pluginName) {
		const def = graphdefs[pluginName];
		return (def ? def.title : null) || pluginName;
	},

	hasDefinition(pluginName) {
		return (graphdefs[pluginName] != null);
	},

	hasInstanceDetails(hostInstance, pluginName, pluginInstance) {
		const def = graphdefs[pluginName];

		if (!def || typeof(def.rrdargs) != 'function')
			return false;

		const optlist = this._forcelol(def.rrdargs(this, hostInstance, pluginName, pluginInstance, null, false));

		for (let opt of optlist)
			if (opt.detail)
				return true;

		return false;
	},

	_mkpath(host, plugin, plugin_instance, dtype, data_instance) {
		let path = host + '/' + plugin;

		if (plugin_instance != null && plugin_instance != '')
			path += '-' + plugin_instance;

		path += '/' + dtype;

		if (data_instance != null && data_instance != '')
			path += '-' + data_instance;

		return path;
	},

	mkrrdpath(/* ... */) {
		return '%s/%s.rrd'.format(
			this.opts.rrdpath,
			this._mkpath.apply(this, arguments)
		).replace(/[\\:]/g, '\\$&');
	},

	_forcelol(list) {
		return L.isObject(list[0]) ? list : [ list ];
	},

	_rrdtool(def, rrd, timespan, width, height, cache) {
		const cmdline = [
			'graph', '-', '-a', 'PNG',
			'-s', 'NOW-%s'.format(timespan || this.opts.timespan),
			'-e', 'NOW-15',
			'-w', width || this.opts.width,
			'-h', height || this.opts.height
		];

		for (let d of def) {
			let opt = String(d);

			if (rrd)
				opt = opt.replace(/\{file\}/g, rrd);

			cmdline.push(opt);
		}

		if (L.isObject(cache)) {
			const key = sfh(cmdline.join('\0'));

			if (!cache.hasOwnProperty(key))
				cache[key] = fs.exec_direct('/usr/bin/rrdtool', cmdline, 'blob', true);

			return cache[key];
		}

		return fs.exec_direct('/usr/bin/rrdtool', cmdline, 'blob', true);
	},

	_generic(opts, host, plugin, plugin_instance, dtype, index) {
		const defs = [];
		const gopts = this.opts;
		let _args = [];
		let _sources = [];
		let _stack_neg = [];
		let _stack_pos = [];
		let _longest_name = 0;
		let _has_totals = false;

		/* use the plugin+instance+type as seed for the prng to ensure the
		   same pseudo-random color sequence for each render */
		random.seed(sfh([plugin, plugin_instance || '', dtype || ''].join('.')));

		function __def(source) {
			const inst = source.sname;
			const rrd  = source.rrd;
			const ds   = source.ds || 'value';

			_args.push(
				'DEF:%s_avg_raw=%s:%s:AVERAGE'.format(inst, rrd, ds),
				'CDEF:%s_avg=%s_avg_raw,%s'.format(inst, inst, source.transform_rpn)
			);

			if (!gopts.rrasingle)
				_args.push(
					'DEF:%s_min_raw=%s:%s:MIN'.format(inst, rrd, ds),
					'CDEF:%s_min=%s_min_raw,%s'.format(inst, inst, source.transform_rpn),
					'DEF:%s_max_raw=%s:%s:MAX'.format(inst, rrd, ds),
					'CDEF:%s_max=%s_max_raw,%s'.format(inst, inst, source.transform_rpn)
				);

			_args.push(
				'CDEF:%s_nnl=%s_avg,UN,0,%s_avg,IF'.format(inst, inst, inst)
			);
		}

		function __cdef(source) {
			let prev;

			if (source.flip)
				prev = _stack_neg[_stack_neg.length - 1];
			else
				prev = _stack_pos[_stack_pos.length - 1];

			/* is first source in stack or overlay source: source_stk = source_nnl */
			if (prev == null || source.overlay) {
				/* create cdef statement for cumulative stack (no NaNs) and also
				   for display (preserving NaN where no points should be displayed) */
				if (gopts.rrasingle || !gopts.rramax)
					_args.push(
						'CDEF:%s_stk=%s_nnl'.format(source.sname, source.sname),
						'CDEF:%s_plot=%s_avg'.format(source.sname, source.sname)
					);
				else
					_args.push(
						'CDEF:%s_stk=%s_nnl'.format(source.sname, source.sname),
						'CDEF:%s_plot=%s_max'.format(source.sname, source.sname)
					);
			}
			/* is subsequent source without overlay: source_stk = source_nnl + previous_stk */
			else {
				/* create cdef statement */
				if (gopts.rrasingle || !gopts.rramax)
					_args.push(
						'CDEF:%s_stk=%s_nnl,%s_stk,+'.format(source.sname, source.sname, prev),
						'CDEF:%s_plot=%s_avg,%s_stk,+'.format(source.sname, source.sname, prev)
					);
				else
					_args.push(
						'CDEF:%s_stk=%s_nnl,%s_stk,+'.format(source.sname, source.sname, prev),
						'CDEF:%s_plot=%s_max,%s_stk,+'.format(source.sname, source.sname, prev)
					);
			}

			/* create multiply by minus one cdef if flip is enabled */
			if (source.flip) {
				_args.push('CDEF:%s_neg=%s_plot,-1,*'.format(source.sname, source.sname));

				/* push to negative stack if overlay is disabled */
				if (!source.overlay)
					_stack_neg.push(source.sname);
			}

			/* no flipping, push to positive stack if overlay is disabled */
			else if (!source.overlay) {
				/* push to positive stack */
				_stack_pos.push(source.sname);
			}

			/* calculate total amount of data if requested */
			if (source.total)
				_args.push(
					'CDEF:%s_avg_sample=%s_avg,UN,0,%s_avg,IF,sample_len,*'.format(source.sname, source.sname, source.sname),
					'CDEF:%s_avg_sum=PREV,UN,0,PREV,IF,%s_avg_sample,+'.format(source.sname, source.sname, source.sname)
				);
		}

		/* local helper: create cdefs required for calculating total values */
		function __cdef_totals() {
			if (_has_totals)
				_args.push(
					'CDEF:mytime=%s_avg,TIME,TIME,IF'.format(_sources[0].sname),
					'CDEF:sample_len_raw=mytime,PREV(mytime),-',
					'CDEF:sample_len=sample_len_raw,UN,0,sample_len_raw,IF'
				);
		}

		/* local helper: create line and area statements */
		function __line(source) {
			let line_color, area_color, legend, variable;

			/* find colors: try source, then opts.colors; fall back to random color */
			if (typeof(source.color) == 'string') {
				line_color = source.color;
				area_color = colors.fromString(line_color);
			}
			else if (typeof(opts.colors[source.name.replace(/\W/g, '_')]) == 'string') {
				line_color = opts.colors[source.name.replace(/\W/g, '_')];
				area_color = colors.fromString(line_color);
			}
			else {
				area_color = colors.random();
				line_color = colors.asString(area_color);
			}

			/* derive area background color from line color */
			area_color = colors.asString(colors.faded(area_color));

			/* choose source_plot or source_neg variable depending on flip state */
			variable = source.flip ? 'neg' : 'plot';

			/* create legend */
			legend = '%%-%us'.format(_longest_name).format(source.title);

			/* create area is not disabled */
			if (!source.noarea)
				_args.push('AREA:%s_%s#%s'.format(source.sname, variable, area_color));

			/* create line statement */
			_args.push('LINE%d:%s_%s#%s:%s'.format(
				source.width || (source.noarea ? 2 : 1),
				source.sname, variable, line_color, legend
			));
		}

		/* local helper: create gprint statements */
		function __gprint(source) {
			const numfmt = opts.number_format || '%6.1lf';
			const totfmt = opts.totals_format || '%5.1lf%s';

			/* don't include MIN if rrasingle is enabled */
			if (!gopts.rrasingle)
				_args.push('GPRINT:%s_min:MIN:\tMin\\: %s'.format(source.sname, numfmt));

			/* don't include AVERAGE if noavg option is set */
			if (!source.noavg)
				_args.push('GPRINT:%s_avg:AVERAGE:\tAvg\\: %s'.format(source.sname, numfmt));

			/* don't include MAX if rrasingle is enabled */
			if (!gopts.rrasingle)
				_args.push('GPRINT:%s_max:MAX:\tMax\\: %s'.format(source.sname, numfmt));

			/* include total count if requested else include LAST */
			if (source.total)
				_args.push('GPRINT:%s_avg_sum:LAST:(ca. %s Total)\\l'.format(source.sname, totfmt));
			else
				_args.push('GPRINT:%s_avg:LAST:\tLast\\: %s\\l'.format(source.sname, numfmt));
		}

		/*
		 * find all data sources
		 */

		/* find data types */
		const data_types = dtype ? [ dtype ] : (opts.data.types || []);

		if (!(dtype || opts.data.types)) {
			if (L.isObject(opts.data.instances))
				data_types.push.apply(data_types, Object.keys(opts.data.instances));
			else if (L.isObject(opts.data.sources))
				data_types.push.apply(data_types, Object.keys(opts.data.sources));

		}

		/* iterate over data types */
		for (let dt of data_types) {
			/* find instances */
			let data_instances;

			if (!opts.per_instance) {
				if (L.isObject(opts.data.instances) && Array.isArray(opts.data.instances[dt]))
					data_instances = opts.data.instances[dt];
				else
					data_instances = this.dataInstances(host, plugin, plugin_instance, dt);
			}

			if (!Array.isArray(data_instances) || data_instances.length == 0)
				data_instances = [ '' ];

			/* iterate over data instances */
			for (let di of data_instances) {
				/* construct combined data type / instance name */
				let dname = dt;

				if (di.length)
					dname += '_' + di;

				/* find sources */
				let data_sources = [ 'value' ];

				if (L.isObject(opts.data.sources)) {
					if (Array.isArray(opts.data.sources[dname]))
						data_sources = opts.data.sources[dname];
					else if (Array.isArray(opts.data.sources[dt]))
						data_sources = opts.data.sources[dt];
				}

				/* iterate over data sources */
				for (let ds of data_sources) {
					const dsname  = dt + '_' + di.replace(/\W/g, '_') + '_' + ds;
					const altname = dt + '__' + ds;

					/* find datasource options */
					let dopts = {};

					if (L.isObject(opts.data.options)) {
						if (L.isObject(opts.data.options[dsname]))
							dopts = opts.data.options[dsname];
						else if (L.isObject(opts.data.options[altname]))
							dopts = opts.data.options[altname];
						else if (L.isObject(opts.data.options[dname]))
							dopts = opts.data.options[dname];
						else if (L.isObject(opts.data.options[dt]))
							dopts = opts.data.options[dt];
					}

					/* store values */
					const source = {
						rrd: dopts.rrd || this.mkrrdpath(host, plugin, plugin_instance, dt, di),
						color: dopts.color || colors.asString(colors.random()),
						flip: dopts.flip || false,
						total: dopts.total || false,
						overlay: dopts.overlay || false,
						transform_rpn: dopts.transform_rpn || '0,+',
						noarea: dopts.noarea || false,
						noavg: dopts.noavg || false,
						title: dopts.title || null,
						weight: dopts.weight || (dopts.negweight ? -+di : null) || (dopts.posweight ? +di : null) || null,
						ds: ds,
						type: dt,
						instance: di,
						index: _sources.length + 1,
						sname: String(_sources.length + 1) + dt
					};

					_sources.push(source);

					/* generate datasource title */
					source.title = i18n.ds(host, source);

					/* find longest name */
					_longest_name = Math.max(_longest_name, source.title.length);

					/* has totals? */
					if (source.total)
						_has_totals = true;
				}
			}
		}

		/*
		 * construct diagrams
		 */

		/* if per_instance is enabled then find all instances from the first datasource in diagram */
		/* if per_instance is disabled then use an empty pseudo instance and use model provided values */
		let instances = [ '' ];

		if (opts.per_instance)
			instances = this.dataInstances(host, plugin, plugin_instance, _sources[0].type);

		/* iterate over instances */
		for (let inst of instances) {
			/* store title and vlabel */
			_args.push(
				'-t', i18n.title(host, plugin, plugin_instance, _sources[0].type, inst, opts.title),
				'-v', i18n.label(host, plugin, plugin_instance, _sources[0].type, inst, opts.vlabel)
			);

			if (opts.y_max)
				_args.push('-u', String(opts.y_max));

			if (opts.y_min)
				_args.push('-l', String(opts.y_min));

			if (opts.units_exponent)
				_args.push('-X', String(opts.units_exponent));

			if (opts.alt_autoscale)
				_args.push('-A');

			if (opts.alt_autoscale_max)
				_args.push('-M');

			/* store additional rrd options */
			if (Array.isArray(opts.rrdopts))
				for (let opt of opts.rrdopts)
					_args.push(String(opt));

			/* sort sources */
			_sources.sort(function(a, b) {
				const x = a.weight || a.index || 0;
				const y = b.weight || b.index || 0;

				return +x - +y;
			});

			/* define colors in order */
			if (opts.ordercolor)
				for (let j = 0; j < _sources.length; j++)
					_sources[j].color = colors.defined(j);

			/* create DEF statements for each instance */
			for (let src of _sources) {
				/* fixup properties for per instance mode... */
				if (opts.per_instance) {
					src.instance = inst;
					src.rrd      = this.mkrrdpath(host, plugin, plugin_instance, src.type, inst);
				}

				__def(src);
			}

			/* create CDEF required for calculating totals */
			__cdef_totals();

			/* create CDEF statements for each instance in reversed order */
			for (let j = _sources.length - 1; j >= 0; j--)
				__cdef(_sources[j]);

			/* create LINE1, AREA and GPRINT statements for each instance */
			for (let src of _sources) {
				__line(src);
				__gprint(src);
			}

			/* push arg stack to definition list */
			defs.push(_args);

			/* reset stacks */
			_args = [];
			_stack_pos = [];
			_stack_neg = [];
		}

		return defs;
	},

	render(plugin, plugin_instance, is_index, hostname, timespan, width, height, cache) {
		const pngs = [];

		/* check for a whole graph handler */
		const def = graphdefs[plugin];

		if (def && typeof(def.rrdargs) == 'function') {
			/* temporary image matrix */
			const _images = [];

			/* get diagram definitions */
			const optlist = this._forcelol(def.rrdargs(this, hostname, plugin, plugin_instance, null, is_index));
			for (let i = 0; i < optlist.length; i++) {
				const opt = optlist[i];
				if (!is_index || !opt.detail) {
					_images[i] = [];

					/* get diagram definition instances */
					const diagrams = this._generic(opt, hostname, plugin, plugin_instance, null, i);

					/* render all diagrams */
					for (let j = 0; j < diagrams.length; j++) {
						/* exec */
						_images[i][j] = this._rrdtool(diagrams[j], null, timespan, width, height, cache);
					}
				}
			}

			/* remember images - XXX: fixme (will cause probs with asymmetric data) */
			for (let y = 0; y < _images[0].length; y++)
				for (let x = 0; x < _images.length; x++)
					pngs.push(_images[x][y]);
		}

		return Promise.all(pngs);
	}
});
