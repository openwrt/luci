'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require shadowsocks-libev as ss';

var conf = 'shadowsocks-libev';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map(conf, _('Remote Servers'),
			_('Definition of remote shadowsocks servers.  \
				Disable any of them will also disable instances referring to it.'));

		s = m.section(form.GridSection, 'server');
		s.addremove = true;
		s.handleLinkImport = function() {
			var textarea = new ui.Textarea();
			ui.showModal(_('Import Links'), [
				textarea.render(),
				E('div', { class: 'right' }, [
					E('button', {
						class: 'btn',
						click: ui.hideModal
					}, [ _('Cancel') ]),
					' ',
					E('button', {
						class: 'btn cbi-button-action',
						click: ui.createHandlerFn(this, function() {
							textarea.getValue().split('\n').forEach(function(s) {
								var config = ss.parse_uri(s);
								if (config) {
									var tag = config[1];
									if (tag && !tag.match(/^[a-zA-Z0-9_]+$/)) tag = null;
									var sid = uci.add(conf, 'server', tag);
									config = config[0];
									Object.keys(config).forEach(function(k) {
										uci.set(conf, sid, k, config[k]);
									});
								}
							});
							return uci.save()
								.then(L.bind(this.map.load, this.map))
								.then(L.bind(this.map.reset, this.map))
								.then(L.ui.hideModal)
								.catch(function() {});
						})
					}, [ _('Import') ])
				])
			]);
		};
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments);
			el.appendChild(E('button', {
				'class': 'cbi-button cbi-button-add',
				'title': _('Import Links'),
				'click': ui.createHandlerFn(this, 'handleLinkImport')
			}, [ _('Import Links') ]));
			return el;
		};

		o = s.option(form.Flag, 'disabled', _('Disable'));
		o.editable = true;

		ss.options_server(s);

		return m.render();
	},
	addFooter: function() {
		var p = '#edit=';
		if (location.hash.indexOf(p) === 0) {
			var section_id = location.hash.substring(p.length);
			var editBtn = document.querySelector('#cbi-shadowsocks-libev-' + section_id + ' button.cbi-button-edit');
			if (editBtn)
				editBtn.click();
		}
		return this.super('addFooter', arguments);
	}
});
