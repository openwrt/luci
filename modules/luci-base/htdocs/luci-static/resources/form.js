'use strict';
'require ui';
'require uci';
'require rpc';
'require dom';
'require baseclass';

var scope = this;

var callSessionAccess = rpc.declare({
	object: 'session',
	method: 'access',
	params: [ 'scope', 'object', 'function' ],
	expect: { 'access': false }
});

var CBIJSONConfig = baseclass.extend({
	__init__: function(data) {
		data = Object.assign({}, data);

		this.data = {};

		var num_sections = 0,
		    section_ids = [];

		for (var sectiontype in data) {
			if (!data.hasOwnProperty(sectiontype))
				continue;

			if (Array.isArray(data[sectiontype])) {
				for (var i = 0, index = 0; i < data[sectiontype].length; i++) {
					var item = data[sectiontype][i],
					    anonymous, name;

					if (!L.isObject(item))
						continue;

					if (typeof(item['.name']) == 'string') {
						name = item['.name'];
						anonymous = false;
					}
					else {
						name = sectiontype + num_sections;
						anonymous = true;
					}

					if (!this.data.hasOwnProperty(name))
						section_ids.push(name);

					this.data[name] = Object.assign(item, {
						'.index': num_sections++,
						'.anonymous': anonymous,
						'.name': name,
						'.type': sectiontype
					});
				}
			}
			else if (L.isObject(data[sectiontype])) {
				this.data[sectiontype] = Object.assign(data[sectiontype], {
					'.anonymous': false,
					'.name': sectiontype,
					'.type': sectiontype
				});

				section_ids.push(sectiontype);
				num_sections++;
			}
		}

		section_ids.sort(L.bind(function(a, b) {
			var indexA = (this.data[a]['.index'] != null) ? +this.data[a]['.index'] : 9999,
			    indexB = (this.data[b]['.index'] != null) ? +this.data[b]['.index'] : 9999;

			if (indexA != indexB)
				return (indexA - indexB);

			return L.naturalCompare(a, b);
		}, this));

		for (var i = 0; i < section_ids.length; i++)
			this.data[section_ids[i]]['.index'] = i;
	},

	load: function() {
		return Promise.resolve(this.data);
	},

	save: function() {
		return Promise.resolve();
	},

	get: function(config, section, option) {
		if (section == null)
			return null;

		if (option == null)
			return this.data[section];

		if (!this.data.hasOwnProperty(section))
			return null;

		var value = this.data[section][option];

		if (Array.isArray(value))
			return value;

		if (value != null)
			return String(value);

		return null;
	},

	set: function(config, section, option, value) {
		if (section == null || option == null || option.charAt(0) == '.')
			return;

		if (!this.data.hasOwnProperty(section))
			return;

		if (value == null)
			delete this.data[section][option];
		else if (Array.isArray(value))
			this.data[section][option] = value;
		else
			this.data[section][option] = String(value);
	},

	unset: function(config, section, option) {
		return this.set(config, section, option, null);
	},

	sections: function(config, sectiontype, callback) {
		var rv = [];

		for (var section_id in this.data)
			if (sectiontype == null || this.data[section_id]['.type'] == sectiontype)
				rv.push(this.data[section_id]);

		rv.sort(function(a, b) { return a['.index'] - b['.index'] });

		if (typeof(callback) == 'function')
			for (var i = 0; i < rv.length; i++)
				callback.call(this, rv[i], rv[i]['.name']);

		return rv;
	},

	add: function(config, sectiontype, sectionname) {
		var num_sections_type = 0, next_index = 0;

		for (var name in this.data) {
			num_sections_type += (this.data[name]['.type'] == sectiontype);
			next_index = Math.max(next_index, this.data[name]['.index']);
		}

		var section_id = sectionname || sectiontype + num_sections_type;

		if (!this.data.hasOwnProperty(section_id)) {
			this.data[section_id] = {
				'.name': section_id,
				'.type': sectiontype,
				'.anonymous': (sectionname == null),
				'.index': next_index + 1
			};
		}

		return section_id;
	},

	remove: function(config, section) {
		if (this.data.hasOwnProperty(section))
			delete this.data[section];
	},

	resolveSID: function(config, section_id) {
		return section_id;
	},

	move: function(config, section_id1, section_id2, after) {
		return uci.move.apply(this, [config, section_id1, section_id2, after]);
	}
});

/**
 * @class AbstractElement
 * @memberof LuCI.form
 * @hideconstructor
 * @classdesc
 *
 * The `AbstractElement` class serves as abstract base for the different form
 * elements implemented by `LuCI.form`. It provides the common logic for
 * loading and rendering values, for nesting elements and for defining common
 * properties.
 *
 * This class is private and not directly accessible by user code.
 */
var CBIAbstractElement = baseclass.extend(/** @lends LuCI.form.AbstractElement.prototype */ {
	__init__: function(title, description) {
		this.title = title || '';
		this.description = description || '';
		this.children = [];
	},

	/**
	 * Add another form element as children to this element.
	 *
	 * @param {AbstractElement} obj
	 * The form element to add.
	 */
	append: function(obj) {
		this.children.push(obj);
	},

	/**
	 * Parse this elements form input.
	 *
	 * The `parse()` function recursively walks the form element tree and
	 * triggers input value reading and validation for each encountered element.
	 *
	 * Elements which are hidden due to unsatisfied dependencies are skipped.
	 *
	 * @returns {Promise<void>}
	 * Returns a promise resolving once this element's value and the values of
	 * all child elements have been parsed. The returned promise is rejected
	 * if any parsed values are not meeting the validation constraints of their
	 * respective elements.
	 */
	parse: function() {
		var args = arguments;
		this.children.forEach(function(child) {
			child.parse.apply(child, args);
		});
	},

	/**
	 * Render the form element.
	 *
	 * The `render()` function recursively walks the form element tree and
	 * renders the markup for each element, returning the assembled DOM tree.
	 *
	 * @abstract
	 * @returns {Node|Promise<Node>}
	 * May return a DOM Node or a promise resolving to a DOM node containing
	 * the form element's markup, including the markup of any child elements.
	 */
	render: function() {
		L.error('InternalError', 'Not implemented');
	},

	/** @private */
	loadChildren: function(/* ... */) {
		var tasks = [];

		if (Array.isArray(this.children))
			for (var i = 0; i < this.children.length; i++)
				if (!this.children[i].disable)
					tasks.push(this.children[i].load.apply(this.children[i], arguments));

		return Promise.all(tasks);
	},

	/** @private */
	renderChildren: function(tab_name /*, ... */) {
		var tasks = [],
		    index = 0;

		if (Array.isArray(this.children))
			for (var i = 0; i < this.children.length; i++)
				if (tab_name === null || this.children[i].tab === tab_name)
					if (!this.children[i].disable)
						tasks.push(this.children[i].render.apply(
							this.children[i], this.varargs(arguments, 1, index++)));

		return Promise.all(tasks);
	},

	/**
	 * Strip any HTML tags from the given input string.
	 *
	 * @param {string} s
	 * The input string to clean.
	 *
	 * @returns {string}
	 * The cleaned input string with HTML tags removed.
	 */
	stripTags: function(s) {
		if (typeof(s) == 'string' && !s.match(/[<>]/))
			return s;

		var x = dom.elem(s) ? s : dom.parse('<div>' + s + '</div>');

		x.querySelectorAll('br').forEach(function(br) {
			x.replaceChild(document.createTextNode('\n'), br);
		});

		return (x.textContent || x.innerText || '').replace(/([ \t]*\n)+/g, '\n');
	},

	/**
	 * Format the given named property as title string.
	 *
	 * This function looks up the given named property and formats its value
	 * suitable for use as element caption or description string. It also
	 * strips any HTML tags from the result.
	 *
	 * If the property value is a string, it is passed to `String.format()`
	 * along with any additional parameters passed to `titleFn()`.
	 *
	 * If the property value is a function, it is invoked with any additional
	 * `titleFn()` parameters as arguments and the obtained return value is
	 * converted to a string.
	 *
	 * In all other cases, `null` is returned.
	 *
	 * @param {string} property
	 * The name of the element property to use.
	 *
	 * @param {...*} fmt_args
	 * Extra values to format the title string with.
	 *
	 * @returns {string|null}
	 * The formatted title string or `null` if the property did not exist or
	 * was neither a string nor a function.
	 */
	titleFn: function(attr /*, ... */) {
		var s = null;

		if (typeof(this[attr]) == 'function')
			s = this[attr].apply(this, this.varargs(arguments, 1));
		else if (typeof(this[attr]) == 'string')
			s = (arguments.length > 1) ? ''.format.apply(this[attr], this.varargs(arguments, 1)) : this[attr];

		if (s != null)
			s = this.stripTags(String(s)).trim();

		if (s == null || s == '')
			return null;

		return s;
	}
});

/**
 * @constructor Map
 * @memberof LuCI.form
 * @augments LuCI.form.AbstractElement
 *
 * @classdesc
 *
 * The `Map` class represents one complete form. A form usually maps one UCI
 * configuration file and is divided into multiple sections containing multiple
 * fields each.
 *
 * It serves as main entry point into the `LuCI.form` for typical view code.
 *
 * @param {string} config
 * The UCI configuration to map. It is automatically loaded along when the
 * resulting map instance.
 *
 * @param {string} [title]
 * The title caption of the form. A form title is usually rendered as separate
 * headline element before the actual form contents. If omitted, the
 * corresponding headline element will not be rendered.
 *
 * @param {string} [description]
 * The description text of the form which is usually rendered as text
 * paragraph below the form title and before the actual form contents.
 * If omitted, the corresponding paragraph element will not be rendered.
 */
var CBIMap = CBIAbstractElement.extend(/** @lends LuCI.form.Map.prototype */ {
	__init__: function(config /*, ... */) {
		this.super('__init__', this.varargs(arguments, 1));

		this.config = config;
		this.parsechain = [ config ];
		this.data = uci;
	},

	/**
	 * Toggle readonly state of the form.
	 *
	 * If set to `true`, the Map instance is marked readonly and any form
	 * option elements added to it will inherit the readonly state.
	 *
	 * If left unset, the Map will test the access permission of the primary
	 * uci configuration upon loading and mark the form readonly if no write
	 * permissions are granted.
	 *
	 * @name LuCI.form.Map.prototype#readonly
	 * @type boolean
	 */

	/**
	 * Find all DOM nodes within this Map which match the given search
	 * parameters. This function is essentially a convenience wrapper around
	 * `querySelectorAll()`.
	 *
	 * This function is sensitive to the amount of arguments passed to it;
	 * if only one argument is specified, it is used as selector-expression
	 * as-is. When two arguments are passed, the first argument is treated
	 * as attribute name, the second one as attribute value to match.
	 *
	 * As an example, `map.findElements('input')` would find all `<input>`
	 * nodes while `map.findElements('type', 'text')` would find any DOM node
	 * with a `type="text"` attribute.
	 *
	 * @param {string} selector_or_attrname
	 * If invoked with only one parameter, this argument is a
	 * `querySelectorAll()` compatible selector expression. If invoked with
	 * two parameters, this argument is the attribute name to filter for.
	 *
	 * @param {string} [attrvalue]
	 * In case the function is invoked with two parameters, this argument
	 * specifies the attribute value to match.
	 *
	 * @throws {InternalError}
	 * Throws an `InternalError` if more than two function parameters are
	 * passed.
	 *
	 * @returns {NodeList}
	 * Returns a (possibly empty) DOM `NodeList` containing the found DOM nodes.
	 */
	findElements: function(/* ... */) {
		var q = null;

		if (arguments.length == 1)
			q = arguments[0];
		else if (arguments.length == 2)
			q = '[%s="%s"]'.format(arguments[0], arguments[1]);
		else
			L.error('InternalError', 'Expecting one or two arguments to findElements()');

		return this.root.querySelectorAll(q);
	},

	/**
	 * Find the first DOM node within this Map which matches the given search
	 * parameters. This function is essentially a convenience wrapper around
	 * `findElements()` which only returns the first found node.
	 *
	 * This function is sensitive to the amount of arguments passed to it;
	 * if only one argument is specified, it is used as selector-expression
	 * as-is. When two arguments are passed, the first argument is treated
	 * as attribute name, the second one as attribute value to match.
	 *
	 * As an example, `map.findElement('input')` would find the first `<input>`
	 * node while `map.findElement('type', 'text')` would find the first DOM
	 * node with a `type="text"` attribute.
	 *
	 * @param {string} selector_or_attrname
	 * If invoked with only one parameter, this argument is a `querySelector()`
	 * compatible selector expression. If invoked with two parameters, this
	 * argument is the attribute name to filter for.
	 *
	 * @param {string} [attrvalue]
	 * In case the function is invoked with two parameters, this argument
	 * specifies the attribute value to match.
	 *
	 * @throws {InternalError}
	 * Throws an `InternalError` if more than two function parameters are
	 * passed.
	 *
	 * @returns {Node|null}
	 * Returns the first found DOM node or `null` if no element matched.
	 */
	findElement: function(/* ... */) {
		var res = this.findElements.apply(this, arguments);
		return res.length ? res[0] : null;
	},

	/**
	 * Tie another UCI configuration to the map.
	 *
	 * By default, a map instance will only load the UCI configuration file
	 * specified in the constructor but sometimes access to values from
	 * further configuration files is required. This function allows for such
	 * use cases by registering further UCI configuration files which are
	 * needed by the map.
	 *
	 * @param {string} config
	 * The additional UCI configuration file to tie to the map. If the given
	 * config already is in the list of required files, it will be ignored.
	 */
	chain: function(config) {
		if (this.parsechain.indexOf(config) == -1)
			this.parsechain.push(config);
	},

	/**
	 * Add a configuration section to the map.
	 *
	 * LuCI forms follow the structure of the underlying UCI configurations,
	 * means that a map, which represents a single UCI configuration, is
	 * divided into multiple sections which in turn contain an arbitrary
	 * number of options.
	 *
	 * While UCI itself only knows two kinds of sections - named and anonymous
	 * ones - the form class offers various flavors of form section elements
	 * to present configuration sections in different ways. Refer to the
	 * documentation of the different section classes for details.
	 *
	 * @param {LuCI.form.AbstractSection} sectionclass
	 * The section class to use for rendering the configuration section.
	 * Note that this value must be the class itself, not a class instance
	 * obtained from calling `new`. It must also be a class derived from
	 * `LuCI.form.AbstractSection`.
	 *
	 * @param {...string} classargs
	 * Additional arguments which are passed as-is to the constructor of the
	 * given section class. Refer to the class specific constructor
	 * documentation for details.
	 *
	 * @returns {LuCI.form.AbstractSection}
	 * Returns the instantiated section class instance.
	 */
	section: function(cbiClass /*, ... */) {
		if (!CBIAbstractSection.isSubclass(cbiClass))
			L.error('TypeError', 'Class must be a descendent of CBIAbstractSection');

		var obj = cbiClass.instantiate(this.varargs(arguments, 1, this));
		this.append(obj);
		return obj;
	},

	/**
	 * Load the configuration covered by this map.
	 *
	 * The `load()` function first loads all referenced UCI configurations,
	 * then it recursively walks the form element tree and invokes the
	 * load function of each child element.
	 *
	 * @returns {Promise<void>}
	 * Returns a promise resolving once the entire form completed loading all
	 * data. The promise may reject with an error if any configuration failed
	 * to load or if any of the child elements load functions rejected with
	 * an error.
	 */
	load: function() {
		var doCheckACL = (!(this instanceof CBIJSONMap) && this.readonly == null),
		    loadTasks = [ doCheckACL ? callSessionAccess('uci', this.config, 'write') : true ],
		    configs = this.parsechain || [ this.config ];

		loadTasks.push.apply(loadTasks, configs.map(L.bind(function(config, i) {
			return i ? L.resolveDefault(this.data.load(config)) : this.data.load(config);
		}, this)));

		return Promise.all(loadTasks).then(L.bind(function(res) {
			if (res[0] === false)
				this.readonly = true;

			return this.loadChildren();
		}, this));
	},

	/**
	 * Parse the form input values.
	 *
	 * The `parse()` function recursively walks the form element tree and
	 * triggers input value reading and validation for each child element.
	 *
	 * Elements which are hidden due to unsatisfied dependencies are skipped.
	 *
	 * @returns {Promise<void>}
	 * Returns a promise resolving once the entire form completed parsing all
	 * input values. The returned promise is rejected if any parsed values are
	 * not meeting the validation constraints of their respective elements.
	 */
	parse: function() {
		var tasks = [];

		if (Array.isArray(this.children))
			for (var i = 0; i < this.children.length; i++)
				tasks.push(this.children[i].parse());

		return Promise.all(tasks);
	},

	/**
	 * Save the form input values.
	 *
	 * This function parses the current form, saves the resulting UCI changes,
	 * reloads the UCI configuration data and redraws the form elements.
	 *
	 * @param {function} [cb]
	 * An optional callback function that is invoked after the form is parsed
	 * but before the changed UCI data is saved. This is useful to perform
	 * additional data manipulation steps before saving the changes.
	 *
	 * @param {boolean} [silent=false]
	 * If set to `true`, trigger an alert message to the user in case saving
	 * the form data failures. Otherwise fail silently.
	 *
	 * @returns {Promise<void>}
	 * Returns a promise resolving once the entire save operation is complete.
	 * The returned promise is rejected if any step of the save operation
	 * failed.
	 */
	save: function(cb, silent) {
		this.checkDepends();

		return this.parse()
			.then(cb)
			.then(this.data.save.bind(this.data))
			.then(this.load.bind(this))
			.catch(function(e) {
				if (!silent) {
					ui.showModal(_('Save error'), [
						E('p', {}, [ _('An error occurred while saving the form:') ]),
						E('p', {}, [ E('em', { 'style': 'white-space:pre-wrap' }, [ e.message ]) ]),
						E('div', { 'class': 'right' }, [
							E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, [ _('Dismiss') ])
						])
					]);
				}

				return Promise.reject(e);
			}).then(this.renderContents.bind(this));
	},

	/**
	 * Reset the form by re-rendering its contents. This will revert all
	 * unsaved user inputs to their initial form state.
	 *
	 * @returns {Promise<Node>}
	 * Returns a promise resolving to the toplevel form DOM node once the
	 * re-rendering is complete.
	 */
	reset: function() {
		return this.renderContents();
	},

	/**
	 * Render the form markup.
	 *
	 * @returns {Promise<Node>}
	 * Returns a promise resolving to the toplevel form DOM node once the
	 * rendering is complete.
	 */
	render: function() {
		return this.load().then(this.renderContents.bind(this));
	},

	/** @private */
	renderContents: function() {
		var mapEl = this.root || (this.root = E('div', {
			'id': 'cbi-%s'.format(this.config),
			'class': 'cbi-map',
			'cbi-dependency-check': L.bind(this.checkDepends, this)
		}));

		dom.bindClassInstance(mapEl, this);

		return this.renderChildren(null).then(L.bind(function(nodes) {
			var initialRender = !mapEl.firstChild;

			dom.content(mapEl, null);

			if (this.title != null && this.title != '')
				mapEl.appendChild(E('h2', { 'name': 'content' }, this.title));

			if (this.description != null && this.description != '')
				mapEl.appendChild(E('div', { 'class': 'cbi-map-descr' }, this.description));

			if (this.tabbed)
				dom.append(mapEl, E('div', { 'class': 'cbi-map-tabbed' }, nodes));
			else
				dom.append(mapEl, nodes);

			if (!initialRender) {
				mapEl.classList.remove('flash');

				window.setTimeout(function() {
					mapEl.classList.add('flash');
				}, 1);
			}

			this.checkDepends();

			var tabGroups = mapEl.querySelectorAll('.cbi-map-tabbed, .cbi-section-node-tabbed');

			for (var i = 0; i < tabGroups.length; i++)
				ui.tabs.initTabGroup(tabGroups[i].childNodes);

			return mapEl;
		}, this));
	},

	/**
	 * Find a form option element instance.
	 *
	 * @param {string} name
	 * The name or the full ID of the option element to look up.
	 *
	 * @param {string} [section_id]
	 * The ID of the UCI section containing the option to look up. May be
	 * omitted if a full ID is passed as first argument.
	 *
	 * @param {string} [config_name]
	 * The name of the UCI configuration the option instance belongs to.
	 * Defaults to the main UCI configuration of the map if omitted.
	 *
	 * @returns {Array<LuCI.form.AbstractValue,string>|null}
	 * Returns a two-element array containing the form option instance as
	 * first item and the corresponding UCI section ID as second item.
	 * Returns `null` if the option could not be found.
	 */
	lookupOption: function(name, section_id, config_name) {
		var id, elem, sid, inst;

		if (name.indexOf('.') > -1)
			id = 'cbid.%s'.format(name);
		else
			id = 'cbid.%s.%s.%s'.format(config_name || this.config, section_id, name);

		elem = this.findElement('data-field', id);
		sid  = elem ? id.split(/\./)[2] : null;
		inst = elem ? dom.findClassInstance(elem) : null;

		return (inst instanceof CBIAbstractValue) ? [ inst, sid ] : null;
	},

	/** @private */
	checkDepends: function(ev, n) {
		var changed = false;

		for (var i = 0, s = this.children[0]; (s = this.children[i]) != null; i++)
			if (s.checkDepends(ev, n))
				changed = true;

		if (changed && (n || 0) < 10)
			this.checkDepends(ev, (n || 10) + 1);

		ui.tabs.updateTabs(ev, this.root);
	},

	/** @private */
	isDependencySatisfied: function(depends, config_name, section_id) {
		var def = false;

		if (!Array.isArray(depends) || !depends.length)
			return true;

		for (var i = 0; i < depends.length; i++) {
			var istat = true,
			    reverse = depends[i]['!reverse'],
			    contains = depends[i]['!contains'];

			for (var dep in depends[i]) {
				if (dep == '!reverse' || dep == '!contains') {
					continue;
				}
				else if (dep == '!default') {
					def = true;
					istat = false;
				}
				else {
					var res = this.lookupOption(dep, section_id, config_name),
					    val = (res && res[0].isActive(res[1])) ? res[0].formvalue(res[1]) : null;

					var equal = contains
						? isContained(val, depends[i][dep])
						: isEqual(val, depends[i][dep]);

					istat = (istat && equal);
				}
			}

			if (istat ^ reverse)
				return true;
		}

		return def;
	}
});

