'use strict';
'require rpc';
'require uci';
'require view';

function etx_color(etx) {
	let color = '#bb3333';
	if (etx === 0) {
		color = '#bb3333';
	} else if (etx < 2) {
		color = '#00cc00';
	} else if (etx < 4) {
		color = '#ffcb05';
	} else if (etx < 10) {
		color = '#ff6600';
	}
	return color;
}

function snr_colors(snr) {
	let color = '#bb3333';
	if (snr === 0) {
		color = '#bb3333';
	} else if (snr > 30) {
		color = '#00cc00';
	} else if (snr > 20) {
		color = '#ffcb05';
	} else if (snr > 5) {
		color = '#ff6600';
	}
	return color;
}

function css(selector, property, value) {
	for (let i = 0; i < document.styleSheets.length; i++) {
		try {
			document.styleSheets[i].insertRule(selector + ' {' + property + ':' + value + '}', document.styleSheets[i].cssRules.length);
		} catch (err) {
			try {
				document.styleSheets[i].addRule(selector, property + ':' + value);
			} catch (err) {}
		} //IE
	}
}

window.onload = function () {
	let buttons = '<input type="button" name="show-proto-4" id="show-proto-4" class="cbi-button cbi-button-apply" style="margin-right: 5px" value="<%:Hide IPv4%>">';
	buttons += '<input type="button" name="show-proto-6" id="show-proto-6" class="cbi-button cbi-button-apply" value="<%:Hide IPv6%>">';

	document.getElementById('togglebuttons').innerHTML = buttons;

	let visible = true;
	document.getElementById('show-proto-4').onclick = function () {
		visible = !visible;
		document.getElementById('show-proto-4').value = visible ? '<%:Hide IPv4%>' : '<%:Show IPv4%>';
		document.getElementById('show-proto-4').className = visible ? 'cbi-button cbi-button-apply' : 'cbi-button cbi-button-reset';
		css('.proto-4', 'display', visible ? 'table-row' : 'none');
	};

	let visible6 = true;
	document.getElementById('show-proto-6').onclick = function () {
		visible6 = !visible6;
		document.getElementById('show-proto-6').value = visible6 ? '<%:Hide IPv6%>' : '<%:Show IPv6%>';
		document.getElementById('show-proto-6').className = visible6 ? 'cbi-button cbi-button-apply' : 'cbi-button cbi-button-reset';
		css('.proto-6', 'display', visible6 ? 'table-row' : 'none');
	};
};


const olsrview = view.extend({

	callGetJsonStatus: rpc.declare({
		object: 'olsrinfo',
		method: 'getjsondata',
		params: ['otable', 'v4_port', 'v6_port'],
	}),

	callGetHosts: rpc.declare({
		object: 'olsrinfo',
		method: 'hosts',
	}),

	fetch_jsoninfo(otable) {
		let jsonreq4 = '';
		let jsonreq6 = '';
		const v4_port = parseInt(uci.get('olsrd', 'olsrd_jsoninfo', 'port') || '') || 9090;
		const v6_port = parseInt(uci.get('olsrd6', 'olsrd_jsoninfo', 'port') || '') || 9090;
		let json;
		let self = this;
		return new Promise(function (resolve, reject) {
			L.resolveDefault(self.callGetJsonStatus(otable, v4_port, v6_port), {})
				.then(function (res) {
					json = res;

					if (json.jsonreq4 === '' && json.jsonreq6 === '') {
						window.location.href = 'error_olsr';
						reject([null, 0, 0, true]);
						return;
					}


					jsonreq4 = JSON.parse(json.jsonreq4);
					jsonreq6 = json.jsonreq6 !== '' ? JSON.parse(json.jsonreq6) : [];
					let jsondata4 = {};
					let jsondata6 = {};
					let data4 = [];
					let data6 = [];
					let has_v4 = false;
					let has_v6 = false;

					if (jsonreq4 !== '') {
						has_v4 = true;
						jsondata4 = jsonreq4 || {};
						if (otable === 'status') {
							data4 = jsondata4;
						} else {
							data4 = jsondata4[otable] || [];
						}

						for (var i = 0; i < data4.length; i++) {
							data4[i]['proto'] = '4';
						}
					}

					if (jsonreq6 !== '') {
						has_v6 = true;
						jsondata6 = jsonreq6 || {};
						if (otable === 'status') {
							data6 = jsondata6;
						} else {
							data6 = jsondata6[otable] || [];
						}

						for (var j = 0; j < data6.length; j++) {
							data6[j]['proto'] = '6';
						}
					}

					for (let d6 of data6) {
						data4.push(d6);
					}

					resolve([data4, has_v4, has_v6, false]);
				})
				.catch(function (err) {
					console.error(err);
					reject([null, 0, 0, true]);
				});
		});
	},

});

return L.Class.extend({
	olsrview: olsrview,

});