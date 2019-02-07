'use strict';

var modalDiv = null,
    tooltipDiv = null,
    tooltipTimeout = null;

var UIElement = L.Class.extend({
	getValue: function() {
		if (L.dom.matches(this.node, 'select') || L.dom.matches(this.node, 'input'))
			return this.node.value;

		return null;
	},

	setValue: function(value) {
		if (L.dom.matches(this.node, 'select') || L.dom.matches(this.node, 'input'))
			this.node.value = value;
	},

	isValid: function() {
		return true;
	},

	registerEvents: function(targetNode, synevent, events) {
		var dispatchFn = L.bind(function(ev) {
			this.node.dispatchEvent(new CustomEvent(synevent, { bubbles: true }));
		}, this);

		for (var i = 0; i < events.length; i++)
			targetNode.addEventListener(events[i], dispatchFn);
	},

	setUpdateEvents: function(targetNode /*, ... */) {
		this.registerEvents(targetNode, 'widget-update', this.varargs(arguments, 1));
	},

	setChangeEvents: function(targetNode /*, ... */) {
		this.registerEvents(targetNode, 'widget-change', this.varargs(arguments, 1));
	}
});

var UIDropdown = UIElement.extend({
	__init__: function(value, choices, options) {
		if (typeof(choices) != 'object')
			choices = {};

		if (!Array.isArray(value))
			this.values = (value != null) ? [ value ] : [];
		else
			this.values = value;

		this.choices = choices;
		this.options = Object.assign({
			sort:               true,
			multi:              Array.isArray(value),
			optional:           true,
			select_placeholder: _('-- Please choose --'),
			custom_placeholder: _('-- custom --'),
			display_items:      3,
			dropdown_items:     5,
			create:             false,
			create_query:       '.create-item-input',
			create_template:    'script[type="item-template"]'
		}, options);
	},

	render: function() {
		var sb = E('div', {
			'id': this.options.id,
			'class': 'cbi-dropdown',
			'multiple': this.options.multi ? '' : null,
			'optional': this.options.optional ? '' : null,
		}, E('ul'));

		var keys = Object.keys(this.choices);

		if (this.options.sort === true)
			keys.sort();
		else if (Array.isArray(this.options.sort))
			keys = this.options.sort;

		if (this.options.create)
			for (var i = 0; i < this.values.length; i++)
				if (!this.choices.hasOwnProperty(this.values[i]))
					keys.push(this.values[i]);

		for (var i = 0; i < keys.length; i++)
			sb.lastElementChild.appendChild(E('li', {
				'data-value': keys[i],
				'selected': (this.values.indexOf(keys[i]) > -1) ? '' : null
			}, this.choices[keys[i]] || keys[i]));

		if (this.options.create) {
			var createEl = E('input', {
				'type': 'text',
				'class': 'create-item-input',
				'placeholder': this.options.custom_placeholder || this.options.placeholder
			});

			if (this.options.datatype)
				L.ui.addValidator(createEl, this.options.datatype, true, 'blur', 'keyup');

			sb.lastElementChild.appendChild(E('li', { 'data-value': '-' }, createEl));
		}

		return this.bind(sb);
	},

	bind: function(sb) {
		var o = this.options;

		o.multi = sb.hasAttribute('multiple');
		o.optional = sb.hasAttribute('optional');
		o.placeholder = sb.getAttribute('placeholder') || o.placeholder;
		o.display_items = parseInt(sb.getAttribute('display-items') || o.display_items);
		o.dropdown_items = parseInt(sb.getAttribute('dropdown-items') || o.dropdown_items);
		o.create_query = sb.getAttribute('item-create') || o.create_query;
		o.create_template = sb.getAttribute('item-template') || o.create_template;

		var ul = sb.querySelector('ul'),
		    more = sb.appendChild(E('span', { class: 'more', tabindex: -1 }, '···')),
		    open = sb.appendChild(E('span', { class: 'open', tabindex: -1 }, '▾')),
		    canary = sb.appendChild(E('div')),
		    create = sb.querySelector(this.options.create_query),
		    ndisplay = this.options.display_items,
		    n = 0;

		if (this.options.multi) {
			var items = ul.querySelectorAll('li');

			for (var i = 0; i < items.length; i++) {
				this.transformItem(sb, items[i]);

				if (items[i].hasAttribute('selected') && ndisplay-- > 0)
					items[i].setAttribute('display', n++);
			}
		}
		else {
			if (this.options.optional && !ul.querySelector('li[data-value=""]')) {
				var placeholder = E('li', { placeholder: '' },
					this.options.select_placeholder || this.options.placeholder);

				ul.firstChild
					? ul.insertBefore(placeholder, ul.firstChild)
					: ul.appendChild(placeholder);
			}

			var items = ul.querySelectorAll('li'),
			    sel = sb.querySelectorAll('[selected]');

			sel.forEach(function(s) {
				s.removeAttribute('selected');
			});

			var s = sel[0] || items[0];
			if (s) {
				s.setAttribute('selected', '');
				s.setAttribute('display', n++);
			}

			ndisplay--;
		}

		this.saveValues(sb, ul);

		ul.setAttribute('tabindex', -1);
		sb.setAttribute('tabindex', 0);

		if (ndisplay < 0)
			sb.setAttribute('more', '')
		else
			sb.removeAttribute('more');

		if (ndisplay == this.options.display_items)
			sb.setAttribute('empty', '')
		else
			sb.removeAttribute('empty');

		more.innerHTML = (ndisplay == this.options.display_items)
			? (this.options.select_placeholder || this.options.placeholder) : '···';


		sb.addEventListener('click', this.handleClick.bind(this));
		sb.addEventListener('keydown', this.handleKeydown.bind(this));
		sb.addEventListener('cbi-dropdown-close', this.handleDropdownClose.bind(this));
		sb.addEventListener('cbi-dropdown-select', this.handleDropdownSelect.bind(this));

		if ('ontouchstart' in window) {
			sb.addEventListener('touchstart', function(ev) { ev.stopPropagation(); });
			window.addEventListener('touchstart', this.closeAllDropdowns);
		}
		else {
			sb.addEventListener('mouseover', this.handleMouseover.bind(this));
			sb.addEventListener('focus', this.handleFocus.bind(this));

			canary.addEventListener('focus', this.handleCanaryFocus.bind(this));

			window.addEventListener('mouseover', this.setFocus);
			window.addEventListener('click', this.closeAllDropdowns);
		}

		if (create) {
			create.addEventListener('keydown', this.handleCreateKeydown.bind(this));
			create.addEventListener('focus', this.handleCreateFocus.bind(this));
			create.addEventListener('blur', this.handleCreateBlur.bind(this));

			var li = findParent(create, 'li');

			li.setAttribute('unselectable', '');
			li.addEventListener('click', this.handleCreateClick.bind(this));
		}

		this.node = sb;

		this.setUpdateEvents(sb, 'cbi-dropdown-open', 'cbi-dropdown-close');
		this.setChangeEvents(sb, 'cbi-dropdown-change', 'cbi-dropdown-close');

		L.dom.bindClassInstance(sb, this);

		return sb;
	},

	openDropdown: function(sb) {
		var st = window.getComputedStyle(sb, null),
		    ul = sb.querySelector('ul'),
		    li = ul.querySelectorAll('li'),
		    fl = findParent(sb, '.cbi-value-field'),
		    sel = ul.querySelector('[selected]'),
		    rect = sb.getBoundingClientRect(),
		    items = Math.min(this.options.dropdown_items, li.length);

		document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
			s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
		});

		sb.setAttribute('open', '');

		var pv = ul.cloneNode(true);
		    pv.classList.add('preview');

		if (fl)
			fl.classList.add('cbi-dropdown-open');

		if ('ontouchstart' in window) {
			var vpWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
			    vpHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
			    scrollFrom = window.pageYOffset,
			    scrollTo = scrollFrom + rect.top - vpHeight * 0.5,
			    start = null;

			ul.style.top = sb.offsetHeight + 'px';
			ul.style.left = -rect.left + 'px';
			ul.style.right = (rect.right - vpWidth) + 'px';
			ul.style.maxHeight = (vpHeight * 0.5) + 'px';
			ul.style.WebkitOverflowScrolling = 'touch';

			var scrollStep = function(timestamp) {
				if (!start) {
					start = timestamp;
					ul.scrollTop = sel ? Math.max(sel.offsetTop - sel.offsetHeight, 0) : 0;
				}

				var duration = Math.max(timestamp - start, 1);
				if (duration < 100) {
					document.body.scrollTop = scrollFrom + (scrollTo - scrollFrom) * (duration / 100);
					window.requestAnimationFrame(scrollStep);
				}
				else {
					document.body.scrollTop = scrollTo;
				}
			};

			window.requestAnimationFrame(scrollStep);
		}
		else {
			ul.style.maxHeight = '1px';
			ul.style.top = ul.style.bottom = '';

			window.requestAnimationFrame(function() {
				var height = items * li[Math.max(0, li.length - 2)].offsetHeight;

				ul.scrollTop = sel ? Math.max(sel.offsetTop - sel.offsetHeight, 0) : 0;
				ul.style[((rect.top + rect.height + height) > window.innerHeight) ? 'bottom' : 'top'] = rect.height + 'px';
				ul.style.maxHeight = height + 'px';
			});
		}

		var cboxes = ul.querySelectorAll('[selected] input[type="checkbox"]');
		for (var i = 0; i < cboxes.length; i++) {
			cboxes[i].checked = true;
			cboxes[i].disabled = (cboxes.length == 1 && !this.options.optional);
		};

		ul.classList.add('dropdown');

		sb.insertBefore(pv, ul.nextElementSibling);

		li.forEach(function(l) {
			l.setAttribute('tabindex', 0);
		});

		sb.lastElementChild.setAttribute('tabindex', 0);

		this.setFocus(sb, sel || li[0], true);
	},

	closeDropdown: function(sb, no_focus) {
		if (!sb.hasAttribute('open'))
			return;

		var pv = sb.querySelector('ul.preview'),
		    ul = sb.querySelector('ul.dropdown'),
		    li = ul.querySelectorAll('li'),
		    fl = findParent(sb, '.cbi-value-field');

		li.forEach(function(l) { l.removeAttribute('tabindex'); });
		sb.lastElementChild.removeAttribute('tabindex');

		sb.removeChild(pv);
		sb.removeAttribute('open');
		sb.style.width = sb.style.height = '';

		ul.classList.remove('dropdown');
		ul.style.top = ul.style.bottom = ul.style.maxHeight = '';

		if (fl)
			fl.classList.remove('cbi-dropdown-open');

		if (!no_focus)
			this.setFocus(sb, sb);

		this.saveValues(sb, ul);
	},

	toggleItem: function(sb, li, force_state) {
		if (li.hasAttribute('unselectable'))
			return;

		if (this.options.multi) {
			var cbox = li.querySelector('input[type="checkbox"]'),
			    items = li.parentNode.querySelectorAll('li'),
			    label = sb.querySelector('ul.preview'),
			    sel = li.parentNode.querySelectorAll('[selected]').length,
			    more = sb.querySelector('.more'),
			    ndisplay = this.options.display_items,
			    n = 0;

			if (li.hasAttribute('selected')) {
				if (force_state !== true) {
					if (sel > 1 || this.options.optional) {
						li.removeAttribute('selected');
						cbox.checked = cbox.disabled = false;
						sel--;
					}
					else {
						cbox.disabled = true;
					}
				}
			}
			else {
				if (force_state !== false) {
					li.setAttribute('selected', '');
					cbox.checked = true;
					cbox.disabled = false;
					sel++;
				}
			}

			while (label && label.firstElementChild)
				label.removeChild(label.firstElementChild);

			for (var i = 0; i < items.length; i++) {
				items[i].removeAttribute('display');
				if (items[i].hasAttribute('selected')) {
					if (ndisplay-- > 0) {
						items[i].setAttribute('display', n++);
						if (label)
							label.appendChild(items[i].cloneNode(true));
					}
					var c = items[i].querySelector('input[type="checkbox"]');
					if (c)
						c.disabled = (sel == 1 && !this.options.optional);
				}
			}

			if (ndisplay < 0)
				sb.setAttribute('more', '');
			else
				sb.removeAttribute('more');

			if (ndisplay === this.options.display_items)
				sb.setAttribute('empty', '');
			else
				sb.removeAttribute('empty');

			more.innerHTML = (ndisplay === this.options.display_items)
				? (this.options.select_placeholder || this.options.placeholder) : '···';
		}
		else {
			var sel = li.parentNode.querySelector('[selected]');
			if (sel) {
				sel.removeAttribute('display');
				sel.removeAttribute('selected');
			}

			li.setAttribute('display', 0);
			li.setAttribute('selected', '');

			this.closeDropdown(sb, true);
		}

		this.saveValues(sb, li.parentNode);
	},

	transformItem: function(sb, li) {
		var cbox = E('form', {}, E('input', { type: 'checkbox', tabindex: -1, onclick: 'event.preventDefault()' })),
		    label = E('label');

		while (li.firstChild)
			label.appendChild(li.firstChild);

		li.appendChild(cbox);
		li.appendChild(label);
	},

	saveValues: function(sb, ul) {
		var sel = ul.querySelectorAll('li[selected]'),
		    div = sb.lastElementChild,
		    name = this.options.name,
		    strval = '',
		    values = [];

		while (div.lastElementChild)
			div.removeChild(div.lastElementChild);

		sel.forEach(function (s) {
			if (s.hasAttribute('placeholder'))
				return;

			var v = {
				text: s.innerText,
				value: s.hasAttribute('data-value') ? s.getAttribute('data-value') : s.innerText,
				element: s
			};

			div.appendChild(E('input', {
				type: 'hidden',
				name: name,
				value: v.value
			}));

			values.push(v);

			strval += strval.length ? ' ' + v.value : v.value;
		});

		var detail = {
			instance: this,
			element: sb
		};

		if (this.options.multi)
			detail.values = values;
		else
			detail.value = values.length ? values[0] : null;

		sb.value = strval;

		sb.dispatchEvent(new CustomEvent('cbi-dropdown-change', {
			bubbles: true,
			detail: detail
		}));
	},

	setValues: function(sb, values) {
		var ul = sb.querySelector('ul');

		if (this.options.create) {
			for (var value in values) {
				this.createItems(sb, value);

				if (!this.options.multi)
					break;
			}
		}

		if (this.options.multi) {
			var lis = ul.querySelectorAll('li[data-value]');
			for (var i = 0; i < lis.length; i++) {
				var value = lis[i].getAttribute('data-value');
				if (values === null || !(value in values))
					this.toggleItem(sb, lis[i], false);
				else
					this.toggleItem(sb, lis[i], true);
			}
		}
		else {
			var ph = ul.querySelector('li[placeholder]');
			if (ph)
				this.toggleItem(sb, ph);

			var lis = ul.querySelectorAll('li[data-value]');
			for (var i = 0; i < lis.length; i++) {
				var value = lis[i].getAttribute('data-value');
				if (values !== null && (value in values))
					this.toggleItem(sb, lis[i]);
			}
		}
	},

	setFocus: function(sb, elem, scroll) {
		if (sb && sb.hasAttribute && sb.hasAttribute('locked-in'))
			return;

		if (sb.target && findParent(sb.target, 'ul.dropdown'))
			return;

		document.querySelectorAll('.focus').forEach(function(e) {
			if (!matchesElem(e, 'input')) {
				e.classList.remove('focus');
				e.blur();
			}
		});

		if (elem) {
			elem.focus();
			elem.classList.add('focus');

			if (scroll)
				elem.parentNode.scrollTop = elem.offsetTop - elem.parentNode.offsetTop;
		}
	},

	createItems: function(sb, value) {
		var sbox = this,
		    val = (value || '').trim(),
		    ul = sb.querySelector('ul');

		if (!sbox.options.multi)
			val = val.length ? [ val ] : [];
		else
			val = val.length ? val.split(/\s+/) : [];

		val.forEach(function(item) {
			var new_item = null;

			ul.childNodes.forEach(function(li) {
				if (li.getAttribute && li.getAttribute('data-value') === item)
					new_item = li;
			});

			if (!new_item) {
				var markup,
				    tpl = sb.querySelector(sbox.options.create_template);

				if (tpl)
					markup = (tpl.textContent || tpl.innerHTML || tpl.firstChild.data).replace(/^<!--|-->$/, '').trim();
				else
					markup = '<li data-value="{{value}}">{{value}}</li>';

				new_item = E(markup.replace(/{{value}}/g, item));

				if (sbox.options.multi) {
					sbox.transformItem(sb, new_item);
				}
				else {
					var old = ul.querySelector('li[created]');
					if (old)
						ul.removeChild(old);

					new_item.setAttribute('created', '');
				}

				new_item = ul.insertBefore(new_item, ul.lastElementChild);
			}

			sbox.toggleItem(sb, new_item, true);
			sbox.setFocus(sb, new_item, true);
		});
	},

	closeAllDropdowns: function() {
		document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
			s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
		});
	},

	handleClick: function(ev) {
		var sb = ev.currentTarget;

		if (!sb.hasAttribute('open')) {
			if (!matchesElem(ev.target, 'input'))
				this.openDropdown(sb);
		}
		else {
			var li = findParent(ev.target, 'li');
			if (li && li.parentNode.classList.contains('dropdown'))
				this.toggleItem(sb, li);
			else if (li && li.parentNode.classList.contains('preview'))
				this.closeDropdown(sb);
		}

		ev.preventDefault();
		ev.stopPropagation();
	},

	handleKeydown: function(ev) {
		var sb = ev.currentTarget;

		if (matchesElem(ev.target, 'input'))
			return;

		if (!sb.hasAttribute('open')) {
			switch (ev.keyCode) {
			case 37:
			case 38:
			case 39:
			case 40:
				this.openDropdown(sb);
				ev.preventDefault();
			}
		}
		else {
			var active = findParent(document.activeElement, 'li');

			switch (ev.keyCode) {
			case 27:
				this.closeDropdown(sb);
				break;

			case 13:
				if (active) {
					if (!active.hasAttribute('selected'))
						this.toggleItem(sb, active);
					this.closeDropdown(sb);
					ev.preventDefault();
				}
				break;

			case 32:
				if (active) {
					this.toggleItem(sb, active);
					ev.preventDefault();
				}
				break;

			case 38:
				if (active && active.previousElementSibling) {
					this.setFocus(sb, active.previousElementSibling);
					ev.preventDefault();
				}
				break;

			case 40:
				if (active && active.nextElementSibling) {
					this.setFocus(sb, active.nextElementSibling);
					ev.preventDefault();
				}
				break;
			}
		}
	},

	handleDropdownClose: function(ev) {
		var sb = ev.currentTarget;

		this.closeDropdown(sb, true);
	},

	handleDropdownSelect: function(ev) {
		var sb = ev.currentTarget,
		    li = findParent(ev.target, 'li');

		if (!li)
			return;

		this.toggleItem(sb, li);
		this.closeDropdown(sb, true);
	},

	handleMouseover: function(ev) {
		var sb = ev.currentTarget;

		if (!sb.hasAttribute('open'))
			return;

		var li = findParent(ev.target, 'li');

		if (li && li.parentNode.classList.contains('dropdown'))
			this.setFocus(sb, li);
	},

	handleFocus: function(ev) {
		var sb = ev.currentTarget;

		document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
			if (s !== sb || sb.hasAttribute('open'))
				s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
		});
	},

	handleCanaryFocus: function(ev) {
		this.closeDropdown(ev.currentTarget.parentNode);
	},

	handleCreateKeydown: function(ev) {
		var input = ev.currentTarget,
		    sb = findParent(input, '.cbi-dropdown');

		switch (ev.keyCode) {
		case 13:
			ev.preventDefault();

			if (input.classList.contains('cbi-input-invalid'))
				return;

			this.createItems(sb, input.value);
			input.value = '';
			input.blur();
			break;
		}
	},

	handleCreateFocus: function(ev) {
		var input = ev.currentTarget,
		    cbox = findParent(input, 'li').querySelector('input[type="checkbox"]'),
		    sb = findParent(input, '.cbi-dropdown');

		if (cbox)
			cbox.checked = true;

		sb.setAttribute('locked-in', '');
	},

	handleCreateBlur: function(ev) {
		var input = ev.currentTarget,
		    cbox = findParent(input, 'li').querySelector('input[type="checkbox"]'),
		    sb = findParent(input, '.cbi-dropdown');

		if (cbox)
			cbox.checked = false;

		sb.removeAttribute('locked-in');
	},

	handleCreateClick: function(ev) {
		ev.currentTarget.querySelector(this.options.create_query).focus();
	},

	setValue: function(values) {
		if (this.options.multi) {
			if (!Array.isArray(values))
				values = (values != null) ? [ values ] : [];

			var v = {};

			for (var i = 0; i < values.length; i++)
				v[values[i]] = true;

			this.setValues(this.node, v);
		}
		else {
			var v = {};

			if (values != null) {
				if (Array.isArray(values))
					v[values[0]] = true;
				else
					v[values] = true;
			}

			this.setValues(this.node, v);
		}
	},

	getValue: function() {
		var div = this.node.lastElementChild,
		    h = div.querySelectorAll('input[type="hidden"]'),
			v = [];

		for (var i = 0; i < h.length; i++)
			v.push(h[i].value);

		return this.options.multi ? v : v[0];
	}
});