/**
 * @constructor JSONMap
 * @memberof LuCI.form
 * @augments LuCI.form.Map
 *
 * @classdesc
 *
 * A `JSONMap` class functions similar to [LuCI.form.Map]{@link LuCI.form.Map}
 * but uses a multidimensional JavaScript object instead of UCI configuration
 * as data source.
 *
 * @param {Object<string, Object<string, *>|Array<Object<string, *>>>} data
 * The JavaScript object to use as data source. Internally, the object is
 * converted into an UCI-like format. Its toplevel keys are treated like UCI
 * section types while the object or array-of-object values are treated as
 * section contents.
 *
 * @param {string} [title]
 * The title caption of the form. A form title is usually rendered as separate
 * headline element before the actual form contents. If omitted, the
 * corresponding headline element will not be rendered.
 *
 * @param {string} [description]
 * The description text of the form which is usually rendered as text
 * paragraph below the form title and before the actual form contents.
 * If omitted, the corresponding paragraph element will not be rendered.
 */
var CBIJSONMap = CBIMap.extend(/** @lends LuCI.form.JSONMap.prototype */ {
	__init__: function(data /*, ... */) {
		this.super('__init__', this.varargs(arguments, 1, 'json'));

		this.config = 'json';
		this.parsechain = [ 'json' ];
		this.data = new CBIJSONConfig(data);
	}
});

/**
 * @class AbstractSection
 * @memberof LuCI.form
 * @augments LuCI.form.AbstractElement
 * @hideconstructor
 * @classdesc
 *
 * The `AbstractSection` class serves as abstract base for the different form
 * section styles implemented by `LuCI.form`. It provides the common logic for
 * enumerating underlying configuration section instances, for registering
 * form options and for handling tabs to segment child options.
 *
 * This class is private and not directly accessible by user code.
 */
var CBIAbstractSection = CBIAbstractElement.extend(/** @lends LuCI.form.AbstractSection.prototype */ {
	__init__: function(map, sectionType /*, ... */) {
		this.super('__init__', this.varargs(arguments, 2));

		this.sectiontype = sectionType;
		this.map = map;
		this.config = map.config;

		this.optional = true;
		this.addremove = false;
		this.dynamic = false;
	},

	/**
	 * Access the parent option container instance.
	 *
	 * In case this section is nested within an option element container,
	 * this property will hold a reference to the parent option instance.
	 *
	 * If this section is not nested, the property is `null`.
	 *
	 * @name LuCI.form.AbstractSection.prototype#parentoption
	 * @type LuCI.form.AbstractValue
	 * @readonly
	 */

	/**
	 * Enumerate the UCI section IDs covered by this form section element.
	 *
	 * @abstract
	 * @throws {InternalError}
	 * Throws an `InternalError` exception if the function is not implemented.
	 *
	 * @returns {string[]}
	 * Returns an array of UCI section IDs covered by this form element.
	 * The sections will be rendered in the same order as the returned array.
	 */
	cfgsections: function() {
		L.error('InternalError', 'Not implemented');
	},

	/**
	 * Filter UCI section IDs to render.
	 *
	 * The filter function is invoked for each UCI section ID of a given type
	 * and controls whether the given UCI section is rendered or ignored by
	 * the form section element.
	 *
	 * The default implementation always returns `true`. User code or
	 * classes extending `AbstractSection` may overwrite this function with
	 * custom implementations.
	 *
	 * @abstract
	 * @param {string} section_id
	 * The UCI section ID to test.
	 *
	 * @returns {boolean}
	 * Returns `true` when the given UCI section ID should be handled and
	 * `false` when it should be ignored.
	 */
	filter: function(section_id) {
		return true;
	},

	/**
	 * Load the configuration covered by this section.
	 *
	 * The `load()` function recursively walks the section element tree and
	 * invokes the load function of each child option element.
	 *
	 * @returns {Promise<void>}
	 * Returns a promise resolving once the values of all child elements have
	 * been loaded. The promise may reject with an error if any of the child
	 * elements load functions rejected with an error.
	 */
	load: function() {
		var section_ids = this.cfgsections(),
		    tasks = [];

		if (Array.isArray(this.children))
			for (var i = 0; i < section_ids.length; i++)
				tasks.push(this.loadChildren(section_ids[i])
					.then(Function.prototype.bind.call(function(section_id, set_values) {
						for (var i = 0; i < set_values.length; i++)
							this.children[i].cfgvalue(section_id, set_values[i]);
					}, this, section_ids[i])));

		return Promise.all(tasks);
	},

	/**
	 * Parse this sections form input.
	 *
	 * The `parse()` function recursively walks the section element tree and
	 * triggers input value reading and validation for each encountered child
	 * option element.
	 *
	 * Options which are hidden due to unsatisfied dependencies are skipped.
	 *
	 * @returns {Promise<void>}
	 * Returns a promise resolving once the values of all child elements have
	 * been parsed. The returned promise is rejected if any parsed values are
	 * not meeting the validation constraints of their respective elements.
	 */
	parse: function() {
		var section_ids = this.cfgsections(),
		    tasks = [];

		if (Array.isArray(this.children))
			for (var i = 0; i < section_ids.length; i++)
				for (var j = 0; j < this.children.length; j++)
					tasks.push(this.children[j].parse(section_ids[i]));

		return Promise.all(tasks);
	},

	/**
	 * Add an option tab to the section.
	 *
	 * The child option elements of a section may be divided into multiple
	 * tabs to provide a better overview to the user.
	 *
	 * Before options can be moved into a tab pane, the corresponding tab
	 * has to be defined first, which is done by calling this function.
	 *
	 * Note that once tabs are defined, user code must use the `taboption()`
	 * method to add options to specific tabs. Option elements added by
	 * `option()` will not be assigned to any tab and not be rendered in this
	 * case.
	 *
	 * @param {string} name
	 * The name of the tab to register. It may be freely chosen and just serves
	 * as an identifier to differentiate tabs.
	 *
	 * @param {string} title
	 * The human readable caption of the tab.
	 *
	 * @param {string} [description]
	 * An additional description text for the corresponding tab pane. It is
	 * displayed as text paragraph below the tab but before the tab pane
	 * contents. If omitted, no description will be rendered.
	 *
	 * @throws {Error}
	 * Throws an exception if a tab with the same `name` already exists.
	 */
	tab: function(name, title, description) {
		if (this.tabs && this.tabs[name])
			throw 'Tab already declared';

		var entry = {
			name: name,
			title: title,
			description: description,
			children: []
		};

		this.tabs = this.tabs || [];
		this.tabs.push(entry);
		this.tabs[name] = entry;

		this.tab_names = this.tab_names || [];
		this.tab_names.push(name);
	},

	/**
	 * Add a configuration option widget to the section.
	 *
	 * Note that [taboption()]{@link LuCI.form.AbstractSection#taboption}
	 * should be used instead if this form section element uses tabs.
	 *
	 * @param {LuCI.form.AbstractValue} optionclass
	 * The option class to use for rendering the configuration option. Note
	 * that this value must be the class itself, not a class instance obtained
	 * from calling `new`. It must also be a class derived from
	 * [LuCI.form.AbstractSection]{@link LuCI.form.AbstractSection}.
	 *
	 * @param {...*} classargs
	 * Additional arguments which are passed as-is to the constructor of the
	 * given option class. Refer to the class specific constructor
	 * documentation for details.
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception in case the passed class value is not a
	 * descendant of `AbstractValue`.
	 *
	 * @returns {LuCI.form.AbstractValue}
	 * Returns the instantiated option class instance.
	 */
	option: function(cbiClass /*, ... */) {
		if (!CBIAbstractValue.isSubclass(cbiClass))
			throw L.error('TypeError', 'Class must be a descendant of CBIAbstractValue');

		var obj = cbiClass.instantiate(this.varargs(arguments, 1, this.map, this));
		this.append(obj);
		return obj;
	},

	/**
	 * Add a configuration option widget to a tab of the section.
	 *
	 * @param {string} tabName
	 * The name of the section tab to add the option element to.
	 *
	 * @param {LuCI.form.AbstractValue} optionclass
	 * The option class to use for rendering the configuration option. Note
	 * that this value must be the class itself, not a class instance obtained
	 * from calling `new`. It must also be a class derived from
	 * [LuCI.form.AbstractSection]{@link LuCI.form.AbstractSection}.
	 *
	 * @param {...*} classargs
	 * Additional arguments which are passed as-is to the constructor of the
	 * given option class. Refer to the class specific constructor
	 * documentation for details.
	 *
	 * @throws {ReferenceError}
	 * Throws a `ReferenceError` exception when the given tab name does not
	 * exist.
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception in case the passed class value is not a
	 * descendant of `AbstractValue`.
	 *
	 * @returns {LuCI.form.AbstractValue}
	 * Returns the instantiated option class instance.
	 */
	taboption: function(tabName /*, ... */) {
		if (!this.tabs || !this.tabs[tabName])
			throw L.error('ReferenceError', 'Associated tab not declared');

		var obj = this.option.apply(this, this.varargs(arguments, 1));
		obj.tab = tabName;
		this.tabs[tabName].children.push(obj);
		return obj;
	},

	/**
	 * Query underlying option configuration values.
	 *
	 * This function is sensitive to the amount of arguments passed to it;
	 * if only one argument is specified, the configuration values of all
	 * options within this section are returned as dictionary.
	 *
	 * If both the section ID and an option name are supplied, this function
	 * returns the configuration value of the specified option only.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @param {string} [option]
	 * The name of the option to query
	 *
	 * @returns {null|string|string[]|Object<string, null|string|string[]>}
	 * Returns either a dictionary of option names and their corresponding
	 * configuration values or just a single configuration value, depending
	 * on the amount of passed arguments.
	 */
	cfgvalue: function(section_id, option) {
		var rv = (arguments.length == 1) ? {} : null;

		for (var i = 0, o; (o = this.children[i]) != null; i++)
			if (rv)
				rv[o.option] = o.cfgvalue(section_id);
			else if (o.option == option)
				return o.cfgvalue(section_id);

		return rv;
	},

	/**
	 * Query underlying option widget input values.
	 *
	 * This function is sensitive to the amount of arguments passed to it;
	 * if only one argument is specified, the widget input values of all
	 * options within this section are returned as dictionary.
	 *
	 * If both the section ID and an option name are supplied, this function
	 * returns the widget input value of the specified option only.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @param {string} [option]
	 * The name of the option to query
	 *
	 * @returns {null|string|string[]|Object<string, null|string|string[]>}
	 * Returns either a dictionary of option names and their corresponding
	 * widget input values or just a single widget input value, depending
	 * on the amount of passed arguments.
	 */
	formvalue: function(section_id, option) {
		var rv = (arguments.length == 1) ? {} : null;

		for (var i = 0, o; (o = this.children[i]) != null; i++) {
			var func = this.map.root ? this.children[i].formvalue : this.children[i].cfgvalue;

			if (rv)
				rv[o.option] = func.call(o, section_id);
			else if (o.option == option)
				return func.call(o, section_id);
		}

		return rv;
	},

	/**
	 * Obtain underlying option LuCI.ui widget instances.
	 *
	 * This function is sensitive to the amount of arguments passed to it;
	 * if only one argument is specified, the LuCI.ui widget instances of all
	 * options within this section are returned as dictionary.
	 *
	 * If both the section ID and an option name are supplied, this function
	 * returns the LuCI.ui widget instance value of the specified option only.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @param {string} [option]
	 * The name of the option to query
	 *
	 * @returns {null|LuCI.ui.AbstractElement|Object<string, null|LuCI.ui.AbstractElement>}
	 * Returns either a dictionary of option names and their corresponding
	 * widget input values or just a single widget input value, depending
	 * on the amount of passed arguments.
	 */
	getUIElement: function(section_id, option) {
		var rv = (arguments.length == 1) ? {} : null;

		for (var i = 0, o; (o = this.children[i]) != null; i++)
			if (rv)
				rv[o.option] = o.getUIElement(section_id);
			else if (o.option == option)
				return o.getUIElement(section_id);

		return rv;
	},

	/**
	 * Obtain underlying option objects.
	 *
	 * This function is sensitive to the amount of arguments passed to it;
	 * if no option name is specified, all options within this section are
	 * returned as dictionary.
	 *
	 * If an option name is supplied, this function returns the matching
	 * LuCI.form.AbstractValue instance only.
	 *
	 * @param {string} [option]
	 * The name of the option object to obtain
	 *
	 * @returns {null|LuCI.form.AbstractValue|Object<string, LuCI.form.AbstractValue>}
	 * Returns either a dictionary of option names and their corresponding
	 * option instance objects or just a single object instance value,
	 * depending on the amount of passed arguments.
	 */
	getOption: function(option) {
		var rv = (arguments.length == 0) ? {} : null;

		for (var i = 0, o; (o = this.children[i]) != null; i++)
			if (rv)
				rv[o.option] = o;
			else if (o.option == option)
				return o;

		return rv;
	},

	/** @private */
	renderUCISection: function(section_id) {
		var renderTasks = [];

		if (!this.tabs)
			return this.renderOptions(null, section_id);

		for (var i = 0; i < this.tab_names.length; i++)
			renderTasks.push(this.renderOptions(this.tab_names[i], section_id));

		return Promise.all(renderTasks)
			.then(this.renderTabContainers.bind(this, section_id));
	},

	/** @private */
	renderTabContainers: function(section_id, nodes) {
		var config_name = this.uciconfig || this.map.config,
		    containerEls = E([]);

		for (var i = 0; i < nodes.length; i++) {
			var tab_name = this.tab_names[i],
			    tab_data = this.tabs[tab_name],
			    containerEl = E('div', {
			    	'id': 'container.%s.%s.%s'.format(config_name, section_id, tab_name),
			    	'data-tab': tab_name,
			    	'data-tab-title': tab_data.title,
			    	'data-tab-active': tab_name === this.selected_tab
			    });

			if (tab_data.description != null && tab_data.description != '')
				containerEl.appendChild(
					E('div', { 'class': 'cbi-tab-descr' }, tab_data.description));

			containerEl.appendChild(nodes[i]);
			containerEls.appendChild(containerEl);
		}

		return containerEls;
	},

	/** @private */
	renderOptions: function(tab_name, section_id) {
		var in_table = (this instanceof CBITableSection);
		return this.renderChildren(tab_name, section_id, in_table).then(function(nodes) {
			var optionEls = E([]);
			for (var i = 0; i < nodes.length; i++)
				optionEls.appendChild(nodes[i]);
			return optionEls;
		});
	},

	/** @private */
	checkDepends: function(ev, n) {
		var changed = false,
		    sids = this.cfgsections();

		for (var i = 0, sid = sids[0]; (sid = sids[i]) != null; i++) {
			for (var j = 0, o = this.children[0]; (o = this.children[j]) != null; j++) {
				var isActive = o.isActive(sid),
				    isSatisified = o.checkDepends(sid);

				if (isActive != isSatisified) {
					o.setActive(sid, !isActive);
					isActive = !isActive;
					changed = true;
				}

				if (!n && isActive)
					o.triggerValidation(sid);
			}
		}

		return changed;
	}
});


