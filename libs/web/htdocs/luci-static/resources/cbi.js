/*
	LuCI - Lua Configuration Interface

	Copyright 2008 Steven Barth <steven@midlink.org>
	Copyright 2008-2012 Jo-Philipp Wich <xm@subsignal.org>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
*/

var cbi_d = [];
var cbi_t = [];
var cbi_c = [];

var cbi_validators = {

	'integer': function()
	{
		return (this.match(/^-?[0-9]+$/) != null);
	},

	'uinteger': function()
	{
		return (cbi_validators.integer.apply(this) && (this >= 0));
	},

	'float': function()
	{
		return !isNaN(parseFloat(this));
	},

	'ufloat': function()
	{
		return (cbi_validators['float'].apply(this) && (this >= 0));
	},

	'ipaddr': function()
	{
		return cbi_validators.ip4addr.apply(this) ||
			cbi_validators.ip6addr.apply(this);
	},

	'ip4addr': function()
	{
		if (this.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\S+))?$/))
		{
			return (RegExp.$1 >= 0) && (RegExp.$1 <= 255) &&
			       (RegExp.$2 >= 0) && (RegExp.$2 <= 255) &&
			       (RegExp.$3 >= 0) && (RegExp.$3 <= 255) &&
			       (RegExp.$4 >= 0) && (RegExp.$4 <= 255) &&
			       ((RegExp.$6.indexOf('.') < 0)
			          ? ((RegExp.$6 >= 0) && (RegExp.$6 <= 32))
			          : (cbi_validators.ip4addr.apply(RegExp.$6)))
			;
		}

		return false;
	},

	'ip6addr': function()
	{
		if( this.match(/^([a-fA-F0-9:.]+)(\/(\d+))?$/) )
		{
			if( !RegExp.$2 || ((RegExp.$3 >= 0) && (RegExp.$3 <= 128)) )
			{
				var addr = RegExp.$1;

				if( addr == '::' )
				{
					return true;
				}

				if( addr.indexOf('.') > 0 )
				{
					var off = addr.lastIndexOf(':');

					if( !(off && cbi_validators.ip4addr.apply(addr.substr(off+1))) )
						return false;

					addr = addr.substr(0, off) + ':0:0';
				}

				if( addr.indexOf('::') >= 0 )
				{
					var colons = 0;
					var fill = '0';

					for( var i = 1; i < (addr.length-1); i++ )
						if( addr.charAt(i) == ':' )
							colons++;

					if( colons > 7 )
						return false;

					for( var i = 0; i < (7 - colons); i++ )
						fill += ':0';

					if (addr.match(/^(.*?)::(.*?)$/))
						addr = (RegExp.$1 ? RegExp.$1 + ':' : '') + fill +
						       (RegExp.$2 ? ':' + RegExp.$2 : '');
				}

				return (addr.match(/^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/) != null);
			}
		}

		return false;
	},

	'port': function()
	{
		return cbi_validators.integer.apply(this) &&
			(this >= 0) && (this <= 65535);
	},

	'portrange': function()
	{
		if (this.match(/^(\d+)-(\d+)$/))
		{
			var p1 = RegExp.$1;
			var p2 = RegExp.$2;

			return cbi_validators.port.apply(p1) &&
			       cbi_validators.port.apply(p2) &&
			       (parseInt(p1) <= parseInt(p2))
			;
		}
		else
		{
			return cbi_validators.port.apply(this);
		}
	},

	'macaddr': function()
	{
		return (this.match(/^([a-fA-F0-9]{2}:){5}[a-fA-F0-9]{2}$/) != null);
	},

	'host': function()
	{
		return cbi_validators.hostname.apply(this) ||
			cbi_validators.ipaddr.apply(this);
	},

	'hostname': function()
	{
		if (this.length <= 253)
			return (this.match(/^[a-zA-Z0-9]+$/) != null ||
			        (this.match(/^[a-zA-Z0-9_][a-zA-Z0-9_\-.]*[a-zA-Z0-9]$/) &&
			         this.match(/[^0-9.]/)));

		return false;
	},

	'network': function()
	{
		return cbi_validators.uciname.apply(this) ||
			cbi_validators.host.apply(this);
	},

	'wpakey': function()
	{
		var v = this;

		if( v.length == 64 )
			return (v.match(/^[a-fA-F0-9]{64}$/) != null);
		else
			return (v.length >= 8) && (v.length <= 63);
	},

	'wepkey': function()
	{
		var v = this;

		if ( v.substr(0,2) == 's:' )
			v = v.substr(2);

		if( (v.length == 10) || (v.length == 26) )
			return (v.match(/^[a-fA-F0-9]{10,26}$/) != null);
		else
			return (v.length == 5) || (v.length == 13);
	},

	'uciname': function()
	{
		return (this.match(/^[a-zA-Z0-9_]+$/) != null);
	},

	'range': function(min, max)
	{
		var val = parseFloat(this);
		if (!isNaN(min) && !isNaN(max) && !isNaN(val))
			return ((val >= min) && (val <= max));

		return false;
	},

	'min': function(min)
	{
		var val = parseFloat(this);
		if (!isNaN(min) && !isNaN(val))
			return (val >= min);

		return false;
	},

	'max': function(max)
	{
		var val = parseFloat(this);
		if (!isNaN(max) && !isNaN(val))
			return (val <= max);

		return false;
	},

	'rangelength': function(min, max)
	{
		var val = '' + this;
		if (!isNaN(min) && !isNaN(max))
			return ((val.length >= min) && (val.length <= max));

		return false;
	},

	'minlength': function(min)
	{
		var val = '' + this;
		if (!isNaN(min))
			return (val.length >= min);

		return false;
	},

	'maxlength': function(max)
	{
		var val = '' + this;
		if (!isNaN(max))
			return (val.length <= max);

		return false;
	},

	'or': function()
	{
		for (var i = 0; i < arguments.length; i += 2)
		{
			if (typeof arguments[i] != 'function')
			{
				if (arguments[i] == this)
					return true;
				i--;
			}
			else if (arguments[i].apply(this, arguments[i+1]))
			{
				return true;
			}
		}
		return false;
	},

	'and': function()
	{
		for (var i = 0; i < arguments.length; i += 2)
		{
			if (typeof arguments[i] != 'function')
			{
				if (arguments[i] != this)
					return false;
				i--;
			}
			else if (!arguments[i].apply(this, arguments[i+1]))
			{
				return false;
			}
		}
		return true;
	},

	'neg': function()
	{
		return cbi_validators.or.apply(
			this.replace(/^[ \t]*![ \t]*/, ''), arguments);
	},

	'list': function(subvalidator, subargs)
	{
		if (typeof subvalidator != 'function')
			return false;

		var tokens = this.match(/[^ \t]+/g);
		for (var i = 0; i < tokens.length; i++)
			if (!subvalidator.apply(tokens[i], subargs))
				return false;

		return true;
	},
	'phonedigit': function()
	{
		return (this.match(/^[0-9\*#]+$/) != null);
	}
};


function cbi_d_add(field, dep, next) {
	var obj = document.getElementById(field);
	if (obj) {
		var entry
		for (var i=0; i<cbi_d.length; i++) {
			if (cbi_d[i].id == field) {
				entry = cbi_d[i];
				break;
			}
		}
		if (!entry) {
			entry = {
				"node": obj,
				"id": field,
				"parent": obj.parentNode.id,
				"next": next,
				"deps": []
			};
			cbi_d.unshift(entry);
		}
		entry.deps.push(dep)
	}
}

function cbi_d_checkvalue(target, ref) {
	var t = document.getElementById(target);
	var value;

	if (!t) {
		var tl = document.getElementsByName(target);

		if( tl.length > 0 && (tl[0].type == 'radio' || tl[0].type == 'checkbox'))
			for( var i = 0; i < tl.length; i++ )
				if( tl[i].checked ) {
					value = tl[i].value;
					break;
				}

		value = value ? value : "";
	} else if (!t.value) {
		value = "";
	} else {
		value = t.value;

		if (t.type == "checkbox") {
			value = t.checked ? value : "";
		}
	}

	return (value == ref)
}

function cbi_d_check(deps) {
	var reverse;
	var def = false;
	for (var i=0; i<deps.length; i++) {
		var istat = true;
		reverse = false;
		for (var j in deps[i]) {
			if (j == "!reverse") {
				reverse = true;
			} else if (j == "!default") {
				def = true;
				istat = false;
			} else {
				istat = (istat && cbi_d_checkvalue(j, deps[i][j]))
			}
		}
		if (istat) {
			return !reverse;
		}
	}
	return def;
}

function cbi_d_update() {
	var state = false;
	for (var i=0; i<cbi_d.length; i++) {
		var entry = cbi_d[i];
		var next  = document.getElementById(entry.next)
		var node  = document.getElementById(entry.id)
		var parent = document.getElementById(entry.parent)

		if (node && node.parentNode && !cbi_d_check(entry.deps)) {
			node.parentNode.removeChild(node);
			state = true;
			if( entry.parent )
				cbi_c[entry.parent]--;
		} else if ((!node || !node.parentNode) && cbi_d_check(entry.deps)) {
			if (!next) {
				parent.appendChild(entry.node);
			} else {
				next.parentNode.insertBefore(entry.node, next);
			}
			state = true;
			if( entry.parent )
				cbi_c[entry.parent]++;
		}
	}

	if (entry && entry.parent) {
		if (!cbi_t_update())
			cbi_tag_last(parent);
	}

	if (state) {
		cbi_d_update();
	}
}

function cbi_bind(obj, type, callback, mode) {
	if (!obj.addEventListener) {
		obj.attachEvent('on' + type,
			function(){
				var e = window.event;

				if (!e.target && e.srcElement)
					e.target = e.srcElement;

				return !!callback(e);
			}
		);
	} else {
		obj.addEventListener(type, callback, !!mode);
	}
	return obj;
}

function cbi_combobox(id, values, def, man) {
	var selid = "cbi.combobox." + id;
	if (document.getElementById(selid)) {
		return
	}

	var obj = document.getElementById(id)
	var sel = document.createElement("select");
		sel.id = selid;
		sel.className = obj.className.replace(/cbi-input-text/, 'cbi-input-select');

	if (obj.nextSibling) {
		obj.parentNode.insertBefore(sel, obj.nextSibling);
	} else {
		obj.parentNode.appendChild(sel);
	}

	var dt = obj.getAttribute('cbi_datatype');
	var op = obj.getAttribute('cbi_optional');

	if (dt)
		cbi_validate_field(sel, op == 'true', dt);

	if (!values[obj.value]) {
		if (obj.value == "") {
			var optdef = document.createElement("option");
			optdef.value = "";
			optdef.appendChild(document.createTextNode(def));
			sel.appendChild(optdef);
		} else {
			var opt = document.createElement("option");
			opt.value = obj.value;
			opt.selected = "selected";
			opt.appendChild(document.createTextNode(obj.value));
			sel.appendChild(opt);
		}
	}

	for (var i in values) {
		var opt = document.createElement("option");
		opt.value = i;

		if (obj.value == i) {
			opt.selected = "selected";
		}

		opt.appendChild(document.createTextNode(values[i]));
		sel.appendChild(opt);
	}

	var optman = document.createElement("option");
	optman.value = "";
	optman.appendChild(document.createTextNode(man));
	sel.appendChild(optman);

	obj.style.display = "none";

	cbi_bind(sel, "change", function() {
		if (sel.selectedIndex == sel.options.length - 1) {
			obj.style.display = "inline";
			sel.parentNode.removeChild(sel);
			obj.focus();
		} else {
			obj.value = sel.options[sel.selectedIndex].value;
		}

		try {
			cbi_d_update();
		} catch (e) {
			//Do nothing
		}
	})

	// Retrigger validation in select
	sel.focus();
	sel.blur();
}

function cbi_combobox_init(id, values, def, man) {
	var obj = document.getElementById(id);
	cbi_bind(obj, "blur", function() {
		cbi_combobox(id, values, def, man)
	});
	cbi_combobox(id, values, def, man);
}

function cbi_filebrowser(id, url, defpath) {
	var field   = document.getElementById(id);
	var browser = window.open(
		url + ( field.value || defpath || '' ) + '?field=' + id,
		"luci_filebrowser", "width=300,height=400,left=100,top=200,scrollbars=yes"
	);

	browser.focus();
}

function cbi_browser_init(id, respath, url, defpath)
{
	function cbi_browser_btnclick(e) {
		cbi_filebrowser(id, url, defpath);
		return false;
	}

	var field = document.getElementById(id);

	var btn = document.createElement('img');
	btn.className = 'cbi-image-button';
	btn.src = respath + '/cbi/folder.gif';
	field.parentNode.insertBefore(btn, field.nextSibling);

	cbi_bind(btn, 'click', cbi_browser_btnclick);
}

function cbi_dynlist_init(name, respath, datatype, optional, choices)
{
	var input0 = document.getElementsByName(name)[0];
	var prefix = input0.name;
	var parent = input0.parentNode;
	var holder = input0.placeholder;

	var values;

	function cbi_dynlist_redraw(focus, add, del)
	{
		values = [ ];

		while (parent.firstChild)
		{
			var n = parent.firstChild;
			var i = parseInt(n.index);

			if (i != del)
			{
				if (n.nodeName.toLowerCase() == 'input')
					values.push(n.value || '');
				else if (n.nodeName.toLowerCase() == 'select')
					values[values.length-1] = n.options[n.selectedIndex].value;
			}

			parent.removeChild(n);
		}

		if (add >= 0)
		{
			focus = add+1;
			values.splice(focus, 0, '');
		}
		else if (values.length == 0)
		{
			focus = 0;
			values.push('');
		}

		for (var i = 0; i < values.length; i++)
		{
			var t = document.createElement('input');
				t.id = prefix + '.' + (i+1);
				t.name = prefix;
				t.value = values[i];
				t.type = 'text';
				t.index = i;
				t.className = 'cbi-input-text';

			if (i == 0 && holder)
			{
				t.placeholder = holder;
			}

			var b = document.createElement('img');
				b.src = respath + ((i+1) < values.length ? '/cbi/remove.gif' : '/cbi/add.gif');
				b.className = 'cbi-image-button';

			parent.appendChild(t);
			parent.appendChild(b);
			parent.appendChild(document.createElement('br'));

			if (datatype)
			{
				cbi_validate_field(t.id, ((i+1) == values.length) || optional, datatype);
			}

			if (choices)
			{
				cbi_combobox_init(t.id, choices[0], '', choices[1]);
				t.nextSibling.index = i;

				cbi_bind(t.nextSibling, 'keydown',  cbi_dynlist_keydown);
				cbi_bind(t.nextSibling, 'keypress', cbi_dynlist_keypress);

				if (i == focus || -i == focus)
					t.nextSibling.focus();
			}
			else
			{
				cbi_bind(t, 'keydown',  cbi_dynlist_keydown);
				cbi_bind(t, 'keypress', cbi_dynlist_keypress);

				if (i == focus)
				{
					t.focus();
				}
				else if (-i == focus)
				{
					t.focus();

					/* force cursor to end */
					var v = t.value;
					t.value = ' '
					t.value = v;
				}
			}

			cbi_bind(b, 'click', cbi_dynlist_btnclick);
		}
	}

	function cbi_dynlist_keypress(ev)
	{
		ev = ev ? ev : window.event;

		var se = ev.target ? ev.target : ev.srcElement;

		if (se.nodeType == 3)
			se = se.parentNode;

		switch (ev.keyCode)
		{
			/* backspace, delete */
			case 8:
			case 46:
				if (se.value.length == 0)
				{
					if (ev.preventDefault)
						ev.preventDefault();

					return false;
				}

				return true;

			/* enter, arrow up, arrow down */
			case 13:
			case 38:
			case 40:
				if (ev.preventDefault)
					ev.preventDefault();

				return false;
		}

		return true;
	}

	function cbi_dynlist_keydown(ev)
	{
		ev = ev ? ev : window.event;

		var se = ev.target ? ev.target : ev.srcElement;

		if (se.nodeType == 3)
			se = se.parentNode;

		var prev = se.previousSibling;
		while (prev && prev.name != name)
			prev = prev.previousSibling;

		var next = se.nextSibling;
		while (next && next.name != name)
			next = next.nextSibling;

		/* advance one further in combobox case */
		if (next && next.nextSibling.name == name)
			next = next.nextSibling;

		switch (ev.keyCode)
		{
			/* backspace, delete */
			case 8:
			case 46:
				var del = (se.nodeName.toLowerCase() == 'select')
					? true : (se.value.length == 0);

				if (del)
				{
					if (ev.preventDefault)
						ev.preventDefault();

					var focus = se.index;
					if (ev.keyCode == 8)
						focus = -focus+1;

					cbi_dynlist_redraw(focus, -1, se.index);

					return false;
				}

				break;

			/* enter */
			case 13:
				cbi_dynlist_redraw(-1, se.index, -1);
				break;

			/* arrow up */
			case 38:
				if (prev)
					prev.focus();

				break;

			/* arrow down */
			case 40:
				if (next)
					next.focus();

				break;
		}

		return true;
	}

	function cbi_dynlist_btnclick(ev)
	{
		ev = ev ? ev : window.event;

		var se = ev.target ? ev.target : ev.srcElement;

		if (se.src.indexOf('remove') > -1)
		{
			se.previousSibling.value = '';

			cbi_dynlist_keydown({
				target:  se.previousSibling,
				keyCode: 8
			});
		}
		else
		{
			cbi_dynlist_keydown({
				target:  se.previousSibling,
				keyCode: 13
			});
		}

		return false;
	}

	cbi_dynlist_redraw(NaN, -1, -1);
}

//Hijacks the CBI form to send via XHR (requires Prototype)
function cbi_hijack_forms(layer, win, fail, load) {
	var forms = layer.getElementsByTagName('form');
	for (var i=0; i<forms.length; i++) {
		$(forms[i]).observe('submit', function(event) {
			// Prevent the form from also submitting the regular way
			event.stop();

			// Submit via XHR
			event.element().request({
				onSuccess: win,
				onFailure: fail
			});

			if (load) {
				load();
			}
		});
	}
}


function cbi_t_add(section, tab) {
	var t = document.getElementById('tab.' + section + '.' + tab);
	var c = document.getElementById('container.' + section + '.' + tab);

	if( t && c ) {
		cbi_t[section] = (cbi_t[section] || [ ]);
		cbi_t[section][tab] = { 'tab': t, 'container': c, 'cid': c.id };
	}
}

function cbi_t_switch(section, tab) {
	if( cbi_t[section] && cbi_t[section][tab] ) {
		var o = cbi_t[section][tab];
		var h = document.getElementById('tab.' + section);
		for( var tid in cbi_t[section] ) {
			var o2 = cbi_t[section][tid];
			if( o.tab.id != o2.tab.id ) {
				o2.tab.className = o2.tab.className.replace(/(^| )cbi-tab( |$)/, " cbi-tab-disabled ");
				o2.container.style.display = 'none';
			}
			else {
				if(h) h.value = tab;
				o2.tab.className = o2.tab.className.replace(/(^| )cbi-tab-disabled( |$)/, " cbi-tab ");
				o2.container.style.display = 'block';
			}
		}
	}
	return false
}

function cbi_t_update() {
	var hl_tabs = [ ];
	var updated = false;

	for( var sid in cbi_t )
		for( var tid in cbi_t[sid] )
		{
			if( cbi_c[cbi_t[sid][tid].cid] == 0 ) {
				cbi_t[sid][tid].tab.style.display = 'none';
			}
			else if( cbi_t[sid][tid].tab && cbi_t[sid][tid].tab.style.display == 'none' ) {
				cbi_t[sid][tid].tab.style.display = '';

				var t = cbi_t[sid][tid].tab;
				t.className += ' cbi-tab-highlighted';
				hl_tabs.push(t);
			}

			cbi_tag_last(cbi_t[sid][tid].container);
			updated = true;
		}

	if( hl_tabs.length > 0 )
		window.setTimeout(function() {
			for( var i = 0; i < hl_tabs.length; i++ )
				hl_tabs[i].className = hl_tabs[i].className.replace(/ cbi-tab-highlighted/g, '');
		}, 750);

	return updated;
}


function cbi_validate_form(form, errmsg)
{
	/* if triggered by a section removal or addition, don't validate */
	if( form.cbi_state == 'add-section' || form.cbi_state == 'del-section' )
		return true;

	if( form.cbi_validators )
	{
		for( var i = 0; i < form.cbi_validators.length; i++ )
		{
			var validator = form.cbi_validators[i];
			if( !validator() && errmsg )
			{
				alert(errmsg);
				return false;
			}
		}
	}

	return true;
}

function cbi_validate_reset(form)
{
	window.setTimeout(
		function() { cbi_validate_form(form, null) }, 100
	);

	return true;
}

function cbi_validate_compile(code)
{
	var pos = 0;
	var esc = false;
	var depth = 0;
	var stack = [ ];

	code += ',';

	for (var i = 0; i < code.length; i++)
	{
		if (esc)
		{
			esc = false;
			continue;
		}

		switch (code.charCodeAt(i))
		{
		case 92:
			esc = true;
			break;

		case 40:
		case 44:
			if (depth <= 0)
			{
				if (pos < i)
				{
					var label = code.substring(pos, i);
						label = label.replace(/\\(.)/g, '$1');
						label = label.replace(/^[ \t]+/g, '');
						label = label.replace(/[ \t]+$/g, '');

					if (label && !isNaN(label))
					{
						stack.push(parseFloat(label));
					}
					else if (label.match(/^(['"]).*\1$/))
					{
						stack.push(label.replace(/^(['"])(.*)\1$/, '$2'));
					}
					else if (typeof cbi_validators[label] == 'function')
					{
						stack.push(cbi_validators[label]);
						stack.push(null);
					}
					else
					{
						throw "Syntax error, unhandled token '"+label+"'";
					}
				}
				pos = i+1;
			}
			depth += (code.charCodeAt(i) == 40);
			break;

		case 41:
			if (--depth <= 0)
			{
				if (typeof stack[stack.length-2] != 'function')
					throw "Syntax error, argument list follows non-function";

				stack[stack.length-1] =
					arguments.callee(code.substring(pos, i));

				pos = i+1;
			}
			break;
		}
	}

	return stack;
}

function cbi_validate_field(cbid, optional, type)
{
	var field = (typeof cbid == "string") ? document.getElementById(cbid) : cbid;
	var vstack; try { vstack = cbi_validate_compile(type); } catch(e) { };

	if (field && vstack && typeof vstack[0] == "function")
	{
		var validator = function()
		{
			// is not detached
			if( field.form )
			{
				field.className = field.className.replace(/ cbi-input-invalid/g, '');

				// validate value
				var value = (field.options && field.options.selectedIndex > -1)
					? field.options[field.options.selectedIndex].value : field.value;

				if (!(((value.length == 0) && optional) || vstack[0].apply(value, vstack[1])))
				{
					// invalid
					field.className += ' cbi-input-invalid';
					return false;
				}
			}

			return true;
		};

		if( ! field.form.cbi_validators )
			field.form.cbi_validators = [ ];

		field.form.cbi_validators.push(validator);

		cbi_bind(field, "blur",  validator);
		cbi_bind(field, "keyup", validator);

		if (field.nodeName == 'SELECT')
		{
			cbi_bind(field, "change", validator);
			cbi_bind(field, "click",  validator);
		}

		field.setAttribute("cbi_validate", validator);
		field.setAttribute("cbi_datatype", type);
		field.setAttribute("cbi_optional", (!!optional).toString());

		validator();

		var fcbox = document.getElementById('cbi.combobox.' + field.id);
		if (fcbox)
			cbi_validate_field(fcbox, optional, type);
	}
}

function cbi_row_swap(elem, up, store)
{
	var tr = elem.parentNode;
	while (tr && tr.nodeName.toLowerCase() != 'tr')
		tr = tr.parentNode;

	if (!tr)
		return false;

	var table = tr.parentNode;
	while (table && table.nodeName.toLowerCase() != 'table')
		table = table.parentNode;

	if (!table)
		return false;

	var s = up ? 3 : 2;
	var e = up ? table.rows.length : table.rows.length - 1;

	for (var idx = s; idx < e; idx++)
	{
		if (table.rows[idx] == tr)
		{
			if (up)
				tr.parentNode.insertBefore(table.rows[idx], table.rows[idx-1]);
			else
				tr.parentNode.insertBefore(table.rows[idx+1], table.rows[idx]);

			break;
		}
	}

	var ids = [ ];
	for (idx = 2; idx < table.rows.length; idx++)
	{
		table.rows[idx].className = table.rows[idx].className.replace(
			/cbi-rowstyle-[12]/, 'cbi-rowstyle-' + (1 + (idx % 2))
		);

		if (table.rows[idx].id && table.rows[idx].id.match(/-([^\-]+)$/) )
			ids.push(RegExp.$1);
	}

	var input = document.getElementById(store);
	if (input)
		input.value = ids.join(' ');

	return false;
}

function cbi_tag_last(container)
{
	var last;

	for (var i = 0; i < container.childNodes.length; i++)
	{
		var c = container.childNodes[i];
		if (c.nodeType == 1 && c.nodeName.toLowerCase() == 'div')
		{
			c.className = c.className.replace(/ cbi-value-last$/, '');
			last = c;
		}
	}

	if (last)
	{
		last.className += ' cbi-value-last';
	}
}

String.prototype.serialize = function()
{
	var o = this;
	switch(typeof(o))
	{
		case 'object':
			// null
			if( o == null )
			{
				return 'null';
			}

			// array
			else if( o.length )
			{
				var i, s = '';

				for( var i = 0; i < o.length; i++ )
					s += (s ? ', ' : '') + String.serialize(o[i]);

				return '[ ' + s + ' ]';
			}

			// object
			else
			{
				var k, s = '';

				for( k in o )
					s += (s ? ', ' : '') + k + ': ' + String.serialize(o[k]);

				return '{ ' + s + ' }';
			}

			break;

		case 'string':
			// complex string
			if( o.match(/[^a-zA-Z0-9_,.: -]/) )
				return 'decodeURIComponent("' + encodeURIComponent(o) + '")';

			// simple string
			else
				return '"' + o + '"';

			break;

		default:
			return o.toString();
	}
}

String.prototype.format = function()
{
	if (!RegExp)
		return;

	var html_esc = [/&/g, '&#38;', /"/g, '&#34;', /'/g, '&#39;', /</g, '&#60;', />/g, '&#62;'];
	var quot_esc = [/"/g, '&#34;', /'/g, '&#39;'];

	function esc(s, r) {
		for( var i = 0; i < r.length; i += 2 )
			s = s.replace(r[i], r[i+1]);
		return s;
	}

	var str = this;
	var out = '';
	var re = /^(([^%]*)%('.|0|\x20)?(-)?(\d+)?(\.\d+)?(%|b|c|d|u|f|o|s|x|X|q|h|j|t|m))/;
	var a = b = [], numSubstitutions = 0, numMatches = 0;

	while( a = re.exec(str) )
	{
		var m = a[1];
		var leftpart = a[2], pPad = a[3], pJustify = a[4], pMinLength = a[5];
		var pPrecision = a[6], pType = a[7];

		numMatches++;

		if (pType == '%')
		{
			subst = '%';
		}
		else
		{
			if (numSubstitutions < arguments.length)
			{
				var param = arguments[numSubstitutions++];

				var pad = '';
				if (pPad && pPad.substr(0,1) == "'")
					pad = leftpart.substr(1,1);
				else if (pPad)
					pad = pPad;

				var justifyRight = true;
				if (pJustify && pJustify === "-")
					justifyRight = false;

				var minLength = -1;
				if (pMinLength)
					minLength = parseInt(pMinLength);

				var precision = -1;
				if (pPrecision && pType == 'f')
					precision = parseInt(pPrecision.substring(1));

				var subst = param;

				switch(pType)
				{
					case 'b':
						subst = (parseInt(param) || 0).toString(2);
						break;

					case 'c':
						subst = String.fromCharCode(parseInt(param) || 0);
						break;

					case 'd':
						subst = (parseInt(param) || 0);
						break;

					case 'u':
						subst = Math.abs(parseInt(param) || 0);
						break;

					case 'f':
						subst = (precision > -1)
							? ((parseFloat(param) || 0.0)).toFixed(precision)
							: (parseFloat(param) || 0.0);
						break;

					case 'o':
						subst = (parseInt(param) || 0).toString(8);
						break;

					case 's':
						subst = param;
						break;

					case 'x':
						subst = ('' + (parseInt(param) || 0).toString(16)).toLowerCase();
						break;

					case 'X':
						subst = ('' + (parseInt(param) || 0).toString(16)).toUpperCase();
						break;

					case 'h':
						subst = esc(param, html_esc);
						break;

					case 'q':
						subst = esc(param, quot_esc);
						break;

					case 'j':
						subst = String.serialize(param);
						break;

					case 't':
						var td = 0;
						var th = 0;
						var tm = 0;
						var ts = (param || 0);

						if (ts > 60) {
							tm = Math.floor(ts / 60);
							ts = (ts % 60);
						}

						if (tm > 60) {
							th = Math.floor(tm / 60);
							tm = (tm % 60);
						}

						if (th > 24) {
							td = Math.floor(th / 24);
							th = (th % 24);
						}

						subst = (td > 0)
							? String.format('%dd %dh %dm %ds', td, th, tm, ts)
							: String.format('%dh %dm %ds', th, tm, ts);

						break;

					case 'm':
						var mf = pMinLength ? parseInt(pMinLength) : 1000;
						var pr = pPrecision ? Math.floor(10*parseFloat('0'+pPrecision)) : 2;

						var i = 0;
						var val = parseFloat(param || 0);
						var units = [ '', 'K', 'M', 'G', 'T', 'P', 'E' ];

						for (i = 0; (i < units.length) && (val > mf); i++)
							val /= mf;

						subst = val.toFixed(pr) + ' ' + units[i];
						break;
				}
			}
		}

		out += leftpart + subst;
		str = str.substr(m.length);
	}

	return out + str;
}

String.prototype.nobr = function()
{
	return this.replace(/[\s\n]+/g, '&#160;');
}

String.serialize = function()
{
	var a = [ ];
	for (var i = 1; i < arguments.length; i++)
		a.push(arguments[i]);
	return ''.serialize.apply(arguments[0], a);
}

String.format = function()
{
	var a = [ ];
	for (var i = 1; i < arguments.length; i++)
		a.push(arguments[i]);
	return ''.format.apply(arguments[0], a);
}

String.nobr = function()
{
	var a = [ ];
	for (var i = 1; i < arguments.length; i++)
		a.push(arguments[i]);
	return ''.nobr.apply(arguments[0], a);
}
