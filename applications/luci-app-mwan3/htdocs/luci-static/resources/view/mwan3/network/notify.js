'use strict';
'require view';
'require fs';
'require ui';

var isReadonlyView = !L.hasViewPermission() || null;

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read('/etc/mwan3.user'), '');
	},

	handleSave: function(ev) {
		var value = (document.querySelector('textarea').value || '').trim().replace(/\r\n/g, '\n') + '\n';

		return fs.write('/etc/mwan3.user', value).then(function(rc) {
			document.querySelector('textarea').value = value;
				ui.addNotification(null, E('p', _('Contents have been saved.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e.message)));
			});
		},

	render: function(mwan3user) {
		return E([
			E('h2', _('MultiWAN Manager - Notify')),
			E('p', { 'class': 'cbi-section-descr' },
			_('This section allows you to modify the content of \"/etc/mwan3.user\".') + '<br/>' +
			_('The file is also preserved during sysupgrade.') + '<br/>' +
			'<br />' +
			_('Notes:') + '<br />' +
			_('This file is interpreted as a shell script.') + '<br />' +
			_('The first line of the script must be &#34;#!/bin/sh&#34; without quotes.') + '<br />' +
			_('Lines beginning with # are comments and are not executed.') + '<br />' +
			_('Put your custom mwan3 action here, they will be executed with each netifd hotplug interface event on interfaces for which mwan3 is enabled.') + '<br />' +
			'<br />' +
			_('There are three main environment variables that are passed to this script.') + '<br />' +
			'<br />' +
			_('%s: Name of the action that triggered this event').format('$ACTION') + '<br />' +
			_('* %s: Is called by netifd and mwan3track').format('ifup') + '<br />' +
			_('* %s: Is called by netifd and mwan3track').format('ifdown') + '<br />' +
			_('* %s: Is only called by mwan3track if tracking was successful').format('connected') + '<br />' +
			_('* %s: Is only called by mwan3track if tracking has failed').format('disonnected') + '<br />' +
			_('%s: Name of the interface which went up or down (e.g. \"wan\" or \"wwan\")').format('$INTERFACE') + '<br />' +
			_('%s: Name of Physical device which interface went up or down (e.g. \"eth0\" or \"wwan0\")').format('$DEVICE') + '<br />'),
			E('p', {}, E('textarea', { 'style': 'width:100%', 'rows': 10, 'disabled': isReadonlyView }, [ mwan3user != null ? mwan3user : '' ]))
		]);
	},

	handleSaveApply: null,
	handleReset: null
});