var isEqual = function(x, y) {
	if (typeof(y) == 'object' && y instanceof RegExp)
		return (x == null) ? false : y.test(x);

	if (x != null && y != null && typeof(x) != typeof(y))
		return false;

	if ((x == null && y != null) || (x != null && y == null))
		return false;

	if (Array.isArray(x)) {
		if (x.length != y.length)
			return false;

		for (var i = 0; i < x.length; i++)
			if (!isEqual(x[i], y[i]))
				return false;
	}
	else if (typeof(x) == 'object') {
		for (var k in x) {
			if (x.hasOwnProperty(k) && !y.hasOwnProperty(k))
				return false;

			if (!isEqual(x[k], y[k]))
				return false;
		}

		for (var k in y)
			if (y.hasOwnProperty(k) && !x.hasOwnProperty(k))
				return false;
	}
	else if (x != y) {
		return false;
	}

	return true;
};

var isContained = function(x, y) {
	if (Array.isArray(x)) {
		for (var i = 0; i < x.length; i++)
			if (x[i] == y)
				return true;
	}
	else if (L.isObject(x)) {
		if (x.hasOwnProperty(y) && x[y] != null)
			return true;
	}
	else if (typeof(x) == 'string') {
		return (x.indexOf(y) > -1);
	}

	return false;
};

/**
 * @class AbstractValue
 * @memberof LuCI.form
 * @augments LuCI.form.AbstractElement
 * @hideconstructor
 * @classdesc
 *
 * The `AbstractValue` class serves as abstract base for the different form
 * option styles implemented by `LuCI.form`. It provides the common logic for
 * handling option input values, for dependencies among options and for
 * validation constraints that should be applied to entered values.
 *
 * This class is private and not directly accessible by user code.
 */
var CBIAbstractValue = CBIAbstractElement.extend(/** @lends LuCI.form.AbstractValue.prototype */ {
	__init__: function(map, section, option /*, ... */) {
		this.super('__init__', this.varargs(arguments, 3));

		this.section = section;
		this.option = option;
		this.map = map;
		this.config = map.config;

		this.deps = [];
		this.initial = {};
		this.rmempty = true;
		this.default = null;
		this.size = null;
		this.optional = false;
		this.retain = false;
	},

	/**
	 * If set to `false`, the underlying option value is retained upon saving
	 * the form when the option element is disabled due to unsatisfied
	 * dependency constraints.
	 *
	 * @name LuCI.form.AbstractValue.prototype#rmempty
	 * @type boolean
	 * @default true
	 */

	/**
	 * If set to `true`, the underlying ui input widget is allowed to be empty,
	 * otherwise the option element is marked invalid when no value is entered
	 * or selected by the user.
	 *
	 * @name LuCI.form.AbstractValue.prototype#optional
	 * @type boolean
	 * @default false
	 */

	/**
	 * If set to `true`, the underlying ui input widget value is not cleared
	 * from the configuration on unsatisfied dependencies. The default behavior
	 * is to remove the values of all options whose dependencies are not
	 * fulfilled.
	 *
	 * @name LuCI.form.AbstractValue.prototype#retain
	 * @type boolean
	 * @default false
	 */

	/**
	 * Sets a default value to use when the underlying UCI option is not set.
	 *
	 * @name LuCI.form.AbstractValue.prototype#default
	 * @type *
	 * @default null
	 */

	/**
	 * Specifies a datatype constraint expression to validate input values
	 * against. Refer to {@link LuCI.validation} for details on the format.
	 *
	 * If the user entered input does not match the datatype validation, the
	 * option element is marked as invalid.
	 *
	 * @name LuCI.form.AbstractValue.prototype#datatype
	 * @type string
	 * @default null
	 */

	/**
	 * Specifies a custom validation function to test the user input for
	 * validity. The validation function must return `true` to accept the
	 * value. Any other return value type is converted to a string and
	 * displayed to the user as validation error message.
	 *
	 * If the user entered input does not pass the validation function, the
	 * option element is marked as invalid.
	 *
	 * @name LuCI.form.AbstractValue.prototype#validate
	 * @type function
	 * @default null
	 */

	/**
	 * Override the UCI configuration name to read the option value from.
	 *
	 * By default, the configuration name is inherited from the parent Map.
	 * By setting this property, a deviating configuration may be specified.
	 *
	 * The default is null, means inheriting from the parent form.
	 *
	 * @name LuCI.form.AbstractValue.prototype#uciconfig
	 * @type string
	 * @default null
	 */

	/**
	 * Override the UCI section name to read the option value from.
	 *
	 * By default, the section ID is inherited from the parent section element.
	 * By setting this property, a deviating section may be specified.
	 *
	 * The default is null, means inheriting from the parent section.
	 *
	 * @name LuCI.form.AbstractValue.prototype#ucisection
	 * @type string
	 * @default null
	 */

	/**
	 * Override the UCI option name to read the value from.
	 *
	 * By default, the elements name, which is passed as third argument to
	 * the constructor, is used as UCI option name. By setting this property,
	 * a deviating UCI option may be specified.
	 *
	 * The default is null, means using the option element name.
	 *
	 * @name LuCI.form.AbstractValue.prototype#ucioption
	 * @type string
	 * @default null
	 */

	/**
	 * Mark grid section option element as editable.
	 *
	 * Options which are displayed in the table portion of a `GridSection`
	 * instance are rendered as readonly text by default. By setting the
	 * `editable` property of a child option element to `true`, that element
	 * is rendered as full input widget within its cell instead of a text only
	 * preview.
	 *
	 * This property has no effect on options that are not children of grid
	 * section elements.
	 *
	 * @name LuCI.form.AbstractValue.prototype#editable
	 * @type boolean
	 * @default false
	 */

	/**
	 * Move grid section option element into the table, the modal popup or both.
	 *
	 * If this property is `null` (the default), the option element is
	 * displayed in both the table preview area and the per-section instance
	 * modal popup of a grid section. When it is set to `false` the option
	 * is only shown in the table but not the modal popup. When set to `true`,
	 * the option is only visible in the modal popup but not the table.
	 *
	 * This property has no effect on options that are not children of grid
	 * section elements.
	 *
	 * @name LuCI.form.AbstractValue.prototype#modalonly
	 * @type boolean
	 * @default null
	 */

	/**
	 * Make option element readonly.
	 *
	 * This property defaults to the readonly state of the parent form element.
	 * When set to `true`, the underlying widget is rendered in disabled state,
	 * means its contents cannot be changed and the widget cannot be interacted
	 * with.
	 *
	 * @name LuCI.form.AbstractValue.prototype#readonly
	 * @type boolean
	 * @default false
	 */

	/**
	 * Override the cell width of a table or grid section child option.
	 *
	 * If the property is set to a numeric value, it is treated as pixel width
	 * which is set on the containing cell element of the option, essentially
	 * forcing a certain column width. When the property is set to a string
	 * value, it is applied as-is to the CSS `width` property.
	 *
	 * This property has no effect on options that are not children of grid or
	 * table section elements.
	 *
	 * @name LuCI.form.AbstractValue.prototype#width
	 * @type number|string
	 * @default null
	 */

	/**
	 * Register a custom value change handler.
	 *
	 * If this property is set to a function value, the function is invoked
	 * whenever the value of the underlying UI input element is changing.
	 *
	 * The invoked handler function will receive the DOM click element as
	 * first and the underlying configuration section ID as well as the input
	 * value as second and third argument respectively.
	 *
	 * @name LuCI.form.AbstractValue.prototype#onchange
	 * @type function
	 * @default null
	 */

	/**
	 * Add a dependency constraint to the option.
	 *
	 * Dependency constraints allow making the presence of option elements
	 * dependent on the current values of certain other options within the
	 * same form. An option element with unsatisfied dependencies will be
	 * hidden from the view and its current value is omitted when saving.
	 *
	 * Multiple constraints (that is, multiple calls to `depends()`) are
	 * treated as alternatives, forming a logical "or" expression.
	 *
	 * By passing an object of name => value pairs as first argument, it is
	 * possible to depend on multiple options simultaneously, allowing to form
	 * a logical "and" expression.
	 *
	 * Option names may be given in "dot notation" which allows to reference
	 * option elements outside the current form section. If a name without
	 * dot is specified, it refers to an option within the same configuration
	 * section. If specified as <code>configname.sectionid.optionname</code>,
	 * options anywhere within the same form may be specified.
	 *
	 * The object notation also allows for a number of special keys which are
	 * not treated as option names but as modifiers to influence the dependency
	 * constraint evaluation. The associated value of these special "tag" keys
	 * is ignored. The recognized tags are:
	 *
	 * <ul>
	 *   <li>
	 *    <code>!reverse</code><br>
	 *    Invert the dependency, instead of requiring another option to be
	 *    equal to the dependency value, that option should <em>not</em> be
	 *    equal.
	 *   </li>
	 *   <li>
	 *    <code>!contains</code><br>
	 *    Instead of requiring an exact match, the dependency is considered
	 *    satisfied when the dependency value is contained within the option
	 *    value.
	 *   </li>
	 *   <li>
	 *    <code>!default</code><br>
	 *    The dependency is always satisfied
	 *   </li>
	 * </ul>
	 *
	 * Examples:
	 *
	 * <ul>
	 *  <li>
	 *   <code>opt.depends("foo", "test")</code><br>
	 *   Require the value of `foo` to be `test`.
	 *  </li>
	 *  <li>
	 *   <code>opt.depends({ foo: "test" })</code><br>
	 *   Equivalent to the previous example.
	 *  </li>
	 *  <li>
	 *   <code>opt.depends({ foo: /test/ })</code><br>
	 *   Require the value of `foo` to match the regular expression `/test/`.
	 *  </li>
	 *  <li>
	 *   <code>opt.depends({ foo: "test", bar: "qrx" })</code><br>
	 *   Require the value of `foo` to be `test` and the value of `bar` to be
	 *   `qrx`.
	 *  </li>
	 *  <li>
	 *   <code>opt.depends({ foo: "test" })<br>
	 *         opt.depends({ bar: "qrx" })</code><br>
	 *   Require either <code>foo</code> to be set to <code>test</code>,
	 *   <em>or</em> the <code>bar</code> option to be <code>qrx</code>.
	 *  </li>
	 *  <li>
	 *   <code>opt.depends("test.section1.foo", "bar")</code><br>
	 *   Require the "foo" form option within the "section1" section to be
	 *   set to "bar".
	 *  </li>
	 *  <li>
	 *   <code>opt.depends({ foo: "test", "!contains": true })</code><br>
	 *   Require the "foo" option value to contain the substring "test".
	 *  </li>
	 * </ul>
	 *
	 * @param {string|Object<string, string|RegExp>} field
	 * The name of the option to depend on or an object describing multiple
	 * dependencies which must be satisfied (a logical "and" expression).
	 *
	 * @param {string|RegExp} value
	 * When invoked with a plain option name as first argument, this parameter
	 * specifies the expected value. In case an object is passed as first
	 * argument, this parameter is ignored.
	 */
	depends: function(field, value) {
		var deps;

		if (typeof(field) === 'string')
			deps = {}, deps[field] = value;
		else
			deps = field;

		this.deps.push(deps);
	},

	/** @private */
	transformDepList: function(section_id, deplist) {
		var list = deplist || this.deps,
		    deps = [];

		if (Array.isArray(list)) {
			for (var i = 0; i < list.length; i++) {
				var dep = {};

				for (var k in list[i]) {
					if (list[i].hasOwnProperty(k)) {
						if (k.charAt(0) === '!')
							dep[k] = list[i][k];
						else if (k.indexOf('.') !== -1)
							dep['cbid.%s'.format(k)] = list[i][k];
						else
							dep['cbid.%s.%s.%s'.format(
								this.uciconfig || this.section.uciconfig || this.map.config,
								this.ucisection || section_id,
								k
							)] = list[i][k];
					}
				}

				for (var k in dep) {
					if (dep.hasOwnProperty(k)) {
						deps.push(dep);
						break;
					}
				}
			}
		}

		return deps;
	},

	/** @private */
	transformChoices: function() {
		if (!Array.isArray(this.keylist) || this.keylist.length == 0)
			return null;

		var choices = {};

		for (var i = 0; i < this.keylist.length; i++)
			choices[this.keylist[i]] = this.vallist[i];

		return choices;
	},

	/** @private */
	checkDepends: function(section_id) {
		var config_name = this.uciconfig || this.section.uciconfig || this.map.config,
		    active = this.map.isDependencySatisfied(this.deps, config_name, section_id);

		if (active)
			this.updateDefaultValue(section_id);

		return active;
	},

	/** @private */
	updateDefaultValue: function(section_id) {
		if (!L.isObject(this.defaults))
			return;

		var config_name = this.uciconfig || this.section.uciconfig || this.map.config,
		    cfgvalue = L.toArray(this.cfgvalue(section_id))[0],
		    default_defval = null, satisified_defval = null;

		for (var value in this.defaults) {
			if (!this.defaults[value] || this.defaults[value].length == 0) {
				default_defval = value;
				continue;
			}
			else if (this.map.isDependencySatisfied(this.defaults[value], config_name, section_id)) {
				satisified_defval = value;
				break;
			}
		}

		if (satisified_defval == null)
			satisified_defval = default_defval;

		var node = this.map.findElement('id', this.cbid(section_id));
		if (node && node.getAttribute('data-changed') != 'true' && satisified_defval != null && cfgvalue == null)
			dom.callClassMethod(node, 'setValue', satisified_defval);

		this.default = satisified_defval;
	},

	/**
	 * Obtain the internal ID ("cbid") of the element instance.
	 *
	 * Since each form section element may map multiple underlying
	 * configuration sections, the configuration section ID is required to
	 * form a fully qualified ID pointing to the specific element instance
	 * within the given specific section.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception when no `section_id` was specified.
	 *
	 * @returns {string}
	 * Returns the element ID.
	 */
	cbid: function(section_id) {
		if (section_id == null)
			L.error('TypeError', 'Section ID required');

		return 'cbid.%s.%s.%s'.format(
			this.uciconfig || this.section.uciconfig || this.map.config,
			section_id, this.option);
	},

	/**
	 * Load the underlying configuration value.
	 *
	 * The default implementation of this method reads and returns the
	 * underlying UCI option value (or the related JavaScript property for
	 * `JSONMap` instances). It may be overwritten by user code to load data
	 * from nonstandard sources.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception when no `section_id` was specified.
	 *
	 * @returns {*|Promise<*>}
	 * Returns the configuration value to initialize the option element with.
	 * The return value of this function is filtered through `Promise.resolve()`
	 * so it may return promises if overridden by user code.
	 */
	load: function(section_id) {
		if (section_id == null)
			L.error('TypeError', 'Section ID required');

		return this.map.data.get(
			this.uciconfig || this.section.uciconfig || this.map.config,
			this.ucisection || section_id,
			this.ucioption || this.option);
	},

	/**
	 * Obtain the underlying `LuCI.ui` element instance.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception when no `section_id` was specified.
	 *
	 * @return {LuCI.ui.AbstractElement|null}
	 * Returns the `LuCI.ui` element instance or `null` in case the form
	 * option implementation does not use `LuCI.ui` widgets.
	 */
	getUIElement: function(section_id) {
		var node = this.map.findElement('id', this.cbid(section_id)),
		    inst = node ? dom.findClassInstance(node) : null;
		return (inst instanceof ui.AbstractElement) ? inst : null;
	},

	/**
	 * Query the underlying configuration value.
	 *
	 * The default implementation of this method returns the cached return
	 * value of [load()]{@link LuCI.form.AbstractValue#load}. It may be
	 * overwritten by user code to obtain the configuration value in a
	 * different way.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception when no `section_id` was specified.
	 *
	 * @returns {*}
	 * Returns the configuration value.
	 */
	cfgvalue: function(section_id, set_value) {
		if (section_id == null)
			L.error('TypeError', 'Section ID required');

		if (arguments.length == 2) {
			this.data = this.data || {};
			this.data[section_id] = set_value;
		}

		return this.data ? this.data[section_id] : null;
	},

	/**
	 * Query the current form input value.
	 *
	 * The default implementation of this method returns the current input
	 * value of the underlying [LuCI.ui]{@link LuCI.ui.AbstractElement} widget.
	 * It may be overwritten by user code to handle input values differently.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception when no `section_id` was specified.
	 *
	 * @returns {*}
	 * Returns the current input value.
	 */
	formvalue: function(section_id) {
		var elem = this.getUIElement(section_id);
		return elem ? elem.getValue() : null;
	},

	/**
	 * Obtain a textual input representation.
	 *
	 * The default implementation of this method returns the HTML escaped
	 * current input value of the underlying
	 * [LuCI.ui]{@link LuCI.ui.AbstractElement} widget. User code or specific
	 * option element implementations may overwrite this function to apply a
	 * different logic, e.g. to return `Yes` or `No` depending on the checked
	 * state of checkbox elements.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @throws {TypeError}
	 * Throws a `TypeError` exception when no `section_id` was specified.
	 *
	 * @returns {string}
	 * Returns the text representation of the current input value.
	 */
	textvalue: function(section_id) {
		var cval = this.cfgvalue(section_id);

		if (cval == null)
			cval = this.default;

		if (Array.isArray(cval))
			cval = cval.join(' ');

		return (cval != null) ? '%h'.format(cval) : null;
	},

	/**
	 * Apply custom validation logic.
	 *
	 * This method is invoked whenever incremental validation is performed on
	 * the user input, e.g. on keyup or blur events.
	 *
	 * The default implementation of this method does nothing and always
	 * returns `true`. User code may overwrite this method to provide
	 * additional validation logic which is not covered by data type
	 * constraints.
	 *
	 * @abstract
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @param {*} value
	 * The value to validate
	 *
	 * @returns {*}
	 * The method shall return `true` to accept the given value. Any other
	 * return value is treated as failure, converted to a string and displayed
	 * as error message to the user.
	 */
	validate: function(section_id, value) {
		return true;
	},

	/**
	 * Test whether the input value is currently valid.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @returns {boolean}
	 * Returns `true` if the input value currently is valid, otherwise it
	 * returns `false`.
	 */
	isValid: function(section_id) {
		var elem = this.getUIElement(section_id);
		return elem ? elem.isValid() : true;
	},

	/**
	 * Returns the current validation error for this input.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @returns {string}
	 * The validation error at this time
	 */
	getValidationError: function (section_id) {
		var elem = this.getUIElement(section_id);
		return elem ? elem.getValidationError() : '';
	},

	/**
	 * Test whether the option element is currently active.
	 *
	 * An element is active when it is not hidden due to unsatisfied dependency
	 * constraints.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @returns {boolean}
	 * Returns `true` if the option element currently is active, otherwise it
	 * returns `false`.
	 */
	isActive: function(section_id) {
		var field = this.map.findElement('data-field', this.cbid(section_id));
		return (field != null && !field.classList.contains('hidden'));
	},

	/** @private */
	setActive: function(section_id, active) {
		var field = this.map.findElement('data-field', this.cbid(section_id));

		if (field && field.classList.contains('hidden') == active) {
			field.classList[active ? 'remove' : 'add']('hidden');

			if (dom.matches(field.parentNode, '.td.cbi-value-field'))
				field.parentNode.classList[active ? 'remove' : 'add']('inactive');

			return true;
		}

		return false;
	},

	/** @private */
	triggerValidation: function(section_id) {
		var elem = this.getUIElement(section_id);
		return elem ? elem.triggerValidation() : true;
	},

	/**
	 * Parse the option element input.
	 *
	 * The function is invoked when the `parse()` method has been invoked on
	 * the parent form and triggers input value reading and validation.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @returns {Promise<void>}
	 * Returns a promise resolving once the input value has been read and
	 * validated or rejecting in case the input value does not meet the
	 * validation constraints.
	 */
	parse: function(section_id) {
		var active = this.isActive(section_id);

		if (active && !this.isValid(section_id)) {
			var title = this.stripTags(this.title).trim(),
			    error = this.getValidationError(section_id);

			return Promise.reject(new TypeError(
				_('Option "%s" contains an invalid input value.').format(title || this.option) + ' ' + error));
		}

		if (active) {
			var cval = this.cfgvalue(section_id),
			    fval = this.formvalue(section_id);

			if (fval == null || fval == '') {
				if (this.rmempty || this.optional) {
					return Promise.resolve(this.remove(section_id));
				}
				else {
					var title = this.stripTags(this.title).trim();

					return Promise.reject(new TypeError(
						_('Option "%s" must not be empty.').format(title || this.option)));
				}
			}
			else if (this.forcewrite || !isEqual(cval, fval)) {
				return Promise.resolve(this.write(section_id, fval));
			}
		}
		else if (!this.retain) {
			return Promise.resolve(this.remove(section_id));
		}

		return Promise.resolve();
	},

	/**
	 * Write the current input value into the configuration.
	 *
	 * This function is invoked upon saving the parent form when the option
	 * element is valid and when its input value has been changed compared to
	 * the initial value returned by
	 * [cfgvalue()]{@link LuCI.form.AbstractValue#cfgvalue}.
	 *
	 * The default implementation simply sets the given input value in the
	 * UCI configuration (or the associated JavaScript object property in
	 * case of `JSONMap` forms). It may be overwritten by user code to
	 * implement alternative save logic, e.g. to transform the input value
	 * before it is written.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 *
	 * @param {string|string[]}	formvalue
	 * The input value to write.
	 */
	write: function(section_id, formvalue) {
		return this.map.data.set(
			this.uciconfig || this.section.uciconfig || this.map.config,
			this.ucisection || section_id,
			this.ucioption || this.option,
			formvalue);
	},

	/**
	 * Remove the corresponding value from the configuration.
	 *
	 * This function is invoked upon saving the parent form when the option
	 * element has been hidden due to unsatisfied dependencies or when the
	 * user cleared the input value and the option is marked optional.
	 *
	 * The default implementation simply removes the associated option from the
	 * UCI configuration (or the associated JavaScript object property in
	 * case of `JSONMap` forms). It may be overwritten by user code to
	 * implement alternative removal logic, e.g. to retain the original value.
	 *
	 * @param {string} section_id
	 * The configuration section ID
	 */
	remove: function(section_id) {
		var this_cfg = this.uciconfig || this.section.uciconfig || this.map.config,
		    this_sid = this.ucisection || section_id,
		    this_opt = this.ucioption || this.option;

		for (var i = 0; i < this.section.children.length; i++) {
			var sibling = this.section.children[i];

			if (sibling === this || sibling.ucioption == null)
				continue;

			var sibling_cfg = sibling.uciconfig || sibling.section.uciconfig || sibling.map.config,
			    sibling_sid = sibling.ucisection || section_id,
			    sibling_opt = sibling.ucioption || sibling.option;

			if (this_cfg != sibling_cfg || this_sid != sibling_sid || this_opt != sibling_opt)
				continue;

			if (!sibling.isActive(section_id))
				continue;

			/* found another active option aliasing the same uci option name,
			 * so we can't remove the value */
			return;
		}

		this.map.data.unset(this_cfg, this_sid, this_opt);
	}
});

