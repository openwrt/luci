'use strict';
'require fs';
'require uci';
'require network';

function invokeIncludesLoad(includes) {
	var tasks = [], has_load = false;

	for (var i = 0; i < includes.length; i++) {
		if (typeof(includes[i].load) == 'function') {
			tasks.push(includes[i].load());
			has_load = true;
		}
		else {
			tasks.push(null);
		}
	}

	console.log(includes, tasks)

	return has_load ? Promise.all(tasks) : Promise.resolve(null);
}

function startPolling(includes, containers) {
	var step = function() {
		return network.flushCache().then(function() {
			return invokeIncludesLoad(includes)
			;
		})
		.then(
			function(results) {
			for (var i = 0; i < includes.length; i++) {
				var content = null;

				console.log(includes)

				if (typeof(includes[i].render) == 'function')
					content = includes[i].render(results ? results[i] : null);
				else if (includes[i].content != null)
					content = includes[i].content;

				if (content != null) {
					containers[i].parentNode.style.display = '';
					containers[i].parentNode.classList.add('fade-in');

					L.dom.content(containers[i], content);
				}
			}

			var ssi = document.querySelector('div.includes');
			if (ssi) {
				ssi.style.display = '';
				ssi.classList.add('fade-in');
			}
		});
	};

	return step().then(function() {
		L.Poll.add(step);
	});
}

return L.view.extend({
	load: function() {
		// return Promise.all([
		// 	L.resolveDefault(fs.list('/www' + L.resource('view/status/include')), []),
		// 	uci.load('luci')
		// ]).then(function(data) {

		// 	var entries = data[0],
		// 	    display_tbl = [];

		// 	uci.sections('luci', 'index').map( function (v) {
		// 		display_tbl[v['.name']] = v.display
		// 	});

		// 	return Promise.all(entries.filter(function(e) {
		// 		console.log(e);
		// 		return (e.type == 'file' &&
		// 				e.name.match(/\.js$/) &&
		// 				display_tbl[e.name]);
		// 	}).map(function(e) {
		// 		return 'view.status.include.' + e.name.replace(/\.js$/, '');
		// 	}).sort().map(function(n) {
		// 		return L.require(n);
		// 	}));
		// });
		// return Promise.all([
		// 		L.resolveDefault(fs.list('/www' + L.resource('view/status/include')), []),
		// 		uci.load('luci')
		// 	]).then(function(data) {
		// 		var entries = data[0];
		// 			// display_tbl = [];

		// 		// uci.sections('luci', 'index').map( function (v) {
		// 		// 	display_tbl[v['.name']] = v.display
		// 		// });

		// 		// if (display_tbl[includes[i].index_id] == 0) {
		// 			// 	includes.splice(i, 1);
		// 			// 	i--;
		// 			// 	continue;
		// 			// }

		// 	return Promise.all(entries.filter(function(e) {
		// 		return (e.type == 'file' && e.name.match(/\.js$/));
		// 	}).map(function(e) {
		// 		return 'view.status.include.' + e.name.replace(/\.js$/, '');
		// 	}).sort().map(function(n) {

		// 		var obj = L.require(n),
		// 				  display_tbl = [];

		// 		uci.sections('luci', 'index').map( function (v) {
		// 			display_tbl[v['.name']] = v.display
		// 		});


		// 		// console.log(display_tbl )

		// 		if ( display_tbl[obj.index_id] ) {
		// 			console.log('NO')
		// 			return;
		// 		}
		// 		// console.log(n)
		// 		return obj;
		// 	}));
		// });
		return Promise.all([
			L.resolveDefault(fs.list('/www' + L.resource('view/status/include')), []).then(function(entries) {
				return Promise.all(entries.filter(function(e) {
					return (e.type == 'file' && e.name.match(/\.js$/));
				}).map(function(e) {
					return 'view.status.include.' + e.name.replace(/\.js$/, '');
				}).sort().map(function(n) {
					return L.require(n);
				}));
			}),
			uci.load('luci')])
	},
	
	render: function(data) {

		var includes = data[0] || [];

		// console.log(includes)

		var rv = E([]),
			containers = [],
			display_tbl = [];

		uci.sections('luci', 'index').map( function (v) {
			display_tbl[v['.name']] = v.display
		});

		for (var i = 0; i < includes.length; i++) {

			if (display_tbl[includes[i].index_id] == 0) {
				includes.splice(i, 1);
				i--;
				continue;
			}

			var title = null;

			if (includes[i].title != null)
				title = includes[i].title;
			else
				title = String(includes[i]).replace(/^\[ViewStatusInclude\d+_(.+)Class\]$/,
					function(m, n) { return n.replace(/(^|_)(.)/g,
						function(m, s, c) { return (s ? ' ' : '') + c.toUpperCase() })
					});

			var container = E('div');

			rv.appendChild(E('div', { 'class': 'cbi-section', 'style': 'display:none' }, [
				title != '' ? E('h3', title) : '',
				container
			]));

			containers.push(container);
		}

		// includes.map(function(n) {
		// 	console.log(n)
		// 	L.require(n);
		// })
		// var o = [includes[0]]

		// console.log(o, containers)

		return startPolling(includes, containers).then(function() {
			return rv;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