var UICombobox = UIDropdown.extend({
	__init__: function(value, choices, options) {
		this.super('__init__', [ value, choices, Object.assign({
			select_placeholder: _('-- Please choose --'),
			custom_placeholder: _('-- custom --'),
			dropdown_items: 5
		}, options, {
			sort: true,
			multi: false,
			create: true,
			optional: true
		}) ]);
	}
});

var UIDynamicList = UIElement.extend({
	__init__: function(values, choices, options) {
		if (!Array.isArray(values))
			values = (values != null) ? [ values ] : [];

		if (typeof(choices) != 'object')
			choices = null;

		this.values = values;
		this.choices = choices;
		this.options = Object.assign({}, options, {
			multi: false,
			optional: true
		});
	},

	render: function() {
		var dl = E('div', {
			'id': this.options.id,
			'class': 'cbi-dynlist'
		}, E('div', { 'class': 'add-item' }));

		if (this.choices) {
			var cbox = new UICombobox(null, this.choices, this.options);
			dl.lastElementChild.appendChild(cbox.render());
		}
		else {
			var inputEl = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'placeholder': this.options.placeholder
			});

			dl.lastElementChild.appendChild(inputEl);
			dl.lastElementChild.appendChild(E('div', { 'class': 'cbi-button cbi-button-add' }, '+'));

			L.ui.addValidator(inputEl, this.options.datatype, true, 'blue', 'keyup');
		}

		for (var i = 0; i < this.values.length; i++)
			this.addItem(dl, this.values[i],
				this.choices ? this.choices[this.values[i]] : null);

		return this.bind(dl);
	},

	bind: function(dl) {
		dl.addEventListener('click', L.bind(this.handleClick, this));
		dl.addEventListener('keydown', L.bind(this.handleKeydown, this));
		dl.addEventListener('cbi-dropdown-change', L.bind(this.handleDropdownChange, this));

		this.node = dl;

		this.setUpdateEvents(dl, 'cbi-dynlist-change');
		this.setChangeEvents(dl, 'cbi-dynlist-change');

		L.dom.bindClassInstance(dl, this);

		return dl;
	},

	addItem: function(dl, value, text, flash) {
		var exists = false,
		    new_item = E('div', { 'class': flash ? 'item flash' : 'item', 'tabindex': 0 }, [
				E('span', {}, text || value),
				E('input', {
					'type': 'hidden',
					'name': this.options.name,
					'value': value })]);

		dl.querySelectorAll('.item, .add-item').forEach(function(item) {
			if (exists)
				return;

			var hidden = item.querySelector('input[type="hidden"]');

			if (hidden && hidden.parentNode !== item)
				hidden = null;

			if (hidden && hidden.value === value)
				exists = true;
			else if (!hidden || hidden.value >= value)
				exists = !!item.parentNode.insertBefore(new_item, item);
		});

		dl.dispatchEvent(new CustomEvent('cbi-dynlist-change', {
			bubbles: true,
			detail: {
				instance: this,
				element: dl,
				value: value,
				add: true
			}
		}));
	},

	removeItem: function(dl, item) {
		var value = item.querySelector('input[type="hidden"]').value;
		var sb = dl.querySelector('.cbi-dropdown');
		if (sb)
			sb.querySelectorAll('ul > li').forEach(function(li) {
				if (li.getAttribute('data-value') === value) {
					if (li.hasAttribute('dynlistcustom'))
						li.parentNode.removeChild(li);
					else
						li.removeAttribute('unselectable');
				}
			});

		item.parentNode.removeChild(item);

		dl.dispatchEvent(new CustomEvent('cbi-dynlist-change', {
			bubbles: true,
			detail: {
				instance: this,
				element: dl,
				value: value,
				remove: true
			}
		}));
	},

	handleClick: function(ev) {
		var dl = ev.currentTarget,
		    item = findParent(ev.target, '.item');

		if (item) {
			this.removeItem(dl, item);
		}
		else if (matchesElem(ev.target, '.cbi-button-add')) {
			var input = ev.target.previousElementSibling;
			if (input.value.length && !input.classList.contains('cbi-input-invalid')) {
				this.addItem(dl, input.value, null, true);
				input.value = '';
			}
		}
	},

	handleDropdownChange: function(ev) {
		var dl = ev.currentTarget,
		    sbIn = ev.detail.instance,
		    sbEl = ev.detail.element,
		    sbVal = ev.detail.value;

		if (sbVal === null)
			return;

		sbIn.setValues(sbEl, null);
		sbVal.element.setAttribute('unselectable', '');

		if (sbVal.element.hasAttribute('created')) {
			sbVal.element.removeAttribute('created');
			sbVal.element.setAttribute('dynlistcustom', '');
		}

		this.addItem(dl, sbVal.value, sbVal.text, true);
	},

	handleKeydown: function(ev) {
		var dl = ev.currentTarget,
		    item = findParent(ev.target, '.item');

		if (item) {
			switch (ev.keyCode) {
			case 8: /* backspace */
				if (item.previousElementSibling)
					item.previousElementSibling.focus();

				this.removeItem(dl, item);
				break;

			case 46: /* delete */
				if (item.nextElementSibling) {
					if (item.nextElementSibling.classList.contains('item'))
						item.nextElementSibling.focus();
					else
						item.nextElementSibling.firstElementChild.focus();
				}

				this.removeItem(dl, item);
				break;
			}
		}
		else if (matchesElem(ev.target, '.cbi-input-text')) {
			switch (ev.keyCode) {
			case 13: /* enter */
				if (ev.target.value.length && !ev.target.classList.contains('cbi-input-invalid')) {
					this.addItem(dl, ev.target.value, null, true);
					ev.target.value = '';
					ev.target.blur();
					ev.target.focus();
				}

				ev.preventDefault();
				break;
			}
		}
	},

	getValue: function() {
		var items = this.node.querySelectorAll('.item > input[type="hidden"]'),
		    v = [];

		for (var i = 0; i < items.length; i++)
			v.push(items[i].value);

		return v;
	},

	setValue: function(values) {
		if (!Array.isArray(values))
			values = (values != null) ? [ values ] : [];

		var items = this.node.querySelectorAll('.item');

		for (var i = 0; i < items.length; i++)
			if (items[i].parentNode === this.node)
				this.removeItem(this.node, items[i]);

		for (var i = 0; i < values.length; i++)
			this.addItem(this.node, values[i],
				this.choices ? this.choices[values[i]] : null);
	}
});