/**
 * @class TypedSection
 * @memberof LuCI.form
 * @augments LuCI.form.AbstractSection
 * @hideconstructor
 * @classdesc
 *
 * The `TypedSection` class maps all or - if `filter()` is overwritten - a
 * subset of the underlying UCI configuration sections of a given type.
 *
 * Layout wise, the configuration section instances mapped by the section
 * element (sometimes referred to as "section nodes") are stacked beneath
 * each other in a single column, with an optional section remove button next
 * to each section node and a section add button at the end, depending on the
 * value of the `addremove` property.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [section()]{@link LuCI.form.Map#section}.
 *
 * @param {string} section_type
 * The type of the UCI section to map.
 *
 * @param {string} [title]
 * The title caption of the form section element.
 *
 * @param {string} [description]
 * The description text of the form section element.
 */
var CBITypedSection = CBIAbstractSection.extend(/** @lends LuCI.form.TypedSection.prototype */ {
	__name__: 'CBI.TypedSection',

	/**
	 * If set to `true`, the user may add or remove instances from the form
	 * section widget, otherwise only preexisting sections may be edited.
	 * The default is `false`.
	 *
	 * @name LuCI.form.TypedSection.prototype#addremove
	 * @type boolean
	 * @default false
	 */

	/**
	 * If set to `true`, mapped section instances are treated as anonymous
	 * UCI sections, which means that section instance elements will be
	 * rendered without title element and that no name is required when adding
	 * new sections. The default is `false`.
	 *
	 * @name LuCI.form.TypedSection.prototype#anonymous
	 * @type boolean
	 * @default false
	 */

	/**
	 * When set to `true`, instead of rendering section instances one below
	 * another, treat each instance as separate tab pane and render a tab menu
	 * at the top of the form section element, allowing the user to switch
	 * among instances. The default is `false`.
	 *
	 * @name LuCI.form.TypedSection.prototype#tabbed
	 * @type boolean
	 * @default false
	 */

	/**
	 * Override the caption used for the section add button at the bottom of
	 * the section form element. If set to a string, it will be used as-is,
	 * if set to a function, the function will be invoked and its return value
	 * is used as caption, after converting it to a string. If this property
	 * is not set, the default is `Add`.
	 *
	 * @name LuCI.form.TypedSection.prototype#addbtntitle
	 * @type string|function
	 * @default null
	 */

	/**
	 * Override the UCI configuration name to read the section IDs from. By
	 * default, the configuration name is inherited from the parent `Map`.
	 * By setting this property, a deviating configuration may be specified.
	 * The default is `null`, means inheriting from the parent form.
	 *
	 * @name LuCI.form.TypedSection.prototype#uciconfig
	 * @type string
	 * @default null
	 */

	/** @override */
	cfgsections: function() {
		return this.map.data.sections(this.uciconfig || this.map.config, this.sectiontype)
			.map(function(s) { return s['.name'] })
			.filter(L.bind(this.filter, this));
	},

	/** @private */
	handleAdd: function(ev, name) {
		var config_name = this.uciconfig || this.map.config;

		this.map.data.add(config_name, this.sectiontype, name);
		return this.map.save(null, true);
	},

	/** @private */
	handleRemove: function(section_id, ev) {
		var config_name = this.uciconfig || this.map.config;

		this.map.data.remove(config_name, section_id);
		return this.map.save(null, true);
	},

	/** @private */
	renderSectionAdd: function(extra_class) {
		if (!this.addremove)
			return E([]);

		var createEl = E('div', { 'class': 'cbi-section-create' }),
		    config_name = this.uciconfig || this.map.config,
		    btn_title = this.titleFn('addbtntitle');

		if (extra_class != null)
			createEl.classList.add(extra_class);

		if (this.anonymous) {
			createEl.appendChild(E('button', {
				'class': 'cbi-button cbi-button-add',
				'title': btn_title || _('Add'),
				'click': ui.createHandlerFn(this, 'handleAdd'),
				'disabled': this.map.readonly || null
			}, [ btn_title || _('Add') ]));
		}
		else {
			var nameEl = E('input', {
				'type': 'text',
				'class': 'cbi-section-create-name',
				'disabled': this.map.readonly || null
			});

			dom.append(createEl, [
				E('div', {}, nameEl),
				E('button', {
					'class': 'cbi-button cbi-button-add',
					'title': btn_title || _('Add'),
					'click': ui.createHandlerFn(this, function(ev) {
						if (nameEl.classList.contains('cbi-input-invalid'))
							return;

						return this.handleAdd(ev, nameEl.value);
					}),
					'disabled': this.map.readonly || true
				}, [ btn_title || _('Add') ])
			]);

			if (this.map.readonly !== true) {
				ui.addValidator(nameEl, 'uciname', true, function(v) {
					var button = createEl.querySelector('.cbi-section-create > .cbi-button-add');
					if (v !== '') {
						button.disabled = null;
						return true;
					}
					else {
						button.disabled = true;
						return _('Expecting: %s').format(_('non-empty value'));
					}
				}, 'blur', 'keyup');
			}
		}

		return createEl;
	},

	/** @private */
	renderSectionPlaceholder: function() {
		return E('em', _('This section contains no values yet'));
	},

	/** @private */
	renderContents: function(cfgsections, nodes) {
		var section_id = null,
		    config_name = this.uciconfig || this.map.config,
		    sectionEl = E('div', {
				'id': 'cbi-%s-%s'.format(config_name, this.sectiontype),
				'class': 'cbi-section',
				'data-tab': (this.map.tabbed && !this.parentoption) ? this.sectiontype : null,
				'data-tab-title': (this.map.tabbed && !this.parentoption) ? this.title || this.sectiontype : null
			});

		if (this.title != null && this.title != '')
			sectionEl.appendChild(E('h3', {}, this.title));

		if (this.description != null && this.description != '')
			sectionEl.appendChild(E('div', { 'class': 'cbi-section-descr' }, this.description));

		for (var i = 0; i < nodes.length; i++) {
			if (this.addremove) {
				sectionEl.appendChild(
					E('div', { 'class': 'cbi-section-remove right' },
						E('button', {
							'class': 'cbi-button',
							'name': 'cbi.rts.%s.%s'.format(config_name, cfgsections[i]),
							'data-section-id': cfgsections[i],
							'click': ui.createHandlerFn(this, 'handleRemove', cfgsections[i]),
							'disabled': this.map.readonly || null
						}, [ _('Delete') ])));
			}

			if (!this.anonymous)
				sectionEl.appendChild(E('h3', cfgsections[i].toUpperCase()));

			sectionEl.appendChild(E('div', {
				'id': 'cbi-%s-%s'.format(config_name, cfgsections[i]),
				'class': this.tabs
					? 'cbi-section-node cbi-section-node-tabbed' : 'cbi-section-node',
				'data-section-id': cfgsections[i]
			}, nodes[i]));
		}

		if (nodes.length == 0)
			sectionEl.appendChild(this.renderSectionPlaceholder());

		sectionEl.appendChild(this.renderSectionAdd());

		dom.bindClassInstance(sectionEl, this);

		return sectionEl;
	},

	/** @override */
	render: function() {
		var cfgsections = this.cfgsections(),
		    renderTasks = [];

		for (var i = 0; i < cfgsections.length; i++)
			renderTasks.push(this.renderUCISection(cfgsections[i]));

		return Promise.all(renderTasks).then(this.renderContents.bind(this, cfgsections));
	}
});

