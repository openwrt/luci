// This is free software, licensed under the Apache License, Version 2.0

'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

var isReadonlyView = !L.hasViewPermission() || null;

return view.extend({
	handleDeleteModal: function(m, iface, ev) {
		L.showModal(_('Delete interface <em>%h</em>').format(iface), [
			E('p', _('The interface will be removed from the database permanently. This cannot be undone.')),
			E('div', { 'class': 'right' }, [
				E('div', {
					'class': 'btn',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('div', {
					'class': 'btn cbi-button-negative',
					'click': ui.createHandlerFn(this, 'handleDelete', m, iface)
				}, _('Delete'))
			])
		]);
	},

	handleDelete: function(m, iface, ev) {
		return fs.exec('/usr/bin/vnstat', ['--remove', '-i', iface, '--force'])
			.then(L.bind(m.render, m))
			.catch(function(e) {
				ui.addNotification(null, E('p', e.message));
			})
			.finally(L.hideModal);
	},

	render: function() {
		var m, s, o;

		m = new form.Map('vnstat', _('vnStat'), _('vnStat is a network traffic monitor for Linux that keeps a log of network traffic for the selected interface(s).'));

		s = m.section(form.TypedSection, 'vnstat', _('Interfaces'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(widgets.DeviceSelect, 'interface', _('Monitor interfaces'), _('The selected interfaces are automatically added to the vnStat database upon startup.'));
		o.rmempty = true;
		o.multiple = true;
		o.noaliases = true;
		o.nobridges = false;
		o.noinactive = false;
		o.nocreate = false;


		o = s.option(form.DummyValue, '_database');

		o.load = function(section_id) {
			return fs.exec('/usr/bin/vnstat', ['--dbiflist', '1']).then(L.bind(function(result) {
				var databaseInterfaces = [];
				if (result.code == 0) {
					databaseInterfaces = result.stdout.trim().split('\n');
				}

				var configInterfaces = uci.get_first('vnstat', 'vnstat', 'interface') || [];

				this.interfaces = databaseInterfaces.filter(function(iface) {
					return configInterfaces.indexOf(iface) == -1;
				});
			}, this));
		};

		o.render = L.bind(function(view, section_id) {
			var table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Interface')),
					E('th', { 'class': 'th right' }, _('Delete'))
				])
			]);

			var rows = [];

			for (var i = 0; i < this.interfaces.length; i++) {
				rows.push([
					this.interfaces[i],
					E('button', {
						'class': 'btn cbi-button-remove',
						'click': ui.createHandlerFn(view, 'handleDeleteModal', m, this.interfaces[i]),
						'disabled': isReadonlyView
					}, [ _('Delete…') ])
				]);
			}

			cbi_update_table(table, rows, E('em', _('No unconfigured interfaces found in database.')));

			return E([], [
				E('h3', _('Unconfigured interfaces')),
				E('div', { 'class': 'cbi-section-descr' },
				         _('These interfaces are present in the vnStat database, but are not configured above.')),
				table
			]);
		}, o, this);


		return m.render();
	}
});