return L.Class.extend({
	__init__: function() {
		modalDiv = document.body.appendChild(
			L.dom.create('div', { id: 'modal_overlay' },
				L.dom.create('div', { class: 'modal', role: 'dialog', 'aria-modal': true })));

		tooltipDiv = document.body.appendChild(
			L.dom.create('div', { class: 'cbi-tooltip' }));

		/* setup old aliases */
		L.showModal = this.showModal;
		L.hideModal = this.hideModal;
		L.showTooltip = this.showTooltip;
		L.hideTooltip = this.hideTooltip;
		L.itemlist = this.itemlist;

		document.addEventListener('mouseover', this.showTooltip.bind(this), true);
		document.addEventListener('mouseout', this.hideTooltip.bind(this), true);
		document.addEventListener('focus', this.showTooltip.bind(this), true);
		document.addEventListener('blur', this.hideTooltip.bind(this), true);

		document.addEventListener('luci-loaded', this.tabs.init.bind(this.tabs));
	},

	/* Modal dialog */
	showModal: function(title, children) {
		var dlg = modalDiv.firstElementChild;

		dlg.setAttribute('class', 'modal');

		L.dom.content(dlg, L.dom.create('h4', {}, title));
		L.dom.append(dlg, children);

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

		tooltipDiv.dispatchEvent(new CustomEvent('tooltip-open', {
			bubbles: true,
			detail: { target: target }
		}));
	},

	hideTooltip: function(ev) {
		if (ev.target === tooltipDiv || ev.relatedTarget === tooltipDiv ||
		    tooltipDiv.contains(ev.target) || tooltipDiv.contains(ev.relatedTarget))
			return;

		if (tooltipTimeout !== null) {
			window.clearTimeout(tooltipTimeout);
			tooltipTimeout = null;
		}

		tooltipDiv.style.opacity = 0;
		tooltipTimeout = window.setTimeout(function() { tooltipDiv.removeAttribute('style'); }, 250);

		tooltipDiv.dispatchEvent(new CustomEvent('tooltip-close', { bubbles: true }));
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
					children.push(L.dom.elem(sep) ? sep.cloneNode(true) : sep);
			}
		}

		L.dom.content(node, children);

		return node;
	},

	/* Tabs */
	tabs: L.Class.singleton({
		init: function() {
			var groups = [], prevGroup = null, currGroup = null;

			document.querySelectorAll('[data-tab]').forEach(function(tab) {
				var parent = tab.parentNode;

				if (!parent.hasAttribute('data-tab-group'))
					parent.setAttribute('data-tab-group', groups.length);

				currGroup = +parent.getAttribute('data-tab-group');

				if (currGroup !== prevGroup) {
					prevGroup = currGroup;

					if (!groups[currGroup])
						groups[currGroup] = [];
				}

				groups[currGroup].push(tab);
			});

			for (var i = 0; i < groups.length; i++)
				this.initTabGroup(groups[i]);

			document.addEventListener('dependency-update', this.updateTabs.bind(this));

			this.updateTabs();

			if (!groups.length)
				this.setActiveTabId(-1, -1);
		},

		initTabGroup: function(panes) {
			if (typeof(panes) != 'object' || !('length' in panes) || panes.length === 0)
				return;

			var menu = E('ul', { 'class': 'cbi-tabmenu' }),
			    group = panes[0].parentNode,
			    groupId = +group.getAttribute('data-tab-group'),
			    selected = null;

			for (var i = 0, pane; pane = panes[i]; i++) {
				var name = pane.getAttribute('data-tab'),
				    title = pane.getAttribute('data-tab-title'),
				    active = pane.getAttribute('data-tab-active') === 'true';

				menu.appendChild(E('li', {
					'class': active ? 'cbi-tab' : 'cbi-tab-disabled',
					'data-tab': name
				}, E('a', {
					'href': '#',
					'click': this.switchTab.bind(this)
				}, title)));

				if (active)
					selected = i;
			}

			group.parentNode.insertBefore(menu, group);

			if (selected === null) {
				selected = this.getActiveTabId(groupId);

				if (selected < 0 || selected >= panes.length)
					selected = 0;

				menu.childNodes[selected].classList.add('cbi-tab');
				menu.childNodes[selected].classList.remove('cbi-tab-disabled');
				panes[selected].setAttribute('data-tab-active', 'true');

				this.setActiveTabId(groupId, selected);
			}
		},

		getActiveTabState: function() {
			var page = document.body.getAttribute('data-page');

			try {
				var val = JSON.parse(window.sessionStorage.getItem('tab'));
				if (val.page === page && Array.isArray(val.groups))
					return val;
			}
			catch(e) {}

			window.sessionStorage.removeItem('tab');
			return { page: page, groups: [] };
		},

		getActiveTabId: function(groupId) {
			return +this.getActiveTabState().groups[groupId] || 0;
		},

		setActiveTabId: function(groupId, tabIndex) {
			try {
				var state = this.getActiveTabState();
				    state.groups[groupId] = tabIndex;

			    window.sessionStorage.setItem('tab', JSON.stringify(state));
			}
			catch (e) { return false; }

			return true;
		},

		updateTabs: function(ev) {
			document.querySelectorAll('[data-tab-title]').forEach(function(pane) {
				var menu = pane.parentNode.previousElementSibling,
				    tab = menu.querySelector('[data-tab="%s"]'.format(pane.getAttribute('data-tab'))),
				    n_errors = pane.querySelectorAll('.cbi-input-invalid').length;

				if (!pane.firstElementChild) {
					tab.style.display = 'none';
					tab.classList.remove('flash');
				}
				else if (tab.style.display === 'none') {
					tab.style.display = '';
					requestAnimationFrame(function() { tab.classList.add('flash') });
				}

				if (n_errors) {
					tab.setAttribute('data-errors', n_errors);
					tab.setAttribute('data-tooltip', _('%d invalid field(s)').format(n_errors));
					tab.setAttribute('data-tooltip-style', 'error');
				}
				else {
					tab.removeAttribute('data-errors');
					tab.removeAttribute('data-tooltip');
				}
			});
		},

		switchTab: function(ev) {
			var tab = ev.target.parentNode,
			    name = tab.getAttribute('data-tab'),
			    menu = tab.parentNode,
			    group = menu.nextElementSibling,
			    groupId = +group.getAttribute('data-tab-group'),
			    index = 0;

			ev.preventDefault();

			if (!tab.classList.contains('cbi-tab-disabled'))
				return;

			menu.querySelectorAll('[data-tab]').forEach(function(tab) {
				tab.classList.remove('cbi-tab');
				tab.classList.remove('cbi-tab-disabled');
				tab.classList.add(
					tab.getAttribute('data-tab') === name ? 'cbi-tab' : 'cbi-tab-disabled');
			});

			group.childNodes.forEach(function(pane) {
				if (L.dom.matches(pane, '[data-tab]')) {
					if (pane.getAttribute('data-tab') === name) {
						pane.setAttribute('data-tab-active', 'true');
						L.ui.tabs.setActiveTabId(groupId, index);
					}
					else {
						pane.setAttribute('data-tab-active', 'false');
					}

					index++;
				}
			});
		}
	}),

	addValidator: function(field, type, optional /*, ... */) {
		if (type == null)
			return;

		var events = this.varargs(arguments, 3);
		if (events.length == 0)
			events.push('blur', 'keyup');

		try {
			var cbiValidator = new CBIValidator(field, type, optional),
			    validatorFn = cbiValidator.validate.bind(cbiValidator);

			for (var i = 0; i < events.length; i++)
				field.addEventListener(events[i], validatorFn);

			validatorFn();
		}
		catch (e) { }
	},

	/* Widgets */
	Dropdown: UIDropdown,
	DynamicList: UIDynamicList,
	Combobox: UICombobox
});