/**
 * @class TableSection
 * @memberof LuCI.form
 * @augments LuCI.form.TypedSection
 * @hideconstructor
 * @classdesc
 *
 * The `TableSection` class maps all or - if `filter()` is overwritten - a
 * subset of the underlying UCI configuration sections of a given type.
 *
 * Layout wise, the configuration section instances mapped by the section
 * element (sometimes referred to as "section nodes") are rendered as rows
 * within an HTML table element, with an optional section remove button in the
 * last column and a section add button below the table, depending on the
 * value of the `addremove` property.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [section()]{@link LuCI.form.Map#section}.
 *
 * @param {string} section_type
 * The type of the UCI section to map.
 *
 * @param {string} [title]
 * The title caption of the form section element.
 *
 * @param {string} [description]
 * The description text of the form section element.
 */
var CBITableSection = CBITypedSection.extend(/** @lends LuCI.form.TableSection.prototype */ {
	__name__: 'CBI.TableSection',

	/**
	 * Override the per-section instance title caption shown in the first
	 * column of the table unless `anonymous` is set to true. If set to a
	 * string, it will be used as `String.format()` pattern with the name of
	 * the underlying UCI section as first argument, if set to a function, the
	 * function will be invoked with the section name as first argument and
	 * its return value is used as caption, after converting it to a string.
	 * If this property is not set, the default is the name of the underlying
	 * UCI configuration section.
	 *
	 * @name LuCI.form.TableSection.prototype#sectiontitle
	 * @type string|function
	 * @default null
	 */

	/**
	 * Override the per-section instance modal popup title caption shown when
	 * clicking the `More…` button in a section specifying `max_cols`. If set
	 * to a string, it will be used as `String.format()` pattern with the name
	 * of the underlying UCI section as first argument, if set to a function,
	 * the function will be invoked with the section name as first argument and
	 * its return value is used as caption, after converting it to a string.
	 * If this property is not set, the default is the name of the underlying
	 * UCI configuration section.
	 *
	 * @name LuCI.form.TableSection.prototype#modaltitle
	 * @type string|function
	 * @default null
	 */

	/**
	 * Specify a maximum amount of columns to display. By default, one table
	 * column is rendered for each child option of the form section element.
	 * When this option is set to a positive number, then no more columns than
	 * the given amount are rendered. When the number of child options exceeds
	 * the specified amount, a `More…` button is rendered in the last column,
	 * opening a modal dialog presenting all options elements in `NamedSection`
	 * style when clicked.
	 *
	 * @name LuCI.form.TableSection.prototype#max_cols
	 * @type number
	 * @default null
	 */

	/**
	 * If set to `true`, alternating `cbi-rowstyle-1` and `cbi-rowstyle-2` CSS
	 * classes are added to the table row elements. Not all LuCI themes
	 * implement these row style classes. The default is `false`.
	 *
	 * @name LuCI.form.TableSection.prototype#rowcolors
	 * @type boolean
	 * @default false
	 */

	/**
	 * Enables a per-section instance row `Edit` button which triggers a certain
	 * action when clicked. If set to a string, the string value is used
	 * as `String.format()` pattern with the name of the underlying UCI section
	 * as first format argument. The result is then interpreted as URL which
	 * LuCI will navigate to when the user clicks the edit button.
	 *
	 * If set to a function, this function will be registered as click event
	 * handler on the rendered edit button, receiving the section instance
	 * name as first and the DOM click event as second argument.
	 *
	 * @name LuCI.form.TableSection.prototype#extedit
	 * @type string|function
	 * @default null
	 */

	/**
	 * If set to `true`, a sort button is added to the last column, allowing
	 * the user to reorder the section instances mapped by the section form
	 * element.
	 *
	 * @name LuCI.form.TableSection.prototype#sortable
	 * @type boolean
	 * @default false
	 */

	/**
	 * If set to `true`, the header row with the options descriptions will
	 * not be displayed. By default, descriptions row is automatically displayed
	 * when at least one option has a description.
	 *
	 * @name LuCI.form.TableSection.prototype#nodescriptions
	 * @type boolean
	 * @default false
	 */

	/**
	 * The `TableSection` implementation does not support option tabbing, so
	 * its implementation of `tab()` will always throw an exception when
	 * invoked.
	 *
	 * @override
	 * @throws Throws an exception when invoked.
	 */
	tab: function() {
		throw 'Tabs are not supported by TableSection';
	},

	/** @private */
	renderContents: function(cfgsections, nodes) {
		var section_id = null,
		    config_name = this.uciconfig || this.map.config,
		    max_cols = isNaN(this.max_cols) ? this.children.length : this.max_cols,
		    has_more = max_cols < this.children.length,
		    drag_sort = this.sortable && !('ontouchstart' in window),
		    touch_sort = this.sortable && ('ontouchstart' in window),
		    sectionEl = E('div', {
				'id': 'cbi-%s-%s'.format(config_name, this.sectiontype),
				'class': 'cbi-section cbi-tblsection',
				'data-tab': (this.map.tabbed && !this.parentoption) ? this.sectiontype : null,
				'data-tab-title': (this.map.tabbed && !this.parentoption) ? this.title || this.sectiontype : null
			}),
			tableEl = E('table', {
				'class': 'table cbi-section-table'
			});

		if (this.title != null && this.title != '')
			sectionEl.appendChild(E('h3', {}, this.title));

		if (this.description != null && this.description != '')
			sectionEl.appendChild(E('div', { 'class': 'cbi-section-descr' }, this.description));

		tableEl.appendChild(this.renderHeaderRows(max_cols));

		for (var i = 0; i < nodes.length; i++) {
			var sectionname = this.titleFn('sectiontitle', cfgsections[i]);

			if (sectionname == null)
				sectionname = cfgsections[i];

			var trEl = E('tr', {
				'id': 'cbi-%s-%s'.format(config_name, cfgsections[i]),
				'class': 'tr cbi-section-table-row',
				'data-sid': cfgsections[i],
				'draggable': (drag_sort || touch_sort) ? true : null,
				'mousedown': drag_sort ? L.bind(this.handleDragInit, this) : null,
				'dragstart': drag_sort ? L.bind(this.handleDragStart, this) : null,
				'dragover': drag_sort ? L.bind(this.handleDragOver, this) : null,
				'dragenter': drag_sort ? L.bind(this.handleDragEnter, this) : null,
				'dragleave': drag_sort ? L.bind(this.handleDragLeave, this) : null,
				'dragend': drag_sort ? L.bind(this.handleDragEnd, this) : null,
				'drop': drag_sort ? L.bind(this.handleDrop, this) : null,
				'touchmove': touch_sort ? L.bind(this.handleTouchMove, this) : null,
				'touchend': touch_sort ? L.bind(this.handleTouchEnd, this) : null,
				'data-title': (sectionname && (!this.anonymous || this.sectiontitle)) ? sectionname : null,
				'data-section-id': cfgsections[i]
			});

			if (this.extedit || this.rowcolors)
				trEl.classList.add(!(tableEl.childNodes.length % 2)
					? 'cbi-rowstyle-1' : 'cbi-rowstyle-2');

			for (var j = 0; j < max_cols && nodes[i].firstChild; j++)
				trEl.appendChild(nodes[i].firstChild);

			trEl.appendChild(this.renderRowActions(cfgsections[i], has_more ? _('More…') : null));
			tableEl.appendChild(trEl);
		}

		if (nodes.length == 0)
			tableEl.appendChild(E('tr', { 'class': 'tr cbi-section-table-row placeholder' },
				E('td', { 'class': 'td' }, this.renderSectionPlaceholder())));

		sectionEl.appendChild(tableEl);

		sectionEl.appendChild(this.renderSectionAdd('cbi-tblsection-create'));

		dom.bindClassInstance(sectionEl, this);

		return sectionEl;
	},

	/** @private */
	renderHeaderRows: function(max_cols, has_action) {
		var has_titles = false,
		    has_descriptions = false,
		    max_cols = isNaN(this.max_cols) ? this.children.length : this.max_cols,
		    has_more = max_cols < this.children.length,
		    anon_class = (!this.anonymous || this.sectiontitle) ? 'named' : 'anonymous',
		    trEls = E([]);

		for (var i = 0, opt; i < max_cols && (opt = this.children[i]) != null; i++) {
			if (opt.modalonly)
				continue;

			has_titles = has_titles || !!opt.title;
			has_descriptions = has_descriptions || !!opt.description;
		}

		if (has_titles) {
			var trEl = E('tr', {
				'class': 'tr cbi-section-table-titles ' + anon_class,
				'data-title': (!this.anonymous || this.sectiontitle) ? _('Name') : null,
				'click': this.sortable ? ui.createHandlerFn(this, 'handleSort') : null
			});

			for (var i = 0, opt; i < max_cols && (opt = this.children[i]) != null; i++) {
				if (opt.modalonly)
					continue;

				trEl.appendChild(E('th', {
					'class': 'th cbi-section-table-cell',
					'data-widget': opt.__name__,
					'data-sortable-row': this.sortable ? '' : null
				}));

				if (opt.width != null)
					trEl.lastElementChild.style.width =
						(typeof(opt.width) == 'number') ? opt.width+'px' : opt.width;

				if (opt.titleref)
					trEl.lastElementChild.appendChild(E('a', {
						'href': opt.titleref,
						'class': 'cbi-title-ref',
						'title': this.titledesc || _('Go to relevant configuration page')
					}, opt.title));
				else
					dom.content(trEl.lastElementChild, opt.title);
			}

			if (this.sortable || this.extedit || this.addremove || has_more || has_action)
				trEl.appendChild(E('th', {
					'class': 'th cbi-section-table-cell cbi-section-actions'
				}));

			trEls.appendChild(trEl);
		}

		if (has_descriptions && !this.nodescriptions) {
			var trEl = E('tr', {
				'class': 'tr cbi-section-table-descr ' + anon_class
			});

			for (var i = 0, opt; i < max_cols && (opt = this.children[i]) != null; i++) {
				if (opt.modalonly)
					continue;

				trEl.appendChild(E('th', {
					'class': 'th cbi-section-table-cell',
					'data-widget': opt.__name__
				}, opt.description));

				if (opt.width != null)
					trEl.lastElementChild.style.width =
						(typeof(opt.width) == 'number') ? opt.width+'px' : opt.width;
			}

			if (this.sortable || this.extedit || this.addremove || has_more || has_action)
				trEl.appendChild(E('th', {
					'class': 'th cbi-section-table-cell cbi-section-actions'
				}));

			trEls.appendChild(trEl);
		}

		return trEls;
	},

	/** @private */
	renderRowActions: function(section_id, more_label) {
		var config_name = this.uciconfig || this.map.config;

		if (!this.sortable && !this.extedit && !this.addremove && !more_label)
			return E([]);

		var tdEl = E('td', {
			'class': 'td cbi-section-table-cell nowrap cbi-section-actions'
		}, E('div'));

		if (this.sortable) {
			dom.append(tdEl.lastElementChild, [
				E('button', {
					'title': _('Drag to reorder'),
					'class': 'cbi-button drag-handle center',
					'style': 'cursor:move',
					'disabled': this.map.readonly || null
				}, '☰')
			]);
		}

		if (this.extedit) {
			var evFn = null;

			if (typeof(this.extedit) == 'function')
				evFn = L.bind(this.extedit, this);
			else if (typeof(this.extedit) == 'string')
				evFn = L.bind(function(sid, ev) {
					location.href = this.extedit.format(sid);
				}, this, section_id);

			dom.append(tdEl.lastElementChild,
				E('button', {
					'title': _('Edit'),
					'class': 'cbi-button cbi-button-edit',
					'click': evFn
				}, [ _('Edit') ])
			);
		}

		if (more_label) {
			dom.append(tdEl.lastElementChild,
				E('button', {
					'title': more_label,
					'class': 'cbi-button cbi-button-edit',
					'click': ui.createHandlerFn(this, 'renderMoreOptionsModal', section_id)
				}, [ more_label ])
			);
		}

		if (this.addremove) {
			var btn_title = this.titleFn('removebtntitle', section_id);

			dom.append(tdEl.lastElementChild,
				E('button', {
					'title': btn_title || _('Delete'),
					'class': 'cbi-button cbi-button-remove',
					'click': ui.createHandlerFn(this, 'handleRemove', section_id),
					'disabled': this.map.readonly || null
				}, [ btn_title || _('Delete') ])
			);
		}

		return tdEl;
	},

	/** @private */
	handleDragInit: function(ev) {
		scope.dragState = { node: ev.target };
	},

	/** @private */
	handleDragStart: function(ev) {
		if (!scope.dragState || !scope.dragState.node.classList.contains('drag-handle')) {
			scope.dragState = null;
			ev.preventDefault();
			return false;
		}

		scope.dragState.node = dom.parent(scope.dragState.node, '.tr');
		ev.dataTransfer.setData('text', 'drag');
		ev.target.style.opacity = 0.4;
	},

	/** @private */
	handleDragOver: function(ev) {
		var n = scope.dragState.targetNode,
		    r = scope.dragState.rect,
		    t = r.top + r.height / 2;

		if (ev.clientY <= t) {
			n.classList.remove('drag-over-below');
			n.classList.add('drag-over-above');
		}
		else {
			n.classList.remove('drag-over-above');
			n.classList.add('drag-over-below');
		}

		ev.dataTransfer.dropEffect = 'move';
		ev.preventDefault();
		return false;
	},

	/** @private */
	handleDragEnter: function(ev) {
		scope.dragState.rect = ev.currentTarget.getBoundingClientRect();
		scope.dragState.targetNode = ev.currentTarget;
	},

	/** @private */
	handleDragLeave: function(ev) {
		ev.currentTarget.classList.remove('drag-over-above');
		ev.currentTarget.classList.remove('drag-over-below');
	},

	/** @private */
	handleDragEnd: function(ev) {
		var n = ev.target;

		n.style.opacity = '';
		n.classList.add('flash');
		n.parentNode.querySelectorAll('.drag-over-above, .drag-over-below')
			.forEach(function(tr) {
				tr.classList.remove('drag-over-above');
				tr.classList.remove('drag-over-below');
			});
	},

	/** @private */
	handleDrop: function(ev) {
		var s = scope.dragState;

		if (s.node && s.targetNode) {
			var config_name = this.uciconfig || this.map.config,
			    ref_node = s.targetNode,
			    after = false;

		    if (ref_node.classList.contains('drag-over-below')) {
		    	ref_node = ref_node.nextElementSibling;
		    	after = true;
		    }

		    var sid1 = s.node.getAttribute('data-sid'),
		        sid2 = s.targetNode.getAttribute('data-sid');

		    s.node.parentNode.insertBefore(s.node, ref_node);
		    this.map.data.move(config_name, sid1, sid2, after);
		}

		scope.dragState = null;
		ev.target.style.opacity = '';
		ev.stopPropagation();
		ev.preventDefault();
		return false;
	},

	/** @private */
	determineBackgroundColor: function(node) {
		var r = 255, g = 255, b = 255;

		while (node) {
			var s = window.getComputedStyle(node),
			    c = (s.getPropertyValue('background-color') || '').replace(/ /g, '');

			if (c != '' && c != 'transparent' && c != 'rgba(0,0,0,0)') {
				if (/^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.test(c)) {
					r = parseInt(RegExp.$1, 16);
					g = parseInt(RegExp.$2, 16);
					b = parseInt(RegExp.$3, 16);
				}
				else if (/^rgba?\(([0-9]+),([0-9]+),([0-9]+)[,)]$/.test(c)) {
					r = +RegExp.$1;
					g = +RegExp.$2;
					b = +RegExp.$3;
				}

				break;
			}

			node = node.parentNode;
		}

		return [ r, g, b ];
	},

	/** @private */
	handleTouchMove: function(ev) {
		if (!ev.target.classList.contains('drag-handle'))
			return;

		var touchLoc = ev.targetTouches[0],
		    rowBtn = ev.target,
		    rowElem = dom.parent(rowBtn, '.tr'),
		    htmlElem = document.querySelector('html'),
		    dragHandle = document.querySelector('.touchsort-element'),
		    viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

		if (!dragHandle) {
			var rowRect = rowElem.getBoundingClientRect(),
			    btnRect = rowBtn.getBoundingClientRect(),
			    paddingLeft = btnRect.left - rowRect.left,
			    paddingRight = rowRect.right - btnRect.right,
			    colorBg = this.determineBackgroundColor(rowElem),
			    colorFg = (colorBg[0] * 0.299 + colorBg[1] * 0.587 + colorBg[2] * 0.114) > 186 ? [ 0, 0, 0 ] : [ 255, 255, 255 ];

			dragHandle = E('div', { 'class': 'touchsort-element' }, [
				E('strong', [ rowElem.getAttribute('data-title') ]),
				rowBtn.cloneNode(true)
			]);

			Object.assign(dragHandle.style, {
				position: 'absolute',
				boxShadow: '0 0 3px rgba(%d, %d, %d, 1)'.format(colorFg[0], colorFg[1], colorFg[2]),
				background: 'rgba(%d, %d, %d, 0.8)'.format(colorBg[0], colorBg[1], colorBg[2]),
				top: rowRect.top + 'px',
				left: rowRect.left + 'px',
				width: rowRect.width + 'px',
				height: (rowBtn.offsetHeight + 4) + 'px'
			});

			Object.assign(dragHandle.firstElementChild.style, {
				position: 'absolute',
				lineHeight: dragHandle.style.height,
				whiteSpace: 'nowrap',
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				left: (paddingRight > paddingLeft) ? '' : '5px',
				right: (paddingRight > paddingLeft) ? '5px' : '',
				width: (Math.max(paddingLeft, paddingRight) - 10) + 'px'
			});

			Object.assign(dragHandle.lastElementChild.style, {
				position: 'absolute',
				top: '2px',
				left: paddingLeft + 'px',
				width: rowBtn.offsetWidth + 'px'
			});

			document.body.appendChild(dragHandle);

			rowElem.classList.remove('flash');
			rowBtn.blur();
		}

		dragHandle.style.top = (touchLoc.pageY - (parseInt(dragHandle.style.height) / 2)) + 'px';

		rowElem.parentNode.querySelectorAll('[draggable]').forEach(function(tr, i, trs) {
			var trRect = tr.getBoundingClientRect(),
			    yTop = trRect.top + window.scrollY,
			    yBottom = trRect.bottom + window.scrollY,
			    yMiddle = yTop + ((yBottom - yTop) / 2);

			tr.classList.remove('drag-over-above', 'drag-over-below');

			if ((i == 0 || touchLoc.pageY >= yTop) && touchLoc.pageY <= yMiddle)
				tr.classList.add('drag-over-above');
			else if ((i == (trs.length - 1) || touchLoc.pageY <= yBottom) && touchLoc.pageY > yMiddle)
				tr.classList.add('drag-over-below');
		});

		/* prevent standard scrolling and scroll page when drag handle is
		 * moved very close (~30px) to the viewport edge */

		ev.preventDefault();

		if (touchLoc.clientY < 30)
			window.requestAnimationFrame(function() { htmlElem.scrollTop -= 30 });
		else if (touchLoc.clientY > viewportHeight - 30)
			window.requestAnimationFrame(function() { htmlElem.scrollTop += 30 });
	},

	/** @private */
	handleTouchEnd: function(ev) {
		var rowElem = dom.parent(ev.target, '.tr'),
		    htmlElem = document.querySelector('html'),
		    dragHandle = document.querySelector('.touchsort-element'),
		    targetElem = rowElem.parentNode.querySelector('.drag-over-above, .drag-over-below'),
		    viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

		if (!dragHandle)
			return;

		if (targetElem) {
		    var isBelow = targetElem.classList.contains('drag-over-below');

			rowElem.parentNode.insertBefore(rowElem, isBelow ? targetElem.nextElementSibling : targetElem);

			this.map.data.move(
				this.uciconfig || this.map.config,
				rowElem.getAttribute('data-sid'),
				targetElem.getAttribute('data-sid'),
				isBelow);

			window.requestAnimationFrame(function() {
				var rowRect = rowElem.getBoundingClientRect();

				if (rowRect.top < 50)
					htmlElem.scrollTop = (htmlElem.scrollTop + rowRect.top - 50);
				else if (rowRect.bottom > viewportHeight - 50)
					htmlElem.scrollTop = (htmlElem.scrollTop + viewportHeight - 50 - rowRect.height);

				rowElem.classList.add('flash');
			});

			targetElem.classList.remove('drag-over-above', 'drag-over-below');
		}

		document.body.removeChild(dragHandle);
	},

	/** @private */
	handleModalCancel: function(modalMap, ev) {
		var prevNode = this.getPreviousModalMap(),
		    resetTasks = Promise.resolve();

		if (prevNode) {
			var heading = prevNode.parentNode.querySelector('h4'),
			    prevMap = dom.findClassInstance(prevNode);

			while (prevMap) {
				resetTasks = resetTasks
					.then(L.bind(prevMap.load, prevMap))
					.then(L.bind(prevMap.reset, prevMap));

				prevMap = prevMap.parent;
			}

			prevNode.classList.add('flash');
			prevNode.classList.remove('hidden');
			prevNode.parentNode.removeChild(prevNode.nextElementSibling);

			heading.removeChild(heading.lastElementChild);

			if (!this.getPreviousModalMap())
				prevNode.parentNode
					.querySelector('div.right > button')
					.firstChild.data = _('Dismiss');
		}
		else {
			ui.hideModal();
		}

		return resetTasks;
	},

	/** @private */
	handleModalSave: function(modalMap, ev) {
		var mapNode = this.getActiveModalMap(),
		    activeMap = dom.findClassInstance(mapNode),
		    saveTasks = activeMap.save(null, true);

		while (activeMap.parent) {
			activeMap = activeMap.parent;
			saveTasks = saveTasks
				.then(L.bind(activeMap.load, activeMap))
				.then(L.bind(activeMap.reset, activeMap));
		}

		return saveTasks
			.then(L.bind(this.handleModalCancel, this, modalMap, ev, true))
			.catch(function() {});
	},

	/** @private */
	handleSort: function(ev) {
		if (!ev.target.matches('th[data-sortable-row]'))
			return;

		var th = ev.target,
		    descending = (th.getAttribute('data-sort-direction') == 'desc'),
		    config_name = this.uciconfig || this.map.config,
		    index = 0,
		    list = [];

		ev.currentTarget.querySelectorAll('th').forEach(function(other_th, i) {
			if (other_th !== th)
				other_th.removeAttribute('data-sort-direction');
			else
				index = i;
		});

		ev.currentTarget.parentNode.querySelectorAll('tr.cbi-section-table-row').forEach(L.bind(function(tr, i) {
			var sid = tr.getAttribute('data-sid'),
			    opt = tr.childNodes[index].getAttribute('data-name'),
			    val = this.cfgvalue(sid, opt);

			tr.querySelectorAll('.flash').forEach(function(n) {
				n.classList.remove('flash')
			});

			list.push([
				ui.Table.prototype.deriveSortKey((val != null) ? val.trim() : ''),
				tr
			]);
		}, this));

		list.sort(function(a, b) {
			return descending
				? -L.naturalCompare(a[0], b[0])
				: L.naturalCompare(a[0], b[0]);
		});

		window.requestAnimationFrame(L.bind(function() {
			var ref_sid, cur_sid;

			for (var i = 0; i < list.length; i++) {
				list[i][1].childNodes[index].classList.add('flash');
				th.parentNode.parentNode.appendChild(list[i][1]);

				cur_sid = list[i][1].getAttribute('data-sid');

				if (ref_sid)
					this.map.data.move(config_name, cur_sid, ref_sid, true);

				ref_sid = cur_sid;
			}

			th.setAttribute('data-sort-direction', descending ? 'asc' : 'desc');
		}, this));
	},

	/**
	 * Add further options to the per-section instanced modal popup.
	 *
	 * This function may be overwritten by user code to perform additional
	 * setup steps before displaying the more options modal which is useful to
	 * e.g. query additional data or to inject further option elements.
	 *
	 * The default implementation of this function does nothing.
	 *
	 * @abstract
	 * @param {LuCI.form.NamedSection} modalSection
	 * The `NamedSection` instance about to be rendered in the modal popup.
	 *
	 * @param {string} section_id
	 * The ID of the underlying UCI section the modal popup belongs to.
	 *
	 * @param {Event} ev
	 * The DOM event emitted by clicking the `More…` button.
	 *
	 * @returns {*|Promise<*>}
	 * Return values of this function are ignored but if a promise is returned,
	 * it is run to completion before the rendering is continued, allowing
	 * custom logic to perform asynchronous work before the modal dialog
	 * is shown.
	 */
	addModalOptions: function(modalSection, section_id, ev) {

	},

	/** @private */
	getActiveModalMap: function() {
		return document.querySelector('body.modal-overlay-active > #modal_overlay > .modal.cbi-modal > .cbi-map:not(.hidden)');
	},

	/** @private */
	getPreviousModalMap: function() {
		var mapNode = this.getActiveModalMap(),
		    prevNode = mapNode ? mapNode.previousElementSibling : null;

		return (prevNode && prevNode.matches('.cbi-map.hidden')) ? prevNode : null;
	},

	/** @private */
	cloneOptions: function(src_section, dest_section) {
		for (var i = 0; i < src_section.children.length; i++) {
			var o1 = src_section.children[i];

			if (o1.modalonly === false && src_section === this)
				continue;

			var o2;

			if (o1.subsection) {
				o2 = dest_section.option(o1.constructor, o1.option, o1.subsection.constructor, o1.subsection.sectiontype, o1.subsection.title, o1.subsection.description);

				for (var k in o1.subsection) {
					if (!o1.subsection.hasOwnProperty(k))
						continue;

					switch (k) {
					case 'map':
					case 'children':
					case 'parentoption':
						continue;

					default:
						o2.subsection[k] = o1.subsection[k];
					}
				}

				this.cloneOptions(o1.subsection, o2.subsection);
			}
			else {
				o2 = dest_section.option(o1.constructor, o1.option, o1.title, o1.description);
			}

			for (var k in o1) {
				if (!o1.hasOwnProperty(k))
					continue;

				switch (k) {
				case 'map':
				case 'section':
				case 'option':
				case 'title':
				case 'description':
				case 'subsection':
					continue;

				default:
					o2[k] = o1[k];
				}
			}
		}
	},

	/** @private */
	renderMoreOptionsModal: function(section_id, ev) {
		var parent = this.map,
		    sref = parent.data.get(parent.config, section_id),
		    mapNode = this.getActiveModalMap(),
		    activeMap = mapNode ? dom.findClassInstance(mapNode) : null,
		    stackedMap = activeMap && (activeMap.parent !== parent || activeMap.section !== section_id);

		return (stackedMap ? activeMap.save(null, true) : Promise.resolve()).then(L.bind(function() {
			section_id = sref['.name'];

			var m;

			if (parent instanceof CBIJSONMap) {
				m = new CBIJSONMap(null, null, null);
				m.data = parent.data;
			}
			else {
				m = new CBIMap(parent.config, null, null);
			}

			var s = m.section(CBINamedSection, section_id, this.sectiontype);

			m.parent = parent;
			m.section = section_id;
			m.readonly = parent.readonly;

			s.tabs = this.tabs;
			s.tab_names = this.tab_names;

			this.cloneOptions(this, s);

			return Promise.resolve(this.addModalOptions(s, section_id, ev)).then(function() {
				return m.render();
			}).then(L.bind(function(nodes) {
				var title = parent.title,
				    name = null;

				if ((name = this.titleFn('modaltitle', section_id)) != null)
					title = name;
				else if ((name = this.titleFn('sectiontitle', section_id)) != null)
					title = '%s - %s'.format(parent.title, name);
				else if (!this.anonymous)
					title = '%s - %s'.format(parent.title, section_id);

				if (stackedMap) {
					mapNode.parentNode
						.querySelector('h4')
						.appendChild(E('span', title ? ' » ' + title : ''));

					mapNode.parentNode
						.querySelector('div.right > button')
						.firstChild.data = _('Back');

					mapNode.classList.add('hidden');
					mapNode.parentNode.insertBefore(nodes, mapNode.nextElementSibling);

					nodes.classList.add('flash');
				}
				else {
					ui.showModal(title, [
						nodes,
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'cbi-button',
								'click': ui.createHandlerFn(this, 'handleModalCancel', m)
							}, [ _('Dismiss') ]), ' ',
							E('button', {
								'class': 'cbi-button cbi-button-positive important',
								'click': ui.createHandlerFn(this, 'handleModalSave', m),
								'disabled': m.readonly || null
							}, [ _('Save') ])
						])
					], 'cbi-modal');
				}
			}, this));
		}, this)).catch(L.error);
	}
});

