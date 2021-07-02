'use strict';
'require baseclass';
'require rpc';

var callMwan3Status = rpc.declare({
	object: 'mwan3',
	method: 'status',
	expect: {  },
});

document.querySelector('head').appendChild(E('link', {
	'rel': 'stylesheet',
	'type': 'text/css',
	'href': L.resource('view/mwan3/mwan3.css')
}));

return baseclass.extend({
	title: _('MultiWAN Manager'),

	load: function() {
		return Promise.all([
			callMwan3Status(),
		]);
	},

	render: function (result) {
		if (!result[0].interfaces)
			return null;

		var container = E('div', { 'id': 'mwan3-service-status' });
		var iface;
		for ( iface in result[0].interfaces) {
			var state = '';
			var css = '';
			var time = '';
			var tname = '';
			switch (result[0].interfaces[iface].status) {
				case 'online':
					state = _('Online');
					css = 'alert-message success';
					time = '%t'.format(result[0].interfaces[iface].online);
					tname = _('Uptime');
					break;
				case 'offline':
					state = _('Offline');
					css = 'alert-message danger';
					time = '%t'.format(result[0].interfaces[iface].offline);
					tname = _('Downtime');
					break;
				case 'notracking':
					state = _('No Tracking');
					if ((result[0].interfaces[iface].uptime) > 0) {
						css = 'alert-message success';
						time = '%t'.format(result[0].interfaces[iface].uptime);
						tname = _('Uptime');
					}
					else {
						css = 'alert-message warning';
						time = '';
						tname = '';
					}
					break;
				default:
					css = 'alert-message warning';
					state = _('Disabled');
					time = '';
					tname = '';
					break;
			}

			if (time !== '' ) {
				container.appendChild(
					E('div', { 'class': css }, [
						E('div', {}, [
							E('strong', {}, [
								_('Interface'), ':', ' '
							]),
							iface
						]),
						E('div', {}, [
							E('strong', {}, [
								_('Status'), ':', ' '
							]),
							state
						]),
						E('div', {}, [
							E('strong', {}, [
								tname, ':', ' '
							]),
							time
						])
					])
				);
			}
			else {
				container.appendChild(
					E('div', { 'class': css }, [
						E('div', {}, [
							E('strong', {}, [
								_('Interface'), ':', ' '
							]),
							iface
						]),
						E('div', {}, [
							E('strong', {}, [
								_('Status'), ':', ' '
							]),
							state
						])
					])
				);
			}
		}

		return container;
	}
});
