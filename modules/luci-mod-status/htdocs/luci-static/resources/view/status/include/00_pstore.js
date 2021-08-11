'use strict';
'require baseclass';
'require rpc';
'require ui';

var callFileList = rpc.declare({
	object: 'file',
	method: 'list',
	params: [ 'path' ],
	expect: { entries: [] },
	filter: function(list, params) {
		var rv = [];
		for (var i=0; i<list.length; i++)
			if (! list[i].name.match(/^crashcount/))
				rv.push(params.path + list[i].name);
		return rv.sort();
	}
});

var callFileRead = rpc.declare({
	object: 'file',
	method: 'read',
	params: [ 'path' ],
	expect: { data: '' },
	filter: function(value) {
		return value.trim()
	}
});

return baseclass.extend({
	title: _('Warning'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callFileList('/sys/fs/pstore/'), {}),
			[]
		]).then(function(data) {
			if (data[0].length==0)
				return [ data[0] ];
			for (var i=0; i<data[0].length; i++)
				data[1][i] = L.resolveDefault(callFileRead(data[0][i],false), '');
			return Promise.all([ data[0], Promise.all(data[1]) ]);
		});
	},

	render: function(result) {
		if (result[0].length<=0)
			return;
		var entries=result[0];
		var content=result[1];

		var filetabs = E('div', {}, E('div'));
		for (var i=0; i<entries.length; i++) {
			filetabs.firstElementChild.appendChild(E('div', { 'data-tab': entries[i], 'data-tab-title': entries[i] }, [
				E('textarea', {
					'id': 'pstore',
					'style': 'font-size:12px',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': '20'
				}, content[i])
			]));
		}
		ui.tabs.initTabGroup(filetabs.firstElementChild.childNodes);

		var container = E('div', {}, [
			E('p', {}, _('Saved kernel crash logs were found, please check them and send feedback if needed!'))
		]);
		container.appendChild(filetabs);
		return container;
	}
});
