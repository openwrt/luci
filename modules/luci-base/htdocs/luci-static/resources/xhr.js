/*
 * xhr.js - XMLHttpRequest helper class
 * (c) 2008-2018 Jo-Philipp Wich <jo@mein.io>
 */

XHR.prototype = {
	_encode: function(obj) {
		obj = obj ? obj : { };
		obj['_'] = Math.random();

		if (typeof obj == 'object') {
			var code = '';
			var self = this;

			for (var k in obj)
				code += (code ? '&' : '') +
					k + '=' + encodeURIComponent(obj[k]);

			return code;
		}

		return obj;
	},

	_response: function(callback, ts) {
		if (this._xmlHttp.readyState !== 4)
			return;

		var status = this._xmlHttp.status,
		    login = this._xmlHttp.getResponseHeader("X-LuCI-Login-Required"),
		    type = this._xmlHttp.getResponseHeader("Content-Type"),
		    json = null;

		if (status === 403 && login === 'yes') {
			XHR.halt();

			showModal(_('Session expired'), [
				E('div', { class: 'alert-message warning' },
					_('A new login is required since the authentication session expired.')),
				E('div', { class: 'right' },
					E('div', {
						class: 'btn primary',
						click: function() {
							var loc = window.location;
							window.location = loc.protocol + '//' + loc.host + loc.pathname + loc.search;
						}
					}, _('To login…')))
			]);
		}
		else if (type && type.toLowerCase().match(/^application\/json\b/)) {
			try {
				json = JSON.parse(this._xmlHttp.responseText);
			}
			catch(e) {
				json = null;
			}
		}

		callback(this._xmlHttp, json, Date.now() - ts);
	},

	busy: function() {
		if (!this._xmlHttp)
			return false;

		switch (this._xmlHttp.readyState)
		{
			case 1:
			case 2:
			case 3:
				return true;

			default:
				return false;
		}
	},

	abort: function() {
		if (this.busy())
			this._xmlHttp.abort();
	},

	get: function(url, data, callback, timeout) {
		this._xmlHttp = new XMLHttpRequest();

		var xhr = this._xmlHttp,
		    code = this._encode(data);

		url = location.protocol + '//' + location.host + url;

		if (code)
			if (url.substr(url.length-1,1) == '&')
				url += code;
			else
				url += '?' + code;

		xhr.open('GET', url, true);

		if (!isNaN(timeout))
			xhr.timeout = timeout;

		xhr.onreadystatechange = this._response.bind(this, callback, Date.now());
		xhr.send(null);
	},

	post: function(url, data, callback, timeout) {
		this._xmlHttp = new XMLHttpRequest();

		var xhr = this._xmlHttp,
		    code = this._encode(data);

		xhr.open('POST', url, true);

		if (!isNaN(timeout))
			xhr.timeout = timeout;

		xhr.onreadystatechange = this._response.bind(this, callback, Date.now());
		xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		xhr.send(code);
	},

	cancel: function() {
		this._xmlHttp.onreadystatechange = function() {};
		this._xmlHttp.abort();
	},

	send_form: function(form, callback, extra_values) {
		var code = '';

		for (var i = 0; i < form.elements.length; i++) {
			var e = form.elements[i];

			if (e.options) {
				code += (code ? '&' : '') +
					form.elements[i].name + '=' + encodeURIComponent(
						e.options[e.selectedIndex].value
					);
			}
			else if (e.length) {
				for (var j = 0; j < e.length; j++)
					if (e[j].name) {
						code += (code ? '&' : '') +
							e[j].name + '=' + encodeURIComponent(e[j].value);
					}
			}
			else {
				code += (code ? '&' : '') +
					e.name + '=' + encodeURIComponent(e.value);
			}
		}

		if (typeof extra_values == 'object')
			for (var key in extra_values)
				code += (code ? '&' : '') +
					key + '=' + encodeURIComponent(extra_values[key]);

		return (form.method == 'get'
			? this.get(form.getAttribute('action'), code, callback)
			: this.post(form.getAttribute('action'), code, callback));
	}
}

XHR.get = function(url, data, callback) {
	(new XHR()).get(url, data, callback);
}

XHR.post = function(url, data, callback) {
	(new XHR()).post(url, data, callback);
}

XHR.poll = function(interval, url, data, callback, post) {
	if (isNaN(interval) || interval <= 0)
		interval = L.env.pollinterval;

	if (!XHR._q) {
		XHR._t = 0;
		XHR._q = [ ];
		XHR._r = function() {
			for (var i = 0, e = XHR._q[0]; i < XHR._q.length; e = XHR._q[++i])
			{
				if (!(XHR._t % e.interval) && !e.xhr.busy())
					e.xhr[post ? 'post' : 'get'](e.url, e.data, e.callback, e.interval * 1000 * 5 - 5);
			}

			XHR._t++;
		};
	}

	var e = {
		interval: interval,
		callback: callback,
		url:      url,
		data:     data,
		xhr:      new XHR()
	};

	XHR._q.push(e);

	return e;
}

XHR.stop = function(e) {
	for (var i = 0; XHR._q && XHR._q[i]; i++) {
		if (XHR._q[i] === e) {
			e.xhr.cancel();
			XHR._q.splice(i, 1);
			return true;
		}
	}

	return false;
}

XHR.halt = function() {
	if (XHR._i) {
		/* show & set poll indicator */
		try {
			document.getElementById('xhr_poll_status').style.display = '';
			document.getElementById('xhr_poll_status_on').style.display = 'none';
			document.getElementById('xhr_poll_status_off').style.display = '';
		} catch(e) { }

		window.clearInterval(XHR._i);
		XHR._i = null;
	}
}

XHR.run = function() {
	if (XHR._r && !XHR._i) {
		/* show & set poll indicator */
		try {
			document.getElementById('xhr_poll_status').style.display = '';
			document.getElementById('xhr_poll_status_on').style.display = '';
			document.getElementById('xhr_poll_status_off').style.display = 'none';
		} catch(e) { }

		/* kick first round manually to prevent one second lag when setting up
		 * the poll interval */
		XHR._r();
		XHR._i = window.setInterval(XHR._r, 1000);
	}
}

XHR.running = function() {
	return !!(XHR._r && XHR._i);
}

function XHR() {}

document.addEventListener('DOMContentLoaded', XHR.run);