/**
 * @class GridSection
 * @memberof LuCI.form
 * @augments LuCI.form.TableSection
 * @hideconstructor
 * @classdesc
 *
 * The `GridSection` class maps all or - if `filter()` is overwritten - a
 * subset of the underlying UCI configuration sections of a given type.
 *
 * A grid section functions similar to a {@link LuCI.form.TableSection} but
 * supports tabbing in the modal overlay. Option elements added with
 * [option()]{@link LuCI.form.GridSection#option} are shown in the table while
 * elements added with [taboption()]{@link LuCI.form.GridSection#taboption}
 * are displayed in the modal popup.
 *
 * Another important difference is that the table cells show a readonly text
 * preview of the corresponding option elements by default, unless the child
 * option element is explicitly made writable by setting the `editable`
 * property to `true`.
 *
 * Additionally, the grid section honours a `modalonly` property of child
 * option elements. Refer to the [AbstractValue]{@link LuCI.form.AbstractValue}
 * documentation for details.
 *
 * Layout wise, a grid section looks mostly identical to table sections.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [section()]{@link LuCI.form.Map#section}.
 *
 * @param {string} section_type
 * The type of the UCI section to map.
 *
 * @param {string} [title]
 * The title caption of the form section element.
 *
 * @param {string} [description]
 * The description text of the form section element.
 */
var CBIGridSection = CBITableSection.extend(/** @lends LuCI.form.GridSection.prototype */ {
	/**
	 * Add an option tab to the section.
	 *
	 * The modal option elements of a grid section may be divided into multiple
	 * tabs to provide a better overview to the user.
	 *
	 * Before options can be moved into a tab pane, the corresponding tab
	 * has to be defined first, which is done by calling this function.
	 *
	 * Note that tabs are only effective in modal popups, options added with
	 * `option()` will not be assigned to a specific tab and are rendered in
	 * the table view only.
	 *
	 * @param {string} name
	 * The name of the tab to register. It may be freely chosen and just serves
	 * as an identifier to differentiate tabs.
	 *
	 * @param {string} title
	 * The human readable caption of the tab.
	 *
	 * @param {string} [description]
	 * An additional description text for the corresponding tab pane. It is
	 * displayed as text paragraph below the tab but before the tab pane
	 * contents. If omitted, no description will be rendered.
	 *
	 * @throws {Error}
	 * Throws an exception if a tab with the same `name` already exists.
	 */
	tab: function(name, title, description) {
		CBIAbstractSection.prototype.tab.call(this, name, title, description);
	},

	/** @private */
	handleAdd: function(ev, name) {
		var config_name = this.uciconfig || this.map.config,
		    section_id = this.map.data.add(config_name, this.sectiontype, name),
		    mapNode = this.getPreviousModalMap(),
		    prevMap = mapNode ? dom.findClassInstance(mapNode) : this.map;

		prevMap.addedSection = section_id;

		return this.renderMoreOptionsModal(section_id);
	},

	/** @private */
	handleModalSave: function(/* ... */) {
		var mapNode = this.getPreviousModalMap(),
		    prevMap = mapNode ? dom.findClassInstance(mapNode) : this.map;

		return this.super('handleModalSave', arguments);
	},

	/** @private */
	handleModalCancel: function(modalMap, ev, isSaving) {
		var config_name = this.uciconfig || this.map.config,
		    mapNode = this.getPreviousModalMap(),
		    prevMap = mapNode ? dom.findClassInstance(mapNode) : this.map;

		if (prevMap.addedSection != null && !isSaving)
			this.map.data.remove(config_name, prevMap.addedSection);

		delete prevMap.addedSection;

		return this.super('handleModalCancel', arguments);
	},

	/** @private */
	renderUCISection: function(section_id) {
		return this.renderOptions(null, section_id);
	},

	/** @private */
	renderChildren: function(tab_name, section_id, in_table) {
		var tasks = [], index = 0;

		for (var i = 0, opt; (opt = this.children[i]) != null; i++) {
			if (opt.disable || opt.modalonly)
				continue;

			if (opt.editable)
				tasks.push(opt.render(index++, section_id, in_table));
			else
				tasks.push(this.renderTextValue(section_id, opt));
		}

		return Promise.all(tasks);
	},

	/** @private */
	renderTextValue: function(section_id, opt) {
		var title = this.stripTags(opt.title).trim(),
		    descr = this.stripTags(opt.description).trim(),
		    value = opt.textvalue(section_id);

		return E('td', {
			'class': 'td cbi-value-field',
			'data-title': (title != '') ? title : null,
			'data-description': (descr != '') ? descr : null,
			'data-name': opt.option,
			'data-widget': 'CBI.DummyValue'
		}, (value != null) ? value : E('em', _('none')));
	},

	/** @private */
	renderHeaderRows: function(section_id) {
		return this.super('renderHeaderRows', [ NaN, true ]);
	},

	/** @private */
	renderRowActions: function(section_id) {
		return this.super('renderRowActions', [ section_id, _('Edit') ]);
	},

	/** @override */
	parse: function() {
		var section_ids = this.cfgsections(),
		    tasks = [];

		if (Array.isArray(this.children)) {
			for (var i = 0; i < section_ids.length; i++) {
				for (var j = 0; j < this.children.length; j++) {
					if (!this.children[j].editable || this.children[j].modalonly)
						continue;

					tasks.push(this.children[j].parse(section_ids[i]));
				}
			}
		}

		return Promise.all(tasks);
	}
});

