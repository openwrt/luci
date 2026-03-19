'use strict';
'require view';
'require uci';
'require rpc';
'require fs';
'require ui';

return view.extend({
	callServiceList: rpc.declare({
		object: 'service',
		method: 'list',
		params: [ 'name' ],
		expect: { 'apinger': {} }
	}),

	callApingerUpdateGraphs: rpc.declare({
		object: 'apinger',
		method: 'update_graphs',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			this.callServiceList('apinger'),
			this.callApingerUpdateGraphs(),
		]);
	},

	render: function(res) {
		var running = Object.keys(res[0].instances || {}).length > 0;
		var script = res[1]['rrdcgi'];

		if (!running) {
			return ui.addNotification(null, E('h3', _('Service is not running'), 'danger'));
		}

		return fs.stat(script).then(function(res) {
			if ((res.type == "file") && (res.size > 100)) {
				return E([
					E('h3', _('Apinger Targets RRD Graph')),
					E('br'),
					E('div', [
						E('iframe', {
							src: script.replace(/^\/www/g, ''),
							scrolling: 'yes',
							style : 'width: 85vw; height: 100vh; border: none;'
						})
					])
				]);
			} else {
				return ui.addNotification(null, E('h3', _('No data available'), 'danger'));
			}
		}).catch(function(err) {
			return ui.addNotification(null, E('h3', _('No access to server file'), 'danger'));
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
