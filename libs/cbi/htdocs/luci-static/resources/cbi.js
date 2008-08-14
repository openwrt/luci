var cbi_d = {};

function cbi_d_add(field, target, value) {
	if (!cbi_d[target]) {
		cbi_d[target] = {};
	}
	if (!cbi_d[target][value]) {
		cbi_d[target][value] = [];
	}
	
	var obj = document.getElementById(field);
	if (obj) {
		var entry = {
			"node": obj,
			"parent": obj.parentNode,
			"next": obj.nextSibling	
		} 
		cbi_d[target][value].unshift(entry);
	}
}

function cbi_d_update(target) {
	if (!cbi_d[target]) {
		return;
	}
	
	for (var x in cbi_d[target]) {
		for (var i=0; i<cbi_d[target][x].length; i++) {	
			var entry = cbi_d[target][x][i];
			if (entry.node.parentNode) {
				entry.parent.removeChild(entry.node)
			}
		}
	}
	
	var t = document.getElementById(target);
	var value
	
	if (!t || !t.value) {
		value = "";
	} else {
		value = t.value;
		
		if (t.type == "checkbox") {
			value = t.checked ? value : "";
		}
	}
	
	if (cbi_d[target][value]) {
		for (var i=0; i<cbi_d[target][value].length; i++) {		
			var entry = cbi_d[target][value][i];
			if (!entry.next) {
				entry.parent.appendChild(entry.node);
			} else {
				entry.parent.insertBefore(entry.node, entry.next);
			}
		}
	}
}

function cbi_d_init() {
	for (var x in cbi_d) {
		cbi_d_update(x);
	}
}

function cbi_bind(obj, type, callback, mode) {
	if (typeof mode == "undefined") {
		mode = false;
	}
	if (!obj.addEventListener) {
		ieCallback = function(){
			var e = window.event;
			if (!e.target && e.srcElement) {
				e.target = e.srcElement;
			};
			e.target['_eCB' + type + callback] = callback;
			e.target['_eCB' + type + callback](e);
			e.target['_eCB' + type + callback] = null;
		};
		obj.attachEvent('on' + type, ieCallback);
	} else {
		obj.addEventListener(type, callback, mode);
	}
	return obj;
}

function cbi_combobox(id, values, def, man) {
	var obj = document.getElementById(id)
	var sel = document.createElement("select");
	obj.parentNode.appendChild(sel);

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
	})
}

function cbi_combobox_init(id, values, def, man) {
	var obj = document.getElementById(id);
	cbi_bind(obj, "blur", function() {
		cbi_combobox(id, values, def, man)
	});
	cbi_combobox(id, values, def, man);
}