/**
 * @class NamedSection
 * @memberof LuCI.form
 * @augments LuCI.form.AbstractSection
 * @hideconstructor
 * @classdesc
 *
 * The `NamedSection` class maps exactly one UCI section instance which is
 * specified when constructing the class instance.
 *
 * Layout and functionality wise, a named section is essentially a
 * `TypedSection` which allows exactly one section node.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [section()]{@link LuCI.form.Map#section}.
 *
 * @param {string} section_id
 * The name (ID) of the UCI section to map.
 *
 * @param {string} section_type
 * The type of the UCI section to map.
 *
 * @param {string} [title]
 * The title caption of the form section element.
 *
 * @param {string} [description]
 * The description text of the form section element.
 */
var CBINamedSection = CBIAbstractSection.extend(/** @lends LuCI.form.NamedSection.prototype */ {
	__name__: 'CBI.NamedSection',
	__init__: function(map, section_id /*, ... */) {
		this.super('__init__', this.varargs(arguments, 2, map));

		this.section = section_id;
	},

	/**
	 * If set to `true`, the user may remove or recreate the sole mapped
	 * configuration instance from the form section widget, otherwise only a
	 * preexisting section may be edited. The default is `false`.
	 *
	 * @name LuCI.form.NamedSection.prototype#addremove
	 * @type boolean
	 * @default false
	 */

	/**
	 * Override the UCI configuration name to read the section IDs from. By
	 * default, the configuration name is inherited from the parent `Map`.
	 * By setting this property, a deviating configuration may be specified.
	 * The default is `null`, means inheriting from the parent form.
	 *
	 * @name LuCI.form.NamedSection.prototype#uciconfig
	 * @type string
	 * @default null
	 */

	/**
	 * The `NamedSection` class overwrites the generic `cfgsections()`
	 * implementation to return a one-element array containing the mapped
	 * section ID as sole element. User code should not normally change this.
	 *
	 * @returns {string[]}
	 * Returns a one-element array containing the mapped section ID.
	 */
	cfgsections: function() {
		return [ this.section ];
	},

	/** @private */
	handleAdd: function(ev) {
		var section_id = this.section,
		    config_name = this.uciconfig || this.map.config;

		this.map.data.add(config_name, this.sectiontype, section_id);
		return this.map.save(null, true);
	},

	/** @private */
	handleRemove: function(ev) {
		var section_id = this.section,
		    config_name = this.uciconfig || this.map.config;

		this.map.data.remove(config_name, section_id);
		return this.map.save(null, true);
	},

	/** @private */
	renderContents: function(data) {
		var ucidata = data[0], nodes = data[1],
		    section_id = this.section,
		    config_name = this.uciconfig || this.map.config,
		    sectionEl = E('div', {
				'id': ucidata ? null : 'cbi-%s-%s'.format(config_name, section_id),
				'class': 'cbi-section',
				'data-tab': (this.map.tabbed && !this.parentoption) ? this.sectiontype : null,
				'data-tab-title': (this.map.tabbed && !this.parentoption) ? this.title || this.sectiontype : null
			});

		if (typeof(this.title) === 'string' && this.title !== '')
			sectionEl.appendChild(E('h3', {}, this.title));

		if (typeof(this.description) === 'string' && this.description !== '')
			sectionEl.appendChild(E('div', { 'class': 'cbi-section-descr' }, this.description));

		if (ucidata) {
			if (this.addremove) {
				sectionEl.appendChild(
					E('div', { 'class': 'cbi-section-remove right' },
						E('button', {
							'class': 'cbi-button',
							'click': ui.createHandlerFn(this, 'handleRemove'),
							'disabled': this.map.readonly || null
						}, [ _('Delete') ])));
			}

			sectionEl.appendChild(E('div', {
				'id': 'cbi-%s-%s'.format(config_name, section_id),
				'class': this.tabs
					? 'cbi-section-node cbi-section-node-tabbed' : 'cbi-section-node',
				'data-section-id': section_id
			}, nodes));
		}
		else if (this.addremove) {
			sectionEl.appendChild(
				E('button', {
					'class': 'cbi-button cbi-button-add',
					'click': ui.createHandlerFn(this, 'handleAdd'),
					'disabled': this.map.readonly || null
				}, [ _('Add') ]));
		}

		dom.bindClassInstance(sectionEl, this);

		return sectionEl;
	},

	/** @override */
	render: function() {
		var config_name = this.uciconfig || this.map.config,
		    section_id = this.section;

		return Promise.all([
			this.map.data.get(config_name, section_id),
			this.renderUCISection(section_id)
		]).then(this.renderContents.bind(this));
	}
});

/**
 * @class Value
 * @memberof LuCI.form
 * @augments LuCI.form.AbstractValue
 * @hideconstructor
 * @classdesc
 *
 * The `Value` class represents a simple one-line form input using the
 * {@link LuCI.ui.Textfield} or - in case choices are added - the
 * {@link LuCI.ui.Combobox} class as underlying widget.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIValue = CBIAbstractValue.extend(/** @lends LuCI.form.Value.prototype */ {
	__name__: 'CBI.Value',

	/**
	 * If set to `true`, the field is rendered as password input, otherwise
	 * as plain text input.
	 *
	 * @name LuCI.form.Value.prototype#password
	 * @type boolean
	 * @default false
	 */

	/**
	 * Set a placeholder string to use when the input field is empty.
	 *
	 * @name LuCI.form.Value.prototype#placeholder
	 * @type string
	 * @default null
	 */

	/**
	 * Add a predefined choice to the form option. By adding one or more
	 * choices, the plain text input field is turned into a combobox widget
	 * which prompts the user to select a predefined choice, or to enter a
	 * custom value.
	 *
	 * @param {string} key
	 * The choice value to add.
	 *
	 * @param {Node|string} val
	 * The caption for the choice value. May be a DOM node, a document fragment
	 * or a plain text string. If omitted, the `key` value is used as caption.
	 */
	value: function(key, val) {
		this.keylist = this.keylist || [];
		this.keylist.push(String(key));

		this.vallist = this.vallist || [];
		this.vallist.push(dom.elem(val) ? val : String(val != null ? val : key));
	},

	/** @override */
	render: function(option_index, section_id, in_table) {
		return Promise.resolve(this.cfgvalue(section_id))
			.then(this.renderWidget.bind(this, section_id, option_index))
			.then(this.renderFrame.bind(this, section_id, in_table, option_index));
	},

	/** @private */
	handleValueChange: function(section_id, state, ev) {
		if (typeof(this.onchange) != 'function')
			return;

		var value = this.formvalue(section_id);

		if (isEqual(value, state.previousValue))
			return;

		state.previousValue = value;
		this.onchange.call(this, ev, section_id, value);
	},

	/** @private */
	renderFrame: function(section_id, in_table, option_index, nodes) {
		var config_name = this.uciconfig || this.section.uciconfig || this.map.config,
		    depend_list = this.transformDepList(section_id),
		    optionEl;

		if (in_table) {
			var title = this.stripTags(this.title).trim();
			optionEl = E('td', {
				'class': 'td cbi-value-field',
				'data-title': (title != '') ? title : null,
				'data-description': this.stripTags(this.description).trim(),
				'data-name': this.option,
				'data-widget': this.typename || (this.template ? this.template.replace(/^.+\//, '') : null) || this.__name__
			}, E('div', {
				'id': 'cbi-%s-%s-%s'.format(config_name, section_id, this.option),
				'data-index': option_index,
				'data-depends': depend_list,
				'data-field': this.cbid(section_id)
			}));
		}
		else {
			optionEl = E('div', {
				'class': 'cbi-value',
				'id': 'cbi-%s-%s-%s'.format(config_name, section_id, this.option),
				'data-index': option_index,
				'data-depends': depend_list,
				'data-field': this.cbid(section_id),
				'data-name': this.option,
				'data-widget': this.typename || (this.template ? this.template.replace(/^.+\//, '') : null) || this.__name__
			});

			if (this.last_child)
				optionEl.classList.add('cbi-value-last');

			if (typeof(this.title) === 'string' && this.title !== '') {
				optionEl.appendChild(E('label', {
					'class': 'cbi-value-title',
					'for': 'widget.cbid.%s.%s.%s'.format(config_name, section_id, this.option),
					'click': function(ev) {
						var node = ev.currentTarget,
						    elem = node.nextElementSibling.querySelector('#' + node.getAttribute('for')) || node.nextElementSibling.querySelector('[data-widget-id="' + node.getAttribute('for') + '"]');

						if (elem) {
							elem.click();
							elem.focus();
						}
					}
				},
				this.titleref ? E('a', {
					'class': 'cbi-title-ref',
					'href': this.titleref,
					'title': this.titledesc || _('Go to relevant configuration page')
				}, this.title) : this.title));

				optionEl.appendChild(E('div', { 'class': 'cbi-value-field' }));
			}
		}

		if (nodes)
			(optionEl.lastChild || optionEl).appendChild(nodes);

		if (!in_table && typeof(this.description) === 'string' && this.description !== '')
			dom.append(optionEl.lastChild || optionEl,
				E('div', { 'class': 'cbi-value-description' }, this.description.trim()));

		if (depend_list && depend_list.length)
			optionEl.classList.add('hidden');

		optionEl.addEventListener('widget-change',
			L.bind(this.map.checkDepends, this.map));

		optionEl.addEventListener('widget-change',
			L.bind(this.handleValueChange, this, section_id, {}));

		dom.bindClassInstance(optionEl, this);

		return optionEl;
	},

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var value = (cfgvalue != null) ? cfgvalue : this.default,
		    choices = this.transformChoices(),
		    widget;

		if (choices) {
			var placeholder = (this.optional || this.rmempty)
				? E('em', _('unspecified')) : _('-- Please choose --');

			widget = new ui.Combobox(Array.isArray(value) ? value.join(' ') : value, choices, {
				id: this.cbid(section_id),
				sort: this.keylist,
				optional: this.optional || this.rmempty,
				datatype: this.datatype,
				select_placeholder: this.placeholder || placeholder,
				validate: L.bind(this.validate, this, section_id),
				disabled: (this.readonly != null) ? this.readonly : this.map.readonly
			});
		}
		else {
			widget = new ui.Textfield(Array.isArray(value) ? value.join(' ') : value, {
				id: this.cbid(section_id),
				password: this.password,
				optional: this.optional || this.rmempty,
				datatype: this.datatype,
				placeholder: this.placeholder,
				validate: L.bind(this.validate, this, section_id),
				disabled: (this.readonly != null) ? this.readonly : this.map.readonly
			});
		}

		return widget.render();
	}
});

/**
 * @class DynamicList
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `DynamicList` class represents a multi value widget allowing the user
 * to enter multiple unique values, optionally selected from a set of
 * predefined choices. It builds upon the {@link LuCI.ui.DynamicList} widget.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIDynamicList = CBIValue.extend(/** @lends LuCI.form.DynamicList.prototype */ {
	__name__: 'CBI.DynamicList',

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var value = (cfgvalue != null) ? cfgvalue : this.default,
		    choices = this.transformChoices(),
		    items = L.toArray(value);

		var widget = new ui.DynamicList(items, choices, {
			id: this.cbid(section_id),
			sort: this.keylist,
			optional: this.optional || this.rmempty,
			datatype: this.datatype,
			placeholder: this.placeholder,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	},
});

/**
 * @class ListValue
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `ListValue` class implements a simple static HTML select element
 * allowing the user to choose a single value from a set of predefined choices.
 * It builds upon the {@link LuCI.ui.Select} widget.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIListValue = CBIValue.extend(/** @lends LuCI.form.ListValue.prototype */ {
	__name__: 'CBI.ListValue',

	__init__: function() {
		this.super('__init__', arguments);
		this.widget = 'select';
		this.orientation = 'horizontal';
		this.deplist = [];
	},

	/**
	 * Set the size attribute of the underlying HTML select element.
	 *
	 * @name LuCI.form.ListValue.prototype#size
	 * @type number
	 * @default null
	 */

	/**
	 * Set the type of the underlying form controls.
	 *
	 * May be one of `select` or `radio`. If set to `select`, an HTML
	 * select element is rendered, otherwise a collection of `radio`
	 * elements is used.
	 *
	 * @name LuCI.form.ListValue.prototype#widget
	 * @type string
	 * @default select
	 */

	/**
	 * Set the orientation of the underlying radio or checkbox elements.
	 *
	 * May be one of `horizontal` or `vertical`. Only applies to non-select
	 * widget types.
	 *
	 * @name LuCI.form.ListValue.prototype#orientation
	 * @type string
	 * @default horizontal
	 */

	 /** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var choices = this.transformChoices();
		var widget = new ui.Select((cfgvalue != null) ? cfgvalue : this.default, choices, {
			id: this.cbid(section_id),
			size: this.size,
			sort: this.keylist,
			widget: this.widget,
			optional: this.optional,
			orientation: this.orientation,
			placeholder: this.placeholder,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	},
});

/**
 * @class FlagValue
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `FlagValue` element builds upon the {@link LuCI.ui.Checkbox} widget to
 * implement a simple checkbox element.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIFlagValue = CBIValue.extend(/** @lends LuCI.form.FlagValue.prototype */ {
	__name__: 'CBI.FlagValue',

	__init__: function() {
		this.super('__init__', arguments);

		this.enabled = '1';
		this.disabled = '0';
		this.default = this.disabled;
	},

	/**
	 * Sets the input value to use for the checkbox checked state.
	 *
	 * @name LuCI.form.FlagValue.prototype#enabled
	 * @type string
	 * @default 1
	 */

	/**
	 * Sets the input value to use for the checkbox unchecked state.
	 *
	 * @name LuCI.form.FlagValue.prototype#disabled
	 * @type string
	 * @default 0
	 */

	/**
	 * Set a tooltip for the flag option.
	 *
	 * If set to a string, it will be used as-is as a tooltip.
	 *
	 * If set to a function, the function will be invoked and the return
	 * value will be shown as a tooltip. If the return value of the function
	 * is `null` no tooltip will be set.
	 *
	 * @name LuCI.form.FlagValue.prototype#tooltip
	 * @type string|function
	 * @default null
	 */

	/**
	 * Set a tooltip icon for the flag option.
	 *
	 * If set, this icon will be shown for the default one.
	 * This could also be a png icon from the resources directory.
	 *
	 * @name LuCI.form.FlagValue.prototype#tooltipicon
	 * @type string
	 * @default 'ℹ️';
	 */

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var tooltip = null;

		if (typeof(this.tooltip) == 'function')
			tooltip = this.tooltip.apply(this, [section_id]);
		else if (typeof(this.tooltip) == 'string')
			tooltip = (arguments.length > 1) ? ''.format.apply(this.tooltip, this.varargs(arguments, 1)) : this.tooltip;

		var widget = new ui.Checkbox((cfgvalue != null) ? cfgvalue : this.default, {
			id: this.cbid(section_id),
			value_enabled: this.enabled,
			value_disabled: this.disabled,
			validate: L.bind(this.validate, this, section_id),
			tooltip: tooltip,
			tooltipicon: this.tooltipicon,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	},

	/**
	 * Query the checked state of the underlying checkbox widget and return
	 * either the `enabled` or the `disabled` property value, depending on
	 * the checked state.
	 *
	 * @override
	 */
	formvalue: function(section_id) {
		var elem = this.getUIElement(section_id),
		    checked = elem ? elem.isChecked() : false;
		return checked ? this.enabled : this.disabled;
	},

	/**
	 * Query the checked state of the underlying checkbox widget and return
	 * either a localized `Yes` or `No` string, depending on the checked state.
	 *
	 * @override
	 */
	textvalue: function(section_id) {
		var cval = this.cfgvalue(section_id);

		if (cval == null)
			cval = this.default;

		return (cval == this.enabled) ? _('Yes') : _('No');
	},

	/** @override */
	parse: function(section_id) {
		if (this.isActive(section_id)) {
			var fval = this.formvalue(section_id);

			if (!this.isValid(section_id)) {
				var title = this.stripTags(this.title).trim();
				var error = this.getValidationError(section_id);
				return Promise.reject(new TypeError(
					_('Option "%s" contains an invalid input value.').format(title || this.option) + ' ' + error));
			}

			if (fval == this.default && (this.optional || this.rmempty))
				return Promise.resolve(this.remove(section_id));
			else
				return Promise.resolve(this.write(section_id, fval));
		}
		else if (!this.retain) {
			return Promise.resolve(this.remove(section_id));
		}
	},
});

/**
 * @class MultiValue
 * @memberof LuCI.form
 * @augments LuCI.form.DynamicList
 * @hideconstructor
 * @classdesc
 *
 * The `MultiValue` class is a modified variant of the `DynamicList` element
 * which leverages the {@link LuCI.ui.Dropdown} widget to implement a multi
 * select dropdown element.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIMultiValue = CBIDynamicList.extend(/** @lends LuCI.form.MultiValue.prototype */ {
	__name__: 'CBI.MultiValue',

	__init__: function() {
		this.super('__init__', arguments);
		this.placeholder = _('-- Please choose --');
	},

	/**
	 * Allows to specify the [display_items]{@link LuCI.ui.Dropdown.InitOptions}
	 * property of the underlying dropdown widget. If omitted, the value of
	 * the `size` property is used or `3` when `size` is unspecified as well.
	 *
	 * @name LuCI.form.MultiValue.prototype#display_size
	 * @type number
	 * @default null
	 */

	/**
	 * Allows to specify the [dropdown_items]{@link LuCI.ui.Dropdown.InitOptions}
	 * property of the underlying dropdown widget. If omitted, the value of
	 * the `size` property is used or `-1` when `size` is unspecified as well.
	 *
	 * @name LuCI.form.MultiValue.prototype#dropdown_size
	 * @type number
	 * @default null
	 */

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var value = (cfgvalue != null) ? cfgvalue : this.default,
		    choices = this.transformChoices();

		var widget = new ui.Dropdown(L.toArray(value), choices, {
			id: this.cbid(section_id),
			sort: this.keylist,
			multiple: true,
			optional: this.optional || this.rmempty,
			select_placeholder: this.placeholder,
			display_items: this.display_size || this.size || 3,
			dropdown_items: this.dropdown_size || this.size || -1,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	},
});

/**
 * @class TextValue
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `TextValue` class implements a multi-line textarea input using
 * {@link LuCI.ui.Textarea}.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBITextValue = CBIValue.extend(/** @lends LuCI.form.TextValue.prototype */ {
	__name__: 'CBI.TextValue',

	/** @ignore */
	value: null,

	/**
	 * Enforces the use of a monospace font for the textarea contents when set
	 * to `true`.
	 *
	 * @name LuCI.form.TextValue.prototype#monospace
	 * @type boolean
	 * @default false
	 */

	/**
	 * Allows to specify the [cols]{@link LuCI.ui.Textarea.InitOptions}
	 * property of the underlying textarea widget.
	 *
	 * @name LuCI.form.TextValue.prototype#cols
	 * @type number
	 * @default null
	 */

	/**
	 * Allows to specify the [rows]{@link LuCI.ui.Textarea.InitOptions}
	 * property of the underlying textarea widget.
	 *
	 * @name LuCI.form.TextValue.prototype#rows
	 * @type number
	 * @default null
	 */

	/**
	 * Allows to specify the [wrap]{@link LuCI.ui.Textarea.InitOptions}
	 * property of the underlying textarea widget.
	 *
	 * @name LuCI.form.TextValue.prototype#wrap
	 * @type number
	 * @default null
	 */

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var value = (cfgvalue != null) ? cfgvalue : this.default;

		var widget = new ui.Textarea(value, {
			id: this.cbid(section_id),
			optional: this.optional || this.rmempty,
			placeholder: this.placeholder,
			monospace: this.monospace,
			cols: this.cols,
			rows: this.rows,
			wrap: this.wrap,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	}
});

/**
 * @class DummyValue
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `DummyValue` element wraps an {@link LuCI.ui.Hiddenfield} widget and
 * renders the underlying UCI option or default value as readonly text.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIDummyValue = CBIValue.extend(/** @lends LuCI.form.DummyValue.prototype */ {
	__name__: 'CBI.DummyValue',

	/**
	 * Set a URL which is opened when clicking on the dummy value text.
	 *
	 * By setting this property, the dummy value text is wrapped in an `<a>`
	 * element with the property value used as `href` attribute.
	 *
	 * @name LuCI.form.DummyValue.prototype#href
	 * @type string
	 * @default null
	 */

	/**
	 * Treat the UCI option value (or the `default` property value) as HTML.
	 *
	 * By default, the value text is HTML escaped before being rendered as
	 * text. In some cases it may be needed to actually interpret and render
	 * HTML contents as-is. When set to `true`, HTML escaping is disabled.
	 *
	 * @name LuCI.form.DummyValue.prototype#rawhtml
	 * @type boolean
	 * @default null
	 */

    /**
	 * Render the UCI option value as hidden using the HTML display: none style property.
	 *
	 * By default, the value is displayed
	 *
	 * @name LuCI.form.DummyValue.prototype#hidden
	 * @type boolean
	 * @default null
	 */

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var value = (cfgvalue != null) ? cfgvalue : this.default,
		    hiddenEl = new ui.Hiddenfield(value, { id: this.cbid(section_id) }),
		    outputEl = E('div', { 'style': this.hidden ? 'display:none' : null });

		if (this.href && !((this.readonly != null) ? this.readonly : this.map.readonly))
			outputEl.appendChild(E('a', { 'href': this.href }));

		dom.append(outputEl.lastChild || outputEl,
			this.rawhtml ? value : [ value ]);

		return E([
			outputEl,
			hiddenEl.render()
		]);
	},

	/** @override */
	remove: function() {},

	/** @override */
	write: function() {}
});

/**
 * @class ButtonValue
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `DummyValue` element wraps an {@link LuCI.ui.Hiddenfield} widget and
 * renders the underlying UCI option or default value as readonly text.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIButtonValue = CBIValue.extend(/** @lends LuCI.form.ButtonValue.prototype */ {
	__name__: 'CBI.ButtonValue',

	/**
	 * Override the rendered button caption.
	 *
	 * By default, the option title - which is passed as fourth argument to the
	 * constructor - is used as caption for the button element. When setting
	 * this property to a string, it is used as `String.format()` pattern with
	 * the underlying UCI section name passed as first format argument. When
	 * set to a function, it is invoked passing the section ID as sole argument
	 * and the resulting return value is converted to a string before being
	 * used as button caption.
	 *
	 * The default is `null`, means the option title is used as caption.
	 *
	 * @name LuCI.form.ButtonValue.prototype#inputtitle
	 * @type string|function
	 * @default null
	 */

	/**
	 * Override the button style class.
	 *
	 * By setting this property, a specific `cbi-button-*` CSS class can be
	 * selected to influence the style of the resulting button.
	 *
	 * Suitable values which are implemented by most themes are `positive`,
	 * `negative` and `primary`.
	 *
	 * The default is `null`, means a neutral button styling is used.
	 *
	 * @name LuCI.form.ButtonValue.prototype#inputstyle
	 * @type string
	 * @default null
	 */

	/**
	 * Override the button click action.
	 *
	 * By default, the underlying UCI option (or default property) value is
	 * copied into a hidden field tied to the button element and the save
	 * action is triggered on the parent form element.
	 *
	 * When this property is set to a function, it is invoked instead of
	 * performing the default actions. The handler function will receive the
	 * DOM click element as first and the underlying configuration section ID
	 * as second argument.
	 *
	 * @name LuCI.form.ButtonValue.prototype#onclick
	 * @type function
	 * @default null
	 */

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var value = (cfgvalue != null) ? cfgvalue : this.default,
		    hiddenEl = new ui.Hiddenfield(value, { id: this.cbid(section_id) }),
		    outputEl = E('div'),
		    btn_title = this.titleFn('inputtitle', section_id) || this.titleFn('title', section_id);

		if (value !== false)
			dom.content(outputEl, [
				E('button', {
					'class': 'cbi-button cbi-button-%s'.format(this.inputstyle || 'button'),
					'click': ui.createHandlerFn(this, function(section_id, ev) {
						if (this.onclick)
							return this.onclick(ev, section_id);

						ev.currentTarget.parentNode.nextElementSibling.value = value;
						return this.map.save();
					}, section_id),
					'disabled': ((this.readonly != null) ? this.readonly : this.map.readonly) || null
				}, [ btn_title ])
			]);
		else
			dom.content(outputEl, ' - ');

		return E([
			outputEl,
			hiddenEl.render()
		]);
	}
});

