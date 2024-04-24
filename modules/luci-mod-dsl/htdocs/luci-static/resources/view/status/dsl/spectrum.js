'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

var callDSLStatistics = rpc.declare({
	object: 'dsl',
	method: 'statistics',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			callDSLStatistics()
		]);
	},

	render: function(data) {
		window.json = data[0];

		var v = E('div', {'class': 'cbi-map'}, [
			E('h2', {'style': "height: 40px"}, [ _('DSL line spectrum') ]),
			E('div', {'class': 'cbi-map-descr'}, _('The following diagrams show graphically prepared DSL characteristics that are important for evaluating the DSL connection.')),

			E('div', {'class': 'cbi-section'}, [
				E('div', {'style': "height: 360px; width: 1024px"},
					E('canvas', {
						'id': 'dbChart',
						'height': 360,
						'width': 1024},
						["chart"])
				),
				E('div', {'class': 'cbi-section-descr', 'style': 'text-align:center'}, _('The graph shows the signal to noise ratio (SNR) per subcarrier in the uplink and downlink direction')),
			]),
			E('div', {'class': 'cbi-section'}, [
				E('div', {'style': "height: 360px; width:1024px"},
					E('canvas', {
						'id': 'bitsChart',
						'height': 360,
						'width': 1024},
						["chart2"])
				),
				E('div', {'class': 'cbi-section-descr', 'style': 'text-align:center'}, _('The graph shows th amount of bits actually allocated per subcarrier in the uplink and downlink direction')),
			]),
			E('div', {'class': 'cbi-section'}, [
				E('div', {'style': "height: 360px; width:1024px"},
					E('canvas', {
						'id': 'qlnChart',
						'height': 360,
						'width': 1024},
						["chart2"])
				),
				E('div', {'class': 'cbi-section-descr', 'style': 'text-align:center'}, _('The diagram shows the quiet line noise (QLN) per subcarrier in uplink and downlink direction')),
			]),
			E('div', {'class': 'cbi-section'}, [
				E('div', {'style': "height: 360px; width:1024px"},
					E('canvas', {
						'id': 'hlogChart',
						'height': 360,
						'width': 1024},
						["chart2"])
				),
				E('div', {'class': 'cbi-section-descr', 'style': 'text-align:center'}, _('The diagram shows the Channel Characteristics Function (HLOG) per subcarrier in uplink and downlink direction')),
			]),
			E('script', {'src':'/luci-static/resources/view/status/dsl/graph.js'}, {})
		]);

		return v;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
