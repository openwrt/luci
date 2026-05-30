'use strict';
'require poll';
'require view';
'require rpc';

const callMwan3Status = rpc.declare({
	object: 'mwan3',
	method: 'status',
	params: ['section'],
	expect: {  },
});

document.querySelector('head').appendChild(E('link', {
	'rel': 'stylesheet',
	'type': 'text/css',
	'href': L.resource('view/mwan3/mwan3.css')
}));

function renderMwan3Status(status) {
	if (!status.interfaces)
		return '<strong>%h</strong>'.format(_('No MWAN interfaces found'));

	var statusview = '';
	for ( var iface in status.interfaces) {
		var state = '';
		var css = '';
		var time = '';
		var tname = '';
		switch (status.interfaces[iface].status) {
			case 'online':
				state = _('Online');
				css = 'success';
				time = '%t'.format(status.interfaces[iface].online);
				tname = _('Uptime');
				css = 'success';
				break;
			case 'offline':
				state = _('Offline');
				css = 'danger';
				time = '%t'.format(status.interfaces[iface].offline);
				tname = _('Downtime');
				break;
			case 'notracking':
				state = _('No Tracking');
				if ((status.interfaces[iface].uptime) > 0) {
					css = 'success';
					time = '%t'.format(status.interfaces[iface].uptime);
					tname = _('Uptime');
				}
				else {
					css = 'warning';
					time = '';
					tname = '';
				}
				break;
			default:
				state = _('Disabled');
				css = 'warning';
				time = '';
				tname = '';
				break;
		}

		statusview += '<div class="alert-message %h">'.format(css);
		statusview += '<div><strong>%h:&#160;</strong>%h</div>'.format(_('Interface'), iface);
		statusview += '<div><strong>%h:&#160;</strong>%h</div>'.format(_('Status'), state);

		if (time)
			statusview += '<div><strong>%h:&#160;</strong>%h</div>'.format(tname, time);

		statusview += '</div>';
	}

	return statusview;
}

return view.extend({
	load: function() {
		return Promise.all([
			callMwan3Status("interfaces"),
		]);
	},

	render: function (data) {
		poll.add(function() {
			return callMwan3Status("interfaces").then(function(result) {
				var view = document.getElementById('mwan3-service-status');
				view.innerHTML = renderMwan3Status(result);
			});
		});

		return E('div', { class: 'cbi-map' }, [
			E('h2', [ _('MultiWAN Manager - Overview') ]),
			E('div', { class: 'cbi-section' }, [
				E('div', { 'id': 'mwan3-service-status' }, [
					E('em', { 'class': 'spinning' }, [ _('Collecting data ...') ])
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
})
