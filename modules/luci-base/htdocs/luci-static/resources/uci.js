'use strict';
'require rpc';
'require baseclass';

function isEmpty(object, ignore) {
	for (const property in object)
		if (object.hasOwnProperty(property) && property != ignore)
			return false;

	return true;
}

/**
 * @class uci
 * @memberof LuCI
 * @hideconstructor
 * @classdesc
 *
 * The `LuCI.uci` class utilizes {@link LuCI.rpc} to declare low level
 * remote UCI `ubus` procedures and implements a local caching and data
 * manipulation layer on top to allow for synchronous operations on
 * UCI configuration data.
 */
return baseclass.extend(/** @lends LuCI.uci.prototype */ {
	__init__() {
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
		expect: { values: { } },
		reject: true
	}),

	callOrder: rpc.declare({
		object: 'uci',
		method: 'order',
		params: [ 'config', 'sections' ],
		reject: true
	}),

	callAdd: rpc.declare({
		object: 'uci',
		method: 'add',
		params: [ 'config', 'type', 'name', 'values' ],
		expect: { section: '' },
		reject: true
	}),

	callSet: rpc.declare({
		object: 'uci',
		method: 'set',
		params: [ 'config', 'section', 'values' ],
		reject: true
	}),

	callDelete: rpc.declare({
		object: 'uci',
		method: 'delete',
		params: [ 'config', 'section', 'options' ],
		reject: true
	}),

	callApply: rpc.declare({
		object: 'uci',
		method: 'apply',
		params: [ 'timeout', 'rollback' ],
		reject: true
	}),

	callConfirm: rpc.declare({
		object: 'uci',
		method: 'confirm',
		reject: true
	}),


	/**
	 * Generates a new, unique section ID for the given configuration.
	 *
	 * Note that the generated ID is temporary, it will get replaced by an
	 * identifier in the form `cfgXXXXXX` once the configuration is saved
	 * by the remote `ubus` UCI api.
	 *
	 * @param {string} conf
	 * The configuration to generate the new section ID for.
	 *
	 * @returns {string}
	 * A newly generated, unique section ID in the form `newXXXXXX`
	 * where `X` denotes a hexadecimal digit.
	 */
	createSID(conf) {
		const v = this.state.values;
		const n = this.state.creates;
		let sid;

		do {
			sid = "new%06x".format(Math.random() * 0xFFFFFF);
		} while ((n[conf]?.[sid]) || (v[conf]?.[sid]));

		return sid;
	},

	/**
	 * Resolves a given section ID in extended notation to the internal
	 * section ID value.
	 *
	 * @param {string} conf
	 * The configuration to resolve the section ID for.
	 *
	 * @param {string} sid
	 * The section ID to resolve. If the ID is in the form `@typename[#]`,
	 * it will get resolved to an internal anonymous ID in the forms
	 * `cfgXXXXXX`/`newXXXXXX` or to the name of a section in case it points
	 * to a named section. When the given ID is not in extended notation,
	 * it will be returned as-is.
	 *
	 * @returns {string|null}
	 * Returns the resolved section ID or the original given ID if it was
	 * not in extended notation. Returns `null` when an extended ID could
	 * not be resolved to existing section ID.
	 */
	resolveSID(conf, sid) {
		if (typeof(sid) != 'string')
			return sid;

		const m = /^@([a-zA-Z0-9_-]+)\[(-?[0-9]+)\]$/.exec(sid);

		if (m) {
			const type = m[1];
			const pos = +m[2];
			const sections = this.sections(conf, type);
			const section = sections[pos >= 0 ? pos : sections.length + pos];

			return section?.['.name'] ?? null;
		}

		return sid;
	},

	/* private */
	reorderSections() {
		const v = this.state.values;
		const n = this.state.creates;
		const d = this.state.deletes;
		const r = this.state.reorder;
		const tasks = [];

		if (Object.keys(r).length === 0)
			return Promise.resolve();

		/*
		 gather all created and existing sections, sort them according
		 to their index value and issue an uci order call
		*/
		for (const c in r) {
			const o = [ ];

			// skip deletes within re-orders
			if (d[c])
				continue;

			// push creates
			if (n[c])
				for (const s in n[c])
					o.push(n[c][s]);

			// push values
			for (const s in v[c])
				o.push(v[c][s]);

			if (o.length > 0) {
				o.sort((a, b) => a['.index'] - b['.index']);

				const sids = [ ];

				for (let i = 0; i < o.length; i++)
					sids.push(o[i]['.name']);

				tasks.push(this.callOrder(c, sids));
			}
		}

		this.state.reorder = { };
		return Promise.all(tasks);
	},

	/* private */
	loadPackage(packageName) {
		if (this.loaded[packageName] == null)
			return (this.loaded[packageName] = this.callLoad(packageName));

		return Promise.resolve(this.loaded[packageName]);
	},

	/**
	 * Loads the given UCI configurations from the remote `ubus` api.
	 *
	 * Loaded configurations are cached and only loaded once. Subsequent
	 * load operations of the same configurations will return the cached
	 * data.
	 *
	 * To force reloading a configuration, it has to be unloaded with
	 * {@link LuCI.uci#unload uci.unload()} first.
	 *
	 * @param {string|string[]} packages
	 * The name of the configuration or an array of configuration
	 * names to load.
	 *
	 * @returns {Promise<string[]>}
	 * Returns a promise resolving to the names of the configurations
	 * that have been successfully loaded.
	 */
	load(packages) {
		const self = this;
		const pkgs = [ ];
		const tasks = [];

		if (!Array.isArray(packages))
			packages = [ packages ];

		for (let i = 0; i < packages.length; i++)
			if (!self.state.values[packages[i]]) {
				pkgs.push(packages[i]);
				tasks.push(self.loadPackage(packages[i]));
			}

		return Promise.all(tasks).then(responses => {
			for (let i = 0; i < responses.length; i++)
				self.state.values[pkgs[i]] = responses[i];

			if (responses.length)
				document.dispatchEvent(new CustomEvent('uci-loaded'));

			return pkgs;
		});
	},

	/**
	 * Unloads the given UCI configurations from the local cache.
	 *
	 * @param {string|string[]} packages
	 * The name of the configuration or an array of configuration
	 * names to unload.
	 */
	unload(packages) {
		if (!Array.isArray(packages))
			packages = [ packages ];

		for (let i = 0; i < packages.length; i++) {
			delete this.state.values[packages[i]];
			delete this.state.creates[packages[i]];
			delete this.state.changes[packages[i]];
			delete this.state.deletes[packages[i]];

			delete this.loaded[packages[i]];
		}
	},

	/**
	 * Adds a new section of the given type to the given configuration,
	 * optionally named according to the given name.
	 *
	 * @param {string} conf
	 * The name of the configuration to add the section to.
	 *
	 * @param {string} type
	 * The type of the section to add.
	 *
	 * @param {string} [name]
	 * The name of the section to add. If the name is omitted, an anonymous
	 * section will be added instead.
	 *
	 * @returns {string}
	 * Returns the section ID of the newly added section which is equivalent
	 * to the given name for non-anonymous sections.
	 */
	add(conf, type, name) {
		const n = this.state.creates;
		const sid = name || this.createSID(conf);

		n[conf] ??= { };
		n[conf][sid] = {
			'.type':      type,
			'.name':      sid,
			'.create':    name,
			'.anonymous': !name,
			'.index':     1000 + this.state.newidx++
		};

		return sid;
	},

	/**
	 * Clones an existing section of the given type to the given configuration,
	 * optionally named according to the given name.
	 *
	 * @param {string} conf
	 * The name of the configuration into which to clone the section.
	 *
	 * @param {string} type
	 * The type of the section to clone.
	 *
	 * @param {string} srcsid
	 * The source section id to clone.
	 *
	 * @param {boolean} [put_next]
	 * Whether to put the cloned item next (true) or last (false: default).
	 *
	 * @param {string} [name]
	 * The name of the new cloned section. If the name is omitted, an anonymous
	 * section will be created instead.
	 *
	 * @returns {string}
	 * Returns the section ID of the newly cloned section which is equivalent
	 * to the given name for non-anonymous sections.
	 */
	clone(conf, type, srcsid, put_next, name) {
		let n = this.state.creates;
		let sid = this.createSID(conf);
		let v = this.state.values;
		put_next = put_next || false;

		if (!n[conf])
			n[conf] = { };

		n[conf][sid] = {
			...v[conf][srcsid],
			'.type': type,
			'.name': sid,
			'.create': name,
			'.anonymous': !name,
			'.index': 1000 + this.state.newidx++
		};

		if (put_next)
			this.move(conf, sid, srcsid, put_next);
		return sid;
	},

	/**
	 * Removes the section with the given ID from the given configuration.
	 *
	 * @param {string} conf
	 * The name of the configuration to remove the section from.
	 *
	 * @param {string} sid
	 * The ID of the section to remove.
	 */
	remove(conf, sid) {
		const v = this.state.values;
		const n = this.state.creates;
		const c = this.state.changes;
		const d = this.state.deletes;

		/* requested deletion of a just created section */
		if (n[conf]?.[sid]) {
			delete n[conf][sid];
		}
		else if (v[conf]?.[sid]) {
			delete c[conf]?.[sid];

			d[conf] ??= { };
			d[conf][sid] = true;
		}
	},

	/**
	 * A section object represents the options and their corresponding values
	 * enclosed within a configuration section, as well as some additional
	 * meta data such as sort indexes and internal ID.
	 *
	 * Any internal metadata fields are prefixed with a dot which isn't
	 * an allowed character for normal option names.
	 *
	 * @typedef {Object<string, boolean|number|string|string[]>} SectionObject
	 * @memberof LuCI.uci
	 *
	 * @property {boolean} .anonymous
	 * The `.anonymous` property specifies whether the configuration is
	 * anonymous (`true`) or named (`false`).
	 *
	 * @property {number} .index
	 * The `.index` property specifies the sort order of the section.
	 *
	 * @property {string} .name
	 * The `.name` property holds the name of the section object. It may be
	 * either an anonymous ID in the form `cfgXXXXXX` or `newXXXXXX` with `X`
	 * being a hexadecimal digit or a string holding the name of the section.
	 *
	 * @property {string} .type
	 * The `.type` property contains the type of the corresponding uci
	 * section.
	 *
	 * @property {string|string[]} *
	 * A section object may contain an arbitrary number of further properties
	 * representing the uci option enclosed in the section.
	 *
	 * All option property names will be in the form `[A-Za-z0-9_]+` and
	 * either contain a string value or an array of strings, in case the
	 * underlying option is an UCI list.
	 */

	/**
	 * The sections callback is invoked for each section found within
	 * the given configuration and receives the section object and its
	 * associated name as arguments.
	 *
	 * @callback LuCI.uci~sectionsFn
	 *
	 * @param {LuCI.uci.SectionObject} section
	 * The section object.
	 *
	 * @param {string} sid
	 * The name or ID of the section.
	 */

	/**
	 * Enumerates the sections of the given configuration, optionally
	 * filtered by type.
	 *
	 * @param {string} conf
	 * The name of the configuration to enumerate the sections for.
	 *
	 * @param {string} [type]
	 * Enumerate only sections of the given type. If omitted, enumerate
	 * all sections.
	 *
	 * @param {LuCI.uci~sectionsFn} [cb]
	 * An optional callback to invoke for each enumerated section.
	 *
	 * @returns {Array<LuCI.uci.SectionObject>}
	 * Returns a sorted array of the section objects within the given
	 * configuration, filtered by type, if a type has been specified.
	 */
	sections(conf, type, cb) {
		const sa = [ ];
		const v = this.state.values[conf];
		const n = this.state.creates[conf];
		const c = this.state.changes[conf];
		const d = this.state.deletes[conf];

		if (!v)
			return sa;

		for (const s in v)
			if (!d || d[s] !== true)
				if (!type || v[s]['.type'] == type)
					sa.push(Object.assign({ }, v[s], c ? c[s] : null));

		if (n)
			for (const s in n)
				if (!type || n[s]['.type'] == type)
					sa.push(Object.assign({ }, n[s]));

		sa.sort((a, b) => {
			return a['.index'] - b['.index'];
		});

		for (let i = 0; i < sa.length; i++)
			sa[i]['.index'] = i;

		if (typeof(cb) == 'function')
			for (let i = 0; i < sa.length; i++)
				cb.call(this, sa[i], sa[i]['.name']);

		return sa;
	},

	/**
	 * Gets the value of the given option within the specified section
	 * of the given configuration or the entire section object if the
	 * option name is omitted.
	 *
	 * @param {string} conf
	 * The name of the configuration to read the value from.
	 *
	 * @param {string} sid
	 * The name or ID of the section to read.
	 *
	 * @param {string} [opt]
	 * The option name to read the value from. If the option name is
	 * omitted or `null`, the entire section is returned instead.
	 *
	 * @returns {null|string|string[]|LuCI.uci.SectionObject}
	 * - Returns a string containing the option value in case of a
	 *   plain UCI option.
	 * - Returns an array of strings containing the option values in
	 *   case of `option` pointing to an UCI list.
	 * - Returns a {@link LuCI.uci.SectionObject section object} if
	 *   the `option` argument has been omitted or is `null`.
	 * - Returns `null` if the config, section or option has not been
	 *   found or if the corresponding configuration is not loaded.
	 */
	get(conf, sid, opt) {
		const v = this.state.values;
		const n = this.state.creates;
		const c = this.state.changes;
		const d = this.state.deletes;

		sid = this.resolveSID(conf, sid);

		if (sid == null)
			return null;

		/* requested option in a just created section */
		if (n[conf]?.[sid]) {
			if (opt == null)
				return n[conf][sid];

			return n[conf][sid][opt];
		}

		/* requested an option value */
		if (opt != null) {
			/* check whether option was deleted */
			if (d[conf]?.[sid])
				if (d[conf][sid] === true || d[conf][sid][opt])
					return null;

			/* check whether option was changed */
			if (c[conf]?.[sid]?.[opt] != null)
				return c[conf][sid][opt];

			/* return base value */
			if (v[conf]?.[sid])
				return v[conf][sid][opt];

			return null;
		}

		/* requested an entire section */
		if (v[conf]) {
			/* check whether entire section was deleted */
			if (d[conf]?.[sid] === true)
				return null;

			const s = v[conf][sid] || null;

			if (s) {
				/* merge changes */
				if (c[conf]?.[sid])
					for (const opt in c[conf][sid])
						if (c[conf][sid][opt] != null)
							s[opt] = c[conf][sid][opt];

				/* merge deletions */
				if (d[conf]?.[sid])
					for (const opt in d[conf][sid])
						delete s[opt];
			}

			return s;
		}

		return null;
	},

	/**
	 * Sets the value of the given option within the specified section
	 * of the given configuration.
	 *
	 * If either config, section or option is null, or if `option` begins
	 * with a dot, the function will do nothing.
	 *
	 * @param {string} conf
	 * The name of the configuration to set the option value in.
	 *
	 * @param {string} sid
	 * The name or ID of the section to set the option value in.
	 *
	 * @param {string} opt
	 * The option name to set the value for.
	 *
	 * @param {null|string|string[]} val
	 * The option value to set. If the value is `null` or an empty string,
	 * the option will be removed, otherwise it will be set or overwritten
	 * with the given value.
	 */
	set(conf, sid, opt, val) {
		const v = this.state.values;
		const n = this.state.creates;
		const c = this.state.changes;
		const d = this.state.deletes;

		sid = this.resolveSID(conf, sid);

		if (sid == null || opt == null || opt.charAt(0) == '.')
			return;

		if (n[conf]?.[sid]) {
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
			if (!v[conf]?.[sid])
				return;

			c[conf] ??= {};
			c[conf][sid] ??= {};

			/* undelete option */
			if (d[conf]?.[sid]) {
				if (isEmpty(d[conf][sid], opt))
					delete d[conf][sid];
				else
					delete d[conf][sid][opt];
			}

			c[conf][sid][opt] = val;
		}
		else {
			/* revert any change for to-be-deleted option */
			if (c[conf]?.[sid]) {
				if (isEmpty(c[conf][sid], opt))
					delete c[conf][sid];
				else
					delete c[conf][sid][opt];
			}

			/* only delete existing options */
			if (v[conf]?.[sid]?.hasOwnProperty(opt)) {
				d[conf] ??= { };
				d[conf][sid] ??= { };

				if (d[conf][sid] !== true)
					d[conf][sid][opt] = true;
			}
		}
	},

	/**
	 * Remove the given option within the specified section of the given
	 * configuration.
	 *
	 * This function is a convenience wrapper around
	 * `uci.set(config, section, option, null)`.
	 *
	 * @param {string} conf
	 * The name of the configuration to remove the option from.
	 *
	 * @param {string} sid
	 * The name or ID of the section to remove the option from.
	 *
	 * @param {string} opt
	 * The name of the option to remove.
	 */
	unset(conf, sid, opt) {
		return this.set(conf, sid, opt, null);
	},

	/**
	 * Gets the value of the given option or the entire section object of
	 * the first found section of the specified type or the first found
	 * section of the entire configuration if no type is specified.
	 *
	 * @param {string} conf
	 * The name of the configuration to read the value from.
	 *
	 * @param {string} [type]
	 * The type of the first section to find. If it is `null`, the first
	 * section of the entire config is read, otherwise the first section
	 * matching the given type.
	 *
	 * @param {string} [opt]
	 * The option name to read the value from. If the option name is
	 * omitted or `null`, the entire section is returned instead.
	 *
	 * @returns {null|string|string[]|LuCI.uci.SectionObject}
	 * - Returns a string containing the option value in case of a
	 *   plain UCI option.
	 * - Returns an array of strings containing the option values in
	 *   case of `option` pointing to an UCI list.
	 * - Returns a {@link LuCI.uci.SectionObject section object} if
	 *   the `option` argument has been omitted or is `null`.
	 * - Returns `null` if the config, section or option has not been
	 *   found or if the corresponding configuration is not loaded.
	 */
	get_first(conf, type, opt) {
		let sid = null;

		this.sections(conf, type, s => {
			sid ??= s['.name'];
		});

		return this.get(conf, sid, opt);
	},

	/**
	 * A special case of `get` that always returns either `true` or 
	 * `false`.
	 *
	 * Many configuration files contain boolean settings, such as
	 * `enabled` or `advanced_mode`, where there is no consistent
	 * definition for the values.  This function allows users to
	 * enter any of the values `"yes"`, `"on"`, `"true"` or `1` in
	 * their config files and we return the expected boolean result.
	 *
	 * Character case is not significant, so for example, any of
	 * "YES", "Yes" or "yes" will be interpreted as a `true` value.
	 *
	 * @param {string} conf
	 * The name of the configuration to read.
	 *
	 * @param {string} sid
	 * The name or ID of the section to read.
	 *
	 * @param {string} [opt]
	 * The option name from which to read the value. If the option
	 * name is omitted or `null`, the value `false` is returned.
	 *
	 * @returns {boolean}
	 * - Returns boolean `true` if the configuration value is defined
	 *   and looks like a true value, otherwise returns `false`.
	 */
	get_bool(conf, type, opt) {
		let value = this.get(conf, type, opt);
		if (typeof(value) == 'string')
			return ['1', 'on', 'true', 'yes', 'enabled'].includes(value.toLowerCase());
		return false;
	},

	/**
	 * Sets the value of the given option within the first found section
	 * of the given configuration matching the specified type or within
	 * the first section of the entire config when no type has is specified.
	 *
	 * If either config, type or option is null, or if `option` begins
	 * with a dot, the function will do nothing.
	 *
	 * @param {string} conf
	 * The name of the configuration to set the option value in.
	 *
	 * @param {string} [type]
	 * The type of the first section to find. If it is `null`, the first
	 * section of the entire config is written to, otherwise the first
	 * section matching the given type is used.
	 *
	 * @param {string} opt
	 * The option name to set the value for.
	 *
	 * @param {null|string|string[]} val
	 * The option value to set. If the value is `null` or an empty string,
	 * the option will be removed, otherwise it will be set or overwritten
	 * with the given value.
	 */
	set_first(conf, type, opt, val) {
		let sid = null;

		this.sections(conf, type, s => {
			sid ??= s['.name'];
		});

		return this.set(conf, sid, opt, val);
	},

	/**
	 * Removes the given option within the first found section of the given
	 * configuration matching the specified type or within the first section
	 * of the entire config when no type has is specified.
	 *
	 * This function is a convenience wrapper around
	 * `uci.set_first(config, type, option, null)`.
	 *
	 * @param {string} conf
	 * The name of the configuration to set the option value in.
	 *
	 * @param {string} [type]
	 * The type of the first section to find. If it is `null`, the first
	 * section of the entire config is written to, otherwise the first
	 * section matching the given type is used.
	 *
	 * @param {string} opt
	 * The option name to set the value for.
	 */
	unset_first(conf, type, opt) {
		return this.set_first(conf, type, opt, null);
	},

	/**
	 * Move the first specified section within the given configuration
	 * before or after the second specified section.
	 *
	 * @param {string} conf
	 * The configuration to move the section within.
	 *
	 * @param {string} sid1
	 * The ID of the section to move within the configuration.
	 *
	 * @param {string} [sid2]
	 * The ID of the target section for the move operation. If the
	 * `after` argument is `false` or not specified, the section named by
	 * `sid1` will be moved before this target section, if the `after`
	 * argument is `true`, the `sid1` section will be moved after this
	 * section.
	 *
	 * When the `sid2` argument is `null`, the section specified by `sid1`
	 * is moved to the end of the configuration.
	 *
	 * @param {boolean} [after=false]
	 * When `true`, the section `sid1` is moved after the section `sid2`,
	 * when `false`, the section `sid1` is moved before `sid2`.
	 *
	 * If `sid2` is null, then this parameter has no effect and the section
	 * `sid1` is moved to the end of the configuration instead.
	 *
	 * @returns {boolean}
	 * Returns `true` when the section was successfully moved, or `false`
	 * when either the section specified by `sid1` or by `sid2` is not found.
	 */
	move(conf, sid1, sid2, after) {
		const sa = this.sections(conf);
		let s1 = null;
		let s2 = null;

		sid1 = this.resolveSID(conf, sid1);
		sid2 = this.resolveSID(conf, sid2);

		for (let i = 0; i < sa.length; i++) {
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
			for (let i = 0; i < sa.length; i++) {
				if (sa[i]['.name'] != sid2)
					continue;

				s2 = sa[i];
				sa.splice(i + !!after, 0, s1);
				break;
			}

			if (s2 == null)
				return false;
		}

		for (let i = 0; i < sa.length; i++)
			this.get(conf, sa[i]['.name'])['.index'] = i;

		this.state.reorder[conf] = true;

		return true;
	},

	/**
	 * Submits all local configuration changes to the remove `ubus` api,
	 * adds, removes and reorders remote sections as needed and reloads
	 * all loaded configurations to resynchronize the local state with
	 * the remote configuration values.
	 *
	 * @returns {string[]}
	 * Returns a promise resolving to an array of configuration names which
	 * have been reloaded by the save operation.
	 */
	save() {
		const v = this.state.values;
		const n = this.state.creates;
		const c = this.state.changes;
		const d = this.state.deletes;
		const r = this.state.reorder;
		const self = this;
		const snew = [ ];
		let pkgs = { };
		const tasks = [];

		if (d)
			for (const conf in d) {
				for (const sid in d[conf]) {
					const o = d[conf][sid];

					if (o === true)
						tasks.push(self.callDelete(conf, sid, null));
					else
						tasks.push(self.callDelete(conf, sid, Object.keys(o)));
				}

				pkgs[conf] = true;
			}

		if (n)
			for (const conf in n) {
				for (const sid in n[conf]) {
					const p = {
						config: conf,
						values: { }
					};

					for (const k in n[conf][sid]) {
						if (k == '.type')
							p.type = n[conf][sid][k];
						else if (k == '.create')
							p.name = n[conf][sid][k];
						else if (k.charAt(0) != '.')
							p.values[k] = n[conf][sid][k];
					}

					snew.push(n[conf][sid]);
					tasks.push(self.callAdd(p.config, p.type, p.name, p.values));
				}

				pkgs[conf] = true;
			}

		if (c)
			for (const conf in c) {
				for (const sid in c[conf])
					tasks.push(self.callSet(conf, sid, c[conf][sid]));

				pkgs[conf] = true;
			}

		if (r)
			for (const conf in r)
				pkgs[conf] = true;

		return Promise.all(tasks).then(responses => {
			/*
			 array "snew" holds references to the created uci sections,
			 use it to assign the returned names of the new sections
			*/
			for (let i = 0; i < snew.length; i++)
				snew[i]['.name'] = responses[i];

			return self.reorderSections();
		}).then(() => {
			pkgs = Object.keys(pkgs);

			self.unload(pkgs);

			return self.load(pkgs);
		});
	},

	/**
	 * Instructs the remote `ubus` UCI api to commit all saved changes with
	 * rollback protection and attempts to confirm the pending commit
	 * operation to cancel the rollback timer.
	 *
	 * @param {number} [timeout=10]
	 * Override the confirmation timeout after which a rollback is triggered.
	 *
	 * @returns {Promise<number>}
	 * Returns a promise resolving/rejecting with the `ubus` RPC status code.
	 */
	apply(timeout) {
		const self = this;
		const date = new Date();

		if (typeof(timeout) != 'number' || timeout < 1)
			timeout = 10;

		return self.callApply(timeout, true).then(rv => {
			if (rv != 0)
				return Promise.reject(rv);

			const try_deadline = date.getTime() + 1000 * timeout;
			const try_confirm = () => {
				return self.callConfirm().then(rv => {
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

	/**
	 * An UCI change record is a plain array containing the change operation
	 * name as first element, the affected section ID as second argument
	 * and an optional third and fourth argument whose meanings depend on
	 * the operation.
	 *
	 * @typedef {string[]} ChangeRecord
	 * @memberof LuCI.uci
	 *
	 * @property {string} 0
	 * The operation name - may be one of `add`, `set`, `remove`, `order`,
	 * `list-add`, `list-del` or `rename`.
	 *
	 * @property {string} 1
	 * The section ID targeted by the operation.
	 *
	 * @property {string} 2
	 * The meaning of the third element depends on the operation.
	 * - For `add` it is type of the section that has been added
	 * - For `set` it either is the option name if a fourth element exists,
	 *   or the type of a named section which has been added when the change
	 *   entry only contains three elements.
	 * - For `remove` it contains the name of the option that has been
	 *   removed.
	 * - For `order` it specifies the new sort index of the section.
	 * - For `list-add` it contains the name of the list option a new value
	 *   has been added to.
	 * - For `list-del` it contains the name of the list option a value has
	 *   been removed from.
	 * - For `rename` it contains the name of the option that has been
	 *   renamed if a fourth element exists, else it contains the new name
	 *   a section has been renamed to if the change entry only contains
	 *   three elements.
	 *
	 * @property {string} 4
	 * The meaning of the fourth element depends on the operation.
	 * - For `set` it is the value an option has been set to.
	 * - For `list-add` it is the new value that has been added to a
	 *   list option.
	 * - For `rename` it is the new name of an option that has been
	 *   renamed.
	 */

	/**
	 * Fetches uncommitted UCI changes from the remote `ubus` RPC api.
	 *
	 * @method
	 * @returns {Promise<Object<string, Array<LuCI.uci.ChangeRecord>>>}
	 * Returns a promise resolving to an object containing the configuration
	 * names as keys and arrays of related change records as values.
	 */
	changes: rpc.declare({
		object: 'uci',
		method: 'changes',
		expect: { changes: { } }
	})
});
