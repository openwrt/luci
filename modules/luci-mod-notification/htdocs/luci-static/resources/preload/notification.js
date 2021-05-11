'use strict';
'require ui';
'require rpc';
'require poll';
'require baseclass';

var callNotificationRemove = rpc.declare({
	object: 'system.notification',
	method: 'remove',
	params: [ 'uuid' ],
	expect: { '': {} }
});

var callNotificationList = rpc.declare({
	object: 'system.notification',
	method: 'list',
	expect: { messages: [] }
});

var callNotificationFlush = rpc.declare({
	object: 'system.notification',
	method: 'flush',
	expect: { '': {} }
});

var info = {};

return baseclass.extend({
	__init__: function() {
		this.updateNotification();
		poll.add(L.bind(this.updateNotification, this), 5);
	},

	flushNotification: function(uuid, ev) {
		return callNotificationFlush(uuid).then(L.bind(function(result) {
				ui.hideModal();
				ui.hideIndicator('notification');
			}, this));
	},

	removeNotification: function(uuid, ev) {
		return callNotificationRemove(uuid).then(L.bind(function(result) {
				for( var i = 0; i < info.messages.length; i++) {
					if ( info.messages[i].uuid === uuid) {
						info.messages.splice(i, 1);
					}
				}
				this.updateList();
			}, this));
	},

	updateList: function() {
		var rows = [];
		for (var i = 0; i < info.messages.length; i++) {
			var message = info.messages[i];
			var time = new Date(message.timestamp*1000);
			var date = time.toLocaleString();

			switch (message.id) {
				case 1:
					rows.push([
						date,
						message.service,
						_('No root password set'),
						_('Please configure a root password to protect the web interface'),
						E('a', {
							'class': 'btn cbi-button-apply',
							'href': L.url('admin/system/admin'),
						}, _('Set password')),
						E('button', {
							'class': 'btn cbi-button-remove',
							'click': ui.createHandlerFn(this, 'removeNotification', message.uuid)
						}, _('Confirms'))
					]);
					break;
				default:
					rows.push([
						date,
						message.service,
						message.title,
						message.message,
						_('No action available'),
						E('button', {
							'class': 'btn cbi-button-remove',
							'click': ui.createHandlerFn(this, 'removeNotification', message.uuid)
						}, _('Confirms'))
					]);
					break;
			}
		}

		if (rows.length > 0) {
			cbi_update_table('#notification-data', rows);
				info.element = document.querySelector('[data-indicator="notification"]');
				info.element.innerHTML = _('Notifications (%s)').format(rows.length);
		}
		else {
			ui.hideModal();
			ui.hideIndicator('notification');
			info.messages = {};
		}
	},

	handleDetails: function(ev) {
		ui.showModal(_('System Notifications'), [
				E('table', { 'class': 'table', 'id': 'notification-data' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th center' }, [ _('Time') ]),
						E('th', { 'class': 'th center' }, [ _('Service') ]),
						E('th', { 'class': 'th center' }, [ _('Title') ]),
						E('th', { 'class': 'th center' }, [ _('Message') ]),
						E('th', { 'class': 'th center' }, [ _('Action') ]),
						E('th', { 'class': 'th center' }, [ _('Confirm') ]),
					]),
					E('tr', { 'class': 'tr placeholder' }, [
						E('td', { 'class': 'td' }, [
							E('em', { 'class': 'spinning' }, [ _('Collecting data...') ])
						])
					])
				]),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn cbi-button-action',
						'click': ui.hideModal
					}, _('Close')),
					E('button', {
						'class': 'btn cbi-button-remove',
						'click': ui.createHandlerFn(this, 'flushNotification')
					}, _('Confirms all'))
				])
		]);

		this.updateList();
	},

	updateNotification: function() {
		return callNotificationList().then(L.bind(function(notifications) {
			if (Array.isArray(notifications) && notifications.length > 0) {
				info.messages = notifications;
				ui.showIndicator('notification',
					null,
					L.bind(this.handleDetails, this)
				);
				this.updateList();
			}
			else {
				ui.hideModal();
				ui.hideIndicator('notification');
				info.messages = {};
			}
		}, this));
	}
});
