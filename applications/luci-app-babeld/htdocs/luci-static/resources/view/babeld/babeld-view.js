'use strict';
'require uci';
'require view';
'require poll';
'require ui';
'require rpc';

return view.extend({
	callGetInfo: rpc.declare({
		object: 'babeld',
		method: 'get_info'
	}),
	callGetXroutes: rpc.declare({
		object: 'babeld',
		method: 'get_xroutes'
	}),
	callGetRoutes: rpc.declare({
		object: 'babeld',
		method: 'get_routes'
	}),
	callGetNeighbours: rpc.declare({
		object: 'babeld',
		method: 'get_neighbours'
	}),

	fetch_babeld: function () {
		var data;
		var self = this;
		return new Promise(function (resolve, reject) {
			Promise.all([self.callGetInfo(), self.callGetXroutes(), self.callGetRoutes(), self.callGetNeighbours()])
				.then(function (res) {
					data = res;
					resolve([data]);
				})
				.catch(function (err) {
					console.error(err);
					reject([null]);
				});
		});
	},

	action_babeld: function () {
		var self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_babeld()
				.then(function ([data]) {
					var info = data[0];
					var xroutes = data[1];
					var routes = data[2];
					var neighbours = data[3];
					var result = { info, xroutes, routes, neighbours };
					resolve(result);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},

	load: function () {
		var self = this;
		return new Promise(function (resolve, reject) {
			var script = E('script', { 'type': 'text/javascript' });
			script.onload = resolve;
			script.onerror = reject;
			script.src = L.resource('babeld.js');
			document.querySelector('head').appendChild(script);
		});
	},
	render: function () {
		var self = this;
		return this.action_babeld()
			.then(function (result) {

				var mainDiv = E('div', {
					'id': 'babeld'
				}, []);

                renderTableInfo(result.info, mainDiv);
                renderTableXRoutes(result.xroutes, mainDiv);
                renderTableRoutes(result.routes, mainDiv);
                renderTableNeighbours(result.neighbours, mainDiv);

				var result = E([], {}, mainDiv);
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
