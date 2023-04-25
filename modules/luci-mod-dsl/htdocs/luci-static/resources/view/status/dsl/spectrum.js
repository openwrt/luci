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

		var v = E([], [
			E('h2', {'style': "height: 40px"}, [ _('DSL line spectrum') ]),
			E('p', {}, _('Graphs below show Signal-to-noise ratio, Bit allocation, Quiet line noise and Channel characteristics function (HLOG) per sub-carrier.')),
			E('div', {'style': "height: 360px; width: 1024px"},
				E('canvas', {
					'id': 'dbChart',
					'height': 360,
					'width': 1024},
					["chart"])
			),
			E('div', {'style': "height: 360px; width:1024px"},
				E('canvas', {
					'id': 'bitsChart',
					'height': 360,
					'width': 1024},
					["chart2"])
			),
			E('div', {'style': "height: 360px; width:1024px"},
				E('canvas', {
					'id': 'qlnChart',
					'height': 360,
					'width': 1024},
					["chart2"])
			),
			E('div', {'style': "height: 360px; width:1024px"},
				E('canvas', {
					'id': 'hlogChart',
					'height': 360,
					'width': 1024},
					["chart2"])
				),
			E('script', {'src':'/luci-static/resources/view/status/dsl/graph.js'}, {})
		]);

		return v;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
