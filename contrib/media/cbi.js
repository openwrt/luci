var cbi_d = {};

function cbi_d_add(field, target, value) {
	if (!cbi_d[target]) {
		cbi_d[target] = {};
	}
	if (!cbi_d[target][value]) {
		cbi_d[target][value] = [];
	}
	cbi_d[target][value].push(field);
}

function cbi_d_update(target) {
	if (!cbi_d[target]) {
		return;
	}
	
	for (var x in cbi_d[target]) {
		for (var i=0; i<cbi_d[target][x].length; i++) {			
			document.getElementById(cbi_d[target][x][i]).style.display = "none";
		}
	}
	
	var t = document.getElementById(target);
	if (t && t.value && cbi_d[target][t.value]) {
		for (var i=0; i<cbi_d[target][t.value].length; i++) {			
			document.getElementById(cbi_d[target][t.value][i]).style.display = "block";
		}
	}
}

function cbi_d_init() {
	for (var x in cbi_d) {
		cbi_d_update(x);
	}
}