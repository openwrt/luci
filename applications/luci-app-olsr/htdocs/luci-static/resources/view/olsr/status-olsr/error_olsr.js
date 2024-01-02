'use strict';
'require view';
'require rpc';
'require ui';
return view.extend({
	render: function () {
		return E('div', {}, [
			E('h2', { 'name': 'content' }, _('OLSR Daemon')),
			E('p', { 'class': 'error' }, _('Unable to connect to the OLSR daemon!')),
			E('p', {}, [_('Make sure that OLSRd is running, the "jsoninfo" plugin is loaded, configured on port 9090, and accepts connections from "127.0.0.1".')]),
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});
