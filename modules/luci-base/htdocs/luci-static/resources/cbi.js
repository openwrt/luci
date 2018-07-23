/*
	LuCI - Lua Configuration Interface

	Copyright 2008 Steven Barth <steven@midlink.org>
	Copyright 2008-2012 Jo-Philipp Wich <jow@openwrt.org>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
*/

var cbi_d = [];
var cbi_t = [];
var cbi_strings = { path: {}, label: {} };

function Int(x) {
	return (/^-?\d+$/.test(x) ? +x : NaN);
}

function Dec(x) {
	return (/^-?\d+(?:\.\d+)?$/.test(x) ? +x : NaN);
}

function IPv4(x) {
	if (!x.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/))
		return null;

	if (RegExp.$1 > 255 || RegExp.$2 > 255 || RegExp.$3 > 255 || RegExp.$4 > 255)
		return null;

	return [ +RegExp.$1, +RegExp.$2, +RegExp.$3, +RegExp.$4 ];
}

function IPv6(x) {
	if (x.match(/^([a-fA-F0-9:]+):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)) {
		var v6 = RegExp.$1, v4 = IPv4(RegExp.$2);

		if (!v4)
			return null;

		x = v6 + ':' + (v4[0] * 256 + v4[1]).toString(16)
		       + ':' + (v4[2] * 256 + v4[3]).toString(16);
	}

	if (!x.match(/^[a-fA-F0-9:]+$/))
		return null;

	var prefix_suffix = x.split(/::/);

	if (prefix_suffix.length > 2)
		return null;

	var prefix = (prefix_suffix[0] || '0').split(/:/);
	var suffix = prefix_suffix.length > 1 ? (prefix_suffix[1] || '0').split(/:/) : [];

	if (suffix.length ? (prefix.length + suffix.length > 7) : (prefix.length > 8))
		return null;

	var i, word;
	var words = [];

	for (i = 0, word = parseInt(prefix[0], 16); i < prefix.length; word = parseInt(prefix[++i], 16))
		if (prefix[i].length <= 4 && !isNaN(word) && word <= 0xFFFF)
			words.push(word);
		else
			return null;

	for (i = 0; i < (8 - prefix.length - suffix.length); i++)
		words.push(0);

	for (i = 0, word = parseInt(suffix[0], 16); i < suffix.length; word = parseInt(suffix[++i], 16))
		if (suffix[i].length <= 4 && !isNaN(word) && word <= 0xFFFF)
			words.push(word);
		else
			return null;

	return words;
}

