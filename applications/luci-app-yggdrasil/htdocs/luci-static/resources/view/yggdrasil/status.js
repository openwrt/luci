'use strict';
'require view';
'require fs';
'require form';

function init_view() {
	var view = document.createElement("div");
	var self_info = document.createElement("div"); self_info.setAttribute("class", "table");

	var table_data = {
		"IPv6 address": "self-address",
		"IPv6 subnet": "self-subnet",
		"Coords": "self-coords",
		"Public key": "self-key",
		"Build name": "self-buildname",
		"Build version": "self-version"
	};

	Object.keys(table_data).forEach(function(k) {
		var tr = document.createElement("div");
		tr.setAttribute("class", "tr");
		var td1 = document.createElement("div"); td1.setAttribute("class", "td left");
		td1.textContent = k;
		var td2 = document.createElement("div"); td2.setAttribute("class", "td left");
		td2.id = table_data[k];

		tr.appendChild(td1); tr.appendChild(td2); self_info.appendChild(tr);
	});

	var info_title = document.createElement("h2"); info_title.innerText = _("Yggdrasil node status");
	view.appendChild(info_title);
	view.appendChild(self_info);
	var peering_title = document.createElement("h3"); peering_title.innerText = _("Active peers");
	view.appendChild(peering_title);

	var peerings = document.createElement("table"); 
	peerings.setAttribute("class", "table"); peerings.id = "yggdrasil-peerings";
	var tr = document.createElement("tr");
	tr.setAttribute("class", "tr table-titles");
	["Endpoint", "Address", "Coords", "Key", "Port"].forEach(function(t) {
		var th = document.createElement("th"); th.setAttribute("class", "th nowrap left");
		th.innerText = t;
		tr.appendChild(th);
	});
	peerings.appendChild(tr);
	view.appendChild(peerings);
	return view;
}

function update_active_peers() {
	fs.exec("/usr/sbin/yggdrasilctl", ["-json", "getPeers"]).then(function(res){
		if (res && res.code === 0) {
			var peers = JSON.parse(res.stdout.trim())["peers"];
			var table = document.querySelector('#yggdrasil-peerings');
			while (table.rows.length > 1) { table.deleteRow(1); }
			Object.keys(peers).forEach(function(address) {
				var row = table.insertRow(-1);
				row.style.fontSize = "xx-small";
				row.insertCell(-1).textContent = peers[address].remote;
				row.insertCell(-1).textContent = address;
				row.insertCell(-1).textContent = "[" + peers[address].coords.toString() + "]";
				row.insertCell(-1).textContent = peers[address].key;
				row.insertCell(-1).textContent = peers[address].port;
			});
		}
		setTimeout(update_active_peers, 5000);
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat("/usr/sbin/yggdrasilctl"), null),
			L.resolveDefault(fs.exec("/usr/sbin/yggdrasilctl", ["-json", "getSelf"]), null),
			L.resolveDefault(fs.exec("/usr/sbin/yggdrasilctl", ["-json", "getPeers"]), null)
		]);
	},
	render: function(info) {
		var view = init_view();

		if (info[0] && info[1] && info[1].code === 0) {
			var obj = JSON.parse(info[1].stdout.trim())["self"];
			var peers = JSON.parse(info[2].stdout.trim())["peers"];

			var address = Object.keys(obj)[0]; 
			var r = obj[address];
			view.querySelector('#self-address').innerText = address;
			view.querySelector('#self-subnet').innerText = r.subnet;
			view.querySelector('#self-coords').innerText = "[" + r.coords + "]";
			view.querySelector('#self-key').innerText = r.key;
			view.querySelector('#self-buildname').innerText = r.build_name;
			view.querySelector('#self-version').innerText = r.build_version;

			update_active_peers();
		} else {
			view.innerHTML = "<h2>Yggdrasil is not running</h2>";
		}
		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
