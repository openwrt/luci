'use strict';
'require uci';
'require view';
'require poll';
'require ui';
'require rpc';


return view.extend({
	callGetOlsrVizData: rpc.declare({
		object: 'olsrvizinfo',
		method: 'getolsrvizdata'
	}),

	fetch_jsoninfo: function () {
		var jsonreq4 = '';
		var json;
		var data;
		var self = this;
		return new Promise(function (resolve, reject) {
			L.resolveDefault(self.callGetOlsrVizData(), {})
				.then(function (res) {
					json = res;
					data = json.jsonreq4;
					resolve([data]);
				})
				.catch(function (err) {
					console.error(err);
					reject([null]);
				});
		});
	},

	action_olsr_viz: function () {
		var self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_jsoninfo()
				.then(function ([data]) {
					var result = { viz_data: data };
					resolve(result);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},

	load: function () {
		var self = this;
		document.querySelector('head').appendChild(E('style', { 'type': 'text/css' }, [
			'.label {color:black;background-color:white}',
			'.olsr_viz_main {width: 100%; height: 93%; border: 1px solid #ccc; margin-left:auto; margin-right:auto; text-align:center; overflow: scroll}'
		]));
		return new Promise(function (resolve, reject) {
			var script = E('script', { 'type': 'text/javascript' });
			script.onload = resolve;
			script.onerror = reject;
			script.src = L.resource('olsr-viz.js');
			document.querySelector('head').appendChild(script);
		});
	},
	render: function () {
		var viz_res;
		var self = this;
		return this.action_olsr_viz()
			.then(function (result) {
				viz_res = result.viz_data;

				var nodeDiv = E('div', { 'id': 'nodes', 'style': 'width: 1px; height: 1px; position: relative; z-index:4' });
				var edgeDiv = E('div', { 'id': 'edges', 'style': 'width: 1px; height: 1px; position: relative; z-index:2' });
				
				var mainDiv = E('div', {
					'id': 'main',
					'class': 'olsr_viz_main'
				}, [nodeDiv, edgeDiv]);

				var zoomInput = E('input', {
					'id': 'zoom',
					'name': 'zoom',
					'type': 'text',
					'value': '2.0',
					'size': '5',
					'style': 'min-width: unset !important;',
					'onchange': 'set_scale()'
				});
				var metricInput = E('input', {
					'id': 'maxmetric',
					'name': 'maxmetric',
					'type': 'text',
					'value': '3',
					'size': '4',
					'style': 'min-width: unset !important;',
					'change': (ev)=>set_maxmetric(ev.target.value)
				});
				var autoOptimizationCheckbox = E('input', {
					'id': 'auto_declump',
					'name': 'auto_declump',
					'type': 'checkbox',
					'change': (ev) => set_autodeclump(ev.target.checked),
					'checked': 'checked'
				});
				var hostnamesCheckbox = E('input', {
					'id': 'show_hostnames',
					'name': 'show_hostnames',
					'type': 'checkbox',
					'change': (ev) => set_showdesc(ev.target.checked),
					'checked': 'checked'
				});

				var form = E('form', { 'action': '' }, [
					E('p', {}, [
						E('b', { 'title': 'Bestimmt die Vergrößerungsstufe.' }, 'Zoom '),
						E('a', { 'href': '#', 'click': () =>set_scale(scale+0.1) }, '+ '),
						E('a', { 'href': '#', 'click': () =>set_scale(scale-0.1) },  '\u2212 '),
						zoomInput,
						E('b', { 'title': 'Beschränkt die Anzeige auf eine maximale Hop-Entfernung.' }, '&nbsp;&nbsp;Metrik'),
						E('a', { 'href': '#', 'click': () => set_maxmetric(maxmetric+1) }, '+ '),
						E('a', { 'href': '#', 'click': () => set_maxmetric(Math.max(maxmetric, 1) - 1) }, '\u2212'),
						metricInput,
						E('b', { 'title': 'Schaltet die automatischen Layout-Optimierung ein.' }, '&nbsp;&nbsp;Optimierung'),
						autoOptimizationCheckbox,
						E('b', { 'title': 'Zeige Hostnamen an.' }, ' |  Hostnamen'),
						hostnamesCheckbox,
						E('a', { 'href': '#', 'click': viz_save, 'title': 'Speichert die aktuellen Einstellungen in einem Cookie.', 'style': 'font-weight:700;' }, '&nbsp;|&nbsp;&nbsp;Speichern'),
						E('a', { 'href': '#', 'click': viz_reset, 'title': 'Startet das Viz-Skriptprogramm neu.', 'style': 'font-weight:700;' }, '&nbsp;|&nbsp;&nbsp;Zur&uuml;cksetzen')
					])
				]);

				var debugSpan = E('span', { 'id': 'debug', 'style': 'visibility:hidden;' });
				var vizDiv = E('div', { 'id': 'RSIFrame', 'name': 'RSIFrame', 'style': 'border:0px; width:0px; height:0px; visibility:hidden;' });
				viz_setup(vizDiv, mainDiv, nodeDiv, edgeDiv, debugSpan, zoomInput, metricInput); viz_update();
				
				function setInnerHTML(elm, html) {
					elm.innerHTML = html;

					Array.from(elm.querySelectorAll("script"))
						.forEach(oldScriptEl => {
							const newScriptEl = document.createElement("script");

							Array.from(oldScriptEl.attributes).forEach(attr => {
								newScriptEl.setAttribute(attr.name, attr.value)
							});

							const scriptText = document.createTextNode(oldScriptEl.innerHTML);
							newScriptEl.appendChild(scriptText);

							oldScriptEl.parentNode.replaceChild(newScriptEl, oldScriptEl);
						});
				};

				setInnerHTML(vizDiv, viz_res);

				var renderDiv = E('div', { 'style': 'width:100%; height:640px; border:none', 'scrolling': 'no' }, [mainDiv]);
				var result = E([], {}, [form, debugSpan, renderDiv, vizDiv]);
				return result;
			})
			.catch(function (error) {
				console.error(error);
			});
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});