var cbi_validators = {

	'integer': function()
	{
		return !!Int(this);
	},

	'uinteger': function()
	{
		return (Int(this) >= 0);
	},

	'float': function()
	{
		return !!Dec(this);
	},

	'ufloat': function()
	{
		return (Dec(this) >= 0);
	},

	'ipaddr': function()
	{
		return cbi_validators.ip4addr.apply(this) ||
			cbi_validators.ip6addr.apply(this);
	},

	'ip4addr': function()
	{
		var m = this.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|\/(\d{1,2}))?$/);
		return !!(m && IPv4(m[1]) && (m[2] ? IPv4(m[2]) : (m[3] ? cbi_validators.ip4prefix.apply(m[3]) : true)));
	},

	'ip6addr': function()
	{
		var m = this.match(/^([0-9a-fA-F:.]+)(?:\/(\d{1,3}))?$/);
		return !!(m && IPv6(m[1]) && (m[2] ? cbi_validators.ip6prefix.apply(m[2]) : true));
	},

	'ip4prefix': function()
	{
		return !isNaN(this) && this >= 0 && this <= 32;
	},

	'ip6prefix': function()
	{
		return !isNaN(this) && this >= 0 && this <= 128;
	},

	'cidr': function()
	{
		return cbi_validators.cidr4.apply(this) ||
			cbi_validators.cidr6.apply(this);
	},

	'cidr4': function()
	{
		var m = this.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
		return !!(m && IPv4(m[1]) && cbi_validators.ip4prefix.apply(m[2]));
	},

	'cidr6': function()
	{
		var m = this.match(/^([0-9a-fA-F:.]+)\/(\d{1,3})$/);
		return !!(m && IPv6(m[1]) && cbi_validators.ip6prefix.apply(m[2]));
	},

	'ipnet4': function()
	{
		var m = this.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
		return !!(m && IPv4(m[1]) && IPv4(m[2]));
	},

	'ipnet6': function()
	{
		var m = this.match(/^([0-9a-fA-F:.]+)\/([0-9a-fA-F:.]+)$/);
		return !!(m && IPv6(m[1]) && IPv6(m[2]));
	},

	'ip6hostid': function()
	{
		if (this == "eui64" || this == "random")
			return true;

		var v6 = IPv6(this);
		return !(!v6 || v6[0] || v6[1] || v6[2] || v6[3]);
	},

	'ipmask': function()
	{
		return cbi_validators.ipmask4.apply(this) ||
			cbi_validators.ipmask6.apply(this);
	},

	'ipmask4': function()
	{
		return cbi_validators.cidr4.apply(this) ||
			cbi_validators.ipnet4.apply(this) ||
			cbi_validators.ip4addr.apply(this);
	},

	'ipmask6': function()
	{
		return cbi_validators.cidr6.apply(this) ||
			cbi_validators.ipnet6.apply(this) ||
			cbi_validators.ip6addr.apply(this);
	},

	'port': function()
	{
		var p = Int(this);
		return (p >= 0 && p <= 65535);
	},

	'portrange': function()
	{
		if (this.match(/^(\d+)-(\d+)$/))
		{
			var p1 = +RegExp.$1;
			var p2 = +RegExp.$2;
			return (p1 <= p2 && p2 <= 65535);
		}

		return cbi_validators.port.apply(this);
	},

	'macaddr': function()
	{
		return (this.match(/^([a-fA-F0-9]{2}:){5}[a-fA-F0-9]{2}$/) != null);
	},

	'host': function(ipv4only)
	{
		return cbi_validators.hostname.apply(this) ||
			((ipv4only != 1) && cbi_validators.ipaddr.apply(this)) ||
			((ipv4only == 1) && cbi_validators.ip4addr.apply(this));
	},

	'hostname': function(strict)
	{
		if (this.length <= 253)
			return (this.match(/^[a-zA-Z0-9_]+$/) != null ||
			        (this.match(/^[a-zA-Z0-9_][a-zA-Z0-9_\-.]*[a-zA-Z0-9]$/) &&
			         this.match(/[^0-9.]/))) &&
			       (!strict || !this.match(/^_/));

		return false;
	},

	'network': function()
	{
		return cbi_validators.uciname.apply(this) ||
			cbi_validators.host.apply(this);
	},

	'hostport': function(ipv4only)
	{
		var hp = this.split(/:/);

		if (hp.length == 2)
			return (cbi_validators.host.apply(hp[0], ipv4only) &&
			        cbi_validators.port.apply(hp[1]));

		return false;
	},

	'ip4addrport': function()
	{
		var hp = this.split(/:/);

		if (hp.length == 2)
			return (cbi_validators.ipaddr.apply(hp[0]) &&
			        cbi_validators.port.apply(hp[1]));
		return false;
	},

	'ipaddrport': function(bracket)
	{
		if (this.match(/^([^\[\]:]+):([^:]+)$/)) {
			var addr = RegExp.$1
			var port = RegExp.$2
			return (cbi_validators.ip4addr.apply(addr) &&
				cbi_validators.port.apply(port));
                } else if ((bracket == 1) && (this.match(/^\[(.+)\]:([^:]+)$/))) {
			var addr = RegExp.$1
			var port = RegExp.$2
			return (cbi_validators.ip6addr.apply(addr) &&
				cbi_validators.port.apply(port));
                } else if ((bracket != 1) && (this.match(/^([^\[\]]+):([^:]+)$/))) {
			var addr = RegExp.$1
			var port = RegExp.$2
			return (cbi_validators.ip6addr.apply(addr) &&
				cbi_validators.port.apply(port));
		} else {
			return false;
		}
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
		var val = Dec(this);
		return (val >= +min && val <= +max);
	},

	'min': function(min)
	{
		return (Dec(this) >= +min);
	},

	'max': function(max)
	{
		return (Dec(this) <= +max);
	},

	'rangelength': function(min, max)
	{
		var val = '' + this;
		return ((val.length >= +min) && (val.length <= +max));
	},

	'minlength': function(min)
	{
		return ((''+this).length >= +min);
	},

	'maxlength': function(max)
	{
		return ((''+this).length <= +max);
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
		return (this.match(/^[0-9\*#!\.]+$/) != null);
	},
	'timehhmmss': function()
	{
		return (this.match(/^[0-6][0-9]:[0-6][0-9]:[0-6][0-9]$/) != null);
	},
	'dateyyyymmdd': function()
	{
		if (this == null) {
			return false;
		}
		if (this.match(/^(\d\d\d\d)-(\d\d)-(\d\d)/)) {
			var year = RegExp.$1;
			var month = RegExp.$2;
			var day = RegExp.$2

			var days_in_month = [ 31, 28, 31, 30, 31, 30, 31, 31, 30 , 31, 30, 31 ];
			function is_leap_year(year) {
				return ((year % 4) == 0) && ((year % 100) != 0) || ((year % 400) == 0);
			}
			function get_days_in_month(month, year) {
				if ((month == 2) && is_leap_year(year)) {
					return 29;
				} else {
					return days_in_month[month];
				}
			}
			/* Firewall rules in the past don't make sense */
			if (year < 2015) {
				return false;
			}
			if ((month <= 0) || (month > 12)) {
				return false;
			}
			if ((day <= 0) || (day > get_days_in_month(month, year))) {
				return false;
			}
			return true;

		} else {
			return false;
		}
	}
};


function cbi_d_add(field, dep, index) {
	var obj = (typeof(field) === 'string') ? document.getElementById(field) : field;
	if (obj) {
		var entry
		for (var i=0; i<cbi_d.length; i++) {
			if (cbi_d[i].id == obj.id) {
				entry = cbi_d[i];
				break;
			}
		}
		if (!entry) {
			entry = {
				"node": obj,
				"id": obj.id,
				"parent": obj.parentNode.id,
				"deps": [],
				"index": index
			};
			cbi_d.unshift(entry);
		}
		entry.deps.push(dep)
	}
}

function cbi_d_checkvalue(target, ref) {
	var value = null,
	    query = 'input[id="'+target+'"], input[name="'+target+'"], ' +
	            'select[id="'+target+'"], select[name="'+target+'"]';

	document.querySelectorAll(query).forEach(function(i) {
		if (value === null && ((i.type !== 'radio' && i.type !== 'checkbox') || i.checked === true))
			value = i.value;
	});

	return (((value !== null) ? value : "") == ref);
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

		if (istat ^ reverse) {
			return true;
		}
	}
	return def;
}

function cbi_d_update() {
	var state = false;
	for (var i=0; i<cbi_d.length; i++) {
		var entry = cbi_d[i];
		var node  = document.getElementById(entry.id);
		var parent = document.getElementById(entry.parent);

		if (node && node.parentNode && !cbi_d_check(entry.deps)) {
			node.parentNode.removeChild(node);
			state = true;
		} else if (parent && (!node || !node.parentNode) && cbi_d_check(entry.deps)) {
			var next = undefined;

			for (next = parent.firstChild; next; next = next.nextSibling) {
				if (next.getAttribute && parseInt(next.getAttribute('data-index'), 10) > entry.index) {
					break;
				}
			}

			if (!next) {
				parent.appendChild(entry.node);
			} else {
				parent.insertBefore(entry.node, next);
			}

			state = true;
		}

		// hide optionals widget if no choices remaining
		if (parent && parent.parentNode && parent.getAttribute('data-optionals'))
			parent.parentNode.style.display = (parent.options.length <= 1) ? 'none' : '';
	}

	if (entry && entry.parent) {
		if (!cbi_t_update())
			cbi_tag_last(parent);
	}

	if (state) {
		cbi_d_update();
	}
}

function cbi_init() {
	var nodes;

	nodes = document.querySelectorAll('[data-strings]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var str = JSON.parse(node.getAttribute('data-strings'));
		for (var key in str) {
			for (var key2 in str[key]) {
				var dst = cbi_strings[key] || (cbi_strings[key] = { });
				    dst[key2] = str[key][key2];
			}
		}
	}

	nodes = document.querySelectorAll('[data-depends]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var index = parseInt(node.getAttribute('data-index'), 10);
		var depends = JSON.parse(node.getAttribute('data-depends'));
		if (!isNaN(index) && depends.length > 0) {
			for (var alt = 0; alt < depends.length; alt++) {
				cbi_d_add(node, depends[alt], index);
			}
		}
	}

	nodes = document.querySelectorAll('[data-update]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var events = node.getAttribute('data-update').split(' ');
		for (var j = 0, event; (event = events[j]) !== undefined; j++) {
			cbi_bind(node, event, cbi_d_update);
		}
	}

	nodes = document.querySelectorAll('[data-choices]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var choices = JSON.parse(node.getAttribute('data-choices'));
		var options = {};

		for (var j = 0; j < choices[0].length; j++)
			options[choices[0][j]] = choices[1][j];

		var def = (node.getAttribute('data-optional') === 'true')
			? node.placeholder || '' : null;

		cbi_combobox_init(node, options, def,
		                  node.getAttribute('data-manual'));
	}

	nodes = document.querySelectorAll('[data-dynlist]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		var choices = JSON.parse(node.getAttribute('data-dynlist'));
		var options = null;

		if (choices[0] && choices[0].length) {
			options = {};

			for (var j = 0; j < choices[0].length; j++)
				options[choices[0][j]] = choices[1][j];
		}

		cbi_dynlist_init(node, choices[2], choices[3], options);
	}

	nodes = document.querySelectorAll('[data-type]');

	for (var i = 0, node; (node = nodes[i]) !== undefined; i++) {
		cbi_validate_field(node, node.getAttribute('data-optional') === 'true',
		                   node.getAttribute('data-type'));
	}

	document.querySelectorAll('.cbi-dropdown').forEach(function(s) {
		cbi_dropdown_init(s);
	});

	document.querySelectorAll('.cbi-tooltip:not(:empty)').forEach(function(s) {
		s.parentNode.classList.add('cbi-tooltip-container');
	});

	document.querySelectorAll('.cbi-section-remove > input[name^="cbi.rts"]').forEach(function(i) {
		var handler = function(ev) {
			var bits = this.name.split(/\./),
			    section = document.getElementById('cbi-' + bits[2] + '-' + bits[3]);

		    section.style.opacity = (ev.type === 'mouseover') ? 0.5 : '';
		};

		i.addEventListener('mouseover', handler);
		i.addEventListener('mouseout', handler);
	});

	cbi_d_update();
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

function cbi_combobox(id, values, def, man, focus) {
	var selid = "cbi.combobox." + id;
	if (document.getElementById(selid)) {
		return
	}

	var obj = document.getElementById(id)
	var sel = document.createElement("select");
		sel.id = selid;
		sel.index = obj.index;
		sel.className = obj.className.replace(/cbi-input-text/, 'cbi-input-select');

	if (obj.nextSibling) {
		obj.parentNode.insertBefore(sel, obj.nextSibling);
	} else {
		obj.parentNode.appendChild(sel);
	}

	var dt = obj.getAttribute('cbi_datatype');
	var op = obj.getAttribute('cbi_optional');

	if (!values[obj.value]) {
		if (obj.value == "") {
			var optdef = document.createElement("option");
			optdef.value = "";
			optdef.appendChild(document.createTextNode(typeof(def) === 'string' ? def : cbi_strings.label.choose));
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
	optman.appendChild(document.createTextNode(typeof(man) === 'string' ? man : cbi_strings.label.custom));
	sel.appendChild(optman);

	obj.style.display = "none";

	if (dt)
		cbi_validate_field(sel, op == 'true', dt);

	cbi_bind(sel, "change", function() {
		if (sel.selectedIndex == sel.options.length - 1) {
			obj.style.display = "inline";
			sel.blur();
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
	if (focus) {
		sel.focus();
		sel.blur();
	}
}

function cbi_combobox_init(id, values, def, man) {
	var obj = (typeof(id) === 'string') ? document.getElementById(id) : id;
	cbi_bind(obj, "blur", function() {
		cbi_combobox(obj.id, values, def, man, true);
	});
	cbi_combobox(obj.id, values, def, man, false);
}

function cbi_filebrowser(id, defpath) {
	var field   = document.getElementById(id);
	var browser = window.open(
		cbi_strings.path.browser + ( field.value || defpath || '' ) + '?field=' + id,
		"luci_filebrowser", "width=300,height=400,left=100,top=200,scrollbars=yes"
	);

	browser.focus();
}

function cbi_browser_init(id, resource, defpath)
{
	function cbi_browser_btnclick(e) {
		cbi_filebrowser(id, defpath);
		return false;
	}

	var field = document.getElementById(id);

	var btn = document.createElement('img');
	btn.className = 'cbi-image-button';
	btn.src = (resource || cbi_strings.path.resource) + '/cbi/folder.gif';
	field.parentNode.insertBefore(btn, field.nextSibling);

	cbi_bind(btn, 'click', cbi_browser_btnclick);
}

function cbi_dynlist_init(parent, datatype, optional, choices)
{
	var prefix = parent.getAttribute('data-prefix');
	var holder = parent.getAttribute('data-placeholder');

	var values;

	function cbi_dynlist_redraw(focus, add, del)
	{
		values = [ ];

		while (parent.firstChild)
		{
			var n = parent.firstChild;
			var i = +n.index;

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

			var b = E('div', {
				class: 'cbi-button cbi-button-' + ((i+1) < values.length ? 'remove' : 'add')
			}, (i+1) < values.length ? '×' : '+');

			parent.appendChild(t);
			parent.appendChild(b);
			if (datatype == 'file')
			{
				cbi_browser_init(t.id, null, parent.getAttribute('data-browser-path'));
			}

			parent.appendChild(document.createElement('br'));

			if (datatype)
			{
				cbi_validate_field(t.id, ((i+1) == values.length) || optional, datatype);
			}

			if (choices)
			{
				cbi_combobox_init(t.id, choices, '', cbi_strings.label.custom);
				b.index = i;

				cbi_bind(b, 'keydown',  cbi_dynlist_keydown);
				cbi_bind(b, 'keypress', cbi_dynlist_keypress);

				if (i == focus || -i == focus)
					b.focus();
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
		while (prev && prev.name != prefix)
			prev = prev.previousSibling;

		var next = se.nextSibling;
		while (next && next.name != prefix)
			next = next.nextSibling;

		/* advance one further in combobox case */
		if (next && next.nextSibling.name == prefix)
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
		var input = se.previousSibling;
		while (input && input.name != prefix) {
			input = input.previousSibling;
		}

		if (se.classList.contains('cbi-button-remove')) {
			input.value = '';

			cbi_dynlist_keydown({
				target:  input,
				keyCode: 8
			});
		}
		else {
			cbi_dynlist_keydown({
				target:  input,
				keyCode: 13
			});
		}

		return false;
	}

	cbi_dynlist_redraw(NaN, -1, -1);
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
			var t = cbi_t[sid][tid].tab;
			var c = cbi_t[sid][tid].container;

			if (!c.firstElementChild) {
				t.style.display = 'none';
			}
			else if (t.style.display == 'none') {
				t.style.display = '';
				t.className += ' cbi-tab-highlighted';
				hl_tabs.push(t);
			}

			cbi_tag_last(c);
			updated = true;
		}

	if (hl_tabs.length > 0)
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
	var tr = findParent(elem.parentNode, '.cbi-section-table-row');

	if (!tr)
		return false;

	tr.classList.remove('flash');

	if (up) {
		var prev = tr.previousElementSibling;

		if (prev && prev.classList.contains('cbi-section-table-row'))
			tr.parentNode.insertBefore(tr, prev);
		else
			return;
	}
	else {
		var next = tr.nextElementSibling ? tr.nextElementSibling.nextElementSibling : null;

		if (next && next.classList.contains('cbi-section-table-row'))
			tr.parentNode.insertBefore(tr, next);
		else if (!next)
			tr.parentNode.appendChild(tr);
		else
			return;
	}

	var ids = [ ];

	for (var i = 0, n = 0; i < tr.parentNode.childNodes.length; i++) {
		var node = tr.parentNode.childNodes[i];
		if (node.classList && node.classList.contains('cbi-section-table-row')) {
			node.classList.remove('cbi-rowstyle-1');
			node.classList.remove('cbi-rowstyle-2');
			node.classList.add((n++ % 2) ? 'cbi-rowstyle-2' : 'cbi-rowstyle-1');

			if (/-([^\-]+)$/.test(node.id))
				ids.push(RegExp.$1);
		}
	}

	var input = document.getElementById(store);
	if (input)
		input.value = ids.join(' ');

	window.scrollTo(0, tr.offsetTop);
	window.setTimeout(function() { tr.classList.add('flash'); }, 1);

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

function cbi_submit(elem, name, value, action)
{
	var form = elem.form || findParent(elem, 'form');

	if (!form)
		return false;

	if (action)
		form.action = action;

	if (name) {
		var hidden = form.querySelector('input[type="hidden"][name="%s"]'.format(name)) ||
			E('input', { type: 'hidden', name: name });

		hidden.value = value || '1';
		form.appendChild(hidden);
	}

	form.submit();
	return true;
}

String.prototype.format = function()
{
	if (!RegExp)
		return;

	var html_esc = [/&/g, '&#38;', /"/g, '&#34;', /'/g, '&#39;', /</g, '&#60;', />/g, '&#62;'];
	var quot_esc = [/"/g, '&#34;', /'/g, '&#39;'];

	function esc(s, r) {
		if (typeof(s) !== 'string' && !(s instanceof String))
			return '';

		for( var i = 0; i < r.length; i += 2 )
			s = s.replace(r[i], r[i+1]);
		return s;
	}

	var str = this;
	var out = '';
	var re = /^(([^%]*)%('.|0|\x20)?(-)?(\d+)?(\.\d+)?(%|b|c|d|u|f|o|s|x|X|q|h|j|t|m))/;
	var a = b = [], numSubstitutions = 0, numMatches = 0;

	while (a = re.exec(str))
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
				else
					pad = ' ';

				var justifyRight = true;
				if (pJustify && pJustify === "-")
					justifyRight = false;

				var minLength = -1;
				if (pMinLength)
					minLength = +pMinLength;

				var precision = -1;
				if (pPrecision && pType == 'f')
					precision = +pPrecision.substring(1);

				var subst = param;

				switch(pType)
				{
					case 'b':
						subst = (+param || 0).toString(2);
						break;

					case 'c':
						subst = String.fromCharCode(+param || 0);
						break;

					case 'd':
						subst = ~~(+param || 0);
						break;

					case 'u':
						subst = ~~Math.abs(+param || 0);
						break;

					case 'f':
						subst = (precision > -1)
							? ((+param || 0.0)).toFixed(precision)
							: (+param || 0.0);
						break;

					case 'o':
						subst = (+param || 0).toString(8);
						break;

					case 's':
						subst = param;
						break;

					case 'x':
						subst = ('' + (+param || 0).toString(16)).toLowerCase();
						break;

					case 'X':
						subst = ('' + (+param || 0).toString(16)).toUpperCase();
						break;

					case 'h':
						subst = esc(param, html_esc);
						break;

					case 'q':
						subst = esc(param, quot_esc);
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
						var mf = pMinLength ? +pMinLength : 1000;
						var pr = pPrecision ? ~~(10 * +('0' + pPrecision)) : 2;

						var i = 0;
						var val = (+param || 0);
						var units = [ ' ', ' K', ' M', ' G', ' T', ' P', ' E' ];

						for (i = 0; (i < units.length) && (val > mf); i++)
							val /= mf;

						subst = (i ? val.toFixed(pr) : val) + units[i];
						pMinLength = null;
						break;
				}
			}
		}

		if (pMinLength) {
			subst = subst.toString();
			for (var i = subst.length; i < pMinLength; i++)
				if (pJustify == '-')
					subst = subst + ' ';
				else
					subst = pad + subst;
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

if (window.NodeList && !NodeList.prototype.forEach) {
	NodeList.prototype.forEach = function (callback, thisArg) {
		thisArg = thisArg || window;
		for (var i = 0; i < this.length; i++) {
			callback.call(thisArg, this[i], i, this);
		}
	};
}


var dummyElem, domParser;

function isElem(e)
{
	return (typeof(e) === 'object' && e !== null && 'nodeType' in e);
}

function toElem(s)
{
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
}

function findParent(node, selector)
{
	while (node)
		if (node.msMatchesSelector && node.msMatchesSelector(selector))
			return node;
		else if (node.matches && node.matches(selector))
			return node;
		else
			node = node.parentNode;

	return null;
}

function E()
{
	var html = arguments[0],
	    attr = (arguments[1] instanceof Object && !Array.isArray(arguments[1])) ? arguments[1] : null,
	    data = attr ? arguments[2] : arguments[1],
	    elem;

	if (isElem(html))
		elem = html;
	else if (html.charCodeAt(0) === 60)
		elem = toElem(html);
	else
		elem = document.createElement(html);

	if (!elem)
		return null;

	if (attr)
		for (var key in attr)
			if (attr.hasOwnProperty(key) && attr[key] !== null && attr[key] !== undefined)
				elem.setAttribute(key, attr[key]);

	if (typeof(data) === 'function')
		data = data(elem);

	if (isElem(data)) {
		elem.appendChild(data);
	}
	else if (Array.isArray(data)) {
		for (var i = 0; i < data.length; i++)
			if (isElem(data[i]))
				elem.appendChild(data[i]);
			else
				elem.appendChild(document.createTextNode('' + data[i]));
	}
	else if (data !== null && data !== undefined) {
		elem.innerHTML = '' + data;
	}

	return elem;
}

if (typeof(window.CustomEvent) !== 'function') {
	function CustomEvent(event, params) {
		params = params || { bubbles: false, cancelable: false, detail: undefined };
		var evt = document.createEvent('CustomEvent');
		    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
		return evt;
	}

	CustomEvent.prototype = window.Event.prototype;
	window.CustomEvent = CustomEvent;
}

CBIDropdown = {
	openDropdown: function(sb) {
		var st = window.getComputedStyle(sb, null),
		    ul = sb.querySelector('ul'),
		    li = ul.querySelectorAll('li'),
		    sel = ul.querySelector('[selected]'),
		    rect = sb.getBoundingClientRect(),
		    h = sb.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom),
		    mh = this.dropdown_items * h,
		    eh = Math.min(mh, li.length * h);

		document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
			s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
		});

		ul.style.maxHeight = mh + 'px';
		sb.setAttribute('open', '');

		ul.scrollTop = sel ? Math.max(sel.offsetTop - sel.offsetHeight, 0) : 0;
		ul.querySelectorAll('[selected] input[type="checkbox"]').forEach(function(c) {
			c.checked = true;
		});

		ul.style.top = ul.style.bottom = '';
		ul.style[((sb.getBoundingClientRect().top + eh) > window.innerHeight) ? 'bottom' : 'top'] = rect.height + 'px';
		ul.classList.add('dropdown');

		var pv = ul.cloneNode(true);
		    pv.classList.remove('dropdown');
		    pv.classList.add('preview');

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
		    li = ul.querySelectorAll('li');

		li.forEach(function(l) { l.removeAttribute('tabindex'); });
		sb.lastElementChild.removeAttribute('tabindex');

		sb.removeChild(pv);
		sb.removeAttribute('open');
		sb.style.width = sb.style.height = '';

		ul.classList.remove('dropdown');

		if (!no_focus)
			this.setFocus(sb, sb);

		this.saveValues(sb, ul);
	},

	toggleItem: function(sb, li, force_state) {
		if (li.hasAttribute('unselectable'))
			return;

		if (this.multi) {
			var cbox = li.querySelector('input[type="checkbox"]'),
			    items = li.parentNode.querySelectorAll('li'),
			    label = sb.querySelector('ul.preview'),
			    sel = li.parentNode.querySelectorAll('[selected]').length,
			    more = sb.querySelector('.more'),
			    ndisplay = this.display_items,
			    n = 0;

			if (li.hasAttribute('selected')) {
				if (force_state !== true) {
					if (sel > 1 || this.optional) {
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

			while (label.firstElementChild)
				label.removeChild(label.firstElementChild);

			for (var i = 0; i < items.length; i++) {
				items[i].removeAttribute('display');
				if (items[i].hasAttribute('selected')) {
					if (ndisplay-- > 0) {
						items[i].setAttribute('display', n++);
						label.appendChild(items[i].cloneNode(true));
					}
					var c = items[i].querySelector('input[type="checkbox"]');
					if (c)
						c.disabled = (sel == 1 && !this.optional);
				}
			}

			if (ndisplay < 0)
				sb.setAttribute('more', '');
			else
				sb.removeAttribute('more');

			if (ndisplay === this.display_items)
				sb.setAttribute('empty', '');
			else
				sb.removeAttribute('empty');

			more.innerHTML = (ndisplay === this.display_items) ? this.placeholder : '···';
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
		var sel = ul.querySelectorAll('[selected]'),
		    div = sb.lastElementChild;

		while (div.lastElementChild)
			div.removeChild(div.lastElementChild);

		sel.forEach(function (s) {
			div.appendChild(E('input', {
				type: 'hidden',
				name: s.hasAttribute('name') ? s.getAttribute('name') : (sb.getAttribute('name') || ''),
				value: s.hasAttribute('value') ? s.getAttribute('value') : s.innerText
			}));
		});

		cbi_d_update();
	},

	setFocus: function(sb, elem, scroll) {
		if (sb && sb.hasAttribute && sb.hasAttribute('locked-in'))
			return;

		document.querySelectorAll('.focus').forEach(function(e) {
			if (e.nodeName.toLowerCase() !== 'input') {
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
		    val = (value || '').trim().split(/\s+/),
		    ul = sb.querySelector('ul');

		if (!sbox.multi)
			val.length = Math.min(val.length, 1);

		val.forEach(function(item) {
			var new_item = null;

			ul.childNodes.forEach(function(li) {
				if (li.getAttribute && li.getAttribute('value') === item)
					new_item = li;
			});

			if (!new_item) {
				var markup,
				    tpl = sb.querySelector(sbox.template);

				if (tpl)
					markup = (tpl.textContent || tpl.innerHTML || tpl.firstChild.data).replace(/^<!--|-->$/, '').trim();
				else
					markup = '<li value="{{value}}">{{value}}</li>';

				new_item = E(markup.replace(/{{value}}/g, item));

				if (sbox.multi) {
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
	}
};

function cbi_dropdown_init(sb) {
	if (!(this instanceof cbi_dropdown_init))
		return new cbi_dropdown_init(sb);

	this.multi = sb.hasAttribute('multiple');
	this.optional = sb.hasAttribute('optional');
	this.placeholder = sb.getAttribute('placeholder') || '---';
	this.display_items = parseInt(sb.getAttribute('display-items') || 3);
	this.dropdown_items = parseInt(sb.getAttribute('dropdown-items') || 5);
	this.create = sb.getAttribute('item-create') || '.create-item-input';
	this.template = sb.getAttribute('item-template') || 'script[type="item-template"]';

	var sbox = this,
	    ul = sb.querySelector('ul'),
	    items = ul.querySelectorAll('li'),
	    more = sb.appendChild(E('span', { class: 'more', tabindex: -1 }, '···')),
	    open = sb.appendChild(E('span', { class: 'open', tabindex: -1 }, '▾')),
	    canary = sb.appendChild(E('div')),
	    create = sb.querySelector(this.create),
	    ndisplay = this.display_items,
	    n = 0;

	if (this.multi) {
		for (var i = 0; i < items.length; i++) {
			sbox.transformItem(sb, items[i]);

			if (items[i].hasAttribute('selected') && ndisplay-- > 0)
				items[i].setAttribute('display', n++);
		}
	}
	else {
		var sel = sb.querySelectorAll('[selected]');

		sel.forEach(function(s) {
			s.removeAttribute('selected');
		});

		var s = sel[0] || items[0];
		if (s) {
			s.setAttribute('selected', '');
			s.setAttribute('display', n++);
		}

		ndisplay--;

		if (this.optional && !ul.querySelector('li[value=""]')) {
			var placeholder = E('li', { placeholder: '' }, this.placeholder);
			ul.firstChild ? ul.insertBefore(placeholder, ul.firstChild) : ul.appendChild(placeholder);
		}
	}

	sbox.saveValues(sb, ul);

	ul.setAttribute('tabindex', -1);
	sb.setAttribute('tabindex', 0);

	if (ndisplay < 0)
		sb.setAttribute('more', '')
	else
		sb.removeAttribute('more');

	if (ndisplay === this.display_items)
		sb.setAttribute('empty', '')
	else
		sb.removeAttribute('empty');

	more.innerHTML = (ndisplay === this.display_items) ? this.placeholder : '···';


	sb.addEventListener('click', function(ev) {
		if (!this.hasAttribute('open')) {
			if (ev.target.nodeName.toLowerCase() !== 'input')
				sbox.openDropdown(this);
		}
		else {
			var li = findParent(ev.target, 'li');
			if (li && li.parentNode.classList.contains('dropdown'))
				sbox.toggleItem(this, li);
		}

		ev.preventDefault();
		ev.stopPropagation();
	});

	sb.addEventListener('keydown', function(ev) {
		if (ev.target.nodeName.toLowerCase() === 'input')
			return;

		if (!this.hasAttribute('open')) {
			switch (ev.keyCode) {
			case 37:
			case 38:
			case 39:
			case 40:
				sbox.openDropdown(this);
				ev.preventDefault();
			}
		}
		else
		{
			var active = findParent(document.activeElement, 'li');

			switch (ev.keyCode) {
			case 27:
				sbox.closeDropdown(this);
				break;

			case 13:
				if (active) {
					if (!active.hasAttribute('selected'))
						sbox.toggleItem(this, active);
					sbox.closeDropdown(this);
					ev.preventDefault();
				}
				break;

			case 32:
				if (active) {
					sbox.toggleItem(this, active);
					ev.preventDefault();
				}
				break;

			case 38:
				if (active && active.previousElementSibling) {
					sbox.setFocus(this, active.previousElementSibling);
					ev.preventDefault();
				}
				break;

			case 40:
				if (active && active.nextElementSibling) {
					sbox.setFocus(this, active.nextElementSibling);
					ev.preventDefault();
				}
				break;
			}
		}
	});

	sb.addEventListener('cbi-dropdown-close', function(ev) {
		sbox.closeDropdown(this, true);
	});

	if ('ontouchstart' in window) {
		sb.addEventListener('touchstart', function(ev) { ev.stopPropagation(); });
		window.addEventListener('touchstart', sbox.closeAllDropdowns);
	}
	else {
		sb.addEventListener('mouseover', function(ev) {
			if (!this.hasAttribute('open'))
				return;

			var li = findParent(ev.target, 'li');
			if (li) {
				if (li.parentNode.classList.contains('dropdown'))
					sbox.setFocus(this, li);

				ev.stopPropagation();
			}
		});

		sb.addEventListener('focus', function(ev) {
			document.querySelectorAll('.cbi-dropdown[open]').forEach(function(s) {
				if (s !== this || this.hasAttribute('open'))
					s.dispatchEvent(new CustomEvent('cbi-dropdown-close', {}));
			});
		});

		canary.addEventListener('focus', function(ev) {
			sbox.closeDropdown(this.parentNode);
		});

		window.addEventListener('mouseover', sbox.setFocus);
		window.addEventListener('click', sbox.closeAllDropdowns);
	}

	if (create) {
		create.addEventListener('keydown', function(ev) {
			switch (ev.keyCode) {
			case 13:
				sbox.createItems(sb, this.value);
				ev.preventDefault();
				this.value = '';
				this.blur();
				break;
			}
		});

		create.addEventListener('focus', function(ev) {
			var cbox = findParent(this, 'li').querySelector('input[type="checkbox"]');
			if (cbox) cbox.checked = true;
			sb.setAttribute('locked-in', '');
		});

		create.addEventListener('blur', function(ev) {
			var cbox = findParent(this, 'li').querySelector('input[type="checkbox"]');
			if (cbox) cbox.checked = false;
			sb.removeAttribute('locked-in');
		});

		var li = findParent(create, 'li');

		li.setAttribute('unselectable', '');
		li.addEventListener('click', function(ev) {
			this.querySelector(sbox.create).focus();
		});
	}
}

cbi_dropdown_init.prototype = CBIDropdown;

function cbi_update_table(table, data, placeholder) {
	target = isElem(table) ? table : document.querySelector(table);

	if (!isElem(target))
		return;

	target.querySelectorAll('.tr.table-titles, .cbi-section-table-titles').forEach(function(thead) {
		var titles = [];

		thead.querySelectorAll('.th').forEach(function(th) {
			titles.push(th);
		});

		if (Array.isArray(data)) {
			var n = 0, rows = target.querySelectorAll('.tr');

			data.forEach(function(row) {
				var trow = E('div', { 'class': 'tr' });

				for (var i = 0; i < titles.length; i++) {
					var text = (titles[i].innerText || '').trim();
					var td = trow.appendChild(E('div', {
						'class': titles[i].className,
						'data-title': (text !== '') ? text : null
					}, row[i] || ''));

					td.classList.remove('th');
					td.classList.add('td');
				}

				trow.classList.add('cbi-rowstyle-%d'.format((n++ % 2) ? 2 : 1));

				if (rows[n])
					target.replaceChild(trow, rows[n]);
				else
					target.appendChild(trow);
			});

			while (rows[++n])
				target.removeChild(rows[n]);

			if (placeholder && target.firstElementChild === target.lastElementChild) {
				var trow = target.appendChild(E('div', { 'class': 'tr placeholder' }));
				var td = trow.appendChild(E('div', { 'class': titles[0].className }, placeholder));

				td.classList.remove('th');
				td.classList.add('td');
			}
		}
		else {
			thead.parentNode.style.display = 'none';

			thead.parentNode.querySelectorAll('.tr, .cbi-section-table-row').forEach(function(trow) {
				if (trow !== thead) {
					var n = 0;
					trow.querySelectorAll('.th, .td').forEach(function(td) {
						if (n < titles.length) {
							var text = (titles[n++].innerText || '').trim();
							if (text !== '')
								td.setAttribute('data-title', text);
						}
					});
				}
			});

			thead.parentNode.style.display = '';
		}
	});
}

document.addEventListener('DOMContentLoaded', function() {
	document.querySelectorAll('.table').forEach(cbi_update_table);
});