/**
 * @class HiddenValue
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `HiddenValue` element wraps an {@link LuCI.ui.Hiddenfield} widget.
 *
 * Hidden value widgets used to be necessary in legacy code which actually
 * submitted the underlying HTML form the server. With client side handling of
 * forms, there are more efficient ways to store hidden state data.
 *
 * Since this widget has no visible content, the title and description values
 * of this form element should be set to `null` as well to avoid a broken or
 * distorted form layout when rendering the option element.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIHiddenValue = CBIValue.extend(/** @lends LuCI.form.HiddenValue.prototype */ {
	__name__: 'CBI.HiddenValue',

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var widget = new ui.Hiddenfield((cfgvalue != null) ? cfgvalue : this.default, {
			id: this.cbid(section_id)
		});

		return widget.render();
	}
});

/**
 * @class FileUpload
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `FileUpload` element wraps an {@link LuCI.ui.FileUpload} widget and
 * offers the ability to browse, upload and select remote files.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The name of the UCI option to map.
 *
 * @param {string} [title]
 * The title caption of the option element.
 *
 * @param {string} [description]
 * The description text of the option element.
 */
var CBIFileUpload = CBIValue.extend(/** @lends LuCI.form.FileUpload.prototype */ {
	__name__: 'CBI.FileSelect',

	__init__: function(/* ... */) {
		this.super('__init__', arguments);

		this.browser = false;
		this.show_hidden = false;
		this.enable_upload = true;
		this.enable_remove = true;
		this.enable_download = false;
		this.root_directory = '/etc/luci-uploads';
	},


	/**
	 * Open in a file browser mode instead of selecting for a file
	 *
	 * @name LuCI.form.FileUpload.prototype#browser
	 * @type boolean
	 * @default false
	 */

	/**
	 * Toggle display of hidden files.
	 *
	 * Display hidden files when rendering the remote directory listing.
	 * Note that this is merely a cosmetic feature, hidden files are always
	 * included in received remote file listings.
	 *
	 * The default is `false`, means hidden files are not displayed.
	 *
	 * @name LuCI.form.FileUpload.prototype#show_hidden
	 * @type boolean
	 * @default false
	 */

	/**
	 * Toggle file upload functionality.
	 *
	 * When set to `true`, the underlying widget provides a button which lets
	 * the user select and upload local files to the remote system.
	 * Note that this is merely a cosmetic feature, remote upload access is
	 * controlled by the session ACL rules.
	 *
	 * The default is `true`, means file upload functionality is displayed.
	 *
	 * @name LuCI.form.FileUpload.prototype#enable_upload
	 * @type boolean
	 * @default true
	 */

	/**
	 * Toggle remote file delete functionality.
	 *
	 * When set to `true`, the underlying widget provides a buttons which let
	 * the user delete files from remote directories. Note that this is merely
	 * a cosmetic feature, remote delete permissions are controlled by the
	 * session ACL rules.
	 *
	 * The default is `true`, means file removal buttons are displayed.
	 *
	 * @name LuCI.form.FileUpload.prototype#enable_remove
	 * @type boolean
	 * @default true
	 */

	/**
	 * Toggle download file functionality.
	 *
	 * @name LuCI.form.FileUpload.prototype#enable_download
	 * @type boolean
	 * @default false
	 */

	/**
	 * Specify the root directory for file browsing.
	 *
	 * This property defines the topmost directory the file browser widget may
	 * navigate to, the UI will not allow browsing directories outside this
	 * prefix. Note that this is merely a cosmetic feature, remote file access
	 * and directory listing permissions are controlled by the session ACL
	 * rules.
	 *
	 * The default is `/etc/luci-uploads`.
	 *
	 * @name LuCI.form.FileUpload.prototype#root_directory
	 * @type string
	 * @default /etc/luci-uploads
	 */

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		var browserEl = new ui.FileUpload((cfgvalue != null) ? cfgvalue : this.default, {
			id: this.cbid(section_id),
			name: this.cbid(section_id),
			browser: this.browser,
			show_hidden: this.show_hidden,
			enable_upload: this.enable_upload,
			enable_remove: this.enable_remove,
			enable_download: this.enable_download,
			root_directory: this.root_directory,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return browserEl.render();
	}
});

/**
 * @class SectionValue
 * @memberof LuCI.form
 * @augments LuCI.form.Value
 * @hideconstructor
 * @classdesc
 *
 * The `SectionValue` widget embeds a form section element within an option
 * element container, allowing to nest form sections into other sections.
 *
 * @param {LuCI.form.Map|LuCI.form.JSONMap} form
 * The configuration form this section is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {LuCI.form.AbstractSection} section
 * The configuration section this option is added to. It is automatically passed
 * by [option()]{@link LuCI.form.AbstractSection#option} or
 * [taboption()]{@link LuCI.form.AbstractSection#taboption} when adding the
 * option to the section.
 *
 * @param {string} option
 * The internal name of the option element holding the section. Since a section
 * container element does not read or write any configuration itself, the name
 * is only used internally and does not need to relate to any underlying UCI
 * option name.
 *
 * @param {LuCI.form.AbstractSection} subsection_class
 * The class to use for instantiating the nested section element. Note that
 * the class value itself is expected here, not a class instance obtained by
 * calling `new`. The given class argument must be a subclass of the
 * `AbstractSection` class.
 *
 * @param {...*} [class_args]
 * All further arguments are passed as-is to the subclass constructor. Refer
 * to the corresponding class constructor documentations for details.
 */
var CBISectionValue = CBIValue.extend(/** @lends LuCI.form.SectionValue.prototype */ {
	__name__: 'CBI.ContainerValue',
	__init__: function(map, section, option, cbiClass /*, ... */) {
		this.super('__init__', [map, section, option]);

		if (!CBIAbstractSection.isSubclass(cbiClass))
			throw 'Sub section must be a descendent of CBIAbstractSection';

		this.subsection = cbiClass.instantiate(this.varargs(arguments, 4, this.map));
		this.subsection.parentoption = this;
	},

	/**
	 * Access the embedded section instance.
	 *
	 * This property holds a reference to the instantiated nested section.
	 *
	 * @name LuCI.form.SectionValue.prototype#subsection
	 * @type LuCI.form.AbstractSection
	 * @readonly
	 */

	/** @override */
	load: function(section_id) {
		return this.subsection.load(section_id);
	},

	/** @override */
	parse: function(section_id) {
		return this.subsection.parse(section_id);
	},

	/** @private */
	renderWidget: function(section_id, option_index, cfgvalue) {
		return this.subsection.render(section_id);
	},

	/** @private */
	checkDepends: function(section_id) {
		this.subsection.checkDepends(section_id);
		return CBIValue.prototype.checkDepends.apply(this, [ section_id ]);
	},

	/**
	 * Since the section container is not rendering an own widget,
	 * its `value()` implementation is a no-op.
	 *
	 * @override
	 */
	value: function() {},

	/**
	 * Since the section container is not tied to any UCI configuration,
	 * its `write()` implementation is a no-op.
	 *
	 * @override
	 */
	write: function() {},

	/**
	 * Since the section container is not tied to any UCI configuration,
	 * its `remove()` implementation is a no-op.
	 *
	 * @override
	 */
	remove: function() {},

	/**
	 * Since the section container is not tied to any UCI configuration,
	 * its `cfgvalue()` implementation will always return `null`.
	 *
	 * @override
	 * @returns {null}
	 */
	cfgvalue: function() { return null },

	/**
	 * Since the section container is not tied to any UCI configuration,
	 * its `formvalue()` implementation will always return `null`.
	 *
	 * @override
	 * @returns {null}
	 */
	formvalue: function() { return null }
});

/**
 * @class form
 * @memberof LuCI
 * @hideconstructor
 * @classdesc
 *
 * The LuCI form class provides high level abstractions for creating
 * UCI- or JSON backed configurations forms.
 *
 * To import the class in views, use `'require form'`, to import it in
 * external JavaScript, use `L.require("form").then(...)`.
 *
 * A typical form is created by first constructing a
 * {@link LuCI.form.Map} or {@link LuCI.form.JSONMap} instance using `new` and
 * by subsequently adding sections and options to it. Finally
 * [render()]{@link LuCI.form.Map#render} is invoked on the instance to
 * assemble the HTML markup and insert it into the DOM.
 *
 * Example:
 *
 * <pre>
 * 'use strict';
 * 'require form';
 *
 * var m, s, o;
 *
 * m = new form.Map('example', 'Example form',
 *	'This is an example form mapping the contents of /etc/config/example');
 *
 * s = m.section(form.NamedSection, 'first_section', 'example', 'The first section',
 * 	'This sections maps "config example first_section" of /etc/config/example');
 *
 * o = s.option(form.Flag, 'some_bool', 'A checkbox option');
 *
 * o = s.option(form.ListValue, 'some_choice', 'A select element');
 * o.value('choice1', 'The first choice');
 * o.value('choice2', 'The second choice');
 *
 * m.render().then(function(node) {
 * 	document.body.appendChild(node);
 * });
 * </pre>
 */
return baseclass.extend(/** @lends LuCI.form.prototype */ {
	Map: CBIMap,
	JSONMap: CBIJSONMap,
	AbstractSection: CBIAbstractSection,
	AbstractValue: CBIAbstractValue,

	TypedSection: CBITypedSection,
	TableSection: CBITableSection,
	GridSection: CBIGridSection,
	NamedSection: CBINamedSection,

	Value: CBIValue,
	DynamicList: CBIDynamicList,
	ListValue: CBIListValue,
	Flag: CBIFlagValue,
	MultiValue: CBIMultiValue,
	TextValue: CBITextValue,
	DummyValue: CBIDummyValue,
	Button: CBIButtonValue,
	HiddenValue: CBIHiddenValue,
	FileUpload: CBIFileUpload,
	SectionValue: CBISectionValue
});
